const path = require("path");
const {
  MEDIA_OPEN_CHANNEL,
  createMediaOpenService,
  normalizeCandidate,
} = require("../mediaOpenService");

function createHarness(platform = "win32") {
  const listeners = new Map();
  const app = {
    on: jest.fn((event, listener) => listeners.set(event, listener)),
    removeListener: jest.fn((event) => listeners.delete(event)),
  };
  const fs = { existsSync: jest.fn(() => true) };
  const mainWindow = {
    focus: jest.fn(),
    isDestroyed: jest.fn(() => false),
    isMinimized: jest.fn(() => false),
    restore: jest.fn(),
    show: jest.fn(),
    webContents: { send: jest.fn() },
  };
  const service = createMediaOpenService({ app, fs, platform });
  return { app, fs, listeners, mainWindow, service };
}

describe("mediaOpenService", () => {
  test("normalizes only supported media and playlist paths", () => {
    expect(normalizeCandidate("song.mp3", "/music", "darwin")).toBe(
      path.resolve("/music", "song.mp3"),
    );
    expect(normalizeCandidate("notes.txt", "/music", "darwin")).toBe("");
    expect(normalizeCandidate("--dev", "/music", "darwin")).toBe("");
  });

  test("queues startup files until the renderer is ready", () => {
    const { mainWindow, service } = createHarness();
    service.enqueueArgv(["Thunder.exe", "C:\\Music\\song.mp3"]);
    service.setMainWindow(mainWindow);
    expect(mainWindow.webContents.send).not.toHaveBeenCalled();

    service.markRendererReady();
    expect(mainWindow.webContents.send).toHaveBeenCalledWith(
      MEDIA_OPEN_CHANNEL,
      { files: [path.win32.normalize("C:\\Music\\song.mp3")], autoplay: true },
    );
  });

  test("deduplicates Windows paths case-insensitively", () => {
    const { mainWindow, service } = createHarness();
    service.enqueue(["C:\\Music\\Song.mp3", "c:\\music\\song.mp3"]);
    service.setMainWindow(mainWindow);
    service.markRendererReady();
    expect(mainWindow.webContents.send.mock.calls[0][1].files).toHaveLength(1);
  });

  test("captures macOS open-file events before window creation", () => {
    const { listeners, mainWindow, service } = createHarness("darwin");
    const event = { preventDefault: jest.fn() };
    listeners.get("open-file")(event, "/Music/song.m4a");
    service.setMainWindow(mainWindow);
    service.markRendererReady();
    expect(event.preventDefault).toHaveBeenCalled();
    expect(mainWindow.webContents.send).toHaveBeenCalledWith(
      MEDIA_OPEN_CHANNEL,
      { files: ["/Music/song.m4a"], autoplay: true },
    );
  });
});
