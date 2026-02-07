const fs = require("fs");
const path = require("path");

function readVersionFromMarkdown(markdown = "") {
  const match = String(markdown).match(/version:\s*([0-9A-Za-z._-]+)/i);
  return match ? match[1] : null;
}

describe("whats-new version", () => {
  test("matches package.json", () => {
    const root = path.resolve(__dirname, "../../../..");
    const pkg = JSON.parse(
      fs.readFileSync(path.join(root, "package.json"), "utf-8"),
    );

    const mdRootPath = path.join(root, "whats-new.md");
    const mdRoot = fs.readFileSync(mdRootPath, "utf-8");
    const versionRoot = readVersionFromMarkdown(mdRoot);

    expect(versionRoot).toBe(pkg.version);
  });

  test("english whatsNew stays in sync when present", () => {
    const root = path.resolve(__dirname, "../../../..");
    const mdEnPath = path.join(root, "whats-new.en.md");
    if (!fs.existsSync(mdEnPath)) return;
    const mdEn = fs.readFileSync(mdEnPath, "utf-8");
    const versionEn = readVersionFromMarkdown(mdEn);

    const mdRootPath = path.join(root, "whats-new.md");
    const mdRoot = fs.readFileSync(mdRootPath, "utf-8");
    const versionRoot = readVersionFromMarkdown(mdRoot);

    expect(versionEn).toBe(versionRoot);
  });
});
