const handlers = {};
let mockBackupManagerLoaded = false;

jest.mock("../backupManager", () => {
  mockBackupManagerLoaded = true;
  return {
    readPrograms: jest.fn(async () => [{ name: "App" }]),
    savePrograms: jest.fn(async () => undefined),
    listLastTimes: jest.fn(async () => ({ App: 123 })),
    preFlightChecksDetailed: jest.fn(async () => ({ success: true })),
    runBackupBatch: jest.fn(async () => [{ success: true }]),
    chooseDir: jest.fn(async () => "/tmp/backups"),
    openPath: jest.fn(async () => ({ success: true })),
  };
});

jest.mock("electron-log", () => ({
  error: jest.fn(),
}));

describe("backupIpcHandlers", () => {
  beforeEach(() => {
    Object.keys(handlers).forEach((key) => delete handlers[key]);
    mockBackupManagerLoaded = false;
    jest.resetModules();
  });

  function register() {
    const { CHANNELS } = require("../../ipc/channels");
    const { registerBackupIpcHandlers } = require("../backupIpcHandlers");
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
    registerBackupIpcHandlers({
      ipcMain,
      mainWindow,
    });

    return { CHANNELS, ipcMain, mainWindow };
  }

  test("registers backup channels without loading backupManager", async () => {
    const { CHANNELS, ipcMain } = register();

    expect(ipcMain.handle).toHaveBeenCalledWith(
      CHANNELS.BACKUP_GET_PROGRAMS,
      expect.any(Function),
    );
    expect(ipcMain.handle).toHaveBeenCalledWith(
      CHANNELS.BACKUP_RUN,
      expect.any(Function),
    );
    expect(mockBackupManagerLoaded).toBe(false);
  });

  test("loads backupManager only when a backup action runs", async () => {
    const { CHANNELS } = register();

    expect(mockBackupManagerLoaded).toBe(false);

    const result = await handlers[CHANNELS.BACKUP_GET_PROGRAMS]();

    expect(result).toEqual({
      success: true,
      programs: [{ name: "App" }],
    });
    expect(mockBackupManagerLoaded).toBe(true);
  });
});
