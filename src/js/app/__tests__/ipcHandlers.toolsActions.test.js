const path = require("path");
const fs = require("fs");
const os = require("os");

const handlers = {};

jest.mock("electron", () => ({
  ipcMain: {
    handle: jest.fn((channel, cb) => {
      handlers[channel] = cb;
    }),
    on: jest.fn(),
  },
  dialog: {
    showOpenDialog: jest.fn(),
  },
  Notification: { isSupported: () => false },
  shell: {
    openExternal: jest.fn(),
    showItemInFolder: jest.fn(),
    openPath: jest.fn(),
    writeShortcutLink: jest.fn(),
  },
  globalShortcut: { unregisterAll: jest.fn() },
  app: {
    getPath: jest.fn((key) => {
      const path = require("path");
      const os = require("os");
      if (key === "desktop") return path.join(os.tmpdir(), "desktop");
      if (key === "exe") return "/tmp/app.exe";
      if (key === "userData") return path.join(os.tmpdir(), "userData");
      return os.tmpdir();
    }),
    getAppPath: jest.fn(() => process.cwd()),
    getName: jest.fn(() => "Thunder Load"),
  },
}));

jest.mock("electron-updater", () => ({
  autoUpdater: {
    quitAndInstall: jest.fn(),
    downloadUpdate: jest.fn(),
  },
}));

jest.mock("marked", () => ({
  marked: {
    parse: jest.fn((v) => v),
  },
}));

jest.mock("../toolsVersions", () => ({
  getToolsVersions: jest.fn().mockResolvedValue({}),
}));

jest.mock("../../scripts/download.js", () => ({
  installYtDlp: jest.fn(),
  installFfmpeg: jest.fn(),
  installDeno: jest.fn(),
  getVideoInfo: jest.fn(),
  downloadMedia: jest.fn(),
  stopDownload: jest.fn(),
  setActiveDownloadToken: jest.fn(),
  selectFormatsByQuality: jest.fn(),
  createDownloadToken: jest.fn(() => ({ cancelled: false })),
  setSharedStore: jest.fn(),
}));

jest.mock("../backupManager", () => ({
  readPrograms: jest.fn().mockResolvedValue([]),
  savePrograms: jest.fn().mockResolvedValue(),
  listLastTimes: jest.fn().mockResolvedValue({}),
  preFlightChecksDetailed: jest.fn().mockResolvedValue({}),
  runBackupBatch: jest.fn().mockResolvedValue([]),
  chooseDir: jest.fn().mockResolvedValue(null),
  openPath: jest.fn().mockResolvedValue({ success: true }),
}));

jest.mock("../toolsPaths", () => ({
  getDefaultToolsDir: jest.fn(() => "/tmp/tools"),
  getEffectiveToolsDir: jest.fn(() => "/tmp/tools"),
  ensureToolsDir: jest.fn(async (v) => v || "/tmp/tools"),
  detectLegacyLocations: jest.fn(async () => []),
  migrateLegacy: jest.fn(async () => ({ copied: [], skipped: [] })),
}));

jest.mock("../shortcuts.js", () => ({
  setReloadShortcutSuppressed: jest.fn(),
}));

jest.mock("electron-log", () => ({
  info: jest.fn(),
  warn: jest.fn(),
  error: jest.fn(),
}));

describe("ipcHandlers tools quick actions", () => {
  const originalPlatform = process.platform;

  beforeEach(() => {
    Object.keys(handlers).forEach((k) => delete handlers[k]);
    jest.clearAllMocks();
  });

  afterEach(() => {
    Object.defineProperty(process, "platform", {
      value: originalPlatform,
      configurable: true,
    });
  });

  function initHandlers() {
    const { setupIpcHandlers } = require("../ipcHandlers");
    setupIpcHandlers({
      mainWindow: {
        webContents: {
          send: jest.fn(),
          isDestroyed: () => false,
          on: jest.fn(),
        },
      },
      store: {
        get: jest.fn((key, def) => def),
        set: jest.fn(),
        delete: jest.fn(),
      },
      downloadState: { downloadPath: "/tmp", downloadInProgress: false },
      getAppVersion: jest.fn().mockResolvedValue("1.0.0"),
      setDownloadPath: jest.fn(),
      historyFilePath: path.join(os.tmpdir(), "history.json"),
      previewCacheDir: path.join(os.tmpdir(), "preview-cache"),
      iconCache: new Map(),
      clipboardMonitor: {},
      setupGlobalShortcuts: jest.fn(),
      notifyDownloadError: jest.fn(),
      sendDownloadCompletionNotification: jest.fn(),
      showTrayNotification: jest.fn(),
      setReloadMenuEnabled: jest.fn(),
      dispatchPendingWhatsNew: jest.fn(),
      clearPendingWhatsNewVersion: jest.fn(),
    });
  }

  test("hashPickFile returns selected path", async () => {
    const { dialog } = require("electron");
    const { CHANNELS } = require("../../ipc/channels");
    dialog.showOpenDialog.mockResolvedValue({
      canceled: false,
      filePaths: ["/tmp/sample.bin"],
    });

    initHandlers();
    const result = await handlers[CHANNELS.TOOLS_HASH_PICK_FILE]();

    expect(result).toEqual({ success: true, filePath: "/tmp/sample.bin" });
  });

  test("hashCalculate returns SHA-256 hash and match", async () => {
    const { CHANNELS } = require("../../ipc/channels");
    const filePath = path.join(os.tmpdir(), `hash-test-${Date.now()}.txt`);
    fs.writeFileSync(filePath, "abc", "utf8");

    initHandlers();
    const result = await handlers[CHANNELS.TOOLS_HASH_CALCULATE](null, {
      filePath,
      algorithm: "SHA-256",
      expectedHash:
        "ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad",
    });

    expect(result.success).toBe(true);
    expect(result.matches).toBe(true);
    expect(result.actualHash).toBe(
      "ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad",
    );
  });

  test("createWindowsRestartShortcut returns unsupported on non-windows", async () => {
    const { CHANNELS } = require("../../ipc/channels");

    initHandlers();
    const result = await handlers[CHANNELS.TOOLS_CREATE_WINDOWS_RESTART_SHORTCUT]();

    expect(result.success).toBe(false);
    expect(result.unsupported).toBe(true);
  });

  test("createWindowsRestartShortcut sets icon fields on windows", async () => {
    const { CHANNELS } = require("../../ipc/channels");
    const { shell } = require("electron");
    Object.defineProperty(process, "platform", {
      value: "win32",
      configurable: true,
    });
    shell.writeShortcutLink.mockReturnValue(true);

    initHandlers();
    const result = await handlers[CHANNELS.TOOLS_CREATE_WINDOWS_RESTART_SHORTCUT]();

    expect(result.success).toBe(true);
    expect(shell.writeShortcutLink).toHaveBeenCalledWith(
      expect.any(String),
      "create",
      expect.objectContaining({
        args: "/r /t 0",
        icon: expect.any(String),
        iconIndex: 0,
      }),
    );
  });

  test("createWindowsShutdownShortcut returns unsupported on non-windows", async () => {
    const { CHANNELS } = require("../../ipc/channels");

    initHandlers();
    const result =
      await handlers[CHANNELS.TOOLS_CREATE_WINDOWS_SHUTDOWN_SHORTCUT]();

    expect(result.success).toBe(false);
    expect(result.unsupported).toBe(true);
  });

  test("createWindowsShutdownShortcut sets icon fields on windows", async () => {
    const { CHANNELS } = require("../../ipc/channels");
    const { shell } = require("electron");
    Object.defineProperty(process, "platform", {
      value: "win32",
      configurable: true,
    });
    shell.writeShortcutLink.mockReturnValue(true);

    initHandlers();
    const result =
      await handlers[CHANNELS.TOOLS_CREATE_WINDOWS_SHUTDOWN_SHORTCUT]();

    expect(result.success).toBe(true);
    expect(shell.writeShortcutLink).toHaveBeenCalledWith(
      expect.any(String),
      "create",
      expect.objectContaining({
        args: "/s /t 0",
        icon: expect.any(String),
        iconIndex: 0,
      }),
    );
  });
});
