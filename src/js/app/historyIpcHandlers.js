// src/js/app/historyIpcHandlers.js

const fs = require("fs");
const fsPromises = fs.promises;
const log = require("electron-log");
const { CHANNELS } = require("../ipc/channels");

function emitHistoryUpdated(mainWindow, count) {
  try {
    mainWindow?.webContents?.send("history-updated", { count });
  } catch (e) {
    log.warn("history-updated emit failed:", e);
  }
}

function registerHistoryIpcHandlers({
  ipcMain,
  ensurePreviewCacheDir,
  historyFilePath,
  mainWindow,
  previewDirPath,
}) {
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
      const count = Array.isArray(history) ? history.length : 0;
      emitHistoryUpdated(mainWindow, count);
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
      emitHistoryUpdated(mainWindow, 0);
      return true;
    } catch (error) {
      log.error(`Error clearing history: ${error}`);
      throw error;
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
}

module.exports = {
  registerHistoryIpcHandlers,
  __test: {
    emitHistoryUpdated,
  },
};
