import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const root = path.resolve(__dirname, "..");
const checklistPath = path.join(root, "tmp", "docs", "test-check.md");
const testsRoot = path.join(root, "src", "js");

const collectTestFiles = (dir) => {
  const entries = fs.readdirSync(dir, { withFileTypes: true });
  const files = [];

  for (const entry of entries) {
    const absPath = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      files.push(...collectTestFiles(absPath));
      continue;
    }
    if (!entry.isFile()) continue;
    if (!entry.name.endsWith(".test.js")) continue;
    files.push(absPath);
  }

  return files;
};

const testFiles = collectTestFiles(testsRoot)
  .map((absPath) => path.relative(root, absPath).replace(/\\/g, "/"))
  .sort((a, b) => a.localeCompare(b));

const extractCases = (content) => {
  const cases = [];
  const regex = /\b(?:test|it)\s*\(\s*(['"`])([\s\S]*?)\1\s*,/gm;

  for (const match of content.matchAll(regex)) {
    const rawTitle = match[2] || "";
    const title = rawTitle.replace(/\s+/g, " ").trim();
    if (title) cases.push(title);
  }

  return cases;
};

const sections = [];
let totalCases = 0;

for (const file of testFiles) {
  const abs = path.join(root, file);
  const content = fs.readFileSync(abs, "utf8");
  const cases = extractCases(content);
  totalCases += cases.length;

  const lines = [];
  lines.push(`### \`${file}\` (${cases.length})`);
  if (cases.length === 0) {
    lines.push("- (no explicit `test/it` cases found)");
  } else {
    for (const testCase of cases) {
      lines.push(`- [ ] ${testCase}`);
    }
  }
  sections.push(lines.join("\n"));
}

const generated = [
  "## Автотесты (Jest)",
  "",
  `- Автосборка списка: \`npm run test-check:sync-tests\``,
  `- Найдено файлов: ${testFiles.length}`,
  `- Найдено тест-кейсов (test/it): ${totalCases}`,
  "",
  "<!-- AUTO-JEST-TESTS:START -->",
  "",
  sections.join("\n\n"),
  "",
  "<!-- AUTO-JEST-TESTS:END -->",
  "",
].join("\n");

const current = fs.readFileSync(checklistPath, "utf8");
const blockRegex = /## Автотесты \(Jest\)[\s\S]*$/m;
const next = blockRegex.test(current)
  ? current.replace(blockRegex, generated.trimEnd())
  : `${current.trimEnd()}\n\n${generated.trimEnd()}\n`;

fs.writeFileSync(checklistPath, next);

console.log(
  `[test-check:sync-tests] Synced ${testFiles.length} files and ${totalCases} cases into tmp/docs/test-check.md`,
);
