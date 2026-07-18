const handlers = {};

jest.mock("electron-log", () => ({
  error: jest.fn(),
  info: jest.fn(),
}));

describe("appUpdateIpcHandlers", () => {
  beforeEach(() => {
    Object.keys(handlers).forEach((key) => delete handlers[key]);
    jest.clearAllMocks();
  });

  function register(autoUpdaterOverrides = {}, platform = "win32") {
    const { CHANNELS } = require("../../ipc/channels");
    const { registerAppUpdateIpcHandlers } = require("../appUpdateIpcHandlers");
    const ipcMain = {
      handle: jest.fn((channel, callback) => {
        handlers[channel] = callback;
      }),
    };
    const autoUpdater = {
      checkForUpdates: jest.fn(),
      downloadUpdate: jest.fn(),
      quitAndInstall: jest.fn(),
      ...autoUpdaterOverrides,
    };

    registerAppUpdateIpcHandlers({ ipcMain, autoUpdater, platform });

    return { CHANNELS, autoUpdater, ipcMain };
  }

  test("registers app update channels", () => {
    const { CHANNELS, ipcMain } = register();

    expect(ipcMain.handle).toHaveBeenCalledWith(
      CHANNELS.CHECK_APP_UPDATES,
      expect.any(Function),
    );
    expect(ipcMain.handle).toHaveBeenCalledWith(
      CHANNELS.DOWNLOAD_UPDATE,
      expect.any(Function),
    );
    expect(ipcMain.handle).toHaveBeenCalledWith(
      CHANNELS.RESTART_APP,
      expect.any(Function),
    );
  });

  test("triggers manual update check without awaiting updater result", async () => {
    const { CHANNELS, autoUpdater } = register();

    const result = await handlers[CHANNELS.CHECK_APP_UPDATES]();

    expect(result).toEqual({ success: true });
    expect(autoUpdater.checkForUpdates).toHaveBeenCalledTimes(1);
    expect(autoUpdater.downloadUpdate).not.toHaveBeenCalled();
    expect(autoUpdater.quitAndInstall).not.toHaveBeenCalled();
  });

  test("triggers update download", async () => {
    const { CHANNELS, autoUpdater } = register();

    const result = await handlers[CHANNELS.DOWNLOAD_UPDATE]();

    expect(result).toEqual({ success: true });
    expect(autoUpdater.downloadUpdate).toHaveBeenCalledTimes(1);
    expect(autoUpdater.checkForUpdates).not.toHaveBeenCalled();
    expect(autoUpdater.quitAndInstall).not.toHaveBeenCalled();
  });

  test("triggers restart and install", async () => {
    const { CHANNELS, autoUpdater } = register();

    const result = await handlers[CHANNELS.RESTART_APP]();

    expect(result).toEqual({ success: true });
    expect(autoUpdater.quitAndInstall).toHaveBeenCalledTimes(1);
    expect(autoUpdater.checkForUpdates).not.toHaveBeenCalled();
    expect(autoUpdater.downloadUpdate).not.toHaveBeenCalled();
  });

  test("does not await updater promises", async () => {
    const rejected = Promise.reject(new Error("async boom"));
    rejected.catch(() => {});
    const { CHANNELS, autoUpdater } = register({
      checkForUpdates: jest.fn(() => rejected),
    });

    const result = await handlers[CHANNELS.CHECK_APP_UPDATES]();

    expect(result).toEqual({ success: true });
    expect(autoUpdater.checkForUpdates).toHaveBeenCalledTimes(1);
  });

  test.each([
    ["CHECK_APP_UPDATES", "checkForUpdates"],
    ["DOWNLOAD_UPDATE", "downloadUpdate"],
    ["RESTART_APP", "quitAndInstall"],
  ])("disables %s on macOS", async (key, method) => {
    const { CHANNELS, autoUpdater } = register({}, "darwin");

    const result = await handlers[CHANNELS[key]]();

    expect(result).toEqual({
      success: false,
      unsupported: true,
      error: "Application updates are disabled on macOS",
    });
    expect(autoUpdater[method]).not.toHaveBeenCalled();
  });

  test.each([
    ["check-app-updates", "checkForUpdates", "CHECK_APP_UPDATES"],
    ["download-update", "downloadUpdate", "DOWNLOAD_UPDATE"],
    ["restart-app", "quitAndInstall", "RESTART_APP"],
  ])(
    "returns structured error for %s failures",
    async (_label, method, key) => {
      const { CHANNELS } = require("../../ipc/channels");
      const { autoUpdater } = register({
        [method]: jest.fn(() => {
          throw new Error("boom");
        }),
      });

      const result = await handlers[CHANNELS[key]]();

      expect(result).toEqual({ success: false, error: "boom" });
      expect(autoUpdater[method]).toHaveBeenCalledTimes(1);
    },
  );
});
