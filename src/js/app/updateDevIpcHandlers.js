// src/js/app/updateDevIpcHandlers.js

const { CHANNELS } = require("../ipc/channels");

function registerUpdateDevIpcHandlers({ ipcMain, mainWindow, getAppVersion }) {
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
}

module.exports = {
  registerUpdateDevIpcHandlers,
};
