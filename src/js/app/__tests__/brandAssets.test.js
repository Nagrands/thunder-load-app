const fs = require("fs");
const path = require("path");

const ROOT = path.resolve(__dirname, "../../../..");
const assetPath = (...segments) => path.join(ROOT, "assets", ...segments);
const { resolveIconPathFromApp } = require("../iconPaths");

function readPngSize(filePath) {
  const data = fs.readFileSync(filePath);
  expect(data.subarray(1, 4).toString()).toBe("PNG");
  return [data.readUInt32BE(16), data.readUInt32BE(20)];
}

function readIcoSizes(filePath) {
  const data = fs.readFileSync(filePath);
  const count = data.readUInt16LE(4);
  return Array.from({ length: count }, (_, index) => {
    const offset = 6 + index * 16;
    const width = data[offset] || 256;
    const height = data[offset + 1] || 256;
    return `${width}x${height}`;
  });
}

describe("Thunder brand asset contract", () => {
  test("runtime icon paths resolve from Electron app.getAppPath", () => {
    expect(
      resolveIconPathFromApp(
        { getAppPath: () => "/packed/app.asar" },
        "NOTIFICATION_SUCCESS",
      ),
    ).toBe(
      path.join(
        "/packed/app.asar",
        "assets",
        "icons",
        "notifications",
        "info-done.png",
      ),
    );
  });

  test("app and platform outputs contain the required sizes", () => {
    expect(
      readPngSize(assetPath("icons", "app", "app-icon-master.png")),
    ).toEqual([1024, 1024]);
    expect(readPngSize(assetPath("icons", "app", "app-icon.png"))).toEqual([
      1024, 1024,
    ]);
    expect(readPngSize(assetPath("icons", "app", "app-icon-512.png"))).toEqual([
      512, 512,
    ]);
    expect(readPngSize(assetPath("icons", "app", "app-icon-256.png"))).toEqual([
      256, 256,
    ]);
    expect(readIcoSizes(assetPath("icons", "app", "app-icon.ico"))).toEqual([
      "16x16",
      "24x24",
      "32x32",
      "48x48",
      "64x64",
      "128x128",
      "256x256",
    ]);
    expect(
      fs
        .readFileSync(
          assetPath("icons", "platform", "macos", "app-icon.icns"),
          null,
        )
        .subarray(0, 4)
        .toString(),
    ).toBe("icns");
  });

  test("menu and notification assets keep their runtime dimensions", () => {
    for (const name of ["video", "open-folder", "settings", "logout"]) {
      expect(readPngSize(assetPath("icons", "menu", `${name}.png`))).toEqual([
        16, 16,
      ]);
    }
    for (const name of ["info-done", "info-error"]) {
      expect(
        readPngSize(assetPath("icons", "notifications", `${name}.png`)),
      ).toEqual([256, 256]);
    }
    expect(fs.existsSync(assetPath("icons", "menu", "open.png"))).toBe(false);
  });

  test("the complete SVG kit is valid and uses the shared palette", () => {
    const svgNames = [
      "symbol",
      "favicon",
      "main-logo",
      "horizontal-logo",
      "vertical-logo",
      "dark-logo",
      "light-logo",
      "monochrome-logo",
      "github-banner-template",
      "release-banner-template",
      "social-template",
      "presentation-template",
      "installer-template",
      "loading-template",
      "splash-template",
      "wallpaper-template",
    ];
    const tokens = JSON.parse(
      fs.readFileSync(
        assetPath("brand", "tokens", "thunder.tokens.json"),
        "utf8",
      ),
    );
    const svgSources = svgNames.map((name) => {
      const svg = fs.readFileSync(
        assetPath("brand", "svg", `${name}.svg`),
        "utf8",
      );
      expect(svg).toMatch(/^<svg\b/);
      expect(svg).toMatch(/viewBox="[^"]+"/);
      return svg;
    });
    expect(svgSources.join("\n")).toContain(tokens.color.primary.blue600);
  });
});
