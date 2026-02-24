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

module.exports = { bringMainWindowToFront };
