// src/js/app/toolsVersionsIpcHandlers.js

const log = require("electron-log");
const { CHANNELS } = require("../ipc/channels");
const {
  getToolsAvailability,
  getToolsVersions,
} = require("./toolsVersions");

function markDarwinFfmpegSkipUpdates(tools) {
  if (process.platform === "darwin" && tools?.ffmpeg) {
    tools.ffmpeg.skipUpdates = true;
  }
  return tools;
}

function registerToolsVersionsIpcHandlers({ ipcMain, store }) {
  ipcMain.handle(CHANNELS.TOOLS_GETVERSIONS, async () => {
    try {
      const tools = markDarwinFfmpegSkipUpdates(
        await getToolsVersions(store),
      );

      log.info("Загрузчик → Проверка версий инструментов завершена", {
        ytDlpOk: tools?.ytDlp?.ok === true,
        ffmpegOk: tools?.ffmpeg?.ok === true,
        ffmpegVersion: tools?.ffmpeg?.version || null,
      });

      return tools;
    } catch (error) {
      log.error("Error in TOOLS_GETVERSIONS:", error);
      return {
        ytDlp: { ok: false, error: error.message },
        ffmpeg: { ok: false, error: error.message },
      };
    }
  });

  ipcMain.handle(CHANNELS.TOOLS_GET_AVAILABILITY, async () => {
    try {
      return markDarwinFfmpegSkipUpdates(getToolsAvailability(store));
    } catch (error) {
      log.error("Error in TOOLS_GET_AVAILABILITY:", error);
      return {
        ytDlp: { ok: false, error: error.message },
        ffmpeg: { ok: false, error: error.message },
        deno: { ok: false, error: error.message },
      };
    }
  });
}

module.exports = {
  registerToolsVersionsIpcHandlers,
  __test: {
    markDarwinFfmpegSkipUpdates,
  },
};
