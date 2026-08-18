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

function parseIco(filePath) {
  const buf = fs.readFileSync(filePath);
  if (buf.readUInt16LE(0) !== 0 || buf.readUInt16LE(2) !== 1) {
    fail(`${filePath} is not a valid ICO file`);
  }
  const count = buf.readUInt16LE(4);
  const frames = [];
  for (let i = 0; i < count; i++) {
    const offset = 6 + i * 16;
    const width = buf[offset] === 0 ? 256 : buf[offset];
    const height = buf[offset + 1] === 0 ? 256 : buf[offset + 1];
    const size = buf.readUInt32LE(offset + 8);
    const dataOffset = buf.readUInt32LE(offset + 12);
    frames.push({
      width,
      height,
      data: buf.subarray(dataOffset, dataOffset + size),
    });
  }
  return frames;
}

function parsePe(buf) {
  if (buf.length < 0x40) return null;
  const peOffset = buf.readUInt32LE(0x3c);
  if (
    peOffset + 4 + 20 + 2 > buf.length ||
    buf.toString("ascii", peOffset, peOffset + 4) !== "PE\0\0"
  ) {
    return null;
  }
  const coffOffset = peOffset + 4;
  const numSections = buf.readUInt16LE(coffOffset + 2);
  const optSize = buf.readUInt16LE(coffOffset + 16);
  const optOffset = coffOffset + 20;
  const magic = buf.readUInt16LE(optOffset);
  const is64 = magic === 0x20b;
  if (magic !== 0x10b && magic !== 0x20b) return null;
  const dataDirOffset = optOffset + (is64 ? 112 : 96);
  const numRvaAndSizes = buf.readUInt32LE(dataDirOffset - 4);
  if (numRvaAndSizes < 3) return null;
  const resRva = buf.readUInt32LE(dataDirOffset + 2 * 8);
  if (resRva === 0) return null;

  const sectionOffset = optOffset + optSize;
  const sections = [];
  for (let i = 0; i < numSections; i++) {
    const offset = sectionOffset + i * 40;
    if (offset + 40 > buf.length) break;
    sections.push({
      name: buf.toString("ascii", offset, offset + 8).replace(/\0+$/, ""),
      virtualSize: buf.readUInt32LE(offset + 8),
      virtualAddress: buf.readUInt32LE(offset + 12),
      sizeOfRawData: buf.readUInt32LE(offset + 16),
      pointerToRawData: buf.readUInt32LE(offset + 20),
    });
  }
  return { buf, resRva, sections };
}

function rvaToOffset(sections, rva) {
  for (const section of sections) {
    const size = Math.max(section.virtualSize, section.sizeOfRawData);
    if (rva >= section.virtualAddress && rva < section.virtualAddress + size) {
      return section.pointerToRawData + (rva - section.virtualAddress);
    }
  }
  return -1;
}

function collectResourceLeaves(buf, resBase, dirOffset, sections, inheritedId) {
  if (dirOffset + 16 > buf.length) return [];
  const count =
    buf.readUInt16LE(dirOffset + 12) + buf.readUInt16LE(dirOffset + 14);
  const leaves = [];
  for (let i = 0; i < count; i++) {
    const entryOffset = dirOffset + 16 + i * 8;
    if (entryOffset + 8 > buf.length) break;
    const nameId = buf.readUInt32LE(entryOffset);
    const data = buf.readUInt32LE(entryOffset + 4);
    if ((data & 0x80000000) !== 0) {
      leaves.push(
        ...collectResourceLeaves(
          buf,
          resBase,
          resBase + (data & 0x7fffffff),
          sections,
          inheritedId ?? nameId,
        ),
      );
    } else {
      const dataEntryOffset = resBase + data;
      if (dataEntryOffset + 8 > buf.length) continue;
      const dataRva = buf.readUInt32LE(dataEntryOffset);
      const size = buf.readUInt32LE(dataEntryOffset + 4);
      const fileOffset = rvaToOffset(sections, dataRva);
      if (fileOffset < 0 || fileOffset + size > buf.length) continue;
      leaves.push({
        id: inheritedId ?? nameId,
        size,
        data: buf.subarray(fileOffset, fileOffset + size),
      });
    }
  }
  return leaves;
}

function extractIconFrames(exePath) {
  const buf = fs.readFileSync(exePath);
  const pe = parsePe(buf);
  if (!pe) fail(`${exePath} is not a valid PE executable`);
  const resBase = rvaToOffset(pe.sections, pe.resRva);
  if (resBase < 0 || resBase + 16 > buf.length) return [];

  const topCount =
    buf.readUInt16LE(resBase + 12) + buf.readUInt16LE(resBase + 14);
  let groupDirOffset = -1;
  let iconDirOffset = -1;
  for (let i = 0; i < topCount; i++) {
    const entryOffset = resBase + 16 + i * 8;
    if (entryOffset + 8 > buf.length) break;
    const typeId = buf.readUInt32LE(entryOffset);
    const data = buf.readUInt32LE(entryOffset + 4);
    if ((data & 0x80000000) === 0) continue;
    if (typeId === 14) groupDirOffset = resBase + (data & 0x7fffffff);
    else if (typeId === 3) iconDirOffset = resBase + (data & 0x7fffffff);
  }
  if (groupDirOffset < 0 || iconDirOffset < 0) return [];

  const groupLeaves = collectResourceLeaves(
    buf,
    resBase,
    groupDirOffset,
    pe.sections,
  );
  if (groupLeaves.length === 0) return [];
  const groupBuf = groupLeaves[0].data;
  if (groupBuf.length < 6) return [];
  const count = groupBuf.readUInt16LE(4);

  const entries = [];
  for (let i = 0; i < count; i++) {
    const offset = 6 + i * 14;
    if (offset + 14 > groupBuf.length) return [];
    entries.push({
      width: groupBuf[offset] === 0 ? 256 : groupBuf[offset],
      height: groupBuf[offset + 1] === 0 ? 256 : groupBuf[offset + 1],
      size: groupBuf.readUInt32LE(offset + 8),
      id: groupBuf.readUInt16LE(offset + 12),
    });
  }

  const iconLeaves = collectResourceLeaves(
    buf,
    resBase,
    iconDirOffset,
    pe.sections,
  );
  const iconById = new Map(iconLeaves.map((leaf) => [leaf.id, leaf.data]));
  return entries.map((entry) => {
    const data = iconById.get(entry.id);
    return {
      width: entry.width,
      height: entry.height,
      data: data && data.length === entry.size ? data : null,
    };
  });
}

function assertWindowsIcon(exePath, sourceFrames) {
  const frames = extractIconFrames(exePath);
  if (frames.length === 0) fail(`${exePath} has no embedded Thunder icon`);
  for (const source of sourceFrames) {
    const match = frames.find(
      (frame) => frame.width === source.width && frame.height === source.height,
    );
    if (!match || match.data === null) {
      fail(
        `${exePath} is missing the ${source.width}x${source.height} Thunder icon frame`,
      );
    }
    if (!match.data.equals(source.data)) {
      fail(
        `${exePath} ${source.width}x${source.height} icon frame differs from the approved Thunder ICO`,
      );
    }
  }
}

function verifyWindows() {
  if (process.platform !== "win32") fail("--win must run on Windows");
  const sourceFrames = parseIco(SOURCE_ICO);
  const executables = walk(
    DIST_DIR,
    (entryPath, entry) =>
      entry.isFile() &&
      /\.exe$/i.test(entry.name) &&
      (entry.name === "Thunder.exe" ||
        /^Thunder[- ]Setup.*\.exe$/i.test(entry.name)),
  );
  if (executables.length === 0) {
    fail("no Thunder.exe / Thunder Setup*.exe found under dist");
  }
  if (!executables.some((file) => path.basename(file) === "Thunder.exe")) {
    fail("Thunder.exe was not found under dist");
  }
  if (
    !executables.some((file) =>
      /^Thunder[- ]Setup.*\.exe$/i.test(path.basename(file)),
    )
  ) {
    fail("Thunder NSIS installer was not found under dist");
  }
  for (const executable of executables) {
    assertWindowsIcon(executable, sourceFrames);
  }
  console.log(
    `Verified Thunder ICO in ${executables.length} packaged Windows executable(s).`,
  );
}

module.exports = {
  parseIco,
  extractIconFrames,
  assertWindowsIcon,
  verifyWindows,
};

if (require.main === module) {
  const mode = process.argv[2];
  if (mode === "--mac") verifyMac();
  else if (mode === "--win") verifyWindows();
  else fail("pass --mac or --win");
}
