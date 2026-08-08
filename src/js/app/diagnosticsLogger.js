"use strict";

const fs = require("fs");
const path = require("path");
const electronLog = require("electron-log");

const LOG_LEVEL_KEY = "diagnostics.logLevel";
const DEFAULT_LEVEL = "info";
const LOG_LEVELS = Object.freeze(["debug", "info", "warning", "error"]);
const LOG_SCOPES = Object.freeze([
  "Main",
  "IPC",
  "Downloader",
  "Player",
  "MediaLibrary",
  "Tools",
  "Settings",
  "FFmpeg",
  "yt-dlp",
  "WebControl",
]);
const MAX_LOG_SIZE = 10 * 1024 * 1024;
const MAX_LOG_FILES = 5;
const SECRET_KEY_PATTERN =
  /(?:authorization|cookie|password|secret|token|api[-_]?key|cookies?file)/i;

function normalizeLevel(value) {
  return LOG_LEVELS.includes(value) ? value : DEFAULT_LEVEL;
}

function redactString(value) {
  return String(value)
    .replace(
      /("(?:authorization|cookie|password|secret|token|api[-_]?key)"\s*:\s*")[^"]*(")/gi,
      "$1[REDACTED]$2",
    )
    .replace(/(authorization\s*[:=]\s*)([^\s,;]+)/gi, "$1[REDACTED]")
    .replace(/(bearer\s+)[a-z0-9._~+\/-]+/gi, "$1[REDACTED]")
    .replace(/([?&](?:token|key|secret|auth)=)[^&#\s]+/gi, "$1[REDACTED]")
    .replace(/(--cookies(?:-from-browser)?\s+)([^\s]+)/gi, "$1[REDACTED]");
}

function sanitizeValue(value, depth = 0, seen = new WeakSet()) {
  if (value == null || typeof value === "boolean" || typeof value === "number") {
    return value;
  }
  if (typeof value === "string") return redactString(value);
  if (typeof value === "bigint") return String(value);
  if (value instanceof Error) {
    return {
      name: value.name,
      code: value.code || undefined,
      message: redactString(value.message || String(value)),
    };
  }
  if (depth >= 5) return "[TRUNCATED]";
  if (typeof value !== "object") return redactString(String(value));
  if (seen.has(value)) return "[CIRCULAR]";
  seen.add(value);
  if (Array.isArray(value)) {
    return value.slice(0, 100).map((entry) => sanitizeValue(entry, depth + 1, seen));
  }
  const output = {};
  Object.entries(value)
    .slice(0, 100)
    .forEach(([key, entry]) => {
      output[key] = SECRET_KEY_PATTERN.test(key)
        ? "[REDACTED]"
        : sanitizeValue(entry, depth + 1, seen);
    });
  return output;
}

function createCorrelationId(prefix = "op") {
  const safePrefix = String(prefix || "op")
    .replace(/[^a-z0-9-]/gi, "")
    .slice(0, 20) || "op";
  return `${safePrefix}-${Date.now().toString(36)}-${Math.random()
    .toString(16)
    .slice(2, 10)}`;
}

function rotateArchivedLogs(oldLogFile) {
  const oldLogPath = String(oldLogFile);
  try {
    for (let index = MAX_LOG_FILES - 1; index >= 1; index -= 1) {
      const source = index === 1 ? oldLogPath : `${oldLogPath}.${index - 1}`;
      const target = `${oldLogPath}.${index}`;
      if (!fs.existsSync(source)) continue;
      if (index === MAX_LOG_FILES - 1 && fs.existsSync(target)) {
        fs.rmSync(target, { force: true });
      }
      fs.renameSync(source, target);
    }
  } catch (error) {
    // electron-log must remain usable even if archival fails.
    console.error("Failed to rotate diagnostic logs:", error);
  }
}

function configureDiagnosticsLogger({ app, store, log = electronLog } = {}) {
  const version = String(app?.getVersion?.() || "unknown").replace(
    /[^0-9A-Za-z._-]/g,
    "_",
  );
  log.transports.file.fileName = `main_v${version}.log`;
  log.transports.file.maxSize = MAX_LOG_SIZE;
  log.transports.file.archiveLogFn = rotateArchivedLogs;

  const applyLevel = (level) => {
    const normalized = normalizeLevel(level);
    log.transports.file.level = normalized === "warning" ? "warn" : normalized;
    if (log.transports.console) {
      log.transports.console.level = normalized === "warning" ? "warn" : normalized;
    }
    return normalized;
  };

  let level = applyLevel(store?.get?.(LOG_LEVEL_KEY, DEFAULT_LEVEL));

  const write = (scope, requestedLevel, event, context = {}) => {
    const normalizedScope = LOG_SCOPES.includes(scope) ? scope : "Main";
    const normalizedRequestedLevel = normalizeLevel(requestedLevel);
    const method = normalizedRequestedLevel === "warning" ? "warn" : normalizedRequestedLevel;
    const payload = {
      timestamp: new Date().toISOString(),
      scope: normalizedScope,
      level: normalizedRequestedLevel,
      event: String(event || "event").slice(0, 120),
      ...sanitizeValue(context),
    };
    log[method](JSON.stringify(payload));
    return payload;
  };

  const createScope = (scope) => ({
    debug: (event, context) => write(scope, "debug", event, context),
    info: (event, context) => write(scope, "info", event, context),
    warning: (event, context) => write(scope, "warning", event, context),
    warn: (event, context) => write(scope, "warning", event, context),
    error: (event, context) => write(scope, "error", event, context),
  });

  return {
    createScope,
    getLevel: () => level,
    getLogDirectory: () => path.dirname(log.transports.file.getFile().path),
    setLevel(nextLevel) {
      level = applyLevel(nextLevel);
      store?.set?.(LOG_LEVEL_KEY, level);
      write("Settings", "info", "diagnostics-level-changed", { level });
      return level;
    },
    write,
  };
}

module.exports = {
  DEFAULT_LEVEL,
  LOG_LEVEL_KEY,
  LOG_LEVELS,
  LOG_SCOPES,
  MAX_LOG_FILES,
  MAX_LOG_SIZE,
  configureDiagnosticsLogger,
  createCorrelationId,
  normalizeLevel,
  redactString,
  rotateArchivedLogs,
  sanitizeValue,
};
