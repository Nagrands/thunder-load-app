import { promises as fs } from "node:fs";
import path from "node:path";
import nunjucks from "nunjucks";

const ROOT = process.cwd();
const TEMPLATES_DIR = path.join(ROOT, "templates");
const PAGES_DIR = path.join(TEMPLATES_DIR, "pages");
const OUTPUT_DIR = path.join(ROOT, "src");

nunjucks.configure(TEMPLATES_DIR, {
  autoescape: true,
  noCache: true,
});

async function renderPage(fileName) {
  const templatePath = path.join("pages", fileName);
  const outputName = fileName.replace(/\.njk$/, ".html");
  const outputPath = path.join(OUTPUT_DIR, outputName);

  const html = nunjucks.render(templatePath, {});
  await fs.writeFile(
    outputPath,
    "<!-- generated via Nunjucks -->\n" + html,
    "utf8",
  );
  return outputName;
}

async function buildAll() {
  const entries = await fs.readdir(PAGES_DIR);
  const pages = entries.filter((name) => name.endsWith(".njk"));
  if (!pages.length) {
    console.warn("No Nunjucks pages found in", PAGES_DIR);
    return;
  }

  await Promise.all(pages.map(renderPage));
  console.log(`Rendered ${pages.length} template(s) to ${OUTPUT_DIR}`);
}

buildAll().catch((err) => {
  console.error("Nunjucks build failed:", err);
  process.exitCode = 1;
});
