const { app } = require("electron");

const WINDOWS_FOCUS_RETRY_DELAY_MS = 80;

function bringMainWindowToFront(mainWindow) {
  if (!mainWindow || mainWindow.isDestroyed?.()) return false;

  try {
    if (process.platform === "darwin") {
      try {
        app.dock?.show?.();
      } catch {}
      try {
        app.focus?.({ steal: true });
      } catch {}
      try {
        app.show?.();
      } catch {}
    }

    if (mainWindow.isMinimized?.()) {
      mainWindow.restore?.();
    }

    mainWindow.show?.();
    mainWindow.focus?.();
    mainWindow.moveTop?.();

    setTimeout(() => {
      try {
        if (!mainWindow.isDestroyed?.()) {
          mainWindow.show?.();
          mainWindow.focus?.();
          mainWindow.moveTop?.();
        }
      } catch {}
    }, 30);

    return true;
  } catch {
    return false;
  }
}

function expandMainWindowForToggle(mainWindow) {
  if (process.platform !== "win32") {
    return bringMainWindowToFront(mainWindow);
  }

  if (!mainWindow || mainWindow.isDestroyed?.()) return false;
  if (mainWindow.isVisible?.() === false) return false;

  try {
    try {
      app.focus?.({ steal: true });
    } catch {
      try {
        app.focus?.();
      } catch {}
    }

    if (mainWindow.isMinimized?.()) {
      mainWindow.restore?.();
    }

    if (!mainWindow.isMaximized?.()) {
      mainWindow.maximize?.();
    }

    mainWindow.show?.();
    mainWindow.setAlwaysOnTop?.(true, "screen-saver");
    mainWindow.focus?.();
    mainWindow.moveTop?.();

    setTimeout(() => {
      try {
        if (mainWindow.isDestroyed?.()) return;
        mainWindow.show?.();
        mainWindow.focus?.();
        mainWindow.moveTop?.();
        mainWindow.setAlwaysOnTop?.(false);
      } catch {}
    }, WINDOWS_FOCUS_RETRY_DELAY_MS);

    return true;
  } catch {
    return false;
  }
}

module.exports = { bringMainWindowToFront, expandMainWindowForToggle };
