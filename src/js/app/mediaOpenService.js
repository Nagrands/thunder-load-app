// @ts-check

const path = require("path");

const MEDIA_OPEN_CHANNEL = "now-playing:open-files";
const SUPPORTED_EXTENSIONS = new Set([
  ".aac",
  ".avi",
  ".flac",
  ".m3u",
  ".m3u8",
  ".m4a",
  ".mkv",
  ".mov",
  ".mp3",
  ".mp4",
  ".mpeg",
  ".mpg",
  ".ogg",
  ".opus",
  ".wav",
  ".webm",
]);

function normalizeCandidate(
  value,
  workingDirectory = process.cwd(),
  platform = process.platform,
) {
  if (typeof value !== "string" || !value || value.includes("\u0000")) {
    return "";
  }
  if (value.startsWith("--")) return "";
  const pathApi = platform === "win32" ? path.win32 : path;
  const candidate = pathApi.isAbsolute(value)
    ? pathApi.normalize(value)
    : pathApi.resolve(workingDirectory, value);
  return SUPPORTED_EXTENSIONS.has(pathApi.extname(candidate).toLowerCase())
    ? candidate
    : "";
}

/**
 * @param {{app: import("electron").App, fs: typeof import("fs"), platform?: NodeJS.Platform}} options
 */
function createMediaOpenService({ app, fs, platform = process.platform }) {
  if (!app || !fs) {
    throw new TypeError("Media open service requires app and fs");
  }
  const pending = [];
  const pendingKeys = new Set();
  let mainWindow = null;
  let rendererReady = false;

  const getKey = (filePath) =>
    platform === "win32" ? filePath.toLowerCase() : filePath;

  function enqueue(paths, workingDirectory = process.cwd()) {
    for (const value of Array.isArray(paths) ? paths : [paths]) {
      const candidate = normalizeCandidate(value, workingDirectory, platform);
      if (!candidate || !fs.existsSync(candidate)) continue;
      const key = getKey(candidate);
      if (pendingKeys.has(key)) continue;
      pendingKeys.add(key);
      pending.push(candidate);
    }
    flush();
    return [...pending];
  }

  function enqueueArgv(argv, workingDirectory = process.cwd()) {
    return enqueue(Array.isArray(argv) ? argv.slice(1) : [], workingDirectory);
  }

  function flush() {
    if (
      !rendererReady ||
      !pending.length ||
      !mainWindow ||
      mainWindow.isDestroyed?.()
    ) {
      return false;
    }
    const files = pending.splice(0);
    pendingKeys.clear();
    mainWindow.webContents.send(MEDIA_OPEN_CHANNEL, { files, autoplay: true });
    if (mainWindow.isMinimized?.()) mainWindow.restore?.();
    mainWindow.show?.();
    mainWindow.focus?.();
    return true;
  }

  function onOpenFile(event, filePath) {
    event?.preventDefault?.();
    enqueue(filePath);
  }

  if (platform === "darwin") app.on("open-file", onOpenFile);

  return {
    enqueue,
    enqueueArgv,
    flush,
    setMainWindow(window) {
      mainWindow = window || null;
      rendererReady = false;
    },
    markRendererReady() {
      rendererReady = true;
      return flush();
    },
    dispose() {
      if (platform === "darwin") app.removeListener("open-file", onOpenFile);
      pending.length = 0;
      pendingKeys.clear();
      mainWindow = null;
      rendererReady = false;
    },
  };
}

module.exports = {
  MEDIA_OPEN_CHANNEL,
  SUPPORTED_EXTENSIONS,
  createMediaOpenService,
  normalizeCandidate,
};
