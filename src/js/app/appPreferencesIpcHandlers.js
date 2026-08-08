// src/js/app/appPreferencesIpcHandlers.js

const fs = require("fs");
const path = require("path");
const log = require("electron-log");
const { CHANNELS } = require("../ipc/channels");

function getStartupFolderPath() {
  if (process.platform !== "win32") {
    throw new Error("Эта функция поддерживается только на Windows.");
  }
  return path.join(
    process.env.APPDATA,
    "Microsoft\\Windows\\Start Menu\\Programs\\Startup",
  );
}

function enableAutoLaunch({ app, shell }) {
  const startupFolderPath = getStartupFolderPath();
  const shortcutPath = path.join(startupFolderPath, `${app.getName()}.lnk`);
  const exePath = app.getPath("exe");

  shell.writeShortcutLink(shortcutPath, {
    target: exePath,
    args: "",
    workingDirectory: path.dirname(exePath),
    icon: exePath,
    iconIndex: 0,
  });
}

function disableAutoLaunch(app) {
  const startupFolderPath = getStartupFolderPath();
  const shortcutPath = path.join(startupFolderPath, `${app.getName()}.lnk`);

  if (fs.existsSync(shortcutPath)) {
    fs.unlinkSync(shortcutPath);
  }
}

function isAutoLaunchEnabled(app) {
  if (process.platform !== "win32") return false;
  const startupFolderPath = getStartupFolderPath();
  const shortcutPath = path.join(startupFolderPath, `${app.getName()}.lnk`);
  return fs.existsSync(shortcutPath);
}

function registerAppPreferencesIpcHandlers({
  ipcMain,
  app,
  clipboardMonitor,
  globalShortcut,
  mainWindow,
  Notification,
  setupGlobalShortcuts,
  setGlobalShortcutsDisabled,
  shell,
  showTrayNotification,
  store,
}) {
  ipcMain.handle(CHANNELS.GET_DISABLE_COMPLETE_MODAL_STATUS, () =>
    store.get("disableCompleteModal", true),
  );

  ipcMain.handle(CHANNELS.SET_DISABLE_COMPLETE_MODAL_STATUS, (_, enabled) =>
    store.set("disableCompleteModal", enabled),
  );

  ipcMain.handle(CHANNELS.TOGGLE_AUTO_LAUNCH, async (event, enable) => {
    try {
      if (enable) {
        enableAutoLaunch({ app, shell });
        log.info("AutoLaunch enabled.");
        event.sender.send(
          "toast",
          "Приложение добавлено в автозагрузку.",
          "success",
        );
      } else {
        disableAutoLaunch(app);
        log.info("AutoLaunch disabled.");
        event.sender.send(
          "toast",
          "Приложение удалено из автозагрузки.",
          "success",
        );
      }
    } catch (error) {
      log.error("Ошибка при изменении состояния автозапуска:", error);
      event.sender.send(
        "toast",
        "Не удалось изменить состояние автозапуска.",
        "error",
      );
    }
  });

  ipcMain.handle(CHANNELS.SET_MINIMIZE_ON_LAUNCH_STATUS, (_, enabled) => {
    store.set("minimizeOnLaunch", enabled);
    return true;
  });

  ipcMain.handle(CHANNELS.GET_MINIMIZE_ON_LAUNCH_STATUS, () => {
    return store.get("minimizeOnLaunch", false);
  });

  ipcMain.handle(
    CHANNELS.SET_MINIMIZE_INSTEAD_OF_CLOSE,
    async (event, minimize) => {
      store.set("minimizeInsteadOfClose", minimize);
      showTrayNotification(
        minimize
          ? "Приложение теперь будет сворачиваться в трей при закрытии."
          : "Приложение теперь будет полностью закрываться.",
      );
    },
  );

  ipcMain.handle(CHANNELS.GET_AUTO_LAUNCH_STATUS, async () => {
    try {
      return isAutoLaunchEnabled(app);
    } catch (error) {
      log.error("Ошибка при получении состояния автозапуска:", error);
      return false;
    }
  });

  ipcMain.handle(
    CHANNELS.SET_MINIMIZE_TO_TRAY_STATUS,
    async (event, enable) => {
      store.set("minimizeToTray", enable);
    },
  );

  ipcMain.handle(CHANNELS.GET_MINIMIZE_TO_TRAY_STATUS, async () => {
    return store.get("minimizeToTray", false);
  });

  ipcMain.handle(
    CHANNELS.SET_CLOSE_NOTIFICATION_STATUS,
    async (event, enable) => {
      store.set("closeNotification", enable);
    },
  );

  ipcMain.handle(CHANNELS.GET_CLOSE_NOTIFICATION_STATUS, async () => {
    return store.get("closeNotification", true);
  });

  ipcMain.handle(
    CHANNELS.SET_OPEN_ON_DOWNLOAD_COMPLETE_STATUS,
    async (event, enable) => {
      store.set("expandWindowOnDownloadComplete", enable);
    },
  );

  ipcMain.handle(CHANNELS.GET_OPEN_ON_DOWNLOAD_COMPLETE_STATUS, async () => {
    return store.get("expandWindowOnDownloadComplete", false);
  });

  ipcMain.handle(
    CHANNELS.SET_OPEN_ON_COPY_URL_STATUS,
    async (event, enabled) => {
      store.set("openOnCopyUrl", enabled);
      if (clipboardMonitor) {
        enabled ? clipboardMonitor.start() : clipboardMonitor.stop();
      } else {
        log.warn("clipboardMonitor not initialized");
      }
    },
  );

  ipcMain.handle(CHANNELS.GET_OPEN_ON_COPY_URL_STATUS, async () => {
    return store.get("openOnCopyUrl", false);
  });

  ipcMain.handle(CHANNELS.GET_DISABLE_GLOBAL_SHORTCUTS_STATUS, () => {
    return store.get("disableGlobalShortcuts", false);
  });

  ipcMain.handle(
    CHANNELS.SET_DISABLE_GLOBAL_SHORTCUTS_STATUS,
    (event, enable) => {
      const result =
        typeof setGlobalShortcutsDisabled === "function"
          ? setGlobalShortcutsDisabled(enable)
          : (store.set("disableGlobalShortcuts", enable),
            enable
              ? globalShortcut?.unregisterAll?.()
              : setupGlobalShortcuts(mainWindow));
      log.info(`Global hotkeys are ${enable ? "disabled" : "enabled"}.`);
      return result;
    },
  );

  ipcMain.handle(
    CHANNELS.SHOW_SYSTEM_NOTIFICATION,
    async (event, { title, body }) => {
      if (Notification.isSupported()) {
        new Notification({ title, body }).show();
      } else {
        log.warn("System notifications are unavailable on this device.");
      }
    },
  );

  ipcMain.handle(CHANNELS.GET_MINIMIZE_INSTEAD_OF_CLOSE_STATUS, async () => {
    return store.get("minimizeInsteadOfClose", false);
  });
}

module.exports = {
  registerAppPreferencesIpcHandlers,
  __test: {
    getStartupFolderPath,
    isAutoLaunchEnabled,
  },
};
