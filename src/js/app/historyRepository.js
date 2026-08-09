// src/js/app/historyRepository.js

"use strict";

const fs = require("fs");
const path = require("path");

const HISTORY_VERSION = 2;
const EPOCH_ISO = new Date(0).toISOString();

function toFiniteNumber(value) {
  if (value === null || value === undefined || value === "") return null;
  const number = Number(value);
  return Number.isFinite(number) && number >= 0 ? number : null;
}

function parseFormattedSize(value) {
  if (typeof value !== "string") return null;
  const match = value.trim().match(/^([\d.,]+)\s*(B|KB|MB|GB|TB)$/i);
  if (!match) return null;
  const number = Number(match[1].replace(",", "."));
  if (!Number.isFinite(number) || number < 0) return null;
  const powers = { B: 0, KB: 1, MB: 2, GB: 3, TB: 4 };
  return Math.round(number * 1024 ** powers[match[2].toUpperCase()]);
}

function parseCreatedAt(entry = {}) {
  const candidates = [
    entry.createdAt,
    entry.timestamp,
    entry.completedAt,
    entry.dateTime,
    entry.dateText,
  ];
  for (const candidate of candidates) {
    if (candidate === undefined || candidate === null || candidate === "") {
      continue;
    }
    if (typeof candidate === "number" && Number.isFinite(candidate)) {
      const date = new Date(candidate);
      if (!Number.isNaN(date.getTime())) return date.toISOString();
    }
    const localeMatch = String(candidate).match(
      /^(\d{2})\.(\d{2})\.(\d{4}),?\s+(\d{2}):(\d{2})(?::(\d{2}))?$/,
    );
    if (localeMatch) {
      const [, day, month, year, hour, minute, second = "00"] = localeMatch;
      const date = new Date(
        `${year}-${month}-${day}T${hour}:${minute}:${second}`,
      );
      if (!Number.isNaN(date.getTime())) return date.toISOString();
    }
    const direct = new Date(candidate);
    if (!Number.isNaN(direct.getTime())) return direct.toISOString();
  }
  return EPOCH_ISO;
}

function normalizeStatus(entry = {}) {
  const raw = String(entry.status || entry.downloadStatus || "").toLowerCase();
  if (entry.isMissing || raw === "missing" || raw === "file-missing") {
    return "missing";
  }
  if (
    entry.error === true ||
    (entry.error && typeof entry.error === "object") ||
    raw === "failed" ||
    raw === "error"
  ) {
    return "failed";
  }
  return "completed";
}

function normalizeError(entry = {}, status = normalizeStatus(entry)) {
  if (status !== "failed") return null;
  const structured =
    entry.error && typeof entry.error === "object" ? entry.error : {};
  return {
    code: String(structured.code || entry.errorCode || ""),
    message: String(
      structured.message || entry.errorMessage || entry.reason || "",
    ),
    retryable:
      typeof structured.retryable === "boolean"
        ? structured.retryable
        : typeof entry.retryable === "boolean"
          ? entry.retryable
          : null,
  };
}

function normalizeResolution(entry = {}) {
  if (entry.resolution) return String(entry.resolution);
  const quality = String(entry.quality || "");
  return (
    quality.match(/\b\d{3,5}x\d{3,5}\b/i)?.[0] ||
    quality.match(/\b\d{3,4}p\b/i)?.[0] ||
    ""
  );
}

function normalizeFps(entry = {}) {
  const direct = toFiniteNumber(entry.fps);
  if (direct !== null) return direct;
  const match = String(entry.quality || "").match(
    /\b(\d+(?:[.,]\d+)?)\s*fps\b/i,
  );
  return match ? toFiniteNumber(match[1].replace(",", ".")) : null;
}

function normalizeFormat(entry = {}, filePath = "") {
  if (entry.format || entry.container) {
    return String(entry.format || entry.container);
  }
  const extension = path.extname(filePath).replace(/^\./, "").toLowerCase();
  return extension;
}

function normalizeHistoryEntry(input = {}) {
  const entry = input && typeof input === "object" ? input : {};
  const createdAt = parseCreatedAt(entry);
  const filePath = String(entry.filePath || "");
  const sourceUrl = String(entry.sourceUrl || entry.url || "");
  const status = normalizeStatus(entry);
  const sizeBytes =
    toFiniteNumber(entry.sizeBytes) ?? parseFormattedSize(entry.formattedSize);
  const id = String(
    entry.id ||
      entry.historyEntryId ||
      `${createdAt}:${filePath || sourceUrl || entry.fileName || "entry"}`,
  );

  return {
    id,
    fileName: String(entry.fileName || entry.title || ""),
    filePath,
    sourceUrl,
    createdAt,
    sizeBytes,
    status,
    format: normalizeFormat(entry, filePath),
    resolution: normalizeResolution(entry),
    fps: normalizeFps(entry),
    durationSec: toFiniteNumber(
      entry.durationSec ?? entry.durationSeconds ?? entry.duration,
    ),
    error: normalizeError(entry, status),
    quality: String(entry.quality || ""),
    downloadKind: String(entry.downloadKind || ""),
    iconUrl: String(entry.iconUrl || ""),
    thumbnail: String(entry.thumbnail || ""),
    thumbnailCacheFile: String(entry.thumbnailCacheFile || ""),
  };
}

function normalizeHistoryEntries(entries) {
  if (!Array.isArray(entries)) {
    throw new TypeError("History entries must be an array");
  }
  return entries.map(normalizeHistoryEntry);
}

class HistoryRepository {
  constructor({ historyFilePath, fsPromises = fs.promises, now = Date.now }) {
    if (!historyFilePath) throw new TypeError("historyFilePath is required");
    this.historyFilePath = historyFilePath;
    this.fs = fsPromises;
    this.now = now;
    this.revision = 0;
    this.operationQueue = Promise.resolve();
    this.tempCounter = 0;
    this.corruptBackupPath = "";
  }

  enqueue(operation) {
    const result = this.operationQueue.then(operation, operation);
    this.operationQueue = result.catch(() => {});
    return result;
  }

  async atomicWrite(entries) {
    const envelope = { version: HISTORY_VERSION, entries };
    const directory = path.dirname(this.historyFilePath);
    const tempPath = `${this.historyFilePath}.tmp-${process.pid}-${this.now()}-${this.tempCounter++}`;
    await this.fs.mkdir(directory, { recursive: true });
    try {
      await this.fs.writeFile(
        tempPath,
        JSON.stringify(envelope, null, 2),
        "utf8",
      );
      await this.fs.rename(tempPath, this.historyFilePath);
    } catch (error) {
      await this.fs.unlink(tempPath).catch(() => {});
      throw error;
    }
    this.revision += 1;
    return this.revision;
  }

  async backupCorruptFile() {
    if (this.corruptBackupPath) return this.corruptBackupPath;
    const timestamp = new Date(this.now()).toISOString().replace(/[:.]/g, "-");
    const backupPath = `${this.historyFilePath}.corrupt-${timestamp}`;
    await this.fs.copyFile(this.historyFilePath, backupPath);
    this.corruptBackupPath = backupPath;
    return backupPath;
  }

  async readUnlocked() {
    let source;
    try {
      source = await this.fs.readFile(this.historyFilePath, "utf8");
    } catch (error) {
      if (error?.code !== "ENOENT") throw error;
      const entries = [];
      const revision = await this.atomicWrite(entries);
      return { success: true, entries, count: 0, revision };
    }

    let parsed;
    try {
      parsed = JSON.parse(source);
    } catch (error) {
      const backupPath = await this.backupCorruptFile();
      return {
        success: false,
        entries: [],
        count: 0,
        revision: this.revision,
        warning: "history-corrupt",
        error: error.message,
        backupPath,
      };
    }

    const isLegacy = Array.isArray(parsed);
    const sourceEntries = isLegacy ? parsed : parsed?.entries;
    if (
      !Array.isArray(sourceEntries) ||
      (!isLegacy && parsed?.version !== HISTORY_VERSION)
    ) {
      const backupPath = await this.backupCorruptFile();
      return {
        success: false,
        entries: [],
        count: 0,
        revision: this.revision,
        warning: "history-invalid-format",
        error: "Unsupported history storage format",
        backupPath,
      };
    }

    const entries = normalizeHistoryEntries(sourceEntries);
    let warning;
    if (isLegacy) {
      await this.atomicWrite(entries);
      warning = "history-legacy-migrated";
    }
    return {
      success: true,
      entries,
      count: entries.length,
      revision: this.revision,
      ...(warning ? { warning } : {}),
    };
  }

  read() {
    return this.enqueue(() => this.readUnlocked());
  }

  save(entries) {
    return this.enqueue(async () => {
      const normalized = normalizeHistoryEntries(entries);
      const revision = await this.atomicWrite(normalized);
      this.corruptBackupPath = "";
      return {
        success: true,
        count: normalized.length,
        revision,
      };
    });
  }

  clear() {
    return this.save([]);
  }
}

function createHistoryRepository(options) {
  return new HistoryRepository(options);
}

module.exports = {
  HISTORY_VERSION,
  createHistoryRepository,
  normalizeHistoryEntry,
  normalizeHistoryEntries,
};
