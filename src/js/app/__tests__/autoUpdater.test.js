const { EventEmitter } = require("events");

const mockAutoUpdater = new EventEmitter();
mockAutoUpdater.checkForUpdates = jest.fn();
mockAutoUpdater.downloadUpdate = jest.fn();
mockAutoUpdater.quitAndInstall = jest.fn();
mockAutoUpdater.autoDownload = true;
mockAutoUpdater.logger = null;

jest.mock("electron-updater", () => ({
  autoUpdater: mockAutoUpdater,
}));

jest.mock("electron", () => ({
  Notification: { isSupported: jest.fn(() => false) },
  app: { getVersion: jest.fn(() => "1.6.0") },
}));

jest.mock("electron-log", () => ({
  info: jest.fn(),
  warn: jest.fn(),
  error: jest.fn(),
  transports: {
    file: {
      level: "info",
    },
  },
}));

jest.mock("../iconPaths", () => ({
  resolveIconPathFromAppDir: jest.fn(() => "/tmp/icon.ico"),
}));

function createMainWindow({ isLoading = true, destroyed = false } = {}) {
  const win = new EventEmitter();
  win.isDestroyed = jest.fn(() => destroyed);
  win.webContents = {
    isLoading: jest.fn(() => isLoading),
    send: jest.fn(),
  };
  return win;
}

describe("autoUpdater startup scheduling", () => {
  beforeEach(() => {
    jest.resetModules();
    jest.useFakeTimers();
    mockAutoUpdater.removeAllListeners();
    mockAutoUpdater.checkForUpdates.mockReset();
    mockAutoUpdater.autoDownload = true;
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  test("setupAutoUpdater registers events without checking immediately", () => {
    const { setupAutoUpdater } = require("../autoUpdater");
    const mainWindow = createMainWindow();

    setupAutoUpdater(mainWindow);

    expect(mockAutoUpdater.autoDownload).toBe(false);
    expect(mockAutoUpdater.checkForUpdates).not.toHaveBeenCalled();
  });

  test("scheduleAutoUpdateCheck checks after ready-to-show and delay", () => {
    const { scheduleAutoUpdateCheck, setupAutoUpdater } =
      require("../autoUpdater");
    const mainWindow = createMainWindow();

    setupAutoUpdater(mainWindow);
    scheduleAutoUpdateCheck(mainWindow, { delayMs: 100, readyFallbackMs: 500 });
    mainWindow.emit("ready-to-show");

    jest.advanceTimersByTime(99);
    expect(mockAutoUpdater.checkForUpdates).not.toHaveBeenCalled();

    jest.advanceTimersByTime(1);
    expect(mockAutoUpdater.checkForUpdates).toHaveBeenCalledTimes(1);

    jest.advanceTimersByTime(500);
    expect(mockAutoUpdater.checkForUpdates).toHaveBeenCalledTimes(1);
  });

  test("scheduleAutoUpdateCheck falls back when ready-to-show does not fire", () => {
    const { scheduleAutoUpdateCheck, setupAutoUpdater } =
      require("../autoUpdater");
    const mainWindow = createMainWindow();

    setupAutoUpdater(mainWindow);
    scheduleAutoUpdateCheck(mainWindow, { delayMs: 100, readyFallbackMs: 500 });

    jest.advanceTimersByTime(599);
    expect(mockAutoUpdater.checkForUpdates).not.toHaveBeenCalled();

    jest.advanceTimersByTime(1);
    expect(mockAutoUpdater.checkForUpdates).toHaveBeenCalledTimes(1);
  });

  test("scheduleAutoUpdateCheck skips destroyed windows", () => {
    const { scheduleAutoUpdateCheck, setupAutoUpdater } =
      require("../autoUpdater");
    const mainWindow = createMainWindow({ isLoading: false, destroyed: true });

    setupAutoUpdater(mainWindow);
    scheduleAutoUpdateCheck(mainWindow, { delayMs: 100, readyFallbackMs: 500 });
    jest.advanceTimersByTime(100);

    expect(mockAutoUpdater.checkForUpdates).not.toHaveBeenCalled();
  });

  test("scheduleAutoUpdateCheck skips missing windows", () => {
    const { scheduleAutoUpdateCheck } = require("../autoUpdater");

    scheduleAutoUpdateCheck(null, { delayMs: 100, readyFallbackMs: 500 });
    jest.advanceTimersByTime(600);

    expect(mockAutoUpdater.checkForUpdates).not.toHaveBeenCalled();
  });
});
