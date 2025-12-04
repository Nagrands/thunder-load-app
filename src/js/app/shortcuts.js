// shortcuts.js (src/js/app/shortcuts.js)

const { app, globalShortcut } = require("electron");
const log = require("electron-log");
const ElectronStore = require("electron-store").default;
const store = new ElectronStore();

let shortcutsRegistered = false;
const isMacPlatform = process.platform === "darwin";
const reloadAccelerator = isMacPlatform ? "Command+R" : "Control+R";
let reloadShortcutSuppressed = false;
let lastMainWindow = null;

function registerReloadShortcut(targetWindow = lastMainWindow) {
  if (!targetWindow) {
    log.warn(
      "[shortcuts.js]: Skipping reload shortcut registration: no mainWindow.",
    );
    return false;
  }

  if (reloadShortcutSuppressed) {
    log.info(
      "[shortcuts.js]: Reload shortcut suppressed, skipping registration.",
    );
    return false;
  }

  if (store.get("disableGlobalShortcuts", false)) {
    log.info(
      "[shortcuts.js]: Global hotkeys disabled; reload shortcut skipped.",
    );
    return false;
  }

  try {
    globalShortcut.unregister(reloadAccelerator);
  } catch (_) {}

  try {
    const success = globalShortcut.register(reloadAccelerator, () => {
      if (targetWindow && !targetWindow.isDestroyed()) {
        targetWindow.reload();
      }
    });

    if (success) {
      log.info(
        `Global shortcut for reload registered (${isMacPlatform ? "Cmd+R" : "Ctrl+R"})`,
      );
    } else {
      log.warn("Failed to register reload shortcut");
    }
    return success;
  } catch (err) {
    log.error("Error registering reload shortcut:", err.message);
    return false;
  }
}

function setReloadShortcutSuppressed(shouldSuppress) {
  const next = Boolean(shouldSuppress);
  if (reloadShortcutSuppressed === next) return;

  reloadShortcutSuppressed = next;

  if (reloadShortcutSuppressed) {
    try {
      globalShortcut.unregister(reloadAccelerator);
      log.info("[shortcuts.js]: Reload shortcut temporarily disabled.");
    } catch (err) {
      log.error(
        "[shortcuts.js]: Failed to unregister reload shortcut:",
        err.message,
      );
    }
    return;
  }

  registerReloadShortcut();
}

// Функция для настройки глобальных горячих клавиш
function setupGlobalShortcuts(mainWindow) {
  lastMainWindow = mainWindow || lastMainWindow;

  // Если горячие клавиши уже были зарегистрированы, снимите их регистрацию перед повторной настройкой
  if (shortcutsRegistered) {
    globalShortcut.unregisterAll();
    shortcutsRegistered = false;
  }

  const disableGlobalShortcuts = store.get("disableGlobalShortcuts", false);
  if (disableGlobalShortcuts) {
    log.info("[shortcuts.js]: Global hotkeys are disabled by user settings.");
    return;
  }

  const isWindows = process.platform === "win32";
  const isMac = isMacPlatform;

  // Получаем пользовательские горячие клавиши и URL-адреса из настроек
  const userShortcuts = store.get("userShortcuts", [
    {
      combo: isMac ? "Alt+1" : "Control+Shift+1",
      url: "https://www.youtube.com",
    },
    {
      combo: isMac ? "Alt+2" : "Control+Shift+2",
      url: "https://www.twitch.tv",
    },
    { combo: isMac ? "Alt+3" : "Control+Shift+3", url: "https://vkvideo.ru" },
    { combo: isMac ? "Alt+4" : "Control+Shift+4", url: "https://www.coub.com" },
  ]);

  registerReloadShortcut(mainWindow);

  userShortcuts.forEach(({ combo, url, action }) => {
    if (!combo) {
      log.warn(
        `A hotkey without a combination: ${JSON.stringify({ url, action })}`,
      );
      return;
    }

    try {
      const success = globalShortcut.register(combo, () => {
        if (url) {
          log.info(`Open URL: ${url}`);
          mainWindow.webContents.send("open-site", url);
          if (mainWindow.isMinimized()) mainWindow.restore();
          mainWindow.focus();
        }
      });

      if (success) {
        log.info(`Hotkey registered: ${combo}`);
      } else {
        log.warn(`Failed to register a hotkey: ${combo}`);
      }
    } catch (err) {
      log.error(
        `Error when registering a hotkey: ${combo}, Error: ${err.message}`,
      );
    }
  });

  app.on("will-quit", () => {
    globalShortcut.unregisterAll();
    log.info("All global hotkeys have been removed.");
  });

  shortcutsRegistered = true;
}

module.exports = {
  setupGlobalShortcuts,
  setReloadShortcutSuppressed,
};
