const path = require("path");
const log = require("electron-log");

const { CHANNELS } = require("../../ipc/channels");
const { normalizeCookies } = require("./preferences");

function registerDownloadIpcHandlers({ ipcMain, runtime }) {
  ipcMain.handle(CHANNELS.GET_VIDEO_PREVIEW, (_event, url) =>
    runtime.getVideoPreview(url),
  );
  ipcMain.handle(CHANNELS.GET_VIDEO_INFO, (_event, url) =>
    runtime.getVideoInfo(url),
  );
  ipcMain.handle(CHANNELS.CANCEL_VIDEO_INFO_REQUEST, (_event, payload) =>
    runtime.cancelVideoInfo(payload),
  );
  ipcMain.handle(
    CHANNELS.DOWNLOAD_VIDEO,
    (event, url, quality, requestedJobId = null) =>
      runtime.start({ event, url, quality, jobId: requestedJobId }),
  );
  ipcMain.handle(CHANNELS.CANCEL_DOWNLOAD_JOB, (_event, payload) =>
    runtime.cancel(payload?.jobId),
  );
  ipcMain.handle(CHANNELS.STOP_DOWNLOAD, () => runtime.cancelAll());
}

function isValidCookiesFilePath(filePath, isValidFilePath) {
  return (
    typeof filePath === "string" &&
    path.isAbsolute(filePath) &&
    isValidFilePath(filePath)
  );
}

function registerDownloadPreferencesIpcHandlers(options) {
  const {
    dialog,
    ipcMain,
    isValidFilePath,
    mainWindow,
    preferences,
    runtime,
  } = options;
  ipcMain.handle(CHANNELS.SELECT_DOWNLOAD_FOLDER, async () => {
    const result = await dialog.showOpenDialog(mainWindow, {
      properties: ["openDirectory"],
    });
    if (result.canceled || !result.filePaths?.length) return { success: false };
    return preferences.setPath(result.filePaths[0]);
  });
  ipcMain.handle(CHANNELS.SET_DOWNLOAD_PATH, async (_event, nextPath) => {
    const result = await preferences.setPath(nextPath);
    return result.success
      ? { success: true }
      : { success: false, error: result.error };
  });
  ipcMain.handle(CHANNELS.GET_DOWNLOAD_PATH, () => preferences.getPath());
  ipcMain.handle(CHANNELS.SET_DOWNLOAD_PARALLEL_LIMIT, (_event, value) => ({
    success: true,
    limit: runtime.setParallelLimit(value),
  }));
  ipcMain.handle(CHANNELS.GET_DOWNLOAD_PARALLEL_LIMIT, () =>
    runtime.getParallelLimit(),
  );
  ipcMain.handle(CHANNELS.GET_YTDLP_COOKIES_SETTINGS, () =>
    preferences.getCookies(),
  );
  ipcMain.handle(CHANNELS.SET_YTDLP_COOKIES_SETTINGS, (_event, value) => {
    const settings = normalizeCookies(value);
    if (
      settings.mode === "file" &&
      settings.filePath &&
      !isValidCookiesFilePath(settings.filePath, isValidFilePath)
    ) {
      return {
        success: false,
        error: "Invalid cookies file path",
        settings: preferences.getCookies(),
      };
    }
    preferences.setCookies(settings);
    return { success: true, settings };
  });
  ipcMain.handle(CHANNELS.SELECT_YTDLP_COOKIES_FILE, async () => {
    try {
      const result = await dialog.showOpenDialog(mainWindow, {
        properties: ["openFile"],
        filters: [
          { name: "Cookies", extensions: ["txt"] },
          { name: "All Files", extensions: ["*"] },
        ],
      });
      if (result.canceled || !result.filePaths?.length) {
        return { success: false, canceled: true };
      }
      const filePath = result.filePaths[0];
      if (!isValidCookiesFilePath(filePath, isValidFilePath)) {
        return { success: false, error: "Invalid cookies file path" };
      }
      return { success: true, filePath };
    } catch (error) {
      log.error("select-ytdlp-cookies-file error:", error);
      return { success: false, error: error.message || String(error) };
    }
  });
}

module.exports = {
  registerDownloadIpcHandlers,
  registerDownloadPreferencesIpcHandlers,
};
