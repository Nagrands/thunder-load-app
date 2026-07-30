import { mkdirSync, writeFileSync } from "node:fs";
import { spawn } from "node:child_process";
import lighthouse from "lighthouse";
import * as chromeLauncher from "chrome-launcher";

const port = 4322;
const origin = `http://127.0.0.1:${port}`;
const urls = [
  `${origin}/thunder-load-app/ru/`,
  `${origin}/thunder-load-app/ru/download/`,
  `${origin}/thunder-load-app/en/docs/`
];

const server = spawn("npm", ["run", "preview", "--", "--host", "127.0.0.1", "--port", String(port)], {
  stdio: ["ignore", "pipe", "pipe"]
});

async function waitForServer() {
  for (let attempt = 0; attempt < 40; attempt += 1) {
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
const resultsDir = ".lighthouse-results";
mkdirSync(resultsDir, { recursive: true });

try {
  await waitForServer();
  const chrome = await chromeLauncher.launch({
    chromeFlags: ["--headless", "--no-sandbox", "--disable-gpu"]
  });

  try {
    for (const url of urls) {
      const result = await lighthouse(url, {
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
      });
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

      for (const [category, score] of Object.entries(scores)) {
        if (score < 0.95) failures.push(`${url}: ${category} ${Math.round(score * 100)} < 95`);
      }
      if (lcp > 2500) failures.push(`${url}: LCP ${Math.round(lcp)}ms > 2500ms`);
      if (cls > 0.1) failures.push(`${url}: CLS ${cls.toFixed(3)} > 0.1`);
    }
  } finally {
    chrome.kill();
  }
} finally {
  server.kill("SIGTERM");
}

if (failures.length) {
  throw new Error(`Lighthouse budgets failed:\n${failures.join("\n")}`);
}
