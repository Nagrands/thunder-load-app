/** @jest-environment jsdom */

describe("downloaderLivePreview", () => {
  let api;
  let playMock;
  let pauseMock;
  let loadMock;

  beforeEach(() => {
    jest.resetModules();
    document.body.innerHTML = `
      <button id="preview-open-live" type="button">open</button>
      <div id="preview-live-player" class="preview-live-player-modal modal-overlay hidden" aria-hidden="true">
        <div class="preview-live-player-modal__dialog">
          <button id="preview-live-close" type="button"></button>
          <video id="preview-live-video">
            <source id="preview-live-video-source" />
          </video>
        </div>
      </div>
    `;

    playMock = jest.fn().mockResolvedValue(undefined);
    pauseMock = jest.fn();
    loadMock = jest.fn();
    document.hasFocus = jest.fn(() => true);
    Object.defineProperty(document, "visibilityState", {
      configurable: true,
      value: "visible",
    });

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

    jest.isolateModules(() => {
      api = require("../downloaderLivePreview.js");
    });
  });

  test("opens player and starts playback with sound from explicit event", async () => {
    api.initDownloaderLivePreview();

    window.dispatchEvent(
      new CustomEvent(api.PLAY_EVENT, {
        detail: {
          preview: {
            src: "https://cdn.example.com/live.mp4",
            mime: "video/mp4",
            poster: "https://cdn.example.com/poster.jpg",
          },
        },
      }),
    );
    await Promise.resolve();

    const panel = document.getElementById("preview-live-player");
    const video = document.getElementById("preview-live-video");
    const source = document.getElementById("preview-live-video-source");

    expect(panel.classList.contains("hidden")).toBe(false);
    expect(panel.classList.contains("is-open")).toBe(true);
    expect(panel.getAttribute("aria-hidden")).toBe("false");
    expect(document.body.classList.contains("modal-scroll-lock")).toBe(true);
    expect(source.getAttribute("src")).toBe("https://cdn.example.com/live.mp4");
    expect(source.getAttribute("type")).toBe("video/mp4");
    expect(video.getAttribute("poster")).toBe("https://cdn.example.com/poster.jpg");
    expect(video.muted).toBe(false);
    expect(video.volume).toBe(0.5);
    expect(playMock).toHaveBeenCalled();
  });

  test("hides and clears player on close", async () => {
    api.initDownloaderLivePreview();
    await api.openDownloaderLivePreview({
      src: "https://cdn.example.com/live.mp4",
      mime: "video/mp4",
    });

    document.getElementById("preview-live-close").click();

    const panel = document.getElementById("preview-live-player");
    const source = document.getElementById("preview-live-video-source");

    expect(panel.classList.contains("hidden")).toBe(true);
    expect(document.body.classList.contains("modal-scroll-lock")).toBe(false);
    expect(source.getAttribute("src")).toBeNull();
    expect(pauseMock).toHaveBeenCalled();
  });

  test("closes modal on Escape and returns focus to opener", async () => {
    api.initDownloaderLivePreview();
    const opener = document.getElementById("preview-open-live");
    const openerFocusSpy = jest.spyOn(opener, "focus");
    opener.focus();

    await api.openDownloaderLivePreview({
      src: "https://cdn.example.com/live.mp4",
      mime: "video/mp4",
    });

    document.dispatchEvent(
      new KeyboardEvent("keydown", { key: "Escape", bubbles: true }),
    );

    const panel = document.getElementById("preview-live-player");
    expect(panel.classList.contains("is-open")).toBe(false);
    expect(openerFocusSpy).toHaveBeenCalled();
  });

  test("closes modal when backdrop is clicked", async () => {
    api.initDownloaderLivePreview();

    await api.openDownloaderLivePreview({
      src: "https://cdn.example.com/live.mp4",
      mime: "video/mp4",
    });

    document
      .getElementById("preview-live-player")
      .dispatchEvent(new MouseEvent("mousedown", { bubbles: true }));

    const panel = document.getElementById("preview-live-player");
    expect(panel.classList.contains("is-open")).toBe(false);
    expect(panel.classList.contains("hidden")).toBe(true);
  });

  test("pauses live preview when window becomes hidden", async () => {
    api.initDownloaderLivePreview();
    await api.openDownloaderLivePreview(
      {
        src: "https://cdn.example.com/live.mp4",
        mime: "video/mp4",
      },
      { pageUrl: "https://www.youtube.com/watch?v=demo" },
    );

    Object.defineProperty(document, "visibilityState", {
      configurable: true,
      value: "hidden",
    });
    document.dispatchEvent(new Event("visibilitychange"));

    expect(pauseMock).toHaveBeenCalled();
  });

  test("dispatches one-shot retry event before closing on repeated playback errors", async () => {
    api.initDownloaderLivePreview();
    const retryListener = jest.fn();
    window.addEventListener(api.RETRY_EVENT, retryListener);

    await api.openDownloaderLivePreview(
      {
        src: "https://cdn.example.com/live.mp4",
        mime: "video/mp4",
      },
      { pageUrl: "https://www.youtube.com/watch?v=demo" },
    );

    const video = document.getElementById("preview-live-video");
    Object.defineProperty(video, "currentTime", {
      configurable: true,
      writable: true,
      value: 31.25,
    });
    video.dispatchEvent(new Event("error"));
    video.dispatchEvent(new Event("error"));

    expect(retryListener).toHaveBeenCalledTimes(1);
    expect(retryListener.mock.calls[0][0].detail.url).toBe(
      "https://www.youtube.com/watch?v=demo",
    );
    expect(retryListener.mock.calls[0][0].detail.resumeTime).toBe(31.25);
  });

  test("restores playback position when reopened for the same page", async () => {
    api.initDownloaderLivePreview();
    const video = document.getElementById("preview-live-video");
    Object.defineProperty(video, "currentTime", {
      configurable: true,
      writable: true,
      value: 0,
    });

    await api.openDownloaderLivePreview(
      {
        src: "https://cdn.example.com/live.mp4",
        mime: "video/mp4",
      },
      {
        pageUrl: "https://www.youtube.com/watch?v=demo",
        resumeTime: 44.5,
      },
    );

    expect(video.currentTime).toBe(44.5);
  });
});
