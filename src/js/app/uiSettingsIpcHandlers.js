// src/js/app/uiSettingsIpcHandlers.js

const { CHANNELS } = require("../ipc/channels");

function registerUiSettingsIpcHandlers({ ipcMain, mainWindow, store }) {
  ipcMain.handle(CHANNELS.GET_DEFAULT_TAB, () =>
    store.get("defaultTab", "download"),
  );

  ipcMain.handle(CHANNELS.SET_DEFAULT_TAB, (_, tabId) =>
    store.set("defaultTab", tabId),
  );

  ipcMain.handle(CHANNELS.GET_PLATFORM_INFO, () => {
    console.log("get-platform-info handler registered");
    return { isMac: process.platform === "darwin" };
  });

  ipcMain.handle(CHANNELS.GET_THEME, () => {
    return store.get("theme", "system");
  });

  ipcMain.handle(CHANNELS.SET_THEME, (event, theme) => {
    store.set("theme", theme);
    return { success: true };
  });

  ipcMain.handle(
    CHANNELS.TOAST,
    (event, message, type = "success", options = {}) => {
      if (mainWindow && mainWindow.webContents) {
        mainWindow.webContents.send("toast", message, type, options);
      }
    },
  );

  ipcMain.handle(CHANNELS.GET_FONT_SIZE, () => {
    return store.get("fontSize", "16px");
  });

  ipcMain.handle(CHANNELS.SET_FONT_SIZE, (event, fontSize) => {
    store.set("fontSize", fontSize);
    return { success: true };
  });
}

module.exports = {
  registerUiSettingsIpcHandlers,
};
