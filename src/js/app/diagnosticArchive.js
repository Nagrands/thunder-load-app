"use strict";

const fs = require("fs");
const os = require("os");
const path = require("path");
const { redactString } = require("./diagnosticsLogger");

const CRC_TABLE = Array.from({ length: 256 }, (_entry, index) => {
  let value = index;
  for (let bit = 0; bit < 8; bit += 1) {
    value = value & 1 ? 0xedb88320 ^ (value >>> 1) : value >>> 1;
  }
  return value >>> 0;
});

function crc32(buffer) {
  let crc = 0xffffffff;
  for (const byte of buffer) crc = CRC_TABLE[(crc ^ byte) & 0xff] ^ (crc >>> 8);
  return (crc ^ 0xffffffff) >>> 0;
}

function getDosDateTime(date = new Date()) {
  const year = Math.max(1980, date.getFullYear());
  return {
    date: ((year - 1980) << 9) | ((date.getMonth() + 1) << 5) | date.getDate(),
    time: (date.getHours() << 11) | (date.getMinutes() << 5) | (date.getSeconds() >> 1),
  };
}

function createZip(entries) {
  const localParts = [];
  const centralParts = [];
  let offset = 0;
  entries.forEach(({ name, data, modifiedAt = new Date() }) => {
    const fileName = Buffer.from(String(name).replace(/\\/g, "/"), "utf8");
    const content = Buffer.isBuffer(data) ? data : Buffer.from(String(data), "utf8");
    const checksum = crc32(content);
    const dos = getDosDateTime(modifiedAt);
    const local = Buffer.alloc(30);
    local.writeUInt32LE(0x04034b50, 0);
    local.writeUInt16LE(20, 4);
    local.writeUInt16LE(0x0800, 6);
    local.writeUInt16LE(0, 8);
    local.writeUInt16LE(dos.time, 10);
    local.writeUInt16LE(dos.date, 12);
    local.writeUInt32LE(checksum, 14);
    local.writeUInt32LE(content.length, 18);
    local.writeUInt32LE(content.length, 22);
    local.writeUInt16LE(fileName.length, 26);
    const central = Buffer.alloc(46);
    central.writeUInt32LE(0x02014b50, 0);
    central.writeUInt16LE(20, 4);
    central.writeUInt16LE(20, 6);
    central.writeUInt16LE(0x0800, 8);
    central.writeUInt16LE(0, 10);
    central.writeUInt16LE(dos.time, 12);
    central.writeUInt16LE(dos.date, 14);
    central.writeUInt32LE(checksum, 16);
    central.writeUInt32LE(content.length, 20);
    central.writeUInt32LE(content.length, 24);
    central.writeUInt16LE(fileName.length, 28);
    central.writeUInt32LE(offset, 42);
    localParts.push(local, fileName, content);
    centralParts.push(central, fileName);
    offset += local.length + fileName.length + content.length;
  });
  const centralSize = centralParts.reduce((sum, part) => sum + part.length, 0);
  const end = Buffer.alloc(22);
  end.writeUInt32LE(0x06054b50, 0);
  end.writeUInt16LE(entries.length, 8);
  end.writeUInt16LE(entries.length, 10);
  end.writeUInt32LE(centralSize, 12);
  end.writeUInt32LE(offset, 16);
  return Buffer.concat([...localParts, ...centralParts, end]);
}

async function collectLogEntries(logDirectory) {
  let names = [];
  try {
    names = await fs.promises.readdir(logDirectory);
  } catch {
    return [];
  }
  const selected = names
    .filter((name) => /^main_v.+\.log(?:\.\d+)?$/.test(name))
    .sort()
    .slice(-5);
  return Promise.all(
    selected.map(async (name) => {
      const filePath = path.join(logDirectory, name);
      const [rawData, stat] = await Promise.all([
        fs.promises.readFile(filePath, "utf8"),
        fs.promises.stat(filePath),
      ]);
      const data = redactString(rawData);
      return { name: `logs/${path.basename(name)}`, data, modifiedAt: stat.mtime };
    }),
  );
}

async function buildDiagnosticArchive({ app, logger }) {
  const manifest = {
    generatedAt: new Date().toISOString(),
    thunder: app.getVersion(),
    electron: process.versions.electron,
    node: process.versions.node,
    platform: process.platform,
    architecture: process.arch,
    osRelease: os.release(),
    logLevel: logger.getLevel(),
  };
  const logs = await collectLogEntries(logger.getLogDirectory());
  return createZip([
    {
      name: "diagnostics.json",
      data: `${JSON.stringify(manifest, null, 2)}\n`,
    },
    ...logs,
  ]);
}

module.exports = { buildDiagnosticArchive, collectLogEntries, createZip, crc32 };
