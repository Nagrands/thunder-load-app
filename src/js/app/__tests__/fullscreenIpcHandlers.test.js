const handlers = {};
const windowListeners = {};

jest.mock("electron-log", () => ({
  error: jest.fn(),
  warn: jest.fn(),
}));

describe("fullscreenIpcHandlers", () => {
  let ipcMain;
  let mainWindow;

  beforeEach(() => {
    Object.keys(handlers).forEach((key) => delete handlers[key]);
    Object.keys(windowListeners).forEach((key) => {
      delete windowListeners[key];
    });
    jest.clearAllMocks();

    ipcMain = {
      handle: jest.fn((channel, callback) => {
        handlers[channel] = callback;
      }),
    };
    mainWindow = {
      isFullScreen: jest.fn(() => false),
      on: jest.fn((eventName, callback) => {
        windowListeners[eventName] = callback;
      }),
      setFullScreen: jest.fn(),
      webContents: {
        isDestroyed: jest.fn(() => false),
        send: jest.fn(),
      },
    };
  });

  function register() {
    const { CHANNELS } = require("../../ipc/channels");
    const {
      registerFullscreenIpcHandlers,
    } = require("../fullscreenIpcHandlers");

    registerFullscreenIpcHandlers({ ipcMain, mainWindow });
    return CHANNELS;
  }

  test("registers get/set handlers and native window listeners", () => {
    const CHANNELS = register();

    expect(ipcMain.handle).toHaveBeenCalledWith(
      CHANNELS.WINDOW_GET_FULLSCREEN,
      expect.any(Function),
    );
    expect(ipcMain.handle).toHaveBeenCalledWith(
      CHANNELS.WINDOW_SET_FULLSCREEN,
      expect.any(Function),
    );
    expect(mainWindow.on).toHaveBeenCalledWith(
      "enter-full-screen",
      expect.any(Function),
    );
    expect(mainWindow.on).toHaveBeenCalledWith(
      "leave-full-screen",
      expect.any(Function),
    );
  });

  test("gets and sets fullscreen state with structured responses", async () => {
    const CHANNELS = register();
    mainWindow.isFullScreen.mockReturnValueOnce(true);

    await expect(handlers[CHANNELS.WINDOW_GET_FULLSCREEN]()).resolves.toEqual({
      success: true,
      data: { isFullscreen: true },
      error: null,
    });
    await expect(
      handlers[CHANNELS.WINDOW_SET_FULLSCREEN](null, true),
    ).resolves.toEqual({
      success: true,
      data: { isFullscreen: true },
      error: null,
    });
    expect(mainWindow.setFullScreen).toHaveBeenCalledWith(true);
    expect(mainWindow.isFullScreen).toHaveBeenCalledTimes(1);
  });

  test("rejects non-boolean set payloads without changing the window", async () => {
    const CHANNELS = register();

    await expect(
      handlers[CHANNELS.WINDOW_SET_FULLSCREEN](null, "true"),
    ).resolves.toEqual({
      success: false,
      data: null,
      error: {
        code: "INVALID_FULLSCREEN_STATE",
        message: "Fullscreen state must be a boolean",
      },
    });
    expect(mainWindow.setFullScreen).not.toHaveBeenCalled();
  });

  test("returns structured errors when Electron fullscreen APIs fail", async () => {
    const CHANNELS = register();
    mainWindow.isFullScreen.mockImplementationOnce(() => {
      throw new Error("state unavailable");
    });
    mainWindow.setFullScreen.mockImplementationOnce(() => {
      throw new Error("transition unavailable");
    });

    await expect(
      handlers[CHANNELS.WINDOW_GET_FULLSCREEN](),
    ).resolves.toMatchObject({
      success: false,
      error: {
        code: "FULLSCREEN_GET_FAILED",
        message: "state unavailable",
      },
    });
    await expect(
      handlers[CHANNELS.WINDOW_SET_FULLSCREEN](null, false),
    ).resolves.toMatchObject({
      success: false,
      error: {
        code: "FULLSCREEN_SET_FAILED",
        message: "transition unavailable",
      },
    });
  });

  test("propagates native enter and leave events to the renderer", () => {
    const CHANNELS = register();

    windowListeners["enter-full-screen"]();
    windowListeners["leave-full-screen"]();

    expect(mainWindow.webContents.send.mock.calls).toEqual([
      [CHANNELS.WINDOW_FULLSCREEN_CHANGED, { isFullscreen: true }],
      [CHANNELS.WINDOW_FULLSCREEN_CHANGED, { isFullscreen: false }],
    ]);
  });

  test("does not send native events to destroyed web contents", () => {
    register();
    mainWindow.webContents.isDestroyed.mockReturnValue(true);

    windowListeners["enter-full-screen"]();

    expect(mainWindow.webContents.send).not.toHaveBeenCalled();
  });
});
