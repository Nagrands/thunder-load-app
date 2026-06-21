const fs = require("fs");
const os = require("os");
const path = require("path");

const listeners = {};

jest.mock("electron-log", () => ({
  error: jest.fn(),
  info: jest.fn(),
}));

describe("wgUnlockIpcHandlers", () => {
  const originalPlatform = process.platform;
  let userDataPath;

  beforeEach(() => {
    Object.keys(listeners).forEach((key) => delete listeners[key]);
    jest.clearAllMocks();
    Object.defineProperty(process, "platform", {
      value: originalPlatform,
      configurable: true,
    });
    userDataPath = fs.mkdtempSync(path.join(os.tmpdir(), "wg-ipc-"));
  });

  afterEach(() => {
    fs.rmSync(userDataPath, { recursive: true, force: true });
    Object.defineProperty(process, "platform", {
      value: originalPlatform,
      configurable: true,
    });
  });

  function register(overrides = {}) {
    const { CHANNELS } = require("../../ipc/channels");
    const { registerWgUnlockIpcHandlers } = require("../wgUnlockIpcHandlers");
    const ipcMain = {
      on: jest.fn((channel, callback) => {
        listeners[channel] = callback;
      }),
    };
    const app = {
      getPath: jest.fn(() => userDataPath),
    };
    const dialog = {
      showSaveDialog: jest.fn(async () => ({ filePath: null })),
      ...overrides.dialog,
    };
    const shell = {
      openExternal: jest.fn(),
      openPath: jest.fn(),
      ...overrides.shell,
    };

    registerWgUnlockIpcHandlers({ ipcMain, app, dialog, shell });

    return { CHANNELS, app, dialog, ipcMain, shell };
  }

  test("registers WG channels", () => {
    const { CHANNELS, ipcMain } = register();

    expect(ipcMain.on).toHaveBeenCalledWith(
      CHANNELS.WG_OPEN_CONFIG_FOLDER,
      expect.any(Function),
    );
    expect(ipcMain.on).toHaveBeenCalledWith(
      CHANNELS.WG_OPEN_NETWORK_SETTINGS,
      expect.any(Function),
    );
    expect(ipcMain.on).toHaveBeenCalledWith(
      CHANNELS.WG_EXPORT_LOG,
      expect.any(Function),
    );
  });

  test("creates and opens WireGuard config file", () => {
    const { CHANNELS, shell } = register();
    const configPath = path.join(userDataPath, "wireguard.conf");

    listeners[CHANNELS.WG_OPEN_CONFIG_FOLDER]();

    expect(fs.existsSync(configPath)).toBe(true);
    expect(shell.openPath).toHaveBeenCalledWith(configPath);
  });

  test("opens Windows network settings", () => {
    Object.defineProperty(process, "platform", {
      value: "win32",
      configurable: true,
    });
    const { CHANNELS, shell } = register();

    listeners[CHANNELS.WG_OPEN_NETWORK_SETTINGS]();

    expect(shell.openExternal).toHaveBeenCalledWith("ms-settings:network");
  });

  test("opens modern macOS network settings", () => {
    Object.defineProperty(process, "platform", {
      value: "darwin",
      configurable: true,
    });
    jest.spyOn(os, "release").mockReturnValueOnce("22.0.0");
    const { CHANNELS, shell } = register();

    listeners[CHANNELS.WG_OPEN_NETWORK_SETTINGS]();

    expect(shell.openExternal).toHaveBeenCalledWith(
      "x-apple.systempreferences:com.apple.Network-Settings.extension",
    );
  });

  test("exports WireGuard log to selected file", async () => {
    const exportPath = path.join(userDataPath, "wg-log.txt");
    const { CHANNELS, dialog } = register({
      dialog: {
        showSaveDialog: jest.fn(async () => ({ filePath: exportPath })),
      },
    });
    const event = { reply: jest.fn() };

    await listeners[CHANNELS.WG_EXPORT_LOG](event, "log text");

    expect(dialog.showSaveDialog).toHaveBeenCalledWith(
      expect.objectContaining({
        title: "Экспорт лога WireGuard",
        filters: expect.any(Array),
      }),
    );
    expect(fs.readFileSync(exportPath, "utf8")).toBe("log text");
    expect(event.reply).toHaveBeenCalledWith("wg-log-export-success", {
      filePath: exportPath,
    });
  });

  test("replies with export cancellation", async () => {
    const { CHANNELS } = register();
    const event = { reply: jest.fn() };

    await listeners[CHANNELS.WG_EXPORT_LOG](event, "log text");

    expect(event.reply).toHaveBeenCalledWith("wg-log-export-error", {
      error: "Экспорт отменен пользователем",
    });
  });
});
