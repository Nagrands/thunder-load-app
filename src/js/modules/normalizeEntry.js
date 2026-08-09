// src/js/modules/normalizeEntry.js

function filePathToUrl(filePath) {
  if (!filePath || typeof filePath !== "string") return "";
  if (filePath.startsWith("file://")) return filePath;
  try {
    let normalized = filePath.replace(/\\/g, "/");
    if (/^[A-Za-z]:/.test(normalized)) normalized = "/" + normalized;
    const encoded = encodeURI(normalized).replace(/#/g, "%23");
    return `file://${encoded}`;
  } catch {
    return "";
  }
}

function normalizeCreatedAt(entry = {}) {
  const raw = entry.createdAt || entry.timestamp || "";
  const parsed = raw ? new Date(raw) : null;
  if (parsed && !Number.isNaN(parsed.getTime())) return parsed.toISOString();

  const dateText = entry.dateTime || entry.dateText || "";
  const match = String(dateText).match(
    /^(\d{2})\.(\d{2})\.(\d{4}),?\s+(\d{2}):(\d{2})(?::(\d{2}))?$/,
  );
  if (!match) return "";
  const [, day, month, year, hour, minute, second = "00"] = match;
  const date = new Date(`${year}-${month}-${day}T${hour}:${minute}:${second}`);
  return Number.isNaN(date.getTime()) ? "" : date.toISOString();
}

function formatDateText(createdAt, fallback = "") {
  if (fallback) return fallback;
  if (!createdAt) return "неизвестно";
  const date = new Date(createdAt);
  if (Number.isNaN(date.getTime())) return "неизвестно";
  return date.toLocaleString("ru-RU", { hour12: false });
}

function formatSize(sizeBytes) {
  const size = Number(sizeBytes);
  if (!Number.isFinite(size) || size < 0) return "";
  return `${(size / 1024 / 1024).toFixed(1)} MB`;
}

function toOptionalNumber(value) {
  if (value === null || value === undefined || value === "") return null;
  const number = Number(value);
  return Number.isFinite(number) ? number : null;
}

export async function normalizeEntry(entry, fileMetadata = null) {
  const status = String(
    entry.status || entry.downloadStatus || "completed",
  ).toLowerCase();
  const structuredError =
    entry.error && typeof entry.error === "object" ? entry.error : null;
  const createdAt = normalizeCreatedAt(entry);
  const inspectedSize =
    fileMetadata?.sizeBytes === null || fileMetadata?.sizeBytes === undefined
      ? null
      : Number(fileMetadata.sizeBytes);
  const storedSize =
    entry.sizeBytes === null || entry.sizeBytes === undefined
      ? null
      : Number(entry.sizeBytes);
  const sizeBytes = Number.isFinite(inspectedSize)
    ? inspectedSize
    : Number.isFinite(storedSize)
      ? storedSize
      : null;
  const isMissing = entry.filePath
    ? fileMetadata
      ? fileMetadata.exists === false
      : status === "missing" || entry.isMissing === true
    : false;
  const isFailed =
    status === "failed" ||
    entry.downloadStatus === "failed" ||
    entry.error === true ||
    Boolean(structuredError);
  const normalized = {
    id: entry.id || "",
    fileName: entry.fileName || "",
    filePath: entry.filePath || "",
    sourceUrl: entry.sourceUrl || "",
    createdAt,
    status: isMissing ? "missing" : isFailed ? "failed" : "completed",
    quality: entry.quality || "",
    format: entry.format || "",
    resolution: entry.resolution || "",
    fps: toOptionalNumber(entry.fps),
    durationSec: toOptionalNumber(entry.durationSec),
    sizeBytes,
    downloadKind: entry.downloadKind || "",
    downloadStatus: isFailed ? "failed" : "done",
    error: isFailed,
    errorCode: structuredError?.code || entry.errorCode || "",
    errorMessage: structuredError?.message || entry.errorMessage || "",
    retryable:
      typeof structuredError?.retryable === "boolean"
        ? structuredError.retryable
        : typeof entry.retryable === "boolean"
          ? entry.retryable
          : undefined,
    iconUrl: entry.iconUrl || "",
    thumbnail: entry.thumbnail || "",
    thumbnailCacheFile: entry.thumbnailCacheFile || "",
    dateText: formatDateText(createdAt, entry.dateTime || entry.dateText || ""),
    timestamp: createdAt,
    formattedSize: formatSize(sizeBytes),
    isMissing,
  };

  if (normalized.thumbnailCacheFile) {
    const fileUrl = filePathToUrl(normalized.thumbnailCacheFile);
    if (fileUrl) normalized.thumbnail = fileUrl;
  }

  try {
    const isAudio = /audio/i.test(
      normalized.quality || normalized.format || "",
    );
    if (!normalized.thumbnail && normalized.sourceUrl && !isAudio) {
      const url = new URL(normalized.sourceUrl);
      const host = (url.hostname || "").replace(/^www\./, "").toLowerCase();
      if (/youtube\.com|youtu\.be/.test(host)) {
        let id = "";
        if (host.includes("youtu.be")) {
          id = (url.pathname || "").split("/").filter(Boolean)[0] || "";
        } else if (url.searchParams.has("v")) {
          id = url.searchParams.get("v") || "";
        } else if ((url.pathname || "").includes("/embed/")) {
          id = (url.pathname.split("/embed/")[1] || "").split("/")[0] || "";
        } else if ((url.pathname || "").includes("/shorts/")) {
          id = (url.pathname.split("/shorts/")[1] || "").split("/")[0] || "";
        }
        if (id) {
          normalized.thumbnail = `https://img.youtube.com/vi/${id}/maxresdefault.jpg`;
        }
      }
    }
  } catch {}

  return normalized;
}
