// autoUpdater.js (src/js/app/autoUpdater.js)

const { autoUpdater } = require("electron-updater");
const log = require("electron-log");
const path = require("path");
const { ipcMain, Notification } = require("electron");

const isMac = process.platform === "darwin";
const iconPath = path.resolve(
  __dirname,
  isMac
    ? "../../../assets/icons/macOS/icon.icns"
    : "../../../assets/icons/icon.ico",
);

function setupAutoUpdater(mainWindow) {
  // Настройка логирования
  autoUpdater.logger = log;
  autoUpdater.logger.transports.file.level = "info";

  // Отключение автоматической загрузки обновлений
  autoUpdater.autoDownload = false;

  // Обработчик события при проверке обновлений
  autoUpdater.on("checking-for-update", () => {
    mainWindow.webContents.send("update-message", "Проверка обновлений...");
  });

  // Обработчик события, когда обновление доступно
  autoUpdater.on("update-available", (info) => {
    const message = "Доступно новое обновление. Хотите загрузить его сейчас?";
    mainWindow.webContents.send("update-available", message);

    if (Notification.isSupported()) {
      new Notification({
        title: "Thunder Load - Обновление доступно",
        body: message,
        icon: iconPath,
      }).show();
    }
  });

  // Обработчик события, когда обновление не доступно
  autoUpdater.on("update-not-available", (info) => {
    mainWindow.webContents.send("update-message", "Обновлений не найдено.");
  });

  // Обработчик ошибок автообновления
  autoUpdater.on("error", (err) => {
    const errorMessage = err.message || "Неизвестная ошибка";
    mainWindow.webContents.send("update-error", errorMessage);
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
    const percent = progressObj.percent;
    mainWindow.webContents.send("update-progress", percent);
  });

  // Обработчик события, когда обновление загружено
  autoUpdater.on("update-downloaded", () => {
    mainWindow.webContents.send("update-downloaded");
  });

  // Начало проверки обновлений
  autoUpdater.checkForUpdates();
}

module.exports = {
  setupAutoUpdater,
};
