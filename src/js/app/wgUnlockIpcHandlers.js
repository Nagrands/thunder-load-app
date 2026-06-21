// src/js/app/wgUnlockIpcHandlers.js

const fs = require("fs");
const path = require("path");
const os = require("os");
const log = require("electron-log");
const { CHANNELS } = require("../ipc/channels");

function registerWgUnlockIpcHandlers({ ipcMain, app, dialog, shell }) {
  ipcMain.on(CHANNELS.WG_OPEN_CONFIG_FOLDER, () => {
    try {
      const folderPath = app.getPath("userData");
      const filePath = path.join(folderPath, "wireguard.conf");

      if (!fs.existsSync(folderPath)) {
        fs.mkdirSync(folderPath, { recursive: true });
      }
      if (!fs.existsSync(filePath)) {
        fs.writeFileSync(filePath, "", "utf8");
      }

      shell.openPath(filePath);

      log.info("Конфигурационный файл открыт в текстовом редакторе:", filePath);
    } catch (e) {
      log.error("wg-open-config-file error:", e);
    }
  });

  ipcMain.on(CHANNELS.WG_OPEN_NETWORK_SETTINGS, () => {
    if (process.platform === "win32") {
      shell.openExternal("ms-settings:network");
    } else if (process.platform === "darwin") {
      const version = parseFloat(os.release());
      if (version >= 22) {
        shell.openExternal(
          "x-apple.systempreferences:com.apple.Network-Settings.extension",
        );
      } else {
        shell.openExternal(
          "x-apple.systempreferences:com.apple.preference.network",
        );
      }
    } else {
      log.info(
        "WG_OPEN_NETWORK_SETTINGS: платформа не поддерживается для открытия настроек сети.",
      );
    }
  });

  ipcMain.on(CHANNELS.WG_EXPORT_LOG, async (event, logContent) => {
    try {
      const { filePath } = await dialog.showSaveDialog({
        title: "Экспорт лога WireGuard",
        defaultPath: `wg-log-${new Date().toISOString().slice(0, 10)}.txt`,
        filters: [
          { name: "Text Files", extensions: ["txt"] },
          { name: "All Files", extensions: ["*"] },
        ],
      });

      if (filePath) {
        await fs.promises.writeFile(filePath, logContent, "utf8");
        event.reply("wg-log-export-success", { filePath });
        log.info("Лог WireGuard экспортирован:", filePath);
      } else {
        event.reply("wg-log-export-error", {
          error: "Экспорт отменен пользователем",
        });
      }
    } catch (e) {
      log.error("wg-log-export error:", e);
      event.reply("wg-log-export-error", { error: e.message });
    }
  });
}

module.exports = {
  registerWgUnlockIpcHandlers,
};
