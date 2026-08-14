const fs = require("fs");
const path = require("path");
const log = require("electron-log");

const RESUME_STATE_DIR_NAME = ".thunderload-resume";
const COOKIES_KEY = "ytDlp.cookies";
const DEFAULT_COOKIES = Object.freeze({
  mode: "off",
  browser: "chrome",
  filePath: "",
});
const COOKIE_MODES = new Set(["off", "browser", "file"]);
const COOKIE_BROWSERS = new Set([
  "chrome",
  "firefox",
  "safari",
  "edge",
  "brave",
  "chromium",
  "vivaldi",
  "opera",
]);

function normalizeCookies(value) {
  const raw = value && typeof value === "object" ? value : {};
  const mode = COOKIE_MODES.has(raw.mode) ? raw.mode : DEFAULT_COOKIES.mode;
  const browser = COOKIE_BROWSERS.has(raw.browser)
    ? raw.browser
    : DEFAULT_COOKIES.browser;
  const filePath =
    typeof raw.filePath === "string" && !raw.filePath.includes("\0")
      ? raw.filePath.trim()
      : "";
  return Object.freeze({ mode, browser, filePath });
}

function createDownloadPreferences(options = {}) {
  const {
    store,
    initialPath,
    isBusy = () => false,
    onPathChanged = () => {},
  } = options;
  let downloadPath = initialPath;

  async function cleanupResumeState(oldPath, newPath) {
    if (!oldPath || path.resolve(oldPath) === path.resolve(newPath)) return;
    if (isBusy()) {
      log.info("Skipping resume state cleanup while downloads are active:", oldPath);
      return;
    }
    const resumeDir = path.join(path.resolve(oldPath), RESUME_STATE_DIR_NAME);
    if (path.basename(resumeDir) !== RESUME_STATE_DIR_NAME) return;
    try {
      await fs.promises.rm(resumeDir, { recursive: true, force: true });
    } catch (error) {
      log.warn("Failed to remove resume state directory:", error?.message || error);
    }
  }

  async function setPath(nextPath, { validate = true } = {}) {
    if (typeof nextPath !== "string" || !nextPath.trim()) {
      return { success: false, error: "Invalid path" };
    }
    try {
      if (validate) {
        const stats = await fs.promises.stat(nextPath);
        if (!stats.isDirectory()) throw new Error("Path is not a directory");
      }
      const previousPath = downloadPath;
      downloadPath = nextPath;
      store.set("downloadPath", nextPath);
      await cleanupResumeState(previousPath, nextPath);
      onPathChanged(nextPath);
      return { success: true, path: nextPath };
    } catch (error) {
      return { success: false, error: error.message };
    }
  }

  function restorePath() {
    const saved = store.get("downloadPath", "");
    if (typeof saved === "string" && saved.trim()) downloadPath = saved;
    return downloadPath;
  }

  function getCookies() {
    return normalizeCookies(store.get(COOKIES_KEY, DEFAULT_COOKIES));
  }

  function setCookies(value) {
    const settings = normalizeCookies(value);
    store.set(COOKIES_KEY, settings);
    return settings;
  }

  return Object.freeze({
    getCookies,
    getPath: () => downloadPath,
    restorePath,
    setCookies,
    setPath,
  });
}

module.exports = {
  createDownloadPreferences,
  normalizeCookies,
};
