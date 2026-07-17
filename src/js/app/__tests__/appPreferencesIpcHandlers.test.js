const fs = require("fs");
const os = require("os");
const path = require("path");

const handlers = {};

jest.mock("electron-log", () => ({
  error: jest.fn(),
  info: jest.fn(),
  warn: jest.fn(),
}));

describe("appPreferencesIpcHandlers", () => {
  const originalPlatform = process.platform;
  const originalAppData = process.env.APPDATA;
  let root;

  beforeEach(() => {
    Object.keys(handlers).forEach((key) => delete handlers[key]);
    jest.clearAllMocks();
    root = fs.mkdtempSync(path.join(os.tmpdir(), "app-prefs-ipc-"));
    process.env.APPDATA = root;
    Object.defineProperty(process, "platform", {
      value: originalPlatform,
      configurable: true,
    });
  });

  afterEach(() => {
    fs.rmSync(root, { recursive: true, force: true });
    process.env.APPDATA = originalAppData;
    Object.defineProperty(process, "platform", {
      value: originalPlatform,
      configurable: true,
    });
  });

  function register(storeValues = {}, overrides = {}) {
    const { CHANNELS } = require("../../ipc/channels");
    const {
      registerAppPreferencesIpcHandlers,
    } = require("../appPreferencesIpcHandlers");
    const ipcMain = {
      handle: jest.fn((channel, callback) => {
        handlers[channel] = callback;
      }),
    };
    const app = {
      getName: jest.fn(() => "Thunder"),
      getPath: jest.fn((key) => {
        if (key === "exe") return path.join(root, "Thunder.exe");
        return root;
      }),
    };
    const clipboardMonitor = {
      start: jest.fn(),
      stop: jest.fn(),
      ...overrides.clipboardMonitor,
    };
    const globalShortcut = {
      unregisterAll: jest.fn(),
      ...overrides.globalShortcut,
    };
    const mainWindow = {};
    const Notification =
      overrides.Notification ||
      jest.fn(function NotificationCtor(payload) {
        this.payload = payload;
        this.show = jest.fn();
      });
    Notification.isSupported =
      overrides.isNotificationSupported || jest.fn(() => true);
    const setupGlobalShortcuts = overrides.setupGlobalShortcuts || jest.fn();
    const shell = {
      writeShortcutLink: jest.fn(),
      ...overrides.shell,
    };
    const showTrayNotification = overrides.showTrayNotification || jest.fn();
    const store = {
      get: jest.fn((key, fallback) =>
        Object.prototype.hasOwnProperty.call(storeValues, key)
          ? storeValues[key]
          : fallback,
      ),
      set: jest.fn(),
    };

    registerAppPreferencesIpcHandlers({
      ipcMain,
      app,
      clipboardMonitor,
      globalShortcut,
      mainWindow,
      Notification,
      setupGlobalShortcuts,
      shell,
      showTrayNotification,
      store,
    });

    return {
      CHANNELS,
      app,
      clipboardMonitor,
      globalShortcut,
      ipcMain,
      mainWindow,
      Notification,
      setupGlobalShortcuts,
      shell,
      showTrayNotification,
      store,
    };
  }

  test("registers preference channels", () => {
    const { CHANNELS, ipcMain } = register();

    [
      CHANNELS.GET_DISABLE_COMPLETE_MODAL_STATUS,
      CHANNELS.SET_DISABLE_COMPLETE_MODAL_STATUS,
      CHANNELS.TOGGLE_AUTO_LAUNCH,
      CHANNELS.SET_MINIMIZE_ON_LAUNCH_STATUS,
      CHANNELS.GET_MINIMIZE_ON_LAUNCH_STATUS,
      CHANNELS.SET_MINIMIZE_INSTEAD_OF_CLOSE,
      CHANNELS.GET_AUTO_LAUNCH_STATUS,
      CHANNELS.SET_MINIMIZE_TO_TRAY_STATUS,
      CHANNELS.GET_MINIMIZE_TO_TRAY_STATUS,
      CHANNELS.SET_CLOSE_NOTIFICATION_STATUS,
      CHANNELS.GET_CLOSE_NOTIFICATION_STATUS,
      CHANNELS.SET_OPEN_ON_DOWNLOAD_COMPLETE_STATUS,
      CHANNELS.GET_OPEN_ON_DOWNLOAD_COMPLETE_STATUS,
      CHANNELS.SET_OPEN_ON_COPY_URL_STATUS,
      CHANNELS.GET_OPEN_ON_COPY_URL_STATUS,
      CHANNELS.GET_DISABLE_GLOBAL_SHORTCUTS_STATUS,
      CHANNELS.SET_DISABLE_GLOBAL_SHORTCUTS_STATUS,
      CHANNELS.SHOW_SYSTEM_NOTIFICATION,
      CHANNELS.GET_MINIMIZE_INSTEAD_OF_CLOSE_STATUS,
    ].forEach((channel) => {
      expect(ipcMain.handle).toHaveBeenCalledWith(
        channel,
        expect.any(Function),
      );
    });
  });

  test("reads and writes simple store flags", async () => {
    const { CHANNELS, store } = register({
      disableCompleteModal: false,
      minimizeOnLaunch: true,
      minimizeToTray: true,
      closeNotification: false,
      expandWindowOnDownloadComplete: true,
      openOnCopyUrl: true,
      disableGlobalShortcuts: true,
      minimizeInsteadOfClose: true,
    });

    expect(handlers[CHANNELS.GET_DISABLE_COMPLETE_MODAL_STATUS]()).toBe(false);
    expect(await handlers[CHANNELS.GET_MINIMIZE_ON_LAUNCH_STATUS]()).toBe(true);
    expect(await handlers[CHANNELS.GET_MINIMIZE_TO_TRAY_STATUS]()).toBe(true);
    expect(await handlers[CHANNELS.GET_CLOSE_NOTIFICATION_STATUS]()).toBe(
      false,
    );
    expect(
      await handlers[CHANNELS.GET_OPEN_ON_DOWNLOAD_COMPLETE_STATUS](),
    ).toBe(true);
    expect(await handlers[CHANNELS.GET_OPEN_ON_COPY_URL_STATUS]()).toBe(true);
    expect(handlers[CHANNELS.GET_DISABLE_GLOBAL_SHORTCUTS_STATUS]()).toBe(true);
    expect(
      await handlers[CHANNELS.GET_MINIMIZE_INSTEAD_OF_CLOSE_STATUS](),
    ).toBe(true);

    handlers[CHANNELS.SET_DISABLE_COMPLETE_MODAL_STATUS](null, true);
    handlers[CHANNELS.SET_MINIMIZE_TO_TRAY_STATUS](null, false);

    expect(store.set).toHaveBeenCalledWith("disableCompleteModal", true);
    expect(store.set).toHaveBeenCalledWith("minimizeToTray", false);
  });

  test("open-on-copy toggles clipboard monitor", async () => {
    const { CHANNELS, clipboardMonitor, store } = register();

    await handlers[CHANNELS.SET_OPEN_ON_COPY_URL_STATUS](null, true);
    await handlers[CHANNELS.SET_OPEN_ON_COPY_URL_STATUS](null, false);

    expect(store.set).toHaveBeenCalledWith("openOnCopyUrl", true);
    expect(store.set).toHaveBeenCalledWith("openOnCopyUrl", false);
    expect(clipboardMonitor.start).toHaveBeenCalledTimes(1);
    expect(clipboardMonitor.stop).toHaveBeenCalledTimes(1);
  });

  test("global shortcut toggle unregisters or restores shortcuts", () => {
    const {
      CHANNELS,
      globalShortcut,
      mainWindow,
      setupGlobalShortcuts,
      store,
    } = register();

    handlers[CHANNELS.SET_DISABLE_GLOBAL_SHORTCUTS_STATUS](null, true);
    handlers[CHANNELS.SET_DISABLE_GLOBAL_SHORTCUTS_STATUS](null, false);

    expect(store.set).toHaveBeenCalledWith("disableGlobalShortcuts", true);
    expect(store.set).toHaveBeenCalledWith("disableGlobalShortcuts", false);
    expect(globalShortcut.unregisterAll).toHaveBeenCalledTimes(1);
    expect(setupGlobalShortcuts).toHaveBeenCalledWith(mainWindow);
  });

  test("minimize instead of close updates tray notification", async () => {
    const { CHANNELS, showTrayNotification, store } = register();

    await handlers[CHANNELS.SET_MINIMIZE_INSTEAD_OF_CLOSE](null, true);

    expect(store.set).toHaveBeenCalledWith("minimizeInsteadOfClose", true);
    expect(showTrayNotification).toHaveBeenCalledWith(
      "Приложение теперь будет сворачиваться в трей при закрытии.",
    );
  });

  test("system notification shows native notification when supported", async () => {
    const { CHANNELS, Notification } = register();

    await handlers[CHANNELS.SHOW_SYSTEM_NOTIFICATION](null, {
      title: "Ready",
      body: "Done",
    });

    expect(Notification).toHaveBeenCalledWith({
      title: "Ready",
      body: "Done",
    });
  });

  test("auto launch writes Windows shortcut and sends toast", async () => {
    Object.defineProperty(process, "platform", {
      value: "win32",
      configurable: true,
    });
    const startupDir = path.join(
      root,
      "Microsoft\\Windows\\Start Menu\\Programs\\Startup",
    );
    fs.mkdirSync(startupDir, { recursive: true });
    const { CHANNELS, shell } = register();
    const event = { sender: { send: jest.fn() } };

    await handlers[CHANNELS.TOGGLE_AUTO_LAUNCH](event, true);

    expect(shell.writeShortcutLink).toHaveBeenCalledWith(
      path.join(startupDir, "Thunder.lnk"),
      expect.objectContaining({ target: path.join(root, "Thunder.exe") }),
    );
    expect(event.sender.send).toHaveBeenCalledWith(
      "toast",
      "Приложение добавлено в автозагрузку.",
      "success",
    );
  });

  test("auto launch status returns false off Windows", async () => {
    Object.defineProperty(process, "platform", {
      value: "darwin",
      configurable: true,
    });
    const { CHANNELS } = register();

    await expect(handlers[CHANNELS.GET_AUTO_LAUNCH_STATUS]()).resolves.toBe(
      false,
    );
  });
});
