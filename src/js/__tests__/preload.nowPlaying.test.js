const mockExposeInMainWorld = jest.fn();
const mockInvoke = jest.fn();

jest.mock("electron", () => ({
  contextBridge: { exposeInMainWorld: mockExposeInMainWorld },
  ipcRenderer: {
    invoke: mockInvoke,
    on: jest.fn(),
    once: jest.fn(),
    removeListener: jest.fn(),
    removeAllListeners: jest.fn(),
    send: jest.fn(),
  },
  webUtils: { getPathForFile: jest.fn() },
}));

describe("preload Now Playing API", () => {
  beforeEach(() => {
    jest.resetModules();
    mockExposeInMainWorld.mockClear();
    mockInvoke.mockClear();
    require("../preload");
  });

  test("exposes typed wrappers for all Now Playing invokes", async () => {
    const api = mockExposeInMainWorld.mock.calls[0][1];
    const state = { version: 2 };

    await api.nowPlaying.importFiles();
    await api.nowPlaying.importFolder();
    await api.nowPlaying.importYouTubeVideo(
      "https://www.youtube.com/watch?v=dQw4w9WgXcQ",
    );
    await api.nowPlaying.resolveYouTubeTrack(
      "https://www.youtube.com/watch?v=dQw4w9WgXcQ",
    );
    await api.nowPlaying.createLocalPlaybackSession("/media/archive.avi");
    await api.nowPlaying.getState();
    await api.nowPlaying.setState(state);

    expect(mockInvoke.mock.calls).toEqual([
      ["now-playing:import-files"],
      ["now-playing:import-folder"],
      [
        "now-playing:import-youtube-video",
        "https://www.youtube.com/watch?v=dQw4w9WgXcQ",
        null,
      ],
      [
        "now-playing:resolve-youtube-track",
        "https://www.youtube.com/watch?v=dQw4w9WgXcQ",
        {},
      ],
      ["now-playing:create-local-playback-session", "/media/archive.avi"],
      ["now-playing:get-state"],
      ["now-playing:set-state", state],
    ]);
  });
});
