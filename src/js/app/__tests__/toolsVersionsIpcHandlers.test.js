const handlers = {};

jest.mock("../toolsVersions", () => ({
  getToolsAvailability: jest.fn(),
  getToolsVersions: jest.fn(),
}));

jest.mock("electron-log", () => ({
  error: jest.fn(),
  info: jest.fn(),
}));

describe("toolsVersionsIpcHandlers", () => {
  const originalPlatform = process.platform;

  beforeEach(() => {
    Object.keys(handlers).forEach((key) => delete handlers[key]);
    jest.clearAllMocks();
    Object.defineProperty(process, "platform", {
      value: originalPlatform,
      configurable: true,
    });
  });

  afterAll(() => {
    Object.defineProperty(process, "platform", {
      value: originalPlatform,
      configurable: true,
    });
  });

  function register() {
    const { CHANNELS } = require("../../ipc/channels");
    const { registerToolsVersionsIpcHandlers } = require(
      "../toolsVersionsIpcHandlers",
    );
    const ipcMain = {
      handle: jest.fn((channel, callback) => {
        handlers[channel] = callback;
      }),
    };
    const store = {
      get: jest.fn(),
    };

    registerToolsVersionsIpcHandlers({ ipcMain, store });

    return { CHANNELS, ipcMain, store };
  }

  test("registers tools version channels", () => {
    const { CHANNELS, ipcMain } = register();

    expect(ipcMain.handle).toHaveBeenCalledWith(
      CHANNELS.TOOLS_GETVERSIONS,
      expect.any(Function),
    );
    expect(ipcMain.handle).toHaveBeenCalledWith(
      CHANNELS.TOOLS_GET_AVAILABILITY,
      expect.any(Function),
    );
  });

  test("returns versions from getToolsVersions", async () => {
    const { getToolsVersions } = require("../toolsVersions");
    const { CHANNELS, store } = register();
    getToolsVersions.mockResolvedValue({
      ytDlp: { ok: true, path: "/tmp/yt-dlp", version: "2026.01.01" },
      ffmpeg: { ok: true, path: "/tmp/ffmpeg", version: "ffmpeg 7.1" },
    });

    const result = await handlers[CHANNELS.TOOLS_GETVERSIONS]();

    expect(result.ytDlp.version).toBe("2026.01.01");
    expect(getToolsVersions).toHaveBeenCalledWith(store);
  });

  test("returns availability without version checks", async () => {
    const { getToolsAvailability, getToolsVersions } =
      require("../toolsVersions");
    const { CHANNELS, store } = register();
    getToolsAvailability.mockReturnValue({
      ytDlp: { ok: true, path: "/tmp/yt-dlp" },
      ffmpeg: { ok: true, path: "/tmp/ffmpeg" },
      deno: { ok: false, error: "missing" },
    });

    const result = await handlers[CHANNELS.TOOLS_GET_AVAILABILITY]();

    expect(result).toMatchObject({
      ytDlp: { ok: true, path: "/tmp/yt-dlp" },
      ffmpeg: { ok: true, path: "/tmp/ffmpeg" },
      deno: { ok: false, error: "missing" },
    });
    expect(getToolsAvailability).toHaveBeenCalledWith(store);
    expect(getToolsVersions).not.toHaveBeenCalled();
  });

  test("marks ffmpeg updates skipped on macOS", async () => {
    Object.defineProperty(process, "platform", {
      value: "darwin",
      configurable: true,
    });
    const { getToolsAvailability, getToolsVersions } =
      require("../toolsVersions");
    const { CHANNELS } = register();
    getToolsVersions.mockResolvedValue({
      ytDlp: { ok: true },
      ffmpeg: { ok: true },
    });
    getToolsAvailability.mockReturnValue({
      ytDlp: { ok: true },
      ffmpeg: { ok: true },
      deno: { ok: true },
    });

    const versions = await handlers[CHANNELS.TOOLS_GETVERSIONS]();
    const availability = await handlers[CHANNELS.TOOLS_GET_AVAILABILITY]();

    expect(versions.ffmpeg.skipUpdates).toBe(true);
    expect(availability.ffmpeg.skipUpdates).toBe(true);
  });

  test("does not mark ffmpeg updates skipped outside macOS", async () => {
    Object.defineProperty(process, "platform", {
      value: "linux",
      configurable: true,
    });
    const { getToolsAvailability } = require("../toolsVersions");
    const { CHANNELS } = register();
    getToolsAvailability.mockReturnValue({
      ytDlp: { ok: true },
      ffmpeg: { ok: true },
      deno: { ok: true },
    });

    const availability = await handlers[CHANNELS.TOOLS_GET_AVAILABILITY]();

    expect(availability.ffmpeg.skipUpdates).toBeUndefined();
  });

  test("handles macOS payloads without ffmpeg", async () => {
    Object.defineProperty(process, "platform", {
      value: "darwin",
      configurable: true,
    });
    const { getToolsAvailability } = require("../toolsVersions");
    const { CHANNELS } = register();
    getToolsAvailability.mockReturnValue({
      ytDlp: { ok: true },
      deno: { ok: true },
    });

    const availability = await handlers[CHANNELS.TOOLS_GET_AVAILABILITY]();

    expect(availability).toEqual({
      ytDlp: { ok: true },
      deno: { ok: true },
    });
  });

  test("returns versions fallback on error", async () => {
    const { getToolsVersions } = require("../toolsVersions");
    const { CHANNELS } = register();
    getToolsVersions.mockRejectedValue(new Error("boom"));

    const result = await handlers[CHANNELS.TOOLS_GETVERSIONS]();

    expect(result).toEqual({
      ytDlp: { ok: false, error: "boom" },
      ffmpeg: { ok: false, error: "boom" },
    });
  });

  test("returns availability fallback on error", async () => {
    const { getToolsAvailability } = require("../toolsVersions");
    const { CHANNELS } = register();
    getToolsAvailability.mockImplementation(() => {
      throw new Error("boom");
    });

    const result = await handlers[CHANNELS.TOOLS_GET_AVAILABILITY]();

    expect(result).toEqual({
      ytDlp: { ok: false, error: "boom" },
      ffmpeg: { ok: false, error: "boom" },
      deno: { ok: false, error: "boom" },
    });
  });
});
