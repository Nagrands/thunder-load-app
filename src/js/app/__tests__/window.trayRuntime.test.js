const fs = require("fs");
const { EventEmitter } = require("events");

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
    nativeImage: { createFromPath: jest.fn(() => ({ isEmpty: () => false })) },
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

const { createWindow } = require("../window.js");
const { Tray, ipcMain } = require("electron");

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

  beforeEach(() => {
    Tray.mockClear();
    ipcMain.on.mockClear();
    existsSyncSpy = jest.spyOn(fs, "existsSync").mockReturnValue(true);
  });

  afterEach(() => {
    existsSyncSpy.mockRestore();
  });

  test("handles click/double-click/right-click and refresh events", () => {
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

    const contextMenuCallsBeforeRightClick = tray.setContextMenu.mock.calls.length;
    tray.handlers["right-click"]();
    expect(tray.setContextMenu.mock.calls.length).toBe(
      contextMenuCallsBeforeRightClick + 1,
    );
    expect(tray.popUpContextMenu).toHaveBeenCalledTimes(1);

    startedHandler();
    expect(tray.setImage).toHaveBeenCalledWith(
      expect.stringContaining("assets/icons/tray-loading.png"),
    );

    const contextMenuCallsBeforeFinish = tray.setContextMenu.mock.calls.length;
    finishedHandler();
    expect(tray.setImage).toHaveBeenCalledWith(
      expect.stringContaining("assets/icons/tray"),
    );
    expect(tray.setContextMenu.mock.calls.length).toBe(
      contextMenuCallsBeforeFinish + 1,
    );

    const contextMenuCallsBeforeAppRefresh = tray.setContextMenu.mock.calls.length;
    app.emit("thunder-load:tray-refresh");
    expect(tray.setContextMenu.mock.calls.length).toBe(
      contextMenuCallsBeforeAppRefresh + 1,
    );
  });
});
