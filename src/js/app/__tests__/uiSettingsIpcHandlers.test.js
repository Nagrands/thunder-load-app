const handlers = {};

describe("uiSettingsIpcHandlers", () => {
  const originalPlatform = process.platform;

  beforeEach(() => {
    Object.keys(handlers).forEach((key) => delete handlers[key]);
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
    };
    const mainWindow = {
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
