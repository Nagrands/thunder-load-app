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

    const mdAppPath = path.join(root, "src", "info", "whatsNew.md");
    const mdApp = fs.readFileSync(mdAppPath, "utf-8");
    const versionApp = readVersionFromMarkdown(mdApp);

    expect(versionApp).toBe(pkg.version);
  });

  test("root whats-new.md stays in sync", () => {
    const root = path.resolve(__dirname, "../../../..");
    const mdRootPath = path.join(root, "whats-new.md");
    const mdRoot = fs.readFileSync(mdRootPath, "utf-8");
    const versionRoot = readVersionFromMarkdown(mdRoot);

    const mdAppPath = path.join(root, "src", "info", "whatsNew.md");
    const mdApp = fs.readFileSync(mdAppPath, "utf-8");
    const versionApp = readVersionFromMarkdown(mdApp);

    expect(versionRoot).toBe(versionApp);
  });
});
