jest.mock("../i18n.js", () => ({
  applyI18n: jest.fn(),
  t: (key) => key,
}));

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
};

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
    view.dispose();
  });

  test("keeps empty onboarding outside the minimal library sidebar", async () => {
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
    const empty = view.element.querySelector(".now-playing__empty");
    const error = view.element.querySelector(".now-playing__error");
    expect(empty.parentElement).toBe(view.element);
    expect(error.parentElement).toBe(view.element);
    expect(
      view.element.querySelector(".now-playing__sidebar-reveal-zone"),
    ).not.toBeNull();
    expect(
      view.element.querySelector(".now-playing__topbar-reveal-zone"),
    ).not.toBeNull();
    expect(sidebar.querySelector(".now-playing__brand-label").textContent).toBe(
      "nowPlaying.label",
    );
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
    ).toBe("nowPlaying.paused");
    view.dispose();
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
    expect(button.querySelector("i").classList.contains("fa-compress")).toBe(
      true,
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

    expect(brandLabel.textContent).toBe("nowPlaying.paused");
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
      .querySelector(
        '.now-playing__track[data-track-id="video"] [data-action="select-track"]',
      )
      .click();
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
    expect(HTMLMediaElement.prototype.pause).toHaveBeenCalled();
    view.dispose();
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
    backgroundButton.click();
    pinButton.click();
    jest.runAllTicks();
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
    jest.advanceTimersByTime(2500);
    expect(view.element.classList.contains("is-controls-visible")).toBe(false);

    view.element.dispatchEvent(new MouseEvent("mousemove", { bubbles: true }));
    expect(view.element.classList.contains("is-controls-visible")).toBe(true);
    const dock = view.element.querySelector(".now-playing__dock");
    dock.dispatchEvent(new MouseEvent("mouseenter"));
    jest.advanceTimersByTime(3000);
    expect(view.element.classList.contains("is-controls-visible")).toBe(true);
    expect(view.element.classList.contains("is-controls-locked")).toBe(true);

    dock.dispatchEvent(new MouseEvent("mouseleave"));
    jest.advanceTimersByTime(2500);
    expect(view.element.classList.contains("is-controls-visible")).toBe(false);
    view.element.querySelector('[data-action="play-pause"]').click();
    expect(view.element.classList.contains("is-controls-visible")).toBe(true);
    jest.advanceTimersByTime(3000);
    expect(view.element.classList.contains("is-controls-visible")).toBe(true);

    view.onHide();
    expect(view.element.classList.contains("is-controls-visible")).toBe(false);
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
    expect(
      view.element.querySelector('.now-playing__track[data-track-id="second"]'),
    ).toBeNull();
    view.element.querySelector('[data-action="clear"]').click();
    expect(view.element.querySelector(".now-playing__empty").hidden).toBe(
      false,
    );
    view.dispose();
  });
});
