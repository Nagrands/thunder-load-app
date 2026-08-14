const { createDownloadRuntime, normalizeParallelLimit } = require("../download/runtime");

jest.mock("electron-log", () => ({ info: jest.fn(), warn: jest.fn(), error: jest.fn() }));
jest.mock("../toolsVersions", () => ({
  getToolsVersions: jest.fn().mockResolvedValue({
    ytDlp: { ok: true },
    ffmpeg: { ok: true },
  }),
}));

function deferred() {
  let resolve;
  let reject;
  const promise = new Promise((res, rej) => {
    resolve = res;
    reject = rej;
  });
  return { promise, reject, resolve };
}

function createFixture({ parallelLimit = 2 } = {}) {
  const values = { downloadParallelLimit: parallelLimit };
  const store = {
    get: jest.fn((key, fallback) => values[key] ?? fallback),
    set: jest.fn((key, value) => {
      values[key] = value;
    }),
  };
  const engine = {
    createDownloadToken: jest.fn(() => ({ cancelled: false })),
    downloadMedia: jest.fn(),
    getVideoInfo: jest.fn().mockResolvedValue({
      title: "Fixture",
      formats: [{ format_id: "best" }],
    }),
    getVideoPreview: jest.fn(),
    selectFormatsByQuality: jest.fn(() => ({
      videoFormat: "bestvideo",
      audioFormat: "bestaudio",
      resolution: "1080p",
      fps: 30,
      videoExt: "mp4",
      audioExt: "m4a",
    })),
    stopDownload: jest.fn().mockResolvedValue(1),
  };
  const runtime = createDownloadRuntime({
    store,
    engine,
    getDownloadPath: () => "/tmp",
  });
  return { engine, runtime, store, values };
}

describe("download runtime", () => {
  test("normalizes and persists the supported parallel range", () => {
    const { runtime, store } = createFixture();

    expect(normalizeParallelLimit(0)).toBe(1);
    expect(runtime.setParallelLimit(99)).toBe(2);
    expect(runtime.getParallelLimit()).toBe(2);
    expect(store.set).toHaveBeenCalledWith("downloadParallelLimit", 2);
  });

  test("owns parallel jobs and cancels only the requested token", async () => {
    const { engine, runtime } = createFixture();
    const firstMedia = deferred();
    const secondMedia = deferred();
    const tokenA = { cancelled: false };
    const tokenB = { cancelled: false };
    engine.createDownloadToken
      .mockReturnValueOnce(tokenA)
      .mockReturnValueOnce(tokenB);
    engine.downloadMedia
      .mockReturnValueOnce(firstMedia.promise)
      .mockReturnValueOnce(secondMedia.promise);

    const first = runtime.start({
      event: {},
      url: "https://example.com/a",
      quality: "Source",
      jobId: "job-a",
    });
    const second = runtime.start({
      event: {},
      url: "https://example.com/b",
      quality: "Source",
      jobId: "job-b",
    });

    expect(runtime.getActiveCount()).toBe(2);
    await expect(runtime.cancel("job-b")).resolves.toEqual({
      success: true,
      jobId: "job-b",
      cancelled: true,
    });
    expect(engine.stopDownload).toHaveBeenCalledWith(tokenB);
    await expect(
      runtime.start({
        event: {},
        url: "https://example.com/c",
        quality: "Source",
        jobId: "job-c",
      }),
    ).rejects.toThrow("Parallel download limit reached");

    firstMedia.resolve("/tmp/a.mp4");
    secondMedia.resolve("/tmp/b.mp4");
    await Promise.all([first, second]);
    expect(runtime.isBusy()).toBe(false);
  });

  test("cancels an in-flight metadata token", async () => {
    const { engine, runtime } = createFixture();
    const info = deferred();
    const token = { cancelled: false };
    engine.createDownloadToken.mockReturnValueOnce(token);
    engine.getVideoInfo.mockReturnValueOnce(info.promise);

    const request = runtime.getVideoInfo("https://example.com/video");
    await expect(
      runtime.cancelVideoInfo({
        url: "https://example.com/video",
        previewOnly: false,
      }),
    ).resolves.toEqual({ success: true, cancelled: true });
    expect(engine.stopDownload).toHaveBeenCalledWith([token]);
    info.resolve({ title: "Fixture", formats: [] });
    await request;
  });

  test("dispose cancels all owned tokens and is idempotent", async () => {
    const { engine, runtime } = createFixture();
    const media = deferred();
    const token = { cancelled: false };
    engine.createDownloadToken.mockReturnValueOnce(token);
    engine.downloadMedia.mockReturnValueOnce(media.promise);
    const pending = runtime.start({
      event: {},
      url: "https://example.com/a",
      quality: "Source",
      jobId: "job-a",
    });

    await runtime.dispose();
    await runtime.dispose();
    expect(engine.stopDownload).toHaveBeenCalledTimes(1);
    expect(engine.stopDownload).toHaveBeenCalledWith([token]);
    media.resolve("/tmp/a.mp4");
    await pending;
    await expect(
      runtime.start({ event: {}, url: "https://example.com/b", quality: "Source" }),
    ).rejects.toThrow("disposed");
  });
});
