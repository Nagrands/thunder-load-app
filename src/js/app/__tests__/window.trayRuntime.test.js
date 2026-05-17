const fs = require("fs");
const { EventEmitter } = require("events");

const createNativeImageMock = () => {
  const image = {
    isEmpty: jest.fn(() => false),
    setTemplateImage: jest.fn(),
  };
  return image;
};

jest.mock("electron", () => {
  class MockBrowserWindow {
    constructor() {
      this._events = {};
      this.webContents = { send: jest.fn() };
      this.isVisible = jest.fn(() => false);
      this.isMinimized = jest.fn(() => true);
      this.show = jest.fn();
      this.hide = jest.fn();
      this.focus = jest.fn();
      this.restore = jest.fn();
      this.minimize = jest.fn();
      this.close = jest.fn();
      this.getSize = jest.fn(() => [1280, 740]);
      this.getMinimumSize = jest.fn(() => [890, 540]);
      this.setSize = jest.fn();
      this.loadFile = jest.fn(() => Promise.resolve());
      this.setMenuBarVisibility = jest.fn();
      this.once = jest.fn((event, cb) => {
        this._events[event] = cb;
      });
      this.on = jest.fn((event, cb) => {
        this._events[event] = cb;
      });
    }
  }

  const Tray = jest.fn(() => {
    const handlers = {};
    return {
      handlers,
      on: jest.fn((event, cb) => {
        handlers[event] = cb;
      }),
      setToolTip: jest.fn(),
      setContextMenu: jest.fn(),
      popUpContextMenu: jest.fn(),
      setImage: jest.fn(),
    };
  });

  return {
    BrowserWindow: jest.fn(() => new MockBrowserWindow()),
    clipboard: { readText: jest.fn(() => "") },
    Tray,
    Menu: {
      buildFromTemplate: jest.fn((template) => template),
      setApplicationMenu: jest.fn(),
    },
    shell: { openPath: jest.fn(() => Promise.resolve("")) },
    ipcMain: { on: jest.fn(), handle: jest.fn() },
    nativeImage: { createFromPath: jest.fn(() => createNativeImageMock()) },
  };
});

jest.mock("electron-window-state", () =>
  jest.fn(() => ({
    x: 0,
    y: 0,
    width: 1280,
    height: 740,
    manage: jest.fn(),
  })),
);

jest.mock("../notifications.js", () => ({
  showTrayNotification: jest.fn(),
}));

const { createWindow, resetWindowStateForTests } = require("../window.js");
const { Tray, ipcMain, nativeImage } = require("electron");

function createStore(values = {}) {
  return {
    get: jest.fn((key, fallback) =>
      Object.prototype.hasOwnProperty.call(values, key)
        ? values[key]
        : fallback,
    ),
    set: jest.fn(),
  };
}

describe("tray runtime behavior", () => {
  let existsSyncSpy;
  let platformDescriptor;

  beforeEach(() => {
    Tray.mockClear();
    ipcMain.on.mockClear();
    nativeImage.createFromPath.mockClear();
    existsSyncSpy = jest.spyOn(fs, "existsSync").mockReturnValue(true);
    platformDescriptor = Object.getOwnPropertyDescriptor(process, "platform");
    resetWindowStateForTests();
  });

  afterEach(() => {
    existsSyncSpy.mockRestore();
    if (platformDescriptor) {
      Object.defineProperty(process, "platform", platformDescriptor);
    }
  });

  function setPlatform(platform) {
    Object.defineProperty(process, "platform", {
      value: platform,
      configurable: true,
    });
  }

  test("handles click/double-click/right-click and refresh events on windows tray", () => {
    setPlatform("win32");
    const app = new EventEmitter();
    app.getName = () => "Thunder Load";
    app.getVersion = () => "1.3.6";
    app.getAppPath = () => "/tmp/app";
    app.quit = jest.fn();
    app.isPackaged = false;
    app.isQuitting = false;
    app.dock = { setIcon: jest.fn(), setMenu: jest.fn() };

    const store = createStore({ downloadPath: "/tmp/downloads" });

    const mainWindow = createWindow(
      false,
      app,
      store,
      "/tmp/downloads",
      () => "1.3.6",
      "",
      "",
      "",
      () => true,
    );

    const tray = Tray.mock.results[0].value;
    const startedHandler = ipcMain.on.mock.calls.find(
      ([event]) => event === "download-started",
    )[1];
    const finishedHandler = ipcMain.on.mock.calls.find(
      ([event]) => event === "download-finished",
    )[1];

    mainWindow.isVisible.mockReturnValue(false);
    tray.handlers.click();
    expect(mainWindow.restore).toHaveBeenCalledTimes(1);
    expect(mainWindow.show).toHaveBeenCalledTimes(1);
    expect(mainWindow.focus).toHaveBeenCalledTimes(1);

    mainWindow.isVisible.mockReturnValue(true);
    tray.handlers.click();
    expect(mainWindow.hide).toHaveBeenCalledTimes(1);

    tray.handlers["double-click"]();
    expect(mainWindow.show).toHaveBeenCalledTimes(2);
    expect(mainWindow.focus).toHaveBeenCalledTimes(2);

    const contextMenuCallsBeforeRightClick =
      tray.setContextMenu.mock.calls.length;
    tray.handlers["right-click"]();
    expect(tray.setContextMenu.mock.calls.length).toBe(
      contextMenuCallsBeforeRightClick + 1,
    );
    expect(tray.popUpContextMenu).toHaveBeenCalledTimes(1);

    startedHandler();
    expect(tray.setImage).toHaveBeenCalledWith(
      expect.stringContaining("assets/icons/tray/tray-loading.png"),
    );

    const contextMenuCallsBeforeFinish = tray.setContextMenu.mock.calls.length;
    finishedHandler();
    expect(tray.setImage).toHaveBeenCalledWith(
      expect.stringContaining("assets/icons/tray"),
    );
    expect(tray.setContextMenu.mock.calls.length).toBe(
      contextMenuCallsBeforeFinish + 1,
    );

    const contextMenuCallsBeforeAppRefresh =
      tray.setContextMenu.mock.calls.length;
    app.emit("thunder-load:tray-refresh");
    expect(tray.setContextMenu.mock.calls.length).toBe(
      contextMenuCallsBeforeAppRefresh + 1,
    );
  });

  test("creates a template tray image on macOS and keeps it on download events", () => {
    setPlatform("darwin");
    const app = new EventEmitter();
    app.getName = () => "Thunder Load";
    app.getVersion = () => "1.3.6";
    app.getAppPath = () => "/tmp/app";
    app.quit = jest.fn();
    app.isPackaged = false;
    app.isQuitting = false;
    app.dock = { setIcon: jest.fn(), setMenu: jest.fn() };

    const store = createStore({ downloadPath: "/tmp/downloads" });

    createWindow(
      false,
      app,
      store,
      "/tmp/downloads",
      () => "1.3.6",
      "",
      "",
      "",
      () => true,
    );

    const tray = Tray.mock.results[0].value;
    const trayImageCallIndex = nativeImage.createFromPath.mock.calls.findIndex(
      ([iconPath]) =>
        String(iconPath).includes(
          "assets/icons/tray/tray-icon-macos-template.png",
        ),
    );
    const trayImage =
      nativeImage.createFromPath.mock.results[trayImageCallIndex].value;
    const startedHandler = ipcMain.on.mock.calls.find(
      ([event]) => event === "download-started",
    )[1];
    const finishedHandler = ipcMain.on.mock.calls.find(
      ([event]) => event === "download-finished",
    )[1];

    expect(nativeImage.createFromPath).toHaveBeenCalledWith(
      expect.stringContaining("assets/icons/tray/tray-icon-macos-template.png"),
    );
    expect(trayImage.setTemplateImage).toHaveBeenCalledWith(true);
    expect(Tray).toHaveBeenCalledWith(trayImage);

    const contextMenuCallsBeforeClick = tray.setContextMenu.mock.calls.length;
    tray.handlers.click();
    expect(tray.setContextMenu.mock.calls.length).toBe(
      contextMenuCallsBeforeClick + 1,
    );
    expect(tray.popUpContextMenu).toHaveBeenCalledTimes(1);

    const setImageCallsBeforeStart = tray.setImage.mock.calls.length;
    startedHandler();
    expect(tray.setImage.mock.calls.length).toBe(setImageCallsBeforeStart);

    finishedHandler();
    expect(tray.setImage).toHaveBeenCalledWith(trayImage);
  });

  test("window-close IPC respects minimize-to-tray behavior on Windows", () => {
    setPlatform("win32");
    const app = new EventEmitter();
    app.getName = () => "Thunder Load";
    app.getVersion = () => "1.3.6";
    app.getAppPath = () => "/tmp/app";
    app.quit = jest.fn();
    app.isPackaged = false;
    app.isQuitting = false;
    app.dock = { setIcon: jest.fn(), setMenu: jest.fn() };

    const store = createStore({
      downloadPath: "/tmp/downloads",
      minimizeInsteadOfClose: true,
      closeNotification: false,
    });

    const mainWindow = createWindow(
      false,
      app,
      store,
      "/tmp/downloads",
      () => "1.3.6",
      "",
      "",
      "",
      () => true,
    );

    const closeIpcHandler = ipcMain.on.mock.calls.find(
      ([event]) => event === "window-close",
    )?.[1];
    expect(typeof closeIpcHandler).toBe("function");

    closeIpcHandler();
    expect(app.isQuitting).toBe(false);
    expect(mainWindow.close).toHaveBeenCalledTimes(1);

    const preventDefault = jest.fn();
    mainWindow._events.close({ preventDefault });
    expect(preventDefault).toHaveBeenCalledTimes(1);
    expect(mainWindow.hide).toHaveBeenCalledTimes(1);
    expect(app.quit).not.toHaveBeenCalled();
  });
});
