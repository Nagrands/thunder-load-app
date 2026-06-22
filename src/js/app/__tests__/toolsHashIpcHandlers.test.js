const fs = require("fs");
const os = require("os");
const path = require("path");

const handlers = {};

jest.mock("electron-log", () => ({
  error: jest.fn(),
}));

describe("toolsHashIpcHandlers", () => {
  let root;

  beforeEach(() => {
    Object.keys(handlers).forEach((key) => delete handlers[key]);
    jest.clearAllMocks();
    root = fs.mkdtempSync(path.join(os.tmpdir(), "tools-hash-ipc-"));
  });

  afterEach(() => {
    fs.rmSync(root, { recursive: true, force: true });
  });

  function register({ dialogResult } = {}) {
    const { CHANNELS } = require("../../ipc/channels");
    const { registerToolsHashIpcHandlers } = require("../toolsHashIpcHandlers");
    const dialog = {
      showOpenDialog: jest.fn().mockResolvedValue(
        dialogResult || {
          canceled: true,
          filePaths: [],
        },
      ),
    };
    const ipcMain = {
      handle: jest.fn((channel, callback) => {
        handlers[channel] = callback;
      }),
    };
    const mainWindow = {};

    registerToolsHashIpcHandlers({ ipcMain, dialog, mainWindow });

    return { CHANNELS, dialog, ipcMain, mainWindow };
  }

  test("registers hash channels", () => {
    const { CHANNELS, ipcMain } = register();

    [
      CHANNELS.TOOLS_HASH_PICK_FILE,
      CHANNELS.TOOLS_HASH_INSPECT_FILE,
      CHANNELS.TOOLS_HASH_CALCULATE,
    ].forEach((channel) => {
      expect(ipcMain.handle).toHaveBeenCalledWith(channel, expect.any(Function));
    });
  });

  test("hashPickFile returns selected path", async () => {
    const { CHANNELS, dialog, mainWindow } = register({
      dialogResult: {
        canceled: false,
        filePaths: ["/tmp/sample.bin"],
      },
    });

    const result = await handlers[CHANNELS.TOOLS_HASH_PICK_FILE]();

    expect(result).toEqual({ success: true, filePath: "/tmp/sample.bin" });
    expect(dialog.showOpenDialog).toHaveBeenCalledWith(mainWindow, {
      properties: ["openFile"],
    });
  });

  test("hashInspectFile returns readable file metadata", async () => {
    const { CHANNELS } = register();
    const filePath = path.join(root, "sample.bin");
    fs.writeFileSync(filePath, "demo", "utf8");

    const result = await handlers[CHANNELS.TOOLS_HASH_INSPECT_FILE](null, {
      filePath,
    });

    expect(result).toMatchObject({
      success: true,
      filePath,
      fileName: "sample.bin",
      size: 4,
      readable: true,
    });
  });

  test("hashCalculate returns SHA-256 hash and match", async () => {
    const { CHANNELS } = register();
    const filePath = path.join(root, "hash.txt");
    fs.writeFileSync(filePath, "abc", "utf8");

    const result = await handlers[CHANNELS.TOOLS_HASH_CALCULATE](null, {
      filePath,
      algorithm: "SHA-256",
      expectedHash:
        "ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad",
    });

    expect(result).toMatchObject({
      success: true,
      algorithm: "SHA-256",
      actualHash:
        "ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad",
      expectedHash:
        "ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad",
      matches: true,
      filePath,
    });
  });

  test("hashCalculate emits start and done progress events", async () => {
    const { CHANNELS } = register();
    const filePath = path.join(root, "progress.txt");
    fs.writeFileSync(filePath, "progress-demo", "utf8");
    const sender = { send: jest.fn() };

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
        stage: "start",
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

  test("hashCalculate rejects unsupported algorithm", async () => {
    const { CHANNELS } = register();
    const filePath = path.join(root, "hash.txt");
    fs.writeFileSync(filePath, "abc", "utf8");

    const result = await handlers[CHANNELS.TOOLS_HASH_CALCULATE](null, {
      filePath,
      algorithm: "SHA-384",
    });

    expect(result).toEqual({
      success: false,
      error: "Unsupported algorithm",
    });
  });
});
