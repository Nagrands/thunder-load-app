const fs = require("fs");
const os = require("os");
const path = require("path");

const handlers = {};

jest.mock("electron-log", () => ({
  warn: jest.fn(),
}));

describe("historyPreviewIpcHandlers", () => {
  let root;
  let previewDirPath;

  beforeEach(() => {
    Object.keys(handlers).forEach((key) => delete handlers[key]);
    jest.clearAllMocks();
    root = fs.mkdtempSync(path.join(os.tmpdir(), "history-preview-ipc-"));
    previewDirPath = path.join(root, "preview-cache");
  });

  afterEach(() => {
    fs.rmSync(root, { recursive: true, force: true });
  });

  function isPathInsideBaseDir(filePath, baseDir) {
    const relative = path.relative(baseDir, filePath);
    return relative && !relative.startsWith("..") && !path.isAbsolute(relative);
  }

  function register() {
    const { CHANNELS } = require("../../ipc/channels");
    const {
      createHistoryPreviewCache,
    } = require("../historyPreviewIpcHandlers");
    const ipcMain = {
      handle: jest.fn((channel, callback) => {
        handlers[channel] = callback;
      }),
    };

    const historyPreviewCache = createHistoryPreviewCache({
      previewDirPath,
      isPathInsideBaseDir,
    });

    historyPreviewCache.registerHistoryPreviewIpcHandlers({ ipcMain });

    return { CHANNELS, historyPreviewCache, ipcMain };
  }

  test("registers preview cache channels", () => {
    const { CHANNELS, ipcMain } = register();

    expect(ipcMain.handle).toHaveBeenCalledWith(
      CHANNELS.CACHE_HISTORY_PREVIEW,
      expect.any(Function),
    );
    expect(ipcMain.handle).toHaveBeenCalledWith(
      CHANNELS.DELETE_HISTORY_PREVIEW,
      expect.any(Function),
    );
  });

  test("cache-history-preview saves data URL preview with safe file name", async () => {
    const { CHANNELS } = register();
    const url = `data:image/png;base64,${Buffer.from("png").toString("base64")}`;

    const result = await handlers[CHANNELS.CACHE_HISTORY_PREVIEW](null, {
      url,
      entryId: "entry:1",
      fileName: "Video Name!",
    });

    expect(result.success).toBe(true);
    expect(result.filePath).toContain(previewDirPath);
    expect(path.basename(result.filePath)).toBe("Video_Name-entry1.png");
    expect(fs.readFileSync(result.filePath, "utf8")).toBe("png");
  });

  test("cache-history-preview rejects missing URL", async () => {
    const { CHANNELS } = register();

    const result = await handlers[CHANNELS.CACHE_HISTORY_PREVIEW](null, {});

    expect(result).toEqual({
      success: false,
      error: "Invalid preview URL",
    });
  });

  test("delete-history-preview removes only files inside preview cache", async () => {
    const { CHANNELS } = register();
    fs.mkdirSync(previewDirPath, { recursive: true });
    const insidePath = path.join(previewDirPath, "preview.jpg");
    const outsidePath = path.join(root, "outside.jpg");
    fs.writeFileSync(insidePath, "inside");
    fs.writeFileSync(outsidePath, "outside");

    const result = await handlers[CHANNELS.DELETE_HISTORY_PREVIEW](null, [
      insidePath,
      outsidePath,
    ]);

    expect(result).toEqual({ success: true, removed: 1 });
    expect(fs.existsSync(insidePath)).toBe(false);
    expect(fs.existsSync(outsidePath)).toBe(true);
  });

  test("ensurePreviewCacheDir creates preview cache directory", async () => {
    const { historyPreviewCache } = register();

    const result = await historyPreviewCache.ensurePreviewCacheDir();

    expect(result).toBe(previewDirPath);
    expect(fs.existsSync(previewDirPath)).toBe(true);
  });
});
