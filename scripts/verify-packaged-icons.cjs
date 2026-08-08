#!/usr/bin/env node

const crypto = require("crypto");
const fs = require("fs");
const os = require("os");
const path = require("path");
const { execFileSync } = require("child_process");

const ROOT = path.resolve(__dirname, "..");
const DIST_DIR = path.join(ROOT, "dist");
const SOURCE_ICNS = path.join(
  ROOT,
  "assets",
  "icons",
  "platform",
  "macos",
  "app-icon.icns",
);
const SOURCE_ICO = path.join(ROOT, "assets", "icons", "app", "app-icon.ico");

function fail(message) {
  throw new Error(`Packaged icon verification failed: ${message}`);
}

function walk(root, predicate) {
  if (!fs.existsSync(root)) return [];
  const matches = [];
  const pending = [root];
  while (pending.length > 0) {
    const current = pending.pop();
    for (const entry of fs.readdirSync(current, { withFileTypes: true })) {
      const entryPath = path.join(current, entry.name);
      if (predicate(entryPath, entry)) matches.push(entryPath);
      if (entry.isDirectory() && !entry.name.endsWith(".app")) {
        pending.push(entryPath);
      }
    }
  }
  return matches;
}

function sha256(filePath) {
  return crypto
    .createHash("sha256")
    .update(fs.readFileSync(filePath))
    .digest("hex");
}

function readPngSize(filePath) {
  const data = fs.readFileSync(filePath);
  if (data.subarray(1, 4).toString() !== "PNG") fail(`${filePath} is not PNG`);
  return [data.readUInt32BE(16), data.readUInt32BE(20)];
}

function verifyMac() {
  if (process.platform !== "darwin") fail("--mac must run on macOS");
  const apps = walk(
    DIST_DIR,
    (entryPath, entry) => entry.isDirectory() && entry.name === "Thunder.app",
  );
  if (apps.length === 0) fail("Thunder.app was not found under dist");

  for (const appPath of apps) {
    const plistPath = path.join(appPath, "Contents", "Info.plist");
    const iconName = execFileSync(
      "/usr/bin/plutil",
      ["-extract", "CFBundleIconFile", "raw", plistPath],
      { encoding: "utf8" },
    ).trim();
    if (!iconName) fail(`${appPath} has no CFBundleIconFile`);

    const resourceName = path.extname(iconName) ? iconName : `${iconName}.icns`;
    const packagedIcon = path.join(
      appPath,
      "Contents",
      "Resources",
      resourceName,
    );
    if (!fs.existsSync(packagedIcon)) fail(`${packagedIcon} does not exist`);
    if (sha256(packagedIcon) !== sha256(SOURCE_ICNS)) {
      fail(`${packagedIcon} differs from the approved Thunder ICNS`);
    }

    const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), "thunder-icon-"));
    const iconsetPath = path.join(tempDir, "Thunder.iconset");
    try {
      execFileSync("/usr/bin/iconutil", [
        "-c",
        "iconset",
        packagedIcon,
        "-o",
        iconsetPath,
      ]);
      const pngs = walk(
        iconsetPath,
        (entryPath, entry) => entry.isFile() && entryPath.endsWith(".png"),
      );
      if (pngs.length === 0)
        fail(`${packagedIcon} contains no decodable images`);
      for (const size of [16, 32, 128, 256, 512, 1024]) {
        const renderedIcon = path.join(tempDir, `Thunder-${size}.png`);
        execFileSync(
          "/usr/bin/sips",
          [
            "-s",
            "format",
            "png",
            "-z",
            String(size),
            String(size),
            packagedIcon,
            "--out",
            renderedIcon,
          ],
          { stdio: "ignore" },
        );
        const [width, height] = readPngSize(renderedIcon);
        if (width !== size || height !== size) {
          fail(`${packagedIcon} cannot render at ${size}px`);
        }
      }
    } finally {
      fs.rmSync(tempDir, { recursive: true, force: true });
    }
  }
  console.log(`Verified Thunder ICNS in ${apps.length} packaged macOS app(s).`);
}

function verifyWindows() {
  if (process.platform !== "win32") fail("--win must run on Windows");
  const script = path.join(__dirname, "verify-packaged-icons.ps1");
  execFileSync(
    "powershell.exe",
    [
      "-NoProfile",
      "-ExecutionPolicy",
      "Bypass",
      "-File",
      script,
      "-DistDir",
      DIST_DIR,
      "-SourceIco",
      SOURCE_ICO,
    ],
    { stdio: "inherit" },
  );
}

const mode = process.argv[2];
if (mode === "--mac") verifyMac();
else if (mode === "--win") verifyWindows();
else fail("pass --mac or --win");
