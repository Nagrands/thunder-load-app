import { readFile } from "node:fs/promises";
import { resolve } from "node:path";

const downloadPages = ["dist/ru/download/index.html", "dist/en/download/index.html"];
const assetPattern =
  /https:\/\/github\.com\/[^"' ]+\/releases\/download\/[^"' <]+/g;
const assetUrls = new Set();

for (const page of downloadPages) {
  const html = await readFile(resolve(page), "utf8");
  for (const match of html.matchAll(assetPattern)) {
    assetUrls.add(match[0].replaceAll("&amp;", "&"));
  }
}

if (assetUrls.size === 0) {
  throw new Error("No direct GitHub release asset links found in download pages.");
}

const headers = {
  "user-agent": "thunder-website-smoke",
  ...(process.env.GITHUB_TOKEN
    ? { authorization: `Bearer ${process.env.GITHUB_TOKEN}` }
    : {}),
};

const failures = [];
for (const url of assetUrls) {
  try {
    const response = await fetch(url, {
      method: "HEAD",
      headers,
      redirect: "follow",
      signal: AbortSignal.timeout(20_000),
    });
    if (!response.ok) failures.push(`${response.status} ${url}`);
  } catch (error) {
    failures.push(`${error instanceof Error ? error.message : String(error)} ${url}`);
  }
}

if (failures.length > 0) {
  throw new Error(`Release asset smoke check failed:\n${failures.join("\n")}`);
}

console.log(`Verified ${assetUrls.size} direct GitHub release asset links.`);
