import assert from "node:assert/strict";
import test from "node:test";
import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import verify from "./verify-packaged-icons.cjs";

const { parseIco, extractIconFrames, assertWindowsIcon } = verify;

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const ICO_PATH = path.join(ROOT, "assets", "icons", "app", "app-icon.ico");
const EXPECTED_SIZES = [16, 24, 32, 48, 64, 128, 256];

function buildSyntheticPe(frames) {
  const RES_VA = 0x1000;
  const FILE_BASE = 0x200;
  const n = frames.length;
  const groupSize = 6 + 14 * n;

  const topDir = 0;
  const groupNameDir = 32;
  const groupLangDir = groupNameDir + 24;
  const groupDataEntry = groupLangDir + 24;
  const groupBlob = groupDataEntry + 16;
  const iconNameDir = groupBlob + groupSize;
  const iconLangDirs = new Array(n);
  const iconDataEntries = new Array(n);
  const frameBlobs = new Array(n);
  let cur = iconNameDir + 16 + 8 * n;
  for (let i = 0; i < n; i++) ((iconLangDirs[i] = cur), (cur += 24));
  for (let i = 0; i < n; i++) ((iconDataEntries[i] = cur), (cur += 16));
  for (let i = 0; i < n; i++)
    ((frameBlobs[i] = cur), (cur += frames[i].data.length));
  const resSize = cur;

  const R = (off) => FILE_BASE + off;
  const rva = (off) => RES_VA + off;
  const subDir = (off) => (0x80000000 | off) >>> 0;
  const buf = Buffer.alloc(FILE_BASE + resSize);

  buf.writeUInt32LE(0x40, 0x3c);
  buf.write("PE\0\0", 0x40, "ascii");
  buf.writeUInt16LE(0x8664, 0x44);
  buf.writeUInt16LE(1, 0x46);
  buf.writeUInt16LE(0xf0, 0x54);
  buf.writeUInt16LE(0x22, 0x56);
  const opt = 0x58;
  buf.writeUInt16LE(0x20b, opt);
  buf.writeUInt32LE(0x1000, opt + 0x10);
  buf.writeBigUInt64LE(0x140000000n, opt + 0x18);
  buf.writeUInt32LE(0x1000, opt + 0x20);
  buf.writeUInt32LE(0x200, opt + 0x24);
  buf.writeUInt32LE(0x2000, opt + 0x38);
  buf.writeUInt32LE(0x200, opt + 0x3c);
  buf.writeUInt16LE(3, opt + 0x44);
  buf.writeUInt32LE(16, opt + 0x6c);
  const dd = opt + 0x70;
  buf.writeUInt32LE(RES_VA, dd + 2 * 8);
  buf.writeUInt32LE(resSize, dd + 2 * 8 + 4);
  const sec = opt + 0xf0;
  buf.write(".rsrc\0\0\0", sec, "ascii");
  buf.writeUInt32LE(resSize, sec + 8);
  buf.writeUInt32LE(RES_VA, sec + 12);
  buf.writeUInt32LE(0x200, sec + 16);
  buf.writeUInt32LE(0x200, sec + 20);
  buf.writeUInt32LE(0x60000020, sec + 36);

  buf.writeUInt16LE(2, R(topDir) + 14);
  buf.writeUInt32LE(14, R(topDir) + 16);
  buf.writeUInt32LE(subDir(groupNameDir), R(topDir) + 20);
  buf.writeUInt32LE(3, R(topDir) + 24);
  buf.writeUInt32LE(subDir(iconNameDir), R(topDir) + 28);

  buf.writeUInt16LE(1, R(groupNameDir) + 14);
  buf.writeUInt32LE(1, R(groupNameDir) + 16);
  buf.writeUInt32LE(subDir(groupLangDir), R(groupNameDir) + 20);

  buf.writeUInt16LE(1, R(groupLangDir) + 14);
  buf.writeUInt32LE(0x409, R(groupLangDir) + 16);
  buf.writeUInt32LE(groupDataEntry, R(groupLangDir) + 20);

  buf.writeUInt32LE(rva(groupBlob), R(groupDataEntry));
  buf.writeUInt32LE(groupSize, R(groupDataEntry) + 4);

  const gb = R(groupBlob);
  buf.writeUInt16LE(0, gb);
  buf.writeUInt16LE(1, gb + 2);
  buf.writeUInt16LE(n, gb + 4);
  for (let i = 0; i < n; i++) {
    const o = gb + 6 + i * 14;
    buf.writeUInt8(frames[i].width === 256 ? 0 : frames[i].width, o);
    buf.writeUInt8(frames[i].height === 256 ? 0 : frames[i].height, o + 1);
    buf.writeUInt16LE(1, o + 4);
    buf.writeUInt16LE(32, o + 6);
    buf.writeUInt32LE(frames[i].data.length, o + 8);
    buf.writeUInt16LE(i + 1, o + 12);
  }

  buf.writeUInt16LE(n, R(iconNameDir) + 14);
  for (let i = 0; i < n; i++) {
    buf.writeUInt32LE(i + 1, R(iconNameDir) + 16 + i * 8);
    buf.writeUInt32LE(subDir(iconLangDirs[i]), R(iconNameDir) + 20 + i * 8);
  }
  for (let i = 0; i < n; i++) {
    const d = R(iconLangDirs[i]);
    buf.writeUInt16LE(1, d + 14);
    buf.writeUInt32LE(0x409, d + 16);
    buf.writeUInt32LE(iconDataEntries[i], d + 20);
  }
  for (let i = 0; i < n; i++) {
    buf.writeUInt32LE(rva(frameBlobs[i]), R(iconDataEntries[i]));
    buf.writeUInt32LE(frames[i].data.length, R(iconDataEntries[i]) + 4);
  }
  for (let i = 0; i < n; i++) {
    frames[i].data.copy(buf, R(frameBlobs[i]));
  }
  return buf;
}

function withTempExe(peBytes, fn) {
  const dir = mkdtempSync(path.join(os.tmpdir(), "thunder-verify-"));
  try {
    const exePath = path.join(dir, "Thunder.exe");
    writeFileSync(exePath, peBytes);
    fn(exePath);
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
}

test("parseIco reads all Thunder icon frames from the source ICO", () => {
  const frames = parseIco(ICO_PATH);
  assert.equal(frames.length, EXPECTED_SIZES.length);
  frames.forEach((frame, i) => {
    assert.equal(frame.width, EXPECTED_SIZES[i]);
    assert.equal(frame.height, EXPECTED_SIZES[i]);
    assert.equal(frame.data.subarray(1, 4).toString("ascii"), "PNG");
  });
});

test("extractIconFrames reads embedded icon resources from a PE", () => {
  const source = parseIco(ICO_PATH);
  const pe = buildSyntheticPe(source);
  withTempExe(pe, (exePath) => {
    const frames = extractIconFrames(exePath);
    assert.equal(frames.length, source.length);
    frames.forEach((frame, i) => {
      assert.equal(frame.width, source[i].width);
      assert.equal(frame.height, source[i].height);
      assert.ok(frame.data.equals(source[i].data));
    });
  });
});

test("assertWindowsIcon accepts an exe carrying the approved ICO", () => {
  const source = parseIco(ICO_PATH);
  const pe = buildSyntheticPe(source);
  withTempExe(pe, (exePath) => {
    assert.doesNotThrow(() => assertWindowsIcon(exePath, source));
  });
});

test("assertWindowsIcon rejects an exe with a corrupted icon frame", () => {
  const source = parseIco(ICO_PATH);
  const pe = buildSyntheticPe(source);
  pe[pe.length - 1] ^= 0xff;
  withTempExe(pe, (exePath) => {
    assert.throws(
      () => assertWindowsIcon(exePath, source),
      /icon frame differs from the approved Thunder ICO/,
    );
  });
});
