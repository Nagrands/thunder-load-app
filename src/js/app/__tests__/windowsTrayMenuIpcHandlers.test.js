const {
  registerWindowsTrayMenuIpcHandlers,
} = require("../windowsTrayMenuIpcHandlers");
const { CHANNELS } = require("../../ipc/channels");

describe("Windows tray panel IPC", () => {
  test("validates the sender and delegates safe requests", async () => {
    const handlers = new Map();
    const listeners = new Map();
    const ipcMain = {
      handle: jest.fn((channel, handler) => handlers.set(channel, handler)),
      on: jest.fn((channel, handler) => listeners.set(channel, handler)),
    };
    const sender = {};
    const controller = {
      ownsWebContents: jest.fn((value) => value === sender),
      getSafeState: jest.fn(() => ({ lastVideo: {}, downloads: {} })),
      performAction: jest.fn(async () => ({ success: true, data: null })),
      hide: jest.fn(),
    };
    registerWindowsTrayMenuIpcHandlers({ ipcMain, controller });

    await expect(
      handlers.get(CHANNELS.WINDOWS_TRAY_MENU_GET_STATE)({ sender: {} }),
    ).resolves.toEqual({
      success: false,
      error: "UNAUTHORIZED_TRAY_REQUEST",
    });
    await expect(
      handlers.get(CHANNELS.WINDOWS_TRAY_MENU_GET_STATE)({ sender }),
    ).resolves.toEqual({
      success: true,
      data: { lastVideo: {}, downloads: {} },
    });
    await handlers.get(CHANNELS.WINDOWS_TRAY_MENU_ACTION)(
      { sender },
      "settings",
    );
    expect(controller.performAction).toHaveBeenCalledWith("settings");
    listeners.get(CHANNELS.WINDOWS_TRAY_MENU_CLOSE)({ sender });
    expect(controller.hide).toHaveBeenCalledTimes(1);
  });
});
