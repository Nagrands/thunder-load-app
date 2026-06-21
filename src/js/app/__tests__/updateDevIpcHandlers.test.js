const handlers = {};

describe("updateDevIpcHandlers", () => {
  beforeEach(() => {
    Object.keys(handlers).forEach((key) => delete handlers[key]);
    jest.clearAllMocks();
  });

  function register(overrides = {}) {
    const { CHANNELS } = require("../../ipc/channels");
    const { registerUpdateDevIpcHandlers } = require("../updateDevIpcHandlers");
    const ipcMain = {
      handle: jest.fn((channel, callback) => {
        handlers[channel] = callback;
      }),
    };
    const mainWindow = overrides.mainWindow || {
      webContents: {
        send: jest.fn(),
      },
    };
    const getAppVersion =
      overrides.getAppVersion || jest.fn(async () => "1.6.0");

    registerUpdateDevIpcHandlers({ ipcMain, mainWindow, getAppVersion });

    return { CHANNELS, getAppVersion, ipcMain, mainWindow };
  }

  test("registers update dev channels", () => {
    const { CHANNELS, ipcMain } = register();

    expect(ipcMain.handle).toHaveBeenCalledWith(
      CHANNELS.UPDATE_DEV_OPEN,
      expect.any(Function),
    );
    expect(ipcMain.handle).toHaveBeenCalledWith(
      CHANNELS.UPDATE_DEV_PROGRESS,
      expect.any(Function),
    );
    expect(ipcMain.handle).toHaveBeenCalledWith(
      CHANNELS.UPDATE_DEV_DOWNLOADED,
      expect.any(Function),
    );
    expect(ipcMain.handle).toHaveBeenCalledWith(
      CHANNELS.UPDATE_DEV_ERROR,
      expect.any(Function),
    );
  });

  test("sends update open flyover events", async () => {
    const { CHANNELS, getAppVersion, mainWindow } = register();

    const result = await handlers[CHANNELS.UPDATE_DEV_OPEN]();

    expect(result).toBe(true);
    expect(getAppVersion).toHaveBeenCalledTimes(1);
    expect(mainWindow.webContents.send).toHaveBeenCalledWith(
      "update-available",
      "Доступно новое обновление.",
    );
    expect(mainWindow.webContents.send).toHaveBeenCalledWith(
      "update-available-info",
      {
        current: "1.6.0",
        next: "1.3.0",
      },
    );
  });

  test("normalizes progress percent", async () => {
    const { CHANNELS, mainWindow } = register();

    const result = await handlers[CHANNELS.UPDATE_DEV_PROGRESS](null, "42");

    expect(result).toBe(true);
    expect(mainWindow.webContents.send).toHaveBeenCalledWith(
      "update-progress",
      42,
    );
  });

  test("sends downloaded and error events", async () => {
    const { CHANNELS, mainWindow } = register();

    await expect(handlers[CHANNELS.UPDATE_DEV_DOWNLOADED]()).resolves.toBe(
      true,
    );
    await expect(
      handlers[CHANNELS.UPDATE_DEV_ERROR](null, "boom"),
    ).resolves.toBe(true);

    expect(mainWindow.webContents.send).toHaveBeenCalledWith(
      "update-downloaded",
    );
    expect(mainWindow.webContents.send).toHaveBeenCalledWith(
      "update-error",
      "boom",
    );
  });

  test("returns false when sending fails", async () => {
    const { CHANNELS } = register({
      mainWindow: {
        webContents: {
          send: jest.fn(() => {
            throw new Error("send failed");
          }),
        },
      },
    });

    await expect(handlers[CHANNELS.UPDATE_DEV_PROGRESS](null, 10)).resolves.toBe(
      false,
    );
  });
});
