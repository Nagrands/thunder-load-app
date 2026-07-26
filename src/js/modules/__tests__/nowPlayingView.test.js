jest.mock("../i18n.js", () => ({
  applyI18n: jest.fn(),
  t: (key) => key,
}));
jest.mock("../modals.js", () => ({
  showConfirmationDialog: jest.fn().mockResolvedValue(true),
}));

import { showConfirmationDialog } from "../modals.js";
import { createNowPlayingView } from "../nowPlaying/nowPlayingView.js";

let fullscreenChangedHandler = null;

const sampleTrack = {
  id: "demo",
  providerId: "local",
  sourceRef: "/music/demo.mp3",
  title: "Demo track",
  artist: "Thunder",
  album: "Local",
  duration: 90,
  artworkUrl: "file:///cover.jpg",
  kind: "audio",
  availability: "available",
  sizeBytes: 3_435_973_837,
  mediaInfo: {
    width: 1920,
    height: 1080,
    videoCodec: "h264",
    audioCodec: "aac",
  },
};

function installPlayerDialogFixture() {
  const modal = document.createElement("div");
  modal.dataset.ui = "player-form-modal";
  modal.setAttribute("aria-hidden", "true");
  modal.innerHTML = `
    <form data-ui="player-form-modal-form">
      <h2 data-ui="player-form-modal-title"></h2>
      <p data-ui="player-form-modal-hint"></p>
      <section data-ui="player-form-modal-info" hidden>
        <img data-ui="player-form-modal-info-artwork" alt="" hidden />
        <span data-ui="player-form-modal-info-fallback"><i></i></span>
        <h3 data-ui="player-form-modal-info-title"></h3>
        <p data-ui="player-form-modal-info-subtitle" hidden></p>
        <div data-ui="player-form-modal-info-badges" hidden></div>
        <dl>
          ${["duration", "size", "dimensions", "container", "kind", "provider"]
            .map(
              (field) => `
                <div data-info-field="${field}" hidden>
                  <dt>${field}</dt>
                  <dd data-ui="player-form-modal-info-${field}"></dd>
                </div>
              `,
            )
            .join("")}
        </dl>
      </section>
      <label data-ui="player-form-modal-field">
        <span data-ui="player-form-modal-label"></span>
        <input data-ui="player-form-modal-input" />
        <select data-ui="player-form-modal-select" hidden></select>
      </label>
      <div data-ui="player-form-modal-error" hidden></div>
      <button type="button" data-ui="player-form-modal-close"></button>
      <button type="button" data-ui="player-form-modal-cancel"></button>
      <button type="submit" data-ui="player-form-modal-submit"></button>
    </form>`;
  document.body.appendChild(modal);
  return modal;
}

describe("Now Playing view", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    document.body.innerHTML = "";
    document.body.classList.remove("low-effects");
    document.documentElement.classList.remove("low-effects");
    fullscreenChangedHandler = null;
    window.electron = {
      fullscreen: {
        getState: jest.fn().mockResolvedValue({
          success: true,
          data: { isFullscreen: false },
        }),
        setState: jest.fn((isFullscreen) =>
          Promise.resolve({
            success: true,
            data: { isFullscreen },
          }),
        ),
        onChanged: jest.fn((handler) => {
          fullscreenChangedHandler = handler;
          return jest.fn();
        }),
      },
    };
    jest.spyOn(HTMLMediaElement.prototype, "load").mockImplementation(() => {});
    jest
      .spyOn(HTMLMediaElement.prototype, "pause")
      .mockImplementation(() => {});
    jest.spyOn(HTMLMediaElement.prototype, "play").mockResolvedValue(undefined);
    jest.spyOn(window, "requestAnimationFrame").mockImplementation(() => 1);
    jest.spyOn(window, "cancelAnimationFrame").mockImplementation(() => {});
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  test("renders an accessible player and restores selectedTrackId", async () => {
    const api = {
      getState: jest.fn().mockResolvedValue({
        success: true,
        data: {
          version: 1,
          playlist: { tracks: [sampleTrack] },
          selectedTrackId: "demo",
          volume: 0.5,
          repeat: "all",
        },
      }),
      setState: jest.fn().mockResolvedValue({ success: true }),
      importFiles: jest.fn(),
      importFolder: jest.fn(),
    };
    const view = createNowPlayingView({ api });
    document.body.appendChild(view.element);
    view.onShow();
    await view.ready;
    view.element
      .querySelector('[data-artwork-layer="0"] .now-playing__artwork')
      .dispatchEvent(new Event("load"));

    expect(view.element.getAttribute("role")).toBe("tabpanel");
    expect(
      view.element.querySelectorAll(".now-playing__media-layer"),
    ).toHaveLength(2);
    expect(
      view.element.querySelector(
        ".now-playing__metadata-slot.is-active .now-playing__track-title",
      ).textContent,
    ).toBe("Demo track");
    expect(
      view.element.querySelector(".now-playing__track.is-current"),
    ).not.toBeNull();
    expect(
      view.element
        .querySelector(".now-playing__track.is-current")
        .getAttribute("aria-current"),
    ).toBe("true");
    expect(
      view.element.querySelector('[data-action="repeat"]').dataset.mode,
    ).toBe("all");
    expect(
      view.element.querySelectorAll(
        ".now-playing__track.is-current .now-playing__waveform span",
      ),
    ).toHaveLength(4);
    expect(
      view.element.querySelector('[data-ui="brand-label"]').textContent,
    ).toBe("nowPlaying.label");
    expect(
      view.element.querySelector('[data-ui="floating-title"]').textContent,
    ).toBe("Demo track");
    expect(
      view.element.querySelector(
        '[data-action="placeholder-subtitles"]',
      ).getAttribute("aria-disabled"),
    ).toBe("true");
    expect(
      view.element.querySelector(".now-playing__sidebar-toolbar"),
    ).not.toBeNull();
    expect(
      [...view.element.querySelectorAll('[data-ui="media-badges"] span')].map(
        (badge) => badge.textContent,
      ),
    ).toEqual(["1080p", "H.264", "AAC"]);
    expect(view.element.querySelector('[data-ui="media-size"]').textContent).toBe(
      "3.2 GB",
    );
    view.dispose();
  });

  test("opens structured track information with the current poster", async () => {
    const dialog = installPlayerDialogFixture();
    const api = {
      getState: jest.fn().mockResolvedValue({
        success: true,
        data: {
          playlist: { tracks: [sampleTrack] },
          selectedTrackId: sampleTrack.id,
        },
      }),
      setState: jest.fn().mockResolvedValue({ success: true }),
      importFiles: jest.fn(),
      importFolder: jest.fn(),
    };
    const view = createNowPlayingView({ api });
    document.body.appendChild(view.element);
    await view.ready;

    view.element.querySelector('[data-action="current-track-info"]').click();

    expect(dialog.getAttribute("aria-hidden")).toBe("false");
    expect(dialog.dataset.mode).toBe("trackInfo");
    expect(
      dialog.querySelector('[data-ui="player-form-modal-info-title"]').textContent,
    ).toBe(sampleTrack.title);
    expect(
      dialog.querySelector('[data-ui="player-form-modal-info-artwork"]').src,
    ).toBe(sampleTrack.artworkUrl);
    view.dispose();
  });

  test("opens a non-blocking media library empty state", async () => {
    const api = {
      getState: jest.fn().mockResolvedValue({
        data: { playlist: { tracks: [] } },
      }),
      setState: jest.fn().mockResolvedValue({ success: true }),
      importFiles: jest.fn(),
      importFolder: jest.fn(),
    };
    const view = createNowPlayingView({ api });
    document.body.appendChild(view.element);
    await view.ready;

    const sidebar = view.element.querySelector(".now-playing__sidebar");
    const empty = view.element.querySelector('[data-ui="library-empty"]');
    const error = view.element.querySelector(".now-playing__error");
    expect(view.element.querySelector(".now-playing__empty")).toBeNull();
    expect(empty.hidden).toBe(false);
    expect(view.element.classList.contains("is-library-view")).toBe(true);
    expect(error.parentElement).toBe(view.element);
    expect(
      view.element.querySelector(".now-playing__sidebar-reveal-zone"),
    ).not.toBeNull();
    expect(
      view.element.querySelector(".now-playing__topbar-reveal-zone"),
    ).not.toBeNull();
    expect(sidebar.querySelector(".now-playing__brand-label").hidden).toBe(true);
    expect(sidebar.querySelector(".now-playing__library-title")).not.toBeNull();
    expect(sidebar.querySelector(".now-playing__track-stage").hidden).toBe(
      true,
    );
    expect(sidebar.querySelector(".now-playing__playlist-section").hidden).toBe(
      true,
    );
    expect(
      view.element.querySelectorAll(".now-playing__ambient.is-visible"),
    ).toHaveLength(0);
    expect(view.element.classList.contains("is-empty")).toBe(true);
    view.dispose();
  });

  test("keeps the library and another playlist track available after an unavailable track error", async () => {
    const missingTrack = {
      ...sampleTrack,
      id: "missing",
      sourceRef: "/music/missing.mp3",
      title: "Missing track",
      availability: "missing",
    };
    const api = {
      getState: jest.fn().mockResolvedValue({
        data: {
          version: 3,
          catalog: { tracks: [missingTrack, sampleTrack] },
          playlists: [],
          activePlaylistId: "media-library",
          selectedTrackId: "missing",
        },
      }),
      setState: jest.fn().mockResolvedValue({ success: true }),
      importFiles: jest.fn(),
      importFolder: jest.fn(),
    };
    const view = createNowPlayingView({ api });
    document.body.appendChild(view.element);
    await view.ready;

    const error = view.element.querySelector(".now-playing__error");
    const availableSidebarTrack = view.element.querySelector(
      '.now-playing__track[data-track-id="demo"] [data-action="select-track"]',
    );
    expect(error.hidden).toBe(false);
    expect(error.classList.contains("is-visible")).toBe(true);
    expect(availableSidebarTrack.disabled).toBe(false);

    error.querySelector('[data-action="show-library"]').click();
    expect(view.element.classList.contains("is-library-view")).toBe(true);
    expect(error.hidden).toBe(true);

    view.element
      .querySelector(
        '.player-library__track[data-track-id="demo"] [data-action="select-library-track"]',
      )
      .click();
    await Promise.resolve();
    await Promise.resolve();

    expect(error.hidden).toBe(true);
    expect(
      view.element
        .querySelector('.player-library__track[data-track-id="demo"]')
        .getAttribute("aria-selected"),
    ).toBe("true");
    expect(view.element.querySelector('[data-ui="mini-player"]').hidden).toBe(
      false,
    );
    view.dispose();
  });

  test("updates the brand label from playback state", async () => {
    const api = {
      getState: jest.fn().mockResolvedValue({
        data: {
          playlist: { tracks: [sampleTrack] },
          selectedTrackId: "demo",
        },
      }),
      setState: jest.fn().mockResolvedValue({ success: true }),
      importFiles: jest.fn(),
      importFolder: jest.fn(),
    };
    const view = createNowPlayingView({ api });
    document.body.appendChild(view.element);
    view.onShow();
    await view.ready;
    expect(
      view.element.querySelector('[data-ui="brand-label"]').textContent,
    ).toBe("nowPlaying.label");

    view.element.querySelector('[data-action="play-pause"]').click();
    expect(
      view.element.querySelector('[data-ui="brand-label"]').textContent,
    ).toBe("nowPlaying.label");
    view.dispose();
  });

  test("adjusts volume with the mouse wheel and shows the percentage", async () => {
    const api = {
      getState: jest.fn().mockResolvedValue({
        data: {
          playlist: { tracks: [sampleTrack] },
          selectedTrackId: "demo",
          volume: 0.5,
        },
      }),
      setState: jest.fn().mockResolvedValue({ success: true }),
      importFiles: jest.fn(),
      importFolder: jest.fn(),
    };
    const view = createNowPlayingView({ api });
    document.body.appendChild(view.element);
    await view.ready;
    const range = view.element.querySelector('[data-action="volume"]');
    const percent = view.element.querySelector('[data-ui="volume-percent"]');
    const mute = view.element.querySelector('[data-action="mute"]');
    jest.useFakeTimers();

    expect(percent.textContent).toBe("50%");
    expect(range.getAttribute("aria-valuetext")).toBe("50%");
    expect(mute.getAttribute("aria-label")).toBe("nowPlaying.mute");

    const wheelUp = new WheelEvent("wheel", {
      bubbles: true,
      cancelable: true,
      deltaY: -100,
    });
    percent.dispatchEvent(wheelUp);
    expect(wheelUp.defaultPrevented).toBe(true);
    expect(percent.textContent).toBe("55%");
    expect(range.value).toBe("0.55");
    expect(
      view.element.classList.contains("is-volume-feedback-visible"),
    ).toBe(true);

    range.dispatchEvent(
      new WheelEvent("wheel", {
        bubbles: true,
        cancelable: true,
        deltaY: 100,
      }),
    );
    expect(percent.textContent).toBe("50%");
    jest.advanceTimersByTime(1500);
    expect(
      view.element.classList.contains("is-volume-feedback-visible"),
    ).toBe(false);

    mute.click();
    expect(percent.textContent).toBe("0%");
    expect(mute.getAttribute("aria-label")).toBe("nowPlaying.unmute");
    mute.dispatchEvent(
      new WheelEvent("wheel", {
        bubbles: true,
        cancelable: true,
        deltaY: -1,
      }),
    );
    expect(percent.textContent).toBe("5%");
    expect(mute.getAttribute("aria-label")).toBe("nowPlaying.mute");

    const ignoredWheel = new WheelEvent("wheel", {
      bubbles: true,
      cancelable: true,
      ctrlKey: true,
      deltaY: -100,
    });
    percent.dispatchEvent(ignoredWheel);
    expect(ignoredWheel.defaultPrevented).toBe(false);
    expect(percent.textContent).toBe("5%");

    const outsideWheel = new WheelEvent("wheel", {
      bubbles: true,
      cancelable: true,
      deltaY: -100,
    });
    view.element
      .querySelector('[data-action="seek"]')
      .dispatchEvent(outsideWheel);
    expect(outsideWheel.defaultPrevented).toBe(false);
    expect(percent.textContent).toBe("5%");
    view.dispose();
    jest.useRealTimers();
  });

  test("syncs fullscreen controls, Escape and tab hide with preload state", async () => {
    const api = {
      getState: jest.fn().mockResolvedValue({
        data: { playlist: { tracks: [] } },
      }),
      setState: jest.fn().mockResolvedValue({ success: true }),
      importFiles: jest.fn(),
      importFolder: jest.fn(),
    };
    const view = createNowPlayingView({ api });
    document.body.appendChild(view.element);
    view.onShow();
    await view.ready;
    const button = view.element.querySelector('[data-action="fullscreen"]');

    expect(button.getAttribute("aria-label")).toBe(
      "nowPlaying.enterFullscreen",
    );
    button.click();
    await Promise.resolve();
    expect(window.electron.fullscreen.setState).toHaveBeenCalledWith(true);
    expect(view.element.classList.contains("is-fullscreen")).toBe(true);
    expect(button.querySelector("[data-lucide]").dataset.lucide).toBe(
      "minimize",
    );

    window.dispatchEvent(new KeyboardEvent("keydown", { key: "Escape" }));
    await Promise.resolve();
    expect(window.electron.fullscreen.setState).toHaveBeenLastCalledWith(false);
    expect(view.element.classList.contains("is-fullscreen")).toBe(false);

    fullscreenChangedHandler(true);
    expect(view.element.classList.contains("is-fullscreen")).toBe(true);
    view.onHide();
    await Promise.resolve();
    expect(window.electron.fullscreen.setState).toHaveBeenLastCalledWith(false);
    view.dispose();
  });

  test("refreshes dynamic playback and fullscreen labels after language changes", async () => {
    const api = {
      getState: jest.fn().mockResolvedValue({
        data: {
          playlist: { tracks: [sampleTrack] },
          selectedTrackId: "demo",
        },
      }),
      setState: jest.fn().mockResolvedValue({ success: true }),
      importFiles: jest.fn(),
      importFolder: jest.fn(),
    };
    const view = createNowPlayingView({ api });
    document.body.appendChild(view.element);
    await view.ready;
    fullscreenChangedHandler(true);

    const brandLabel = view.element.querySelector('[data-ui="brand-label"]');
    const fullscreenButton = view.element.querySelector(
      '[data-action="fullscreen"]',
    );
    brandLabel.textContent = "stale";
    fullscreenButton.setAttribute("aria-label", "stale");
    window.dispatchEvent(new CustomEvent("i18n:changed"));

    expect(brandLabel.textContent).toBe("nowPlaying.label");
    expect(fullscreenButton.getAttribute("aria-label")).toBe(
      "nowPlaying.exitFullscreen",
    );
    view.dispose();
  });

  test("shows only the matching audio ambient or video layer", async () => {
    const videoTrack = {
      ...sampleTrack,
      id: "video",
      sourceRef: "/music/video.mp4",
      title: "Video track",
      kind: "video",
    };
    const api = {
      getState: jest.fn().mockResolvedValue({
        data: {
          playlist: { tracks: [sampleTrack, videoTrack] },
          selectedTrackId: "demo",
        },
      }),
      setState: jest.fn().mockResolvedValue({ success: true }),
      importFiles: jest.fn(),
      importFolder: jest.fn(),
    };
    const view = createNowPlayingView({ api });
    document.body.appendChild(view.element);
    await view.ready;

    const audioAmbient = view.element.querySelector(
      ".now-playing__ambient.is-visible",
    );
    expect(audioAmbient).not.toBeNull();
    expect(audioAmbient.style.getPropertyValue("--ambient-artwork")).toContain(
      "cover.jpg",
    );
    expect(
      view.element.querySelectorAll(".now-playing__video.is-visible"),
    ).toHaveLength(0);

    view.element
      .querySelector('.now-playing__track[data-track-id="video"]')
      .dispatchEvent(new MouseEvent("dblclick", { bubbles: true }));
    await Promise.resolve();
    await Promise.resolve();

    expect(
      view.element.querySelectorAll(".now-playing__ambient.is-visible"),
    ).toHaveLength(0);
    expect(
      view.element.querySelectorAll(".now-playing__video.is-visible"),
    ).toHaveLength(1);
    view.dispose();
  });

  test("shows YouTube preparation without a false playing indicator", async () => {
    const youtubeTrack = {
      ...sampleTrack,
      id: "youtube:demo123",
      providerId: "youtube",
      sourceRef: "https://www.youtube.com/watch?v=demo123",
      title: "YouTube video",
      kind: "video",
    };
    let resolveYouTube;
    const api = {
      getState: jest.fn().mockResolvedValue({
        data: {
          version: 2,
          catalog: { tracks: [sampleTrack, youtubeTrack] },
          playlists: [],
          activePlaylistId: "media-library",
          selectedTrackId: sampleTrack.id,
        },
      }),
      setState: jest.fn().mockResolvedValue({ success: true }),
      importFiles: jest.fn(),
      importFolder: jest.fn(),
      resolveYouTubeTrack: jest.fn(
        () =>
          new Promise((resolve) => {
            resolveYouTube = resolve;
          }),
      ),
    };
    const view = createNowPlayingView({ api });
    document.body.appendChild(view.element);
    await view.ready;
    const row = view.element.querySelector(
      '.now-playing__track[data-track-id="youtube:demo123"]',
    );

    row.querySelector('[data-action="select-track"]').click();

    expect(row.classList.contains("is-loading")).toBe(true);
    expect(row.classList.contains("is-playing")).toBe(false);
    expect(row.getAttribute("aria-busy")).toBe("true");
    expect(
      view.element.querySelector('[data-ui="brand-label"]').textContent,
    ).toBe("nowPlaying.label");

    resolveYouTube({
      success: true,
      data: {
        src: "https://media.example/video.mp4",
        mimeType: "video/mp4",
      },
    });
    await new Promise((resolve) => setTimeout(resolve, 0));

    expect(row.classList.contains("is-loading")).toBe(false);
    expect(row.classList.contains("is-playing")).toBe(true);
    view.dispose();
  });

  test("loads restored media silently and attempts playback on first show", async () => {
    const api = {
      getState: jest.fn().mockResolvedValue({
        data: {
          playlist: { tracks: [sampleTrack] },
          selectedTrackId: "demo",
        },
      }),
      setState: jest.fn().mockResolvedValue({ success: true }),
      importFiles: jest.fn(),
      importFolder: jest.fn(),
    };
    const view = createNowPlayingView({ api });
    document.body.appendChild(view.element);

    await view.ready;
    expect(HTMLMediaElement.prototype.play).not.toHaveBeenCalled();
    view.onShow();
    await Promise.resolve();
    expect(HTMLMediaElement.prototype.play).toHaveBeenCalledTimes(1);
    HTMLMediaElement.prototype.pause.mockClear();
    window.dispatchEvent(new Event("blur"));
    expect(HTMLMediaElement.prototype.pause).not.toHaveBeenCalled();
    const hiddenSpy = jest
      .spyOn(document, "hidden", "get")
      .mockReturnValue(true);
    document.dispatchEvent(new Event("visibilitychange"));
    expect(HTMLMediaElement.prototype.pause).not.toHaveBeenCalled();
    hiddenSpy.mockRestore();
    view.onHide();
    expect(HTMLMediaElement.prototype.pause).not.toHaveBeenCalled();
    view.dispose();
  });

  test("syncs system media commands with playback while the view is active", async () => {
    const handlers = new Map();
    const mediaSession = {
      metadata: null,
      playbackState: "none",
      setActionHandler: jest.fn((action, handler) => {
        handlers.set(action, handler);
      }),
      setPositionState: jest.fn(),
    };
    const originalMediaSession = Object.getOwnPropertyDescriptor(
      navigator,
      "mediaSession",
    );
    const originalMetadata = globalThis.MediaMetadata;
    Object.defineProperty(navigator, "mediaSession", {
      configurable: true,
      value: mediaSession,
    });
    globalThis.MediaMetadata = class MediaMetadata {
      constructor(metadata) {
        Object.assign(this, metadata);
      }
    };
    const secondTrack = {
      ...sampleTrack,
      id: "second",
      sourceRef: "/music/second.mp3",
      title: "Second track",
    };
    const api = {
      getState: jest.fn().mockResolvedValue({
        data: {
          playlist: { tracks: [sampleTrack, secondTrack] },
          selectedTrackId: "demo",
        },
      }),
      setState: jest.fn().mockResolvedValue({ success: true }),
      importFiles: jest.fn(),
      importFolder: jest.fn(),
    };
    const view = createNowPlayingView({ api });
    document.body.appendChild(view.element);

    try {
      view.onShow();
      await view.ready;
      expect(mediaSession.metadata.title).toBe("Demo track");
      expect(mediaSession.playbackState).toBe("playing");

      handlers.get("pause")();
      expect(mediaSession.playbackState).toBe("paused");

      handlers.get("nexttrack")();
      await Promise.resolve();
      expect(mediaSession.metadata.title).toBe("Second track");

      view.dispose();
      expect(mediaSession.metadata).toBeNull();
      expect(mediaSession.playbackState).toBe("none");
      expect(handlers.get("play")).toBeNull();
    } finally {
      view.dispose();
      if (originalMediaSession) {
        Object.defineProperty(navigator, "mediaSession", originalMediaSession);
      } else {
        delete navigator.mediaSession;
      }
      globalThis.MediaMetadata = originalMetadata;
    }
  });

  test("restores and persists background playback and sidebar pin preferences", async () => {
    jest.useFakeTimers();
    const api = {
      getState: jest.fn().mockResolvedValue({
        data: {
          playlist: { tracks: [sampleTrack] },
          selectedTrackId: "demo",
          backgroundPlayback: false,
          sidebarPinned: true,
        },
      }),
      setState: jest.fn().mockResolvedValue({ success: true }),
      importFiles: jest.fn(),
      importFolder: jest.fn(),
    };
    const view = createNowPlayingView({ api });
    document.body.appendChild(view.element);
    view.onShow();
    await view.ready;
    const backgroundButton = view.element.querySelector(
      '[data-action="background-playback"]',
    );
    const pinButton = view.element.querySelector('[data-action="pin-sidebar"]');

    expect(backgroundButton.getAttribute("aria-pressed")).toBe("false");
    expect(pinButton.getAttribute("aria-pressed")).toBe("true");
    expect(view.element.classList.contains("is-sidebar-pinned")).toBe(true);
    expect(view.element.classList.contains("is-sidebar-visible")).toBe(true);

    HTMLMediaElement.prototype.pause.mockClear();
    window.dispatchEvent(new Event("blur"));
    expect(HTMLMediaElement.prototype.pause).toHaveBeenCalled();
    window.dispatchEvent(new Event("focus"));
    await Promise.resolve();
    HTMLMediaElement.prototype.pause.mockClear();
    view.onHide();
    expect(HTMLMediaElement.prototype.pause).toHaveBeenCalled();
    backgroundButton.click();
    pinButton.click();
    jest.advanceTimersByTime(250);
    await Promise.resolve();
    await Promise.resolve();
    expect(backgroundButton.getAttribute("aria-pressed")).toBe("true");
    expect(pinButton.getAttribute("aria-pressed")).toBe("false");
    expect(api.setState).toHaveBeenLastCalledWith(
      expect.objectContaining({
        backgroundPlayback: true,
        sidebarPinned: false,
      }),
    );
    jest.advanceTimersByTime(180);
    expect(view.element.classList.contains("is-sidebar-visible")).toBe(false);
    view.dispose();
    jest.useRealTimers();
  });

  test("applies Settings changes and publishes Player changes without a loop", async () => {
    jest.useFakeTimers();
    const api = {
      getState: jest.fn().mockResolvedValue({
        data: {
          playlist: { tracks: [sampleTrack] },
          selectedTrackId: "demo",
          backgroundPlayback: true,
          sidebarPinned: false,
          shuffle: false,
          repeat: "off",
          volume: 1,
          muted: false,
        },
      }),
      setState: jest.fn().mockResolvedValue({ success: true }),
      importFiles: jest.fn(),
      importFolder: jest.fn(),
    };
    const settingsState = jest.fn();
    window.addEventListener("now-playing:settings-state", settingsState);
    const view = createNowPlayingView({ api });
    document.body.appendChild(view.element);
    await view.ready;
    api.setState.mockClear();
    settingsState.mockClear();

    window.dispatchEvent(
      new CustomEvent("now-playing:settings-apply", {
        detail: {
          sidebarPinned: true,
          backgroundPlayback: false,
          shuffle: true,
          repeat: "all",
          volume: 0.3,
          muted: true,
        },
      }),
    );

    expect(
      view.element
        .querySelector('[data-action="pin-sidebar"]')
        .getAttribute("aria-pressed"),
    ).toBe("true");
    expect(
      view.element
        .querySelector('[data-action="background-playback"]')
        .getAttribute("aria-pressed"),
    ).toBe("false");
    expect(
      view.element
        .querySelector('[data-action="shuffle"]')
        .getAttribute("aria-pressed"),
    ).toBe("true");
    expect(
      view.element.querySelector('[data-action="repeat"]').dataset.mode,
    ).toBe("all");
    expect(view.element.querySelector('[data-action="volume"]').value).toBe("0");
    expect(settingsState).toHaveBeenCalledTimes(1);

    jest.advanceTimersByTime(250);
    await Promise.resolve();
    await Promise.resolve();
    expect(api.setState).toHaveBeenLastCalledWith(
      expect.objectContaining({
        sidebarPinned: true,
        backgroundPlayback: false,
        shuffle: true,
        repeat: "all",
        volume: 0.3,
        muted: true,
      }),
    );

    settingsState.mockClear();
    view.element.querySelector('[data-action="shuffle"]').click();
    expect(settingsState).toHaveBeenCalledWith(
      expect.objectContaining({
        detail: expect.objectContaining({ shuffle: false }),
      }),
    );

    window.removeEventListener("now-playing:settings-state", settingsState);
    view.dispose();
    jest.useRealTimers();
  });

  test("hands artwork and metadata off together after the new cover loads", async () => {
    const secondTrack = {
      ...sampleTrack,
      id: "second",
      sourceRef: "/music/second.mp3",
      title: "Second",
      artworkUrl: "file:///second.jpg",
    };
    const api = {
      getState: jest.fn().mockResolvedValue({
        data: {
          playlist: { tracks: [sampleTrack, secondTrack] },
          selectedTrackId: "demo",
        },
      }),
      setState: jest.fn().mockResolvedValue({ success: true }),
      importFiles: jest.fn(),
      importFolder: jest.fn(),
    };
    const view = createNowPlayingView({ api });
    document.body.appendChild(view.element);
    await view.ready;

    const firstArtwork = view.element.querySelector(
      '[data-artwork-layer="0"] .now-playing__artwork',
    );
    firstArtwork.dispatchEvent(new Event("load"));
    expect(
      view.element.querySelector(
        ".now-playing__metadata-slot.is-active .now-playing__track-title",
      ).textContent,
    ).toBe("Demo track");

    view.element
      .querySelector('[data-track-id="second"] [data-action="select-track"]')
      .click();
    await Promise.resolve();
    firstArtwork.dispatchEvent(new Event("load"));
    expect(
      view.element.querySelector(
        ".now-playing__metadata-slot.is-active .now-playing__track-title",
      ).textContent,
    ).toBe("Demo track");

    const secondArtwork = Array.from(
      view.element.querySelectorAll(".now-playing__artwork"),
    ).find((image) => image.dataset.visualTrackId === "second");
    secondArtwork.dispatchEvent(new Event("load"));
    expect(
      view.element.querySelector(
        ".now-playing__metadata-slot.is-active .now-playing__track-title",
      ).textContent,
    ).toBe("Second");
    expect(secondArtwork.classList.contains("is-loaded")).toBe(true);
    view.dispose();
  });

  test("keeps a neutral fallback for missing artwork and hides unknown metadata", async () => {
    const trackWithoutMetadata = {
      ...sampleTrack,
      artworkUrl: null,
      artist: "",
      album: "",
    };
    const api = {
      getState: jest.fn().mockResolvedValue({
        data: {
          playlist: { tracks: [trackWithoutMetadata] },
          selectedTrackId: "demo",
        },
      }),
      setState: jest.fn().mockResolvedValue({ success: true }),
      importFiles: jest.fn(),
      importFolder: jest.fn(),
    };
    const view = createNowPlayingView({ api });
    document.body.appendChild(view.element);
    await view.ready;

    const activeMetadata = view.element.querySelector(
      ".now-playing__metadata-slot.is-active",
    );
    expect(
      view.element.querySelector(".now-playing__artwork-stack").hidden,
    ).toBe(false);
    expect(view.element.classList.contains("has-artwork")).toBe(false);
    expect(
      view.element.querySelector(".now-playing__artwork-fallback"),
    ).not.toBeNull();
    expect(
      activeMetadata.querySelector(".now-playing__track-title").textContent,
    ).toBe("Demo track");
    expect(
      activeMetadata.querySelector(".now-playing__track-artist").hidden,
    ).toBe(true);
    expect(
      activeMetadata.querySelector(".now-playing__track-artist").textContent,
    ).toBe("");
    expect(activeMetadata.querySelector(".now-playing__album").hidden).toBe(
      true,
    );
    view.dispose();
  });

  test("hides broken artwork while preserving real album metadata", async () => {
    const trackWithBrokenArtwork = {
      ...sampleTrack,
      artist: "",
      album: "Thunder Album",
      artworkUrl: "file:///missing-cover.jpg",
    };
    const api = {
      getState: jest.fn().mockResolvedValue({
        data: {
          playlist: { tracks: [trackWithBrokenArtwork] },
          selectedTrackId: "demo",
        },
      }),
      setState: jest.fn().mockResolvedValue({ success: true }),
      importFiles: jest.fn(),
      importFolder: jest.fn(),
    };
    const view = createNowPlayingView({ api });
    document.body.appendChild(view.element);
    await view.ready;
    const artwork = view.element.querySelector(
      '[data-artwork-layer="0"] .now-playing__artwork',
    );

    artwork.dispatchEvent(new Event("error"));

    const activeMetadata = view.element.querySelector(
      ".now-playing__metadata-slot.is-active",
    );
    expect(
      view.element.querySelector(".now-playing__artwork-stack").hidden,
    ).toBe(false);
    expect(
      activeMetadata.querySelector(".now-playing__track-artist").hidden,
    ).toBe(true);
    expect(activeMetadata.querySelector(".now-playing__album").hidden).toBe(
      false,
    );
    expect(
      activeMetadata.querySelector(".now-playing__album").textContent,
    ).toBe("Thunder Album");
    view.dispose();
  });

  test("exposes reduced-motion state and commits track visuals immediately", async () => {
    document.body.classList.add("low-effects");
    const api = {
      getState: jest.fn().mockResolvedValue({
        data: {
          playlist: { tracks: [sampleTrack] },
          selectedTrackId: "demo",
        },
      }),
      setState: jest.fn().mockResolvedValue({ success: true }),
      importFiles: jest.fn(),
      importFolder: jest.fn(),
    };
    const view = createNowPlayingView({ api });
    document.body.appendChild(view.element);
    await view.ready;

    expect(view.element.classList.contains("is-reduced-motion")).toBe(true);
    expect(view.element.dataset.motion).toBe("reduced");
    expect(
      view.element.querySelector(
        ".now-playing__metadata-slot.is-active .now-playing__track-title",
      ).textContent,
    ).toBe("Demo track");
    view.dispose();
  });

  test("imports files, selects the first new track and persists the queue", async () => {
    const api = {
      getState: jest.fn().mockResolvedValue({
        success: true,
        data: { version: 1, playlist: { tracks: [] } },
      }),
      setState: jest.fn().mockResolvedValue({ success: true }),
      importFiles: jest.fn().mockResolvedValue({
        success: true,
        data: { tracks: [sampleTrack] },
      }),
      importFolder: jest.fn(),
    };
    const view = createNowPlayingView({ api });
    document.body.appendChild(view.element);
    await view.ready;

    view.element.querySelector('[data-action="add-files"]').click();
    await Promise.resolve();
    await Promise.resolve();
    await Promise.resolve();
    await new Promise((resolve) => setTimeout(resolve, 260));

    expect(api.importFiles).toHaveBeenCalledTimes(1);
    expect(
      view.element.querySelector(".now-playing__track-name").textContent,
    ).toBe("Demo track");
    expect(api.setState).toHaveBeenCalledWith(
      expect.objectContaining({ selectedTrackId: "demo" }),
    );
    view.dispose();
  });

  test("autohides controls only while playing and locks them on interaction", async () => {
    jest.useFakeTimers();
    const api = {
      getState: jest.fn().mockResolvedValue({
        data: {
          playlist: { tracks: [sampleTrack] },
          selectedTrackId: "demo",
        },
      }),
      setState: jest.fn().mockResolvedValue({ success: true }),
      importFiles: jest.fn(),
      importFolder: jest.fn(),
    };
    const view = createNowPlayingView({ api });
    document.body.appendChild(view.element);
    view.onShow();
    await view.ready;

    expect(view.element.classList.contains("is-controls-visible")).toBe(true);
    expect(view.element.classList.contains("is-cursor-hidden")).toBe(false);
    jest.advanceTimersByTime(2500);
    expect(view.element.classList.contains("is-controls-visible")).toBe(false);
    expect(view.element.classList.contains("is-cursor-hidden")).toBe(true);

    view.element.dispatchEvent(new MouseEvent("mousemove", { bubbles: true }));
    expect(view.element.classList.contains("is-controls-visible")).toBe(true);
    expect(view.element.classList.contains("is-cursor-hidden")).toBe(false);
    const dock = view.element.querySelector(".now-playing__dock");
    dock.dispatchEvent(new MouseEvent("mouseenter"));
    jest.advanceTimersByTime(3000);
    expect(view.element.classList.contains("is-controls-visible")).toBe(true);
    expect(view.element.classList.contains("is-controls-locked")).toBe(true);

    dock.dispatchEvent(new MouseEvent("mouseleave"));
    jest.advanceTimersByTime(2500);
    expect(view.element.classList.contains("is-controls-visible")).toBe(false);
    expect(view.element.classList.contains("is-cursor-hidden")).toBe(true);
    view.element.querySelector('[data-action="play-pause"]').click();
    expect(view.element.classList.contains("is-controls-visible")).toBe(true);
    expect(view.element.classList.contains("is-cursor-hidden")).toBe(false);
    jest.advanceTimersByTime(3000);
    expect(view.element.classList.contains("is-controls-visible")).toBe(true);

    view.onHide();
    expect(view.element.classList.contains("is-controls-visible")).toBe(false);
    expect(view.element.classList.contains("is-cursor-hidden")).toBe(false);
    view.dispose();
    jest.useRealTimers();
  });

  test("supports row keyboard selection, removal and queue clearing", async () => {
    const api = {
      getState: jest.fn().mockResolvedValue({
        data: {
          playlist: {
            tracks: [
              sampleTrack,
              {
                ...sampleTrack,
                id: "second",
                sourceRef: "/music/second.mp3",
                title: "Second",
              },
            ],
          },
          selectedTrackId: "demo",
        },
      }),
      setState: jest.fn().mockResolvedValue({ success: true }),
      importFiles: jest.fn(),
      importFolder: jest.fn(),
    };
    const view = createNowPlayingView({ api });
    document.body.appendChild(view.element);
    await view.ready;

    const secondRow = view.element.querySelector('[data-track-id="second"]');
    secondRow.dispatchEvent(
      new KeyboardEvent("keydown", { key: "Enter", bubbles: true }),
    );
    await Promise.resolve();
    expect(secondRow.getAttribute("aria-selected")).toBe("true");

    secondRow.querySelector('[data-action="remove-track"]').click();
    await Promise.resolve();
    await Promise.resolve();
    expect(showConfirmationDialog).toHaveBeenCalledWith(
      expect.objectContaining({
        title: "nowPlaying.library.deleteTitle",
        confirmText: "nowPlaying.library.deleteAction",
      }),
    );
    expect(
      view.element.querySelector('.now-playing__track[data-track-id="second"]'),
    ).toBeNull();
    view.element.querySelector('[data-action="clear"]').click();
    await Promise.resolve();
    await Promise.resolve();
    expect(showConfirmationDialog).toHaveBeenCalledWith(
      expect.objectContaining({
        title: "nowPlaying.library.clearQueueTitle",
        confirmText: "nowPlaying.library.clearQueueAction",
      }),
    );
    expect(view.element.querySelector('[data-ui="library-empty"]').hidden).toBe(false);
    expect(view.element.classList.contains("is-library-view")).toBe(true);
    view.dispose();
  });

  test("clears every item from the system Media Library after confirmation", async () => {
    const secondTrack = {
      ...sampleTrack,
      id: "second",
      sourceRef: "/music/second.mp3",
      title: "Second",
    };
    const api = {
      getState: jest.fn().mockResolvedValue({
        data: {
          version: 3,
          catalog: { tracks: [sampleTrack, secondTrack] },
          playlists: [
            {
              id: "favorites",
              title: "Favorites",
              trackIds: ["demo", "second"],
            },
          ],
          activePlaylistId: "media-library",
          selectedTrackId: "demo",
        },
      }),
      setState: jest.fn().mockResolvedValue({ success: true }),
      importFiles: jest.fn(),
      importFolder: jest.fn(),
    };
    const view = createNowPlayingView({ api });
    document.body.appendChild(view.element);
    await view.ready;

    view.element.querySelector('[data-action="show-library"]').click();
    const clearButton = view.element.querySelector(
      '[data-action="clear-media-library"]',
    );
    expect(clearButton.hidden).toBe(false);
    clearButton.click();
    await Promise.resolve();
    await Promise.resolve();

    expect(showConfirmationDialog).toHaveBeenCalledWith(
      expect.objectContaining({
        title: "nowPlaying.library.clearQueueTitle",
        message: "nowPlaying.library.clearQueueConfirm",
        confirmText: "nowPlaying.library.clearQueueAction",
      }),
    );
    expect(
      view.element.querySelectorAll('[data-ui="library-tracks"] [data-track-id]'),
    ).toHaveLength(0);
    expect(view.element.querySelector('[data-ui="library-empty"]').hidden).toBe(
      false,
    );
    expect(clearButton.disabled).toBe(true);
    view.dispose();
  });

  test("closes current playback from the mini-player without removing media", async () => {
    const api = {
      getState: jest.fn().mockResolvedValue({
        data: {
          version: 3,
          catalog: { tracks: [sampleTrack] },
          playlists: [],
          activePlaylistId: "media-library",
          selectedTrackId: "demo",
        },
      }),
      setState: jest.fn().mockResolvedValue({ success: true }),
      importFiles: jest.fn(),
      importFolder: jest.fn(),
    };
    const view = createNowPlayingView({ api });
    document.body.appendChild(view.element);
    await view.ready;

    view.element.querySelector('[data-action="show-library"]').click();
    const miniPlayer = view.element.querySelector('[data-ui="mini-player"]');
    expect(miniPlayer.hidden).toBe(false);
    expect(
      miniPlayer.querySelector('[data-action="close-playback"] [data-lucide]')
        .dataset.lucide,
    ).toBe("square-x");

    miniPlayer.querySelector('[data-action="close-playback"]').click();
    await Promise.resolve();

    expect(miniPlayer.hidden).toBe(true);
    expect(view.element.classList.contains("is-library-view")).toBe(true);
    expect(
      view.element.querySelectorAll(
        '[data-ui="library-tracks"] .player-library__track',
      ),
    ).toHaveLength(1);
    expect(
      view.element.querySelector('[data-action="close-playback"] span')
        .textContent,
    ).toBe("nowPlaying.closePlayback");
    view.dispose();
  });

  test("renders the V2 media library, playlists and persistent mini-player", async () => {
    const api = {
      getState: jest.fn().mockResolvedValue({
        data: {
          version: 2,
          catalog: { tracks: [sampleTrack] },
          playlists: [
            {
              id: "favorites",
              title: "Favorites",
              trackIds: ["demo"],
              createdAt: "1",
              updatedAt: "1",
            },
          ],
          activePlaylistId: "media-library",
          selectedTrackId: "demo",
        },
      }),
      setState: jest.fn().mockResolvedValue({ success: true }),
      importFiles: jest.fn(),
      importFolder: jest.fn(),
    };
    const view = createNowPlayingView({ api });
    document.body.appendChild(view.element);
    await view.ready;

    view.element.querySelector('[data-action="show-library"]').click();
    const library = view.element.querySelector('[data-ui="library-view"]');
    expect(library.hidden).toBe(false);
    expect(view.element.classList.contains("is-library-view")).toBe(true);
    expect(library.querySelector(".player-library__command-bar")).not.toBeNull();
    expect(library.querySelector(".player-library__column-header")).not.toBeNull();
    expect(
      library
        .querySelector('[data-ui="library-search-clear"] [data-lucide]')
        .dataset.lucide,
    ).toBe("x");
    const headerActions = library.querySelector(
      ".player-library__header-actions",
    );
    expect(headerActions.querySelectorAll("span")).toHaveLength(0);
    expect(
      [...headerActions.querySelectorAll("button")].map((button) => ({
        label: button.getAttribute("aria-label"),
        title: button.getAttribute("title"),
        tooltip: button.dataset.bsToggle,
      })),
    ).toEqual([
      {
        label: "nowPlaying.addFiles",
        title: "nowPlaying.addFiles",
        tooltip: "tooltip",
      },
      {
        label: "nowPlaying.addFolder",
        title: "nowPlaying.addFolder",
        tooltip: "tooltip",
      },
      {
        label: "nowPlaying.youtube.add",
        title: "nowPlaying.youtube.add",
        tooltip: "tooltip",
      },
      {
        label: "nowPlaying.playlists.create",
        title: "nowPlaying.playlists.create",
        tooltip: "tooltip",
      },
    ]);
    expect(
      [...library.querySelectorAll(".player-library__filters [data-lucide]")].map(
        (icon) => icon.dataset.lucide,
      ),
    ).toEqual(["layout-grid", "clapperboard", "music-2", "file-warning"]);
    expect(
      library.querySelector('[data-ui="playlist-management-actions"]').hidden,
    ).toBe(false);
    expect(
      library.querySelector('[data-action="clear-media-library"]').hidden,
    ).toBe(false);
    expect(
      library.querySelector('[data-action="clear-media-library"]').disabled,
    ).toBe(false);
    expect(
      library.querySelector('[data-action="open-rename-playlist-dialog"]').hidden,
    ).toBe(true);
    expect(
      library.querySelector('[data-action="delete-playlist"]').hidden,
    ).toBe(true);
    expect(
      [...library.querySelectorAll(".player-library__track-badges span")].map(
        (badge) => badge.textContent,
      ),
    ).toEqual(["1080p", "H.264", "AAC"]);
    expect(
      library.querySelectorAll(".player-library__playlist-card"),
    ).toHaveLength(2);
    expect(
      library.querySelector(
        '.player-library__playlist-card[data-playlist-id="media-library"]',
      ),
    ).not.toBeNull();
    expect(library.querySelector('[data-ui="mini-player"]').hidden).toBe(false);
    expect(library.querySelector('[data-ui="mini-title"]').textContent).toBe(
      "Demo track",
    );
    expect(library.querySelector('[data-ui="mini-artist"]').textContent).toBe(
      "Thunder",
    );
    expect(library.querySelector('[data-ui="mini-album"]').textContent).toBe(
      "Local",
    );
    expect(
      library.querySelector('.player-library__return'),
    ).toBeNull();
    expect(
      library
        .querySelector('[data-ui="mini-player"] [data-action="show-player"]')
        .getAttribute("aria-label"),
    ).toBe("nowPlaying.library.openFullPlayer");
    expect(
      library.querySelector('[data-action="seek"]').max,
    ).toBe("90");
    expect(
      library.querySelector('[data-ui="mini-duration"]').textContent,
    ).toBe("1:30");
    expect(
      library.querySelector('[data-action="volume"]').getAttribute(
        "aria-valuetext",
      ),
    ).toBe("100%");
    const sidebarSwitcher = view.element.querySelector(
      '[data-ui="sidebar-playlist-switcher"]',
    );
    const sidebarPlaylistMenu = view.element.querySelector(
      '[data-ui="sidebar-playlist-menu"]',
    );
    expect(
      [...sidebarPlaylistMenu.querySelectorAll('[role="option"]')].map(
        (option) => option.dataset.playlistId,
      ),
    ).toEqual(["media-library", "favorites"]);
    expect(sidebarSwitcher.dataset.playlistId).toBe("media-library");
    expect(sidebarSwitcher.getAttribute("aria-haspopup")).toBe("listbox");
    const libraryCard = library.querySelector(
      '.player-library__playlist-card[data-playlist-id="media-library"]',
    );
    const libraryTrack = library.querySelector(
      '.player-library__track[data-track-id="demo"]',
    );
    const libraryTrackPlay = libraryTrack.querySelector(
      '[data-action="select-library-track"]',
    );
    libraryTrack
      .querySelector('[data-action="open-track-context-menu"]')
      .click();
    view.element
      .querySelector('[data-context-action="queue"]')
      .click();
    expect(
      [
        ...library.querySelectorAll(
          '[data-ui="transient-queue"] .player-library__queued-actions button',
        ),
      ].map((button) => ({
        icon: button.querySelector("[data-lucide]")?.dataset.lucide,
        title: button.getAttribute("title"),
        tooltip: button.dataset.bsToggle,
      })),
    ).toEqual([
      {
        icon: "arrow-up",
        title: "nowPlaying.playlists.moveUp",
        tooltip: "tooltip",
      },
      {
        icon: "arrow-down",
        title: "nowPlaying.playlists.moveDown",
        tooltip: "tooltip",
      },
      {
        icon: "x",
        title: "nowPlaying.queue.remove",
        tooltip: "tooltip",
      },
    ]);
    expect(libraryTrackPlay.getAttribute("aria-label")).toBe(
      "nowPlaying.play Demo track",
    );
    expect(libraryTrackPlay.getAttribute("title")).toBe(
      "nowPlaying.play Demo track",
    );
    libraryTrackPlay.click();
    await Promise.resolve();
    await Promise.resolve();
    expect(libraryTrackPlay.getAttribute("aria-label")).toBe(
      "nowPlaying.pause Demo track",
    );
    expect(libraryTrackPlay.getAttribute("data-bs-original-title")).toBe(
      "nowPlaying.pause Demo track",
    );
    libraryTrackPlay.click();
    await Promise.resolve();
    expect(libraryTrackPlay.getAttribute("aria-label")).toBe(
      "nowPlaying.play Demo track",
    );
    view.element
      .querySelectorAll(".now-playing__video")
      .forEach((media) => media.dispatchEvent(new Event("timeupdate")));
    expect(
      library.querySelector(
        '.player-library__playlist-card[data-playlist-id="media-library"]',
      ),
    ).toBe(libraryCard);
    expect(
      library.querySelector('.player-library__track[data-track-id="demo"]'),
    ).toBe(libraryTrack);

    library
      .querySelector(
        '.player-library__playlist-card[data-playlist-id="favorites"]',
      )
      .click();
    expect(
      library.querySelector('[data-ui="active-playlist-title"]').textContent,
    ).toBe("Favorites");
    expect(
      library.querySelector('[data-ui="playlist-management-actions"]').hidden,
    ).toBe(false);
    expect(
      library.querySelector('[data-action="clear-media-library"]').hidden,
    ).toBe(true);
    expect(
      library.querySelector('[data-action="open-rename-playlist-dialog"]').hidden,
    ).toBe(false);
    expect(
      library.querySelector('[data-action="delete-playlist"]').hidden,
    ).toBe(false);
    expect(sidebarSwitcher.dataset.playlistId).toBe("favorites");

    sidebarSwitcher.click();
    expect(sidebarPlaylistMenu.hidden).toBe(false);
    sidebarPlaylistMenu
      .querySelector('[data-playlist-id="media-library"]')
      .click();
    await Promise.resolve();
    expect(
      library.querySelector('[data-ui="active-playlist-title"]').textContent,
    ).toBe("nowPlaying.library.title");
    expect(sidebarSwitcher.dataset.playlistId).toBe("media-library");
    expect(sidebarPlaylistMenu.hidden).toBe(true);
    sidebarSwitcher.dispatchEvent(
      new KeyboardEvent("keydown", { key: "ArrowDown", bubbles: true }),
    );
    expect(sidebarPlaylistMenu.hidden).toBe(false);
    expect(document.activeElement.getAttribute("role")).toBe("option");
    document.activeElement.dispatchEvent(
      new KeyboardEvent("keydown", { key: "Escape", bubbles: true }),
    );
    expect(sidebarPlaylistMenu.hidden).toBe(true);
    expect(document.activeElement).toBe(sidebarSwitcher);

    library.querySelector('[data-action="show-player"]').click();
    expect(library.hidden).toBe(true);
    expect(view.element.classList.contains("is-library-view")).toBe(false);
    view.dispose();
  });

  test("loads a video poster eagerly for the current card and library mini-player", async () => {
    const videoTrack = {
      ...sampleTrack,
      id: "video-preview",
      sourceRef: "/video/preview.mkv",
      title: "Preview video",
      artworkUrl: "",
      kind: "video",
    };
    const api = {
      getState: jest.fn().mockResolvedValue({
        data: {
          version: 3,
          catalog: { tracks: [videoTrack] },
          playlists: [],
          activePlaylistId: "media-library",
          selectedTrackId: videoTrack.id,
        },
      }),
      setState: jest.fn().mockResolvedValue({ success: true }),
      importFiles: jest.fn(),
      importFolder: jest.fn(),
      getTimelinePreview: jest.fn().mockResolvedValue({
        success: true,
        data: {
          dataUrl: "data:image/jpeg;base64,eager-poster",
          timestamp: 2,
        },
      }),
      cancelTimelinePreview: jest.fn(),
    };
    const view = createNowPlayingView({ api });
    document.body.appendChild(view.element);
    await view.ready;
    await Promise.resolve();
    await Promise.resolve();

    expect(api.getTimelinePreview).toHaveBeenCalledWith(
      expect.objectContaining({
        timestamp: 2,
        trackId: videoTrack.id,
      }),
    );
    const currentPoster = view.element.querySelector(
      '[data-ui="generated-poster"]',
    );
    expect(currentPoster.hidden).toBe(false);
    expect(currentPoster.src).toBe("data:image/jpeg;base64,eager-poster");
    const miniPoster = view.element.querySelector('[data-ui="mini-artwork"]');
    expect(miniPoster.hidden).toBe(false);
    expect(miniPoster.src).toBe("data:image/jpeg;base64,eager-poster");
    view.dispose();
  });

  test("searches the active playlist, composes filters, and renders no-results", async () => {
    const videoTrack = {
      ...sampleTrack,
      id: "video",
      sourceRef: "/video/episode.mkv",
      title: "Royal episode",
      displayTitle: "Royal episode",
      artist: "Studio",
      album: "Season one",
      kind: "video",
    };
    const missingTrack = {
      ...sampleTrack,
      id: "missing",
      sourceRef: "/music/lost.flac",
      title: "Lost recording",
      displayTitle: "Lost recording",
      artist: "Archive",
      album: "Rare",
      artworkUrl: "",
      availability: "missing",
    };
    const api = {
      getState: jest.fn().mockResolvedValue({
        data: {
          version: 3,
          catalog: { tracks: [sampleTrack, videoTrack, missingTrack] },
          playlists: [
            {
              id: "video-only",
              title: "Video only",
              trackIds: ["video"],
            },
          ],
          activePlaylistId: "media-library",
          selectedTrackId: "demo",
        },
      }),
      setState: jest.fn().mockResolvedValue({ success: true }),
      importFiles: jest.fn(),
      importFolder: jest.fn(),
    };
    const view = createNowPlayingView({ api });
    document.body.appendChild(view.element);
    await view.ready;
    view.element.querySelector('[data-action="show-library"]').click();
    const library = view.element.querySelector('[data-ui="library-view"]');
    const search = library.querySelector('[data-ui="library-search"]');

    search.value = "season one";
    search.dispatchEvent(new Event("input", { bubbles: true }));
    expect(library.querySelector('[data-ui="library-search-clear"]').hidden).toBe(
      false,
    );
    expect(library.querySelectorAll(".player-library__track")).toHaveLength(1);
    expect(
      library.querySelector(".player-library__track").dataset.trackId,
    ).toBe("video");

    library
      .querySelector('[data-action="set-library-filter"][data-filter="audio"]')
      .click();
    expect(library.querySelector('[data-ui="library-tracks"]').hidden).toBe(true);
    expect(library.querySelector('[data-ui="library-no-results"]').hidden).toBe(
      false,
    );

    library.querySelector('[data-action="clear-library-search"]').click();
    expect(search.value).toBe("");
    expect(
      library
        .querySelector('[data-filter="all"]')
        .getAttribute("aria-pressed"),
    ).toBe("true");
    expect(library.querySelectorAll(".player-library__track")).toHaveLength(3);

    library
      .querySelector('[data-action="set-library-filter"][data-filter="missing"]')
      .click();
    expect(library.querySelectorAll(".player-library__track")).toHaveLength(1);
    expect(
      library.querySelector(".player-library__track").classList,
    ).toContain("is-missing");
    expect(
      library.querySelector('[data-ui="mini-title"]').textContent,
    ).toBe("Demo track");

    search.value = "royal";
    search.dispatchEvent(new Event("input", { bubbles: true }));
    library
      .querySelector(
        '.player-library__playlist-card[data-playlist-id="video-only"]',
      )
      .click();
    expect(search.value).toBe("royal");
    expect(
      library
        .querySelector('[data-filter="missing"]')
        .getAttribute("aria-pressed"),
    ).toBe("true");
    expect(library.querySelector('[data-ui="library-no-results"]').hidden).toBe(
      false,
    );
    view.dispose();
  });

  test("switches playlists from the library and sidebar without autoplay", async () => {
    const secondTrack = {
      ...sampleTrack,
      id: "second",
      sourceRef: "/music/second.mp3",
      title: "Second track",
    };
    const api = {
      getState: jest.fn().mockResolvedValue({
        data: {
          version: 2,
          catalog: { tracks: [sampleTrack, secondTrack] },
          playlists: [
            {
              id: "favorites",
              title: "Favorites",
              trackIds: ["second"],
            },
            {
              id: "calm",
              title: "Calm",
              trackIds: ["demo"],
            },
          ],
          activePlaylistId: "media-library",
          selectedTrackId: "demo",
        },
      }),
      setState: jest.fn().mockResolvedValue({ success: true }),
      importFiles: jest.fn(),
      importFolder: jest.fn(),
    };
    const view = createNowPlayingView({ api });
    document.body.appendChild(view.element);
    await view.ready;
    const play = view.element.querySelector(
      '.now-playing__dock [data-action="play-pause"]',
    );
    play.click();
    await Promise.resolve();
    HTMLMediaElement.prototype.play.mockClear();
    HTMLMediaElement.prototype.pause.mockClear();

    view.element.querySelector('[data-action="show-library"]').click();
    view.element
      .querySelector(
        '.player-library__playlist-card[data-playlist-id="favorites"]',
      )
      .click();
    await new Promise((resolve) => setTimeout(resolve, 0));

    expect(HTMLMediaElement.prototype.pause).toHaveBeenCalled();
    expect(HTMLMediaElement.prototype.play).not.toHaveBeenCalled();
    expect(
      view.element.querySelector(".now-playing__track.is-current").dataset
        .trackId,
    ).toBe("second");
    expect(
      view.element.querySelector('[data-ui="brand-label"]').textContent,
    ).toBe("nowPlaying.label");

    play.click();
    await Promise.resolve();
    expect(HTMLMediaElement.prototype.play).toHaveBeenCalledTimes(1);
    HTMLMediaElement.prototype.play.mockClear();
    HTMLMediaElement.prototype.pause.mockClear();
    view.element.querySelector('[data-action="show-player"]').click();
    const sidebarSwitcher = view.element.querySelector(
      '[data-ui="sidebar-playlist-switcher"]',
    );
    expect(sidebarSwitcher.getAttribute("aria-controls")).toBe(
      "now-playing-sidebar-playlist-menu",
    );
    expect(
      sidebarSwitcher.closest(".now-playing__library-heading").hidden,
    ).toBe(false);

    sidebarSwitcher.click();
    const sidebarPlaylistMenu = view.element.querySelector(
      '[data-ui="sidebar-playlist-menu"]',
    );
    sidebarPlaylistMenu.querySelector('[data-playlist-id="calm"]').click();
    await new Promise((resolve) => setTimeout(resolve, 260));

    expect(HTMLMediaElement.prototype.pause).toHaveBeenCalled();
    expect(HTMLMediaElement.prototype.play).not.toHaveBeenCalled();
    expect(sidebarSwitcher.dataset.playlistId).toBe("calm");
    expect(
      view.element.querySelector(".now-playing__track.is-current").dataset
        .trackId,
    ).toBe("demo");
    expect(api.setState).toHaveBeenLastCalledWith(
      expect.objectContaining({
        activePlaylistId: "calm",
        selectedTrackId: "demo",
      }),
    );
    view.dispose();
  });

  test("creates a playlist with the accessible library dialog", async () => {
    const dialog = installPlayerDialogFixture();
    const api = {
      getState: jest.fn().mockResolvedValue({
        data: {
          version: 2,
          catalog: { tracks: [sampleTrack] },
          playlists: [],
          activePlaylistId: "media-library",
        },
      }),
      setState: jest.fn().mockResolvedValue({ success: true }),
      importFiles: jest.fn(),
      importFolder: jest.fn(),
    };
    const view = createNowPlayingView({ api });
    document.body.appendChild(view.element);
    await view.ready;
    view.element.querySelector('[data-action="show-library"]').click();
    view.element
      .querySelector('[data-action="open-create-playlist-dialog"]')
      .click();

    const input = dialog.querySelector('[data-ui="player-form-modal-input"]');
    expect(dialog.getAttribute("aria-hidden")).toBe("false");
    input.value = "Road trip";
    dialog
      .querySelector('[data-ui="player-form-modal-form"]')
      .dispatchEvent(new Event("submit", { bubbles: true, cancelable: true }));
    await new Promise((resolve) => setTimeout(resolve, 260));

    expect(dialog.getAttribute("aria-hidden")).toBe("true");
    expect(
      Array.from(
        view.element.querySelectorAll(".player-library__playlist-copy strong"),
      ).some((label) => label.textContent === "Road trip"),
    ).toBe(true);
    expect(api.setState).toHaveBeenCalledWith(
      expect.objectContaining({
        version: 3,
        activePlaylistId: "media-library",
        playlists: expect.arrayContaining([
          expect.objectContaining({ title: "Road trip" }),
        ]),
      }),
    );
    view.dispose();
  });

  test("imports a single YouTube video from the library dialog", async () => {
    jest.useFakeTimers();
    const dialog = installPlayerDialogFixture();
    const youtubeTrack = {
      ...sampleTrack,
      id: "youtube:demo123",
      providerId: "youtube",
      sourceRef: "https://www.youtube.com/watch?v=demo123",
      title: "Thunder video",
      kind: "video",
    };
    const api = {
      getState: jest.fn().mockResolvedValue({
        data: {
          version: 2,
          catalog: { tracks: [] },
          playlists: [],
          activePlaylistId: "media-library",
        },
      }),
      setState: jest.fn().mockResolvedValue({ success: true }),
      importFiles: jest.fn(),
      importFolder: jest.fn(),
      analyzeYouTubeVideo: jest.fn().mockResolvedValue({
        success: true,
        data: {
          track: youtubeTrack,
          qualities: [
            { id: "auto", label: "Auto", selector: { mode: "auto" } },
          ],
          defaultSelection: { mode: "auto" },
        },
      }),
      importYouTubeVideo: jest.fn().mockResolvedValue({
        success: true,
        data: { track: youtubeTrack },
      }),
      resolveYouTubeTrack: jest.fn().mockResolvedValue({
        success: true,
        data: {
          src: "https://media.example/video.mp4",
          mimeType: "video/mp4",
        },
      }),
    };
    const view = createNowPlayingView({ api });
    document.body.appendChild(view.element);
    await view.ready;
    view.element.querySelector('[data-action="show-library"]').click();
    view.element.querySelector('[data-action="open-youtube-dialog"]').click();
    dialog.querySelector('[data-ui="player-form-modal-input"]').value =
      youtubeTrack.sourceRef;
    dialog
      .querySelector('[data-ui="player-form-modal-form"]')
      .dispatchEvent(new Event("submit", { bubbles: true, cancelable: true }));
    await Promise.resolve();
    await Promise.resolve();
    await Promise.resolve();

    dialog
      .querySelector('[data-ui="player-form-modal-form"]')
      .dispatchEvent(new Event("submit", { bubbles: true, cancelable: true }));
    await Promise.resolve();
    await Promise.resolve();
    await Promise.resolve();

    expect(api.importYouTubeVideo).toHaveBeenCalledWith(
      youtubeTrack.sourceRef,
      { mode: "auto" },
    );
    expect(
      view.element.querySelector(
        '.player-library__track[data-track-id="youtube:demo123"]',
      ),
    ).not.toBeNull();
    expect(api.resolveYouTubeTrack).not.toHaveBeenCalled();
    expect(
      view.element.querySelector('[data-ui="library-operation-status"]')
        .textContent,
    ).toContain("nowPlaying.youtube.added");
    expect(view.element.querySelector(".now-playing__status").textContent).toBe(
      "nowPlaying.youtube.added",
    );

    jest.advanceTimersByTime(4000);

    expect(
      view.element.querySelector('[data-ui="library-operation-status"]').hidden,
    ).toBe(true);
    expect(view.element.querySelector(".now-playing__status").textContent).toBe(
      "",
    );
    view.dispose();
    jest.useRealTimers();
  });
});
