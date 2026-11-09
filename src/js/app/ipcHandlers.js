// src/js/app/ipcHandlers.js

const {
  ipcMain: electronIpcMain,
  dialog,
  Notification,
  shell,
  app,
} = require("electron");
const { autoUpdater } = require("electron-updater");
const { CHANNELS } = require("../ipc/channels");

const { getToolsVersions } = require("./toolsVersions");
const fs = require("fs");
const fsPromises = fs.promises;
const path = require("path");
const log = require("electron-log");
const https = require("https");
const crypto = require("crypto");
const {
  registerAppPreferencesIpcHandlers,
} = require("./appPreferencesIpcHandlers");
const { registerAppUpdateIpcHandlers } = require("./appUpdateIpcHandlers");
const { registerBackupIpcHandlers } = require("./backupIpcHandlers");
const { registerFileShellIpcHandlers } = require("./fileShellIpcHandlers");
const { registerFullscreenIpcHandlers } = require("./fullscreenIpcHandlers");
const { registerHistoryIpcHandlers } = require("./historyIpcHandlers");
const { registerShortcutIpcHandlers } = require("./shortcutIpcHandlers");
const { createHistoryPreviewCache } = require("./historyPreviewIpcHandlers");
const { TRAY_STATES, trayIconController } = require("./trayIconController");
const {
  registerToolsLocationIpcHandlers,
} = require("./toolsLocationIpcHandlers");
const { registerToolsHashIpcHandlers } = require("./toolsHashIpcHandlers");
const {
  registerToolsVersionsIpcHandlers,
} = require("./toolsVersionsIpcHandlers");
const { createDependencyActions } = require("./dependencyActions");
const { registerDiagnosticsIpcHandlers } = require("./diagnosticsIpcHandlers");
const { createTrackedIpcMain } = require("./ipcRuntime");
const {
  registerDownloadIpcHandlers,
  registerDownloadPreferencesIpcHandlers,
} = require("./download/ipcHandlers");
const { processSupervisor } = require("./processSupervisor");
const execFileAsync = (command, args = [], options = {}) =>
  processSupervisor.execFile(command, args, options, {
    owner: "Tools",
    tool: String(command || "").toLowerCase().includes("yt-dlp")
      ? "yt-dlp"
      : String(command || "").toLowerCase().includes("ff")
        ? "FFmpeg"
        : "process",
  });
const spawn = (command, args, options) =>
  processSupervisor.spawn(command, args, options, {
    owner: "Tools",
    tool: String(command || "").toLowerCase().includes("ffmpeg")
      ? "FFmpeg"
      : "process",
  });
const { registerUiSettingsIpcHandlers } = require("./uiSettingsIpcHandlers");
const { registerUpdateDevIpcHandlers } = require("./updateDevIpcHandlers");
const { registerWhatsNewIpcHandlers } = require("./whatsNewIpcHandlers");
const { registerWgUnlockIpcHandlers } = require("./wgUnlockIpcHandlers");
const { registerWireGuardConfigIpcHandlers } = require("./wgunlock");
const {
  registerWindowsTrayMenuIpcHandlers,
} = require("./windowsTrayMenuIpcHandlers");
const { windowsTrayMenuController } = require("./windowsTrayMenu");
const {
  configureShortcutService,
  setGlobalShortcutsDisabled,
} = require("./shortcuts.js");
const { isValidUrl, normalizeUrl } = require("./utils.js");
const {
  getRuntimeFfmpegPath,
  getRuntimeFfprobePath,
  prepareBinaryForExecution,
} = require("./runtimeTools");
const { selectYouTubeBackgroundPreview } = require("./downloaderBackgroundPreview");
let ipcMain = electronIpcMain;
let activeIpcRuntime = null;

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

async function resolveMediaInspectorProbePath(store, installFfmpeg) {
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
  const {
    mainWindow,
    store,
    downloadPreferences,
    downloadRuntime,
    getAppVersion,
    historyFilePath,
    previewCacheDir,
    clipboardMonitor,
    setupGlobalShortcuts,
    showTrayNotification,
    webControlServer,
    dispatchPendingWhatsNew,
    clearPendingWhatsNewVersion,
    diagnosticsLogger,
    openFormatWindow,
  } = dependencies;
  if (activeIpcRuntime) void activeIpcRuntime.dispose();
  const ipcRuntime = createTrackedIpcMain(electronIpcMain, {
    logger: diagnosticsLogger?.createScope?.("IPC"),
  });
  activeIpcRuntime = ipcRuntime;
  ipcMain = ipcRuntime.api;
  if (diagnosticsLogger) {
    registerDiagnosticsIpcHandlers({
      app,
      dialog,
      ipcMain,
      logger: diagnosticsLogger,
      mainWindow,
    });
  }
  ipcMain.on(CHANNELS.TRAY_STATE_UPDATE, (_event, state) => {
    if (!TRAY_STATES.includes(state)) {
      log.warn(`Rejected invalid tray state: ${String(state)}`);
      return;
    }
    trayIconController.updateTrayIcon(state);
  });
  const activeConverterRuns = new Map();
  const downloadEngine = downloadRuntime.engine;
  const dependencyActions = createDependencyActions({
    store,
    installYtDlp: downloadEngine.installYtDlp,
    installFfmpeg: downloadEngine.installFfmpeg,
    installDeno: downloadEngine.installDeno,
    getToolsVersions,
    log,
  });
  try {
    store.delete("autoShutdownEnabled");
    store.delete("autoShutdownSeconds");
  } catch (e) {
    log.warn("Unable to remove legacy auto-shutdown settings:", e);
  }

  const previewDirPath =
    (typeof previewCacheDir === "string" && previewCacheDir) ||
    path.join(app.getPath("userData"), "thunderload-previews");
  const historyPreviewCache = createHistoryPreviewCache({
    previewDirPath,
    isPathInsideBaseDir,
  });
  const { ensurePreviewCacheDir } = historyPreviewCache;

  registerUiSettingsIpcHandlers({ ipcMain, mainWindow, store });

  registerWindowsTrayMenuIpcHandlers({
    ipcMain,
    controller: windowsTrayMenuController,
  });

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
    getDownloadPath: () => downloadPreferences.getPath(),
    isPathInsideBaseDir,
    isValidFilePath,
    isValidUrl,
    normalizeUrl,
  });

  registerToolsVersionsIpcHandlers({ ipcMain, store });

  registerFullscreenIpcHandlers({ ipcMain, mainWindow });

  registerDownloadIpcHandlers({ ipcMain, runtime: downloadRuntime });
  registerDownloadPreferencesIpcHandlers({
    dialog,
    ipcMain,
    isValidFilePath,
    mainWindow,
    preferences: downloadPreferences,
    runtime: downloadRuntime,
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

        ffprobePath = await resolveMediaInspectorProbePath(
          store,
          downloadEngine.installFfmpeg,
        );
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
            await downloadEngine.installFfmpeg();
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

  function normalizeDenoVersion(vstr) {
    if (!vstr) return null;
    return String(vstr).replace(/^deno\s+/i, "").replace(/^v/i, "").trim();
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
    const rawOptions =
      opts && typeof opts === "object" && !Array.isArray(opts) ? opts : {};
    const requestedToolId =
      rawOptions.toolId === undefined ? null : String(rawOptions.toolId);
    if (
      requestedToolId !== null &&
      !["ytDlp", "ffmpeg", "deno"].includes(requestedToolId)
    ) {
      return {
        ytDlp: { current: null, latest: null, canUpdate: false },
        ffmpeg: { current: null, latest: null, canUpdate: false },
        deno: { current: null, latest: null, canUpdate: false },
        error: "Invalid toolId",
      };
    }
    const safeOptions = {
      noCache: rawOptions.noCache === true,
      forceFetch: rawOptions.forceFetch === true,
      toolId: requestedToolId,
    };
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
        safeOptions.noCache || safeOptions.forceFetch
          ? `?t=${Date.now()}`
          : "";
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
        ? normalizeDenoVersion((tools.deno.version || "").split("\n")[0])
        : null;
      let denoLatest = null;
      try {
        const denoRelease = await fetchJson(
          `https://api.github.com/repos/denoland/deno/releases/latest${ts}`,
        );
        denoLatest = normalizeDenoVersion(denoRelease?.tag_name);
      } catch (e) {
        log.warn("Deno latest fetch failed:", e.message || e);
      }

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
          latest: denoLatest || null,
          canUpdate: canUpdate(denoCurrent, denoLatest),
          unknownLatest: !denoLatest,
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
        deno: { current: null, latest: null, canUpdate: false },
        error: e.message || String(e),
      };
    }
  });

  ipcMain.handle(CHANNELS.TOOLS_RUN_DEPENDENCY_ACTION, async (_event, payload) =>
    dependencyActions.run(payload),
  );

  // Ручная установка зависимостей по запросу из UI.
  ipcMain.handle(CHANNELS.TOOLS_INSTALLALL, async () => {
    try {
      if (mainWindow && mainWindow.webContents) {
        mainWindow.webContents.send("status-message", "Скачиваю Deno…");
      }
      const denoResult = await dependencyActions.run({
        id: "deno",
        action: "reinstall",
      });
      if (!denoResult.success) throw new Error(denoResult.error);

      if (mainWindow && mainWindow.webContents) {
        mainWindow.webContents.send("status-message", "Скачиваю yt-dlp…");
      }
      const ytDlpResult = await dependencyActions.run({
        id: "ytDlp",
        action: "reinstall",
      });
      if (!ytDlpResult.success) throw new Error(ytDlpResult.error);

      if (mainWindow && mainWindow.webContents) {
        mainWindow.webContents.send("status-message", "Скачиваю ffmpeg…");
      }
      const ffmpegResult = await dependencyActions.run({
        id: "ffmpeg",
        action: "reinstall",
      });
      if (!ffmpegResult.success) throw new Error(ffmpegResult.error);

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

  ipcMain.handle(CHANNELS.TOOLS_UPDATEYTDLP, async () => {
    return dependencyActions.run({ id: "ytDlp", action: "update" });
  });

  ipcMain.handle(CHANNELS.TOOLS_UPDATEFFMPEG, async () => {
    return dependencyActions.run({ id: "ffmpeg", action: "update" });
  });

  registerBackupIpcHandlers({
    ipcMain,
    mainWindow,
  });

  // Обработчики IPC:

  // Добавляем обработчик для открытия терминала на macOS
  ipcMain.handle(CHANNELS.OPEN_TERMINAL, async () => {
    const { exec } = require("child_process");
    exec("open -a Terminal");
  });

  registerWgUnlockIpcHandlers({ ipcMain, app, dialog, shell });
  registerWireGuardConfigIpcHandlers(ipcMain);

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

  ipcMain.handle(CHANNELS.OPEN_FORMAT_WINDOW, async () => {
    try {
      if (typeof openFormatWindow !== "function") {
        throw new Error("Format window is unavailable");
      }
      openFormatWindow();
      return { success: true };
    } catch (error) {
      log.error("Failed to open Format window:", error);
      return {
        success: false,
        error: error?.message || "Failed to open Format window",
      };
    }
  });

  return {
    async dispose() {
      if (activeIpcRuntime === ipcRuntime) activeIpcRuntime = null;
      await downloadRuntime.dispose();
      activeConverterRuns.forEach((entry) => {
        entry.cancelled = true;
        entry.proc?.kill?.("SIGTERM");
      });
      activeConverterRuns.clear();
      await ipcRuntime.dispose();
    },
  };
}

module.exports = {
  setupIpcHandlers,
  selectYouTubeBackgroundPreview,
};
