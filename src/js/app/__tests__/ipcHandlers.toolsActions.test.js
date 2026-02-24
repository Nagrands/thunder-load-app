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
    const toolsPaths = require("../toolsPaths");
    toolsPaths.getDefaultToolsDir.mockImplementation(() => "/tmp/tools");
    toolsPaths.getEffectiveToolsDir.mockImplementation(() => "/tmp/tools");
    toolsPaths.ensureToolsDir.mockImplementation(async (v) => v || "/tmp/tools");
    toolsPaths.detectLegacyLocations.mockImplementation(async () => []);
    toolsPaths.migrateLegacy.mockImplementation(
      async () => ({ copied: [], skipped: [] }),
    );
  });

  afterEach(() => {
    Object.defineProperty(process, "platform", {
      value: originalPlatform,
      configurable: true,
    });
  });

  function initHandlers({ storeValues = {} } = {}) {
    const { setupIpcHandlers } = require("../ipcHandlers");
    const storeGet = jest.fn((key, def) =>
      Object.prototype.hasOwnProperty.call(storeValues, key)
        ? storeValues[key]
        : def,
    );
    const store = {
      get: storeGet,
      set: jest.fn(),
      delete: jest.fn(),
    };
    setupIpcHandlers({
      mainWindow: {
        webContents: {
          send: jest.fn(),
          isDestroyed: () => false,
          on: jest.fn(),
        },
      },
      store,
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
    return { store };
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

  test("sorterPickFolder returns selected directory path", async () => {
    const { dialog } = require("electron");
    const { CHANNELS } = require("../../ipc/channels");
    dialog.showOpenDialog.mockResolvedValue({
      canceled: false,
      filePaths: ["/tmp/sorter-folder"],
    });

    initHandlers();
    const result = await handlers[CHANNELS.TOOLS_SORTER_PICK_FOLDER]();

    expect(result).toEqual({
      success: true,
      folderPath: "/tmp/sorter-folder",
    });
  });

  test("sorterRun supports dry-run with category stats", async () => {
    const { CHANNELS } = require("../../ipc/channels");
    const root = fs.mkdtempSync(path.join(os.tmpdir(), "sorter-dry-"));
    fs.writeFileSync(path.join(root, "photo.heic"), "img", "utf8");
    fs.writeFileSync(path.join(root, "readme.md"), "# test", "utf8");
    fs.writeFileSync(path.join(root, "archive.zip"), "zip", "utf8");
    fs.writeFileSync(path.join(root, ".hidden"), "ignore", "utf8");

    initHandlers();
    const result = await handlers[CHANNELS.TOOLS_SORTER_RUN](null, {
      folderPath: root,
      dryRun: true,
    });

    expect(result.success).toBe(true);
    expect(result.dryRun).toBe(true);
    expect(result.moved).toBe(3);
    expect(result.skipped).toBe(1);
    expect(result.categoryCount.Images).toBe(1);
    expect(result.categoryCount.Documents).toBe(1);
    expect(result.categoryCount.Archives).toBe(1);

    fs.rmSync(root, { recursive: true, force: true });
  });

  test("sorterRun moves files and generates unique names", async () => {
    const { CHANNELS } = require("../../ipc/channels");
    const root = fs.mkdtempSync(path.join(os.tmpdir(), "sorter-run-"));
    fs.writeFileSync(path.join(root, "a.txt"), "source", "utf8");
    fs.mkdirSync(path.join(root, "Documents"), { recursive: true });
    fs.writeFileSync(path.join(root, "Documents", "a.txt"), "exists", "utf8");
    const logPath = path.join(root, "sort.log");

    initHandlers();
    const result = await handlers[CHANNELS.TOOLS_SORTER_RUN](null, {
      folderPath: root,
      dryRun: false,
      logFilePath: logPath,
    });

    expect(result.success).toBe(true);
    expect(result.moved).toBe(1);
    expect(result.errors).toEqual([]);
    expect(fs.existsSync(path.join(root, "a.txt"))).toBe(false);
    expect(fs.existsSync(path.join(root, "Documents", "a (1).txt"))).toBe(true);
    expect(fs.existsSync(logPath)).toBe(true);

    fs.rmSync(root, { recursive: true, force: true });
  });

  test("sorterRun returns error when log path points to a directory", async () => {
    const { CHANNELS } = require("../../ipc/channels");
    const root = fs.mkdtempSync(path.join(os.tmpdir(), "sorter-logdir-"));
    fs.writeFileSync(path.join(root, "a.txt"), "source", "utf8");
    const logDir = path.join(root, "log-dir");
    fs.mkdirSync(logDir, { recursive: true });

    initHandlers();
    const result = await handlers[CHANNELS.TOOLS_SORTER_RUN](null, {
      folderPath: root,
      dryRun: false,
      logFilePath: logDir,
    });

    expect(result.success).toBe(false);
    expect(String(result.error || "")).toMatch(
      /EISDIR|illegal operation on a directory/i,
    );

    fs.rmSync(root, { recursive: true, force: true });
  });

  test("sorterOpenFolder opens selected directory", async () => {
    const { CHANNELS } = require("../../ipc/channels");
    const { shell } = require("electron");
    const root = fs.mkdtempSync(path.join(os.tmpdir(), "sorter-open-"));
    shell.openPath.mockResolvedValue("");

    initHandlers();
    const result = await handlers[CHANNELS.TOOLS_SORTER_OPEN_FOLDER](
      null,
      root,
    );

    expect(result).toEqual({ success: true, folderPath: root });
    expect(shell.openPath).toHaveBeenCalledWith(root);

    fs.rmSync(root, { recursive: true, force: true });
  });

  test("sorterOpenFolder returns error for unknown path", async () => {
    const { CHANNELS } = require("../../ipc/channels");
    const unknownPath = path.join(os.tmpdir(), `missing-${Date.now()}`);

    initHandlers();
    const result = await handlers[CHANNELS.TOOLS_SORTER_OPEN_FOLDER](
      null,
      unknownPath,
    );

    expect(result.success).toBe(false);
    expect(String(result.error || "")).toMatch(/not a folder|unavailable/i);
  });

  test("tools:setLocation migrates existing binaries from previous directory", async () => {
    const { CHANNELS } = require("../../ipc/channels");
    const toolsPaths = require("../toolsPaths");
    const oldDir = fs.mkdtempSync(path.join(os.tmpdir(), "tools-old-"));
    const newDir = fs.mkdtempSync(path.join(os.tmpdir(), "tools-new-"));
    const ytName = process.platform === "win32" ? "yt-dlp.exe" : "yt-dlp";
    const ffName = process.platform === "win32" ? "ffmpeg.exe" : "ffmpeg";
    const fpName = process.platform === "win32" ? "ffprobe.exe" : "ffprobe";

    fs.writeFileSync(path.join(oldDir, ytName), "yt");
    fs.writeFileSync(path.join(oldDir, ffName), "ff");
    fs.writeFileSync(path.join(oldDir, fpName), "fp");

    toolsPaths.getEffectiveToolsDir.mockImplementation(() => oldDir);
    toolsPaths.ensureToolsDir.mockImplementation(async () => newDir);

    const { store } = initHandlers();
    const result = await handlers[CHANNELS.TOOLS_SET_LOCATION](null, newDir);

    expect(result).toEqual(
      expect.objectContaining({
        success: true,
        path: newDir,
      }),
    );
    expect(result.migrated).toEqual(expect.arrayContaining([ytName, ffName, fpName]));
    expect(fs.existsSync(path.join(newDir, ytName))).toBe(true);
    expect(fs.existsSync(path.join(newDir, ffName))).toBe(true);
    expect(fs.existsSync(path.join(newDir, fpName))).toBe(true);
    expect(store.set).toHaveBeenCalledWith("tools.dir", newDir);

    fs.rmSync(oldDir, { recursive: true, force: true });
    fs.rmSync(newDir, { recursive: true, force: true });
  });

  test("createWindowsRestartShortcut returns unsupported on non-windows", async () => {
    const { CHANNELS } = require("../../ipc/channels");

    initHandlers();
    const result =
      await handlers[CHANNELS.TOOLS_CREATE_WINDOWS_RESTART_SHORTCUT]();

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
    const result =
      await handlers[CHANNELS.TOOLS_CREATE_WINDOWS_RESTART_SHORTCUT]();

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

  test("new windows shortcut handlers return unsupported on non-windows", async () => {
    const { CHANNELS } = require("../../ipc/channels");

    initHandlers();

    const uefiResult =
      await handlers[CHANNELS.TOOLS_CREATE_WINDOWS_UEFI_REBOOT_SHORTCUT]();
    const advancedBootResult =
      await handlers[CHANNELS.TOOLS_CREATE_WINDOWS_ADVANCED_BOOT_SHORTCUT]();
    const deviceManagerResult =
      await handlers[CHANNELS.TOOLS_CREATE_WINDOWS_DEVICE_MANAGER_SHORTCUT]();
    const networkSettingsResult =
      await handlers[CHANNELS.TOOLS_CREATE_WINDOWS_NETWORK_SETTINGS_SHORTCUT]();

    [
      uefiResult,
      advancedBootResult,
      deviceManagerResult,
      networkSettingsResult,
    ].forEach((result) => {
      expect(result.success).toBe(false);
      expect(result.unsupported).toBe(true);
    });
  });

  test("new windows shortcut handlers set icon fields on windows", async () => {
    const { CHANNELS } = require("../../ipc/channels");
    const { shell } = require("electron");
    Object.defineProperty(process, "platform", {
      value: "win32",
      configurable: true,
    });
    shell.writeShortcutLink.mockReturnValue(true);

    initHandlers();

    await handlers[CHANNELS.TOOLS_CREATE_WINDOWS_UEFI_REBOOT_SHORTCUT]();
    await handlers[CHANNELS.TOOLS_CREATE_WINDOWS_ADVANCED_BOOT_SHORTCUT]();
    await handlers[CHANNELS.TOOLS_CREATE_WINDOWS_DEVICE_MANAGER_SHORTCUT]();
    await handlers[CHANNELS.TOOLS_CREATE_WINDOWS_NETWORK_SETTINGS_SHORTCUT]();

    expect(shell.writeShortcutLink).toHaveBeenCalledTimes(4);
    const calls = shell.writeShortcutLink.mock.calls.map((call) => call[2]);
    calls.forEach((options) => {
      expect(options).toEqual(
        expect.objectContaining({
          icon: expect.any(String),
          iconIndex: 0,
        }),
      );
    });
  });

  test("uefi shortcut uses firmware reboot command with fallback", async () => {
    const { CHANNELS } = require("../../ipc/channels");
    const { shell } = require("electron");
    Object.defineProperty(process, "platform", {
      value: "win32",
      configurable: true,
    });
    shell.writeShortcutLink.mockReturnValue(true);

    initHandlers();
    await handlers[CHANNELS.TOOLS_CREATE_WINDOWS_UEFI_REBOOT_SHORTCUT]();

    expect(shell.writeShortcutLink).toHaveBeenCalledWith(
      expect.any(String),
      "create",
      expect.objectContaining({
        target: "C:\\Windows\\System32\\cmd.exe",
        args: '/c "shutdown /r /fw /f /t 0 || shutdown /r /o /f /t 0"',
      }),
    );
  });
});

describe("ipcHandlers download pool", () => {
  beforeEach(() => {
    Object.keys(handlers).forEach((k) => delete handlers[k]);
    jest.clearAllMocks();
  });

  function initHandlers({ storeValues = {} } = {}) {
    const { setupIpcHandlers } = require("../ipcHandlers");
    const storeGet = jest.fn((key, def) =>
      Object.prototype.hasOwnProperty.call(storeValues, key)
        ? storeValues[key]
        : def,
    );
    setupIpcHandlers({
      mainWindow: {
        webContents: {
          send: jest.fn(),
          isDestroyed: () => false,
          on: jest.fn(),
        },
      },
      store: {
        get: storeGet,
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

  const deferred = () => {
    let resolve;
    let reject;
    const promise = new Promise((res, rej) => {
      resolve = res;
      reject = rej;
    });
    return { promise, resolve, reject };
  };

  test("allows two parallel DOWNLOAD_VIDEO and rejects third", async () => {
    const { CHANNELS } = require("../../ipc/channels");
    const download = require("../../scripts/download.js");
    const { getToolsVersions } = require("../toolsVersions");
    const mediaA = deferred();
    const mediaB = deferred();
    let mediaCalls = 0;

    getToolsVersions.mockResolvedValue({
      ytDlp: { ok: true },
      ffmpeg: { ok: true },
    });
    download.getVideoInfo.mockResolvedValue({
      title: "Test title",
      formats: [{ format_id: "best" }],
    });
    download.selectFormatsByQuality.mockReturnValue({
      videoFormat: "bestvideo",
      audioFormat: "bestaudio",
      audioExt: "m4a",
      videoExt: "mp4",
      resolution: "1080p",
      fps: 30,
    });
    download.downloadMedia.mockImplementation(() => {
      mediaCalls += 1;
      if (mediaCalls === 1) return mediaA.promise;
      if (mediaCalls === 2) return mediaB.promise;
      return Promise.resolve("/tmp/file-3.mp4");
    });

    initHandlers({ storeValues: { downloadParallelLimit: 2 } });
    const event = { sender: { send: jest.fn() } };
    const p1 = handlers[CHANNELS.DOWNLOAD_VIDEO](
      event,
      "https://example.com/a",
      "Source",
      "job-a",
    );
    const p2 = handlers[CHANNELS.DOWNLOAD_VIDEO](
      event,
      "https://example.com/b",
      "Source",
      "job-b",
    );

    await expect(
      handlers[CHANNELS.DOWNLOAD_VIDEO](
        event,
        "https://example.com/c",
        "Source",
        "job-c",
      ),
    ).rejects.toThrow("Parallel download limit reached");

    mediaA.resolve("/tmp/file-a.mp4");
    mediaB.resolve("/tmp/file-b.mp4");
    await expect(p1).resolves.toEqual(
      expect.objectContaining({
        sourceUrl: expect.stringContaining("https://example.com/a"),
      }),
    );
    await expect(p2).resolves.toEqual(
      expect.objectContaining({
        sourceUrl: expect.stringContaining("https://example.com/b"),
      }),
    );
    expect(getToolsVersions).toHaveBeenCalled();
    const firstToolsArg = getToolsVersions.mock.calls[0]?.[0];
    expect(firstToolsArg).toEqual(
      expect.objectContaining({ get: expect.any(Function) }),
    );
  });

  test("rejects second DOWNLOAD_VIDEO when parallel limit is set to 1", async () => {
    const { CHANNELS } = require("../../ipc/channels");
    const download = require("../../scripts/download.js");
    const { getToolsVersions } = require("../toolsVersions");
    const mediaA = deferred();

    getToolsVersions.mockResolvedValue({
      ytDlp: { ok: true },
      ffmpeg: { ok: true },
    });
    download.getVideoInfo.mockResolvedValue({
      title: "Test title",
      formats: [{ format_id: "best" }],
    });
    download.selectFormatsByQuality.mockReturnValue({
      videoFormat: "bestvideo",
      audioFormat: "bestaudio",
      audioExt: "m4a",
      videoExt: "mp4",
      resolution: "1080p",
      fps: 30,
    });
    download.downloadMedia.mockImplementation(() => mediaA.promise);

    initHandlers({ storeValues: { downloadParallelLimit: 1 } });
    const event = { sender: { send: jest.fn() } };
    const p1 = handlers[CHANNELS.DOWNLOAD_VIDEO](
      event,
      "https://example.com/a",
      "Source",
      "job-a",
    );

    await expect(
      handlers[CHANNELS.DOWNLOAD_VIDEO](
        event,
        "https://example.com/b",
        "Source",
        "job-b",
      ),
    ).rejects.toThrow("Parallel download limit reached");

    mediaA.resolve("/tmp/file-a.mp4");
    await expect(p1).resolves.toEqual(
      expect.objectContaining({
        sourceUrl: expect.stringContaining("https://example.com/a"),
      }),
    );
  });

  test("STOP_DOWNLOAD cancels all active tokens", async () => {
    const { CHANNELS } = require("../../ipc/channels");
    const download = require("../../scripts/download.js");
    const { getToolsVersions } = require("../toolsVersions");
    const mediaA = deferred();
    const mediaB = deferred();
    const tokenA = { cancelled: false, activeProcesses: {} };
    const tokenB = { cancelled: false, activeProcesses: {} };
    let tokenCall = 0;

    download.createDownloadToken.mockImplementation(() => {
      tokenCall += 1;
      return tokenCall === 1 ? tokenA : tokenB;
    });
    getToolsVersions.mockResolvedValue({
      ytDlp: { ok: true },
      ffmpeg: { ok: true },
    });
    download.getVideoInfo.mockResolvedValue({
      title: "Test title",
      formats: [{ format_id: "best" }],
    });
    download.selectFormatsByQuality.mockReturnValue({
      videoFormat: "bestvideo",
      audioFormat: "bestaudio",
      audioExt: "m4a",
      videoExt: "mp4",
      resolution: "1080p",
      fps: 30,
    });
    download.downloadMedia
      .mockImplementationOnce(() => mediaA.promise)
      .mockImplementationOnce(() => mediaB.promise);
    download.stopDownload.mockResolvedValue(2);

    initHandlers();
    const event = { sender: { send: jest.fn() } };
    const p1 = handlers[CHANNELS.DOWNLOAD_VIDEO](
      event,
      "https://example.com/a",
      "Source",
      "job-a",
    );
    const p2 = handlers[CHANNELS.DOWNLOAD_VIDEO](
      event,
      "https://example.com/b",
      "Source",
      "job-b",
    );

    const stopResult = await handlers[CHANNELS.STOP_DOWNLOAD]();
    expect(stopResult).toEqual({ success: true, cancelled: 2 });
    expect(download.stopDownload).toHaveBeenCalledWith([tokenA, tokenB]);

    mediaA.resolve("/tmp/file-a.mp4");
    mediaB.resolve("/tmp/file-b.mp4");
    await p1;
    await p2;
  });
});
