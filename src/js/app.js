/**
 * @file app.js
 * @description
 * Main entry point for the Electron application.
 * Handles initialization of the main process, including:
 *  - Setting up the application window
 *  - Managing persistent settings via electron-store
 *  - Handling download paths and history
 *  - Registering IPC handlers for renderer ↔ main communication
 *  - Initializing clipboard monitoring
 *  - Setting up auto-updater and global shortcuts
 *  - Displaying "What's New" modal on version updates
 *  - Managing single-instance lock to prevent multiple app instances
 *  - Cleaning up resources before quitting
 *
 * Exports:
 *  - `mainWindow` — reference to the main BrowserWindow instance
 */

// src/js/app.js

const path = require("path");
const fs = require("fs");

const ElectronStore = require("electron-store").default;
const log = require("electron-log");

const { app, BrowserWindow } = require("electron");
const { configureLegacyUserDataPath } = require("./app/userDataPath.js");
const { configureDiagnosticsLogger } = require("./app/diagnosticsLogger.js");
const { processSupervisor } = require("./app/processSupervisor.js");
const { ShutdownCoordinator } = require("./app/shutdownCoordinator.js");
const { createStartupMetrics } = require("./app/startupMetrics.js");

configureLegacyUserDataPath(app, fs);

const startupMetrics = createStartupMetrics(log);

const { createWindow } = startupMetrics.measure(
  "require window.js",
  () => require("./app/window.js"),
);
const { setupIpcHandlers } = startupMetrics.measure(
  "require ipcHandlers.js",
  () => require("./app/ipcHandlers.js"),
);
const {
  showTrayNotification,
  notifyDownloadError,
  sendDownloadCompletionNotification,
} = require("./app/notifications.js");
const ClipboardMonitor = require("./app/clipboardMonitor.js");
const { isValidUrl, isSupportedUrl } = require("./app/utils.js");
const {
  disposeAutoUpdater,
  scheduleAutoUpdateCheck,
  setupAutoUpdater,
} = startupMetrics.measure(
  "require autoUpdater.js",
  () => require("./app/autoUpdater.js"),
);
const {
  disposeGlobalShortcuts,
  setupGlobalShortcuts,
} = require("./app/shortcuts.js");
const { createWebControlServer } = require("./app/webControlServer.js");
const { createMediaOpenService } = require("./app/mediaOpenService.js");

// Initialize store and logging
const store = new ElectronStore();
const diagnosticsLogger = configureDiagnosticsLogger({ app, store, log });
const mainLogger = diagnosticsLogger.createScope("Main");
processSupervisor.setLogger(diagnosticsLogger);
const shutdownCoordinator = new ShutdownCoordinator({ logger: mainLogger });
const isDev = process.argv.includes("--dev");

app.setAppUserModelId("com.thunderload.app");
const mediaOpenService = createMediaOpenService({ app, fs });

// Define essential paths
const historyFilePath = path.join(
  app.getPath("userData"),
  "download_history.json",
);
let downloadPath = path.join(app.getPath("videos"), "Download");
const previewCacheDir = path.join(
  app.getPath("userData"),
  "thunderload-previews",
);
try {
  fs.mkdirSync(previewCacheDir, { recursive: true });
} catch (error) {
  log.error("Failed to ensure preview cache directory:", error);
}

const binDir = path.join(process.resourcesPath, "bin");
const ytDlpPath = path.join(
  binDir,
  process.platform === "win32" ? "yt-dlp.exe" : "yt-dlp",
);
const ffmpegPath = path.join(
  binDir,
  process.platform === "win32" ? "ffmpeg.exe" : "ffmpeg",
);
const ffprobePath = path.join(
  binDir,
  process.platform === "win32" ? "ffprobe.exe" : "ffprobe",
);

mainLogger.info("app-starting", { version: app.getVersion() });

let mainWindow;
let clipboardMonitorInstance;
let webControlServer;
let ipcRuntime;
const WHATS_NEW_PENDING_KEY = "pendingWhatsNewVersion";

// Cache for file existence checks
const fsCache = new Map();
const iconCache = new Map();

/**
 * Check if a file exists, using cache to optimize repeated checks.
 * @param {string} filePath - Path to the file.
 * @returns {Promise<boolean>}
 */
async function fileExists(filePath) {
  if (fsCache.has(filePath)) return fsCache.get(filePath);

  try {
    await fs.promises.access(filePath);
    fsCache.set(filePath, true);
    return true;
  } catch {
    fsCache.set(filePath, false);
    return false;
  }
}

/**
 * Retrieve the application's version.
 * @returns {Promise<string>}
 */
async function getAppVersion() {
  try {
    return app.getVersion();
  } catch (error) {
    log.error("Error getting app version:", error);
    return "unknown";
  }
}

if (!app.requestSingleInstanceLock()) {
  app.quit();
} else {
  mediaOpenService.enqueueArgv(process.argv, process.cwd());
  const dependencies = {
    mainWindow: null,
    store,
    downloadState: {
      downloadPath,
      downloadInProgress: false,
    },
    previewCacheDir,
    getAppVersion,
    setDownloadPath: (newPath) => {
      try {
        downloadPath = newPath;
        store.set("downloadPath", newPath);
        app.emit("thunder-load:tray-refresh");
        // keep runtime state in sync
        dependencies.downloadState.downloadPath = newPath;

        // notify renderer about the change (for UI updates)
        if (mainWindow && mainWindow.webContents) {
          try {
            mainWindow.webContents.send("download-path-changed", newPath);
          } catch (e) {
            log.error("Failed to send 'download-path-changed':", e);
          }
        }

        log.info(`Download path updated to: ${newPath}`);
      } catch (e) {
        log.error("Error updating download path:", e);
      }
    },
    historyFilePath,
    fsCache,
    iconCache,
    clipboardMonitor: null, // будет установлен позже
    setupGlobalShortcuts,
    notifyDownloadError,
    sendDownloadCompletionNotification,
    showTrayNotification,
    webControlServer: null,
    dispatchPendingWhatsNew: () => false,
    clearPendingWhatsNewVersion: () => false,
    mediaOpenService,
    diagnosticsLogger,
  };

  const getPendingWhatsNewVersion = () =>
    store.get(WHATS_NEW_PENDING_KEY, null);

  function setPendingWhatsNewVersion(version) {
    if (!version) return;
    store.set(WHATS_NEW_PENDING_KEY, version);
  }

  function clearPendingWhatsNewVersion(version) {
    const pending = getPendingWhatsNewVersion();
    if (!pending) return false;
    if (version && pending !== version) return false;
    store.delete(WHATS_NEW_PENDING_KEY);
    log.info(`[WhatsNew] Cleared pending version ${pending}`);
    return true;
  }

  function dispatchPendingWhatsNew() {
    const pending = getPendingWhatsNewVersion();
    if (!pending) return false;
    if (!mainWindow || mainWindow.isDestroyed()) return false;
    try {
      mainWindow.webContents.send("show-whats-new", pending);
      log.info(`[WhatsNew] Display request dispatched for version ${pending}`);
      return true;
    } catch (error) {
      log.error("[WhatsNew] Failed to dispatch modal:", error);
      return false;
    }
  }

  dependencies.dispatchPendingWhatsNew = dispatchPendingWhatsNew;
  dependencies.clearPendingWhatsNewVersion = clearPendingWhatsNewVersion;

  /**
   * Проверяет, была ли обновлена версия приложения, и показывает модальное окно "Что нового?", если да.
   */
  async function checkAndShowWhatsNew() {
    try {
      const currentVersion = await getAppVersion();
      const lastRecordedVersion = store.get("appVersion", null);
      const pendingVersion = getPendingWhatsNewVersion();

      if (lastRecordedVersion !== currentVersion) {
        log.info(
          "The application version has been updated. Queuing the 'What's New' modal.",
        );
        store.set("appVersion", currentVersion);
        setPendingWhatsNewVersion(currentVersion);
      } else if (pendingVersion && pendingVersion !== currentVersion) {
        // Зафиксирована устаревшая отложенная версия → обновляем её на актуальную
        setPendingWhatsNewVersion(currentVersion);
      }

      dispatchPendingWhatsNew();
    } catch (error) {
      log.error(
        "Error checking the version and queuing the 'What's New' modal:",
        error,
      );
    }
  }

  /**
   * Initialize clipboard monitor instance and start it if enabled.
   */
  function initializeClipboardMonitor() {
    clipboardMonitorInstance = new ClipboardMonitor(
      store,
      mainWindow,
      isValidUrl,
      isSupportedUrl,
    );
    dependencies.clipboardMonitor = clipboardMonitorInstance;

    if (store.get("openOnCopyUrl", false)) {
      clipboardMonitorInstance.start();
    }
  }

  /**
   * Restore download path from localStorage if available.
   */
  async function restoreDownloadPath() {
    try {
      const hasDownloadPath =
        typeof downloadPath === "string" && downloadPath.trim() !== "";

      if (!hasDownloadPath && mainWindow && mainWindow.webContents) {
        // One-time migrate from localStorage when store didn't provide a value.
        const savedLSPath = await mainWindow.webContents.executeJavaScript(
          `window.localStorage.getItem('downloadPath')`,
        );
        if (typeof savedLSPath === "string" && savedLSPath.trim() !== "") {
          downloadPath = savedLSPath;
          dependencies.downloadState.downloadPath = savedLSPath;
          store.set("downloadPath", savedLSPath);
        }
      }

      // Notify renderer about the effective path so UI can refresh labels, etc.
      if (mainWindow && mainWindow.webContents) {
        mainWindow.webContents.send("download-path-changed", downloadPath);
      }
      app.emit("thunder-load:tray-refresh");

      log.info(`Загрузчик → Путь загрузки восстановлен: ${downloadPath}`);
    } catch (error) {
      log.error("Загрузчик → Ошибка восстановления пути загрузки:", error);
    }
  }

  /**
   * Initialize mainWindow events.
   */
  function initializeMainWindowEvents() {
    mainWindow.webContents.on("did-finish-load", async () => {
      startupMetrics.mark("renderer finished load");
      try {
        await restoreDownloadPath();

        const version = await getAppVersion();
        mainWindow.webContents.send("app-version", version);

        await checkAndShowWhatsNew();
      } catch (error) {
        log.error("Ошибка в did-finish-load:", error);
      }
    });
  }

  /**
   * Main function to initialize the application.
   */
  async function main() {
    if (ipcRuntime) {
      await ipcRuntime.dispose();
      ipcRuntime = null;
    }
    clipboardMonitorInstance?.stop();
    if (webControlServer) await webControlServer.dispose();
    // Ensure downloadPath is loaded from electron-store before window creation
    try {
      const savedStorePathAtStartup = store.get("downloadPath", "");
      if (
        typeof savedStorePathAtStartup === "string" &&
        savedStorePathAtStartup.trim() !== ""
      ) {
        downloadPath = savedStorePathAtStartup;
        dependencies.downloadState.downloadPath = savedStorePathAtStartup;
      }
    } catch (e) {
      log.error("Failed to preload download path from store:", e);
    }
    // Create the main application window
    mainWindow = startupMetrics.measure("create main window", () =>
      createWindow(
        isDev,
        app,
        store,
        downloadPath,
        getAppVersion,
        ytDlpPath,
        ffmpegPath,
        ffprobePath,
        fileExists,
        () => {
          const activeDownloads = dependencies.downloadState.activeDownloads;
          return Boolean(
            dependencies.downloadState.downloadInProgress ||
            (activeDownloads && activeDownloads.size > 0),
          );
        },
      ),
    );
    mediaOpenService.setMainWindow(mainWindow);

    // DevTools noticeably increase GPU usage; keep them closed in production
    if (isDev || process.env.OPEN_DEVTOOLS === "1") {
      mainWindow.webContents.openDevTools({ mode: "detach" });
    }

    dependencies.mainWindow = mainWindow;
    webControlServer = createWebControlServer({
      appPath: app.getAppPath(),
      store,
      diagnosticsLogger,
    });
    webControlServer.setMainWindow(mainWindow);
    dependencies.webControlServer = webControlServer;

    ipcRuntime = startupMetrics.measure("setup IPC handlers", () =>
      setupIpcHandlers(dependencies),
    );

    try {
      await webControlServer.startIfEnabled();
    } catch (error) {
      log.warn("Failed to start web control server:", error);
    }

    // Register updater events now, but delay network checks until the first UI is ready.
    startupMetrics.measure("setup auto updater", () =>
      setupAutoUpdater(mainWindow),
    );
    scheduleAutoUpdateCheck(mainWindow);

    // Setup global shortcuts
    startupMetrics.measure("setup global shortcuts", () =>
      setupGlobalShortcuts(mainWindow),
    );

    // Initialize clipboard monitor
    initializeClipboardMonitor();

    startupMetrics.mark("main window created and IPC ready");
    // Setup mainWindow events
    initializeMainWindowEvents();
  }

  /**
   * Handle second instance lock.
   */
  app.on("second-instance", (_event, argv, workingDirectory) => {
    mediaOpenService.enqueueArgv(argv, workingDirectory);
    if (mainWindow) {
      if (mainWindow.isMinimized()) mainWindow.restore();
      mainWindow.show();
      mainWindow.focus();
    }
  });

  /**
   * Initialize the app when ready.
   */
  app.whenReady().then(() => {
    main().catch((error) => {
      log.error("Error during main initialization:", error);
    });
  });

  /**
   * Re-create a window in the app when dock icon is clicked (macOS).
   */
  app.on("activate", () => {
    if (BrowserWindow.getAllWindows().length === 0) main();
  });

  /**
   * Quit the app when all windows are closed, except on macOS.
   */
  app.on("window-all-closed", () => {
    if (process.platform !== "darwin") app.quit();
  });

  /**
   * Prevent opening new windows from links by denying window.open.
   */
  app.on("web-contents-created", (event, contents) => {
    contents.setWindowOpenHandler(() => {
      return { action: "deny" };
    });
  });
}

/**
 * Clean up resources before quitting.
 */
let shutdownCompleted = false;
shutdownCoordinator.register("application-runtime", async () => {
  clipboardMonitorInstance?.stop?.();
  disposeGlobalShortcuts();
  disposeAutoUpdater();
  await ipcRuntime?.dispose?.();
  ipcRuntime = null;
  await processSupervisor.terminateAll("app-shutdown");
  await webControlServer?.dispose?.();
  mediaOpenService.dispose();
  fsCache.clear();
  iconCache.clear();
  app.isQuitting = true;
  store.set("isCloseNotificationShown", false);
});

app.on("before-quit", (event) => {
  mainLogger.info("app-before-quit", { shutdownCompleted });
  if (shutdownCompleted) return;
  event.preventDefault();
  void shutdownCoordinator.stop().finally(() => {
    shutdownCompleted = true;
    mainLogger.info("shutdown-completed-requesting-quit");
    setImmediate(() => app.quit());
  });
});

module.exports = {
  mainWindow,
};
