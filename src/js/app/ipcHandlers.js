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
const { getToolsVersions } = require("./toolsVersions");
const fs = require("fs");
const Store = require("electron-store");
const store = new Store();
const fsPromises = fs.promises;
const path = require("path");
const log = require("electron-log");
const {
  installYtDlp,
  installFfmpeg,
  getVideoInfo,
  downloadMedia,
  stopDownload,
  resetDownloadCancelledFlag,
  selectFormatsByQuality,
  isDownloadCancelled,
} = require("../scripts/download.js");
const { isValidUrl, isSupportedUrl } = require("./utils.js");
console.log("📡 ipcHandlers loaded");
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
  const isInside =
    relative && !relative.startsWith("..") && !path.isAbsolute(relative);

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
  console.log("✅ setupIpcHandlers called"); // ← должен появиться в devtools (main)
  const {
    mainWindow,
    store,
    downloadState,
    getAppVersion,
    setDownloadPath,
    historyFilePath,
    fsCache,
    iconCache,
    clipboardMonitor,
    setupGlobalShortcuts,
    notifyDownloadError,
    sendDownloadCompletionNotification,
    showTrayNotification,
  } = dependencies;

  ipcMain.handle("get-default-tab", () => store.get("defaultTab", "download"));
  ipcMain.handle("set-default-tab", (_, tabId) =>
    store.set("defaultTab", tabId),
  );

  ipcMain.handle("get-whats-new", async (event) => {
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

  ipcMain.handle("tools:getVersions", () => {
    return getToolsVersions();
  });

  ipcMain.handle("tools:showInFolder", async (_evt, filePath) => {
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

  ipcMain.handle("get-platform-info", () => {
    console.log("📡 get-platform-info handler registered");
    return { isMac: process.platform === "darwin" };
  });

  // Обработчики IPC для темы
  ipcMain.handle("get-theme", () => {
    return store.get("theme", "light"); // 'light' - тема по умолчанию
  });

  ipcMain.handle("set-theme", (event, theme) => {
    store.set("theme", theme);
    return { success: true };
  });

  ipcMain.handle("toast", (event, message, type = "success") => {
    if (mainWindow && mainWindow.webContents) {
      mainWindow.webContents.send("toast", message, type);
    }
  });

  // Обработчики IPC для размера шрифта
  ipcMain.handle("get-font-size", () => {
    return store.get("fontSize", "16px"); // '16px' - размер по умолчанию
  });

  ipcMain.handle("set-font-size", (event, fontSize) => {
    store.set("fontSize", fontSize);
    return { success: true };
  });

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
      await installYtDlp();
      checkIfCancelled("installYtDlp");

      await installFfmpeg();
      checkIfCancelled("installFfmpeg");

      const videoInfo = await getVideoInfo(url);
      checkIfCancelled("getVideoInfo");

      const formats = videoInfo.formats;
      const title = videoInfo.title.replace(/[\\/:*?"<>|]/g, "");

      // Используем функцию selectFormatsByQuality
      const selectedFormats = selectFormatsByQuality(formats, quality);

      const videoFormat = selectedFormats.videoFormat;
      const audioFormat = selectedFormats.audioFormat;
      const audioExt = selectedFormats.audioExt;

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
  ipcMain.handle("open-terminal", async () => {
    const { exec } = require("child_process");
    exec("open -a Terminal");
  });

  ipcMain.handle("open-config-folder", () => {
    const folderPath = app.getPath("userData");
    shell.openPath(folderPath);
  });

  // Обработка запроса на загрузку обновления из рендер-процесса
  ipcMain.handle("download-update", async () => {
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
  ipcMain.handle("restart-app", async () => {
    try {
      log.info("Запрос на перезапуск приложения получен.");
      autoUpdater.quitAndInstall();
      return { success: true };
    } catch (error) {
      log.error("Ошибка при перезапуске приложения:", error);
      return { success: false, error: error.message };
    }
  });

  ipcMain.handle("check-file-exists", async (event, filePath) => {
    try {
      await fsPromises.access(filePath);
      return true;
    } catch (error) {
      log.warn(`The file does not exist: ${filePath}`);
      return false;
    }
  });

  ipcMain.handle("get-disable-complete-modal-status", () =>
    store.get("disableCompleteModal", true),
  );

  ipcMain.handle("set-disable-complete-modal-status", (_, enabled) =>
    store.set("disableCompleteModal", enabled),
  );

  /**
   * Обработчик для удаления файла
   */
  ipcMain.handle("delete-file", async (event, filePath) => {
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

  ipcMain.handle("select-download-folder", async () => {
    const result = await dialog.showOpenDialog(mainWindow, {
      properties: ["openDirectory"],
    });
    if (!result.canceled && result.filePaths.length > 0) {
      const selectedPath = result.filePaths[0];
      try {
        const stats = await fs.promises.stat(selectedPath);
        if (stats.isDirectory()) {
          setDownloadPath(selectedPath);
          store.set("downloadPath", selectedPath); // Сохраняем путь в store
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

  ipcMain.handle("download-video", async (event, url, quality) => {
    if (downloadState.downloadInProgress) {
      throw new Error("Загрузка уже выполняется");
    }

    if (!isValidUrl(url) || !isSupportedUrl(url)) {
      throw new Error("Недопустимый или неподдерживаемый URL");
    }

    downloadState.downloadInProgress = true;
    try {
      const result = await startDownloadProcess(event, url, quality);
      downloadState.downloadInProgress = false;
      return { ...result, sourceUrl: url };
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

  ipcMain.handle("stop-download", async () => {
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

  ipcMain.handle("set-download-path", async (event, path) => {
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

  ipcMain.handle("load-history", async () => {
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

  ipcMain.handle("save-history", async (event, history) => {
    try {
      const historyJson = JSON.stringify(history, null, 2);
      await fs.promises.writeFile(historyFilePath, historyJson, "utf8");
    } catch (error) {
      log.error(`Error saving history: ${error}`);
    }
  });

  ipcMain.handle("clear-history", async () => {
    try {
      await fs.promises.writeFile(historyFilePath, JSON.stringify([]), "utf-8");
      return true;
    } catch (error) {
      log.error(`Error clearing history: ${error}`);
      throw error;
    }
  });

  ipcMain.handle("get-file-size", async (event, filePath) => {
    try {
      const stats = await fs.promises.stat(filePath);
      return stats.size;
    } catch (error) {
      log.error("Ошибка при получении размера файла:", error);
      return null;
    }
  });

  ipcMain.handle("get-version", async () => {
    try {
      return await getAppVersion();
    } catch (error) {
      log.error("Error getting app version:", error);
      return "unknown";
    }
  });

  ipcMain.handle("get-download-count", async () => {
    try {
      if (!fs.existsSync(historyFilePath)) return 0;
      const historyData = await fs.promises.readFile(historyFilePath, "utf8");
      return JSON.parse(historyData).length;
    } catch (error) {
      log.error("Error getting download count:", error);
      throw error;
    }
  });

  const { shell } = require("electron");

  ipcMain.handle("open-download-folder", async (event, filePath) => {
    if (!filePath || typeof filePath !== "string")
      throw new TypeError('The "path" argument must be of type string.');

    log.info("Showing file in folder:", filePath);

    if (fs.existsSync(filePath)) {
      shell.showItemInFolder(filePath);
    } else {
      throw new Error("Файл не существует");
    }
  });

  ipcMain.handle("get-icon-path", async (event, url) => {
    const iconName = getIconNameFromUrl(url);
    return await getAppIconPath(iconName);
  });

  ipcMain.handle("open-external-link", async (event, url) => {
    log.info("Opening external link:", url);
    try {
      if (!isValidUrl(url)) throw new Error("Invalid URL");

      const parsedUrl = new URL(url);
      if (!["http:", "https:"].includes(parsedUrl.protocol)) {
        throw new Error("Invalid or unsupported URL protocol");
      }

      await shell.openExternal(url);
      return { success: true };
    } catch (error) {
      log.error("Error opening external link:", error);
      return { success: false, error: error.message };
    }
  });

  ipcMain.handle("open-last-video", async (event, filePath) => {
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

  ipcMain.handle("toggle-auto-launch", async (event, enable) => {
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

  ipcMain.handle("set-minimize-on-launch-status", (_, enabled) => {
    store.set("minimizeOnLaunch", enabled);
    return true; // ← нужно!
  });

  ipcMain.handle("get-minimize-on-launch-status", () => {
    return store.get("minimizeOnLaunch", false);
  });

  ipcMain.handle("set-minimize-instead-of-close", async (event, minimize) => {
    store.set("minimizeInsteadOfClose", minimize);
    showTrayNotification(
      minimize
        ? "Приложение теперь будет сворачиваться в трей при закрытии."
        : "Приложение теперь будет полностью закрываться.",
    );
  });

  ipcMain.handle("get-auto-launch-status", async () => {
    try {
      const isEnabled = isAutoLaunchEnabled();
      return isEnabled;
    } catch (error) {
      log.error("Ошибка при получении состояния автозапуска:", error);
      return false;
    }
  });

  ipcMain.handle("set-minimize-to-tray-status", async (event, enable) => {
    store.set("minimizeToTray", enable);
  });

  ipcMain.handle("get-minimize-to-tray-status", async () => {
    return store.get("minimizeToTray", false);
  });

  ipcMain.handle("set-close-notification-status", async (event, enable) => {
    store.set("closeNotification", enable);
  });

  ipcMain.handle("get-close-notification-status", async () => {
    return store.get("closeNotification", true);
  });

  ipcMain.handle(
    "set-open-on-download-complete-status",
    async (event, enable) => {
      store.set("expandWindowOnDownloadComplete", enable);
    },
  );

  ipcMain.handle("get-open-on-download-complete-status", async () => {
    return store.get("expandWindowOnDownloadComplete", false);
  });

  ipcMain.handle("set-open-on-copy-url-status", async (event, enabled) => {
    store.set("openOnCopyUrl", enabled);
    if (clipboardMonitor) {
      enabled ? clipboardMonitor.start() : clipboardMonitor.stop();
    } else {
      log.warn("clipboardMonitor не инициализирован");
    }
  });

  ipcMain.handle("get-open-on-copy-url-status", async () => {
    return store.get("openOnCopyUrl", false);
  });

  ipcMain.handle("get-disable-global-shortcuts-status", () => {
    const isEnabled = store.get("disableGlobalShortcuts", false);
    return isEnabled;
  });

  ipcMain.handle("set-disable-global-shortcuts-status", (event, enable) => {
    store.set("disableGlobalShortcuts", enable);
    if (enable) {
      globalShortcut.unregisterAll();
      log.info("Global hotkeys are disabled.");
    } else {
      setupGlobalShortcuts(mainWindow);
      log.info("Global hotkeys are enabled.");
    }
  });

  ipcMain.handle("show-system-notification", async (event, { title, body }) => {
    if (Notification.isSupported()) {
      new Notification({ title, body }).show();
    } else {
      console.error(
        "Системные уведомления не поддерживаются на этом устройстве.",
      );
    }
  });

  ipcMain.handle("get-minimize-instead-of-close-status", async () => {
    return store.get("minimizeInsteadOfClose", false);
  });
}

module.exports = { setupIpcHandlers };
