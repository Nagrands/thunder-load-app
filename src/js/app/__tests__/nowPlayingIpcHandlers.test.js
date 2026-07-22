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
  let getVideoInfo;
  let getVideoPreview;
  let hlsService;

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
    getVideoInfo = jest.fn();
    getVideoPreview = jest.fn();
    hlsService = {
      createSession: jest.fn().mockResolvedValue({
        kind: "hls",
        sessionId: "12345678-1234-1234-1234-123456789abc",
        src: "http://127.0.0.1:1234/token/session/index.m3u8",
        mimeType: "application/vnd.apple.mpegurl",
      }),
      closeSession: jest.fn().mockResolvedValue(true),
      dispose: jest.fn().mockResolvedValue(undefined),
    };
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
      getVideoInfo,
      getVideoPreview,
      hlsService,
      ipcMain,
      mainWindow: {},
      store,
    });
    return { CHANNELS, ipcMain };
  }

  test("registers all Player channels", () => {
    const { CHANNELS, ipcMain } = register();

    [
      CHANNELS.NOW_PLAYING_IMPORT_FILES,
      CHANNELS.NOW_PLAYING_IMPORT_FOLDER,
      CHANNELS.NOW_PLAYING_IMPORT_YOUTUBE_VIDEO,
      CHANNELS.NOW_PLAYING_ANALYZE_YOUTUBE_VIDEO,
      CHANNELS.NOW_PLAYING_RESOLVE_YOUTUBE_TRACK,
      CHANNELS.NOW_PLAYING_CLOSE_PLAYBACK_SESSION,
      CHANNELS.NOW_PLAYING_CREATE_LOCAL_PLAYBACK_SESSION,
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
    expect(first.data.state.catalog.tracks).toHaveLength(1);
    expect(first.data.state.playlists).toEqual([]);
    expect(second.data.added).toHaveLength(0);
    expect(store.set).toHaveBeenCalledWith(
      "nowPlaying.state",
      expect.objectContaining({ version: 3 }),
    );
  });

  test("adds imported media to the active custom playlist", async () => {
    const { CHANNELS } = register();
    const mediaPath = path.join(root, "custom.mp3");
    fs.writeFileSync(mediaPath, "audio");
    storeValues["nowPlaying.state"] = {
      version: 2,
      catalog: { tracks: [] },
      playlists: [
        {
          id: "favorites",
          title: "Favorites",
          trackIds: [],
        },
      ],
      activePlaylistId: "favorites",
    };
    dialog.showOpenDialog.mockResolvedValue({
      canceled: false,
      filePaths: [mediaPath],
    });

    const result = await handlers[CHANNELS.NOW_PLAYING_IMPORT_FILES]();

    expect(result.data.state.playlists).toEqual([
      expect.objectContaining({
        id: "favorites",
        trackIds: [result.data.added[0].id],
      }),
    ]);
  });

  test("links an existing catalog item into the active custom playlist", async () => {
    const { CHANNELS } = register();
    const mediaPath = path.join(root, "existing.mp3");
    fs.writeFileSync(mediaPath, "audio");
    storeValues["nowPlaying.state"] = {
      version: 2,
      catalog: {
        tracks: [
          {
            id: "existing",
            providerId: "local",
            sourceRef: mediaPath,
            title: "Existing",
          },
        ],
      },
      playlists: [{ id: "favorites", title: "Favorites", trackIds: [] }],
      activePlaylistId: "favorites",
    };
    dialog.showOpenDialog.mockResolvedValue({
      canceled: false,
      filePaths: [mediaPath],
    });

    const result = await handlers[CHANNELS.NOW_PLAYING_IMPORT_FILES]();

    expect(result.data.added).toEqual([]);
    expect(result.data.importedTrackIds).toEqual(["existing"]);
    expect(result.data.state.playlists[0].trackIds).toEqual(["existing"]);
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

  test("sanitizes persisted state without rescanning every local file", async () => {
    const { CHANNELS } = register();
    const missingPath = path.join(root, "gone.mp4");
    const result = await handlers[CHANNELS.NOW_PLAYING_SET_STATE](null, {
      version: 99,
      catalog: {
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
      version: 3,
      activePlaylistId: "media-library",
      selectedTrackId: "gone",
      volume: 1,
      repeat: "off",
      backgroundPlayback: false,
      sidebarPinned: true,
    });
    expect(result.data.catalog.tracks).toEqual([
      expect.objectContaining({
        id: "gone",
        availability: "available",
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
      catalog: { tracks: [] },
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

  test("recovers from a malformed V2 catalog without throwing", async () => {
    const { CHANNELS } = register();
    const result = await handlers[CHANNELS.NOW_PLAYING_SET_STATE](null, {
      version: 2,
      catalog: { tracks: { broken: true } },
      playlists: [{ id: "broken", trackIds: ["missing"] }],
      activePlaylistId: "broken",
    });

    expect(result).toMatchObject({
      success: true,
      data: {
        version: 3,
        catalog: { tracks: [] },
        activePlaylistId: "broken",
        selectedTrackId: null,
      },
    });
    expect(result.data.playlists[0].trackIds).toEqual([]);
  });

  test("migrates the V1 queue into the V2 media library", async () => {
    const { CHANNELS } = register();
    const mediaPath = path.join(root, "legacy song.mp3");
    fs.writeFileSync(mediaPath, "audio");
    storeValues["nowPlaying.state"] = {
      version: 1,
      playlist: {
        id: "local-library",
        tracks: [
          {
            id: "legacy",
            providerId: "local",
            sourceRef: mediaPath,
            title: "Legacy",
          },
        ],
      },
      selectedTrackId: "legacy",
      volume: 0.4,
      backgroundPlayback: false,
    };

    const result = await handlers[CHANNELS.NOW_PLAYING_GET_STATE]();

    expect(result.data).toMatchObject({
      version: 3,
      activePlaylistId: "media-library",
      selectedTrackId: "legacy",
      volume: 0.4,
      backgroundPlayback: false,
    });
    expect(result.data.catalog.tracks).toHaveLength(1);
    expect(result.data.playlists).toEqual([]);
    expect(store.set).toHaveBeenCalledWith(
      "nowPlaying.state",
      expect.objectContaining({ version: 3 }),
    );
  });

  test("sanitizes playlists and removes dangling and duplicate track references", async () => {
    const { CHANNELS } = register();
    const firstPath = path.join(root, "first.mp3");
    const secondPath = path.join(root, "second.mp3");
    const result = await handlers[CHANNELS.NOW_PLAYING_SET_STATE](null, {
      version: 2,
      catalog: {
        tracks: [
          { id: "first", sourceRef: firstPath },
          { id: "second", sourceRef: secondPath },
        ],
      },
      playlists: [
        {
          id: "favorites",
          title: "Favorites",
          trackIds: ["second", "missing", "second", "first"],
        },
      ],
      activePlaylistId: "favorites",
      selectedTrackId: "missing",
    });

    expect(result.data.playlists).toEqual([
      expect.objectContaining({
        id: "favorites",
        trackIds: ["second", "first"],
      }),
    ]);
    expect(result.data.activePlaylistId).toBe("favorites");
    expect(result.data.selectedTrackId).toBe("second");
  });

  test("imports one YouTube video, deduplicates it and persists no playback URL", async () => {
    const { CHANNELS } = register();
    getVideoPreview.mockResolvedValue({
      id: "dQw4w9WgXcQ",
      title: "Demo video",
      channel: "Demo channel",
      duration: 213,
      webpage_url: "https://www.youtube.com/watch?v=dQw4w9WgXcQ",
      thumbnail: "https://i.ytimg.com/vi/dQw4w9WgXcQ/hqdefault.jpg",
      previewFormats: [
        {
          url: "https://video.example/leased",
          ext: "mp4",
          protocol: "https",
          vcodec: "avc1.42001E",
          acodec: "mp4a.40.2",
        },
      ],
    });

    const first = await handlers[CHANNELS.NOW_PLAYING_IMPORT_YOUTUBE_VIDEO](
      null,
      "https://youtu.be/dQw4w9WgXcQ",
    );
    const second = await handlers[CHANNELS.NOW_PLAYING_IMPORT_YOUTUBE_VIDEO](
      null,
      "https://www.youtube.com/watch?v=dQw4w9WgXcQ",
    );

    expect(first.success).toBe(true);
    expect(first.data.added).toHaveLength(1);
    expect(first.data.track).toMatchObject({
      id: "youtube:dQw4w9WgXcQ",
      providerId: "youtube",
      artist: "Demo channel",
      kind: "video",
    });
    expect(first.data.track).not.toHaveProperty("playbackUrl");
    expect(second.data.added).toHaveLength(0);
    expect(storeValues["nowPlaying.state"].catalog.tracks).toHaveLength(1);
    expect(getVideoPreview).toHaveBeenCalledTimes(1);

    const playback = await handlers[CHANNELS.NOW_PLAYING_RESOLVE_YOUTUBE_TRACK](
      null,
      first.data.track.sourceRef,
    );
    expect(playback.data).toMatchObject({
      kind: "hls",
      src: "http://127.0.0.1:1234/token/session/index.m3u8",
    });
    expect(getVideoInfo).not.toHaveBeenCalled();
  });

  test("rejects YouTube playlists before invoking yt-dlp", async () => {
    const { CHANNELS } = register();
    const result = await handlers[CHANNELS.NOW_PLAYING_IMPORT_YOUTUBE_VIDEO](
      null,
      "https://www.youtube.com/playlist?list=PL1234567890",
    );

    expect(result).toMatchObject({
      success: false,
      error: { code: "YOUTUBE_PLAYLIST_UNSUPPORTED" },
    });
    expect(getVideoInfo).not.toHaveBeenCalled();
    expect(getVideoPreview).not.toHaveBeenCalled();
  });

  test("resolves a fresh muxed YouTube stream through a loopback HLS session", async () => {
    const { CHANNELS } = register();
    getVideoInfo.mockResolvedValue({
      thumbnail: "https://i.ytimg.com/vi/dQw4w9WgXcQ/hqdefault.jpg",
      formats: [
        {
          url: "https://video.example/videoplayback?itag=18",
          ext: "mp4",
          protocol: "https",
          vcodec: "avc1.42001E",
          acodec: "mp4a.40.2",
          width: 640,
          height: 360,
        },
      ],
    });

    const result = await handlers[CHANNELS.NOW_PLAYING_RESOLVE_YOUTUBE_TRACK](
      null,
      "https://www.youtube.com/watch?v=dQw4w9WgXcQ",
    );

    expect(getVideoInfo).toHaveBeenCalledWith(
      "https://www.youtube.com/watch?v=dQw4w9WgXcQ",
      null,
      { forceRefresh: false },
    );
    expect(hlsService.createSession).toHaveBeenCalledWith({
      inputs: ["https://video.example/videoplayback?itag=18"],
      copyCodecs: true,
    });
    expect(result).toMatchObject({
      success: true,
      data: {
        kind: "hls",
        mimeType: "application/vnd.apple.mpegurl",
        posterUrl: "https://i.ytimg.com/vi/dQw4w9WgXcQ/hqdefault.jpg",
      },
    });
  });

  test("deduplicates parallel YouTube resolves for the same quality", async () => {
    const { CHANNELS } = register();
    let resolveInfo;
    getVideoInfo.mockReturnValue(
      new Promise((resolve) => {
        resolveInfo = resolve;
      }),
    );
    const resolveTrack = () =>
      handlers[CHANNELS.NOW_PLAYING_RESOLVE_YOUTUBE_TRACK](
        null,
        "https://www.youtube.com/watch?v=dQw4w9WgXcQ",
        { qualitySelection: { mode: "best" } },
      );

    const first = resolveTrack();
    const second = resolveTrack();
    resolveInfo({
      formats: [
        {
          format_id: "18",
          url: "https://video.example/shared",
          ext: "mp4",
          vcodec: "avc1.42001E",
          acodec: "mp4a.40.2",
        },
      ],
    });

    await expect(Promise.all([first, second])).resolves.toHaveLength(2);
    expect(getVideoInfo).toHaveBeenCalledTimes(1);
    expect(hlsService.createSession).toHaveBeenCalledTimes(1);
  });

  test("analyzes YouTube formats and preserves an exact quality selector", async () => {
    const { CHANNELS } = register();
    getVideoInfo.mockResolvedValue({
      id: "dQw4w9WgXcQ",
      webpage_url: "https://www.youtube.com/watch?v=dQw4w9WgXcQ",
      title: "Quality demo",
      formats: [
        {
          format_id: "137",
          url: "https://video.example/1080",
          ext: "mp4",
          width: 1920,
          height: 1080,
          fps: 30,
          tbr: 4500,
          vcodec: "avc1.640028",
          acodec: "none",
        },
        {
          format_id: "140",
          url: "https://video.example/audio",
          ext: "m4a",
          abr: 128,
          vcodec: "none",
          acodec: "mp4a.40.2",
        },
      ],
    });

    const analysis = await handlers[
      CHANNELS.NOW_PLAYING_ANALYZE_YOUTUBE_VIDEO
    ](null, "https://youtu.be/dQw4w9WgXcQ");
    const quality = analysis.data.qualities.find(
      (item) => item.selector.videoFormatId === "137",
    );
    expect(analysis.data.qualities.slice(0, 3).map((item) => item.id)).toEqual([
      "auto",
      "best",
      "audio",
    ]);
    expect(quality).toMatchObject({
      height: 1080,
      fps: 30,
      videoCodec: "avc1.640028",
      audioCodec: "mp4a.40.2",
    });

    await handlers[CHANNELS.NOW_PLAYING_RESOLVE_YOUTUBE_TRACK](
      null,
      "https://youtu.be/dQw4w9WgXcQ",
      { qualitySelection: quality.selector },
    );
    expect(hlsService.createSession).toHaveBeenCalledWith({
      inputs: [
        "https://video.example/1080",
        "https://video.example/audio",
      ],
      copyCodecs: true,
    });
    expect(getVideoInfo).toHaveBeenCalledTimes(1);
  });

  test("forces a fresh YouTube stream only for an explicit retry", async () => {
    const { CHANNELS } = register();
    getVideoInfo.mockResolvedValue({
      formats: [
        {
          url: "https://video.example/retry",
          ext: "mp4",
          protocol: "https",
          vcodec: "avc1.42001E",
          acodec: "mp4a.40.2",
        },
      ],
    });

    await handlers[CHANNELS.NOW_PLAYING_RESOLVE_YOUTUBE_TRACK](
      null,
      "https://www.youtube.com/watch?v=dQw4w9WgXcQ",
      { forceRefresh: true },
    );

    expect(getVideoInfo).toHaveBeenCalledWith(
      "https://www.youtube.com/watch?v=dQw4w9WgXcQ",
      null,
      { forceRefresh: true },
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
