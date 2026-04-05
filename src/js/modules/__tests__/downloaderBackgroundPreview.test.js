/** @jest-environment jsdom */

describe("downloaderBackgroundPreview", () => {
  let moduleApi;
  let playMock;
  let pauseMock;
  let loadMock;

  const buildDom = () => {
    document.body.innerHTML = `
      <div
        id="downloader-background-preview"
        class="downloader-background-preview"
        aria-hidden="true"
      >
        <video
          id="downloader-background-video-a"
          class="downloader-background-preview__video"
        >
          <source id="downloader-background-video-source-a" />
        </video>
        <video
          id="downloader-background-video-b"
          class="downloader-background-preview__video"
        >
          <source id="downloader-background-video-source-b" />
        </video>
      </div>
    `;
  };

  const loadModule = () => {
    jest.isolateModules(() => {
      moduleApi = require("../downloaderBackgroundPreview.js");
    });
  };

  beforeEach(() => {
    jest.resetModules();
    jest.useFakeTimers();
    buildDom();

    playMock = jest.fn().mockResolvedValue(undefined);
    pauseMock = jest.fn();
    loadMock = jest.fn();

    Object.defineProperty(document, "visibilityState", {
      configurable: true,
      value: "visible",
    });
    document.hasFocus = jest.fn(() => true);

    Object.defineProperty(HTMLMediaElement.prototype, "play", {
      configurable: true,
      value: playMock,
    });
    Object.defineProperty(HTMLMediaElement.prototype, "pause", {
      configurable: true,
      value: pauseMock,
    });
    Object.defineProperty(HTMLMediaElement.prototype, "load", {
      configurable: true,
      value: loadMock,
    });
    Object.defineProperty(HTMLMediaElement.prototype, "readyState", {
      configurable: true,
      get() {
        return 0;
      },
    });

    loadModule();
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  test("fades in the background video after media becomes ready", async () => {
    const { initDownloaderBackgroundPreview, applyDownloaderBackgroundPreview } =
      moduleApi;
    initDownloaderBackgroundPreview();

    await applyDownloaderBackgroundPreview(
      { src: "https://cdn.example.com/demo.mp4", mime: "video/mp4" },
      { pageUrl: "https://www.youtube.com/watch?v=demo" },
    );

    const layer = document.getElementById("downloader-background-preview");
    const video = document.getElementById("downloader-background-video-a");

    expect(video.classList.contains("is-loading")).toBe(true);
    expect(layer.classList.contains("is-active")).toBe(false);

    video.dispatchEvent(new Event("loadeddata"));
    jest.advanceTimersByTime(50);
    await Promise.resolve();

    expect(video.classList.contains("is-ready")).toBe(true);
    expect(video.classList.contains("is-loading")).toBe(false);
    expect(video.classList.contains("is-visible")).toBe(true);
    expect(layer.classList.contains("is-active")).toBe(true);
  });

  test("pauses when document becomes hidden and resumes on focus", async () => {
    const { initDownloaderBackgroundPreview, applyDownloaderBackgroundPreview } =
      moduleApi;
    initDownloaderBackgroundPreview();

    await applyDownloaderBackgroundPreview(
      { src: "https://cdn.example.com/demo.mp4", mime: "video/mp4" },
      { pageUrl: "https://www.youtube.com/watch?v=demo" },
    );

    Object.defineProperty(document, "visibilityState", {
      configurable: true,
      value: "hidden",
    });
    document.dispatchEvent(new Event("visibilitychange"));
    expect(pauseMock).toHaveBeenCalled();

    Object.defineProperty(document, "visibilityState", {
      configurable: true,
      value: "visible",
    });
    document.hasFocus = jest.fn(() => true);
    window.dispatchEvent(new Event("focus"));
    await Promise.resolve();

    expect(playMock).toHaveBeenCalled();
  });

  test("crossfades to the second buffer when source changes", async () => {
    const { initDownloaderBackgroundPreview, applyDownloaderBackgroundPreview } =
      moduleApi;
    initDownloaderBackgroundPreview();

    await applyDownloaderBackgroundPreview(
      { src: "https://cdn.example.com/demo-a.mp4", mime: "video/mp4" },
      { pageUrl: "https://www.youtube.com/watch?v=demo-a" },
    );

    const videoA = document.getElementById("downloader-background-video-a");
    const videoB = document.getElementById("downloader-background-video-b");

    videoA.dispatchEvent(new Event("loadeddata"));
    jest.advanceTimersByTime(50);
    await Promise.resolve();
    expect(videoA.classList.contains("is-visible")).toBe(true);

    await applyDownloaderBackgroundPreview(
      { src: "https://cdn.example.com/demo-b.mp4", mime: "video/mp4" },
      { pageUrl: "https://www.youtube.com/watch?v=demo-b" },
    );

    expect(videoB.classList.contains("is-loading")).toBe(true);
    expect(videoA.classList.contains("is-visible")).toBe(true);

    videoB.dispatchEvent(new Event("loadeddata"));
    jest.advanceTimersByTime(50);
    await Promise.resolve();

    expect(videoB.classList.contains("is-visible")).toBe(true);
    expect(videoA.classList.contains("is-visible")).toBe(false);
  });

  test("preserves playback position when recovering the same page with a new source", async () => {
    const { initDownloaderBackgroundPreview, applyDownloaderBackgroundPreview } =
      moduleApi;
    initDownloaderBackgroundPreview();

    await applyDownloaderBackgroundPreview(
      { src: "https://cdn.example.com/demo-a.mp4", mime: "video/mp4" },
      { pageUrl: "https://www.youtube.com/watch?v=demo" },
    );

    const videoA = document.getElementById("downloader-background-video-a");
    const videoB = document.getElementById("downloader-background-video-b");

    videoA.dispatchEvent(new Event("loadeddata"));
    jest.advanceTimersByTime(50);
    await Promise.resolve();

    Object.defineProperty(videoA, "currentTime", {
      configurable: true,
      writable: true,
      value: 27.5,
    });
    Object.defineProperty(videoB, "currentTime", {
      configurable: true,
      writable: true,
      value: 0,
    });

    await applyDownloaderBackgroundPreview(
      { src: "https://cdn.example.com/demo-a-refreshed.mp4", mime: "video/mp4" },
      { pageUrl: "https://www.youtube.com/watch?v=demo" },
    );

    videoB.dispatchEvent(new Event("loadeddata"));
    jest.advanceTimersByTime(50);
    await Promise.resolve();

    expect(videoB.currentTime).toBe(27.5);
  });

  test("dispatches a single recovery event on playback error", async () => {
    const { RECOVERY_EVENT, initDownloaderBackgroundPreview, applyDownloaderBackgroundPreview } =
      moduleApi;
    initDownloaderBackgroundPreview();

    const recoverListener = jest.fn();
    window.addEventListener(RECOVERY_EVENT, recoverListener);

    await applyDownloaderBackgroundPreview(
      { src: "https://cdn.example.com/demo.mp4", mime: "video/mp4" },
      { pageUrl: "https://www.youtube.com/watch?v=demo" },
    );

    const video = document.getElementById("downloader-background-video-a");
    video.dispatchEvent(new Event("error"));
    video.dispatchEvent(new Event("error"));

    expect(recoverListener).toHaveBeenCalledTimes(1);
    expect(recoverListener.mock.calls[0][0].detail.url).toBe(
      "https://www.youtube.com/watch?v=demo",
    );
  });
});
