// src/js/app/backupIpcHandlers.js

const log = require("electron-log");
const { CHANNELS } = require("../ipc/channels");

let backupManager = null;

function getBackupManager() {
  if (!backupManager) {
    backupManager = require("./backupManager");
  }
  return backupManager;
}

function registerBackupIpcHandlers({
  ipcMain,
  mainWindow,
  setBackupReloadBlocked,
}) {
  ipcMain.handle(CHANNELS.BACKUP_GET_PROGRAMS, async () => {
    try {
      const programs = await getBackupManager().readPrograms();
      return { success: true, programs };
    } catch (e) {
      log.error("backup:getPrograms error:", e);
      return { success: false, error: e.message };
    }
  });

  ipcMain.handle(CHANNELS.BACKUP_SAVE_PROGRAMS, async (_evt, programs) => {
    try {
      await getBackupManager().savePrograms(programs || []);
      return { success: true };
    } catch (e) {
      log.error("backup:savePrograms error:", e);
      return { success: false, error: e.message };
    }
  });

  ipcMain.handle(CHANNELS.BACKUP_GET_LAST_TIMES, async () => {
    try {
      const backup = getBackupManager();
      const programs = await backup.readPrograms();
      const map = await backup.listLastTimes(programs);
      return { success: true, map };
    } catch (e) {
      log.error("backup:getLastTimes error:", e);
      return { success: false, error: e.message };
    }
  });

  ipcMain.handle(CHANNELS.BACKUP_PREFLIGHT, async (_evt, programs) => {
    try {
      const backup = getBackupManager();
      const list = Array.isArray(programs)
        ? programs
        : await backup.readPrograms();
      const results = await Promise.all(
        list.map((p) => backup.preFlightChecksDetailed(p)),
      );
      return { success: true, results };
    } catch (e) {
      log.error("backup:preflight error:", e);
      return { success: false, error: e.message };
    }
  });

  ipcMain.handle(CHANNELS.BACKUP_RUN, async (_evt, programs) => {
    try {
      const backup = getBackupManager();
      const list = Array.isArray(programs)
        ? programs
        : await backup.readPrograms();
      const res = await backup.runBackupBatch(list);
      try {
        const ok = res.filter((r) => r.success).length;
        const total = res.length;
        if (mainWindow && mainWindow.webContents) {
          mainWindow.webContents.send(
            "toast",
            `Backup завершён: ${ok}/${total}`,
            ok === total ? "success" : ok ? "warning" : "error",
          );
        }
      } catch (_) {}
      return { success: true, results: res };
    } catch (e) {
      log.error("backup:run error:", e);
      return { success: false, error: e.message };
    }
  });

  ipcMain.handle(CHANNELS.BACKUP_CHOOSE_DIR, async () => {
    try {
      const dir = await getBackupManager().chooseDir(mainWindow);
      return { success: !!dir, path: dir || null };
    } catch (e) {
      log.error("backup:chooseDir error:", e);
      return { success: false, error: e.message };
    }
  });

  ipcMain.handle(CHANNELS.BACKUP_OPEN_PATH, async (_evt, p) => {
    try {
      const r = await getBackupManager().openPath(p);
      return r;
    } catch (e) {
      log.error("backup:openPath error:", e);
      return { success: false, error: e.message };
    }
  });

  ipcMain.handle(
    CHANNELS.BACKUP_TOGGLE_RELOAD_BLOCK,
    async (_evt, shouldBlock) => {
      try {
        const blocked = Boolean(shouldBlock);
        setBackupReloadBlocked(blocked);
        return { success: true, blocked };
      } catch (error) {
        log.error("backup:toggleReloadBlock error:", error);
        return { success: false, error: error.message || String(error) };
      }
    },
  );
}

module.exports = {
  registerBackupIpcHandlers,
};
