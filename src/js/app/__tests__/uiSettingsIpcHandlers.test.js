const handlers = {};
const listeners = {};

describe("uiSettingsIpcHandlers", () => {
  const originalPlatform = process.platform;

  beforeEach(() => {
    Object.keys(handlers).forEach((key) => delete handlers[key]);
    Object.keys(listeners).forEach((key) => delete listeners[key]);
    jest.clearAllMocks();
    Object.defineProperty(process, "platform", {
      value: originalPlatform,
      configurable: true,
    });
  });

  afterAll(() => {
    Object.defineProperty(process, "platform", {
      value: originalPlatform,
      configurable: true,
    });
  });

  function register(storeValues = {}) {
    const { CHANNELS } = require("../../ipc/channels");
    const {
      registerUiSettingsIpcHandlers,
    } = require("../uiSettingsIpcHandlers");
    const ipcMain = {
      handle: jest.fn((channel, callback) => {
        handlers[channel] = callback;
      }),
      on: jest.fn((channel, callback) => {
        listeners[channel] = callback;
      }),
    };
    const mainWindow = {
      minimize: jest.fn(),
      close: jest.fn(),
      webContents: {
        send: jest.fn(),
      },
    };
    const store = {
      get: jest.fn((key, fallback) =>
        Object.prototype.hasOwnProperty.call(storeValues, key)
          ? storeValues[key]
          : fallback,
      ),
      set: jest.fn(),
    };

    registerUiSettingsIpcHandlers({ ipcMain, mainWindow, store });

    return { CHANNELS, ipcMain, mainWindow, store };
  }

  test("registers ui settings channels", () => {
    const { CHANNELS, ipcMain } = register();

    [
      CHANNELS.GET_DEFAULT_TAB,
      CHANNELS.SET_DEFAULT_TAB,
      CHANNELS.GET_PLATFORM_INFO,
      CHANNELS.GET_THEME,
      CHANNELS.SET_THEME,
      CHANNELS.TOAST,
      CHANNELS.GET_FONT_SIZE,
      CHANNELS.SET_FONT_SIZE,
    ].forEach((channel) => {
      expect(ipcMain.handle).toHaveBeenCalledWith(
        channel,
        expect.any(Function),
      );
    });
    expect(ipcMain.on).toHaveBeenCalledWith(
      CHANNELS.WINDOW_MINIMIZE,
      expect.any(Function),
    );
    expect(ipcMain.on).toHaveBeenCalledWith(
      CHANNELS.WINDOW_CLOSE,
      expect.any(Function),
    );
  });

  test("routes window controls through the tracked IPC registrar", () => {
    const { CHANNELS, mainWindow } = register();

    listeners[CHANNELS.WINDOW_MINIMIZE]();
    listeners[CHANNELS.WINDOW_CLOSE]();

    expect(mainWindow.minimize).toHaveBeenCalledTimes(1);
    expect(mainWindow.close).toHaveBeenCalledTimes(1);
  });

  test("reads and writes default tab", () => {
    const { CHANNELS, store } = register({ defaultTab: "tools" });

    expect(handlers[CHANNELS.GET_DEFAULT_TAB]()).toBe("tools");
    expect(
      handlers[CHANNELS.SET_DEFAULT_TAB](null, "products"),
    ).toBeUndefined();
    expect(store.set).toHaveBeenCalledWith("defaultTab", "products");
  });

  test("reads and writes theme", () => {
    const { CHANNELS, store } = register({ theme: "dark" });

    expect(handlers[CHANNELS.GET_THEME]()).toBe("dark");
    expect(handlers[CHANNELS.SET_THEME](null, "light")).toEqual({
      success: true,
    });
    expect(store.set).toHaveBeenCalledWith("theme", "light");
  });

  test("reads and writes font size", () => {
    const { CHANNELS, store } = register({ fontSize: "18px" });

    expect(handlers[CHANNELS.GET_FONT_SIZE]()).toBe("18px");
    expect(handlers[CHANNELS.SET_FONT_SIZE](null, "14px")).toEqual({
      success: true,
    });
    expect(store.set).toHaveBeenCalledWith("fontSize", "14px");
  });

  test("returns platform info", () => {
    Object.defineProperty(process, "platform", {
      value: "darwin",
      configurable: true,
    });
    const { CHANNELS } = register();

    expect(handlers[CHANNELS.GET_PLATFORM_INFO]()).toEqual({ isMac: true });
  });

  test("forwards toast events to renderer", () => {
    const { CHANNELS, mainWindow } = register();

    const result = handlers[CHANNELS.TOAST](null, "Saved", "success", {
      duration: 1000,
    });

    expect(result).toBeUndefined();
    expect(mainWindow.webContents.send).toHaveBeenCalledWith(
      "toast",
      "Saved",
      "success",
      { duration: 1000 },
    );
  });
});
