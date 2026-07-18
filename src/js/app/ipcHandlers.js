// src/js/app/ipcHandlers.js

const { ipcMain, dialog, Notification, shell, app } = require("electron");
const { autoUpdater } = require("electron-updater");
const { CHANNELS } = require("../ipc/channels");
const {
  resolveIconPathFromAppDir,
  resolveIconPathFrom,
} = require("./iconPaths");

const { getToolsVersions } = require("./toolsVersions");
const {
  classifyDownloadError,
  formatMissingDownloadToolsMessage,
} = require("./notifications");
const fs = require("fs");
const fsPromises = fs.promises;
const path = require("path");
const os = require("os");
const log = require("electron-log");
const https = require("https");
const crypto = require("crypto");
const net = require("net");
const { execFile, spawn } = require("child_process");
const { promisify } = require("util");
const execFileAsync = promisify(execFile);
const {
  registerAppPreferencesIpcHandlers,
} = require("./appPreferencesIpcHandlers");
const { registerAppUpdateIpcHandlers } = require("./appUpdateIpcHandlers");
const { registerBackupIpcHandlers } = require("./backupIpcHandlers");
const { registerFileShellIpcHandlers } = require("./fileShellIpcHandlers");
const { registerFullscreenIpcHandlers } = require("./fullscreenIpcHandlers");
const { registerHistoryIpcHandlers } = require("./historyIpcHandlers");
const { registerNowPlayingIpcHandlers } = require("./nowPlayingIpcHandlers");
const { registerShortcutIpcHandlers } = require("./shortcutIpcHandlers");
const { createHistoryPreviewCache } = require("./historyPreviewIpcHandlers");
const {
  registerToolsLocationIpcHandlers,
} = require("./toolsLocationIpcHandlers");
const { registerToolsHashIpcHandlers } = require("./toolsHashIpcHandlers");
const {
  registerToolsVersionsIpcHandlers,
} = require("./toolsVersionsIpcHandlers");
const { registerUiSettingsIpcHandlers } = require("./uiSettingsIpcHandlers");
const { registerUpdateDevIpcHandlers } = require("./updateDevIpcHandlers");
const { registerWhatsNewIpcHandlers } = require("./whatsNewIpcHandlers");
const { registerWgUnlockIpcHandlers } = require("./wgUnlockIpcHandlers");
const {
  configureShortcutService,
  setGlobalShortcutsDisabled,
  setReloadShortcutSuppressed,
} = require("./shortcuts.js");
const {
  installYtDlp,
  installFfmpeg,
  installDeno,
  getVideoInfo,
  getVideoPreview,
  downloadMedia,
  stopDownload,
  setActiveDownloadToken,
  selectFormatsByQuality,
  createDownloadToken,
  setSharedStore,
} = require("../scripts/download.js");
const { isValidUrl, normalizeUrl } = require("./utils.js");
const { getEffectiveToolsDir, ensureToolsDir } = require("./toolsPaths");
const {
  getRuntimeFfmpegPath,
  getRuntimeFfprobePath,
  prepareBinaryForExecution,
} = require("./runtimeTools");
const {
  selectYouTubeBackgroundPreview,
  selectYouTubeLivePreview,
} = require("./downloaderBackgroundPreview");
console.log("ipcHandlers loaded");

/**
 * Проверяет, находится ли filePath внутри baseDir
 * @param {string} filePath - Абсолютный путь к файлу
 * @param {string} baseDir - Абсолютный путь к базовой директории
 * @returns {boolean}
 */
function isPathInsideBaseDir(filePath, baseDir) {
  const resolvedBase = path.resolve(baseDir);
  const resolvedPath = path.resolve(filePath);
  const relative = path.relative(resolvedBase, resolvedPath);
  const isInside = !relative.startsWith("..") && !path.isAbsolute(relative);

  log.info(
    `Checking if "${resolvedPath}" is inside "${resolvedBase}": ${isInside}`,
  );

  return isInside;
}

/**
 * Проверяет, является ли путь абсолютным и не содержит ли он небезопасных последовательностей
 * @param {string} filePath - Путь к файлу
 * @returns {boolean}
 */
function isValidFilePath(filePath) {
  if (typeof filePath !== "string" || filePath.includes("\u0000")) {
    log.info(`Validating file path "${filePath}": false`);
    return false;
  }
  const resolvedPath = path.resolve(filePath);
  const pathSegments = resolvedPath.split(/[\\/]+/);
  const hasTraversalSegment = pathSegments.some((segment) => segment === "..");
  const isValid = path.isAbsolute(resolvedPath) && !hasTraversalSegment;
  log.info(`Validating file path "${resolvedPath}": ${isValid}`);
  return isValid;
}

function hasValidHttpHost(url) {
  try {
    const parsed = new URL(String(url || "").trim());
    if (!["http:", "https:"].includes(parsed.protocol)) return false;
    const host = String(parsed.hostname || "")
      .trim()
      .toLowerCase();
    if (!host) return false;
    if (host === "localhost") return true;
    if (net.isIP(host) !== 0) return true;
    return host.includes(".") && !host.startsWith(".") && !host.endsWith(".");
  } catch {
    return false;
  }
}

const MEDIA_INSPECTOR_WARNING_KEYS = Object.freeze({
  NO_AUDIO: "tools.mediaInspector.warning.noAudio",
  NO_VIDEO: "tools.mediaInspector.warning.noVideo",
  UNKNOWN_CODEC: "tools.mediaInspector.warning.unknownCodec",
  VARIABLE_FRAME_RATE: "tools.mediaInspector.warning.vfr",
  HIGH_BITRATE: "tools.mediaInspector.warning.highBitrate",
  SUBTITLES_PRESENT: "tools.mediaInspector.warning.subtitlesPresent",
});

const COMMON_VIDEO_CODECS = new Set([
  "h264",
  "hevc",
  "h265",
  "vp8",
  "vp9",
  "av1",
  "mpeg4",
  "mpeg2video",
  "mjpeg",
  "prores",
  "theora",
  "vc1",
  "wmv3",
  "dnxhd",
  "dirac",
]);

const COMMON_AUDIO_CODECS = new Set([
  "aac",
  "mp3",
  "opus",
  "vorbis",
  "flac",
  "alac",
  "pcm_s16le",
  "pcm_s24le",
  "pcm_s32le",
  "ac3",
  "eac3",
  "dts",
  "truehd",
  "wavpack",
  "speex",
  "mp2",
]);

const MEDIA_INSPECTOR_HIGH_BITRATE_THRESHOLD = 50 * 1000 * 1000;
const RESUME_STATE_DIR_NAME = ".thunderload-resume";
const CONVERTER_ALLOWED_FORMATS = new Set([
  "mp4",
  "webm",
  "mkv",
  "mp3",
  "m4a",
  "wav",
  "flac",
  "ogg",
  "opus",
]);
const CONVERTER_VIDEO_FORMATS = new Set(["mp4", "webm", "mkv"]);
const CONVERTER_AUDIO_FORMATS = new Set([
  "mp3",
  "m4a",
  "wav",
  "flac",
  "ogg",
  "opus",
]);
const CONVERTER_QUALITY_PRESETS = new Set(["small", "balanced", "high"]);

function normalizeMediaInspectorText(value) {
  const text = String(value ?? "").trim();
  return text || null;
}

function toFiniteNumber(value) {
  const num = Number(value);
  return Number.isFinite(num) ? num : null;
}

function parseFraction(value) {
  const text = String(value ?? "").trim();
  if (!text || text === "0/0") return null;
  const parts = text.split("/");
  if (parts.length !== 2) return null;
  const numerator = Number(parts[0]);
  const denominator = Number(parts[1]);
  if (
    !Number.isFinite(numerator) ||
    !Number.isFinite(denominator) ||
    denominator === 0
  ) {
    return null;
  }
  return numerator / denominator;
}

function isHdrStream(stream = {}) {
  const transfer = String(stream.color_transfer || "").toLowerCase();
  const primaries = String(stream.color_primaries || "").toLowerCase();
  const colorspace = String(stream.color_space || "").toLowerCase();
  const sideData = Array.isArray(stream.side_data_list)
    ? stream.side_data_list
    : [];

  return (
    transfer.includes("2084") ||
    transfer.includes("hlg") ||
    transfer.includes("smpte") ||
    primaries.includes("bt2020") ||
    colorspace.includes("bt2020") ||
    sideData.some((entry) => {
      const label = String(
        entry?.side_data_type || entry?.type || entry?.name || "",
      ).toLowerCase();
      return (
        label.includes("mastering display") ||
        label.includes("content light level") ||
        label.includes("hdr")
      );
    })
  );
}

function hasActiveDownloads(downloadState = {}) {
  return (
    !!downloadState.downloadInProgress ||
    ((downloadState.activeDownloads || new Map()).size || 0) > 0
  );
}

function normalizeSubtitleTracks(tracks, { source = "manual" } = {}) {
  if (!tracks || typeof tracks !== "object" || Array.isArray(tracks)) {
    return [];
  }
  return Object.entries(tracks)
    .map(([lang, entries]) => {
      const normalizedLang = String(lang || "").trim();
      if (!/^[a-z0-9._-]{1,24}$/i.test(normalizedLang)) return null;
      const formats = (Array.isArray(entries) ? entries : [])
        .map((entry) => ({
          ext: String(entry?.ext || "")
            .trim()
            .toLowerCase(),
          name: String(entry?.name || entry?.format || "").trim(),
        }))
        .filter((entry) => entry.ext);
      return {
        lang: normalizedLang,
        source,
        formats,
      };
    })
    .filter(Boolean);
}

async function cleanupResumeStateDirAfterDownloadPathChange({
  oldPath,
  newPath,
  downloadState,
} = {}) {
  if (typeof oldPath !== "string" || typeof newPath !== "string") return;
  const resolvedOldPath = path.resolve(oldPath);
  const resolvedNewPath = path.resolve(newPath);
  if (resolvedOldPath === resolvedNewPath) return;
  if (hasActiveDownloads(downloadState)) {
    log.info(
      "Skipping resume state cleanup while downloads are active:",
      resolvedOldPath,
    );
    return;
  }

  const resumeDir = path.join(resolvedOldPath, RESUME_STATE_DIR_NAME);
  if (path.basename(resumeDir) !== RESUME_STATE_DIR_NAME) return;
  try {
    await fsPromises.rm(resumeDir, { recursive: true, force: true });
  } catch (error) {
    log.warn(
      `Failed to remove resume state directory: ${resumeDir}`,
      error?.message || error,
    );
  }
}

function isVariableFrameRateStream(stream = {}) {
  const avgRate = parseFraction(stream.avg_frame_rate);
  const realRate = parseFraction(stream.r_frame_rate);
  if (!avgRate || !realRate) return false;
  const maxRate = Math.max(avgRate, realRate, 1);
  return Math.abs(avgRate - realRate) / maxRate > 0.01;
}

function normalizeMediaInspectorStream(stream = {}) {
  const codec = normalizeMediaInspectorText(stream.codec_name);
  const bitrate = toFiniteNumber(stream.bit_rate);
  const language = normalizeMediaInspectorText(stream.tags?.language);
  const title = normalizeMediaInspectorText(stream.tags?.title);

  return {
    codec,
    profile: normalizeMediaInspectorText(stream.profile),
    pixelFormat: normalizeMediaInspectorText(stream.pix_fmt),
    width: toFiniteNumber(stream.width),
    height: toFiniteNumber(stream.height),
    fps:
      parseFraction(stream.avg_frame_rate) ||
      parseFraction(stream.r_frame_rate),
    variableFrameRate: isVariableFrameRateStream(stream),
    bitrate,
    hdr: isHdrStream(stream),
    colorSpace:
      normalizeMediaInspectorText(stream.color_space) ||
      normalizeMediaInspectorText(stream.color_primaries),
    channels: toFiniteNumber(stream.channels),
    channelLayout: normalizeMediaInspectorText(stream.channel_layout),
    sampleRate: toFiniteNumber(stream.sample_rate),
    language,
    title,
  };
}

function isCommonCodec(codec, streamType) {
  const normalized = String(codec || "").toLowerCase();
  if (!normalized || normalized === "unknown") return false;
  if (streamType === "audio") return COMMON_AUDIO_CODECS.has(normalized);
  if (streamType === "video") return COMMON_VIDEO_CODECS.has(normalized);
  return true;
}

function buildMediaInspectorWarnings({
  format,
  videoStreams,
  audioStreams,
  subtitleStreams,
}) {
  const warnings = [];
  const hasVideo = videoStreams.length > 0;
  const hasAudio = audioStreams.length > 0;

  if (!hasAudio) {
    warnings.push({
      code: "no-audio",
      severity: "warning",
      messageKey: MEDIA_INSPECTOR_WARNING_KEYS.NO_AUDIO,
    });
  }

  if (!hasVideo) {
    warnings.push({
      code: "no-video",
      severity: "warning",
      messageKey: MEDIA_INSPECTOR_WARNING_KEYS.NO_VIDEO,
    });
  }

  const hasUnknownCodec = [
    ...videoStreams.map((stream) => ({ stream, type: "video" })),
    ...audioStreams.map((stream) => ({ stream, type: "audio" })),
  ].some(({ stream, type }) => !isCommonCodec(stream.codec, type));

  if (hasUnknownCodec) {
    warnings.push({
      code: "unknown-codec",
      severity: "warning",
      messageKey: MEDIA_INSPECTOR_WARNING_KEYS.UNKNOWN_CODEC,
    });
  }

  if (videoStreams.some((stream) => stream.variableFrameRate)) {
    warnings.push({
      code: "variable-frame-rate",
      severity: "warning",
      messageKey: MEDIA_INSPECTOR_WARNING_KEYS.VARIABLE_FRAME_RATE,
    });
  }

  const formatBitrate = toFiniteNumber(format?.bitrate);
  if (
    formatBitrate &&
    formatBitrate >= MEDIA_INSPECTOR_HIGH_BITRATE_THRESHOLD
  ) {
    warnings.push({
      code: "high-bitrate",
      severity: "warning",
      messageKey: MEDIA_INSPECTOR_WARNING_KEYS.HIGH_BITRATE,
    });
  }

  if (subtitleStreams.length > 0) {
    warnings.push({
      code: "subtitles-present",
      severity: "info",
      messageKey: MEDIA_INSPECTOR_WARNING_KEYS.SUBTITLES_PRESENT,
    });
  }

  return warnings;
}

function buildMediaInspectorReport({ filePath, fileStat, probeData = {} }) {
  const resolvedPath = path.resolve(filePath);
  const format = probeData?.format || {};
  const streams = Array.isArray(probeData?.streams) ? probeData.streams : [];
  const videoStreams = streams
    .filter(
      (stream) => String(stream?.codec_type || "").toLowerCase() === "video",
    )
    .map(normalizeMediaInspectorStream);
  const audioStreams = streams
    .filter(
      (stream) => String(stream?.codec_type || "").toLowerCase() === "audio",
    )
    .map(normalizeMediaInspectorStream);
  const subtitleStreams = streams
    .filter(
      (stream) => String(stream?.codec_type || "").toLowerCase() === "subtitle",
    )
    .map(normalizeMediaInspectorStream);

  const report = {
    file: {
      path: resolvedPath,
      name: path.basename(resolvedPath),
      extension: path.extname(resolvedPath).toLowerCase() || "",
      sizeBytes: Number(fileStat?.size) || 0,
    },
    format: {
      container: normalizeMediaInspectorText(format.format_name),
      durationSec: toFiniteNumber(format.duration),
      bitrate: toFiniteNumber(format.bit_rate),
      probeScore: toFiniteNumber(format.probe_score),
    },
    summary: {
      videoCount: videoStreams.length,
      audioCount: audioStreams.length,
      subtitleCount: subtitleStreams.length,
      hasAudio: audioStreams.length > 0,
      hasVideo: videoStreams.length > 0,
    },
    videoStreams,
    audioStreams,
    subtitleStreams,
    warnings: [],
    rawAvailable: true,
  };

  report.warnings = buildMediaInspectorWarnings({
    format: report.format,
    videoStreams,
    audioStreams,
    subtitleStreams,
  });

  return report;
}

function normalizeConverterFailure(error, fallbackCode = "conversionFailed") {
  const allowedCodes = new Set([
    "invalidPayload",
    "missingDependency",
    "fileNotFound",
    "accessDenied",
    "conversionFailed",
    "cancelled",
  ]);
  const codeValue = String(error?.code || "");
  return {
    success: false,
    code: allowedCodes.has(codeValue) ? codeValue : fallbackCode,
    error: error?.message || String(error || "Conversion failed"),
  };
}

function normalizeConverterPayload(payload = {}) {
  const inputPath =
    typeof payload?.inputPath === "string" ? payload.inputPath.trim() : "";
  const outputDir =
    typeof payload?.outputDir === "string" ? payload.outputDir.trim() : "";
  const targetFormat = String(payload?.targetFormat || "")
    .trim()
    .toLowerCase();
  const quality = String(payload?.quality || "balanced")
    .trim()
    .toLowerCase();
  const requestId = String(payload?.requestId || crypto.randomUUID()).trim();
  return { inputPath, outputDir, targetFormat, quality, requestId };
}

function buildConverterArgs({ inputPath, outputPath, targetFormat, quality }) {
  const args = ["-hide_banner", "-n", "-i", inputPath];
  const videoCrf =
    quality === "small" ? "30" : quality === "high" ? "18" : "23";
  const webmCrf = quality === "small" ? "38" : quality === "high" ? "24" : "31";
  const audioBitrate =
    quality === "small" ? "128k" : quality === "high" ? "320k" : "192k";

  if (CONVERTER_VIDEO_FORMATS.has(targetFormat)) {
    if (targetFormat === "webm") {
      args.push(
        "-c:v",
        "libvpx-vp9",
        "-crf",
        webmCrf,
        "-b:v",
        "0",
        "-c:a",
        "libopus",
      );
    } else {
      args.push("-c:v", "libx264", "-preset", "medium", "-crf", videoCrf);
      args.push("-c:a", "aac", "-b:a", audioBitrate);
      if (targetFormat === "mp4") args.push("-movflags", "+faststart");
    }
  } else if (CONVERTER_AUDIO_FORMATS.has(targetFormat)) {
    args.push("-vn");
    if (targetFormat === "mp3")
      args.push("-c:a", "libmp3lame", "-b:a", audioBitrate);
    if (targetFormat === "m4a") args.push("-c:a", "aac", "-b:a", audioBitrate);
    if (targetFormat === "wav") args.push("-c:a", "pcm_s16le");
    if (targetFormat === "flac") args.push("-c:a", "flac");
    if (targetFormat === "ogg")
      args.push(
        "-c:a",
        "libvorbis",
        "-q:a",
        quality === "small" ? "3" : quality === "high" ? "7" : "5",
      );
    if (targetFormat === "opus")
      args.push(
        "-c:a",
        "libopus",
        "-b:a",
        quality === "small" ? "96k" : quality === "high" ? "256k" : "160k",
      );
  }

  args.push(outputPath);
  return args;
}

async function resolveConverterOutputPath({
  inputPath,
  outputDir,
  targetFormat,
}) {
  const sourceDir = path.dirname(inputPath);
  const targetDir = outputDir || sourceDir;
  await fsPromises.mkdir(targetDir, { recursive: true });
  const parsed = path.parse(inputPath);
  const baseName = `${parsed.name}-converted`;
  let candidate = path.join(targetDir, `${baseName}.${targetFormat}`);
  let index = 2;
  while (fs.existsSync(candidate)) {
    candidate = path.join(targetDir, `${baseName}-${index}.${targetFormat}`);
    index += 1;
  }
  return candidate;
}

function parseFfmpegTimeToSeconds(value) {
  const match = String(value || "").match(/(\d+):(\d+):(\d+(?:\.\d+)?)/);
  if (!match) return null;
  const [, hours, minutes, seconds] = match;
  const total = Number(hours) * 3600 + Number(minutes) * 60 + Number(seconds);
  return Number.isFinite(total) ? total : null;
}

function extractFfmpegProgress(text, totalDurationSec) {
  const durationMatch = String(text || "").match(/Duration:\s*([0-9:.]+)/);
  const timeMatch = String(text || "").match(/time=([0-9:.]+)/);
  const durationSec = parseFfmpegTimeToSeconds(durationMatch?.[1]);
  const currentSec = parseFfmpegTimeToSeconds(timeMatch?.[1]);
  const total = totalDurationSec || durationSec;
  const percent =
    total && currentSec
      ? Math.max(0, Math.min(99, Math.round((currentSec / total) * 100)))
      : null;
  return { durationSec, currentSec, percent };
}

function normalizeMediaInspectorFailure(error, fallbackCode = "analyzeFailed") {
  const message = error?.message || String(error || "Unknown error");
  const allowedCodes = new Set([
    "invalidPayload",
    "missingDependency",
    "fileNotFound",
    "accessDenied",
    "analyzeFailed",
  ]);
  const codeValue = String(error?.code || "");
  const code = allowedCodes.has(codeValue) ? codeValue : fallbackCode;
  return {
    success: false,
    code,
    error: message,
  };
}

function classifyMediaInspectorFsCode(error) {
  const code = String(error?.code || "");
  if (code === "ENOENT") return "fileNotFound";
  if (code === "EACCES" || code === "EPERM") return "accessDenied";
  return null;
}

async function resolveMediaInspectorProbePath(store) {
  let ffprobePath = getRuntimeFfprobePath(store);
  await prepareBinaryForExecution(ffprobePath);
  if (ffprobePath && fs.existsSync(ffprobePath)) {
    return ffprobePath;
  }

  try {
    log.info(
      "[tools:mediaInspectorAnalyze] ffprobe missing, attempting ffmpeg install",
    );
    await installFfmpeg();
  } catch (error) {
    log.warn(
      "[tools:mediaInspectorAnalyze] ffmpeg install failed:",
      error?.message || error,
    );
  }

  ffprobePath = getRuntimeFfprobePath(store);
  await prepareBinaryForExecution(ffprobePath);
  return ffprobePath;
}

function setupIpcHandlers(dependencies) {
  console.log("setupIpcHandlers called"); // ← должен появиться в devtools (main)
  const {
    mainWindow,
    store,
    downloadState,
    getAppVersion,
    setDownloadPath,
    historyFilePath,
    previewCacheDir,
    iconCache,
    clipboardMonitor,
    setupGlobalShortcuts,
    notifyDownloadError,
    sendDownloadCompletionNotification,
    showTrayNotification,
    setReloadMenuEnabled,
    webControlServer,
    dispatchPendingWhatsNew,
    clearPendingWhatsNewVersion,
  } = dependencies;
  const activeVideoInfoTokens = new Map();
  const activeConverterRuns = new Map();
  const makeVideoInfoTokenKey = (url, previewOnly = false) =>
    `${previewOnly ? "preview" : "info"}:${url}`;
  const normalizeParallelDownloadLimit = (value) => {
    const n = Number(value);
    if (!Number.isFinite(n)) return 1;
    return Math.max(1, Math.min(2, Math.trunc(n)));
  };
  const getParallelDownloadLimit = () =>
    normalizeParallelDownloadLimit(store.get("downloadParallelLimit", 1));
  const ytDlpCookiesDefault = Object.freeze({
    mode: "off",
    browser: "chrome",
    filePath: "",
  });
  const ytDlpCookiesModes = new Set(["off", "browser", "file"]);
  const ytDlpCookiesBrowsers = new Set([
    "chrome",
    "firefox",
    "safari",
    "edge",
    "brave",
    "chromium",
    "vivaldi",
    "opera",
  ]);
  const normalizeYtDlpCookiesSettings = (value) => {
    const raw = value && typeof value === "object" ? value : {};
    const mode = ytDlpCookiesModes.has(raw.mode)
      ? raw.mode
      : ytDlpCookiesDefault.mode;
    const browser = ytDlpCookiesBrowsers.has(raw.browser)
      ? raw.browser
      : ytDlpCookiesDefault.browser;
    const filePath =
      typeof raw.filePath === "string" && !raw.filePath.includes("\u0000")
        ? raw.filePath.trim()
        : "";
    return { mode, browser, filePath };
  };
  const getYtDlpCookiesSettings = () =>
    normalizeYtDlpCookiesSettings(
      store.get("ytDlp.cookies", ytDlpCookiesDefault),
    );
  const isValidCookiesFilePath = (filePath) =>
    typeof filePath === "string" &&
    path.isAbsolute(filePath) &&
    isValidFilePath(filePath);

  try {
    setSharedStore(store);
  } catch (e) {
    log.warn("Unable to set shared store for tools paths:", e);
  }
  try {
    store.delete("autoShutdownEnabled");
    store.delete("autoShutdownSeconds");
  } catch (e) {
    log.warn("Unable to remove legacy auto-shutdown settings:", e);
  }

  let backupReloadBlocked = false;
  let downloadReloadBlocked = false;
  const isReloadShortcutBlocked = () =>
    backupReloadBlocked || downloadReloadBlocked;
  const syncReloadBlockState = () => {
    const blocked = isReloadShortcutBlocked();
    setReloadShortcutSuppressed(blocked);
    if (typeof setReloadMenuEnabled === "function") {
      setReloadMenuEnabled(!blocked);
    }
  };
  const setDownloadReloadBlocked = (shouldBlock) => {
    const next = Boolean(shouldBlock);
    if (downloadReloadBlocked === next) return;
    downloadReloadBlocked = next;
    syncReloadBlockState();
  };
  const setBackupReloadBlocked = (shouldBlock) => {
    backupReloadBlocked = Boolean(shouldBlock);
    syncReloadBlockState();
  };
  const previewDirPath =
    (typeof previewCacheDir === "string" && previewCacheDir) ||
    path.join(app.getPath("userData"), "thunderload-previews");
  const historyPreviewCache = createHistoryPreviewCache({
    previewDirPath,
    isPathInsideBaseDir,
  });
  const { ensurePreviewCacheDir } = historyPreviewCache;

  if (mainWindow?.webContents) {
    mainWindow.webContents.on("before-input-event", (event, input) => {
      if (
        isReloadShortcutBlocked() &&
        input?.type === "keyDown" &&
        typeof input?.key === "string" &&
        ((input.key.toLowerCase() === "r" && (input.control || input.meta)) ||
          input.key.toLowerCase() === "f5")
      ) {
        event.preventDefault();
      }
    });
  }

  registerUiSettingsIpcHandlers({ ipcMain, mainWindow, store });

  registerWhatsNewIpcHandlers({
    ipcMain,
    app,
    getAppVersion,
    dispatchPendingWhatsNew,
    clearPendingWhatsNewVersion,
  });

  registerUpdateDevIpcHandlers({ ipcMain, mainWindow, getAppVersion });

  registerFileShellIpcHandlers({
    ipcMain,
    app,
    shell,
    downloadState,
    isPathInsideBaseDir,
    isValidFilePath,
    isValidUrl,
    normalizeUrl,
  });

  registerToolsVersionsIpcHandlers({ ipcMain, store });

  registerNowPlayingIpcHandlers({
    app,
    dialog,
    ffmpegPathResolver: getRuntimeFfmpegPath,
    ffprobePathResolver: getRuntimeFfprobePath,
    ipcMain,
    mainWindow,
    store,
  });

  registerFullscreenIpcHandlers({ ipcMain, mainWindow });

  const formatVideoInfoResponse = (
    info,
    normalizedUrl,
    { includeFormats = true } = {},
  ) => {
    const title = info?.title || "";
    const duration = Number(info?.duration || 0);
    // thumbnails: yt-dlp отдаёт массив; возьмём самый широкий
    let thumb = null;
    if (Array.isArray(info?.thumbnails) && info.thumbnails.length) {
      thumb =
        info.thumbnails
          .slice()
          .sort((a, b) => (b.width || 0) - (a.width || 0))[0]?.url || null;
    } else if (info?.thumbnail) {
      thumb = info.thumbnail;
    }
    // плейлист
    let playlistCount = 0;
    let playlistDuration = 0;
    let entries = [];
    if (Array.isArray(info?.entries) && info.entries.length) {
      playlistCount = info.entries.length;
      playlistDuration = info.entries.reduce(
        (acc, entry) => acc + Math.max(0, Number(entry?.duration) || 0),
        0,
      );
      entries = info.entries
        .map((e) => e?.webpage_url || e?.url)
        .filter((u) => typeof u === "string" && u.length > 0);
    } else if (typeof info?.playlist_count === "number") {
      playlistCount = info.playlist_count;
    }
    const previewInfo = Array.isArray(info?.previewFormats)
      ? { ...info, formats: info.previewFormats }
      : info;
    const backgroundPreview = selectYouTubeBackgroundPreview(
      previewInfo,
      info?.webpage_url || info?.original_url || normalizedUrl,
    );
    const livePreview = selectYouTubeLivePreview(
      previewInfo,
      info?.webpage_url || info?.original_url || normalizedUrl,
    );
    return {
      success: true,
      title,
      duration,
      thumbnail: thumb,
      backgroundPreview,
      livePreview,
      playlistCount,
      playlistDuration,
      entries,
      uploader: info?.uploader || info?.channel || "",
      channel: info?.channel || "",
      webpage_url: info?.webpage_url || info?.original_url || normalizedUrl,
      original_url: info?.original_url || normalizedUrl,
      formats: includeFormats ? info?.formats || [] : [],
      is_live: info?.is_live || false,
      extractor: info?.extractor || "",
      subtitles: includeFormats ? normalizeSubtitleTracks(info?.subtitles) : [],
      automatic_captions: includeFormats
        ? normalizeSubtitleTracks(info?.automatic_captions, {
            source: "automatic",
          })
        : [],
    };
  };

  const handleVideoInfoRequest = async (url, { previewOnly = false } = {}) => {
    try {
      const normalizedUrl = normalizeUrl(url);
      if (!normalizedUrl) throw new Error("Invalid URL");
      if (!hasValidHttpHost(normalizedUrl)) {
        throw new Error(
          "Invalid URL: host is incomplete. Example: https://example.com",
        );
      }
      const tokenKey = makeVideoInfoTokenKey(normalizedUrl, previewOnly);
      const token =
        activeVideoInfoTokens.get(tokenKey) || createDownloadToken();
      activeVideoInfoTokens.set(tokenKey, token);
      const info = previewOnly
        ? await getVideoPreview(normalizedUrl, token)
        : await getVideoInfo(normalizedUrl, token);
      return formatVideoInfoResponse(info, normalizedUrl, {
        includeFormats: !previewOnly,
      });
    } catch (e) {
      const rawMessage = e?.message || String(e);
      log.warn(
        `${previewOnly ? "get-video-preview" : "get-video-info"} error:`,
        rawMessage,
      );
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
      try {
        const normalizedUrl = normalizeUrl(url);
        if (normalizedUrl) {
          activeVideoInfoTokens.delete(
            makeVideoInfoTokenKey(normalizedUrl, previewOnly),
          );
        }
      } catch (_) {}
    }
  };

  // Предпросмотр: получить метаданные видео по URL (заголовок, длительность, превью)
  ipcMain.handle(CHANNELS.GET_VIDEO_PREVIEW, async (_evt, url) => {
    return handleVideoInfoRequest(url, { previewOnly: true });
  });

  // Полные данные видео с форматами для выбора качества и загрузки.
  ipcMain.handle(CHANNELS.GET_VIDEO_INFO, async (_evt, url) => {
    return handleVideoInfoRequest(url, { previewOnly: false });
  });

  ipcMain.handle(CHANNELS.CANCEL_VIDEO_INFO_REQUEST, async (_evt, payload) => {
    try {
      const rawUrl = typeof payload === "string" ? payload : payload?.url || "";
      const normalizedUrl = normalizeUrl(rawUrl);
      if (!normalizedUrl) return { success: false, error: "Invalid URL" };
      const previewOnly =
        typeof payload === "object" ? payload?.previewOnly !== false : true;
      const tokenKey = makeVideoInfoTokenKey(normalizedUrl, previewOnly);
      const token = activeVideoInfoTokens.get(tokenKey);
      if (!token) return { success: true, cancelled: false };
      await stopDownload([token]);
      activeVideoInfoTokens.delete(tokenKey);
      return { success: true, cancelled: true };
    } catch (error) {
      return { success: false, error: error?.message || String(error) };
    }
  });

  ipcMain.handle(CHANNELS.WEB_GET_STATUS, async () => {
    try {
      return {
        success: true,
        status: webControlServer?.getStatus?.() || {
          enabled: false,
          running: false,
          host: "0.0.0.0",
          localUrl: "",
          lanUrls: [],
          urls: { local: "", lan: [] },
          port: 0,
          url: "",
        },
      };
    } catch (error) {
      log.error("[web-control] status failed:", error);
      return { success: false, error: error.message || String(error) };
    }
  });

  ipcMain.handle(CHANNELS.WEB_SET_ENABLED, async (_evt, enabled) => {
    try {
      const status = await webControlServer?.setEnabled?.(Boolean(enabled));
      return { success: true, status };
    } catch (error) {
      log.error("[web-control] set enabled failed:", error);
      return { success: false, error: error.message || String(error) };
    }
  });

  ipcMain.handle(CHANNELS.WEB_RESTART, async () => {
    try {
      const status = await webControlServer?.restart?.();
      return { success: true, status };
    } catch (error) {
      log.error("[web-control] restart failed:", error);
      return { success: false, error: error.message || String(error) };
    }
  });

  ipcMain.handle(CHANNELS.WEB_OPEN, async () => {
    try {
      const status = await webControlServer?.open?.();
      return { success: true, status };
    } catch (error) {
      log.error("[web-control] open failed:", error);
      return { success: false, error: error.message || String(error) };
    }
  });

  ipcMain.on(CHANNELS.WEB_RENDERER_RESPONSE, (_event, payload) => {
    webControlServer?.resolveRendererResponse?.(payload);
  });

  ipcMain.handle(CHANNELS.TOOLS_SHOWINFOLDER, async (_evt, filePath) => {
    try {
      if (filePath && typeof filePath === "string") {
        shell.showItemInFolder(filePath);
        return { success: true };
      }
      return { success: false, error: "Invalid path" };
    } catch (e) {
      log.error("tools:showInFolder error:", e);
      return { success: false, error: e.message };
    }
  });

  ipcMain.handle(CHANNELS.TOOLS_MEDIA_INSPECTOR_PICK_FILE, async () => {
    try {
      const result = await dialog.showOpenDialog(mainWindow, {
        properties: ["openFile"],
      });
      if (result.canceled || !result.filePaths?.length) {
        return { success: false, canceled: true };
      }
      return { success: true, filePath: result.filePaths[0] };
    } catch (error) {
      log.error("tools:mediaInspectorPickFile error:", error);
      return { success: false, error: error.message || String(error) };
    }
  });

  ipcMain.handle(
    CHANNELS.TOOLS_MEDIA_INSPECTOR_ANALYZE,
    async (_evt, payload = {}) => {
      let ffprobePath = "";
      try {
        const rawFilePath =
          typeof payload?.filePath === "string" ? payload.filePath.trim() : "";
        if (!rawFilePath) {
          return {
            success: false,
            code: "invalidPayload",
            error: "File path is required",
          };
        }
        if (!path.isAbsolute(rawFilePath)) {
          return {
            success: false,
            code: "invalidPayload",
            error: "File path must be absolute",
          };
        }

        const resolvedFilePath = path.resolve(rawFilePath);
        const fileStat = await fsPromises.stat(resolvedFilePath);
        if (!fileStat.isFile()) {
          return {
            success: false,
            code: "invalidPayload",
            error: "Selected path is not a file",
          };
        }

        await fsPromises.access(resolvedFilePath, fs.constants.R_OK);

        ffprobePath = await resolveMediaInspectorProbePath(store);
        if (!ffprobePath || !fs.existsSync(ffprobePath)) {
          return {
            success: false,
            code: "missingDependency",
            error: "ffprobe is not available",
          };
        }

        const { stdout } = await execFileAsync(
          ffprobePath,
          [
            "-v",
            "quiet",
            "-print_format",
            "json",
            "-show_format",
            "-show_streams",
            resolvedFilePath,
          ],
          {
            windowsHide: true,
            maxBuffer: 10 * 1024 * 1024,
            timeout: 15000,
          },
        );

        const rawOutput = String(stdout || "").trim();
        if (!rawOutput) {
          return {
            success: false,
            code: "analyzeFailed",
            error: "ffprobe returned no output",
          };
        }

        let probeData;
        try {
          probeData = JSON.parse(rawOutput);
        } catch {
          return {
            success: false,
            code: "analyzeFailed",
            error: "Failed to parse ffprobe output",
          };
        }

        const report = buildMediaInspectorReport({
          filePath: resolvedFilePath,
          fileStat,
          probeData,
        });
        return { success: true, report };
      } catch (error) {
        if (String(error?.code || "") === "ENOENT") {
          const fsCode = classifyMediaInspectorFsCode(error);
          if (fsCode) {
            return {
              success: false,
              code: fsCode,
              error: error.message || String(error),
            };
          }
          if (
            ffprobePath &&
            String(error?.path || "") === String(ffprobePath || "")
          ) {
            return {
              success: false,
              code: "missingDependency",
              error: "ffprobe is not available",
            };
          }
        }
        const fsCode = classifyMediaInspectorFsCode(error);
        if (fsCode) {
          return {
            success: false,
            code: fsCode,
            error: error.message || String(error),
          };
        }
        log.error("tools:mediaInspectorAnalyze error:", error);
        return normalizeMediaInspectorFailure(error, "analyzeFailed");
      }
    },
  );

  ipcMain.handle(CHANNELS.TOOLS_CONVERTER_PICK_FILE, async () => {
    try {
      const result = await dialog.showOpenDialog(mainWindow, {
        properties: ["openFile"],
        filters: [
          {
            name: "Media files",
            extensions: [
              "mp4",
              "webm",
              "mkv",
              "mov",
              "avi",
              "m4v",
              "mp3",
              "m4a",
              "wav",
              "flac",
              "ogg",
              "opus",
              "aac",
            ],
          },
          { name: "All files", extensions: ["*"] },
        ],
      });
      if (result.canceled || !result.filePaths?.length) {
        return { success: false, canceled: true };
      }
      return { success: true, filePath: result.filePaths[0] };
    } catch (error) {
      log.error("tools:converterPickFile error:", error);
      return { success: false, error: error.message || String(error) };
    }
  });

  ipcMain.handle(CHANNELS.TOOLS_CONVERTER_PICK_FOLDER, async () => {
    try {
      const result = await dialog.showOpenDialog(mainWindow, {
        properties: ["openDirectory", "createDirectory"],
      });
      if (result.canceled || !result.filePaths?.length) {
        return { success: false, canceled: true };
      }
      return { success: true, folderPath: result.filePaths[0] };
    } catch (error) {
      log.error("tools:converterPickFolder error:", error);
      return { success: false, error: error.message || String(error) };
    }
  });

  ipcMain.handle(
    CHANNELS.TOOLS_CONVERTER_CANCEL,
    async (_evt, payload = {}) => {
      const requestId = String(payload?.requestId || "");
      const active = activeConverterRuns.get(requestId);
      if (!requestId || !active) return { success: true, cancelled: false };
      active.cancelled = true;
      try {
        active.proc?.kill?.("SIGTERM");
      } catch (error) {
        log.warn("tools:converterCancel kill failed:", error?.message || error);
      }
      return { success: true, cancelled: true };
    },
  );

  ipcMain.handle(
    CHANNELS.TOOLS_CONVERTER_CONVERT,
    async (_evt, payload = {}) => {
      let ffmpegPath = "";
      const normalized = normalizeConverterPayload(payload);
      try {
        const { inputPath, outputDir, targetFormat, quality, requestId } =
          normalized;
        if (!requestId || activeConverterRuns.has(requestId)) {
          return {
            success: false,
            code: "invalidPayload",
            error: "Invalid or duplicate requestId",
          };
        }
        if (!inputPath || !path.isAbsolute(inputPath)) {
          return {
            success: false,
            code: "invalidPayload",
            error: "Input path must be absolute",
          };
        }
        if (outputDir && !path.isAbsolute(outputDir)) {
          return {
            success: false,
            code: "invalidPayload",
            error: "Output directory must be absolute",
          };
        }
        if (!CONVERTER_ALLOWED_FORMATS.has(targetFormat)) {
          return {
            success: false,
            code: "invalidPayload",
            error: "Unsupported target format",
          };
        }
        if (!CONVERTER_QUALITY_PRESETS.has(quality)) {
          return {
            success: false,
            code: "invalidPayload",
            error: "Unsupported quality preset",
          };
        }

        const resolvedInputPath = path.resolve(inputPath);
        const inputStat = await fsPromises.stat(resolvedInputPath);
        if (!inputStat.isFile()) {
          return {
            success: false,
            code: "invalidPayload",
            error: "Selected path is not a file",
          };
        }
        await fsPromises.access(resolvedInputPath, fs.constants.R_OK);

        ffmpegPath = getRuntimeFfmpegPath(store);
        await prepareBinaryForExecution(ffmpegPath);
        if (!ffmpegPath || !fs.existsSync(ffmpegPath)) {
          try {
            await installFfmpeg();
          } catch (error) {
            log.warn(
              "[tools:converterConvert] ffmpeg install failed:",
              error?.message || error,
            );
          }
          ffmpegPath = getRuntimeFfmpegPath(store);
          await prepareBinaryForExecution(ffmpegPath);
        }
        if (!ffmpegPath || !fs.existsSync(ffmpegPath)) {
          return {
            success: false,
            code: "missingDependency",
            error: "ffmpeg is not available",
          };
        }

        const resolvedOutputPath = await resolveConverterOutputPath({
          inputPath: resolvedInputPath,
          outputDir: outputDir ? path.resolve(outputDir) : "",
          targetFormat,
        });
        const args = buildConverterArgs({
          inputPath: resolvedInputPath,
          outputPath: resolvedOutputPath,
          targetFormat,
          quality,
        });

        return await new Promise((resolve) => {
          let stderrText = "";
          let durationSec = null;
          const sendProgress = (progress) => {
            try {
              mainWindow?.webContents?.send?.(
                CHANNELS.TOOLS_CONVERTER_PROGRESS,
                {
                  requestId,
                  outputPath: resolvedOutputPath,
                  ...progress,
                },
              );
            } catch {}
          };

          const proc = spawn(ffmpegPath, args, { windowsHide: true });
          const active = { proc, cancelled: false };
          activeConverterRuns.set(requestId, active);
          sendProgress({ state: "running", percent: 0 });

          proc.stderr?.on?.("data", (chunk) => {
            const text = String(chunk || "");
            stderrText += text;
            const progress = extractFfmpegProgress(text, durationSec);
            if (progress.durationSec) durationSec = progress.durationSec;
            sendProgress({
              state: "running",
              percent: progress.percent,
              currentSec: progress.currentSec,
              durationSec,
            });
          });

          proc.on("error", (error) => {
            activeConverterRuns.delete(requestId);
            const failure = normalizeConverterFailure(
              error,
              String(error?.code || "") === "ENOENT"
                ? "missingDependency"
                : "conversionFailed",
            );
            sendProgress({ state: "error", percent: null });
            resolve(failure);
          });

          proc.on("close", (code) => {
            const activeRun = activeConverterRuns.get(requestId);
            activeConverterRuns.delete(requestId);
            if (activeRun?.cancelled) {
              sendProgress({ state: "cancelled", percent: null });
              resolve({
                success: false,
                code: "cancelled",
                error: "Conversion cancelled",
              });
              return;
            }
            if (code === 0) {
              sendProgress({ state: "done", percent: 100 });
              resolve({
                success: true,
                requestId,
                inputPath: resolvedInputPath,
                outputPath: resolvedOutputPath,
                targetFormat,
              });
              return;
            }
            sendProgress({ state: "error", percent: null });
            resolve({
              success: false,
              code: "conversionFailed",
              error: stderrText.trim() || `ffmpeg exited with code ${code}`,
            });
          });
        });
      } catch (error) {
        const fsCode = classifyMediaInspectorFsCode(error);
        if (fsCode) {
          return {
            success: false,
            code: fsCode,
            error: error.message || String(error),
          };
        }
        if (
          String(error?.code || "") === "ENOENT" &&
          ffmpegPath &&
          String(error?.path || "") === String(ffmpegPath || "")
        ) {
          return {
            success: false,
            code: "missingDependency",
            error: "ffmpeg is not available",
          };
        }
        log.error("tools:converterConvert error:", error);
        return normalizeConverterFailure(error);
      }
    },
  );

  registerToolsHashIpcHandlers({ ipcMain, dialog, mainWindow });

  const SORTER_CATEGORIES = Object.freeze({
    Images: new Set([
      ".jpg",
      ".jpeg",
      ".png",
      ".gif",
      ".webp",
      ".svg",
      ".bmp",
      ".heic",
      ".heif",
      ".tif",
      ".tiff",
      ".ico",
      ".avif",
      ".raw",
    ]),
    Videos: new Set([
      ".mp4",
      ".mov",
      ".avi",
      ".mkv",
      ".wmv",
      ".webm",
      ".m4v",
      ".flv",
      ".mpeg",
      ".mpg",
      ".3gp",
    ]),
    Music: new Set([
      ".mp3",
      ".wav",
      ".flac",
      ".m4a",
      ".aac",
      ".ogg",
      ".wma",
      ".aiff",
      ".opus",
    ]),
    Documents: new Set([
      ".pdf",
      ".docx",
      ".txt",
      ".xlsx",
      ".pptx",
      ".csv",
      ".rtf",
      ".doc",
      ".xls",
      ".ppt",
      ".odt",
      ".ods",
      ".odp",
      ".epub",
      ".md",
    ]),
    Archives: new Set([
      ".zip",
      ".rar",
      ".7z",
      ".tar",
      ".gz",
      ".bz2",
      ".xz",
      ".iso",
    ]),
  });

  const SORTER_OTHER_RULE = Object.freeze({
    id: "other",
    name: "Other",
    folderName: "Other",
    extensions: [],
    locked: true,
  });
  const SORTER_UNDO_DIR_NAME = "file-sorter-undo";
  const sorterCategoryKeys = Object.keys(SORTER_CATEGORIES);
  let latestSorterPlan = null;
  let latestSorterRun = null;

  function expandUserPath(inputPath) {
    const raw = String(inputPath || "").trim();
    if (!raw) return "";
    if (raw === "~") return os.homedir();
    if (raw.startsWith("~/") || raw.startsWith("~\\")) {
      return path.join(os.homedir(), raw.slice(2));
    }
    return raw;
  }

  function parseSorterCsvList(value) {
    const items = Array.isArray(value) ? value : String(value || "").split(",");
    return items.map((item) => String(item).trim()).filter(Boolean);
  }

  function normalizeSorterConflictMode(value) {
    const mode = String(value || "")
      .trim()
      .toLowerCase();
    if (mode === "skip" || mode === "replace") return mode;
    return "rename";
  }

  function normalizeSorterIgnoreExtensions(value) {
    return new Set(
      parseSorterCsvList(value).map((item) => {
        const normalized = item.toLowerCase();
        return normalized.startsWith(".") ? normalized : `.${normalized}`;
      }),
    );
  }

  function normalizeSorterIgnoreFolders(value) {
    return new Set(parseSorterCsvList(value).map((item) => item.toLowerCase()));
  }

  function normalizeSorterExtension(value) {
    const extension = String(value || "")
      .trim()
      .toLowerCase();
    if (!extension) return "";
    return extension.startsWith(".") ? extension : `.${extension}`;
  }

  function createDefaultSorterRules() {
    return sorterCategoryKeys.map((name) => ({
      id: name.toLowerCase(),
      name,
      folderName: name,
      extensions: Array.from(SORTER_CATEGORIES[name]),
      locked: false,
    }));
  }

  function normalizeSorterRules(value) {
    const inputRules = Array.isArray(value)
      ? value
      : createDefaultSorterRules();
    const seenIds = new Set();
    const seenFolders = new Set();
    const seenExtensions = new Set();
    const rules = [];

    for (const inputRule of inputRules) {
      const id = String(inputRule?.id || "").trim();
      const name = String(inputRule?.name || "").trim();
      const folderName = String(
        inputRule?.folderName || inputRule?.folder || "",
      ).trim();
      if (!id || !name || !folderName) {
        throw new Error("Each sorter rule requires id, name, and folderName");
      }
      if (
        folderName === "." ||
        folderName === ".." ||
        folderName.includes("/") ||
        folderName.includes("\\") ||
        path.basename(folderName) !== folderName
      ) {
        throw new Error(`Invalid sorter folder name: ${folderName}`);
      }

      const normalizedId = id.toLowerCase();
      const normalizedFolder = folderName.toLowerCase();
      if (
        normalizedId === SORTER_OTHER_RULE.id ||
        normalizedFolder === SORTER_OTHER_RULE.folderName.toLowerCase()
      ) {
        continue;
      }
      if (seenIds.has(normalizedId) || seenFolders.has(normalizedFolder)) {
        throw new Error(`Duplicate sorter rule: ${id}`);
      }

      seenIds.add(normalizedId);
      seenFolders.add(normalizedFolder);
      const extensions = Array.from(
        new Set(
          parseSorterCsvList(inputRule?.extensions)
            .map(normalizeSorterExtension)
            .filter(Boolean),
        ),
      );
      for (const extension of extensions) {
        if (seenExtensions.has(extension)) {
          throw new Error(`Duplicate sorter extension: ${extension}`);
        }
        seenExtensions.add(extension);
      }
      rules.push({
        id,
        name,
        folderName,
        extensions,
        locked: false,
      });
    }

    return [...rules, { ...SORTER_OTHER_RULE }];
  }

  function getSorterRule(extension, rules) {
    const normalizedExtension = normalizeSorterExtension(extension);
    return (
      rules.find(
        (rule) => !rule.locked && rule.extensions.includes(normalizedExtension),
      ) || rules[rules.length - 1]
    );
  }

  function isSorterManagedDirectoryName(name, rules) {
    const normalized = String(name || "")
      .trim()
      .toLowerCase();
    return rules.some((rule) => rule.folderName.toLowerCase() === normalized);
  }

  function createSorterReason(reasonCode, message, reasonParams = {}) {
    return { reasonCode, reasonParams, message };
  }

  function getSorterErrorReason(error) {
    const message = error?.message || String(error);
    const reasonCodes = {
      "Replacement target is not a file": "replacement-target-not-file",
      "Sorted file is unavailable": "sorted-file-unavailable",
      "Original source path is occupied": "source-path-occupied",
      "Replacement backup is unavailable": "replacement-backup-unavailable",
    };
    return createSorterReason(
      reasonCodes[message] || "operation-failed",
      message,
      { message },
    );
  }

  async function collectSkippedFilesInDirectory(
    rootDir,
    dir,
    rules,
    { action, message, reasonCode, reasonParams = {} },
  ) {
    const items = [];
    const entries = await fsPromises.readdir(dir, { withFileTypes: true });
    for (const entry of entries) {
      const fullPath = path.join(dir, entry.name);
      if (entry.isDirectory()) {
        items.push(
          ...(await collectSkippedFilesInDirectory(rootDir, fullPath, rules, {
            action,
            message,
            reasonCode,
            reasonParams,
          })),
        );
        continue;
      }
      if (!entry.isFile()) continue;
      const rule = getSorterRule(path.extname(entry.name), rules);
      items.push({
        fileName: entry.name,
        category: rule.name,
        ruleId: rule.id,
        sourcePath: path.resolve(fullPath),
        relativeDir: path.relative(rootDir, path.dirname(fullPath)),
        status: "skipped",
        action,
        ...createSorterReason(reasonCode, message, reasonParams),
      });
    }
    return items;
  }

  async function collectSorterFiles(
    rootDir,
    {
      recursive = false,
      resolvedLogPath = null,
      ignoreExtensions = new Set(),
      ignoreFolders = new Set(),
      rules,
    } = {},
  ) {
    const files = [];
    const skippedItems = [];

    async function walk(currentDir, depth = 0) {
      const entries = await fsPromises.readdir(currentDir, {
        withFileTypes: true,
      });
      for (const entry of entries) {
        const fullPath = path.join(currentDir, entry.name);
        const normalizedName = String(entry.name || "").toLowerCase();

        if (entry.isDirectory()) {
          if (ignoreFolders.has(normalizedName)) {
            skippedItems.push(
              ...(await collectSkippedFilesInDirectory(
                rootDir,
                fullPath,
                rules,
                {
                  action: "ignored-folder",
                  message: "Ignored by folder rule",
                  reasonCode: "ignored-folder",
                  reasonParams: { folder: entry.name },
                },
              )),
            );
            continue;
          }
          if (depth === 0 && isSorterManagedDirectoryName(entry.name, rules)) {
            skippedItems.push(
              ...(await collectSkippedFilesInDirectory(
                rootDir,
                fullPath,
                rules,
                {
                  action: "managed-category",
                  message: "Already inside a sorter category folder",
                  reasonCode: "managed-category",
                  reasonParams: { folder: entry.name },
                },
              )),
            );
            continue;
          }
          if (recursive) {
            await walk(fullPath, depth + 1);
          }
          continue;
        }

        if (!entry.isFile()) continue;
        if (entry.name.startsWith(".")) {
          const rule = getSorterRule(path.extname(entry.name), rules);
          skippedItems.push({
            fileName: entry.name,
            category: rule.name,
            ruleId: rule.id,
            sourcePath: path.resolve(fullPath),
            relativeDir: path.relative(rootDir, currentDir),
            status: "skipped",
            action: "ignored-hidden",
            ...createSorterReason("ignored-hidden", "Hidden files are skipped"),
          });
          continue;
        }
        if (resolvedLogPath && path.resolve(fullPath) === resolvedLogPath) {
          const rule = getSorterRule(path.extname(entry.name), rules);
          skippedItems.push({
            fileName: entry.name,
            category: rule.name,
            ruleId: rule.id,
            sourcePath: path.resolve(fullPath),
            relativeDir: path.relative(rootDir, currentDir),
            status: "skipped",
            action: "log-file",
            ...createSorterReason("log-file", "Sorter log file is excluded"),
          });
          continue;
        }
        const extension = path.extname(entry.name).toLowerCase();
        if (ignoreExtensions.has(extension)) {
          const rule = getSorterRule(extension, rules);
          skippedItems.push({
            fileName: entry.name,
            category: rule.name,
            ruleId: rule.id,
            sourcePath: path.resolve(fullPath),
            relativeDir: path.relative(rootDir, currentDir),
            status: "skipped",
            action: "ignored-extension",
            ...createSorterReason(
              "ignored-extension",
              `Ignored by extension rule (${extension})`,
              { extension },
            ),
          });
          continue;
        }
        const stat = await fsPromises.stat(fullPath);
        files.push({
          name: entry.name,
          sourcePath: path.resolve(fullPath),
          relativeDir: path.relative(rootDir, currentDir),
          size: stat.size,
          mtimeMs: stat.mtimeMs,
        });
      }
    }

    await walk(rootDir, 0);
    return { files, skippedItems };
  }

  async function generateUniqueTarget(targetPath) {
    const parsed = path.parse(targetPath);
    let candidate = targetPath;
    let index = 1;
    while (true) {
      try {
        await fsPromises.access(candidate, fs.constants.F_OK);
        candidate = path.join(
          parsed.dir,
          `${parsed.name} (${index})${parsed.ext}`,
        );
        index += 1;
      } catch {
        return candidate;
      }
    }
  }

  async function moveFileSafe(sourcePath, targetPath) {
    try {
      await fsPromises.rename(sourcePath, targetPath);
    } catch (error) {
      if (error?.code !== "EXDEV") throw error;
      await fsPromises.copyFile(sourcePath, targetPath);
      await fsPromises.unlink(sourcePath);
    }
  }

  function createSorterOperationId(rootDir, sourcePath, ruleId) {
    return crypto
      .createHash("sha256")
      .update(
        `${path.relative(rootDir, sourcePath).split(path.sep).join("/")}\0${ruleId}`,
      )
      .digest("hex")
      .slice(0, 24);
  }

  function getSorterUndoRoot() {
    return path.join(app.getPath("userData"), SORTER_UNDO_DIR_NAME);
  }

  async function clearSorterUndo() {
    latestSorterRun = null;
    await fsPromises.rm(getSorterUndoRoot(), { recursive: true, force: true });
  }

  try {
    fs.rmSync(getSorterUndoRoot(), { recursive: true, force: true });
  } catch {}

  async function validateSorterOperation(plan, operation) {
    if (
      !isPathInsideBaseDir(operation.sourcePath, plan.folderPath) ||
      !isPathInsideBaseDir(operation.targetPath, plan.folderPath)
    ) {
      return createSorterReason(
        "path-outside-folder",
        "Operation path is outside the selected folder",
      );
    }
    const sourceStat = await fsPromises
      .stat(operation.sourcePath)
      .catch(() => null);
    if (!sourceStat?.isFile()) {
      return createSorterReason(
        "source-unavailable",
        "Source file is unavailable",
      );
    }
    if (
      sourceStat.size !== operation.sourceSize ||
      sourceStat.mtimeMs !== operation.sourceMtimeMs
    ) {
      return createSorterReason(
        "source-changed",
        "Source file changed after preview",
      );
    }
    return null;
  }

  ipcMain.handle(CHANNELS.TOOLS_SORTER_PICK_FOLDER, async () => {
    try {
      const result = await dialog.showOpenDialog(mainWindow, {
        properties: ["openDirectory", "createDirectory"],
      });
      if (result.canceled || !result.filePaths?.length) {
        return { success: false, canceled: true };
      }
      return { success: true, folderPath: result.filePaths[0] };
    } catch (error) {
      log.error("tools:sorterPickFolder error:", error);
      return { success: false, error: error.message || String(error) };
    }
  });

  ipcMain.handle(
    CHANNELS.TOOLS_SORTER_OPEN_FOLDER,
    async (_evt, folderPath) => {
      try {
        const rawPath = String(folderPath || "").trim();
        if (!rawPath) {
          return { success: false, error: "Folder path is required" };
        }
        const resolvedFolder = path.resolve(expandUserPath(rawPath));
        const folderStat = await fsPromises
          .stat(resolvedFolder)
          .catch(() => null);
        if (!folderStat?.isDirectory()) {
          return {
            success: false,
            error: "Selected path is not a folder or is unavailable",
          };
        }
        const result = await shell.openPath(resolvedFolder);
        if (result) {
          return { success: false, error: result };
        }
        return { success: true, folderPath: resolvedFolder };
      } catch (error) {
        log.error("tools:sorterOpenFolder error:", error);
        return { success: false, error: error.message || String(error) };
      }
    },
  );

  ipcMain.handle(
    CHANNELS.TOOLS_SORTER_PREVIEW_PLAN,
    async (_evt, payload = {}) => {
      try {
        const folderPath = String(payload?.folderPath || "").trim();
        if (!folderPath) {
          return { success: false, error: "Folder path is required" };
        }

        const resolvedFolder = path.resolve(expandUserPath(folderPath));
        const folderStat = await fsPromises
          .stat(resolvedFolder)
          .catch(() => null);
        if (!folderStat?.isDirectory()) {
          return {
            success: false,
            error: "Selected path is not a folder or is unavailable",
          };
        }

        const recursive = Boolean(payload?.recursive);
        const conflictMode = normalizeSorterConflictMode(payload?.conflictMode);
        const ignoreExtensions = normalizeSorterIgnoreExtensions(
          payload?.ignoreExtensions,
        );
        const ignoreFolders = normalizeSorterIgnoreFolders(
          payload?.ignoreFolders,
        );
        const rules = normalizeSorterRules(payload?.rules);
        const { files, skippedItems } = await collectSorterFiles(
          resolvedFolder,
          {
            recursive,
            ignoreExtensions,
            ignoreFolders,
            rules,
          },
        );
        const operations = [...skippedItems];
        for (const operation of operations) {
          operation.id = createSorterOperationId(
            resolvedFolder,
            operation.sourcePath,
            operation.ruleId,
          );
        }
        const categoryCount = Object.fromEntries(
          rules.map((rule) => [rule.name, 0]),
        );

        for (const entry of files) {
          const rule = getSorterRule(path.extname(entry.name), rules);
          const targetDir = path.join(resolvedFolder, rule.folderName);
          let targetPath = path.join(targetDir, entry.name);
          let conflictAction = "move";

          if (conflictMode === "rename") {
            targetPath = await generateUniqueTarget(targetPath);
            if (path.basename(targetPath) !== entry.name) {
              conflictAction = "rename";
            }
          } else {
            try {
              await fsPromises.access(targetPath, fs.constants.F_OK);
              if (conflictMode === "skip") {
                operations.push({
                  id: createSorterOperationId(
                    resolvedFolder,
                    entry.sourcePath,
                    rule.id,
                  ),
                  fileName: entry.name,
                  category: rule.name,
                  ruleId: rule.id,
                  sourcePath: entry.sourcePath,
                  targetPath,
                  renamed: false,
                  status: "skipped",
                  action: "skip-existing",
                  ...createSorterReason(
                    "target-exists",
                    "Target file already exists",
                  ),
                });
                continue;
              }
              if (conflictMode === "replace") {
                conflictAction = "replace";
              }
            } catch {}
          }

          const item = {
            id: createSorterOperationId(
              resolvedFolder,
              entry.sourcePath,
              rule.id,
            ),
            fileName: entry.name,
            category: rule.name,
            ruleId: rule.id,
            sourcePath: entry.sourcePath,
            targetPath,
            sourceSize: entry.size,
            sourceMtimeMs: entry.mtimeMs,
            renamed: path.basename(targetPath) !== entry.name,
            relativeDir:
              entry.relativeDir && entry.relativeDir !== "."
                ? entry.relativeDir
                : "",
            status: "planned",
            action: conflictAction,
          };
          operations.push(item);
          categoryCount[rule.name] += 1;
        }
        operations.forEach((operation) => {
          operation.selectable = operation.status === "planned";
        });

        const planId = crypto.randomUUID();
        latestSorterPlan = {
          planId,
          folderPath: resolvedFolder,
          conflictMode,
          recursive,
          ignoreExtensions: Array.from(ignoreExtensions),
          ignoreFolders: Array.from(ignoreFolders),
          rules,
          operations,
        };
        return {
          success: true,
          ...latestSorterPlan,
          planned: operations.filter((item) => item.status === "planned")
            .length,
          skipped: operations.filter((item) => item.status === "skipped")
            .length,
          totalFiles: operations.length,
          processedFiles: files.length,
          categoryCount,
        };
      } catch (error) {
        log.error("tools:previewSorterPlan error:", error);
        return { success: false, error: error.message || String(error) };
      }
    },
  );

  ipcMain.handle(
    CHANNELS.TOOLS_SORTER_APPLY_PLAN,
    async (_evt, payload = {}) => {
      try {
        if (!latestSorterPlan) {
          return { success: false, error: "No sorter plan is available" };
        }
        if (
          payload?.planId &&
          String(payload.planId) !== latestSorterPlan.planId
        ) {
          return { success: false, error: "Sorter plan is no longer current" };
        }

        const selectedIds = Array.isArray(payload?.operationIds)
          ? payload.operationIds
          : payload?.selectedOperationIds;
        if (!Array.isArray(selectedIds)) {
          return {
            success: false,
            error: "Selected operation IDs are required",
          };
        }
        const selectedSet = new Set(selectedIds.map(String));
        const operations = latestSorterPlan.operations.filter(
          (item) => item.status === "planned" && selectedSet.has(item.id),
        );
        if (operations.length !== selectedSet.size) {
          return {
            success: false,
            error: "One or more selected operations are invalid",
          };
        }

        await clearSorterUndo();
        const runId = crypto.randomUUID();
        const backupDir = path.join(getSorterUndoRoot(), runId);
        const completed = [];
        const results = [];

        for (const operation of operations) {
          const validationReason = await validateSorterOperation(
            latestSorterPlan,
            operation,
          );
          if (validationReason) {
            results.push({
              ...operation,
              status: "error",
              ...validationReason,
            });
            continue;
          }

          let backupPath = "";
          try {
            const targetStat = await fsPromises
              .stat(operation.targetPath)
              .catch(() => null);
            if (targetStat) {
              if (latestSorterPlan.conflictMode === "skip") {
                results.push({
                  ...operation,
                  status: "skipped",
                  action: "skip-existing",
                  ...createSorterReason(
                    "target-exists",
                    "Target file already exists",
                  ),
                });
                continue;
              }
              if (latestSorterPlan.conflictMode === "rename") {
                results.push({
                  ...operation,
                  status: "error",
                  ...createSorterReason(
                    "target-changed",
                    "Target path changed after preview",
                  ),
                });
                continue;
              }
              if (!targetStat.isFile()) {
                throw new Error("Replacement target is not a file");
              }
              await fsPromises.mkdir(backupDir, { recursive: true });
              backupPath = path.join(backupDir, `${operation.id}.backup`);
              await moveFileSafe(operation.targetPath, backupPath);
            }

            await fsPromises.mkdir(path.dirname(operation.targetPath), {
              recursive: true,
            });
            await moveFileSafe(operation.sourcePath, operation.targetPath);
            const completedOperation = { ...operation, backupPath };
            completed.push(completedOperation);
            results.push({ ...operation, status: "moved" });
          } catch (error) {
            if (backupPath) {
              await moveFileSafe(backupPath, operation.targetPath).catch(
                () => {},
              );
            }
            results.push({
              ...operation,
              status: "error",
              ...getSorterErrorReason(error),
            });
          }
        }

        latestSorterRun = completed.length
          ? {
              runId,
              planId: latestSorterPlan.planId,
              backupDir,
              operations: completed,
            }
          : null;
        if (!latestSorterRun) {
          await fsPromises.rm(backupDir, { recursive: true, force: true });
        }

        return {
          success: true,
          runId: latestSorterRun ? runId : "",
          planId: latestSorterPlan.planId,
          moved: completed.length,
          skipped: results.filter((item) => item.status === "skipped").length,
          totalFiles: results.length,
          errors: results
            .filter((item) => item.status === "error")
            .map((item) => ({ id: item.id, message: item.message })),
          operations: results,
          canUndo: Boolean(latestSorterRun),
        };
      } catch (error) {
        log.error("tools:applySorterPlan error:", error);
        return { success: false, error: error.message || String(error) };
      }
    },
  );

  ipcMain.handle(CHANNELS.TOOLS_SORTER_UNDO_RUN, async (_evt, payload = {}) => {
    try {
      if (!latestSorterRun) {
        return { success: false, error: "No sorter run is available to undo" };
      }
      if (payload?.runId && String(payload.runId) !== latestSorterRun.runId) {
        return { success: false, error: "Sorter run is no longer current" };
      }

      const results = [];
      const remainingOperations = [];
      for (const operation of [...latestSorterRun.operations].reverse()) {
        try {
          const targetStat = await fsPromises
            .stat(operation.targetPath)
            .catch(() => null);
          if (!targetStat?.isFile()) {
            throw new Error("Sorted file is unavailable");
          }
          const sourceStat = await fsPromises
            .stat(operation.sourcePath)
            .catch(() => null);
          if (sourceStat) {
            throw new Error("Original source path is occupied");
          }
          if (operation.backupPath) {
            const backupStat = await fsPromises
              .stat(operation.backupPath)
              .catch(() => null);
            if (!backupStat?.isFile()) {
              throw new Error("Replacement backup is unavailable");
            }
          }

          await fsPromises.mkdir(path.dirname(operation.sourcePath), {
            recursive: true,
          });
          await moveFileSafe(operation.targetPath, operation.sourcePath);
          if (operation.backupPath) {
            await fsPromises.mkdir(path.dirname(operation.targetPath), {
              recursive: true,
            });
            await moveFileSafe(operation.backupPath, operation.targetPath);
          }
          results.push({ ...operation, status: "undone" });
        } catch (error) {
          remainingOperations.push(operation);
          results.push({
            ...operation,
            status: "error",
            ...getSorterErrorReason(error),
          });
        }
      }

      const runId = latestSorterRun.runId;
      if (remainingOperations.length) {
        latestSorterRun.operations = remainingOperations.reverse();
      } else {
        await clearSorterUndo();
      }
      const success = remainingOperations.length === 0;
      return {
        success,
        error: success ? "" : "Some files could not be restored",
        runId,
        undone: results.filter((item) => item.status === "undone").length,
        errors: results
          .filter((item) => item.status === "error")
          .map((item) => ({ id: item.id, message: item.message })),
        operations: results,
        canUndo: !success,
      };
    } catch (error) {
      log.error("tools:undoSorterRun error:", error);
      return { success: false, error: error.message || String(error) };
    }
  });

  ipcMain.handle(CHANNELS.TOOLS_SORTER_EXPORT, async (_evt, payload = {}) => {
    try {
      const content = String(payload?.content || "");
      if (!content.trim()) {
        return { success: false, error: "Export content is empty" };
      }
      const format = String(payload?.format || "txt")
        .trim()
        .toLowerCase();
      const normalizedFormat =
        format === "csv" || format === "json" ? format : "txt";
      const suggestedName =
        String(payload?.suggestedName || "").trim() ||
        `file-sorter-${new Date().toISOString().slice(0, 10)}.${normalizedFormat}`;
      const { canceled, filePath } = await dialog.showSaveDialog(mainWindow, {
        title: "Export File Sorter result",
        defaultPath: suggestedName,
        filters: [
          normalizedFormat === "csv"
            ? { name: "CSV Files", extensions: ["csv"] }
            : normalizedFormat === "json"
              ? { name: "JSON Files", extensions: ["json"] }
              : { name: "Text Files", extensions: ["txt"] },
          { name: "All Files", extensions: ["*"] },
        ],
      });

      if (canceled || !filePath) {
        return { success: false, canceled: true };
      }

      await fsPromises.writeFile(filePath, content, "utf8");
      return { success: true, filePath };
    } catch (error) {
      log.error("tools:sorterExport error:", error);
      return { success: false, error: error.message || String(error) };
    }
  });

  ipcMain.handle(CHANNELS.TOOLS_CREATE_WINDOWS_RESTART_SHORTCUT, async () => {
    try {
      return createWindowsDesktopShortcut({
        fileName: "Restart Windows.lnk",
        target: "C:\\Windows\\System32\\shutdown.exe",
        args: "/r /t 0",
        description: "Restart Windows",
        iconPath: "C:\\Windows\\System32\\shell32.dll",
        iconIndex: 238,
      });
    } catch (error) {
      log.error("tools:createWindowsRestartShortcut error:", error);
      return { success: false, error: error.message || String(error) };
    }
  });

  ipcMain.handle(CHANNELS.TOOLS_CREATE_WINDOWS_SHUTDOWN_SHORTCUT, async () => {
    try {
      return createWindowsDesktopShortcut({
        fileName: "Shutdown Windows.lnk",
        target: "C:\\Windows\\System32\\shutdown.exe",
        args: "/s /t 0",
        description: "Shutdown Windows",
        iconPath: "C:\\Windows\\System32\\shell32.dll",
        iconIndex: 27,
      });
    } catch (error) {
      log.error("tools:createWindowsShutdownShortcut error:", error);
      return { success: false, error: error.message || String(error) };
    }
  });

  ipcMain.handle(
    CHANNELS.TOOLS_CREATE_WINDOWS_UEFI_REBOOT_SHORTCUT,
    async () => {
      try {
        return createWindowsDesktopShortcut({
          fileName: "Restart to UEFI.lnk",
          target: "C:\\Windows\\System32\\cmd.exe",
          args: '/c "shutdown /r /fw /f /t 0 || shutdown /r /o /f /t 0"',
          description:
            "Restart to UEFI firmware settings (fallback to advanced startup)",
          iconPath: "C:\\Windows\\System32\\imageres.dll",
          iconIndex: 106,
        });
      } catch (error) {
        log.error("tools:createWindowsUefiRebootShortcut error:", error);
        return { success: false, error: error.message || String(error) };
      }
    },
  );

  ipcMain.handle(
    CHANNELS.TOOLS_CREATE_WINDOWS_ADVANCED_BOOT_SHORTCUT,
    async () => {
      try {
        return createWindowsDesktopShortcut({
          fileName: "Advanced Startup.lnk",
          target: "C:\\Windows\\System32\\shutdown.exe",
          args: "/r /o /t 0",
          description: "Restart to advanced startup options",
          iconPath: "C:\\Windows\\System32\\imageres.dll",
          iconIndex: 74,
        });
      } catch (error) {
        log.error("tools:createWindowsAdvancedBootShortcut error:", error);
        return { success: false, error: error.message || String(error) };
      }
    },
  );

  ipcMain.handle(CHANNELS.TOOLS_CREATE_WINDOWS_PROGRAMS_SHORTCUT, async () => {
    try {
      return createWindowsDesktopShortcut({
        fileName: "Programs and Features.lnk",
        target: "C:\\Windows\\System32\\control.exe",
        args: "appwiz.cpl",
        description: "Open Programs and Features",
        iconPath: "C:\\Windows\\System32\\appwiz.cpl",
        iconIndex: 0,
      });
    } catch (error) {
      log.error("tools:createWindowsProgramsShortcut error:", error);
      return { success: false, error: error.message || String(error) };
    }
  });

  ipcMain.handle(
    CHANNELS.TOOLS_CREATE_WINDOWS_DISK_CLEANUP_SHORTCUT,
    async () => {
      try {
        return createWindowsDesktopShortcut({
          fileName: "Disk Cleanup.lnk",
          target: "C:\\Windows\\System32\\cleanmgr.exe",
          args: "",
          description: "Open Disk Cleanup",
          iconPath: "C:\\Windows\\System32\\cleanmgr.exe",
          iconIndex: 0,
        });
      } catch (error) {
        log.error("tools:createWindowsDiskCleanupShortcut error:", error);
        return { success: false, error: error.message || String(error) };
      }
    },
  );

  function createWindowsDesktopShortcut({
    fileName,
    target,
    args = "",
    description = "",
    iconPath = "",
    iconIndex = 0,
  }) {
    if (process.platform !== "win32") {
      return {
        success: false,
        unsupported: true,
        error: "Available only on Windows",
      };
    }

    const desktop = app.getPath("desktop");
    const shortcutPath = path.join(desktop, fileName);
    const iconRef = resolveWindowsIconReference(iconPath, iconIndex);
    const ok = shell.writeShortcutLink(shortcutPath, "create", {
      target,
      args,
      description,
      icon: iconRef.icon,
      iconIndex: iconRef.iconIndex,
    });
    if (!ok) {
      return { success: false, error: "Failed to create shortcut" };
    }
    return { success: true, path: shortcutPath };
  }

  registerToolsLocationIpcHandlers({
    ipcMain,
    dialog,
    shell,
    mainWindow,
    store,
  });

  // --- helpers for update checks ---
  function fetchJson(url) {
    return new Promise((resolve, reject) => {
      const req = https.get(
        url,
        {
          headers: {
            "User-Agent": "Thunder/1.0 (+https://example.local)",
            Accept: "application/vnd.github+json",
          },
        },
        (res) => {
          let data = "";
          res.on("data", (chunk) => (data += chunk));
          res.on("end", () => {
            try {
              resolve(JSON.parse(data));
            } catch (e) {
              reject(e);
            }
          });
        },
      );
      req.on("error", reject);
      req.setTimeout(10000, () => {
        req.destroy(new Error("Request timeout"));
      });
    });
  }
  function fetchText(url) {
    return new Promise((resolve, reject) => {
      const req = https.get(
        url,
        {
          headers: {
            "User-Agent": "Thunder/1.0 (+https://example.local)",
            Accept: "text/plain, text/html,*/*;q=0.8",
          },
        },
        (res) => {
          let data = "";
          res.on("data", (chunk) => (data += chunk));
          res.on("end", () => resolve(data));
        },
      );
      req.on("error", reject);
      req.setTimeout(10000, () => req.destroy(new Error("Request timeout")));
    });
  }

  // ---- Extra helpers for latest resolution & heuristics ----
  async function resolveLatestYtDlpViaPyPI(ts) {
    try {
      const p = await fetchJson(
        `https://pypi.org/pypi/yt-dlp/json${ts ? `?t=${Date.now()}` : ""}`,
      );
      const ver = p?.info?.version ? String(p.info.version).trim() : null; // e.g. "2025.08.11"
      return ver || null;
    } catch (_) {
      return null;
    }
  }

  async function resolveLatestFfmpegViaFfbinaries(ts) {
    try {
      const f = await fetchJson(
        `https://ffbinaries.com/api/v1/version/latest${ts ? `?t=${Date.now()}` : ""}`,
      );
      const ver = f?.version ? String(f.version).trim() : null; // e.g. "7.1"
      return ver || null;
    } catch (_) {
      return null;
    }
  }

  function parseYtDlpDateVersion(ver) {
    // Accepts formats like "2025.08.11" or "2025.8.11" → returns a Date or null
    if (!ver) return null;
    const m = String(ver).match(/^(\d{4})\.(\d{1,2})\.(\d{1,2})$/);
    if (!m) return null;
    const y = Number(m[1]);
    const mo = Number(m[2]) - 1; // 0-based
    const d = Number(m[3]);
    const dt = new Date(Date.UTC(y, mo, d));
    return isNaN(dt.getTime()) ? null : dt;
  }

  async function resolveLatestFfmpegViaGyan(ts) {
    // Try lightweight .ver endpoints first, then fall back to parsing the builds page
    const addTs = (u) =>
      ts ? u + (u.includes("?") ? "&" : "?") + "t=" + Date.now() : u;
    const candidates = [
      "https://www.gyan.dev/ffmpeg/builds/ffmpeg-release-essentials.7z.ver",
      "https://www.gyan.dev/ffmpeg/builds/ffmpeg-release-essentials.zip.ver",
      "https://www.gyan.dev/ffmpeg/builds/ffmpeg-release-full.7z.ver",
      "https://www.gyan.dev/ffmpeg/builds/ffmpeg-release-full-shared.7z.ver",
    ];
    const rx = /(\d+\.\d+(?:\.\d+)?)/; // 7.1 or 7.1.1
    for (const url of candidates) {
      try {
        const txt = await fetchText(addTs(url));
        const m = String(txt || "").match(rx);
        if (m && m[1]) return m[1];
      } catch (_) {}
    }
    try {
      const html = await fetchText(
        addTs("https://www.gyan.dev/ffmpeg/builds/"),
      );
      const m = String(html || "").match(
        /latest\s+release\s+version\s*:\s*([0-9]+\.[0-9]+(?:\.[0-9]+)?)/i,
      );
      if (m && m[1]) return m[1];
    } catch (_) {}
    return null;
  }
  // ---- /helpers ----

  function normalizeYtDlpVersion(v) {
    if (!v) return null;
    return String(v).replace(/^v/i, "").trim();
  }

  function normalizeFfmpegVersion(vstr) {
    if (!vstr) return null;
    // expects: "ffmpeg version 6.1.1 ..."
    const m = String(vstr).match(/ffmpeg\s+version\s+([^\s]+)/i);
    return m ? m[1] : String(vstr).split(/\s+/)[0];
  }

  function parseSemver(v) {
    // принимает "7.1.1", "6.0", "6", "7.1.1-rc1" → [major, minor, patch]
    if (!v) return null;
    const m = String(v).match(/(\d+)(?:\.(\d+))?(?:\.(\d+))?/);
    if (!m) return null;
    return [
      parseInt(m[1], 10),
      m[2] !== undefined ? parseInt(m[2], 10) : 0,
      m[3] !== undefined ? parseInt(m[3], 10) : 0,
    ];
  }

  function compareSemver(a, b) {
    const pa = parseSemver(a);
    const pb = parseSemver(b);
    if (!pa || !pb) return null; // невозможно сравнить семантически
    for (let i = 0; i < 3; i++) {
      if (pa[i] > pb[i]) return 1;
      if (pa[i] < pb[i]) return -1;
    }
    return 0;
  }

  function isReasonableFfVersion(v) {
    const p = parseSemver(v);
    if (!p) return false;
    // FFmpeg 4.x and newer are reasonable for our builds. Reject abnormally small/huge majors.
    const major = p[0];
    return major >= 4 && major < 50;
  }

  function normalizeOfficialFfmpegTag(tag) {
    // Официальные теги FFmpeg вида "n7.1.1" → "7.1.1"
    if (!tag) return null;
    const m = String(tag).match(/n(\d+(?:\.\d+){0,2})/i);
    return m ? m[1] : null;
  }

  function canUpdate(current, latest) {
    if (!current || !latest) return false;
    // Пробуем семантически (для ffmpeg и подобных)
    const cmp = compareSemver(current, latest);
    if (cmp !== null) {
      return cmp < 0; // обновление доступно, если latest > current
    }
    // Фолбэк — нестрогое сравнение строк (подходит для yt-dlp с датами)
    return String(current).trim() !== String(latest).trim();
  }

  // Handler for checking tool updates, reading actual versions from disk and honoring noCache/forceFetch
  ipcMain.handle(CHANNELS.TOOLS_CHECKUPDATES, async (_event, opts = {}) => {
    // Accepts options: { noCache, forceFetch }
    try {
      // Берём текущие версии из выбранной пользователем папки (через electron-store)
      const tools = await getToolsVersions(store);

      // Try to read local versions from disk by executing the binaries (more reliable than cached values)
      let ytCurrent = tools?.ytDlp?.ok
        ? (tools.ytDlp.version || "").split("\n")[0]
        : null;
      try {
        if (tools?.ytDlp?.path && fs.existsSync(tools.ytDlp.path)) {
          const { stdout } = await execFileAsync(
            tools.ytDlp.path,
            ["--version"],
            { timeout: 8000 },
          );
          ytCurrent = String(stdout || "")
            .trim()
            .split("\n")[0];
        }
      } catch (e) {
        log.warn("yt-dlp local exec failed:", e.message || e);
      }
      ytCurrent = normalizeYtDlpVersion(ytCurrent);

      let ffCurrent = tools?.ffmpeg?.ok ? tools.ffmpeg.version || "" : null;
      try {
        if (tools?.ffmpeg?.path && fs.existsSync(tools.ffmpeg.path)) {
          const { stdout } = await execFileAsync(
            tools.ffmpeg.path,
            ["-version"],
            { timeout: 8000 },
          );
          ffCurrent = String(stdout || "").trim();
        }
      } catch (e) {
        log.warn("ffmpeg local exec failed:", e.message || e);
      }
      ffCurrent = normalizeFfmpegVersion(ffCurrent);

      // When fetching latest versions from GitHub, honor opts.noCache/forceFetch by appending a timestamp query to URLs
      const ts =
        opts && (opts.noCache || opts.forceFetch) ? `?t=${Date.now()}` : "";
      // --- yt-dlp latest (with fallbacks) ---
      let ytLatest = null;
      try {
        const ytrel = await fetchJson(
          `https://api.github.com/repos/yt-dlp/yt-dlp/releases/latest${ts}`,
        );
        ytLatest = normalizeYtDlpVersion(ytrel?.tag_name);
        if (!ytLatest) {
          // Fallback #1: latest release from list
          const rels = await fetchJson(
            `https://api.github.com/repos/yt-dlp/yt-dlp/releases?per_page=1${ts ? `&t=${Date.now()}` : ""}`,
          );
          if (Array.isArray(rels) && rels.length) {
            ytLatest = normalizeYtDlpVersion(rels[0]?.tag_name);
          }
        }
        if (!ytLatest) {
          // Fallback #2: latest tag
          const tags = await fetchJson(
            `https://api.github.com/repos/yt-dlp/yt-dlp/tags?per_page=1${ts ? `&t=${Date.now()}` : ""}`,
          );
          if (Array.isArray(tags) && tags.length) {
            ytLatest = normalizeYtDlpVersion(tags[0]?.name);
          }
        }
      } catch (e) {
        log.warn("yt-dlp latest fetch failed:", e.message || e);
      }

      // Extra fallback for yt-dlp: PyPI
      if (!ytLatest) {
        const viaPyPI = await resolveLatestYtDlpViaPyPI(ts);
        if (viaPyPI) ytLatest = normalizeYtDlpVersion(viaPyPI);
      }

      // --- ffmpeg latest (prefer installer source; sanitize) ---
      let ffLatest = null;
      try {
        if (process.platform === "win32") {
          // 1) Prefer gyan.dev (source we actually install from)
          ffLatest = await resolveLatestFfmpegViaGyan(ts);
          // 2) If gyan not reachable, fall back to BtbN tag on GitHub
          if (!ffLatest) {
            const ffrel = await fetchJson(
              `https://api.github.com/repos/BtbN/FFmpeg-Builds/releases/latest${ts}`,
            );
            const tag = ffrel?.tag_name || ""; // e.g., n7.1.1-10-gXXXX
            const m = String(tag).match(/n(\d+\.\d+(?:\.\d+)?)/i);
            ffLatest = m ? m[1] : null;
          }
        } else if (process.platform === "darwin") {
          // macOS: use official FFmpeg repo tags
          const tags = await fetchJson(
            `https://api.github.com/repos/FFmpeg/FFmpeg/tags?per_page=1${ts ? `&t=${Date.now()}` : ""}`,
          );
          const tag = Array.isArray(tags) && tags.length ? tags[0]?.name : null; // e.g., "n7.1.1"
          ffLatest = normalizeOfficialFfmpegTag(tag); // -> "7.1.1"
        } else {
          // Linux: leave unknown (package managers vary); later we may consult ffbinaries
          ffLatest = null;
        }
      } catch (e) {
        log.warn("ffmpeg latest fetch failed:", e.message || e);
      }

      // Optional fallback for non-Windows platforms only
      if (!ffLatest && process.platform !== "win32") {
        const viaFfb = await resolveLatestFfmpegViaFfbinaries(ts);
        if (viaFfb) ffLatest = viaFfb;
      }

      // Sanity check: ignore clearly bogus versions (e.g., 2.0)
      if (ffLatest && !isReasonableFfVersion(ffLatest)) {
        log.warn(
          `[tools:checkUpdates] ffmpeg latest looked unreasonable: ${ffLatest} — ignoring`,
        );
        ffLatest = null;
      }

      // Heuristic: if latest is unknown but local yt-dlp is older than N days, suggest update
      let ytHeuristicCanUpdate = false;
      let ytDaysOld = null;
      if (!ytLatest && ytCurrent) {
        const dt = parseYtDlpDateVersion(ytCurrent);
        if (dt) {
          const ms = Date.now() - dt.getTime();
          ytDaysOld = Math.floor(ms / (1000 * 60 * 60 * 24));
          if (ytDaysOld >= 30) ytHeuristicCanUpdate = true; // threshold 30 days
        }
      }

      const denoCurrent = tools?.deno?.ok
        ? (tools.deno.version || "").split("\n")[0]
        : null;

      const isMac = process.platform === "darwin";
      const result = {
        ytDlp: {
          current: ytCurrent || null,
          latest: ytLatest || null,
          canUpdate: canUpdate(ytCurrent, ytLatest) || ytHeuristicCanUpdate,
          unknownLatest: !ytLatest,
          daysOld: ytDaysOld,
        },
        ffmpeg: {
          current: ffCurrent || null,
          latest: ffLatest || null,
          canUpdate: canUpdate(ffCurrent, ffLatest),
          unknownLatest: !ffLatest,
        },
        deno: {
          current: denoCurrent || null,
          latest: null,
          canUpdate: false,
          unknownLatest: true,
        },
      };

      if (isMac) {
        result.ffmpeg.skipUpdates = true;
        result.ffmpeg.latest = result.ffmpeg.current;
        result.ffmpeg.canUpdate = false;
        result.ffmpeg.unknownLatest = false;
      }

      return result;
    } catch (e) {
      log.error("tools:checkUpdates failed:", e);
      return {
        ytDlp: { current: null, latest: null, canUpdate: false },
        ffmpeg: { current: null, latest: null, canUpdate: false },
        error: e.message || String(e),
      };
    }
  });

  // Ручная установка зависимостей по запросу из UI (чистая переустановка: удаляет старые бинарники)
  ipcMain.handle(CHANNELS.TOOLS_INSTALLALL, async () => {
    try {
      const tools = await getToolsVersions(store);

      // --- deno: remove old runtime to force overwrite ---
      const denoInfo = tools?.deno;
      if (denoInfo?.ok && denoInfo?.path) {
        try {
          log.info(
            `[tools:installAll] Removing existing Deno at ${denoInfo.path}`,
          );
          await fsPromises.unlink(denoInfo.path);
        } catch (e) {
          log.warn(`[tools:installAll] Could not remove Deno: ${e.message}`);
        }
      }
      if (mainWindow && mainWindow.webContents) {
        mainWindow.webContents.send("status-message", "Скачиваю Deno…");
      }
      await installDeno();

      // --- yt-dlp: remove old binary if exists to force overwrite ---
      const ytDlpInfo = tools?.ytDlp;
      if (ytDlpInfo?.ok && ytDlpInfo?.path) {
        try {
          log.info(
            `[tools:installAll] Removing existing yt-dlp at ${ytDlpInfo.path}`,
          );
          await fsPromises.unlink(ytDlpInfo.path);
        } catch (e) {
          log.warn(`[tools:installAll] Could not remove yt-dlp: ${e.message}`);
        }
      }
      if (mainWindow && mainWindow.webContents) {
        mainWindow.webContents.send("status-message", "Скачиваю yt-dlp…");
      }
      await installYtDlp();

      // --- ffmpeg: remove old binary if exists to force overwrite ---
      const ffmpegInfo = tools?.ffmpeg;
      if (ffmpegInfo?.ok && ffmpegInfo?.path) {
        try {
          log.info(
            `[tools:installAll] Removing existing ffmpeg at ${ffmpegInfo.path}`,
          );
          await fsPromises.unlink(ffmpegInfo.path);
        } catch (e) {
          log.warn(`[tools:installAll] Could not remove ffmpeg: ${e.message}`);
        }
      }
      if (mainWindow && mainWindow.webContents) {
        mainWindow.webContents.send("status-message", "Скачиваю ffmpeg…");
      }
      await installFfmpeg();

      if (mainWindow && mainWindow.webContents) {
        mainWindow.webContents.send(
          "status-message",
          "Зависимости установлены.",
        );
        mainWindow.webContents.send(
          "toast",
          "Зависимости (Deno, yt-dlp, ffmpeg) установлены",
          "success",
        );
      }
      return { success: true };
    } catch (e) {
      log.error("tools:installAll error:", e);
      if (mainWindow && mainWindow.webContents) {
        mainWindow.webContents.send(
          "status-message",
          `Ошибка при установке зависимостей: ${e.message}`,
        );
        mainWindow.webContents.send(
          "toast",
          `Не удалось установить зависимости: ${e.message}`,
          "error",
        );
      }
      return { success: false, error: e.message };
    }
  });

  // --- tools:updateYtDlp ---
  ipcMain.handle(CHANNELS.TOOLS_UPDATEYTDLP, async () => {
    try {
      log.info("tools:updateYtDlp: Checking current yt-dlp version...");
      const tools = await getToolsVersions(store);
      const ytDlpInfo = tools?.ytDlp;
      const toolsDir = await ensureToolsDir(getEffectiveToolsDir(store));
      const ytDlpFileName =
        process.platform === "win32" ? "yt-dlp.exe" : "yt-dlp";
      const finalPath = ytDlpInfo?.path || path.join(toolsDir, ytDlpFileName);
      const tempPath = `${finalPath}.tmp-${Date.now()}`;
      const backupPath = `${finalPath}.bak-${Date.now()}`;

      log.info("tools:updateYtDlp: Installing yt-dlp to temporary path...", {
        finalPath,
        tempPath,
      });
      await installYtDlp({ targetPath: tempPath });

      let backupCreated = false;
      try {
        if (fs.existsSync(finalPath)) {
          log.info(
            `tools:updateYtDlp: Moving current yt-dlp to backup ${backupPath}`,
          );
          await fsPromises.rename(finalPath, backupPath);
          backupCreated = true;
        }
        await fsPromises.rename(tempPath, finalPath);
        if (backupCreated) {
          await fsPromises.unlink(backupPath).catch(() => {});
        }
      } catch (swapError) {
        if (fs.existsSync(tempPath)) {
          await fsPromises.unlink(tempPath).catch(() => {});
        }
        if (
          backupCreated &&
          fs.existsSync(backupPath) &&
          !fs.existsSync(finalPath)
        ) {
          await fsPromises.rename(backupPath, finalPath).catch(() => {});
        }
        throw swapError;
      }

      log.info("tools:updateYtDlp: yt-dlp installed successfully.", {
        finalPath,
      });
      return { success: true };
    } catch (error) {
      log.error("tools:updateYtDlp: Error updating yt-dlp:", error);
      return { success: false, error: error.message || String(error) };
    }
  });

  // --- tools:updateFfmpeg ---
  ipcMain.handle(CHANNELS.TOOLS_UPDATEFFMPEG, async () => {
    try {
      log.info("tools:updateFfmpeg: Checking current ffmpeg version...");
      // Учитываем пользовательскую папку инструментов
      const tools = await getToolsVersions(store);
      const ffmpegInfo = tools?.ffmpeg;
      if (ffmpegInfo?.ok && ffmpegInfo?.path) {
        log.info(
          `tools:updateFfmpeg: Removing existing ffmpeg binary at ${ffmpegInfo.path}`,
        );
        try {
          await fsPromises.unlink(ffmpegInfo.path);
          log.info("tools:updateFfmpeg: Existing ffmpeg binary removed.");
        } catch (e) {
          log.error(
            "tools:updateFfmpeg: Failed to remove existing ffmpeg binary:",
            e,
          );
          // Continue anyway
        }
      } else {
        log.info(
          "tools:updateFfmpeg: No existing ffmpeg binary detected, proceeding with install.",
        );
      }
      log.info("tools:updateFfmpeg: Installing ffmpeg...");
      await installFfmpeg();
      log.info("tools:updateFfmpeg: ffmpeg installed successfully.");
      return { success: true };
    } catch (error) {
      log.error("tools:updateFfmpeg: Error updating ffmpeg:", error);
      return { success: false, error: error.message || String(error) };
    }
  });

  registerBackupIpcHandlers({
    ipcMain,
    mainWindow,
    setBackupReloadBlocked,
  });

  // Проверка на отмену загрузки
  function checkIfCancelled(token, step) {
    if (token?.cancelled) {
      log.error(`Download cancelled at step: ${step}`);
      throw new Error(token.cancelReason || "Download cancelled");
    }
  }

  // Функция для начала процесса загрузки
  async function startDownloadProcess(event, url, quality, jobId = null) {
    try {
      const normalizedUrl = normalizeUrl(url);
      if (!isValidUrl(normalizedUrl) || !hasValidHttpHost(normalizedUrl)) {
        throw new Error(
          "Invalid URL: host is incomplete. Example: https://example.com",
        );
      }

      const token = createDownloadToken();
      setActiveDownloadToken(token);
      if (jobId && downloadState.activeDownloads?.has(jobId)) {
        const prev = downloadState.activeDownloads.get(jobId);
        downloadState.activeDownloads.set(jobId, { ...prev, token });
      }

      // Проверяем наличие утилит, не устанавливаем автоматически
      const tools = await getToolsVersions(store);
      const hasYt = tools?.ytDlp?.ok;
      const hasFf = tools?.ffmpeg?.ok;
      if (!hasYt || !hasFf) {
        if (mainWindow && mainWindow.webContents) {
          mainWindow.webContents.send(
            "toast",
            formatMissingDownloadToolsMessage({
              hasYtDlp: hasYt,
              hasFfmpeg: hasFf,
            }),
            "warning",
          );
        }
        throw new Error("Отсутствуют необходимые инструменты (yt-dlp/ffmpeg)");
      }

      const videoInfo = await getVideoInfo(normalizedUrl, token);
      checkIfCancelled(token, "getVideoInfo");

      const formats = videoInfo.formats;
      const title = videoInfo.title.replace(/[\\/:*?"<>|]/g, "");

      // Используем функцию selectFormatsByQuality
      const selectedFormats = selectFormatsByQuality(formats, quality);

      const videoFormat = selectedFormats.videoFormat;
      const audioFormat = selectedFormats.audioFormat;
      const audioExt = selectedFormats.audioExt;
      const videoExt = selectedFormats.videoExt;
      const isSubtitleDownload =
        quality?.type === "subtitle-only" ||
        quality?.downloadKind === "subtitle";

      // Получаем разрешение и fps
      const resolution = selectedFormats.resolution;
      const fps = selectedFormats.fps;
      const actualQuality = isSubtitleDownload
        ? `subtitle: ${quality.subtitleLang || "unknown"}`
        : videoFormat === null
          ? `audio: ${resolution}`
          : resolution !== "unknown"
            ? `${resolution} ${fps ? fps + "fps" : ""}`
            : "unknown";
      const downloadMetadata = {
        thumbnail: videoInfo.thumbnail || "",
        title: videoInfo.title || "",
        duration: Number(videoInfo.duration) || 0,
      };

      checkIfCancelled(token, "before downloadMedia");

      let filePath;
      try {
        filePath = await downloadMedia(
          event,
          downloadState.downloadPath,
          normalizedUrl,
          videoFormat,
          audioFormat,
          title,
          quality,
          resolution,
          fps,
          audioExt,
          videoExt,
          token,
          jobId,
        );
      } catch (error) {
        throw error;
      }

      // Проверка доступности mainWindow и его webContents перед отправкой уведомления
      if (
        !mainWindow ||
        !mainWindow.webContents ||
        mainWindow.webContents.isDestroyed()
      ) {
        log.error(
          `mainWindow.webContents is not available (mainWindow: ${!!mainWindow}, webContents: ${!!mainWindow?.webContents}, destroyed: ${mainWindow?.webContents?.isDestroyed?.()})`,
        );
        // Подробный лог о завершённой загрузке (даже если mainWindow недоступен)
        log.info(`[Download Complete] ${title}`);
        log.info(`Path: ${filePath}`);
        log.info(`Quality: ${quality}`);
        log.info(`Actual: ${actualQuality}`);
        log.info(`Source: ${normalizedUrl}`);
        return {
          fileName: title,
          filePath,
          quality,
          actualQuality,
          resolution,
          fps,
          sourceUrl: normalizedUrl,
          ...downloadMetadata,
        };
      }

      sendDownloadCompletionNotification(title, filePath, store, mainWindow);

      // Подробный лог о завершённой загрузке с деталями
      log.info(`[Download Complete] ${title}`);
      log.info(`Path: ${filePath}`);
      log.info(`Quality: ${quality}`);
      log.info(`Actual: ${actualQuality}`);
      log.info(`Source: ${normalizedUrl}`);

      return {
        fileName: title,
        filePath,
        quality,
        actualQuality,
        resolution,
        fps,
        sourceUrl: normalizedUrl,
        ...downloadMetadata,
      };
    } catch (error) {
      if (error.message === "Download cancelled") {
        log.info("The download was disabled by the user.");
        throw error;
      } else {
        log.error("Ошибка во время загрузки:", error);
        throw error;
      }
    }
  }

  function resolveWindowsShortcutIcon() {
    const exePath = app.getPath("exe");
    const appPath = app.getAppPath();
    const iconCandidates = [];

    if (typeof process.resourcesPath === "string" && process.resourcesPath) {
      iconCandidates.push(
        resolveIconPathFrom(process.resourcesPath, "APP_ICON_ICO"),
      );
    }

    if (typeof appPath === "string" && appPath) {
      iconCandidates.push(resolveIconPathFrom(appPath, "APP_ICON_ICO"));
    }

    iconCandidates.push(resolveIconPathFromAppDir("APP_ICON_ICO"));

    const iconPath = iconCandidates.find((candidate) =>
      fs.existsSync(candidate),
    );
    return iconPath || exePath;
  }

  function resolveWindowsIconReference(
    preferredIconPath,
    preferredIconIndex = 0,
  ) {
    if (
      typeof preferredIconPath === "string" &&
      preferredIconPath &&
      fs.existsSync(preferredIconPath)
    ) {
      return {
        icon: preferredIconPath,
        iconIndex: Number.isInteger(preferredIconIndex)
          ? preferredIconIndex
          : 0,
      };
    }
    return {
      icon: resolveWindowsShortcutIcon(),
      iconIndex: 0,
    };
  }

  // Функция для получения имени иконки из URL
  function getIconNameFromUrl(url) {
    if (url.includes("youtube.com")) return "youtube";
    if (url.includes("twitch.tv")) return "twitch";
    // Simple Icons has no official Coub glyph in our bundle, use Tabler fallback.
    if (url.includes("coub.com")) return "video";
    if (url.includes("vkvideo.ru")) return "vk";
    if (url.includes("youtu.be")) return "youtube";
    if (url.includes("dzen.ru")) return "video";
    return "video";
  }

  // Функция для получения пути к иконке приложения
  async function getAppIconPath(iconName) {
    const cached = iconCache.get(iconName);
    if (cached) {
      try {
        await fs.promises.access(cached);
        return cached;
      } catch {
        iconCache.delete(iconName);
      }
    }

    const candidateNames = [iconName, "video"];
    for (const name of candidateNames) {
      const svgPath = path.join(
        app.getAppPath(),
        "assets",
        "icons",
        `${name}.svg`,
      );
      const pngPath = path.join(
        app.getAppPath(),
        "assets",
        "icons",
        `${name}.png`,
      );

      try {
        await fs.promises.access(svgPath);
        iconCache.set(iconName, svgPath);
        return svgPath;
      } catch {}

      try {
        await fs.promises.access(pngPath);
        iconCache.set(iconName, pngPath);
        return pngPath;
      } catch {}
    }
    return null;
  }

  // Обработчики IPC:

  // Добавляем обработчик для открытия терминала на macOS
  ipcMain.handle(CHANNELS.OPEN_TERMINAL, async () => {
    const { exec } = require("child_process");
    exec("open -a Terminal");
  });

  registerWgUnlockIpcHandlers({ ipcMain, app, dialog, shell });

  registerAppUpdateIpcHandlers({ ipcMain, autoUpdater });
  const shortcutService = configureShortcutService({ store, mainWindow });
  registerShortcutIpcHandlers({ ipcMain, mainWindow, shortcutService });
  registerAppPreferencesIpcHandlers({
    ipcMain,
    app,
    clipboardMonitor,
    mainWindow,
    Notification,
    setupGlobalShortcuts,
    setGlobalShortcutsDisabled,
    shell,
    showTrayNotification,
    store,
  });

  ipcMain.handle(CHANNELS.SELECT_DOWNLOAD_FOLDER, async () => {
    const result = await dialog.showOpenDialog(mainWindow, {
      properties: ["openDirectory"],
    });
    if (!result.canceled && result.filePaths.length > 0) {
      const selectedPath = result.filePaths[0];
      try {
        const stats = await fs.promises.stat(selectedPath);
        if (stats.isDirectory()) {
          const previousDownloadPath = downloadState.downloadPath;
          setDownloadPath(selectedPath);
          await cleanupResumeStateDirAfterDownloadPathChange({
            oldPath: previousDownloadPath,
            newPath: selectedPath,
            downloadState,
          });
          return { success: true, path: selectedPath };
        } else {
          throw new Error("The selected path is not a directory.");
        }
      } catch (error) {
        log.error("Ошибка при выборе папки для загрузок:", error);
        return { success: false, error: error.message };
      }
    } else {
      return { success: false };
    }
  });

  ipcMain.handle(
    CHANNELS.DOWNLOAD_VIDEO,
    async (event, url, quality, requestedJobId = null) => {
      const jobId =
        requestedJobId ||
        `job-${Date.now()}-${Math.random().toString(16).slice(2, 8)}`;
      if (!downloadState.activeDownloads) {
        downloadState.activeDownloads = new Map();
      }
      const parallelLimit = getParallelDownloadLimit();
      log.info("[queue] download-video invoked", { url, quality, jobId });
      if (downloadState.activeDownloads.size >= parallelLimit) {
        throw new Error("Parallel download limit reached");
      }

      const normalizedUrl = normalizeUrl(url);
      if (!normalizedUrl) {
        throw new Error("Недопустимый URL");
      }

      downloadState.activeDownloads.set(jobId, {
        token: null,
        url: normalizedUrl,
        quality,
        startedAt: Date.now(),
      });
      downloadState.downloadInProgress = downloadState.activeDownloads.size > 0;
      setDownloadReloadBlocked(downloadState.downloadInProgress);
      try {
        const result = await startDownloadProcess(
          event,
          normalizedUrl,
          quality,
          jobId,
        );
        return { success: true, ...result, sourceUrl: normalizedUrl, jobId };
      } catch (error) {
        if (error.message === "Download cancelled") {
          return { cancelled: true, jobId };
        }
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
        downloadState.activeDownloads.delete(jobId);
        downloadState.downloadInProgress =
          downloadState.activeDownloads.size > 0;
        setDownloadReloadBlocked(downloadState.downloadInProgress);
        setActiveDownloadToken(null);
      }
    },
  );

  ipcMain.handle(CHANNELS.CANCEL_DOWNLOAD_JOB, async (_event, payload) => {
    const payloadPrototype =
      payload !== null && typeof payload === "object"
        ? Object.getPrototypeOf(payload)
        : null;
    const isPlainObject =
      payload !== null &&
      (payloadPrototype === Object.prototype || payloadPrototype === null);
    const jobId = isPlainObject ? payload.jobId : null;

    if (typeof jobId !== "string" || jobId.trim().length === 0) {
      return {
        success: false,
        errorCode: "INVALID_JOB_ID",
        error: "jobId must be a non-empty string",
      };
    }

    const entry = downloadState.activeDownloads?.get(jobId);
    if (!entry?.token) {
      return {
        success: true,
        jobId,
        cancelled: false,
        reason: "not-active",
      };
    }

    try {
      const cancelled = await stopDownload(entry.token);
      return { success: true, jobId, cancelled: Number(cancelled) > 0 };
    } catch (error) {
      return {
        success: false,
        jobId,
        errorCode: "CANCEL_FAILED",
        error: error.message,
      };
    }
  });

  ipcMain.handle(CHANNELS.STOP_DOWNLOAD, async () => {
    console.log("A request to stop download was received.");
    try {
      const tokens = Array.from(
        (downloadState.activeDownloads || new Map()).values(),
      )
        .map((entry) => entry?.token)
        .filter(Boolean);
      const cancelled = await stopDownload(tokens);
      console.log("The stopDownload() function was called successfully.");
      return { success: true, cancelled };
    } catch (error) {
      console.error("Error stopping download:", error);
      return { success: false, error: error.message };
    }
  });

  ipcMain.handle(CHANNELS.SET_DOWNLOAD_PATH, async (event, path) => {
    if (typeof path !== "string") {
      throw new Error("Invalid path");
    }
    try {
      const stats = await fs.promises.stat(path);
      if (!stats.isDirectory()) {
        throw new Error("Path is not a directory");
      }
      const previousDownloadPath = downloadState.downloadPath;
      setDownloadPath(path);
      await cleanupResumeStateDirAfterDownloadPathChange({
        oldPath: previousDownloadPath,
        newPath: path,
        downloadState,
      });
      log.info(`Download path set to: ${path}`);
      return { success: true };
    } catch (error) {
      log.error("Invalid download path:", error);
      return { success: false, error: error.message };
    }
  });

  ipcMain.handle(
    CHANNELS.SET_DOWNLOAD_PARALLEL_LIMIT,
    async (_event, value) => {
      const limit = normalizeParallelDownloadLimit(value);
      store.set("downloadParallelLimit", limit);
      return { success: true, limit };
    },
  );

  ipcMain.handle(CHANNELS.GET_DOWNLOAD_PARALLEL_LIMIT, async () => {
    return getParallelDownloadLimit();
  });

  ipcMain.handle(CHANNELS.GET_YTDLP_COOKIES_SETTINGS, async () => {
    return getYtDlpCookiesSettings();
  });

  ipcMain.handle(CHANNELS.SET_YTDLP_COOKIES_SETTINGS, async (_event, value) => {
    const settings = normalizeYtDlpCookiesSettings(value);
    if (
      settings.mode === "file" &&
      settings.filePath &&
      !isValidCookiesFilePath(settings.filePath)
    ) {
      return {
        success: false,
        error: "Invalid cookies file path",
        settings: getYtDlpCookiesSettings(),
      };
    }
    store.set("ytDlp.cookies", settings);
    return { success: true, settings };
  });

  ipcMain.handle(CHANNELS.SELECT_YTDLP_COOKIES_FILE, async () => {
    try {
      const result = await dialog.showOpenDialog(mainWindow, {
        properties: ["openFile"],
        filters: [
          { name: "Cookies", extensions: ["txt"] },
          { name: "All Files", extensions: ["*"] },
        ],
      });
      if (result.canceled || !result.filePaths?.length) {
        return { success: false, canceled: true };
      }
      const filePath = result.filePaths[0];
      if (!isValidCookiesFilePath(filePath)) {
        return { success: false, error: "Invalid cookies file path" };
      }
      return { success: true, filePath };
    } catch (error) {
      log.error("select-ytdlp-cookies-file error:", error);
      return { success: false, error: error.message || String(error) };
    }
  });

  ipcMain.handle(CHANNELS.GET_DOWNLOAD_PATH, async () => {
    try {
      return downloadState.downloadPath;
    } catch (e) {
      log.error("get-download-path error:", e);
      return null;
    }
  });

  historyPreviewCache.registerHistoryPreviewIpcHandlers({ ipcMain });

  registerHistoryIpcHandlers({
    ipcMain,
    ensurePreviewCacheDir,
    historyFilePath,
    mainWindow,
    previewDirPath,
  });

  ipcMain.handle(CHANNELS.GET_VERSION, async () => {
    try {
      return await getAppVersion();
    } catch (error) {
      log.error("Error getting app version:", error);
      return "unknown";
    }
  });

  ipcMain.handle(CHANNELS.GET_ICON_PATH, async (event, url) => {
    const iconName = getIconNameFromUrl(url);
    return await getAppIconPath(iconName);
  });
}

module.exports = {
  setupIpcHandlers,
  selectYouTubeBackgroundPreview,
  _normalizeSubtitleTracks: normalizeSubtitleTracks,
};
