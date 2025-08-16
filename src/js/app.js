// src/js/app.js

const path = require("path");
const fs = require("fs");

const Store = require("electron-store");
const log = require("electron-log");

const { app, BrowserWindow, dialog } = require("electron");

const { createWindow } = require("./app/window.js");
const { setupIpcHandlers } = require("./app/ipcHandlers.js");
require("./app/wgunlock.js"); // регистрируем UDP и настройки WG Unlock
const {
  showTrayNotification,
  notifyDownloadError,
  sendDownloadCompletionNotification,
} = require("./app/notifications.js");
const ClipboardMonitor = require("./app/clipboardMonitor.js");
const { isValidUrl, isSupportedUrl } = require("./app/utils.js");
const { setupAutoUpdater } = require("./app/autoUpdater.js");
const { setupGlobalShortcuts } = require("./app/shortcuts.js");

// Initialize store and logging
const store = new Store();
const isDev = process.argv.includes("--dev");

// Set application user model ID (for Windows notifications)
app.setAppUserModelId("Thunderload");

// Define essential paths
const historyFilePath = path.join(
  app.getPath("userData"),
  "download_history.json",
);
let downloadPath = path.join(app.getPath("videos"), "Download");

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

log.info("App starting...");

let mainWindow;
let clipboardMonitorInstance;

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
  dialog.showErrorBox(
    "Приложение уже запущено",
    "Вы не можете открыть несколько копий приложения одновременно.",
  );
  app.quit();
} else {
  const dependencies = {
    mainWindow: null,
    store,
    downloadState: {
      downloadPath,
      downloadInProgress: false,
    },
    getAppVersion,
    setDownloadPath: (newPath) => {
      try {
        downloadPath = newPath;
        store.set("downloadPath", newPath);
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
  };

  /**
   * Проверяет, была ли обновлена версия приложения, и показывает модальное окно "Что нового?", если да.
   */
  async function checkAndShowWhatsNew() {
    try {
      const currentVersion = await getAppVersion();
      const appVersion = store.get("appVersion", null);

      log.info(`The current version of the application: ${currentVersion}`);
      // log.info(`The last saved version: ${appVersion}`);

      if (appVersion !== currentVersion) {
        log.info(
          "The application version has been updated. Displaying the modal window 'Version'.",
        );

        // Обновляем сохранённую версию
        store.set("appVersion", currentVersion);
        log.info(`appVersion has been updated to: ${currentVersion}`);

        // Отправляем сообщение рендер-процессу для отображения модального окна
        if (mainWindow && mainWindow.webContents) {
          try {
            mainWindow.webContents.send("show-whats-new", currentVersion);
            log.info(
              "The 'show-whats-new' message has been sent to the render process.",
            );
          } catch (error) {
            log.error("Error sending the 'show-whats-new' message:", error);
          }
        }
      } else {
        log.info("The version of the application has not changed.");
      }
    } catch (error) {
      log.error(
        "Error checking the version and showing the modal window:",
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
      // 1) Prefer value from electron-store
      const savedStorePath = store.get("downloadPath", "");
      if (typeof savedStorePath === "string" && savedStorePath.trim() !== "") {
        downloadPath = savedStorePath;
        dependencies.downloadState.downloadPath = savedStorePath;
      } else if (mainWindow && mainWindow.webContents) {
        // 2) (One-time) migrate from localStorage if present
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

      log.info(`Download path restored: ${downloadPath}`);
    } catch (error) {
      log.error("Error restoring download path:", error);
    }
  }

  /**
   * Initialize mainWindow events.
   */
  function initializeMainWindowEvents() {
    mainWindow.webContents.on("did-finish-load", async () => {
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
  console.log("🧩 main() start");
  async function main() {
    console.log("🧪 calling createWindow");
    // Ensure downloadPath is loaded from electron-store before window creation
    try {
      const savedStorePathAtStartup = store.get("downloadPath", "");
      if (
        typeof savedStorePathAtStartup === "string" &&
        savedStorePathAtStartup.trim() !== ""
      ) {
        downloadPath = savedStorePathAtStartup;
        dependencies.downloadState.downloadPath = savedStorePathAtStartup;
        log.info(
          `Startup download path from store: ${savedStorePathAtStartup}`,
        );
      }
    } catch (e) {
      log.error("Failed to preload download path from store:", e);
    }
    // Create the main application window
    mainWindow = createWindow(
      isDev,
      app,
      store,
      downloadPath,
      getAppVersion,
      ytDlpPath,
      ffmpegPath,
      ffprobePath,
      fileExists,
    );

    mainWindow.webContents.openDevTools({ mode: "detach" }); // 👈 добавь эту строку

    dependencies.mainWindow = mainWindow;

    // Перемещённый вызов setupIpcHandlers
    console.log("🛠 calling setupIpcHandlers");
    setupIpcHandlers(dependencies);

    // Setup auto updater
    setupAutoUpdater(mainWindow);

    // Setup global shortcuts
    setupGlobalShortcuts(mainWindow);

    // Initialize clipboard monitor
    initializeClipboardMonitor();

    // Setup mainWindow events
    initializeMainWindowEvents();
  }

  /**
   * Handle second instance lock.
   */
  app.on("second-instance", () => {
    if (mainWindow) {
      if (mainWindow.isMinimized()) mainWindow.restore();
      mainWindow.focus();
      mainWindow.webContents.send(
        "show-warning",
        "Вы не можете открыть несколько копий приложения одновременно.",
      );
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
app.on("before-quit", () => {
  fsCache.clear();
  iconCache.clear();
  app.isQuiting = true;

  // Reset the notification flag
  store.set("isCloseNotificationShown", false);

  // Stop clipboard monitoring
  if (clipboardMonitorInstance) {
    clipboardMonitorInstance.stop();
  }
});

module.exports = {
  mainWindow,
};
