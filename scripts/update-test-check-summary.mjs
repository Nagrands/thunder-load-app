import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const root = path.resolve(__dirname, "..");
const targetPath = path.join(root, "tmp", "docs", "test-check.md");

const content = fs.readFileSync(targetPath, "utf8");
const statusRegex = /^- Status:\s*(PASS|FAIL|BLOCKED|NOT_RUN)\s*$/gm;
const counts = { PASS: 0, FAIL: 0, BLOCKED: 0, NOT_RUN: 0 };

for (const match of content.matchAll(statusRegex)) {
  counts[match[1]] += 1;
}

const total = counts.PASS + counts.FAIL + counts.BLOCKED + counts.NOT_RUN;
const passRate =
  total > 0 ? `${((counts.PASS / total) * 100).toFixed(1)}%` : "0.0%";

const summaryBlockRegex =
  /## Summary[\s\S]*?(?=\n# |\n## [^\n]+|\n### [^\n]+|$)/;
const summaryBlockMatch = content.match(summaryBlockRegex);

if (!summaryBlockMatch) {
  throw new Error("Summary block not found in tmp/docs/test-check.md");
}

let updatedSummary = summaryBlockMatch[0];
updatedSummary = updatedSummary.replace(/^- Total:.*$/m, `- Total: ${total}`);
updatedSummary = updatedSummary.replace(
  /^- PASS:.*$/m,
  `- PASS: ${counts.PASS}`,
);
updatedSummary = updatedSummary.replace(
  /^- FAIL:.*$/m,
  `- FAIL: ${counts.FAIL}`,
);
updatedSummary = updatedSummary.replace(
  /^- BLOCKED:.*$/m,
  `- BLOCKED: ${counts.BLOCKED}`,
);
updatedSummary = updatedSummary.replace(
  /^- NOT_RUN:.*$/m,
  `- NOT_RUN: ${counts.NOT_RUN}`,
);
updatedSummary = updatedSummary.replace(
  /^- Pass rate:.*$/m,
  `- Pass rate: ${passRate}`,
);

const nextContent = content.replace(summaryBlockRegex, updatedSummary);
fs.writeFileSync(targetPath, nextContent);

console.log(
  `[test-check:summary] Total=${total} PASS=${counts.PASS} FAIL=${counts.FAIL} BLOCKED=${counts.BLOCKED} NOT_RUN=${counts.NOT_RUN} PassRate=${passRate}`,
);
