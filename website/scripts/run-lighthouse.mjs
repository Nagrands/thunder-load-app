import { mkdirSync, writeFileSync } from "node:fs";
import { spawn } from "node:child_process";
import lighthouse from "lighthouse";
import * as chromeLauncher from "chrome-launcher";
import { evaluateLighthouseBudgets } from "./lighthouse-budget-policy.mjs";

const port = 4322;
const origin = `http://127.0.0.1:${port}`;
const lighthouseTimeoutMs = parsePositiveInteger(
  process.env.LIGHTHOUSE_TIMEOUT_MS ?? "120000",
  "LIGHTHOUSE_TIMEOUT_MS"
);
const processShutdownTimeoutMs = 5000;
const urls = [
  `${origin}/thunder-load-app/ru/`,
  `${origin}/thunder-load-app/ru/download/`,
  `${origin}/thunder-load-app/en/docs/`
];

const server = spawn("npm", ["run", "preview", "--", "--host", "127.0.0.1", "--port", String(port)], {
  detached: process.platform !== "win32",
  stdio: "inherit"
});

function parsePositiveInteger(value, name) {
  const parsed = Number(value);
  if (!Number.isSafeInteger(parsed) || parsed <= 0) {
    throw new Error(`${name} must be a positive integer`);
  }
  return parsed;
}

async function withTimeout(promise, timeoutMs, label) {
  let timer;
  const timeout = new Promise((_, reject) => {
    timer = setTimeout(() => {
      reject(new Error(`${label} timed out after ${timeoutMs}ms`));
    }, timeoutMs);
  });

  try {
    return await Promise.race([promise, timeout]);
  } finally {
    clearTimeout(timer);
  }
}

function waitForExit(child, timeoutMs) {
  if (child.exitCode !== null || child.signalCode !== null) {
    return Promise.resolve(true);
  }

  return new Promise((resolve) => {
    const onExit = () => finish(true);
    const timer = setTimeout(() => finish(false), timeoutMs);

    function finish(exited) {
      clearTimeout(timer);
      child.off("exit", onExit);
      resolve(exited);
    }

    child.once("exit", onExit);
  });
}

function signalProcessTree(child, signal) {
  if (!child.pid) return;

  try {
    if (process.platform === "win32") {
      if (child.exitCode === null && child.signalCode === null) child.kill(signal);
    } else {
      process.kill(-child.pid, signal);
    }
  } catch (error) {
    if (error?.code !== "ESRCH") throw error;
  }
}

async function waitForProcessTreeExit(child, timeoutMs) {
  if (process.platform === "win32") return waitForExit(child, timeoutMs);
  if (!child.pid) return true;

  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    try {
      process.kill(-child.pid, 0);
    } catch (error) {
      if (error?.code === "ESRCH") return true;
      throw error;
    }
    await new Promise((resolve) => setTimeout(resolve, 100));
  }
  return false;
}

async function stopProcessTree(child) {
  signalProcessTree(child, "SIGTERM");
  if (await waitForProcessTreeExit(child, processShutdownTimeoutMs)) return;

  signalProcessTree(child, "SIGKILL");
  if (!(await waitForProcessTreeExit(child, processShutdownTimeoutMs))) {
    throw new Error("Astro preview process tree did not stop");
  }
}

async function waitForServer() {
  for (let attempt = 0; attempt < 40; attempt += 1) {
    if (server.exitCode !== null || server.signalCode !== null) {
      throw new Error("Astro preview exited before becoming ready");
    }
    try {
      const response = await fetch(urls[0]);
      if (response.ok) return;
    } catch {
      // The preview process is still starting.
    }
    await new Promise((resolve) => setTimeout(resolve, 250));
  }
  throw new Error("Astro preview did not become ready");
}

const failures = [];
const warnings = [];
const resultsDir = ".lighthouse-results";
mkdirSync(resultsDir, { recursive: true });

try {
  await waitForServer();
  const chrome = await chromeLauncher.launch({
    chromeFlags: ["--headless", "--no-sandbox", "--disable-gpu"]
  });

  try {
    for (const url of urls) {
      const result = await withTimeout(
        lighthouse(url, {
          port: chrome.port,
          output: "json",
          logLevel: "error",
          formFactor: "mobile",
          screenEmulation: {
            mobile: true,
            width: 390,
            height: 844,
            deviceScaleFactor: 3,
            disabled: false
          }
        }),
        lighthouseTimeoutMs,
        `Lighthouse audit for ${url}`
      );
      if (!result) throw new Error(`Lighthouse returned no result for ${url}`);
      const { lhr } = result;
      const slug = new URL(url).pathname.replace(/^\/|\/$/g, "").replaceAll("/", "-");
      writeFileSync(`${resultsDir}/${slug}.json`, JSON.stringify(lhr, null, 2));

      const scores = {
        performance: lhr.categories.performance.score ?? 0,
        accessibility: lhr.categories.accessibility.score ?? 0,
        bestPractices: lhr.categories["best-practices"].score ?? 0,
        seo: lhr.categories.seo.score ?? 0
      };
      const lcp = lhr.audits["largest-contentful-paint"].numericValue ?? Infinity;
      const cls = lhr.audits["cumulative-layout-shift"].numericValue ?? Infinity;

      console.log(
        `${url} performance=${Math.round(scores.performance * 100)} accessibility=${Math.round(scores.accessibility * 100)} best-practices=${Math.round(scores.bestPractices * 100)} seo=${Math.round(scores.seo * 100)} LCP=${Math.round(lcp)}ms CLS=${cls.toFixed(3)}`
      );

      const evaluation = evaluateLighthouseBudgets({ url, scores, lcp, cls });
      failures.push(...evaluation.failures);
      warnings.push(...evaluation.warnings);
    }
  } finally {
    await withTimeout(chrome.kill(), processShutdownTimeoutMs, "Chrome shutdown");
  }
} finally {
  await stopProcessTree(server);
}

if (warnings.length) {
  console.warn(`Lighthouse budget warnings:\n${warnings.join("\n")}`);
}

if (failures.length) {
  throw new Error(`Lighthouse budgets failed:\n${failures.join("\n")}`);
}
