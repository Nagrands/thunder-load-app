const { app } = require("electron");

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
    if (mainWindow.isMinimized?.()) {
      mainWindow.restore?.();
    }

    if (!mainWindow.isMaximized?.()) {
      mainWindow.maximize?.();
    }

    mainWindow.focus?.();
    mainWindow.moveTop?.();
    return true;
  } catch {
    return false;
  }
}

module.exports = { bringMainWindowToFront, expandMainWindowForToggle };
