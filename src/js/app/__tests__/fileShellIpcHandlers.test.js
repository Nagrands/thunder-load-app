const fs = require("fs");
const os = require("os");
const path = require("path");

const handlers = {};

jest.mock("electron-log", () => ({
  error: jest.fn(),
  info: jest.fn(),
  warn: jest.fn(),
}));

describe("fileShellIpcHandlers", () => {
  let root;

  beforeEach(() => {
    Object.keys(handlers).forEach((key) => delete handlers[key]);
    jest.clearAllMocks();
    root = fs.mkdtempSync(path.join(os.tmpdir(), "file-shell-ipc-"));
  });

  afterEach(() => {
    fs.rmSync(root, { recursive: true, force: true });
  });

  function register(overrides = {}) {
    const { CHANNELS } = require("../../ipc/channels");
    const { registerFileShellIpcHandlers } = require("../fileShellIpcHandlers");
    const ipcMain = {
      handle: jest.fn((channel, callback) => {
        handlers[channel] = callback;
      }),
    };
    const app = {
      getPath: jest.fn(() => path.join(root, "userData")),
    };
    const shell = {
      openExternal: jest.fn(async () => undefined),
      openPath: jest.fn(async () => ""),
      showItemInFolder: jest.fn(),
      trashItem: jest.fn(async () => undefined),
      ...overrides.shell,
    };
    const downloadState = {
      downloadPath: root,
      ...overrides.downloadState,
    };

    registerFileShellIpcHandlers({
      ipcMain,
      app,
      shell,
      downloadState,
      isPathInsideBaseDir:
        overrides.isPathInsideBaseDir ||
        ((filePath, baseDir) => path.resolve(filePath).startsWith(baseDir)),
      isValidFilePath:
        overrides.isValidFilePath ||
        ((filePath) =>
          typeof filePath === "string" && path.isAbsolute(filePath)),
      isValidUrl:
        overrides.isValidUrl ||
        ((url) => typeof url === "string" && url.startsWith("https://")),
      normalizeUrl:
        overrides.normalizeUrl || ((url) => String(url || "").trim()),
    });

    return { CHANNELS, app, ipcMain, shell, downloadState };
  }

  test("registers file and shell channels", () => {
    const { CHANNELS, ipcMain } = register();

    [
      "open-external",
      CHANNELS.OPEN_CONFIG_FOLDER,
      CHANNELS.CHECK_FILE_EXISTS,
      CHANNELS.DELETE_FILE,
      CHANNELS.GET_FILE_SIZE,
      CHANNELS.OPEN_DOWNLOAD_FOLDER,
      CHANNELS.OPEN_EXTERNAL_LINK,
      CHANNELS.OPEN_LAST_VIDEO,
    ].forEach((channel) => {
      expect(ipcMain.handle).toHaveBeenCalledWith(
        channel,
        expect.any(Function),
      );
    });
  });

  test("opens config folder and creates wireguard config", () => {
    const { CHANNELS, app, shell } = register();

    const result = handlers[CHANNELS.OPEN_CONFIG_FOLDER]();

    expect(result).toEqual({ success: true });
    expect(fs.existsSync(path.join(app.getPath(), "wireguard.conf"))).toBe(
      true,
    );
    expect(shell.openPath).toHaveBeenCalledWith(app.getPath());
  });

  test("checks file existence and size", async () => {
    const { CHANNELS } = register();
    const filePath = path.join(root, "file.txt");
    fs.writeFileSync(filePath, "hello", "utf8");

    await expect(
      handlers[CHANNELS.CHECK_FILE_EXISTS](null, filePath),
    ).resolves.toBe(true);
    await expect(
      handlers[CHANNELS.GET_FILE_SIZE](null, filePath),
    ).resolves.toBe(5);
    await expect(
      handlers[CHANNELS.CHECK_FILE_EXISTS](null, path.join(root, "missing")),
    ).resolves.toBe(false);
  });

  test("deletes files through trashItem", async () => {
    const { CHANNELS, shell } = register();
    const filePath = path.join(root, "delete.txt");
    fs.writeFileSync(filePath, "delete", "utf8");

    const result = await handlers[CHANNELS.DELETE_FILE](null, filePath);

    expect(result).toBe(true);
    expect(shell.trashItem).toHaveBeenCalledWith(filePath);
  });

  test("falls back to unlink when trashItem fails", async () => {
    const { CHANNELS, shell } = register({
      shell: {
        trashItem: jest.fn(async () => {
          throw new Error("trash failed");
        }),
      },
    });
    const filePath = path.join(root, "delete-fallback.txt");
    fs.writeFileSync(filePath, "delete", "utf8");

    const result = await handlers[CHANNELS.DELETE_FILE](null, filePath);

    expect(result).toBe(true);
    expect(shell.trashItem).toHaveBeenCalledWith(filePath);
    expect(fs.existsSync(filePath)).toBe(false);
  });

  test("opens external links through both external channels", async () => {
    const { CHANNELS, shell } = register();

    handlers["open-external"](null, "https://example.com");
    const result = await handlers[CHANNELS.OPEN_EXTERNAL_LINK](
      null,
      " https://example.com/page ",
    );

    expect(result).toEqual({ success: true });
    expect(shell.openExternal).toHaveBeenCalledWith("https://example.com");
    expect(shell.openExternal).toHaveBeenCalledWith("https://example.com/page");
  });

  test("opens downloaded file locations and last video", async () => {
    const { CHANNELS, shell } = register();
    const filePath = path.join(root, "video.mp4");
    fs.writeFileSync(filePath, "video", "utf8");

    await expect(
      handlers[CHANNELS.OPEN_DOWNLOAD_FOLDER](null, filePath),
    ).resolves.toBeUndefined();
    await expect(
      handlers[CHANNELS.OPEN_LAST_VIDEO](null, filePath),
    ).resolves.toEqual({ success: true });

    expect(shell.showItemInFolder).toHaveBeenCalledWith(filePath);
    expect(shell.openPath).toHaveBeenCalledWith(filePath);
  });
});
