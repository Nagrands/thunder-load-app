const fs = require("fs");
const os = require("os");
const path = require("path");

const handlers = {};

jest.mock("electron-log", () => ({
  error: jest.fn(),
  warn: jest.fn(),
}));

describe("historyIpcHandlers", () => {
  let root;
  let historyFilePath;
  let previewDirPath;

  beforeEach(() => {
    Object.keys(handlers).forEach((key) => delete handlers[key]);
    jest.clearAllMocks();
    root = fs.mkdtempSync(path.join(os.tmpdir(), "history-ipc-"));
    historyFilePath = path.join(root, "history.json");
    previewDirPath = path.join(root, "preview-cache");
  });

  afterEach(() => {
    fs.rmSync(root, { recursive: true, force: true });
  });

  function register() {
    const { CHANNELS } = require("../../ipc/channels");
    const { registerHistoryIpcHandlers } = require("../historyIpcHandlers");
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
    const ensurePreviewCacheDir = jest.fn(async () => {
      await fs.promises.mkdir(previewDirPath, { recursive: true });
    });

    registerHistoryIpcHandlers({
      ipcMain,
      ensurePreviewCacheDir,
      historyFilePath,
      mainWindow,
      previewDirPath,
    });

    return { CHANNELS, ensurePreviewCacheDir, ipcMain, mainWindow };
  }

  test("registers history channels", () => {
    const { CHANNELS, ipcMain } = register();

    [
      CHANNELS.LOAD_HISTORY,
      CHANNELS.SAVE_HISTORY,
      CHANNELS.CLEAR_HISTORY,
      CHANNELS.GET_DOWNLOAD_COUNT,
    ].forEach((channel) => {
      expect(ipcMain.handle).toHaveBeenCalledWith(
        channel,
        expect.any(Function),
      );
    });
  });

  test("load-history creates an empty file when missing", async () => {
    const { CHANNELS } = register();

    const result = await handlers[CHANNELS.LOAD_HISTORY]();

    expect(result).toEqual([]);
    expect(JSON.parse(fs.readFileSync(historyFilePath, "utf8"))).toEqual([]);
  });

  test("save-history writes entries and emits count", async () => {
    const { CHANNELS, mainWindow } = register();
    const history = [{ id: "one" }, { id: "two" }];

    await handlers[CHANNELS.SAVE_HISTORY](null, history);

    expect(JSON.parse(fs.readFileSync(historyFilePath, "utf8"))).toEqual(
      history,
    );
    expect(mainWindow.webContents.send).toHaveBeenCalledWith(
      "history-updated",
      { count: 2 },
    );
  });

  test("get-download-count reads history length", async () => {
    const { CHANNELS } = register();
    fs.writeFileSync(historyFilePath, JSON.stringify([{ id: "one" }]), "utf8");

    const result = await handlers[CHANNELS.GET_DOWNLOAD_COUNT]();

    expect(result).toBe(1);
  });

  test("clear-history clears history and preview cache", async () => {
    const { CHANNELS, ensurePreviewCacheDir, mainWindow } = register();
    fs.mkdirSync(previewDirPath, { recursive: true });
    fs.writeFileSync(path.join(previewDirPath, "preview.jpg"), "preview");
    fs.writeFileSync(historyFilePath, JSON.stringify([{ id: "one" }]), "utf8");

    const result = await handlers[CHANNELS.CLEAR_HISTORY]();

    expect(result).toBe(true);
    expect(JSON.parse(fs.readFileSync(historyFilePath, "utf8"))).toEqual([]);
    expect(fs.existsSync(previewDirPath)).toBe(true);
    expect(fs.existsSync(path.join(previewDirPath, "preview.jpg"))).toBe(false);
    expect(ensurePreviewCacheDir).toHaveBeenCalledTimes(1);
    expect(mainWindow.webContents.send).toHaveBeenCalledWith(
      "history-updated",
      { count: 0 },
    );
  });
});
