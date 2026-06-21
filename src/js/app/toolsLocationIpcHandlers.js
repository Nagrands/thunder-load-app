// src/js/app/toolsLocationIpcHandlers.js

const fs = require("fs");
const fsPromises = fs.promises;
const path = require("path");
const log = require("electron-log");
const { CHANNELS } = require("../ipc/channels");
const {
  getDefaultToolsDir,
  getEffectiveToolsDir,
  ensureToolsDir,
  detectLegacyLocations,
  migrateLegacy,
} = require("./toolsPaths");

function getToolExecutableNames() {
  return process.platform === "win32"
    ? ["yt-dlp.exe", "ffmpeg.exe", "ffprobe.exe", "deno.exe"]
    : ["yt-dlp", "ffmpeg", "ffprobe", "deno"];
}

async function migrateExistingTools({ fromDir, toDir }) {
  const from = path.resolve(String(fromDir || ""));
  const to = path.resolve(String(toDir || ""));
  const migrated = [];
  if (!from || !to || from === to) return migrated;

  for (const name of getToolExecutableNames()) {
    const src = path.join(from, name);
    const dst = path.join(to, name);
    if (!fs.existsSync(src) || fs.existsSync(dst)) continue;
    try {
      await fsPromises.copyFile(src, dst);
      if (process.platform !== "win32") {
        try {
          await fsPromises.chmod(dst, 0o755);
        } catch (chmodErr) {
          log.warn(`tools:setLocation chmod failed for ${dst}:`, chmodErr);
        }
      }
      migrated.push(name);
    } catch (copyErr) {
      log.warn(`tools:setLocation migrate failed for ${name}:`, copyErr);
    }
  }

  return migrated;
}

function registerToolsLocationIpcHandlers({
  ipcMain,
  dialog,
  shell,
  mainWindow,
  store,
}) {
  ipcMain.handle(CHANNELS.TOOLS_GET_LOCATION, () => {
    try {
      const def = getDefaultToolsDir();
      const dir = getEffectiveToolsDir(store);
      return {
        success: true,
        path: dir,
        isDefault: dir === def,
        defaultPath: def,
      };
    } catch (e) {
      log.error("tools:getLocation error:", e);
      return { success: false, error: e.message };
    }
  });

  ipcMain.handle(CHANNELS.TOOLS_SET_LOCATION, async (_evt, newDir) => {
    try {
      const previousDir = getEffectiveToolsDir(store);
      const dir = await ensureToolsDir(newDir);
      const migrated = await migrateExistingTools({
        fromDir: previousDir,
        toDir: dir,
      });
      store.set("tools.dir", dir);
      return { success: true, path: dir, migrated };
    } catch (e) {
      log.error("tools:setLocation error:", e);
      return { success: false, error: e.message };
    }
  });

  ipcMain.handle(CHANNELS.TOOLS_OPEN_LOCATION, async () => {
    try {
      const dir = getEffectiveToolsDir(store);
      await ensureToolsDir(dir);
      shell.openPath(dir);
      return { success: true, path: dir };
    } catch (e) {
      log.error("tools:openLocation error:", e);
      return { success: false, error: e.message };
    }
  });

  ipcMain.handle(CHANNELS.TOOLS_RESET_LOCATION, async () => {
    try {
      const def = getDefaultToolsDir();
      await ensureToolsDir(def);
      try {
        store.delete && store.delete("tools.dir");
      } catch {
        store.set("tools.dir", def);
      }
      return { success: true, path: def };
    } catch (e) {
      log.error("tools:resetLocation error:", e);
      return { success: false, error: e.message };
    }
  });

  ipcMain.handle(CHANNELS.TOOLS_MIGRATE_OLD, async (_evt, opts) => {
    try {
      const dir = getEffectiveToolsDir(store);
      const result = await migrateLegacy(dir, opts || {});
      return { success: true, ...result };
    } catch (e) {
      log.error("tools:migrateOld error:", e);
      return { success: false, error: e.message };
    }
  });

  ipcMain.handle(CHANNELS.TOOLS_DETECT_LEGACY, async () => {
    try {
      const found = await detectLegacyLocations();
      return { success: true, found };
    } catch (e) {
      log.error("tools:detectLegacy error:", e);
      return { success: false, error: e.message };
    }
  });

  ipcMain.handle(CHANNELS.DIALOG_CHOOSE_TOOLS_DIR, async () => {
    try {
      const result = await dialog.showOpenDialog(mainWindow, {
        properties: ["openDirectory", "createDirectory"],
      });
      return result;
    } catch (e) {
      log.error("dialog:choose-tools-dir error:", e);
      return { canceled: true, error: e.message };
    }
  });
}

module.exports = {
  registerToolsLocationIpcHandlers,
  __test: {
    getToolExecutableNames,
    migrateExistingTools,
  },
};
