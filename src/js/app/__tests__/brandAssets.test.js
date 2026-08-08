const fs = require("fs");
const path = require("path");
const zlib = require("zlib");

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

function decodeRgbaPng(data) {
  expect(data.subarray(0, 8)).toEqual(
    Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]),
  );
  const width = data.readUInt32BE(16);
  const height = data.readUInt32BE(20);
  expect(data[24]).toBe(8);
  expect(data[25]).toBe(6);

  const idat = [];
  let offset = 8;
  while (offset < data.length) {
    const length = data.readUInt32BE(offset);
    const type = data.subarray(offset + 4, offset + 8).toString();
    if (type === "IDAT")
      idat.push(data.subarray(offset + 8, offset + 8 + length));
    offset += length + 12;
  }
  expect(idat.length).toBeGreaterThan(0);

  const scanlines = zlib.inflateSync(Buffer.concat(idat));
  const stride = width * 4;
  const pixels = Buffer.alloc(stride * height);
  for (let y = 0; y < height; y += 1) {
    const rowStart = y * (stride + 1);
    const filter = scanlines[rowStart];
    for (let x = 0; x < stride; x += 1) {
      const raw = scanlines[rowStart + x + 1];
      const left = x >= 4 ? pixels[y * stride + x - 4] : 0;
      const up = y > 0 ? pixels[(y - 1) * stride + x] : 0;
      const upperLeft = y > 0 && x >= 4 ? pixels[(y - 1) * stride + x - 4] : 0;
      let value = raw;
      if (filter === 1) value += left;
      else if (filter === 2) value += up;
      else if (filter === 3) value += Math.floor((left + up) / 2);
      else if (filter === 4) {
        const estimate = left + up - upperLeft;
        const distances = [left, up, upperLeft].map((item) =>
          Math.abs(estimate - item),
        );
        value += [left, up, upperLeft][
          distances.indexOf(Math.min(...distances))
        ];
      } else expect(filter).toBe(0);
      pixels[y * stride + x] = value & 0xff;
    }
  }

  const alpha = pixels.filter((_value, index) => index % 4 === 3);
  expect(alpha.some((value) => value === 0)).toBe(true);
  expect(alpha.some((value) => value > 0)).toBe(true);
  return `${width}x${height}`;
}

function readIcoFrames(filePath) {
  const data = fs.readFileSync(filePath);
  const count = data.readUInt16LE(4);
  return Array.from({ length: count }, (_, index) => {
    const entryOffset = 6 + index * 16;
    const length = data.readUInt32LE(entryOffset + 8);
    const imageOffset = data.readUInt32LE(entryOffset + 12);
    return data.subarray(imageOffset, imageOffset + length);
  });
}

function readIcnsPngFrames(filePath) {
  const data = fs.readFileSync(filePath);
  const frames = [];
  let offset = 8;
  while (offset < data.length) {
    const length = data.readUInt32BE(offset + 4);
    const payload = data.subarray(offset + 8, offset + length);
    if (payload.subarray(1, 4).toString() === "PNG") frames.push(payload);
    offset += length;
  }
  return frames;
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
    const icoFrames = readIcoFrames(assetPath("icons", "app", "app-icon.ico"));
    expect(icoFrames.map(decodeRgbaPng)).toEqual([
      "16x16",
      "24x24",
      "32x32",
      "48x48",
      "64x64",
      "128x128",
      "256x256",
    ]);

    const icnsPath = assetPath("icons", "platform", "macos", "app-icon.icns");
    expect(fs.readFileSync(icnsPath).subarray(0, 4).toString()).toBe("icns");
    expect(new Set(readIcnsPngFrames(icnsPath).map(decodeRgbaPng))).toEqual(
      new Set(["32x32", "64x64", "128x128", "256x256", "512x512", "1024x1024"]),
    );
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
