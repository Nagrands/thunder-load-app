// src/js/app/ipcHandlers.js

const {
  ipcMain,
  dialog,
  Notification,
  shell,
  globalShortcut,
  app,
} = require("electron");
const { autoUpdater } = require("electron-updater");
const { CHANNELS } = require("../ipc/channels");

const { getToolsVersions } = require("./toolsVersions");
const fs = require("fs");
const ElectronStore = require("electron-store").default;
const store = new ElectronStore();
const fsPromises = fs.promises;
const path = require("path");
const log = require("electron-log");
const https = require("https");
const http = require("http");
const { execFile } = require("child_process");
const { promisify } = require("util");
const { pipeline } = require("stream");
const execFileAsync = promisify(execFile);
const streamPipeline = promisify(pipeline);
const backup = require("./backupManager");
const { setReloadShortcutSuppressed } = require("./shortcuts.js");
const {
  installYtDlp,
  installFfmpeg,
  installDeno,
  getVideoInfo,
  downloadMedia,
  stopDownload,
  resetDownloadCancelledFlag,
  selectFormatsByQuality,
  isDownloadCancelled,
} = require("../scripts/download.js");
const { isValidUrl, normalizeUrl } = require("./utils.js");
const {
  getDefaultToolsDir,
  getEffectiveToolsDir,
  ensureToolsDir,
  detectLegacyLocations,
  migrateLegacy,
} = require("./toolsPaths");
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
  const resolvedPath = path.resolve(filePath);
  const isValid = path.isAbsolute(resolvedPath) && !resolvedPath.includes("..");
  log.info(`Validating file path "${resolvedPath}": ${isValid}`);
  return isValid;
}

/**
 * Создаёт резервную копию файла перед удалением
 * @param {string} filePath - Путь к файлу
 * @param {string} baseDir - Базовая директория для хранения резервных копий
 * @returns {Promise<void>}
 */
async function backupFile(filePath, baseDir) {
  const backupDir = path.join(baseDir, "backup");
  await fsPromises.mkdir(backupDir, { recursive: true });
  const fileName = path.basename(filePath);
  const timestamp = new Date().toISOString().replace(/[:.]/g, "-");
  const backupPath = path.join(backupDir, `${timestamp}-${fileName}`);
  await fsPromises.copyFile(filePath, backupPath);
  log.info(`Резервная копия создана: ${backupPath}`);
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
    fsCache,
    iconCache,
    clipboardMonitor,
    setupGlobalShortcuts,
    notifyDownloadError,
    sendDownloadCompletionNotification,
    showTrayNotification,
    setReloadMenuEnabled,
    dispatchPendingWhatsNew,
    clearPendingWhatsNewVersion,
  } = dependencies;

  let autoShutdownTimeout = null; // таймер авто‑закрытия WG Unlock
  let autoShutdownDeadlineMs = null; // абсолютный дедлайн (ms) для синхронизации обратного отсчёта
  let isReloadShortcutBlocked = false;
  const previewDirPath =
    (typeof previewCacheDir === "string" && previewCacheDir) ||
    path.join(app.getPath("temp"), "thunderload-previews");
  const PREVIEW_REDIRECT_LIMIT = 5;
  const PREVIEW_USER_AGENT = "ThunderLoad/1.0 PreviewCache";

  async function ensurePreviewCacheDir() {
    try {
      await fsPromises.mkdir(previewDirPath, { recursive: true });
    } catch (error) {
      log.warn("Failed to create preview cache directory:", error);
    }
    return previewDirPath;
  }

  function sanitizePreviewName(name = "preview") {
    try {
      return (
        String(name || "preview")
          .normalize("NFKD")
          .replace(/[^\w.-]+/g, "_")
          .replace(/^_+|_+$/g, "")
          .slice(0, 48) || "preview"
      );
    } catch {
      return "preview";
    }
  }

  function getExtensionFromMime(mime = "") {
    if (mime.includes("png")) return ".png";
    if (mime.includes("gif")) return ".gif";
    if (mime.includes("webp")) return ".webp";
    if (mime.includes("svg")) return ".svg";
    if (mime.includes("bmp")) return ".bmp";
    return ".jpg";
  }

  function getMimeFromDataUrl(dataUrl = "") {
    const match = dataUrl.match(/^data:(.+?);/i);
    return match ? match[1] : "";
  }

  function getExtensionFromUrl(inputUrl = "") {
    try {
      const parsed = new URL(inputUrl);
      const ext = path.extname(parsed.pathname);
      if (ext && ext.length <= 5) return ext.toLowerCase();
    } catch {
      // ignore
    }
    return ".jpg";
  }

  async function saveDataUrlPreview(dataUrl, targetPath) {
    const match = dataUrl.match(/^data:(.+?);base64,(.+)$/i);
    if (!match) throw new Error("Unsupported data URL");
    const buffer = Buffer.from(match[2], "base64");
    await fsPromises.writeFile(targetPath, buffer);
    return targetPath;
  }

  async function downloadPreviewToFile(
    imageUrl,
    targetPath,
    redirectCount = 0,
  ) {
    if (redirectCount > PREVIEW_REDIRECT_LIMIT) {
      throw new Error("Too many redirects while downloading preview");
    }
    const parsed = new URL(imageUrl);
    const client = parsed.protocol === "http:" ? http : https;
    const requestOptions = {
      headers: { "User-Agent": PREVIEW_USER_AGENT },
    };
    await new Promise((resolve, reject) => {
      const req = client.get(parsed, requestOptions, (res) => {
        const { statusCode = 0, headers } = res;
        if (
          [301, 302, 303, 307, 308].includes(Number(statusCode)) &&
          headers.location
        ) {
          res.resume();
          const nextUrl = new URL(headers.location, parsed).toString();
          downloadPreviewToFile(nextUrl, targetPath, redirectCount + 1)
            .then(resolve)
            .catch(reject);
          return;
        }

        if (statusCode !== 200) {
          res.resume();
          reject(
            new Error(
              `Unexpected status ${statusCode} while downloading preview`,
            ),
          );
          return;
        }

        const fileStream = fs.createWriteStream(targetPath);
        streamPipeline(res, fileStream)
          .then(resolve)
          .catch((error) => {
            fsPromises.rm(targetPath, { force: true }).catch(() => {});
            reject(error);
          });
      });
      req.on("error", (error) => reject(error));
    });
    return targetPath;
  }

  async function deletePreviewFiles(targets) {
    if (!targets) return 0;
    const list = Array.isArray(targets) ? targets : [targets];
    if (!list.length) return 0;
    const baseDir = path.resolve(previewDirPath);
    let removed = 0;
    for (const filePath of list) {
      if (!filePath || typeof filePath !== "string") continue;
      try {
        const resolved = path.resolve(filePath);
        if (!isPathInsideBaseDir(resolved, baseDir)) {
          log.warn("Skip deleting preview outside cache dir:", resolved);
          continue;
        }
        await fsPromises.rm(resolved, { force: true });
        removed += 1;
      } catch (error) {
        log.warn("Failed to delete preview file:", error);
      }
    }
    return removed;
  }

  if (mainWindow?.webContents) {
    mainWindow.webContents.on("before-input-event", (event, input) => {
      if (
        isReloadShortcutBlocked &&
        input?.type === "keyDown" &&
        typeof input?.key === "string" &&
        input.key.toLowerCase() === "r" &&
        (input.control || input.meta)
      ) {
        event.preventDefault();
      }
    });
  }

  // Initialize auto-shutdown on startup (single source of truth)
  try {
    const enabledAtStart = store.get("autoShutdownEnabled", false);
    if (enabledAtStart) {
      const secsAtStart = Math.min(
        60,
        Math.max(10, Number(store.get("autoShutdownSeconds", 30))),
      );
      if (autoShutdownTimeout) clearTimeout(autoShutdownTimeout);
      autoShutdownDeadlineMs = Date.now() + secsAtStart * 1000;
      autoShutdownTimeout = setTimeout(() => app.quit(), secsAtStart * 1000);
      log.info(
        `[WG Unlock] Auto-shutdown scheduled on init for ${secsAtStart}s, deadline=${new Date(autoShutdownDeadlineMs).toISOString()}`,
      );
    }
  } catch (e) {
    log.error("auto-shutdown init schedule error:", e);
  }

  ipcMain.handle(CHANNELS.GET_DEFAULT_TAB, () =>
    store.get("defaultTab", "download"),
  );
  ipcMain.handle(CHANNELS.SET_DEFAULT_TAB, (_, tabId) =>
    store.set("defaultTab", tabId),
  );

  ipcMain.handle(CHANNELS.GET_WHATS_NEW, async (event) => {
    try {
      const whatsNewPath = path.join(
        app.getAppPath(),
        "src",
        "info",
        "whatsNew.json",
      );
      log.info(`Reading the file: ${whatsNewPath}`);
      const data = await fs.promises.readFile(whatsNewPath, "utf-8");
      return JSON.parse(data);
    } catch (error) {
      log.error("Reading error: whatsNew.json:", error);
      return { version: "unknown", changes: [] };
    }
  });

  ipcMain.handle(CHANNELS.WHATS_NEW_READY, async () => {
    try {
      if (typeof dispatchPendingWhatsNew === "function") {
        dispatchPendingWhatsNew();
      }
      return { success: true };
    } catch (error) {
      log.error("whats-new:ready error:", error);
      return { success: false, error: error.message || String(error) };
    }
  });

  ipcMain.handle(CHANNELS.WHATS_NEW_ACK, async (_evt, version) => {
    try {
      let cleared = false;
      if (typeof clearPendingWhatsNewVersion === "function") {
        cleared = clearPendingWhatsNewVersion(version);
      }
      return { success: true, cleared };
    } catch (error) {
      log.error("whats-new:ack error:", error);
      return { success: false, error: error.message || String(error) };
    }
  });

  // ───── Update notification: dev helpers for in-app flyover ─────
  ipcMain.handle(CHANNELS.UPDATE_DEV_OPEN, async () => {
    try {
      const cur = await getAppVersion();
      mainWindow.webContents.send(
        "update-available",
        "Доступно новое обновление.",
      );
      mainWindow.webContents.send("update-available-info", {
        current: cur,
        next: "1.3.0",
      });
      return true;
    } catch {
      return false;
    }
  });
  ipcMain.handle(CHANNELS.UPDATE_DEV_PROGRESS, async (_e, percent) => {
    try {
      mainWindow.webContents.send("update-progress", Number(percent) || 0);
      return true;
    } catch {
      return false;
    }
  });
  ipcMain.handle(CHANNELS.UPDATE_DEV_DOWNLOADED, async () => {
    try {
      mainWindow.webContents.send("update-downloaded");
      return true;
    } catch {
      return false;
    }
  });
  ipcMain.handle(CHANNELS.UPDATE_DEV_ERROR, async (_e, message) => {
    try {
      mainWindow.webContents.send(
        "update-error",
        String(message || "Test error"),
      );
      return true;
    } catch {
      return false;
    }
  });

  ipcMain.handle(CHANNELS.TOOLS_GETVERSIONS, async () => {
    try {
      const tools = await getToolsVersions(store);
      if (process.platform === "darwin" && tools?.ffmpeg) {
        tools.ffmpeg.skipUpdates = true;
      }

      // Детальное логирование для диагностики
      log.info("Downloader → Tools versions check result:", {
        ytDlp: {
          ok: tools?.ytDlp?.ok,
          path: tools?.ytDlp?.path,
          version: tools?.ytDlp?.version,
          exists: tools?.ytDlp?.path ? fs.existsSync(tools.ytDlp.path) : false,
        },
        ffmpeg: {
          ok: tools?.ffmpeg?.ok,
          path: tools?.ffmpeg?.path,
          version: tools?.ffmpeg?.version,
          exists: tools?.ffmpeg?.path
            ? fs.existsSync(tools.ffmpeg.path)
            : false,
        },
      });

      return tools;
    } catch (error) {
      log.error("Error in TOOLS_GETVERSIONS:", error);
      return {
        ytDlp: { ok: false, error: error.message },
        ffmpeg: { ok: false, error: error.message },
      };
    }
  });

  // Предпросмотр: получить метаданные видео по URL (заголовок, длительность, превью)
  ipcMain.handle(CHANNELS.GET_VIDEO_INFO, async (_evt, url) => {
    try {
      const normalizedUrl = normalizeUrl(url);
      if (!normalizedUrl) throw new Error("Invalid URL");
      const info = await getVideoInfo(normalizedUrl);
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
      let entries = [];
      if (Array.isArray(info?.entries) && info.entries.length) {
        playlistCount = info.entries.length;
        entries = info.entries
          .map((e) => e?.webpage_url || e?.url)
          .filter((u) => typeof u === "string" && u.length > 0);
      } else if (typeof info?.playlist_count === "number") {
        playlistCount = info.playlist_count;
      }
      return {
        success: true,
        title,
        duration,
        thumbnail: thumb,
        playlistCount,
        entries,
        uploader: info?.uploader || info?.channel || "",
        channel: info?.channel || "",
        webpage_url: info?.webpage_url || info?.original_url || normalizedUrl,
        original_url: info?.original_url || normalizedUrl,
        formats: info?.formats || [],
        is_live: info?.is_live || false,
        extractor: info?.extractor || "",
      };
    } catch (e) {
      log.warn("get-video-info error:", e?.message || e);
      return { success: false, error: e?.message || String(e) };
    }
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

  // ==== Tools location management ====
  ipcMain.handle(CHANNELS.TOOLS_GET_LOCATION, () => {
    try {
      const def = getDefaultToolsDir();
      const dir = getEffectiveToolsDir(store);
      return {
        success: true,
        path: dir,
        isDefault: dir === def,
        defaultPath: def,
      };
    } catch (e) {
      log.error("tools:getLocation error:", e);
      return { success: false, error: e.message };
    }
  });

  ipcMain.handle(CHANNELS.TOOLS_SET_LOCATION, async (_evt, newDir) => {
    try {
      const dir = await ensureToolsDir(newDir);
      store.set("tools.dir", dir);
      return { success: true, path: dir };
    } catch (e) {
      log.error("tools:setLocation error:", e);
      return { success: false, error: e.message };
    }
  });

  ipcMain.handle(CHANNELS.TOOLS_OPEN_LOCATION, async () => {
    try {
      const dir = getEffectiveToolsDir(store);
      await ensureToolsDir(dir);
      shell.openPath(dir);
      return { success: true, path: dir };
    } catch (e) {
      log.error("tools:openLocation error:", e);
      return { success: false, error: e.message };
    }
  });

  ipcMain.handle(CHANNELS.TOOLS_RESET_LOCATION, async () => {
    try {
      const def = getDefaultToolsDir();
      await ensureToolsDir(def);
      // remove custom key to fall back to default
      try {
        store.delete && store.delete("tools.dir");
      } catch {
        store.set("tools.dir", def);
      }
      return { success: true, path: def };
    } catch (e) {
      log.error("tools:resetLocation error:", e);
      return { success: false, error: e.message };
    }
  });

  ipcMain.handle(CHANNELS.TOOLS_MIGRATE_OLD, async (_evt, opts) => {
    try {
      const dir = getEffectiveToolsDir(store);
      const result = await migrateLegacy(dir, opts || {});
      return { success: true, ...result };
    } catch (e) {
      log.error("tools:migrateOld error:", e);
      return { success: false, error: e.message };
    }
  });

  ipcMain.handle(CHANNELS.TOOLS_DETECT_LEGACY, async () => {
    try {
      const found = await detectLegacyLocations();
      return { success: true, found };
    } catch (e) {
      log.error("tools:detectLegacy error:", e);
      return { success: false, error: e.message };
    }
  });
  // ==== /Tools location management ====

  // Native folder picker for tools dir
  ipcMain.handle(CHANNELS.DIALOG_CHOOSE_TOOLS_DIR, async () => {
    try {
      const result = await dialog.showOpenDialog(mainWindow, {
        properties: ["openDirectory", "createDirectory"],
      });
      return result; // { canceled, filePaths: [...] }
    } catch (e) {
      log.error("dialog:choose-tools-dir error:", e);
      return { canceled: true, error: e.message };
    }
  });

  // --- helpers for update checks ---
  function fetchJson(url) {
    return new Promise((resolve, reject) => {
      const req = https.get(
        url,
        {
          headers: {
            "User-Agent": "ThunderLoad/1.0 (+https://example.local)",
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
            "User-Agent": "ThunderLoad/1.0 (+https://example.local)",
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
      let ytUnknownLatest = false;
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
        if (!ytLatest) ytUnknownLatest = true;
      } catch (e) {
        ytUnknownLatest = true;
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
      // Учитываем пользовательскую папку инструментов
      const tools = await getToolsVersions(store);
      const ytDlpInfo = tools?.ytDlp;
      if (ytDlpInfo?.ok && ytDlpInfo?.path) {
        log.info(
          `tools:updateYtDlp: Removing existing yt-dlp binary at ${ytDlpInfo.path}`,
        );
        try {
          await fsPromises.unlink(ytDlpInfo.path);
          log.info("tools:updateYtDlp: Existing yt-dlp binary removed.");
        } catch (e) {
          log.error(
            "tools:updateYtDlp: Failed to remove existing yt-dlp binary:",
            e,
          );
          // Continue anyway
        }
      } else {
        log.info(
          "tools:updateYtDlp: No existing yt-dlp binary detected, proceeding with install.",
        );
      }
      log.info("tools:updateYtDlp: Installing yt-dlp...");
      await installYtDlp();
      log.info("tools:updateYtDlp: yt-dlp installed successfully.");
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

  ipcMain.handle(CHANNELS.GET_PLATFORM_INFO, () => {
    console.log("get-platform-info handler registered");
    return { isMac: process.platform === "darwin" };
  });

  // Обработчики IPC для темы
  ipcMain.handle(CHANNELS.GET_THEME, () => {
    return store.get("theme", "system"); // 'system' - тема по умолчанию
  });

  ipcMain.handle(CHANNELS.SET_THEME, (event, theme) => {
    store.set("theme", theme);
    return { success: true };
  });

  ipcMain.handle(CHANNELS.TOAST, (event, message, type = "success") => {
    if (mainWindow && mainWindow.webContents) {
      mainWindow.webContents.send("toast", message, type);
    }
  });

  // Обработчики IPC для размера шрифта
  ipcMain.handle(CHANNELS.GET_FONT_SIZE, () => {
    return store.get("fontSize", "16px"); // '16px' - размер по умолчанию
  });

  ipcMain.handle(CHANNELS.SET_FONT_SIZE, (event, fontSize) => {
    store.set("fontSize", fontSize);
    return { success: true };
  });

  // ===== Backup: presets, actions =====
  ipcMain.handle(CHANNELS.BACKUP_GET_PROGRAMS, async () => {
    try {
      const programs = await backup.readPrograms();
      return { success: true, programs };
    } catch (e) {
      log.error("backup:getPrograms error:", e);
      return { success: false, error: e.message };
    }
  });

  ipcMain.handle(CHANNELS.BACKUP_SAVE_PROGRAMS, async (_evt, programs) => {
    try {
      await backup.savePrograms(programs || []);
      return { success: true };
    } catch (e) {
      log.error("backup:savePrograms error:", e);
      return { success: false, error: e.message };
    }
  });

  ipcMain.handle(CHANNELS.BACKUP_GET_LAST_TIMES, async () => {
    try {
      const programs = await backup.readPrograms();
      const map = await backup.listLastTimes(programs);
      return { success: true, map };
    } catch (e) {
      log.error("backup:getLastTimes error:", e);
      return { success: false, error: e.message };
    }
  });

  ipcMain.handle(CHANNELS.BACKUP_RUN, async (_evt, programs) => {
    try {
      const list = Array.isArray(programs)
        ? programs
        : await backup.readPrograms();
      const res = await backup.runBackupBatch(list);
      // optional toast summary
      try {
        const ok = res.filter((r) => r.success).length;
        const total = res.length;
        if (mainWindow && mainWindow.webContents) {
          mainWindow.webContents.send(
            "toast",
            `Backup завершён: ${ok}/${total}`,
            ok === total ? "success" : ok ? "warning" : "error",
          );
        }
      } catch (_) {}
      return { success: true, results: res };
    } catch (e) {
      log.error("backup:run error:", e);
      return { success: false, error: e.message };
    }
  });

  ipcMain.handle(CHANNELS.BACKUP_CHOOSE_DIR, async () => {
    try {
      const dir = await backup.chooseDir(mainWindow);
      return { success: !!dir, path: dir || null };
    } catch (e) {
      log.error("backup:chooseDir error:", e);
      return { success: false, error: e.message };
    }
  });

  ipcMain.handle(CHANNELS.BACKUP_OPEN_PATH, async (_evt, p) => {
    try {
      const r = await backup.openPath(p);
      return r;
    } catch (e) {
      log.error("backup:openPath error:", e);
      return { success: false, error: e.message };
    }
  });

  ipcMain.handle(
    CHANNELS.BACKUP_TOGGLE_RELOAD_BLOCK,
    async (_evt, shouldBlock) => {
      try {
        isReloadShortcutBlocked = Boolean(shouldBlock);
        setReloadShortcutSuppressed(isReloadShortcutBlocked);
        if (typeof setReloadMenuEnabled === "function") {
          setReloadMenuEnabled(!isReloadShortcutBlocked);
        }
        return { success: true, blocked: isReloadShortcutBlocked };
      } catch (error) {
        log.error("backup:toggleReloadBlock error:", error);
        return { success: false, error: error.message || String(error) };
      }
    },
  );

  // Проверка на отмену загрузки
  function checkIfCancelled(step) {
    if (isDownloadCancelled()) {
      log.error(`Download cancelled at step: ${step}`);
      throw new Error("Download cancelled");
    }
  }

  // Функция для начала процесса загрузки
  async function startDownloadProcess(event, url, quality) {
    try {
      resetDownloadCancelledFlag();

      // Проверяем наличие утилит, не устанавливаем автоматически
      const tools = await getToolsVersions();
      const hasYt = tools?.ytDlp?.ok;
      const hasFf = tools?.ffmpeg?.ok;
      if (!hasYt || !hasFf) {
        if (mainWindow && mainWindow.webContents) {
          mainWindow.webContents.send(
            "toast",
            !hasYt && !hasFf
              ? "Не найдены yt-dlp и ffmpeg. Откройте Настройки → Downloader → Инструменты и нажмите ‘Скачать зависимости’."
              : !hasYt
                ? "Не найден yt-dlp. Откройте Настройки → Downloader → Инструменты и нажмите ‘Скачать зависимости’."
                : "Не найден ffmpeg. Откройте Настройки → Downloader → Инструменты и нажмите ‘Скачать зависимости’.",
            "warning",
          );
        }
        throw new Error("Отсутствуют необходимые инструменты (yt-dlp/ffmpeg)");
      }

      const videoInfo = await getVideoInfo(url);
      checkIfCancelled("getVideoInfo");

      const formats = videoInfo.formats;
      const title = videoInfo.title.replace(/[\\/:*?"<>|]/g, "");

      // Используем функцию selectFormatsByQuality
      const selectedFormats = selectFormatsByQuality(formats, quality);

      const videoFormat = selectedFormats.videoFormat;
      const audioFormat = selectedFormats.audioFormat;
      const audioExt = selectedFormats.audioExt;
      const videoExt = selectedFormats.videoExt;

      // Получаем разрешение и fps
      const resolution = selectedFormats.resolution;
      const fps = selectedFormats.fps;

      checkIfCancelled("before downloadMedia");

      let filePath;
      try {
        filePath = await downloadMedia(
          event,
          downloadState.downloadPath,
          url,
          videoFormat,
          audioFormat,
          title,
          quality,
          resolution,
          fps,
          audioExt,
          videoExt,
        );
      } catch (error) {
        if (mainWindow && mainWindow.webContents) {
          mainWindow.webContents.send(
            "toast",
            `Ошибка при скачивании видео: ${error.message}`,
            "error",
          );
        }
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
        log.info(
          `Actual: ${
            videoFormat === null
              ? `audio: ${resolution}`
              : resolution !== "unknown"
                ? `${resolution} ${fps ? fps + "fps" : ""}`
                : "unknown"
          }`,
        );
        log.info(`Source: ${url}`);
        return {
          fileName: title,
          filePath,
          quality,
          actualQuality:
            videoFormat === null
              ? `audio: ${resolution}`
              : resolution !== "unknown"
                ? `${resolution} ${fps ? fps + "fps" : ""}`
                : "unknown",
          resolution,
          fps,
          sourceUrl: url,
        };
      }

      sendDownloadCompletionNotification(title, filePath, store, mainWindow);

      // Подробный лог о завершённой загрузке с деталями
      log.info(`[Download Complete] ${title}`);
      log.info(`Path: ${filePath}`);
      log.info(`Quality: ${quality}`);
      log.info(
        `Actual: ${
          videoFormat === null
            ? `audio: ${resolution}`
            : resolution !== "unknown"
              ? `${resolution} ${fps ? fps + "fps" : ""}`
              : "unknown"
        }`,
      );
      log.info(`Source: ${url}`);

      return {
        fileName: title,
        filePath,
        quality,
        actualQuality:
          videoFormat === null
            ? `audio: ${resolution}`
            : resolution !== "unknown"
              ? `${resolution} ${fps ? fps + "fps" : ""}`
              : "unknown",
        resolution,
        fps,
        sourceUrl: url,
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

  // Функции для автозапуска
  function getStartupFolderPath() {
    if (process.platform !== "win32") {
      throw new Error("Эта функция поддерживается только на Windows.");
    }
    return path.join(
      process.env.APPDATA,
      "Microsoft\\Windows\\Start Menu\\Programs\\Startup",
    );
  }

  function enableAutoLaunch() {
    const startupFolderPath = getStartupFolderPath();
    const shortcutPath = path.join(startupFolderPath, `${app.getName()}.lnk`);
    const exePath = app.getPath("exe");

    // Создание ярлыка с помощью shell
    shell.writeShortcutLink(shortcutPath, {
      target: exePath,
      args: "",
      workingDirectory: path.dirname(exePath),
      icon: exePath,
      iconIndex: 0,
    });
  }

  function disableAutoLaunch() {
    const startupFolderPath = getStartupFolderPath();
    const shortcutPath = path.join(startupFolderPath, `${app.getName()}.lnk`);

    if (fs.existsSync(shortcutPath)) {
      fs.unlinkSync(shortcutPath);
    }
  }

  function isAutoLaunchEnabled() {
    if (process.platform !== "win32") return false;
    const startupFolderPath = getStartupFolderPath();
    const shortcutPath = path.join(startupFolderPath, `${app.getName()}.lnk`);
    return fs.existsSync(shortcutPath);
  }

  // Функция для получения имени иконки из URL
  function getIconNameFromUrl(url) {
    if (url.includes("youtube.com")) return "youtube";
    if (url.includes("twitch.tv")) return "twitch";
    if (url.includes("coub.com")) return "coub";
    if (url.includes("vkvideo.ru")) return "vk";
    if (url.includes("youtu.be")) return "youtube";
    if (url.includes("dzen.ru")) return "video";
    return "video";
  }

  // Функция для получения пути к иконке приложения
  async function getAppIconPath(iconName) {
    if (iconCache.has(iconName)) return iconCache.get(iconName);

    const svgPath = path.join(
      app.getAppPath(),
      "assets",
      "icons",
      `${iconName}.svg`,
    );
    const pngPath = path.join(
      app.getAppPath(),
      "assets",
      "icons",
      `${iconName}.png`,
    );

    try {
      await fs.promises.access(svgPath);
      iconCache.set(iconName, svgPath);
      return svgPath;
    } catch {
      try {
        await fs.promises.access(pngPath);
        iconCache.set(iconName, pngPath);
        return pngPath;
      } catch {
        return null;
      }
    }
  }

  // Обработчики IPC:

  // Добавляем обработчик для открытия терминала на macOS
  ipcMain.handle(CHANNELS.OPEN_TERMINAL, async () => {
    const { exec } = require("child_process");
    exec("open -a Terminal");
  });

  ipcMain.handle(CHANNELS.OPEN_CONFIG_FOLDER, () => {
    const folderPath = app.getPath("userData");
    const filePath = path.join(folderPath, "wireguard.conf");
    try {
      if (!fs.existsSync(folderPath)) {
        fs.mkdirSync(folderPath, { recursive: true });
      }
      if (!fs.existsSync(filePath)) {
        fs.writeFileSync(filePath, "", "utf8");
      }
      shell.showItemInFolder(filePath);
      return { success: true };
    } catch (e) {
      log.error("open-config-folder error:", e);
      shell.openPath(folderPath);
      return { success: false, error: e.message };
    }
  });

  // WG Unlock: open config folder via ipcRenderer.send("wg-open-config-folder")
  ipcMain.on(CHANNELS.WG_OPEN_CONFIG_FOLDER, () => {
    try {
      const folderPath = app.getPath("userData");
      const filePath = path.join(folderPath, "wireguard.conf");

      if (!fs.existsSync(folderPath)) {
        fs.mkdirSync(folderPath, { recursive: true });
      }
      if (!fs.existsSync(filePath)) {
        fs.writeFileSync(filePath, "", "utf8");
      }

      shell.openPath(filePath);

      log.info("Конфигурационный файл открыт в текстовом редакторе:", filePath);
    } catch (e) {
      log.error("wg-open-config-file error:", e);
    }
  });

  ipcMain.on(CHANNELS.WG_OPEN_NETWORK_SETTINGS, () => {
    const os = require("os");
    if (process.platform === "win32") {
      shell.openExternal("ms-settings:network");
    } else if (process.platform === "darwin") {
      const version = parseFloat(os.release());
      if (version >= 22) {
        shell.openExternal(
          "x-apple.systempreferences:com.apple.Network-Settings.extension",
        );
      } else {
        shell.openExternal(
          "x-apple.systempreferences:com.apple.preference.network",
        );
      }
    } else {
      log.info(
        "WG_OPEN_NETWORK_SETTINGS: платформа не поддерживается для открытия настроек сети.",
      );
    }
  });

  // WG Unlock: export log to file
  ipcMain.on(CHANNELS.WG_EXPORT_LOG, async (event, logContent) => {
    try {
      const { filePath } = await dialog.showSaveDialog({
        title: "Экспорт лога WireGuard",
        defaultPath: `wg-log-${new Date().toISOString().slice(0, 10)}.txt`,
        filters: [
          { name: "Text Files", extensions: ["txt"] },
          { name: "All Files", extensions: ["*"] },
        ],
      });

      if (filePath) {
        await fs.promises.writeFile(filePath, logContent, "utf8");
        // Отправляем объект с filePath вместо просто строки
        event.reply("wg-log-export-success", { filePath });
        log.info("Лог WireGuard экспортирован:", filePath);
      } else {
        // Пользователь отменил диалог
        event.reply("wg-log-export-error", {
          error: "Экспорт отменен пользователем",
        });
      }
    } catch (e) {
      log.error("wg-log-export error:", e);
      event.reply("wg-log-export-error", { error: e.message });
    }
  });

  // Обработка запроса на загрузку обновления из рендер-процесса
  ipcMain.handle(CHANNELS.DOWNLOAD_UPDATE, async () => {
    try {
      log.info("Запрос на загрузку обновления получен.");
      autoUpdater.downloadUpdate();
      return { success: true };
    } catch (error) {
      log.error("Ошибка при загрузке обновления:", error);
      return { success: false, error: error.message };
    }
  });

  // Обработка запроса на перезапуск и установку обновления из рендер-процесса
  ipcMain.handle(CHANNELS.RESTART_APP, async () => {
    try {
      log.info("Запрос на перезапуск приложения получен.");
      autoUpdater.quitAndInstall();
      return { success: true };
    } catch (error) {
      log.error("Ошибка при перезапуске приложения:", error);
      return { success: false, error: error.message };
    }
  });

  ipcMain.handle(CHANNELS.CHECK_FILE_EXISTS, async (event, filePath) => {
    try {
      await fsPromises.access(filePath);
      return true;
    } catch (error) {
      // log.warn(`The file does not exist: ${filePath}`);
      return false;
    }
  });

  ipcMain.handle(CHANNELS.GET_DISABLE_COMPLETE_MODAL_STATUS, () =>
    store.get("disableCompleteModal", true),
  );

  ipcMain.handle(CHANNELS.SET_DISABLE_COMPLETE_MODAL_STATUS, (_, enabled) =>
    store.set("disableCompleteModal", enabled),
  );

  /**
   * Обработчик для удаления файла
   */
  ipcMain.handle(CHANNELS.DELETE_FILE, async (event, filePath) => {
    try {
      log.info(`Attempting to delete file: ${filePath}`);

      // Валидация пути
      if (!isValidFilePath(filePath)) {
        log.warn(`Invalid file path for deletion: ${filePath}`);
        throw new Error("Invalid file path.");
      }

      // Проверка, находится ли файл внутри разрешённой директории
      const baseDir = downloadState.downloadPath;
      log.info(`Base directory: ${baseDir}`);
      log.info(`Resolved file path: ${path.resolve(filePath)}`);

      if (!isPathInsideBaseDir(filePath, baseDir)) {
        log.warn(
          `Attempt to delete file outside allowed directory: ${filePath}`,
        );
        throw new Error(
          "Deleting files outside the allowed directory is prohibited.",
        );
      }

      // Опционально: Создание резервной копии файла перед удалением
      // await backupFile(filePath, baseDir);

      // Удаление файла
      await fsPromises.unlink(filePath);
      log.info(`File successfully deleted: ${filePath}`);
      return true;
    } catch (error) {
      log.error(`Error deleting file ${filePath}:`, error);
      throw error;
    }
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
          setDownloadPath(selectedPath);
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

  ipcMain.handle(CHANNELS.DOWNLOAD_VIDEO, async (event, url, quality) => {
    if (downloadState.downloadInProgress) {
      throw new Error("Загрузка уже выполняется");
    }

    const normalizedUrl = normalizeUrl(url);
    if (!normalizedUrl) {
      throw new Error("Недопустимый URL");
    }

    downloadState.downloadInProgress = true;
    try {
      const result = await startDownloadProcess(event, normalizedUrl, quality);
      downloadState.downloadInProgress = false;
      return { ...result, sourceUrl: normalizedUrl };
    } catch (error) {
      downloadState.downloadInProgress = false;
      if (error.message === "Download cancelled") {
        return { cancelled: true };
      } else {
        notifyDownloadError(error);
        throw error;
      }
    }
  });

  ipcMain.handle(CHANNELS.STOP_DOWNLOAD, async () => {
    console.log("A request to stop download was received.");
    try {
      await stopDownload();
      console.log("The stopDownload() function was called successfully.");
      return { success: true };
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
      setDownloadPath(path);
      log.info(`Download path set to: ${path}`);
      return { success: true };
    } catch (error) {
      log.error("Invalid download path:", error);
      return { success: false, error: error.message };
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

  ipcMain.handle(CHANNELS.CACHE_HISTORY_PREVIEW, async (_event, payload) => {
    try {
      const { url, entryId, fileName } = payload || {};
      if (!url || typeof url !== "string" || !url.length) {
        return { success: false, error: "Invalid preview URL" };
      }
      await ensurePreviewCacheDir();
      const safeBase = sanitizePreviewName(fileName || "preview");
      const uniqueSuffix =
        (entryId ? String(entryId) : Date.now().toString()).replace(
          /[^\w.-]/g,
          "",
        ) || Date.now().toString();
      const ext = url.startsWith("data:")
        ? getExtensionFromMime(getMimeFromDataUrl(url))
        : getExtensionFromUrl(url);
      const targetPath = path.join(
        previewDirPath,
        `${safeBase}-${uniqueSuffix}${ext}`,
      );
      if (url.startsWith("data:")) {
        await saveDataUrlPreview(url, targetPath);
      } else {
        await downloadPreviewToFile(url, targetPath);
      }
      return { success: true, filePath: targetPath };
    } catch (error) {
      log.warn("cache-history-preview error:", error);
      return { success: false, error: error.message || String(error) };
    }
  });

  ipcMain.handle(CHANNELS.DELETE_HISTORY_PREVIEW, async (_event, payload) => {
    try {
      const removed = await deletePreviewFiles(payload);
      return { success: true, removed };
    } catch (error) {
      log.warn("delete-history-preview error:", error);
      return { success: false, error: error.message || String(error) };
    }
  });

  ipcMain.handle(CHANNELS.LOAD_HISTORY, async () => {
    try {
      if (!fs.existsSync(historyFilePath)) {
        fs.writeFileSync(historyFilePath, JSON.stringify([]));
      }
      const historyData = await fs.promises.readFile(historyFilePath, "utf8");
      return JSON.parse(historyData);
    } catch (error) {
      log.error("Error loading history:", error);
      throw error;
    }
  });

  ipcMain.handle(CHANNELS.SAVE_HISTORY, async (event, history) => {
    try {
      const historyJson = JSON.stringify(history, null, 2);
      await fs.promises.writeFile(historyFilePath, historyJson, "utf8");
      try {
        const count = Array.isArray(history) ? history.length : 0;
        mainWindow?.webContents?.send("history-updated", { count });
      } catch (e) {
        log.warn("history-updated emit failed:", e);
      }
    } catch (error) {
      log.error(`Error saving history: ${error}`);
    }
  });

  ipcMain.handle(CHANNELS.CLEAR_HISTORY, async () => {
    try {
      await fs.promises.writeFile(historyFilePath, JSON.stringify([]), "utf-8");
      try {
        await fsPromises.rm(previewDirPath, { recursive: true, force: true });
      } catch (error) {
        log.warn("Failed to clear preview cache directory:", error);
      }
      await ensurePreviewCacheDir();
      try {
        mainWindow?.webContents?.send("history-updated", { count: 0 });
      } catch (e) {
        log.warn("history-updated emit failed:", e);
      }
      return true;
    } catch (error) {
      log.error(`Error clearing history: ${error}`);
      throw error;
    }
  });

  ipcMain.handle(CHANNELS.GET_FILE_SIZE, async (event, filePath) => {
    try {
      const stats = await fs.promises.stat(filePath);
      return stats.size;
    } catch (error) {
      log.error("Ошибка при получении размера файла:", error);
      return null;
    }
  });

  ipcMain.handle(CHANNELS.GET_VERSION, async () => {
    try {
      return await getAppVersion();
    } catch (error) {
      log.error("Error getting app version:", error);
      return "unknown";
    }
  });

  ipcMain.handle(CHANNELS.GET_DOWNLOAD_COUNT, async () => {
    try {
      if (!fs.existsSync(historyFilePath)) return 0;
      const historyData = await fs.promises.readFile(historyFilePath, "utf8");
      return JSON.parse(historyData).length;
    } catch (error) {
      log.error("Error getting download count:", error);
      throw error;
    }
  });

  ipcMain.handle(CHANNELS.OPEN_DOWNLOAD_FOLDER, async (event, filePath) => {
    if (!filePath || typeof filePath !== "string")
      throw new TypeError('The "path" argument must be of type string.');

    log.info("Showing file in folder:", filePath);

    if (fs.existsSync(filePath)) {
      shell.showItemInFolder(filePath);
    } else {
      throw new Error("Файл не существует");
    }
  });

  ipcMain.handle(CHANNELS.GET_ICON_PATH, async (event, url) => {
    const iconName = getIconNameFromUrl(url);
    return await getAppIconPath(iconName);
  });

  ipcMain.handle(CHANNELS.OPEN_EXTERNAL_LINK, async (event, url) => {
    log.info("Opening external link:", url);
    try {
      const normalizedUrl = normalizeUrl(url);
      if (!isValidUrl(normalizedUrl)) throw new Error("Invalid URL");

      const parsedUrl = new URL(normalizedUrl);
      if (!["http:", "https:"].includes(parsedUrl.protocol)) {
        throw new Error("Invalid or unsupported URL protocol");
      }

      await shell.openExternal(normalizedUrl);
      return { success: true };
    } catch (error) {
      log.error("Error opening external link:", error);
      return { success: false, error: error.message };
    }
  });

  ipcMain.handle(CHANNELS.OPEN_LAST_VIDEO, async (event, filePath) => {
    try {
      log.info(`Trying to open file: ${filePath}`);
      if (!filePath) throw new Error("File path is empty");

      const exists = await fs.promises
        .access(filePath)
        .then(() => true)
        .catch(() => false);
      if (!exists) throw new Error("File does not exist");

      const result = await shell.openPath(filePath);
      if (result) throw new Error(result);

      log.info("File opened successfully");
      return { success: true };
    } catch (error) {
      log.error("Error opening file:", error);
      return { success: false, error: error.message };
    }
  });

  ipcMain.handle(CHANNELS.TOGGLE_AUTO_LAUNCH, async (event, enable) => {
    try {
      if (enable) {
        enableAutoLaunch();
        log.info("AutoLaunch enabled.");
        event.sender.send(
          "toast",
          "Приложение добавлено в автозагрузку.",
          "success",
        );
      } else {
        disableAutoLaunch();
        log.info("AutoLaunch disabled.");
        event.sender.send(
          "toast",
          "Приложение удалено из автозагрузки.",
          "success",
        );
      }
    } catch (error) {
      log.error("Ошибка при изменении состояния автозапуска:", error);
      event.sender.send(
        "toast",
        "Не удалось изменить состояние автозапуска.",
        "error",
      );
    }
  });

  // ==== WG Unlock: авто‑закрытие приложения ====
  ipcMain.handle(CHANNELS.GET_AUTO_SHUTDOWN_STATUS, () => {
    return store.get("autoShutdownEnabled", false);
  });

  ipcMain.handle(CHANNELS.GET_AUTO_SHUTDOWN_SECONDS, () => {
    return store.get("autoShutdownSeconds", 30);
  });

  ipcMain.handle(CHANNELS.GET_AUTO_SHUTDOWN_DEADLINE, () => {
    const enabled = store.get("autoShutdownEnabled", false);
    return enabled ? autoShutdownDeadlineMs : null;
  });

  ipcMain.handle(CHANNELS.SET_AUTO_SHUTDOWN_STATUS, (event, enable) => {
    try {
      store.set("autoShutdownEnabled", !!enable);
      if (enable) {
        const secondsRaw = Number(store.get("autoShutdownSeconds", 30));
        const seconds = Math.min(60, Math.max(10, secondsRaw));
        autoShutdownDeadlineMs = Date.now() + seconds * 1000;
        if (autoShutdownTimeout) clearTimeout(autoShutdownTimeout);
        autoShutdownTimeout = setTimeout(() => app.quit(), seconds * 1000);
        log.info(
          `[WG Unlock] Auto-shutdown enabled for ${seconds}s, deadline=${new Date(autoShutdownDeadlineMs).toISOString()}`,
        );
        if (mainWindow && mainWindow.webContents) {
          try {
            mainWindow.webContents.send("wg-auto-shutdown-updated", {
              enabled: true,
              seconds,
              deadline: autoShutdownDeadlineMs,
            });
          } catch (sendErr) {
            log.warn(
              "Failed to send wg-auto-shutdown-updated (enabled)",
              sendErr,
            );
          }
        }
      } else {
        if (autoShutdownTimeout) clearTimeout(autoShutdownTimeout);
        autoShutdownTimeout = null;
        autoShutdownDeadlineMs = null;
        log.info("[WG Unlock] Auto-shutdown disabled");
        const seconds = Number(store.get("autoShutdownSeconds", 30));
        if (mainWindow && mainWindow.webContents) {
          try {
            mainWindow.webContents.send("wg-auto-shutdown-updated", {
              enabled: false,
              seconds,
              deadline: null,
            });
          } catch (sendErr) {
            log.warn(
              "Failed to send wg-auto-shutdown-updated (disabled)",
              sendErr,
            );
          }
        }
      }
      return true;
    } catch (e) {
      log.error("set-auto-shutdown-status error:", e);
      return false;
    }
  });

  ipcMain.handle(CHANNELS.SET_AUTO_SHUTDOWN_SECONDS, (event, seconds) => {
    try {
      const sNum = Number(seconds);
      if (!Number.isFinite(sNum)) return false;
      const s = Math.min(60, Math.max(10, sNum));
      store.set("autoShutdownSeconds", s);
      if (store.get("autoShutdownEnabled", false)) {
        autoShutdownDeadlineMs = Date.now() + s * 1000;
        if (autoShutdownTimeout) clearTimeout(autoShutdownTimeout);
        autoShutdownTimeout = setTimeout(() => app.quit(), s * 1000);
        log.info(
          `[WG Unlock] Auto-shutdown rescheduled for ${s}s, deadline=${new Date(autoShutdownDeadlineMs).toISOString()}`,
        );
      }
      const enabledNow = store.get("autoShutdownEnabled", false);
      if (mainWindow && mainWindow.webContents) {
        try {
          mainWindow.webContents.send("wg-auto-shutdown-updated", {
            enabled: !!enabledNow,
            seconds: s,
            deadline: autoShutdownDeadlineMs,
          });
        } catch (sendErr) {
          log.warn(
            "Failed to send wg-auto-shutdown-updated (seconds)",
            sendErr,
          );
        }
      }
      return true;
    } catch (e) {
      log.error("set-auto-shutdown-seconds error:", e);
      return false;
    }
  });
  // ==== /WG Unlock: авто‑закрытие приложения ====

  ipcMain.handle(CHANNELS.SET_MINIMIZE_ON_LAUNCH_STATUS, (_, enabled) => {
    store.set("minimizeOnLaunch", enabled);
    return true; // ← нужно!
  });

  ipcMain.handle(CHANNELS.GET_MINIMIZE_ON_LAUNCH_STATUS, () => {
    return store.get("minimizeOnLaunch", false);
  });

  ipcMain.handle(
    CHANNELS.SET_MINIMIZE_INSTEAD_OF_CLOSE,
    async (event, minimize) => {
      store.set("minimizeInsteadOfClose", minimize);
      showTrayNotification(
        minimize
          ? "Приложение теперь будет сворачиваться в трей при закрытии."
          : "Приложение теперь будет полностью закрываться.",
      );
    },
  );

  ipcMain.handle(CHANNELS.GET_AUTO_LAUNCH_STATUS, async () => {
    try {
      const isEnabled = isAutoLaunchEnabled();
      return isEnabled;
    } catch (error) {
      log.error("Ошибка при получении состояния автозапуска:", error);
      return false;
    }
  });

  ipcMain.handle(
    CHANNELS.SET_MINIMIZE_TO_TRAY_STATUS,
    async (event, enable) => {
      store.set("minimizeToTray", enable);
    },
  );

  ipcMain.handle(CHANNELS.GET_MINIMIZE_TO_TRAY_STATUS, async () => {
    return store.get("minimizeToTray", false);
  });

  ipcMain.handle(
    CHANNELS.SET_CLOSE_NOTIFICATION_STATUS,
    async (event, enable) => {
      store.set("closeNotification", enable);
    },
  );

  ipcMain.handle(CHANNELS.GET_CLOSE_NOTIFICATION_STATUS, async () => {
    return store.get("closeNotification", true);
  });

  ipcMain.handle(
    CHANNELS.SET_OPEN_ON_DOWNLOAD_COMPLETE_STATUS,
    async (event, enable) => {
      store.set("expandWindowOnDownloadComplete", enable);
    },
  );

  ipcMain.handle(CHANNELS.GET_OPEN_ON_DOWNLOAD_COMPLETE_STATUS, async () => {
    return store.get("expandWindowOnDownloadComplete", false);
  });

  ipcMain.handle(
    CHANNELS.SET_OPEN_ON_COPY_URL_STATUS,
    async (event, enabled) => {
      store.set("openOnCopyUrl", enabled);
      if (clipboardMonitor) {
        enabled ? clipboardMonitor.start() : clipboardMonitor.stop();
      } else {
        log.warn("clipboardMonitor not initialized");
      }
    },
  );

  ipcMain.handle(CHANNELS.GET_OPEN_ON_COPY_URL_STATUS, async () => {
    return store.get("openOnCopyUrl", false);
  });

  ipcMain.handle(CHANNELS.GET_DISABLE_GLOBAL_SHORTCUTS_STATUS, () => {
    const isEnabled = store.get("disableGlobalShortcuts", false);
    return isEnabled;
  });

  ipcMain.handle(
    CHANNELS.SET_DISABLE_GLOBAL_SHORTCUTS_STATUS,
    (event, enable) => {
      store.set("disableGlobalShortcuts", enable);
      if (enable) {
        globalShortcut.unregisterAll();
        log.info("Global hotkeys are disabled.");
      } else {
        setupGlobalShortcuts(mainWindow);
        log.info("Global hotkeys are enabled.");
      }
    },
  );

  ipcMain.handle(
    CHANNELS.SHOW_SYSTEM_NOTIFICATION,
    async (event, { title, body }) => {
      if (Notification.isSupported()) {
        new Notification({ title, body }).show();
      } else {
        console.error(
          "Системные уведомления не поддерживаются на этом устройстве.",
        );
      }
    },
  );

  ipcMain.handle(CHANNELS.GET_MINIMIZE_INSTEAD_OF_CLOSE_STATUS, async () => {
    return store.get("minimizeInsteadOfClose", false);
  });
}

module.exports = { setupIpcHandlers };
