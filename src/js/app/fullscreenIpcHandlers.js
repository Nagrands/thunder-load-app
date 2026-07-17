const log = require("electron-log");
const { CHANNELS } = require("../ipc/channels");

function success(isFullscreen) {
  return {
    success: true,
    data: { isFullscreen },
    error: null,
  };
}

function failure(code, message) {
  return {
    success: false,
    data: null,
    error: { code, message },
  };
}

function registerFullscreenIpcHandlers({ ipcMain, mainWindow }) {
  const getFullscreenState = () => Boolean(mainWindow.isFullScreen());

  const sendFullscreenChanged = (isFullscreen) => {
    try {
      if (!mainWindow?.webContents || mainWindow.webContents.isDestroyed?.()) {
        return;
      }
      mainWindow.webContents.send(CHANNELS.WINDOW_FULLSCREEN_CHANGED, {
        isFullscreen: Boolean(isFullscreen),
      });
    } catch (error) {
      log.warn("[fullscreen] Failed to send state change:", error);
    }
  };

  ipcMain.handle(CHANNELS.WINDOW_GET_FULLSCREEN, async () => {
    try {
      return success(getFullscreenState());
    } catch (error) {
      log.error("[fullscreen] Failed to read window state:", error);
      return failure(
        "FULLSCREEN_GET_FAILED",
        error?.message || "Failed to read fullscreen state",
      );
    }
  });

  ipcMain.handle(CHANNELS.WINDOW_SET_FULLSCREEN, async (_event, enabled) => {
    if (typeof enabled !== "boolean") {
      return failure(
        "INVALID_FULLSCREEN_STATE",
        "Fullscreen state must be a boolean",
      );
    }

    try {
      mainWindow.setFullScreen(enabled);
      return success(enabled);
    } catch (error) {
      log.error("[fullscreen] Failed to update window state:", error);
      return failure(
        "FULLSCREEN_SET_FAILED",
        error?.message || "Failed to update fullscreen state",
      );
    }
  });

  mainWindow?.on?.("enter-full-screen", () => {
    sendFullscreenChanged(true);
  });
  mainWindow?.on?.("leave-full-screen", () => {
    sendFullscreenChanged(false);
  });
}

module.exports = { registerFullscreenIpcHandlers };
