import { existsSync, readFileSync, readdirSync, statSync } from "node:fs";
import { join, resolve } from "node:path";

const dist = resolve("dist");
if (!existsSync(dist)) throw new Error("dist/ is missing; run npm run build first");

const htmlFiles = [];
function walk(directory) {
  for (const name of readdirSync(directory)) {
    const path = join(directory, name);
    if (statSync(path).isDirectory()) walk(path);
    else if (path.endsWith(".html")) htmlFiles.push(path);
  }
}
walk(dist);

const missing = [];
const seoErrors = [];
for (const file of htmlFiles) {
  const html = readFileSync(file, "utf8");
  const hrefs = [...html.matchAll(/(?:href|src)="([^"]+)"/g)].map((match) => match[1]);
  for (const href of hrefs) {
    if (!href.startsWith("/thunder-load-app/") || href.includes("#")) continue;
    const relative = href.replace("/thunder-load-app/", "").split(/[?#]/)[0];
    const candidate = relative.endsWith("/")
      ? join(dist, relative, "index.html")
      : join(dist, relative);
    if (!existsSync(candidate)) missing.push(`${file}: ${href}`);
  }
  if (file !== join(dist, "404.html") && !html.includes('rel="canonical"')) {
    seoErrors.push(`${file}: missing canonical`);
  }
  if (/\/(ru|en)\//.test(file) && !html.includes('hreflang="x-default"')) {
    seoErrors.push(`${file}: missing hreflang`);
  }
}

if (missing.length) {
  throw new Error(`Broken internal assets or links:\n${missing.join("\n")}`);
}
for (const required of [
  "sitemap-index.xml",
  "robots.txt",
  "manifest.webmanifest",
  "og.png",
  "ru/rss.xml",
  "en/rss.xml"
]) {
  if (!existsSync(join(dist, required))) seoErrors.push(`missing ${required}`);
}
for (const page of ["ru/index.html", "en/index.html", "ru/download/index.html", "en/download/index.html"]) {
  const html = readFileSync(join(dist, page), "utf8");
  if (!html.includes("application/ld+json")) seoErrors.push(`${page}: missing JSON-LD`);
}
if (seoErrors.length) {
  throw new Error(`SEO artifact errors:\n${seoErrors.join("\n")}`);
}
console.log(`Checked ${htmlFiles.length} HTML files, internal paths, locales, and SEO artifacts.`);
