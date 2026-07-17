const { CHANNELS } = require("../ipc/channels");

function registerShortcutIpcHandlers({ ipcMain, mainWindow, shortcutService }) {
  const notifyChanged = (result) => {
    if (result?.success) {
      mainWindow?.webContents?.send?.(CHANNELS.SHORTCUTS_CHANGED, {
        assignments: result.assignments,
      });
    }
    return result;
  };

  ipcMain.handle(CHANNELS.SHORTCUTS_GET, () => shortcutService.getState());
  ipcMain.handle(CHANNELS.SHORTCUTS_SET, (_, payload = {}) =>
    notifyChanged(
      shortcutService.setShortcut(payload.actionId, payload.accelerator, {
        strategy: payload.strategy,
      }),
    ),
  );
  ipcMain.handle(CHANNELS.SHORTCUTS_REPLACE, (_, payload = {}) =>
    notifyChanged(
      shortcutService.replaceAssignments(payload.assignments || payload),
    ),
  );
  ipcMain.handle(CHANNELS.SHORTCUTS_RESET, () =>
    notifyChanged(shortcutService.reset()),
  );
}

module.exports = { registerShortcutIpcHandlers };
