// autoUpdater.js (src/js/app/autoUpdater.js)

const { autoUpdater } = require("electron-updater");
const log = require("electron-log");
const { Notification, app } = require("electron");
const { resolveIconPathFromApp } = require("./iconPaths");

const isMac = process.platform === "darwin";
const iconPath = resolveIconPathFromApp(
  app,
  isMac ? "APP_ICON_ICNS" : "APP_ICON_ICO",
);

let updaterWindow = null;
let eventsRegistered = false;
let scheduledCheckTimer = null;
let cancelScheduledCheck = null;

const DEFAULT_AUTO_UPDATE_CHECK_DELAY_MS = 3000;
const DEFAULT_AUTO_UPDATE_READY_FALLBACK_MS = 10000;

function sendToUpdaterWindow(channel, ...args) {
  try {
    if (!updaterWindow || updaterWindow.isDestroyed?.()) return;
    updaterWindow.webContents.send(channel, ...args);
  } catch (error) {
    log.warn(`Failed to send updater event "${channel}":`, error);
  }
}

function setupAutoUpdater(mainWindow) {
  updaterWindow = mainWindow;

  if (isMac) {
    log.info("Application auto-updates are disabled on macOS.");
    return;
  }

  // Настройка логирования
  autoUpdater.logger = log;
  autoUpdater.logger.transports.file.level = "info";

  // Отключение автоматической загрузки обновлений
  autoUpdater.autoDownload = false;

  if (eventsRegistered) return;
  eventsRegistered = true;

  // Обработчик события при проверке обновлений
  autoUpdater.on("checking-for-update", () => {
    sendToUpdaterWindow("update-message", "Проверка обновлений...");
  });

  // Обработчик события, когда обновление доступно
  autoUpdater.on("update-available", (info) => {
    const message = "Доступно новое обновление. Хотите загрузить его сейчас?";
    sendToUpdaterWindow("update-available", message);
    try {
      sendToUpdaterWindow("update-available-info", {
        current: app.getVersion(),
        next: info?.version || null,
      });
    } catch {}

    if (Notification.isSupported()) {
      new Notification({
        title: "Thunder - Обновление доступно",
        body: message,
        icon: iconPath,
      }).show();
    }
  });

  // Обработчик события, когда обновление не доступно
  autoUpdater.on("update-not-available", (_info) => {
    sendToUpdaterWindow("update-message", "Обновлений не найдено.");
  });

  // Обработчик ошибок автообновления
  autoUpdater.on("error", (err) => {
    const errorMessage = err.message || "Неизвестная ошибка";
    sendToUpdaterWindow("update-error", errorMessage);
    if (Notification.isSupported()) {
      new Notification({
        title: "Ошибка автообновления",
        body: "Произошла ошибка при проверке обновлений. Пожалуйста, попробуйте позже.",
        icon: iconPath,
      }).show();
    } else {
      log.warn("Системные уведомления не поддерживаются на этом устройстве.");
    }
  });

  // Обработчик прогресса загрузки обновления
  autoUpdater.on("download-progress", (progressObj) => {
    sendToUpdaterWindow("update-progress", progressObj);
  });

  // Обработчик события, когда обновление загружено
  autoUpdater.on("update-downloaded", () => {
    sendToUpdaterWindow("update-downloaded");
  });
}

function checkForUpdatesNow() {
  if (isMac) return null;
  return autoUpdater.checkForUpdates();
}

function scheduleAutoUpdateCheck(
  mainWindow = updaterWindow,
  {
    delayMs = DEFAULT_AUTO_UPDATE_CHECK_DELAY_MS,
    readyFallbackMs = DEFAULT_AUTO_UPDATE_READY_FALLBACK_MS,
  } = {},
) {
  if (isMac) return;
  if (!mainWindow) return;

  if (scheduledCheckTimer) {
    clearTimeout(scheduledCheckTimer);
    scheduledCheckTimer = null;
  }
  if (typeof cancelScheduledCheck === "function") {
    cancelScheduledCheck();
    cancelScheduledCheck = null;
  }

  let cancelled = false;
  let scheduled = false;
  let readyFallbackTimer = null;

  const scheduleCheck = () => {
    if (cancelled || scheduled) return;
    scheduled = true;
    if (readyFallbackTimer) {
      clearTimeout(readyFallbackTimer);
      readyFallbackTimer = null;
    }
    scheduledCheckTimer = setTimeout(() => {
      scheduledCheckTimer = null;
      cancelScheduledCheck = null;
      if (cancelled) return;
      if (mainWindow?.isDestroyed?.()) return;
      try {
        checkForUpdatesNow();
      } catch (error) {
        log.error("Delayed auto update check failed:", error);
      }
    }, delayMs);
  };

  cancelScheduledCheck = () => {
    cancelled = true;
    if (readyFallbackTimer) {
      clearTimeout(readyFallbackTimer);
      readyFallbackTimer = null;
    }
  };

  if (mainWindow?.webContents?.isLoading?.() === false) {
    scheduleCheck();
    return;
  }

  mainWindow?.once?.("ready-to-show", scheduleCheck);
  readyFallbackTimer = setTimeout(scheduleCheck, readyFallbackMs);
}

function disposeAutoUpdater() {
  if (scheduledCheckTimer) clearTimeout(scheduledCheckTimer);
  scheduledCheckTimer = null;
  if (typeof cancelScheduledCheck === "function") cancelScheduledCheck();
  cancelScheduledCheck = null;
  updaterWindow = null;
}

module.exports = {
  checkForUpdatesNow,
  disposeAutoUpdater,
  scheduleAutoUpdateCheck,
  setupAutoUpdater,
};
