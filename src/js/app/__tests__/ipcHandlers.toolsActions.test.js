const path = require("path");
const fs = require("fs");
const os = require("os");
const { EventEmitter } = require("events");

const handlers = {};

jest.mock("child_process", () => ({
  execFile: (() => {
    const { promisify } = require("util");
    const fn = jest.fn();
    fn[promisify.custom] = jest.fn(() =>
      Promise.resolve({ stdout: "", stderr: "" }),
    );
    return fn;
  })(),
  spawn: jest.fn(),
}));

jest.mock("electron", () => ({
  ipcMain: {
    handle: jest.fn((channel, cb) => {
      handlers[channel] = cb;
    }),
    on: jest.fn(),
  },
  dialog: {
    showOpenDialog: jest.fn(),
    showSaveDialog: jest.fn(),
  },
  Notification: { isSupported: () => false },
  shell: {
    openExternal: jest.fn(),
    showItemInFolder: jest.fn(),
    openPath: jest.fn(),
    writeShortcutLink: jest.fn(),
    trashItem: jest.fn(),
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
    checkForUpdates: jest.fn(),
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
  getVideoPreview: jest.fn(),
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

function extractWingetArgs(args = []) {
  const commandIndex = args.indexOf("-Command");
  if (commandIndex === -1) return args;
  const command = String(args[commandIndex + 1] || "");
  const values = [...command.matchAll(/'((?:''|[^'])*)'/g)].map((match) =>
    match[1].replaceAll("''", "'"),
  );
  const wingetIndex = values.indexOf("winget");
  return wingetIndex === -1 ? values : values.slice(wingetIndex + 1);
}

describe("ipcHandlers tools quick actions", () => {
  const originalPlatform = process.platform;
  const toolsDir = "/tmp/tools";

  beforeEach(() => {
    Object.keys(handlers).forEach((k) => delete handlers[k]);
    jest.clearAllMocks();
    require("child_process").execFile.mockReset();
    fs.mkdirSync(toolsDir, { recursive: true });
    const toolsPaths = require("../toolsPaths");
    toolsPaths.getDefaultToolsDir.mockImplementation(() => toolsDir);
    toolsPaths.getEffectiveToolsDir.mockImplementation(() => toolsDir);
    toolsPaths.ensureToolsDir.mockImplementation(async (v) => v || toolsDir);
    toolsPaths.detectLegacyLocations.mockImplementation(async () => []);
    toolsPaths.migrateLegacy.mockImplementation(async () => ({
      copied: [],
      skipped: [],
    }));
  });

  afterEach(() => {
    const ffprobeName =
      process.platform === "win32" ? "ffprobe.exe" : "ffprobe";
    const ffprobePath = path.join(toolsDir, ffprobeName);
    if (fs.existsSync(ffprobePath)) {
      fs.unlinkSync(ffprobePath);
    }
    Object.defineProperty(process, "platform", {
      value: originalPlatform,
      configurable: true,
    });
  });

  function initHandlers({
    storeValues = {},
    clipboardMonitor = null,
    downloadState = { downloadPath: "/tmp", downloadInProgress: false },
    setDownloadPath = jest.fn(),
  } = {}) {
    const { setupIpcHandlers } = require("../ipcHandlers");
    const setReloadMenuEnabled = jest.fn();
    const mainWindow = {
      webContents: {
        send: jest.fn(),
        isDestroyed: () => false,
        on: jest.fn(),
      },
    };
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
      mainWindow,
      store,
      downloadState,
      getAppVersion: jest.fn().mockResolvedValue("1.0.0"),
      setDownloadPath,
      historyFilePath: path.join(os.tmpdir(), "history.json"),
      previewCacheDir: path.join(os.tmpdir(), "preview-cache"),
      iconCache: new Map(),
      clipboardMonitor: clipboardMonitor || {
        start: jest.fn(),
        stop: jest.fn(),
      },
      setupGlobalShortcuts: jest.fn(),
      notifyDownloadError: jest.fn(),
      sendDownloadCompletionNotification: jest.fn(),
      showTrayNotification: jest.fn(),
      setReloadMenuEnabled,
      dispatchPendingWhatsNew: jest.fn(),
      clearPendingWhatsNewVersion: jest.fn(),
    });
    return { mainWindow, store, setDownloadPath, setReloadMenuEnabled };
  }

  test("set-open-on-copy-url-status toggles clipboard monitor and persists state", async () => {
    const { CHANNELS } = require("../../ipc/channels");
    const clipboardMonitor = { start: jest.fn(), stop: jest.fn() };
    const { store } = initHandlers({ clipboardMonitor });

    await handlers[CHANNELS.SET_OPEN_ON_COPY_URL_STATUS](null, true);
    expect(store.set).toHaveBeenCalledWith("openOnCopyUrl", true);
    expect(clipboardMonitor.start).toHaveBeenCalledTimes(1);
    expect(clipboardMonitor.stop).not.toHaveBeenCalled();

    await handlers[CHANNELS.SET_OPEN_ON_COPY_URL_STATUS](null, false);
    expect(store.set).toHaveBeenCalledWith("openOnCopyUrl", false);
    expect(clipboardMonitor.stop).toHaveBeenCalledTimes(1);
  });

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

  test("mediaInspectorPickFile returns selected path", async () => {
    const { dialog } = require("electron");
    const { CHANNELS } = require("../../ipc/channels");
    dialog.showOpenDialog.mockResolvedValue({
      canceled: false,
      filePaths: ["/tmp/movie.webm"],
    });

    initHandlers();
    const result = await handlers[CHANNELS.TOOLS_MEDIA_INSPECTOR_PICK_FILE]();

    expect(result).toEqual({ success: true, filePath: "/tmp/movie.webm" });
  });

  test("set-download-path removes resume state from previous downloads folder", async () => {
    const { CHANNELS } = require("../../ipc/channels");
    const oldDir = fs.mkdtempSync(path.join(os.tmpdir(), "resume-old-"));
    const newDir = fs.mkdtempSync(path.join(os.tmpdir(), "resume-new-"));
    const resumeDir = path.join(oldDir, ".thunderload-resume");
    fs.mkdirSync(resumeDir, { recursive: true });
    fs.writeFileSync(path.join(resumeDir, "state.json"), "{}", "utf8");

    const { setDownloadPath } = initHandlers({
      downloadState: { downloadPath: oldDir, downloadInProgress: false },
    });

    const result = await handlers[CHANNELS.SET_DOWNLOAD_PATH](null, newDir);

    expect(result).toEqual({ success: true });
    expect(setDownloadPath).toHaveBeenCalledWith(newDir);
    expect(fs.existsSync(resumeDir)).toBe(false);
  });

  test("select-download-folder removes resume state from previous downloads folder", async () => {
    const { dialog } = require("electron");
    const { CHANNELS } = require("../../ipc/channels");
    const oldDir = fs.mkdtempSync(path.join(os.tmpdir(), "resume-pick-old-"));
    const newDir = fs.mkdtempSync(path.join(os.tmpdir(), "resume-pick-new-"));
    const resumeDir = path.join(oldDir, ".thunderload-resume");
    fs.mkdirSync(resumeDir, { recursive: true });
    dialog.showOpenDialog.mockResolvedValue({
      canceled: false,
      filePaths: [newDir],
    });

    const { setDownloadPath } = initHandlers({
      downloadState: { downloadPath: oldDir, downloadInProgress: false },
    });

    const result = await handlers[CHANNELS.SELECT_DOWNLOAD_FOLDER]();

    expect(result).toEqual({ success: true, path: newDir });
    expect(setDownloadPath).toHaveBeenCalledWith(newDir);
    expect(fs.existsSync(resumeDir)).toBe(false);
  });

  test("set-download-path keeps resume state when downloads folder is unchanged", async () => {
    const { CHANNELS } = require("../../ipc/channels");
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), "resume-same-"));
    const resumeDir = path.join(dir, ".thunderload-resume");
    fs.mkdirSync(resumeDir, { recursive: true });

    initHandlers({
      downloadState: { downloadPath: dir, downloadInProgress: false },
    });

    const result = await handlers[CHANNELS.SET_DOWNLOAD_PATH](null, dir);

    expect(result).toEqual({ success: true });
    expect(fs.existsSync(resumeDir)).toBe(true);
  });

  test("set-download-path keeps resume state while downloads are active", async () => {
    const { CHANNELS } = require("../../ipc/channels");
    const oldDir = fs.mkdtempSync(path.join(os.tmpdir(), "resume-active-"));
    const newDir = fs.mkdtempSync(path.join(os.tmpdir(), "resume-target-"));
    const resumeDir = path.join(oldDir, ".thunderload-resume");
    fs.mkdirSync(resumeDir, { recursive: true });

    initHandlers({
      downloadState: {
        downloadPath: oldDir,
        downloadInProgress: true,
        activeDownloads: new Map([["job-1", {}]]),
      },
    });

    const result = await handlers[CHANNELS.SET_DOWNLOAD_PATH](null, newDir);

    expect(result).toEqual({ success: true });
    expect(fs.existsSync(resumeDir)).toBe(true);
  });

  test("set-download-path succeeds when resume state cleanup fails", async () => {
    const { CHANNELS } = require("../../ipc/channels");
    const log = require("electron-log");
    const oldDir = fs.mkdtempSync(path.join(os.tmpdir(), "resume-error-"));
    const newDir = fs.mkdtempSync(path.join(os.tmpdir(), "resume-error-new-"));
    const rmSpy = jest
      .spyOn(fs.promises, "rm")
      .mockRejectedValueOnce(new Error("cleanup denied"));

    initHandlers({
      downloadState: { downloadPath: oldDir, downloadInProgress: false },
    });

    try {
      const result = await handlers[CHANNELS.SET_DOWNLOAD_PATH](null, newDir);

      expect(result).toEqual({ success: true });
      expect(log.warn).toHaveBeenCalledWith(
        expect.stringContaining(".thunderload-resume"),
        "cleanup denied",
      );
    } finally {
      rmSpy.mockRestore();
    }
  });

  test("open-config-folder opens settings directory without selecting file", async () => {
    const { shell, app } = require("electron");
    const { CHANNELS } = require("../../ipc/channels");
    const userDataPath = app.getPath("userData");

    initHandlers();
    const result = await handlers[CHANNELS.OPEN_CONFIG_FOLDER]();

    expect(result).toEqual({ success: true });
    expect(shell.openPath).toHaveBeenCalledWith(userDataPath);
    expect(shell.showItemInFolder).not.toHaveBeenCalled();
    expect(
      fs.existsSync(path.join(userDataPath, "wireguard.conf")),
    ).toBeTruthy();
  });

  test("check-app-updates triggers a manual updater check", async () => {
    const { CHANNELS } = require("../../ipc/channels");
    const { autoUpdater } = require("electron-updater");

    initHandlers();
    const result = await handlers[CHANNELS.CHECK_APP_UPDATES]();

    expect(result).toEqual({ success: true });
    expect(autoUpdater.checkForUpdates).toHaveBeenCalledTimes(1);
  });

  test("mediaInspectorAnalyze returns structured report for a local file", async () => {
    const { execFile } = require("child_process");
    const { promisify } = require("util");
    const { CHANNELS } = require("../../ipc/channels");
    const ffprobeName =
      process.platform === "win32" ? "ffprobe.exe" : "ffprobe";
    const ffprobePath = path.join("/tmp/tools", ffprobeName);
    const mediaPath = path.join(
      os.tmpdir(),
      `media-inspector-${Date.now()}.webm`,
    );
    const execFilePromisified = execFile[promisify.custom];

    fs.writeFileSync(ffprobePath, "#!/bin/sh\nexit 0\n", "utf8");
    fs.writeFileSync(mediaPath, "demo", "utf8");

    execFilePromisified.mockResolvedValueOnce({
      stdout: JSON.stringify({
        format: {
          format_name: "matroska,webm",
          duration: "12.5",
          bit_rate: "1200000",
          probe_score: "100",
        },
        streams: [
          {
            codec_type: "video",
            codec_name: "vp9",
            profile: "Profile 0",
            pix_fmt: "yuv420p",
            width: 1920,
            height: 1080,
            avg_frame_rate: "30000/1001",
            r_frame_rate: "30000/1001",
            bit_rate: "900000",
            color_space: "bt709",
            color_primaries: "bt709",
            color_transfer: "bt709",
          },
          {
            codec_type: "audio",
            codec_name: "opus",
            channels: 2,
            channel_layout: "stereo",
            sample_rate: "48000",
            bit_rate: "96000",
            tags: { language: "en" },
          },
        ],
      }),
      stderr: "",
    });

    initHandlers();
    const result = await handlers[CHANNELS.TOOLS_MEDIA_INSPECTOR_ANALYZE](
      null,
      { filePath: mediaPath },
    );

    expect(execFilePromisified).toHaveBeenCalledWith(
      ffprobePath,
      [
        "-v",
        "quiet",
        "-print_format",
        "json",
        "-show_format",
        "-show_streams",
        mediaPath,
      ],
      expect.objectContaining({
        windowsHide: true,
        maxBuffer: 10 * 1024 * 1024,
        timeout: 15000,
      }),
    );
    expect(result.success).toBe(true);
    expect(result.report).toMatchObject({
      file: {
        path: mediaPath,
        name: path.basename(mediaPath),
        extension: ".webm",
        sizeBytes: 4,
      },
      format: {
        container: "matroska,webm",
        durationSec: 12.5,
        bitrate: 1200000,
        probeScore: 100,
      },
      summary: {
        videoCount: 1,
        audioCount: 1,
        subtitleCount: 0,
        hasAudio: true,
        hasVideo: true,
      },
      rawAvailable: true,
    });
    expect(result.report.videoStreams[0]).toMatchObject({
      codec: "vp9",
      profile: "Profile 0",
      pixelFormat: "yuv420p",
      width: 1920,
      height: 1080,
      bitrate: 900000,
      hdr: false,
      colorSpace: "bt709",
    });
    expect(result.report.audioStreams[0]).toMatchObject({
      codec: "opus",
      channels: 2,
      channelLayout: "stereo",
      sampleRate: 48000,
      bitrate: 96000,
      language: "en",
    });
    expect(result.report.warnings).toEqual([]);

    fs.unlinkSync(mediaPath);
  });

  test("mediaInspectorAnalyze returns missingDependency when ffprobe is absent", async () => {
    const { CHANNELS } = require("../../ipc/channels");
    const mediaPath = path.join(
      os.tmpdir(),
      `media-inspector-missing-${Date.now()}.mp4`,
    );
    fs.writeFileSync(mediaPath, "demo", "utf8");

    initHandlers();
    const result = await handlers[CHANNELS.TOOLS_MEDIA_INSPECTOR_ANALYZE](
      null,
      { filePath: mediaPath },
    );

    expect(result).toEqual(
      expect.objectContaining({
        success: false,
        code: "missingDependency",
      }),
    );

    fs.unlinkSync(mediaPath);
  });

  test("mediaInspectorAnalyze uses ffprobe from PATH when local tool is absent", async () => {
    const { execFile } = require("child_process");
    const { promisify } = require("util");
    const { CHANNELS } = require("../../ipc/channels");
    const pathDir = path.join(
      os.tmpdir(),
      `media-inspector-path-${Date.now()}`,
    );
    const ffprobeName =
      process.platform === "win32" ? "ffprobe.exe" : "ffprobe";
    const ffprobePath = path.join(pathDir, ffprobeName);
    const mediaPath = path.join(
      os.tmpdir(),
      `media-inspector-system-${Date.now()}.mp4`,
    );
    const execFilePromisified = execFile[promisify.custom];
    const originalPath = process.env.PATH;

    fs.mkdirSync(pathDir, { recursive: true });
    fs.writeFileSync(ffprobePath, "#!/bin/sh\nexit 0\n", "utf8");
    fs.chmodSync(ffprobePath, 0o755);
    fs.writeFileSync(mediaPath, "demo", "utf8");
    process.env.PATH = `${pathDir}${path.delimiter}${originalPath || ""}`;

    execFilePromisified.mockResolvedValueOnce({
      stdout: JSON.stringify({
        format: {
          format_name: "mov,mp4,m4a,3gp,3g2,mj2",
          duration: "3.2",
          bit_rate: "640000",
          probe_score: "100",
        },
        streams: [],
      }),
      stderr: "",
    });

    initHandlers();
    const result = await handlers[CHANNELS.TOOLS_MEDIA_INSPECTOR_ANALYZE](
      null,
      { filePath: mediaPath },
    );

    expect(execFilePromisified).toHaveBeenCalledWith(
      ffprobePath,
      expect.any(Array),
      expect.objectContaining({
        windowsHide: true,
      }),
    );
    expect(result.success).toBe(true);

    process.env.PATH = originalPath;
    fs.unlinkSync(mediaPath);
    fs.unlinkSync(ffprobePath);
    fs.rmdirSync(pathDir);
  });

  test("mediaInspectorAnalyze installs ffmpeg tools when ffprobe is missing", async () => {
    const { execFile } = require("child_process");
    const { promisify } = require("util");
    const download = require("../../scripts/download.js");
    const { CHANNELS } = require("../../ipc/channels");
    const ffprobeName =
      process.platform === "win32" ? "ffprobe.exe" : "ffprobe";
    const ffprobePath = path.join(toolsDir, ffprobeName);
    const mediaPath = path.join(
      os.tmpdir(),
      `media-inspector-bootstrap-${Date.now()}.mp4`,
    );
    const execFilePromisified = execFile[promisify.custom];

    fs.writeFileSync(mediaPath, "demo", "utf8");
    download.installFfmpeg.mockImplementationOnce(async () => {
      fs.writeFileSync(ffprobePath, "#!/bin/sh\nexit 0\n", "utf8");
      fs.chmodSync(ffprobePath, 0o755);
    });
    execFilePromisified.mockResolvedValueOnce({
      stdout: JSON.stringify({
        format: {
          format_name: "mov,mp4,m4a,3gp,3g2,mj2",
          duration: "1.0",
          bit_rate: "128000",
          probe_score: "100",
        },
        streams: [],
      }),
      stderr: "",
    });

    initHandlers();
    const result = await handlers[CHANNELS.TOOLS_MEDIA_INSPECTOR_ANALYZE](
      null,
      { filePath: mediaPath },
    );

    expect(download.installFfmpeg).toHaveBeenCalledTimes(1);
    expect(execFilePromisified).toHaveBeenCalledWith(
      ffprobePath,
      expect.any(Array),
      expect.objectContaining({
        windowsHide: true,
      }),
    );
    expect(result.success).toBe(true);

    fs.unlinkSync(mediaPath);
  });

  test("mediaInspectorAnalyze returns fileNotFound for a missing file", async () => {
    const { CHANNELS } = require("../../ipc/channels");
    initHandlers();
    const result = await handlers[CHANNELS.TOOLS_MEDIA_INSPECTOR_ANALYZE](
      null,
      { filePath: path.join(os.tmpdir(), `missing-${Date.now()}.mp4`) },
    );

    expect(result).toEqual(
      expect.objectContaining({
        success: false,
        code: "fileNotFound",
      }),
    );
  });

  test("delete-file uses shell.trashItem when available", async () => {
    const { CHANNELS } = require("../../ipc/channels");
    const { shell } = require("electron");
    const filePath = path.join("/tmp", `delete-trash-${Date.now()}.tmp`);
    fs.writeFileSync(filePath, "trash-me", "utf8");
    shell.trashItem.mockResolvedValue(undefined);

    initHandlers();
    const result = await handlers[CHANNELS.DELETE_FILE](null, filePath);

    expect(result).toBe(true);
    expect(shell.trashItem).toHaveBeenCalledWith(filePath);

    if (fs.existsSync(filePath)) {
      fs.unlinkSync(filePath);
    }
  });

  test("delete-file falls back to unlink when trashItem fails", async () => {
    const { CHANNELS } = require("../../ipc/channels");
    const { shell } = require("electron");
    const filePath = path.join(
      "/tmp",
      `delete-trash-fallback-${Date.now()}.tmp`,
    );
    fs.writeFileSync(filePath, "fallback-me", "utf8");
    shell.trashItem.mockRejectedValue(new Error("trash failed"));

    initHandlers();
    const result = await handlers[CHANNELS.DELETE_FILE](null, filePath);

    expect(result).toBe(true);
    expect(shell.trashItem).toHaveBeenCalledWith(filePath);
    expect(fs.existsSync(filePath)).toBe(false);
  });

  test("delete-file allows names containing double dots", async () => {
    const { CHANNELS } = require("../../ipc/channels");
    const { shell } = require("electron");
    const filePath = path.join("/tmp", `track..mix-${Date.now()}.webm`);
    fs.writeFileSync(filePath, "ok", "utf8");
    shell.trashItem.mockResolvedValue(undefined);

    initHandlers();
    const result = await handlers[CHANNELS.DELETE_FILE](null, filePath);

    expect(result).toBe(true);
    expect(shell.trashItem).toHaveBeenCalledWith(filePath);

    if (fs.existsSync(filePath)) {
      fs.unlinkSync(filePath);
    }
  });

  test("get-video-info rejects incomplete host before yt-dlp call", async () => {
    const { CHANNELS } = require("../../ipc/channels");
    const download = require("../../scripts/download.js");
    initHandlers();

    const result = await handlers[CHANNELS.GET_VIDEO_INFO](null, "https://w");

    expect(result.success).toBe(false);
    expect(result.error).toMatch(/host is incomplete/i);
    expect(download.getVideoInfo).not.toHaveBeenCalled();
  });

  test("get-video-preview returns metadata without formats", async () => {
    const { CHANNELS } = require("../../ipc/channels");
    const download = require("../../scripts/download.js");
    download.getVideoPreview.mockResolvedValueOnce({
      title: "Preview demo",
      duration: 120,
      thumbnail: "https://i.ytimg.com/vi/demo/hqdefault.jpg",
      webpage_url: "https://www.youtube.com/watch?v=demo",
      previewFormats: [
        {
          url: "https://rr1---sn.example.googlevideo.com/videoplayback?itag=18",
          ext: "mp4",
          protocol: "https",
          vcodec: "avc1.42001E",
          acodec: "mp4a.40.2",
          width: 640,
          height: 360,
          tbr: 900,
        },
      ],
    });
    initHandlers();

    const result = await handlers[CHANNELS.GET_VIDEO_PREVIEW](
      null,
      "https://www.youtube.com/watch?v=demo",
    );

    expect(download.getVideoPreview).toHaveBeenCalledWith(
      "https://www.youtube.com/watch?v=demo",
      expect.objectContaining({ cancelled: false }),
    );
    expect(download.getVideoInfo).not.toHaveBeenCalled();
    expect(result).toMatchObject({
      success: true,
      title: "Preview demo",
      duration: 120,
      thumbnail: "https://i.ytimg.com/vi/demo/hqdefault.jpg",
      formats: [],
      backgroundPreview: {
        src: "https://rr1---sn.example.googlevideo.com/videoplayback?itag=18",
        poster: "https://i.ytimg.com/vi/demo/hqdefault.jpg",
        mime: "video/mp4",
        container: "mp4",
        width: 640,
        height: 360,
      },
      livePreview: {
        src: "https://rr1---sn.example.googlevideo.com/videoplayback?itag=18",
        poster: "https://i.ytimg.com/vi/demo/hqdefault.jpg",
        mime: "video/mp4",
        container: "mp4",
        width: 640,
        height: 360,
      },
    });
  });

  test("cancel-video-info-request stops active preview token", async () => {
    const { CHANNELS } = require("../../ipc/channels");
    const download = require("../../scripts/download.js");
    let resolvePreview;
    download.getVideoPreview.mockImplementationOnce(
      () =>
        new Promise((resolve) => {
          resolvePreview = resolve;
        }),
    );
    initHandlers();

    const previewPromise = handlers[CHANNELS.GET_VIDEO_PREVIEW](
      null,
      "https://example.com/video",
    );
    await Promise.resolve();

    const result = await handlers[CHANNELS.CANCEL_VIDEO_INFO_REQUEST](null, {
      url: "https://example.com/video",
      previewOnly: true,
    });

    expect(result).toEqual({ success: true, cancelled: true });
    expect(download.stopDownload).toHaveBeenCalledWith([
      expect.objectContaining({ cancelled: false }),
    ]);

    resolvePreview({
      title: "Preview demo",
      thumbnail: "https://example.com/thumb.jpg",
    });
    await previewPromise;
  });

  test("get-video-info includes backgroundPreview for playable YouTube sources", async () => {
    const { CHANNELS } = require("../../ipc/channels");
    const download = require("../../scripts/download.js");
    download.getVideoInfo.mockResolvedValueOnce({
      title: "YouTube demo",
      duration: 120,
      thumbnail: "https://i.ytimg.com/vi/demo/hqdefault.jpg",
      webpage_url: "https://www.youtube.com/watch?v=demo",
      formats: [
        {
          url: "https://rr1---sn.example.googlevideo.com/videoplayback?itag=18",
          ext: "mp4",
          protocol: "https",
          vcodec: "avc1.42001E",
          acodec: "mp4a.40.2",
          width: 640,
          height: 360,
          tbr: 900,
        },
      ],
    });
    initHandlers();

    const result = await handlers[CHANNELS.GET_VIDEO_INFO](
      null,
      "https://www.youtube.com/watch?v=demo",
    );

    expect(result.success).toBe(true);
    expect(result.backgroundPreview).toEqual({
      src: "https://rr1---sn.example.googlevideo.com/videoplayback?itag=18",
      poster: "https://i.ytimg.com/vi/demo/hqdefault.jpg",
      mime: "video/mp4",
      container: "mp4",
      width: 640,
      height: 360,
    });
    expect(result.livePreview).toEqual({
      src: "https://rr1---sn.example.googlevideo.com/videoplayback?itag=18",
      poster: "https://i.ytimg.com/vi/demo/hqdefault.jpg",
      mime: "video/mp4",
      container: "mp4",
      width: 640,
      height: 360,
    });
  });

  test("get-video-info keeps youtube backgroundPreview when container is inferred from url mime", async () => {
    const { CHANNELS } = require("../../ipc/channels");
    const download = require("../../scripts/download.js");
    download.getVideoInfo.mockResolvedValueOnce({
      title: "YouTube demo",
      duration: 120,
      thumbnail: "https://i.ytimg.com/vi/demo/hqdefault.jpg",
      webpage_url: "https://www.youtube.com/watch?v=demo",
      formats: [
        {
          url: "https://rr1---sn.example.googlevideo.com/videoplayback?itag=18&mime=video/mp4",
          protocol: "https",
          width: 640,
          height: 360,
          acodec: "mp4a.40.2",
        },
      ],
    });
    initHandlers();

    const result = await handlers[CHANNELS.GET_VIDEO_INFO](
      null,
      "https://www.youtube.com/watch?v=demo",
    );

    expect(result.success).toBe(true);
    expect(result.backgroundPreview).toEqual({
      src: "https://rr1---sn.example.googlevideo.com/videoplayback?itag=18&mime=video/mp4",
      poster: "https://i.ytimg.com/vi/demo/hqdefault.jpg",
      mime: "video/mp4",
      container: "mp4",
      width: 640,
      height: 360,
    });
  });

  test("get-video-info keeps livePreview null for non-YouTube URLs", async () => {
    const { CHANNELS } = require("../../ipc/channels");
    const download = require("../../scripts/download.js");
    download.getVideoInfo.mockResolvedValueOnce({
      title: "Vimeo demo",
      duration: 120,
      thumbnail: "https://example.com/thumb.jpg",
      webpage_url: "https://vimeo.com/123",
      formats: [
        {
          url: "https://cdn.example.com/video.mp4",
          ext: "mp4",
          protocol: "https",
          vcodec: "avc1.42001E",
          acodec: "mp4a.40.2",
          width: 854,
          height: 480,
        },
      ],
    });
    initHandlers();

    const result = await handlers[CHANNELS.GET_VIDEO_INFO](
      null,
      "https://vimeo.com/123",
    );

    expect(result.success).toBe(true);
    expect(result.backgroundPreview).toBeNull();
    expect(result.livePreview).toBeNull();
  });

  test("get-video-info maps auth errors to AUTH_REQUIRED", async () => {
    const { CHANNELS } = require("../../ipc/channels");
    const download = require("../../scripts/download.js");
    download.getVideoInfo.mockRejectedValueOnce(
      new Error("ERR_YTDLP_AUTH_REQUIRED: login required"),
    );
    initHandlers();

    const result = await handlers[CHANNELS.GET_VIDEO_INFO](
      null,
      "https://www.youtube.com/watch?v=test",
    );

    expect(result).toMatchObject({
      success: false,
      errorCode: "AUTH_REQUIRED",
      retryable: false,
    });
    expect(result.error).toContain("авторизации");
    expect(result.message).toContain("авторизации");
  });

  test("get-video-info maps geo errors to GEO_BLOCKED", async () => {
    const { CHANNELS } = require("../../ipc/channels");
    const download = require("../../scripts/download.js");
    download.getVideoInfo.mockRejectedValueOnce(
      new Error("ERR_YTDLP_GEO_BLOCKED: region blocked"),
    );
    initHandlers();

    const result = await handlers[CHANNELS.GET_VIDEO_INFO](
      null,
      "https://www.youtube.com/watch?v=test",
    );

    expect(result).toMatchObject({
      success: false,
      errorCode: "GEO_BLOCKED",
    });
    expect(result.error).toContain("регионе");
  });

  test("get-video-info maps unavailable errors to UNAVAILABLE", async () => {
    const { CHANNELS } = require("../../ipc/channels");
    const download = require("../../scripts/download.js");
    download.getVideoInfo.mockRejectedValueOnce(
      new Error("ERR_YTDLP_UNAVAILABLE: video unavailable"),
    );
    initHandlers();

    const result = await handlers[CHANNELS.GET_VIDEO_INFO](
      null,
      "https://www.youtube.com/watch?v=test",
    );

    expect(result).toMatchObject({
      success: false,
      errorCode: "UNAVAILABLE",
    });
    expect(result.error).toContain("недоступно");
  });

  test("get-video-info maps network timeouts to NETWORK_TIMEOUT", async () => {
    const { CHANNELS } = require("../../ipc/channels");
    const download = require("../../scripts/download.js");
    download.getVideoInfo.mockRejectedValueOnce(
      new Error("ERR_YTDLP_NETWORK_TIMEOUT: read timed out"),
    );
    initHandlers();

    const result = await handlers[CHANNELS.GET_VIDEO_INFO](
      null,
      "https://www.youtube.com/watch?v=test",
    );

    expect(result).toMatchObject({
      success: false,
      errorCode: "NETWORK_TIMEOUT",
    });
    expect(result.error).toContain("Не удалось получить данные от источника");
  });

  test("get-video-info maps unsupported URLs to UNSUPPORTED_URL", async () => {
    const { CHANNELS } = require("../../ipc/channels");
    const download = require("../../scripts/download.js");
    download.getVideoInfo.mockRejectedValueOnce(
      new Error("ERR_YTDLP_UNSUPPORTED_URL: unsupported source"),
    );
    initHandlers();

    const result = await handlers[CHANNELS.GET_VIDEO_INFO](
      null,
      "https://example.com/test",
    );

    expect(result).toMatchObject({
      success: false,
      errorCode: "UNSUPPORTED_URL",
      retryable: false,
    });
  });

  test("get-video-info maps not found errors to NOT_FOUND", async () => {
    const { CHANNELS } = require("../../ipc/channels");
    const download = require("../../scripts/download.js");
    download.getVideoInfo.mockRejectedValueOnce(
      new Error("ERR_YTDLP_NOT_FOUND: http 404"),
    );
    initHandlers();

    const result = await handlers[CHANNELS.GET_VIDEO_INFO](
      null,
      "https://example.com/missing",
    );

    expect(result).toMatchObject({
      success: false,
      errorCode: "NOT_FOUND",
      retryable: false,
    });
  });

  test("get-video-info maps exec failures to EXEC_FAILED", async () => {
    const { CHANNELS } = require("../../ipc/channels");
    const download = require("../../scripts/download.js");
    download.getVideoInfo.mockRejectedValueOnce(
      new Error("ERR_YTDLP_EXEC_FAILED: spawn Unknown system error -88"),
    );
    initHandlers();

    const result = await handlers[CHANNELS.GET_VIDEO_INFO](
      null,
      "https://www.youtube.com/watch?v=test",
    );

    expect(result).toMatchObject({
      success: false,
      errorCode: "EXEC_FAILED",
      retryable: true,
    });
  });

  test("get-video-info maps private content errors to PRIVATE_CONTENT", async () => {
    const { CHANNELS } = require("../../ipc/channels");
    const download = require("../../scripts/download.js");
    download.getVideoInfo.mockRejectedValueOnce(
      new Error("ERR_YTDLP_PRIVATE_CONTENT: members-only"),
    );
    initHandlers();

    const result = await handlers[CHANNELS.GET_VIDEO_INFO](
      null,
      "https://www.youtube.com/watch?v=test",
    );

    expect(result).toMatchObject({
      success: false,
      errorCode: "PRIVATE_CONTENT",
    });
    expect(result.error).toContain("участникам");
  });

  test("get-video-info maps captcha errors to CAPTCHA_REQUIRED", async () => {
    const { CHANNELS } = require("../../ipc/channels");
    const download = require("../../scripts/download.js");
    download.getVideoInfo.mockRejectedValueOnce(
      new Error("ERR_YTDLP_CAPTCHA_REQUIRED: verify you are human"),
    );
    initHandlers();

    const result = await handlers[CHANNELS.GET_VIDEO_INFO](
      null,
      "https://www.youtube.com/watch?v=test",
    );

    expect(result).toMatchObject({
      success: false,
      errorCode: "CAPTCHA_REQUIRED",
    });
    expect(result.error).toContain("проверку");
  });

  test("get-video-info maps disk errors to DISK_FULL", async () => {
    const { CHANNELS } = require("../../ipc/channels");
    const download = require("../../scripts/download.js");
    download.getVideoInfo.mockRejectedValueOnce(
      new Error("ERR_DOWNLOAD_DISK_FULL: no space left"),
    );
    initHandlers();

    const result = await handlers[CHANNELS.GET_VIDEO_INFO](
      null,
      "https://www.youtube.com/watch?v=test",
    );

    expect(result).toMatchObject({
      success: false,
      errorCode: "DISK_FULL",
    });
    expect(result.error).toContain("свободного места");
  });

  test("get-video-info maps permission errors to PERMISSION_DENIED", async () => {
    const { CHANNELS } = require("../../ipc/channels");
    const download = require("../../scripts/download.js");
    download.getVideoInfo.mockRejectedValueOnce(
      new Error("ERR_DOWNLOAD_PERMISSION_DENIED: permission denied"),
    );
    initHandlers();

    const result = await handlers[CHANNELS.GET_VIDEO_INFO](
      null,
      "https://www.youtube.com/watch?v=test",
    );

    expect(result).toMatchObject({
      success: false,
      errorCode: "PERMISSION_DENIED",
    });
    expect(result.error).toContain("Нет доступа");
  });

  test("get-video-info maps rate limits with retryAfterMinutes", async () => {
    const { CHANNELS } = require("../../ipc/channels");
    const download = require("../../scripts/download.js");
    download.getVideoInfo.mockRejectedValueOnce(
      new Error(
        "YouTube temporarily rate-limited requests for this client (about 7 minutes)",
      ),
    );
    initHandlers();

    const result = await handlers[CHANNELS.GET_VIDEO_INFO](
      null,
      "https://www.youtube.com/watch?v=test",
    );

    expect(result).toMatchObject({
      success: false,
      errorCode: "YOUTUBE_RATE_LIMIT",
      retryable: true,
      retryAfterMinutes: 7,
    });
    expect(result.error).toContain("7 мин");
  });

  test("tools:updateYtDlp keeps current binary if temp install fails", async () => {
    const { CHANNELS } = require("../../ipc/channels");
    const download = require("../../scripts/download.js");
    const toolsVersions = require("../toolsVersions");

    initHandlers();
    const existingPath = path.join(toolsDir, "yt-dlp");
    fs.writeFileSync(existingPath, "old-binary", "utf8");
    toolsVersions.getToolsVersions.mockResolvedValueOnce({
      ytDlp: { ok: true, path: existingPath },
    });
    download.installYtDlp.mockRejectedValueOnce(new Error("install failed"));

    const result = await handlers[CHANNELS.TOOLS_UPDATEYTDLP]();

    expect(result).toMatchObject({
      success: false,
      error: expect.stringContaining("install failed"),
    });
    expect(fs.readFileSync(existingPath, "utf8")).toBe("old-binary");
  });

  test("tools:updateYtDlp swaps in temp binary after successful install", async () => {
    const { CHANNELS } = require("../../ipc/channels");
    const download = require("../../scripts/download.js");
    const toolsVersions = require("../toolsVersions");

    initHandlers();
    const existingPath = path.join(toolsDir, "yt-dlp");
    fs.writeFileSync(existingPath, "old-binary", "utf8");
    toolsVersions.getToolsVersions.mockResolvedValueOnce({
      ytDlp: { ok: true, path: existingPath },
    });
    download.installYtDlp.mockImplementationOnce(async ({ targetPath }) => {
      fs.writeFileSync(targetPath, "new-binary", "utf8");
    });

    const result = await handlers[CHANNELS.TOOLS_UPDATEYTDLP]();

    expect(result).toMatchObject({ success: true });
    expect(fs.readFileSync(existingPath, "utf8")).toBe("new-binary");
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

  test("hashCalculate emits progress events when requestId is provided", async () => {
    const { CHANNELS } = require("../../ipc/channels");
    const filePath = path.join(os.tmpdir(), `hash-progress-${Date.now()}.txt`);
    fs.writeFileSync(filePath, "progress-demo", "utf8");
    const sender = { send: jest.fn() };

    initHandlers();
    const result = await handlers[CHANNELS.TOOLS_HASH_CALCULATE](
      { sender },
      {
        filePath,
        algorithm: "SHA-256",
        requestId: "hash-request-1",
      },
    );

    expect(result.success).toBe(true);
    expect(sender.send).toHaveBeenCalledWith(
      CHANNELS.TOOLS_HASH_PROGRESS,
      expect.objectContaining({
        requestId: "hash-request-1",
        filePath,
        algorithm: "SHA-256",
      }),
    );
    expect(sender.send).toHaveBeenLastCalledWith(
      CHANNELS.TOOLS_HASH_PROGRESS,
      expect.objectContaining({
        requestId: "hash-request-1",
        stage: "done",
        percent: 100,
      }),
    );
  });

  test("hashInspectFile returns readable file metadata", async () => {
    const { CHANNELS } = require("../../ipc/channels");
    const filePath = path.join(os.tmpdir(), `hash-inspect-${Date.now()}.bin`);
    fs.writeFileSync(filePath, "demo", "utf8");

    initHandlers();
    const result = await handlers[CHANNELS.TOOLS_HASH_INSPECT_FILE](null, {
      filePath,
    });

    expect(result).toMatchObject({
      success: true,
      filePath,
      fileName: path.basename(filePath),
      size: 4,
      readable: true,
    });
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

  test("previewSorterPlan uses custom rules with a locked Other fallback", async () => {
    const { CHANNELS } = require("../../ipc/channels");
    const root = fs.mkdtempSync(path.join(os.tmpdir(), "sorter-dry-"));
    fs.writeFileSync(path.join(root, "photo.heic"), "img", "utf8");
    fs.writeFileSync(path.join(root, "readme.md"), "# test", "utf8");

    initHandlers();
    const result = await handlers[CHANNELS.TOOLS_SORTER_PREVIEW_PLAN](null, {
      folderPath: root,
      rules: [
        {
          id: "pictures",
          name: "Pictures",
          folderName: "My Pictures",
          extensions: ["heic"],
        },
        {
          id: "other",
          name: "Editable Other",
          folderName: "Anything",
          extensions: ["md"],
        },
      ],
    });

    expect(result.success).toBe(true);
    expect(result.rules).toEqual([
      expect.objectContaining({
        id: "pictures",
        folderName: "My Pictures",
        extensions: [".heic"],
      }),
      expect.objectContaining({
        id: "other",
        name: "Other",
        folderName: "Other",
        locked: true,
      }),
    ]);
    expect(result.operations).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          fileName: "photo.heic",
          category: "Pictures",
          ruleId: "pictures",
          selectable: true,
        }),
        expect.objectContaining({
          fileName: "readme.md",
          category: "Other",
          ruleId: "other",
        }),
      ]),
    );

    fs.rmSync(root, { recursive: true, force: true });
  });

  test("previewSorterPlan rejects extensions assigned to multiple rules", async () => {
    const { CHANNELS } = require("../../ipc/channels");
    const root = fs.mkdtempSync(path.join(os.tmpdir(), "sorter-rules-"));

    initHandlers();
    const result = await handlers[CHANNELS.TOOLS_SORTER_PREVIEW_PLAN](null, {
      folderPath: root,
      rules: [
        {
          id: "first",
          name: "First",
          folderName: "First",
          extensions: [".txt"],
        },
        {
          id: "second",
          name: "Second",
          folderName: "Second",
          extensions: ["txt"],
        },
      ],
    });

    expect(result.success).toBe(false);
    expect(result.error).toMatch(/duplicate sorter extension/i);

    fs.rmSync(root, { recursive: true, force: true });
  });

  test("previewSorterPlan keeps operation IDs stable", async () => {
    const { CHANNELS } = require("../../ipc/channels");
    const root = fs.mkdtempSync(path.join(os.tmpdir(), "sorter-stable-"));
    fs.writeFileSync(path.join(root, "a.txt"), "a", "utf8");

    initHandlers();
    const first = await handlers[CHANNELS.TOOLS_SORTER_PREVIEW_PLAN](null, {
      folderPath: root,
    });
    const second = await handlers[CHANNELS.TOOLS_SORTER_PREVIEW_PLAN](null, {
      folderPath: root,
    });

    expect(first.planId).not.toBe(second.planId);
    expect(first.operations[0].id).toBe(second.operations[0].id);

    fs.rmSync(root, { recursive: true, force: true });
  });

  test("applySorterPlan applies selected operations only", async () => {
    const { CHANNELS } = require("../../ipc/channels");
    const root = fs.mkdtempSync(path.join(os.tmpdir(), "sorter-selected-"));
    fs.writeFileSync(path.join(root, "a.txt"), "a", "utf8");
    fs.writeFileSync(path.join(root, "b.txt"), "b", "utf8");

    initHandlers();
    const plan = await handlers[CHANNELS.TOOLS_SORTER_PREVIEW_PLAN](null, {
      folderPath: root,
    });
    const selected = plan.operations.find((item) => item.fileName === "a.txt");
    const result = await handlers[CHANNELS.TOOLS_SORTER_APPLY_PLAN](null, {
      planId: plan.planId,
      operationIds: [selected.id],
    });

    expect(result.success).toBe(true);
    expect(result.moved).toBe(1);
    expect(fs.existsSync(path.join(root, "a.txt"))).toBe(false);
    expect(fs.existsSync(path.join(root, "Documents", "a.txt"))).toBe(true);
    expect(fs.existsSync(path.join(root, "b.txt"))).toBe(true);

    fs.rmSync(root, { recursive: true, force: true });
  });

  test("applySorterPlan rejects a source changed after preview", async () => {
    const { CHANNELS } = require("../../ipc/channels");
    const root = fs.mkdtempSync(path.join(os.tmpdir(), "sorter-stale-"));
    fs.writeFileSync(path.join(root, "a.txt"), "source", "utf8");

    initHandlers();
    const plan = await handlers[CHANNELS.TOOLS_SORTER_PREVIEW_PLAN](null, {
      folderPath: root,
    });
    fs.writeFileSync(path.join(root, "a.txt"), "changed source", "utf8");
    const result = await handlers[CHANNELS.TOOLS_SORTER_APPLY_PLAN](null, {
      planId: plan.planId,
      operationIds: [plan.operations[0].id],
    });

    expect(result.success).toBe(true);
    expect(result.moved).toBe(0);
    expect(result.errors[0].message).toMatch(/changed after preview/i);
    expect(result.operations[0]).toEqual(
      expect.objectContaining({
        status: "error",
        reasonCode: "source-changed",
        reasonParams: {},
      }),
    );
    expect(fs.existsSync(path.join(root, "a.txt"))).toBe(true);

    fs.rmSync(root, { recursive: true, force: true });
  });

  test.each([
    ["rename", "a (1).txt", 1],
    ["skip", "a.txt", 0],
  ])("sorter plan supports %s conflicts", async (mode, targetName, moved) => {
    const { CHANNELS } = require("../../ipc/channels");
    const root = fs.mkdtempSync(path.join(os.tmpdir(), `sorter-${mode}-`));
    fs.writeFileSync(path.join(root, "a.txt"), "source", "utf8");
    fs.mkdirSync(path.join(root, "Documents"), { recursive: true });
    fs.writeFileSync(path.join(root, "Documents", "a.txt"), "existing", "utf8");

    initHandlers();
    const plan = await handlers[CHANNELS.TOOLS_SORTER_PREVIEW_PLAN](null, {
      folderPath: root,
      conflictMode: mode,
    });
    const selectable = plan.operations.filter(
      (item) => item.status === "planned",
    );
    const result = await handlers[CHANNELS.TOOLS_SORTER_APPLY_PLAN](null, {
      planId: plan.planId,
      operationIds: selectable.map((item) => item.id),
    });

    expect(result.moved).toBe(moved);
    expect(fs.existsSync(path.join(root, "Documents", targetName))).toBe(true);
    expect(fs.readFileSync(path.join(root, "Documents", "a.txt"), "utf8")).toBe(
      "existing",
    );

    fs.rmSync(root, { recursive: true, force: true });
  });

  test("previewSorterPlan respects recursive and ignore behavior", async () => {
    const { CHANNELS } = require("../../ipc/channels");
    const root = fs.mkdtempSync(path.join(os.tmpdir(), "sorter-recursive-"));
    fs.mkdirSync(path.join(root, "nested"), { recursive: true });
    fs.mkdirSync(path.join(root, "Cache"), { recursive: true });
    fs.mkdirSync(path.join(root, "Cache", "nested"), { recursive: true });
    fs.writeFileSync(path.join(root, "nested", "track.mp3"), "audio", "utf8");
    fs.writeFileSync(path.join(root, "nested", "skip.tmp"), "tmp", "utf8");
    fs.writeFileSync(
      path.join(root, "Cache", "nested", "cached.mp3"),
      "cache",
      "utf8",
    );

    initHandlers();
    const result = await handlers[CHANNELS.TOOLS_SORTER_PREVIEW_PLAN](null, {
      folderPath: root,
      recursive: true,
      ignoreExtensions: ".tmp",
      ignoreFolders: "Cache",
    });

    expect(result.success).toBe(true);
    expect(result.planned).toBe(1);
    expect(result.skipped).toBe(2);
    expect(result.operations).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          fileName: "track.mp3",
          relativeDir: "nested",
          status: "planned",
        }),
        expect.objectContaining({
          fileName: "skip.tmp",
          status: "skipped",
          action: "ignored-extension",
          reasonCode: "ignored-extension",
          reasonParams: { extension: ".tmp" },
        }),
        expect.objectContaining({
          fileName: "cached.mp3",
          relativeDir: path.join("Cache", "nested"),
          status: "skipped",
          action: "ignored-folder",
          reasonCode: "ignored-folder",
          reasonParams: { folder: "Cache" },
        }),
      ]),
    );

    fs.rmSync(root, { recursive: true, force: true });
  });

  test("replace apply backs up target and undo restores both files", async () => {
    const { CHANNELS } = require("../../ipc/channels");
    const root = fs.mkdtempSync(path.join(os.tmpdir(), "sorter-replace-"));
    fs.writeFileSync(path.join(root, "a.txt"), "source", "utf8");
    fs.mkdirSync(path.join(root, "Documents"), { recursive: true });
    fs.writeFileSync(path.join(root, "Documents", "a.txt"), "existing", "utf8");

    initHandlers();
    const plan = await handlers[CHANNELS.TOOLS_SORTER_PREVIEW_PLAN](null, {
      folderPath: root,
      conflictMode: "replace",
    });
    const plannedOperation = plan.operations.find(
      (item) => item.status === "planned",
    );
    const applied = await handlers[CHANNELS.TOOLS_SORTER_APPLY_PLAN](null, {
      planId: plan.planId,
      operationIds: [plannedOperation.id],
    });

    expect(applied.moved).toBe(1);
    expect(
      fs.existsSync(
        path.join(
          require("electron").app.getPath("userData"),
          "file-sorter-undo",
          applied.runId,
          `${plannedOperation.id}.backup`,
        ),
      ),
    ).toBe(true);
    expect(fs.readFileSync(path.join(root, "Documents", "a.txt"), "utf8")).toBe(
      "source",
    );
    const undo = await handlers[CHANNELS.TOOLS_SORTER_UNDO_RUN](null, {
      runId: applied.runId,
    });
    expect(undo.success).toBe(true);
    expect(fs.readFileSync(path.join(root, "a.txt"), "utf8")).toBe("source");
    expect(fs.readFileSync(path.join(root, "Documents", "a.txt"), "utf8")).toBe(
      "existing",
    );
    expect(
      await handlers[CHANNELS.TOOLS_SORTER_UNDO_RUN](null, {
        runId: applied.runId,
      }),
    ).toEqual(expect.objectContaining({ success: false }));

    fs.rmSync(root, { recursive: true, force: true });
  });

  test("a new apply clears the previous undo run", async () => {
    const { CHANNELS } = require("../../ipc/channels");
    const firstRoot = fs.mkdtempSync(path.join(os.tmpdir(), "sorter-first-"));
    const secondRoot = fs.mkdtempSync(path.join(os.tmpdir(), "sorter-second-"));
    fs.writeFileSync(path.join(firstRoot, "a.txt"), "a", "utf8");
    fs.writeFileSync(path.join(secondRoot, "b.txt"), "b", "utf8");

    initHandlers();
    const firstPlan = await handlers[CHANNELS.TOOLS_SORTER_PREVIEW_PLAN](null, {
      folderPath: firstRoot,
    });
    const firstRun = await handlers[CHANNELS.TOOLS_SORTER_APPLY_PLAN](null, {
      operationIds: [firstPlan.operations[0].id],
    });
    const secondPlan = await handlers[CHANNELS.TOOLS_SORTER_PREVIEW_PLAN](
      null,
      { folderPath: secondRoot },
    );
    await handlers[CHANNELS.TOOLS_SORTER_APPLY_PLAN](null, {
      operationIds: [secondPlan.operations[0].id],
    });

    const staleUndo = await handlers[CHANNELS.TOOLS_SORTER_UNDO_RUN](null, {
      runId: firstRun.runId,
    });
    expect(staleUndo.success).toBe(false);
    expect(staleUndo.error).toMatch(/no longer current/i);

    fs.rmSync(firstRoot, { recursive: true, force: true });
    fs.rmSync(secondRoot, { recursive: true, force: true });
  });

  test("undo keeps conflicting entries available for retry", async () => {
    const { CHANNELS } = require("../../ipc/channels");
    const root = fs.mkdtempSync(path.join(os.tmpdir(), "sorter-retry-"));
    fs.writeFileSync(path.join(root, "a.txt"), "source", "utf8");

    initHandlers();
    const plan = await handlers[CHANNELS.TOOLS_SORTER_PREVIEW_PLAN](null, {
      folderPath: root,
    });
    const applied = await handlers[CHANNELS.TOOLS_SORTER_APPLY_PLAN](null, {
      planId: plan.planId,
      operationIds: [plan.operations[0].id],
    });
    fs.writeFileSync(path.join(root, "a.txt"), "conflict", "utf8");

    const blocked = await handlers[CHANNELS.TOOLS_SORTER_UNDO_RUN](null, {
      runId: applied.runId,
    });
    expect(blocked).toEqual(
      expect.objectContaining({ success: false, canUndo: true, undone: 0 }),
    );
    expect(blocked.operations[0]).toEqual(
      expect.objectContaining({
        status: "error",
        reasonCode: "source-path-occupied",
        reasonParams: { message: "Original source path is occupied" },
      }),
    );

    fs.unlinkSync(path.join(root, "a.txt"));
    const retried = await handlers[CHANNELS.TOOLS_SORTER_UNDO_RUN](null, {
      runId: applied.runId,
    });
    expect(retried).toEqual(
      expect.objectContaining({ success: true, canUndo: false, undone: 1 }),
    );
    expect(fs.readFileSync(path.join(root, "a.txt"), "utf8")).toBe("source");

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

  test("sorterExport writes result file via save dialog", async () => {
    const { CHANNELS } = require("../../ipc/channels");
    const { dialog } = require("electron");
    const root = fs.mkdtempSync(path.join(os.tmpdir(), "sorter-export-"));
    const exportPath = path.join(root, "result.json");
    dialog.showSaveDialog.mockResolvedValue({
      canceled: false,
      filePath: exportPath,
    });

    initHandlers();
    const result = await handlers[CHANNELS.TOOLS_SORTER_EXPORT](null, {
      content: '{"demo":"ok"}',
      suggestedName: "demo.json",
      format: "json",
    });

    expect(result).toEqual({ success: true, filePath: exportPath });
    expect(fs.readFileSync(exportPath, "utf8")).toContain('"demo":"ok"');

    fs.rmSync(root, { recursive: true, force: true });
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
    expect(result.migrated).toEqual(
      expect.arrayContaining([ytName, ffName, fpName]),
    );
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
    const programsResult =
      await handlers[CHANNELS.TOOLS_CREATE_WINDOWS_PROGRAMS_SHORTCUT]();
    const diskCleanupResult =
      await handlers[CHANNELS.TOOLS_CREATE_WINDOWS_DISK_CLEANUP_SHORTCUT]();

    [uefiResult, advancedBootResult, programsResult, diskCleanupResult].forEach(
      (result) => {
        expect(result.success).toBe(false);
        expect(result.unsupported).toBe(true);
      },
    );
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
    await handlers[CHANNELS.TOOLS_CREATE_WINDOWS_PROGRAMS_SHORTCUT]();
    await handlers[CHANNELS.TOOLS_CREATE_WINDOWS_DISK_CLEANUP_SHORTCUT]();

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

    expect(shell.writeShortcutLink).toHaveBeenNthCalledWith(
      3,
      expect.any(String),
      "create",
      expect.objectContaining({
        target: "C:\\Windows\\System32\\control.exe",
        args: "appwiz.cpl",
      }),
    );
    expect(shell.writeShortcutLink).toHaveBeenNthCalledWith(
      4,
      expect.any(String),
      "create",
      expect.objectContaining({
        target: "C:\\Windows\\System32\\cleanmgr.exe",
        args: "",
      }),
    );
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

  function initHandlers({
    storeValues = {},
    downloadState = { downloadPath: "/tmp", downloadInProgress: false },
  } = {}) {
    const { setupIpcHandlers } = require("../ipcHandlers");
    const setReloadMenuEnabled = jest.fn();
    const mainWindow = {
      webContents: {
        send: jest.fn(),
        isDestroyed: () => false,
        on: jest.fn(),
      },
    };
    const storeGet = jest.fn((key, def) =>
      Object.prototype.hasOwnProperty.call(storeValues, key)
        ? storeValues[key]
        : def,
    );
    setupIpcHandlers({
      mainWindow,
      store: {
        get: storeGet,
        set: jest.fn(),
        delete: jest.fn(),
      },
      downloadState,
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
      setReloadMenuEnabled,
      dispatchPendingWhatsNew: jest.fn(),
      clearPendingWhatsNewVersion: jest.fn(),
    });
    return { mainWindow, setReloadMenuEnabled, downloadState };
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

  test("DOWNLOAD_VIDEO blocks reload while a download is active and restores it afterwards", async () => {
    const { CHANNELS } = require("../../ipc/channels");
    const download = require("../../scripts/download.js");
    const { getToolsVersions } = require("../toolsVersions");
    const shortcuts = require("../shortcuts.js");
    const media = deferred();

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
    download.downloadMedia.mockImplementation(() => media.promise);

    const { setReloadMenuEnabled } = initHandlers();
    const event = { sender: { send: jest.fn() } };
    const promise = handlers[CHANNELS.DOWNLOAD_VIDEO](
      event,
      "https://example.com/a",
      "Source",
      "job-a",
    );

    await Promise.resolve();
    expect(shortcuts.setReloadShortcutSuppressed).toHaveBeenCalledWith(true);
    expect(setReloadMenuEnabled).toHaveBeenCalledWith(false);

    media.resolve("/tmp/file-a.mp4");
    await promise;

    expect(shortcuts.setReloadShortcutSuppressed).toHaveBeenLastCalledWith(
      false,
    );
    expect(setReloadMenuEnabled).toHaveBeenLastCalledWith(true);
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

  test("DOWNLOAD_VIDEO shows warning when yt-dlp and ffmpeg are missing", async () => {
    const { CHANNELS } = require("../../ipc/channels");
    const { getToolsVersions } = require("../toolsVersions");
    const { setupIpcHandlers } = require("../ipcHandlers");
    const send = jest.fn();

    getToolsVersions.mockResolvedValue({
      ytDlp: { ok: false },
      ffmpeg: { ok: false },
    });

    setupIpcHandlers({
      mainWindow: {
        webContents: {
          send,
          isDestroyed: () => false,
          on: jest.fn(),
        },
      },
      store: {
        get: jest.fn((key, fallback) => fallback),
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

    await expect(
      handlers[CHANNELS.DOWNLOAD_VIDEO](
        { sender: { send: jest.fn() } },
        "https://example.com/a",
        "Source",
        "job-missing-tools",
      ),
    ).rejects.toThrow("Отсутствуют необходимые инструменты");

    expect(send).toHaveBeenCalledWith(
      "toast",
      expect.stringContaining("yt-dlp и ffmpeg"),
      "warning",
    );
  });

  test("DOWNLOAD_VIDEO shows warning when only ffmpeg is missing", async () => {
    const { CHANNELS } = require("../../ipc/channels");
    const { getToolsVersions } = require("../toolsVersions");
    const { setupIpcHandlers } = require("../ipcHandlers");
    const send = jest.fn();

    getToolsVersions.mockResolvedValue({
      ytDlp: { ok: true },
      ffmpeg: { ok: false },
    });

    setupIpcHandlers({
      mainWindow: {
        webContents: {
          send,
          isDestroyed: () => false,
          on: jest.fn(),
        },
      },
      store: {
        get: jest.fn((key, fallback) => fallback),
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

    await expect(
      handlers[CHANNELS.DOWNLOAD_VIDEO](
        { sender: { send: jest.fn() } },
        "https://example.com/a",
        "Source",
        "job-missing-ffmpeg",
      ),
    ).rejects.toThrow("Отсутствуют необходимые инструменты");

    expect(send).toHaveBeenCalledWith(
      "toast",
      expect.stringContaining("Не найден ffmpeg"),
      "warning",
    );
  });

  test("DOWNLOAD_VIDEO returns structured classified error for known download failures", async () => {
    const { CHANNELS } = require("../../ipc/channels");
    const download = require("../../scripts/download.js");
    const { getToolsVersions } = require("../toolsVersions");

    getToolsVersions.mockResolvedValue({
      ytDlp: { ok: true },
      ffmpeg: { ok: true },
    });
    download.getVideoInfo.mockResolvedValue({
      title: "Private video",
      formats: [{ format_id: "best" }],
      thumbnail: "",
      duration: 0,
    });
    download.selectFormatsByQuality.mockReturnValue({
      videoFormat: "bestvideo",
      audioFormat: "bestaudio",
      audioExt: "m4a",
      videoExt: "mp4",
      resolution: "1080p",
      fps: 30,
    });
    download.downloadMedia.mockRejectedValueOnce(
      new Error("ERR_YTDLP_PRIVATE_CONTENT: members-only"),
    );

    initHandlers();
    const result = await handlers[CHANNELS.DOWNLOAD_VIDEO](
      { sender: { send: jest.fn() } },
      "https://www.youtube.com/watch?v=private-video",
      "Source",
      "job-private",
    );

    expect(result).toMatchObject({
      success: false,
      errorCode: "PRIVATE_CONTENT",
      retryable: false,
      jobId: "job-private",
      sourceUrl: "https://www.youtube.com/watch?v=private-video",
    });
    expect(result.message).toContain("участникам");
  });

  test("DOWNLOAD_VIDEO does not emit duplicate renderer toast for classified failures", async () => {
    const { CHANNELS } = require("../../ipc/channels");
    const download = require("../../scripts/download.js");
    const { getToolsVersions } = require("../toolsVersions");
    const { setupIpcHandlers } = require("../ipcHandlers");
    const send = jest.fn();

    getToolsVersions.mockResolvedValue({
      ytDlp: { ok: true },
      ffmpeg: { ok: true },
    });
    download.getVideoInfo.mockResolvedValue({
      title: "Disk issue",
      formats: [{ format_id: "best" }],
      thumbnail: "",
      duration: 0,
    });
    download.selectFormatsByQuality.mockReturnValue({
      videoFormat: "bestvideo",
      audioFormat: "bestaudio",
      audioExt: "m4a",
      videoExt: "mp4",
      resolution: "1080p",
      fps: 30,
    });
    download.downloadMedia.mockRejectedValueOnce(
      new Error("ERR_DOWNLOAD_PERMISSION_DENIED: permission denied"),
    );

    setupIpcHandlers({
      mainWindow: {
        webContents: {
          send,
          isDestroyed: () => false,
          on: jest.fn(),
        },
      },
      store: {
        get: jest.fn((key, fallback) => fallback),
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

    const result = await handlers[CHANNELS.DOWNLOAD_VIDEO](
      { sender: { send: jest.fn() } },
      "https://www.youtube.com/watch?v=permission-problem",
      "Source",
      "job-permission",
    );

    expect(result).toMatchObject({
      success: false,
      errorCode: "PERMISSION_DENIED",
    });
    expect(send).not.toHaveBeenCalledWith("toast", expect.any(String), "error");
  });

  test("CANCEL_DOWNLOAD_JOB cancels only the targeted active job", async () => {
    const { CHANNELS } = require("../../ipc/channels");
    const download = require("../../scripts/download.js");
    const tokenA = { cancelled: false };
    const tokenB = { cancelled: false };
    const activeDownloads = new Map([
      ["job-a", { token: tokenA }],
      ["job-b", { token: tokenB }],
    ]);
    download.stopDownload.mockResolvedValue(1);
    initHandlers({
      downloadState: {
        downloadPath: "/tmp",
        downloadInProgress: true,
        activeDownloads,
      },
    });

    const result = await handlers[CHANNELS.CANCEL_DOWNLOAD_JOB](null, {
      jobId: "job-b",
    });

    expect(result).toEqual({
      success: true,
      jobId: "job-b",
      cancelled: true,
    });
    expect(download.stopDownload).toHaveBeenCalledTimes(1);
    expect(download.stopDownload).toHaveBeenCalledWith(tokenB);
    expect(activeDownloads).toEqual(
      new Map([
        ["job-a", { token: tokenA }],
        ["job-b", { token: tokenB }],
      ]),
    );
  });

  test("CANCEL_DOWNLOAD_JOB is idempotent for an unknown job", async () => {
    const { CHANNELS } = require("../../ipc/channels");
    const download = require("../../scripts/download.js");
    initHandlers({
      downloadState: {
        downloadPath: "/tmp",
        downloadInProgress: false,
        activeDownloads: new Map(),
      },
    });

    const result = await handlers[CHANNELS.CANCEL_DOWNLOAD_JOB](null, {
      jobId: "missing-job",
    });

    expect(result).toEqual({
      success: true,
      jobId: "missing-job",
      cancelled: false,
      reason: "not-active",
    });
    expect(download.stopDownload).not.toHaveBeenCalled();
  });

  test("CANCEL_DOWNLOAD_JOB returns a structured cancellation error", async () => {
    const { CHANNELS } = require("../../ipc/channels");
    const download = require("../../scripts/download.js");
    const token = { cancelled: false };
    download.stopDownload.mockRejectedValue(new Error("Cancel failed"));
    initHandlers({
      downloadState: {
        downloadPath: "/tmp",
        downloadInProgress: true,
        activeDownloads: new Map([["job-a", { token }]]),
      },
    });

    const result = await handlers[CHANNELS.CANCEL_DOWNLOAD_JOB](null, {
      jobId: "job-a",
    });

    expect(result).toEqual({
      success: false,
      jobId: "job-a",
      errorCode: "CANCEL_FAILED",
      error: "Cancel failed",
    });
  });

  test.each([
    null,
    [],
    "job-a",
    {},
    { jobId: null },
    { jobId: "" },
    { jobId: "   " },
  ])("CANCEL_DOWNLOAD_JOB rejects invalid payload %#", async (payload) => {
    const { CHANNELS } = require("../../ipc/channels");
    const download = require("../../scripts/download.js");
    initHandlers();

    const result = await handlers[CHANNELS.CANCEL_DOWNLOAD_JOB](null, payload);

    expect(result).toEqual({
      success: false,
      errorCode: "INVALID_JOB_ID",
      error: "jobId must be a non-empty string",
    });
    expect(download.stopDownload).not.toHaveBeenCalled();
  });

  test("STOP_DOWNLOAD still cancels all active tokens", async () => {
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

    const stopResult = await handlers[CHANNELS.STOP_DOWNLOAD]();
    expect(stopResult).toEqual({ success: true, cancelled: 2 });
    expect(download.stopDownload).toHaveBeenCalledWith([tokenA, tokenB]);

    mediaA.resolve("/tmp/file-a.mp4");
    mediaB.resolve("/tmp/file-b.mp4");
    await p1;
    await p2;
  });

  test("wingetCheckStatus returns unsupported outside Windows", async () => {
    const { CHANNELS } = require("../../ipc/channels");

    Object.defineProperty(process, "platform", {
      value: "darwin",
      configurable: true,
    });
    initHandlers();

    const result = await handlers[CHANNELS.TOOLS_WINGET_CHECK_STATUS](null, {
      packageIds: ["Git.Git"],
    });

    expect(result).toMatchObject({ success: false, unsupported: true });
  });

  test("wingetCheckStatus checks exact IDs and returns versions", async () => {
    const { CHANNELS } = require("../../ipc/channels");
    const childProcess = require("child_process");

    Object.defineProperty(process, "platform", {
      value: "win32",
      configurable: true,
    });
    childProcess.execFile.mockImplementation((_cmd, args, _opts, cb) => {
      const wingetArgs = extractWingetArgs(args);
      if (wingetArgs[0] === "--version") {
        cb(null, "v1.8.0", "");
        return;
      }
      if (wingetArgs[0] === "list") {
        cb(
          null,
          [
            "Name      Id            Version  Source",
            "----------------------------------------",
            "Git       Git.Git       2.50.0   winget",
            "VLC       VideoLAN.VLC  3.0.20   winget",
          ].join("\n"),
          "",
        );
        return;
      }
      if (wingetArgs[0] === "upgrade") {
        cb(
          null,
          [
            "Name      Id       Version  Available  Source",
            "-----------------------------------------------",
            "Git       Git.Git  2.50.0   2.51.0     winget",
          ].join("\n"),
          "",
        );
        return;
      }
      cb(null, "No installed package found matching input criteria.", "");
    });

    initHandlers();
    const result = await handlers[CHANNELS.TOOLS_WINGET_CHECK_STATUS](null, {
      packageIds: ["Git.Git", "VideoLAN.VLC", "Mozilla.Firefox"],
    });

    expect(result).toEqual({
      success: true,
      items: [
        {
          availableVersion: "2.51.0",
          currentVersion: "2.50.0",
          packageId: "Git.Git",
          status: "updateAvailable",
        },
        {
          availableVersion: "",
          currentVersion: "3.0.20",
          packageId: "VideoLAN.VLC",
          status: "installed",
        },
        {
          availableVersion: "",
          currentVersion: "",
          packageId: "Mozilla.Firefox",
          status: "notInstalled",
        },
      ],
    });
    expect(childProcess.execFile).toHaveBeenCalledWith(
      "powershell.exe",
      expect.arrayContaining([
        "-Command",
        expect.stringContaining("& 'winget' 'list'"),
      ]),
      expect.any(Object),
      expect.any(Function),
    );
    expect(childProcess.execFile).toHaveBeenCalledWith(
      "powershell.exe",
      expect.arrayContaining([
        "-Command",
        expect.stringContaining("& 'winget' 'upgrade' '--include-unknown'"),
      ]),
      expect.any(Object),
      expect.any(Function),
    );
  });

  test("wingetCheckStatus parses bulk table output", async () => {
    const { CHANNELS } = require("../../ipc/channels");
    const childProcess = require("child_process");

    Object.defineProperty(process, "platform", {
      value: "win32",
      configurable: true,
    });
    childProcess.execFile.mockImplementation((_cmd, args, _opts, cb) => {
      const wingetArgs = extractWingetArgs(args);
      if (wingetArgs[0] === "--version") {
        cb(null, "v1.6.0", "");
        return;
      }
      if (wingetArgs[0] === "list") {
        cb(
          null,
          "Name      Id       Version  Source\n----------------------------------------\nGit       Git.Git  2.50.0   winget",
          "",
        );
        return;
      }
      cb(null, "No installed package found matching input criteria.", "");
    });

    initHandlers();
    const result = await handlers[CHANNELS.TOOLS_WINGET_CHECK_STATUS](null, {
      packageIds: ["Git.Git"],
    });

    expect(result).toEqual({
      success: true,
      items: [
        {
          availableVersion: "",
          currentVersion: "2.50.0",
          packageId: "Git.Git",
          status: "installed",
        },
      ],
    });
    expect(childProcess.execFile).toHaveBeenCalledWith(
      "powershell.exe",
      expect.arrayContaining([
        "-Command",
        expect.stringContaining("& 'winget' 'list'"),
      ]),
      expect.any(Object),
      expect.any(Function),
    );
  });

  test("wingetCheckStatus falls back to positional package query when bulk output is unusable", async () => {
    const { CHANNELS } = require("../../ipc/channels");
    const childProcess = require("child_process");

    Object.defineProperty(process, "platform", {
      value: "win32",
      configurable: true,
    });
    childProcess.execFile.mockImplementation((_cmd, args, _opts, cb) => {
      const wingetArgs = extractWingetArgs(args);
      if (wingetArgs[0] === "--version") {
        cb(null, "v1.8.0", "");
        return;
      }
      const usesBulkList = wingetArgs[0] === "list" && wingetArgs.length === 1;
      if (usesBulkList) {
        cb(null, "unexpected output", "");
        return;
      }
      const usesPositionalGit =
        wingetArgs[0] === "list" &&
        wingetArgs[1] === "Git.Git" &&
        wingetArgs.includes("--exact");
      if (usesPositionalGit) {
        cb(
          null,
          "Name      Id       Version  Source\n----------------------------------------\nGit       Git.Git  2.50.0   winget",
          "",
        );
        return;
      }
      cb(null, "No installed package found matching input criteria.", "");
    });

    initHandlers();
    const result = await handlers[CHANNELS.TOOLS_WINGET_CHECK_STATUS](null, {
      packageIds: ["Git.Git"],
    });

    expect(result).toEqual({
      success: true,
      items: [
        {
          availableVersion: "",
          currentVersion: "2.50.0",
          packageId: "Git.Git",
          status: "installed",
        },
      ],
    });
    expect(childProcess.execFile).toHaveBeenCalledWith(
      "powershell.exe",
      expect.arrayContaining([
        "-Command",
        expect.stringContaining("& 'winget' 'list' 'Git.Git' '--exact'"),
      ]),
      expect.any(Object),
      expect.any(Function),
    );
  });

  test("wingetRunInstall rejects invalid package IDs", async () => {
    const { CHANNELS } = require("../../ipc/channels");

    Object.defineProperty(process, "platform", {
      value: "win32",
      configurable: true,
    });
    initHandlers();

    const result = await handlers[CHANNELS.TOOLS_WINGET_RUN_INSTALL](null, {
      packageIds: ["Git.Git;Remove-Item"],
    });

    expect(result).toMatchObject({
      success: false,
      error: expect.stringContaining("Invalid WinGet package ID"),
    });
  });

  test("wingetRunUninstall rejects invalid package IDs", async () => {
    const { CHANNELS } = require("../../ipc/channels");

    Object.defineProperty(process, "platform", {
      value: "win32",
      configurable: true,
    });
    initHandlers();

    const result = await handlers[CHANNELS.TOOLS_WINGET_RUN_UNINSTALL](null, {
      packageIds: ["Git.Git;Remove-Item"],
    });

    expect(result).toMatchObject({
      success: false,
      error: expect.stringContaining("Invalid WinGet package ID"),
    });
  });

  test("wingetRunInstall streams PowerShell output and succeeds", async () => {
    const { CHANNELS } = require("../../ipc/channels");
    const childProcess = require("child_process");
    const proc = new EventEmitter();
    proc.stdout = new EventEmitter();
    proc.stderr = new EventEmitter();
    proc.kill = jest.fn();
    childProcess.spawn.mockImplementation(() => {
      setTimeout(() => {
        proc.stdout.emit("data", Buffer.from("Installing Git.Git\n"));
        proc.emit("close", 0);
      }, 0);
      return proc;
    });
    Object.defineProperty(process, "platform", {
      value: "win32",
      configurable: true,
    });

    const { mainWindow } = initHandlers();
    const result = await handlers[CHANNELS.TOOLS_WINGET_RUN_INSTALL](null, {
      packageIds: ["Git.Git"],
      runId: "run-1",
    });

    expect(result).toMatchObject({ success: true, exitCode: 0 });
    expect(childProcess.spawn).toHaveBeenCalledWith(
      "powershell.exe",
      expect.arrayContaining(["-NoProfile", "-ExecutionPolicy", "Bypass"]),
      expect.objectContaining({ windowsHide: true }),
    );
    expect(mainWindow.webContents.send).toHaveBeenCalledWith(
      CHANNELS.TOOLS_WINGET_LOG,
      expect.objectContaining({
        runId: "run-1",
        text: "Installing Git.Git",
      }),
    );
  });

  test("wingetRunInstall filters noisy PowerShell progress output", async () => {
    const { CHANNELS } = require("../../ipc/channels");
    const childProcess = require("child_process");
    const proc = new EventEmitter();
    proc.stdout = new EventEmitter();
    proc.stderr = new EventEmitter();
    proc.kill = jest.fn();
    childProcess.spawn.mockImplementation(() => {
      setTimeout(() => {
        proc.stdout.emit(
          "data",
          Buffer.from("\u001b[?25l\r████ 42%\r\nInstalling Git.Git\n"),
        );
        proc.emit("close", 0);
      }, 0);
      return proc;
    });
    Object.defineProperty(process, "platform", {
      value: "win32",
      configurable: true,
    });

    const { mainWindow } = initHandlers();
    await handlers[CHANNELS.TOOLS_WINGET_RUN_INSTALL](null, {
      packageIds: ["Git.Git"],
      runId: "run-noise",
    });

    expect(mainWindow.webContents.send).toHaveBeenCalledWith(
      CHANNELS.TOOLS_WINGET_LOG,
      expect.objectContaining({
        runId: "run-noise",
        text: "Installing Git.Git",
      }),
    );
    expect(mainWindow.webContents.send).not.toHaveBeenCalledWith(
      CHANNELS.TOOLS_WINGET_LOG,
      expect.objectContaining({
        text: expect.stringContaining("████"),
      }),
    );
  });

  test("wingetRunUpdate returns non-zero PowerShell exit", async () => {
    const { CHANNELS } = require("../../ipc/channels");
    const childProcess = require("child_process");
    const proc = new EventEmitter();
    proc.stdout = new EventEmitter();
    proc.stderr = new EventEmitter();
    proc.kill = jest.fn();
    childProcess.spawn.mockImplementation(() => {
      setTimeout(() => {
        proc.stderr.emit("data", Buffer.from("failed\n"));
        proc.emit("close", 12);
      }, 0);
      return proc;
    });
    Object.defineProperty(process, "platform", {
      value: "win32",
      configurable: true,
    });

    initHandlers();
    const result = await handlers[CHANNELS.TOOLS_WINGET_RUN_UPDATE](null, {
      packageIds: ["Git.Git"],
      runId: "run-2",
    });

    expect(result).toMatchObject({
      success: false,
      exitCode: 12,
      error: "PowerShell exited with 12",
    });
  });

  test("wingetRunUninstall starts PowerShell with uninstall command", async () => {
    const { CHANNELS } = require("../../ipc/channels");
    const childProcess = require("child_process");
    const proc = new EventEmitter();
    proc.stdout = new EventEmitter();
    proc.stderr = new EventEmitter();
    proc.kill = jest.fn();
    childProcess.spawn.mockImplementation(() => {
      setTimeout(() => {
        proc.stdout.emit("data", Buffer.from("Uninstalling Git.Git\n"));
        proc.emit("close", 0);
      }, 0);
      return proc;
    });
    Object.defineProperty(process, "platform", {
      value: "win32",
      configurable: true,
    });

    initHandlers();
    const result = await handlers[CHANNELS.TOOLS_WINGET_RUN_UNINSTALL](null, {
      packageIds: ["Git.Git"],
      runId: "run-uninstall",
    });

    const script = childProcess.spawn.mock.calls[0][1].at(-1);

    expect(result).toMatchObject({ success: true, exitCode: 0 });
    expect(childProcess.spawn).toHaveBeenCalledWith(
      "powershell.exe",
      expect.arrayContaining(["-NoProfile", "-ExecutionPolicy", "Bypass"]),
      expect.objectContaining({ windowsHide: true }),
    );
    expect(script).toContain("winget uninstall --id $packageId --exact");
    expect(script).not.toContain("--accept-package-agreements");
  });
});
