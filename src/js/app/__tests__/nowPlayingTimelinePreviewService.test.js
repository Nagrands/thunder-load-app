const { EventEmitter } = require("events");

const {
  MAX_CACHE_ITEMS,
  NowPlayingTimelinePreviewService,
  buildPreviewArgs,
  validateRequest,
} = require("../nowPlayingTimelinePreviewService");

function createChild({ image = Buffer.from("jpeg"), pending = false } = {}) {
  const child = new EventEmitter();
  child.stdout = new EventEmitter();
  child.stderr = new EventEmitter();
  child.exitCode = null;
  child.kill = jest.fn(() => {
    child.exitCode = 143;
    queueMicrotask(() => child.emit("close", 143));
  });
  if (!pending) {
    queueMicrotask(() => {
      child.stdout.emit("data", image);
      child.exitCode = 0;
      child.emit("close", 0);
    });
  }
  return child;
}

describe("NowPlayingTimelinePreviewService", () => {
  test("builds bounded frame-only FFmpeg arguments", () => {
    expect(buildPreviewArgs("/media/movie.mp4", 12)).toEqual(
      expect.arrayContaining([
        "-ss",
        "12",
        "-frames:v",
        "1",
        "-vcodec",
        "mjpeg",
        "pipe:1",
      ]),
    );
    expect(buildPreviewArgs("/media/movie.mp4", 12)).not.toContain("-y");
  });

  test("validates and buckets requests", () => {
    expect(
      validateRequest({
        requestId: "preview-1",
        trackId: "track-1",
        timestamp: 13.9,
      }),
    ).toMatchObject({ timestamp: 12 });
    expect(() =>
      validateRequest({
        requestId: "../bad",
        trackId: "track-1",
        timestamp: 1,
      }),
    ).toThrow("Invalid preview request ID");
  });

  test("extracts, caches and reuses a local preview", async () => {
    const spawnProcess = jest.fn(() => createChild());
    const service = new NowPlayingTimelinePreviewService({
      ffmpegPathResolver: () => "/tools/ffmpeg",
      getTrackById: () => ({
        id: "track-1",
        kind: "video",
        providerId: "local",
        sourceRef: "/media/movie.mp4",
      }),
      spawnProcess,
    });

    const first = await service.getPreview({
      requestId: "preview-1",
      trackId: "track-1",
      timestamp: 4.2,
    });
    const second = await service.getPreview({
      requestId: "preview-2",
      trackId: "track-1",
      timestamp: 5.9,
    });

    expect(first.dataUrl).toBe("data:image/jpeg;base64,anBlZw==");
    expect(second.dataUrl).toBe(first.dataUrl);
    expect(spawnProcess).toHaveBeenCalledTimes(1);
    service.dispose();
  });

  test("uses active HLS inputs and cancels stale extraction", async () => {
    const child = createChild({ pending: true });
    const service = new NowPlayingTimelinePreviewService({
      ffmpegPathResolver: () => "/tools/ffmpeg",
      getSessionInputs: () => ["https://media.example/video.mp4"],
      getTrackById: () => ({
        id: "youtube:demo",
        kind: "video",
        providerId: "youtube",
        sourceRef: "https://youtube.com/watch?v=demo123",
      }),
      spawnProcess: jest.fn(() => child),
    });
    const pending = service.getPreview({
      requestId: "preview-1",
      sessionId: "12345678-1234-1234-1234-123456789abc",
      trackId: "youtube:demo",
      timestamp: 8,
    });

    await Promise.resolve();
    expect(service.cancel("preview-1")).toBe(true);
    await expect(pending).rejects.toMatchObject({ code: "PREVIEW_CANCELLED" });
    expect(child.kill).toHaveBeenCalledWith("SIGTERM");
  });

  test("returns a safe fallback for audio and keeps cache bounded", async () => {
    const service = new NowPlayingTimelinePreviewService({
      ffmpegPathResolver: () => "/tools/ffmpeg",
      getTrackById: () => ({
        id: "track-1",
        kind: "audio",
        providerId: "local",
        sourceRef: "/media/song.mp3",
      }),
      spawnProcess: jest.fn(),
    });
    const result = await service.getPreview({
      requestId: "preview-1",
      trackId: "track-1",
      timestamp: 2,
    });

    expect(result).toMatchObject({
      dataUrl: null,
      fallbackReason: "audio",
    });
    expect(service.cache.size).toBeLessThanOrEqual(MAX_CACHE_ITEMS);
  });
});
