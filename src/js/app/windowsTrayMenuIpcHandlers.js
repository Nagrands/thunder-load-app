"use strict";

const { CHANNELS } = require("../ipc/channels");

function registerWindowsTrayMenuIpcHandlers({ ipcMain, controller }) {
  const isAllowed = (event) => controller?.ownsWebContents?.(event?.sender);

  ipcMain.handle(CHANNELS.WINDOWS_TRAY_MENU_GET_STATE, async (event) => {
    if (!isAllowed(event)) {
      return { success: false, error: "UNAUTHORIZED_TRAY_REQUEST" };
    }
    return { success: true, data: controller.getSafeState() };
  });

  ipcMain.handle(CHANNELS.WINDOWS_TRAY_MENU_ACTION, async (event, action) => {
    if (!isAllowed(event)) {
      return { success: false, error: "UNAUTHORIZED_TRAY_REQUEST" };
    }
    return controller.performAction(action);
  });

  ipcMain.on(CHANNELS.WINDOWS_TRAY_MENU_CLOSE, (event) => {
    if (isAllowed(event)) controller.hide();
  });
}

module.exports = { registerWindowsTrayMenuIpcHandlers };
