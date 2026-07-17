const fs = require("fs");
const os = require("os");
const path = require("path");

const handlers = {};

jest.mock("../toolsPaths", () => ({
  getDefaultToolsDir: jest.fn(() => "/tmp/tools-default"),
  getEffectiveToolsDir: jest.fn(() => "/tmp/tools-default"),
  ensureToolsDir: jest.fn(async (value) => value || "/tmp/tools-default"),
  detectLegacyLocations: jest.fn(async () => [{ path: "/legacy/tools" }]),
  migrateLegacy: jest.fn(async () => ({ copied: ["yt-dlp"], skipped: [] })),
}));

jest.mock("electron-log", () => ({
  error: jest.fn(),
  warn: jest.fn(),
}));

describe("toolsLocationIpcHandlers", () => {
  beforeEach(() => {
    Object.keys(handlers).forEach((key) => delete handlers[key]);
    jest.clearAllMocks();
    const toolsPaths = require("../toolsPaths");
    toolsPaths.getDefaultToolsDir.mockImplementation(
      () => "/tmp/tools-default",
    );
    toolsPaths.getEffectiveToolsDir.mockImplementation(
      () => "/tmp/tools-default",
    );
    toolsPaths.ensureToolsDir.mockImplementation(
      async (value) => value || "/tmp/tools-default",
    );
    toolsPaths.detectLegacyLocations.mockImplementation(async () => [
      { path: "/legacy/tools" },
    ]);
    toolsPaths.migrateLegacy.mockImplementation(async () => ({
      copied: ["yt-dlp"],
      skipped: [],
    }));
  });

  function register() {
    const { CHANNELS } = require("../../ipc/channels");
    const {
      registerToolsLocationIpcHandlers,
    } = require("../toolsLocationIpcHandlers");
    const ipcMain = {
      handle: jest.fn((channel, callback) => {
        handlers[channel] = callback;
      }),
    };
    const dialog = {
      showOpenDialog: jest.fn(async () => ({
        canceled: false,
        filePaths: ["/tmp/tools"],
      })),
    };
    const shell = {
      openPath: jest.fn(async () => ""),
    };
    const mainWindow = {};
    const store = {
      set: jest.fn(),
      delete: jest.fn(),
    };

    registerToolsLocationIpcHandlers({
      ipcMain,
      dialog,
      shell,
      mainWindow,
      store,
    });

    return { CHANNELS, dialog, ipcMain, shell, store };
  }

  test("registers tools location channels", () => {
    const { CHANNELS, ipcMain } = register();

    expect(ipcMain.handle).toHaveBeenCalledWith(
      CHANNELS.TOOLS_GET_LOCATION,
      expect.any(Function),
    );
    expect(ipcMain.handle).toHaveBeenCalledWith(
      CHANNELS.TOOLS_SET_LOCATION,
      expect.any(Function),
    );
    expect(ipcMain.handle).toHaveBeenCalledWith(
      CHANNELS.DIALOG_CHOOSE_TOOLS_DIR,
      expect.any(Function),
    );
  });

  test("returns current tools location", async () => {
    const { CHANNELS } = register();
    const toolsPaths = require("../toolsPaths");
    toolsPaths.getDefaultToolsDir.mockReturnValue("/tmp/default");
    toolsPaths.getEffectiveToolsDir.mockReturnValue("/tmp/custom");

    const result = await handlers[CHANNELS.TOOLS_GET_LOCATION]();

    expect(result).toEqual({
      success: true,
      path: "/tmp/custom",
      isDefault: false,
      defaultPath: "/tmp/default",
    });
  });

  test("migrates existing binaries when tools location changes", async () => {
    const { CHANNELS, store } = register();
    const toolsPaths = require("../toolsPaths");
    const oldDir = fs.mkdtempSync(path.join(os.tmpdir(), "tools-old-"));
    const newDir = fs.mkdtempSync(path.join(os.tmpdir(), "tools-new-"));
    const ytName = process.platform === "win32" ? "yt-dlp.exe" : "yt-dlp";
    const ffName = process.platform === "win32" ? "ffmpeg.exe" : "ffmpeg";
    const fpName = process.platform === "win32" ? "ffprobe.exe" : "ffprobe";

    fs.writeFileSync(path.join(oldDir, ytName), "yt");
    fs.writeFileSync(path.join(oldDir, ffName), "ff");
    fs.writeFileSync(path.join(oldDir, fpName), "fp");

    toolsPaths.getEffectiveToolsDir.mockReturnValue(oldDir);
    toolsPaths.ensureToolsDir.mockResolvedValue(newDir);

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

  test("opens native tools directory picker", async () => {
    const { CHANNELS, dialog } = register();

    const result = await handlers[CHANNELS.DIALOG_CHOOSE_TOOLS_DIR]();

    expect(result).toEqual({
      canceled: false,
      filePaths: ["/tmp/tools"],
    });
    expect(dialog.showOpenDialog).toHaveBeenCalledWith(expect.any(Object), {
      properties: ["openDirectory", "createDirectory"],
    });
  });
});
