const handlers = {};

describe("shortcutIpcHandlers", () => {
  beforeEach(() => {
    Object.keys(handlers).forEach((key) => delete handlers[key]);
  });

  test("registers get, set, replace and reset and broadcasts successful changes", () => {
    const { CHANNELS } = require("../../ipc/channels");
    const { registerShortcutIpcHandlers } = require("../shortcutIpcHandlers");
    const ipcMain = {
      handle: jest.fn((channel, callback) => {
        handlers[channel] = callback;
      }),
    };
    const mainWindow = { webContents: { send: jest.fn() } };
    const shortcutService = {
      getState: jest.fn(() => ({ success: true, actions: [], assignments: {} })),
      setShortcut: jest.fn(() => ({
        success: true,
        assignments: { "theme.toggle": "Alt+T" },
      })),
      replaceAssignments: jest.fn(() => ({
        success: true,
        assignments: { "theme.toggle": "Alt+Y" },
      })),
      reset: jest.fn(() => ({ success: false, error: "registrationFailed" })),
    };

    registerShortcutIpcHandlers({ ipcMain, mainWindow, shortcutService });

    expect(handlers[CHANNELS.SHORTCUTS_GET]()).toEqual(
      expect.objectContaining({ success: true, actions: [] }),
    );
    handlers[CHANNELS.SHORTCUTS_SET](null, {
      actionId: "theme.toggle",
      accelerator: "Alt+T",
      strategy: "swap",
    });
    expect(shortcutService.setShortcut).toHaveBeenCalledWith(
      "theme.toggle",
      "Alt+T",
      { strategy: "swap" },
    );
    handlers[CHANNELS.SHORTCUTS_REPLACE](null, {
      assignments: { "theme.toggle": "Alt+Y" },
    });
    handlers[CHANNELS.SHORTCUTS_RESET]();

    expect(mainWindow.webContents.send).toHaveBeenCalledTimes(2);
    expect(mainWindow.webContents.send).toHaveBeenLastCalledWith(
      CHANNELS.SHORTCUTS_CHANGED,
      { assignments: { "theme.toggle": "Alt+Y" } },
    );
  });
});
