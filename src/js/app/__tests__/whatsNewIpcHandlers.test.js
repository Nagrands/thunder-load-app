const fs = require("fs");
const os = require("os");
const path = require("path");

const handlers = {};

jest.mock("marked", () => ({
  marked: {
    parse: jest.fn((markdown) => `<p>${markdown}</p>`),
  },
}));

jest.mock("electron-log", () => ({
  error: jest.fn(),
  info: jest.fn(),
}));

describe("whatsNewIpcHandlers", () => {
  let appPath;

  beforeEach(() => {
    Object.keys(handlers).forEach((key) => delete handlers[key]);
    jest.clearAllMocks();
    appPath = fs.mkdtempSync(path.join(os.tmpdir(), "whats-new-ipc-"));
  });

  afterEach(() => {
    fs.rmSync(appPath, { recursive: true, force: true });
  });

  function register(overrides = {}) {
    const { CHANNELS } = require("../../ipc/channels");
    const { registerWhatsNewIpcHandlers } = require("../whatsNewIpcHandlers");
    const ipcMain = {
      handle: jest.fn((channel, callback) => {
        handlers[channel] = callback;
      }),
    };
    const app = {
      getAppPath: jest.fn(() => appPath),
    };
    const getAppVersion =
      overrides.getAppVersion || jest.fn(async () => "1.6.0");
    const dispatchPendingWhatsNew =
      overrides.dispatchPendingWhatsNew || jest.fn();
    const clearPendingWhatsNewVersion =
      overrides.clearPendingWhatsNewVersion || jest.fn(() => true);

    registerWhatsNewIpcHandlers({
      ipcMain,
      app,
      getAppVersion,
      dispatchPendingWhatsNew,
      clearPendingWhatsNewVersion,
    });

    return {
      CHANNELS,
      app,
      clearPendingWhatsNewVersion,
      dispatchPendingWhatsNew,
      getAppVersion,
      ipcMain,
    };
  }

  test("registers whats-new channels without rendering markdown", () => {
    const { marked } = require("marked");
    const { CHANNELS, ipcMain } = register();

    expect(ipcMain.handle).toHaveBeenCalledWith(
      CHANNELS.GET_WHATS_NEW,
      expect.any(Function),
    );
    expect(ipcMain.handle).toHaveBeenCalledWith(
      CHANNELS.WHATS_NEW_READY,
      expect.any(Function),
    );
    expect(ipcMain.handle).toHaveBeenCalledWith(
      CHANNELS.WHATS_NEW_ACK,
      expect.any(Function),
    );
    expect(marked.parse).not.toHaveBeenCalled();
  });

  test("returns localized release notes from markdown", async () => {
    const { marked } = require("marked");
    fs.writeFileSync(
      path.join(appPath, "whats-new.en.md"),
      "<!-- version: 2.0.0 -->\n# Release",
      "utf8",
    );
    const { CHANNELS, getAppVersion } = register();

    const result = await handlers[CHANNELS.GET_WHATS_NEW](null, "en");

    expect(result).toEqual({
      version: "2.0.0",
      changes: ["<p><!-- version: 2.0.0 -->\n# Release</p>"],
      source: "markdown",
    });
    expect(getAppVersion).not.toHaveBeenCalled();
    expect(marked.parse).toHaveBeenCalledWith(
      "<!-- version: 2.0.0 -->\n# Release",
      { mangle: false, headerIds: false },
    );
  });

  test("falls back to default release notes and app version", async () => {
    fs.writeFileSync(path.join(appPath, "whats-new.md"), "# Release", "utf8");
    const { CHANNELS, getAppVersion } = register({
      getAppVersion: jest.fn(async () => "1.6.1"),
    });

    const result = await handlers[CHANNELS.GET_WHATS_NEW](null, "en");

    expect(result).toEqual({
      version: "1.6.1",
      changes: ["<p># Release</p>"],
      source: "markdown",
    });
    expect(getAppVersion).toHaveBeenCalledTimes(1);
  });

  test("returns empty release notes on read errors", async () => {
    const { CHANNELS } = register();

    const result = await handlers[CHANNELS.GET_WHATS_NEW](null, "ru");

    expect(result).toEqual({ version: "unknown", changes: [] });
  });

  test("dispatches pending whats-new and acknowledges versions", async () => {
    const { CHANNELS, clearPendingWhatsNewVersion, dispatchPendingWhatsNew } =
      register();

    const ready = await handlers[CHANNELS.WHATS_NEW_READY]();
    const ack = await handlers[CHANNELS.WHATS_NEW_ACK](null, "1.6.0");

    expect(ready).toEqual({ success: true });
    expect(dispatchPendingWhatsNew).toHaveBeenCalledTimes(1);
    expect(ack).toEqual({ success: true, cleared: true });
    expect(clearPendingWhatsNewVersion).toHaveBeenCalledWith("1.6.0");
  });
});
