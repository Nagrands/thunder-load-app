import assert from "node:assert/strict";
import test from "node:test";
import {
  buildGitHubReleaseNotes,
  readVersionFromMarkdown,
  stripVersionHtmlComment,
} from "./build-whats-new.mjs";

test("reads and strips the source version marker", () => {
  const markdown = "<!-- version: 2.3.4 -->\n\n# Notes\n";
  assert.equal(readVersionFromMarkdown(markdown), "2.3.4");
  assert.equal(stripVersionHtmlComment(markdown), "# Notes\n");
});

test("builds bilingual GitHub notes with stable markers and demoted titles", () => {
  const output = buildGitHubReleaseNotes("# Новое\n\nRU\n", "# New\n\nEN\n");
  assert.match(output, /<!-- release-notes:ru -->\n### Новое/);
  assert.match(output, /<!-- release-notes:en -->\n### New/);
  assert.doesNotMatch(output, /version:/i);
  assert.equal((output.match(/release-notes:ru/g) || []).length, 2);
  assert.equal((output.match(/release-notes:en/g) || []).length, 2);
});
