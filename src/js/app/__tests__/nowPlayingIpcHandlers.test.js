const fs = require("fs");
const os = require("os");
const path = require("path");

const handlers = {};

jest.mock("electron-log", () => ({
  error: jest.fn(),
  warn: jest.fn(),
}));

describe("nowPlayingIpcHandlers", () => {
  let root;
  let dialog;
  let store;
  let storeValues;

  beforeEach(() => {
    Object.keys(handlers).forEach((key) => delete handlers[key]);
    jest.clearAllMocks();
    root = fs.mkdtempSync(path.join(os.tmpdir(), "now-playing-ipc-"));
    storeValues = {};
    store = {
      get: jest.fn((key, fallback) =>
        Object.prototype.hasOwnProperty.call(storeValues, key)
          ? storeValues[key]
          : fallback,
      ),
      set: jest.fn((key, value) => {
        storeValues[key] = value;
      }),
    };
    dialog = { showOpenDialog: jest.fn() };
  });

  afterEach(() => {
    fs.rmSync(root, { recursive: true, force: true });
  });

  function register() {
    const { CHANNELS } = require("../../ipc/channels");
    const {
      registerNowPlayingIpcHandlers,
    } = require("../nowPlayingIpcHandlers");
    const ipcMain = {
      handle: jest.fn((channel, callback) => {
        handlers[channel] = callback;
      }),
    };
    registerNowPlayingIpcHandlers({
      app: { getPath: jest.fn(() => root) },
      dialog,
      ffmpegPathResolver: jest.fn(() => ""),
      ffprobePathResolver: jest.fn(() => ""),
      ipcMain,
      mainWindow: {},
      store,
    });
    return { CHANNELS, ipcMain };
  }

  test("registers the four Now Playing channels", () => {
    const { CHANNELS, ipcMain } = register();

    [
      CHANNELS.NOW_PLAYING_IMPORT_FILES,
      CHANNELS.NOW_PLAYING_IMPORT_FOLDER,
      CHANNELS.NOW_PLAYING_GET_STATE,
      CHANNELS.NOW_PLAYING_SET_STATE,
    ].forEach((channel) => {
      expect(ipcMain.handle).toHaveBeenCalledWith(
        channel,
        expect.any(Function),
      );
    });
  });

  test("imports files, removes duplicates, and persists the queue", async () => {
    const { CHANNELS } = register();
    const mediaPath = path.join(root, "Музыка 01.mp3");
    fs.writeFileSync(mediaPath, "audio");
    dialog.showOpenDialog.mockResolvedValue({
      canceled: false,
      filePaths: [mediaPath, mediaPath],
    });

    const first = await handlers[CHANNELS.NOW_PLAYING_IMPORT_FILES]();
    const second = await handlers[CHANNELS.NOW_PLAYING_IMPORT_FILES]();

    expect(first).toMatchObject({
      success: true,
      error: null,
      data: { canceled: false },
    });
    expect(first.data.added).toHaveLength(1);
    expect(first.data.state.playlist.tracks).toHaveLength(1);
    expect(second.data.added).toHaveLength(0);
    expect(store.set).toHaveBeenCalledWith(
      "nowPlaying.state",
      expect.objectContaining({ version: 1 }),
    );
  });

  test("imports a folder recursively and returns cancellation safely", async () => {
    const { CHANNELS } = register();
    const album = path.join(root, "album");
    fs.mkdirSync(path.join(album, "disc"), { recursive: true });
    fs.writeFileSync(path.join(album, "disc", "track.ogg"), "audio");
    dialog.showOpenDialog.mockResolvedValueOnce({
      canceled: false,
      filePaths: [album],
    });

    const imported = await handlers[CHANNELS.NOW_PLAYING_IMPORT_FOLDER]();
    dialog.showOpenDialog.mockResolvedValueOnce({
      canceled: true,
      filePaths: [],
    });
    const canceled = await handlers[CHANNELS.NOW_PLAYING_IMPORT_FOLDER]();

    expect(imported.data.added).toHaveLength(1);
    expect(canceled).toEqual({
      success: true,
      data: { canceled: true, added: [], tracks: [], state: null },
      error: null,
    });
  });

  test("sanitizes persisted state and marks unavailable tracks as missing", async () => {
    const { CHANNELS } = register();
    const missingPath = path.join(root, "gone.mp4");
    const result = await handlers[CHANNELS.NOW_PLAYING_SET_STATE](null, {
      version: 99,
      playlist: {
        tracks: [
          {
            id: "gone",
            sourceRef: missingPath,
            title: "Gone",
            kind: "video",
          },
          { id: "unsafe", sourceRef: "relative.mp3" },
        ],
      },
      volume: 3,
      repeat: "invalid",
      backgroundPlayback: false,
      sidebarPinned: true,
    });

    expect(result.success).toBe(true);
    expect(result.data).toMatchObject({
      version: 1,
      selectedTrackId: "gone",
      volume: 1,
      repeat: "off",
      backgroundPlayback: false,
      sidebarPinned: true,
    });
    expect(result.data.playlist.tracks).toEqual([
      expect.objectContaining({
        id: "gone",
        availability: "missing",
        playbackUrl: null,
      }),
    ]);
  });

  test("defaults legacy and invalid Now Playing preferences safely", async () => {
    const { CHANNELS } = register();
    storeValues["nowPlaying.state"] = {
      playlist: { tracks: [] },
    };

    const legacyResult = await handlers[CHANNELS.NOW_PLAYING_GET_STATE]();
    const invalidResult = await handlers[CHANNELS.NOW_PLAYING_SET_STATE](null, {
      playlist: { tracks: [] },
      backgroundPlayback: "false",
      sidebarPinned: 1,
    });

    expect(legacyResult.data).toMatchObject({
      backgroundPlayback: true,
      sidebarPinned: false,
    });
    expect(invalidResult.data).toMatchObject({
      backgroundPlayback: true,
      sidebarPinned: false,
    });
    expect(store.set).toHaveBeenCalledWith(
      "nowPlaying.state",
      expect.objectContaining({
        backgroundPlayback: true,
        sidebarPinned: false,
      }),
    );
  });

  test("rejects an oversized state with a structured error", async () => {
    const { CHANNELS } = register();
    const result = await handlers[CHANNELS.NOW_PLAYING_SET_STATE](null, {
      padding: "x".repeat(2 * 1024 * 1024 + 1),
    });

    expect(result).toEqual({
      success: false,
      data: null,
      error: {
        code: "PAYLOAD_TOO_LARGE",
        message: "Now Playing state is too large",
      },
    });
  });
});
