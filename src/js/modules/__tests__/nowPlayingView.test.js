jest.mock("../i18n.js", () => ({
  applyI18n: jest.fn(),
  t: (key) => key,
}));

import { createNowPlayingView } from "../nowPlaying/nowPlayingView.js";

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
    jest.spyOn(HTMLMediaElement.prototype, "load").mockImplementation(() => {});
    jest
      .spyOn(HTMLMediaElement.prototype, "pause")
      .mockImplementation(() => {});
    jest.spyOn(HTMLMediaElement.prototype, "play").mockResolvedValue(undefined);
    jest.spyOn(window, "requestAnimationFrame").mockImplementation(() => 1);
    jest.spyOn(window, "cancelAnimationFrame").mockImplementation(() => {});
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

    expect(view.element.getAttribute("role")).toBe("tabpanel");
    expect(
      view.element.querySelectorAll(".now-playing__media-layer"),
    ).toHaveLength(2);
    expect(
      view.element.querySelector(".now-playing__track-title").textContent,
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
    expect(view.element.querySelector('[data-track-id="second"]')).toBeNull();
    view.element.querySelector('[data-action="clear"]').click();
    expect(view.element.querySelector(".now-playing__empty").hidden).toBe(
      false,
    );
    view.dispose();
  });
});
