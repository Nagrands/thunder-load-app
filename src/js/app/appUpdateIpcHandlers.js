// src/js/app/appUpdateIpcHandlers.js

const log = require("electron-log");
const { CHANNELS } = require("../ipc/channels");

function registerAppUpdateIpcHandlers({
  ipcMain,
  autoUpdater,
  platform = process.platform,
}) {
  const updatesSupported = platform !== "darwin";
  const unsupportedResult = () => ({
    success: false,
    unsupported: true,
    error: "Application updates are disabled on macOS",
  });

  ipcMain.handle(CHANNELS.CHECK_APP_UPDATES, async () => {
    if (!updatesSupported) return unsupportedResult();
    try {
      log.info("Запрос на ручную проверку обновлений получен.");
      autoUpdater.checkForUpdates();
      return { success: true };
    } catch (error) {
      log.error("Ошибка при ручной проверке обновлений:", error);
      return { success: false, error: error.message };
    }
  });

  ipcMain.handle(CHANNELS.DOWNLOAD_UPDATE, async () => {
    if (!updatesSupported) return unsupportedResult();
    try {
      log.info("Запрос на загрузку обновления получен.");
      autoUpdater.downloadUpdate();
      return { success: true };
    } catch (error) {
      log.error("Ошибка при загрузке обновления:", error);
      return { success: false, error: error.message };
    }
  });

  ipcMain.handle(CHANNELS.RESTART_APP, async () => {
    if (!updatesSupported) return unsupportedResult();
    try {
      log.info("Запрос на перезапуск приложения получен.");
      autoUpdater.quitAndInstall();
      return { success: true };
    } catch (error) {
      log.error("Ошибка при перезапуске приложения:", error);
      return { success: false, error: error.message };
    }
  });
}

module.exports = {
  registerAppUpdateIpcHandlers,
};
