const log = require("electron-log");

const { classifyDownloadError, formatMissingDownloadToolsMessage } = require("../notifications");
const { getToolsVersions } = require("../toolsVersions");
const { isValidUrl, normalizeUrl } = require("../utils");
const { createDownloadEngine } = require("./engine");
const { formatVideoInfoResponse } = require("./metadataResponse");

function hasValidHttpHost(url) {
  try {
    const parsed = new URL(url);
    const supportedProtocol = ["http:", "https:"].includes(parsed.protocol);
    const supportedHost =
      parsed.hostname.includes(".") ||
      parsed.hostname === "localhost" ||
      parsed.hostname === "127.0.0.1";
    return supportedProtocol && supportedHost;
  } catch {
    return false;
  }
}

function normalizeParallelLimit(value) {
  const number = Number(value);
  if (!Number.isFinite(number)) return 1;
  return Math.max(1, Math.min(2, Math.trunc(number)));
}

function createDownloadRuntime(options = {}) {
  const {
    store,
    getDownloadPath,
    getMainWindow = () => null,
    notifyDownloadError = () => {},
    sendDownloadCompletionNotification = () => {},
    engine = createDownloadEngine({ store }),
  } = options;
  const activeDownloads = new Map();
  const activeMetadata = new Map();
  let disposed = false;

  const metadataKey = (url, previewOnly) =>
    `${previewOnly ? "preview" : "info"}:${url}`;
  const getParallelLimit = () =>
    normalizeParallelLimit(store.get("downloadParallelLimit", 1));
  const setParallelLimit = (value) => {
    const limit = normalizeParallelLimit(value);
    store.set("downloadParallelLimit", limit);
    return limit;
  };

  async function requestMetadata(url, { previewOnly = false } = {}) {
    const normalizedUrl = normalizeUrl(url);
    if (!normalizedUrl) return { success: false, error: "Invalid URL" };
    if (!hasValidHttpHost(normalizedUrl)) {
      return {
        success: false,
        error: "Invalid URL: host is incomplete. Example: https://example.com",
      };
    }
    const key = metadataKey(normalizedUrl, previewOnly);
    const token = activeMetadata.get(key) || engine.createDownloadToken();
    activeMetadata.set(key, token);
    try {
      const info = previewOnly
        ? await engine.getVideoPreview(normalizedUrl, token)
        : await engine.getVideoInfo(normalizedUrl, token);
      return formatVideoInfoResponse(info, normalizedUrl, {
        includeFormats: !previewOnly,
      });
    } catch (error) {
      const rawMessage = error?.message || String(error);
      const classified = classifyDownloadError(rawMessage);
      if (classified.code) {
        return {
          success: false,
          errorCode: classified.code,
          retryable: classified.retryable,
          retryAfterMinutes: classified.retryAfterMinutes ?? null,
          message: classified.message,
          error: classified.message,
        };
      }
      return { success: false, error: rawMessage };
    } finally {
      if (activeMetadata.get(key) === token) activeMetadata.delete(key);
    }
  }

  async function cancelVideoInfo(payload) {
    const rawUrl = typeof payload === "string" ? payload : payload?.url || "";
    const normalizedUrl = normalizeUrl(rawUrl);
    if (!normalizedUrl) return { success: false, error: "Invalid URL" };
    const previewOnly =
      typeof payload === "object" ? payload?.previewOnly !== false : true;
    const key = metadataKey(normalizedUrl, previewOnly);
    const token = activeMetadata.get(key);
    if (!token) return { success: true, cancelled: false };
    await engine.stopDownload([token]);
    activeMetadata.delete(key);
    return { success: true, cancelled: true };
  }

  async function runDownload(event, normalizedUrl, quality, token, jobId) {
    const tools = await getToolsVersions(store);
    const hasYtDlp = tools?.ytDlp?.ok;
    const hasFfmpeg = tools?.ffmpeg?.ok;
    if (!hasYtDlp || !hasFfmpeg) {
      getMainWindow()?.webContents?.send?.(
        "toast",
        formatMissingDownloadToolsMessage({ hasYtDlp, hasFfmpeg }),
        "warning",
      );
      throw new Error("Отсутствуют необходимые инструменты (yt-dlp/ffmpeg)");
    }
    const info = await engine.getVideoInfo(normalizedUrl, token);
    if (token.cancelled) throw new Error(token.cancelReason || "Download cancelled");
    const title = String(info.title || "").replace(/[\\/:*?"<>|]/g, "");
    const formats = engine.selectFormatsByQuality(info.formats, quality);
    const isSubtitle =
      quality?.type === "subtitle-only" || quality?.downloadKind === "subtitle";
    const actualQuality = isSubtitle
      ? `subtitle: ${quality.subtitleLang || "unknown"}`
      : formats.videoFormat === null
        ? `audio: ${formats.resolution}`
        : formats.resolution !== "unknown"
          ? `${formats.resolution} ${formats.fps ? `${formats.fps}fps` : ""}`
          : "unknown";
    const filePath = await engine.downloadMedia({
      event,
      downloadPath: getDownloadPath(),
      url: normalizedUrl,
      videoFormat: formats.videoFormat,
      audioFormat: formats.audioFormat,
      outputFilename: title,
      quality,
      resolution: formats.resolution,
      fps: formats.fps,
      audioExt: formats.audioExt,
      videoExt: formats.videoExt,
      token,
      jobId,
    });
    const mainWindow = getMainWindow();
    if (mainWindow?.webContents && !mainWindow.webContents.isDestroyed?.()) {
      sendDownloadCompletionNotification(title, filePath, store, mainWindow);
    }
    log.info(`[Download Complete] ${title}`);
    return {
      fileName: title,
      filePath,
      quality,
      actualQuality,
      resolution: formats.resolution,
      fps: formats.fps,
      sourceUrl: normalizedUrl,
      thumbnail: info.thumbnail || "",
      title: info.title || "",
      duration: Number(info.duration) || 0,
    };
  }

  async function start({ event, url, quality, jobId: requestedJobId = null }) {
    if (disposed) throw new Error("Download runtime is disposed");
    if (activeDownloads.size >= getParallelLimit()) {
      throw new Error("Parallel download limit reached");
    }
    const normalizedUrl = normalizeUrl(url);
    if (!isValidUrl(normalizedUrl) || !hasValidHttpHost(normalizedUrl)) {
      throw new Error("Invalid URL: host is incomplete. Example: https://example.com");
    }
    const jobId =
      requestedJobId || `job-${Date.now()}-${Math.random().toString(16).slice(2, 8)}`;
    const token = engine.createDownloadToken();
    activeDownloads.set(jobId, { token, url: normalizedUrl, quality });
    try {
      const result = await runDownload(event, normalizedUrl, quality, token, jobId);
      return { success: true, ...result, sourceUrl: normalizedUrl, jobId };
    } catch (error) {
      if (error.message === "Download cancelled") return { cancelled: true, jobId };
      const classified = classifyDownloadError(error);
      if (classified.code !== "UNKNOWN") {
        notifyDownloadError(error);
        return {
          success: false,
          jobId,
          sourceUrl: normalizedUrl,
          message: classified.message,
          errorCode: classified.code,
          retryable: classified.retryable,
          retryAfterMinutes: classified.retryAfterMinutes ?? null,
        };
      }
      notifyDownloadError(error);
      throw error;
    } finally {
      activeDownloads.delete(jobId);
    }
  }

  async function cancel(jobId) {
    if (typeof jobId !== "string" || !jobId.trim()) {
      return { success: false, errorCode: "INVALID_JOB_ID", error: "jobId must be a non-empty string" };
    }
    const entry = activeDownloads.get(jobId);
    if (!entry?.token) return { success: true, jobId, cancelled: false, reason: "not-active" };
    try {
      const count = await engine.stopDownload(entry.token);
      return { success: true, jobId, cancelled: Number(count) > 0 };
    } catch (error) {
      return { success: false, jobId, errorCode: "CANCEL_FAILED", error: error.message };
    }
  }

  async function cancelAll() {
    try {
      const tokens = [...activeDownloads.values()].map((entry) => entry.token).filter(Boolean);
      const cancelled = await engine.stopDownload(tokens);
      return { success: true, cancelled };
    } catch (error) {
      return { success: false, error: error.message };
    }
  }

  async function dispose() {
    if (disposed) return;
    disposed = true;
    const tokens = [
      ...[...activeDownloads.values()].map((entry) => entry.token),
      ...activeMetadata.values(),
    ].filter(Boolean);
    activeDownloads.clear();
    activeMetadata.clear();
    if (tokens.length) await engine.stopDownload(tokens);
  }

  return Object.freeze({
    cancel,
    cancelAll,
    cancelVideoInfo,
    dispose,
    engine,
    getActiveCount: () => activeDownloads.size,
    getParallelLimit,
    getVideoInfo: (url, options) => requestMetadata(url, { ...options, previewOnly: false }),
    getVideoPreview: (url, options) => requestMetadata(url, { ...options, previewOnly: true }),
    isBusy: () => activeDownloads.size > 0,
    setParallelLimit,
    start,
  });
}

module.exports = { createDownloadRuntime, normalizeParallelLimit };
