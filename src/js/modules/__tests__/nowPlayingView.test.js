jest.mock("../i18n.js", () => ({
  applyI18n: jest.fn(),
  t: (key) => key,
}));
jest.mock("../modals.js", () => ({
  showConfirmationDialog: jest.fn().mockResolvedValue(true),
}));
jest.mock("../toast.js", () => ({
  showToast: jest.fn(),
}));

import { showConfirmationDialog } from "../modals.js";
import { showToast } from "../toast.js";
import { createNowPlayingView } from "../nowPlaying/nowPlayingView.js";
import {
  PLAYER_COMMANDS,
  PLAYER_SHORTCUT_COMMANDS,
} from "../nowPlaying/playerCommands.js";

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
    const hintedCommands = Array.from(
      view.element.querySelectorAll(
        "[data-shortcut-action], [data-shortcut-actions]",
      ),
    ).flatMap((element) =>
      (element.dataset.shortcutActions || element.dataset.shortcutAction).split(
        ",",
      ),
    );
    expect(new Set(hintedCommands)).toEqual(new Set(PLAYER_SHORTCUT_COMMANDS));
    expect(view.element.querySelector('[data-ui="brand-label"]')).toBeNull();
    expect(
      view.element.querySelector('[data-ui="topbar-title"]').textContent,
    ).toBe("Demo track");
    expect(
      view.element.querySelector('[data-ui="topbar-artist"]').textContent,
    ).toBe("Thunder");
    expect(
      view.element.querySelector('[data-ui="player-tab-menu"]'),
    ).not.toBeNull();
    expect(view.element.querySelector(".now-playing__header-title")).toBeNull();
    expect(view.element.querySelector(".now-playing__dock")).toBeNull();
    expect(
      view.element.querySelectorAll(
        '.now-playing__player-topbar [data-action="play-pause"]',
      ),
    ).toHaveLength(1);
    expect(
      view.element.querySelectorAll(
        '.now-playing__player-topbar [data-action="volume"]',
      ),
    ).toHaveLength(1);
    ["shuffle", "repeat", "fullscreen", "toggle-visualizer-settings"].forEach(
      (action) => {
        expect(
          view.element.querySelectorAll(
            `.now-playing__layout > [data-action="${action}"], .now-playing__player-menu [data-action="${action}"]`,
          ),
        ).toHaveLength(1);
      },
    );
    expect(
      view.element.querySelector('[data-ui="playback-controls"]'),
    ).not.toBeNull();
    expect(view.element.dataset.controlsPosition).toBe("top");
    expect(view.element.classList.contains("is-controls-bottom")).toBe(false);
    expect(
      view.element.querySelectorAll('[data-action="toggle-player-menu"]'),
    ).toHaveLength(1);
    expect(
      view.element.querySelectorAll(
        '[data-action^="placeholder-subtitles"], [data-action="placeholder-mini-player"], [data-action="placeholder-picture"], [data-action="placeholder-settings"]',
      ),
    ).toHaveLength(0);
    expect(view.element.querySelectorAll("[data-window-action]")).toHaveLength(
      2,
    );
    expect(
      view.element.querySelector(".now-playing__sidebar-toolbar"),
    ).not.toBeNull();
    const sidebarPlaylistSwitcher = view.element.querySelector(
      '[data-ui="sidebar-playlist-switcher"]',
    );
    expect(
      sidebarPlaylistSwitcher
        .closest(".now-playing__playlist-switcher")
        .querySelector('[data-i18n="nowPlaying.playlists.title"]'),
    ).not.toBeNull();
    expect(
      sidebarPlaylistSwitcher.querySelector('[data-ui="playlist-count"]')
        .textContent,
    ).toBe("1");
    expect(sidebarPlaylistSwitcher.lastElementChild.dataset.ui).toBe(
      "playlist-count",
    );
    expect(
      [...view.element.querySelectorAll('[data-ui="media-badges"] span')].map(
        (badge) => badge.textContent,
      ),
    ).toEqual(["1080p", "H.264", "AAC"]);
    expect(
      view.element.querySelector('[data-ui="media-size"]').textContent,
    ).toBe("3.2 GB");
    view.dispose();
  });

  test("provides keyboard navigation and focus restoration for the Player menu", async () => {
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
    const trigger = view.element.querySelector(
      '[data-action="toggle-player-menu"]',
    );
    const menu = view.element.querySelector('[data-ui="player-menu"]');

    trigger.click();
    expect(menu.hidden).toBe(false);
    expect(trigger.getAttribute("aria-expanded")).toBe("true");
    const items = [
      ...menu.querySelectorAll(
        '[role="menuitem"]:not([disabled]):not([hidden])',
      ),
    ];
    expect(document.activeElement).toBe(items[0]);

    items[0].dispatchEvent(
      new KeyboardEvent("keydown", { key: "ArrowDown", bubbles: true }),
    );
    expect(document.activeElement).toBe(items[1]);
    items[1].dispatchEvent(
      new KeyboardEvent("keydown", { key: "End", bubbles: true }),
    );
    expect(document.activeElement).toBe(items.at(-1));
    items
      .at(-1)
      .dispatchEvent(
        new KeyboardEvent("keydown", { key: "Escape", bubbles: true }),
      );

    expect(menu.hidden).toBe(true);
    expect(trigger.getAttribute("aria-expanded")).toBe("false");
    expect(document.activeElement).toBe(trigger);
    view.dispose();
  });

  test("uses a safe topbar artwork fallback when the cover fails", async () => {
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
    const artwork = view.element.querySelector('[data-ui="topbar-artwork"]');
    const shell = artwork.closest(".now-playing__topbar-artwork");

    expect(artwork.hidden).toBe(true);
    artwork.dispatchEvent(new Event("load"));
    expect(artwork.hidden).toBe(false);
    expect(shell.classList.contains("has-image")).toBe(true);

    artwork.dispatchEvent(new Event("error"));
    expect(artwork.hidden).toBe(true);
    expect(artwork.hasAttribute("src")).toBe(false);
    expect(shell.classList.contains("has-image")).toBe(false);
    expect(
      shell.querySelector('[data-ui="topbar-artwork-fallback"]'),
    ).not.toBeNull();
    view.dispose();
  });

  test("opens the sidebar Add menu with file, folder and YouTube actions", async () => {
    const dialog = installPlayerDialogFixture();
    const api = {
      getState: jest.fn().mockResolvedValue({
        data: { version: 3, catalog: { tracks: [] }, playlists: [] },
      }),
      setState: jest.fn().mockResolvedValue({ success: true }),
      importFiles: jest.fn(),
      importFolder: jest.fn().mockResolvedValue({
        success: true,
        data: { tracks: [] },
      }),
    };
    const view = createNowPlayingView({ api });
    document.body.appendChild(view.element);
    await view.ready;
    view.onShow();
    const trigger = view.element.querySelector(
      '[data-action="toggle-add-menu"]',
    );
    const menu = view.element.querySelector('[data-ui="sidebar-add-menu"]');

    expect(trigger.getAttribute("aria-label")).toBe("nowPlaying.add");
    expect(trigger.getAttribute("aria-haspopup")).toBe("menu");
    trigger.click();
    expect(menu.hidden).toBe(false);
    expect(trigger.getAttribute("aria-expanded")).toBe("true");
    expect(
      [...menu.querySelectorAll('[role="menuitem"]')].map(
        (item) => item.dataset.action,
      ),
    ).toEqual(["add-files", "add-folder", "open-youtube-dialog"]);
    expect(document.activeElement.dataset.action).toBe("add-files");

    document.activeElement.dispatchEvent(
      new KeyboardEvent("keydown", { key: "ArrowDown", bubbles: true }),
    );
    expect(document.activeElement.dataset.action).toBe("add-folder");
    document.activeElement.dispatchEvent(
      new KeyboardEvent("keydown", { key: "Escape", bubbles: true }),
    );
    expect(menu.hidden).toBe(true);
    expect(document.activeElement).toBe(trigger);

    trigger.click();
    menu.querySelector('[data-action="add-folder"]').click();
    await Promise.resolve();
    expect(api.importFolder).toHaveBeenCalledTimes(1);
    expect(menu.hidden).toBe(true);

    trigger.click();
    menu.querySelector('[data-action="open-youtube-dialog"]').click();
    expect(dialog.dataset.mode).toBe("youtubeUrl");
    expect(dialog.getAttribute("aria-hidden")).toBe("false");
    view.dispose();
  });

  test("offers a folder playlist and opens the created collection", async () => {
    const dialog = installPlayerDialogFixture();
    const api = {
      getState: jest.fn().mockResolvedValue({
        success: true,
        data: { version: 3, catalog: { tracks: [] }, playlists: [] },
      }),
      setState: jest.fn().mockResolvedValue({ success: true }),
      importFiles: jest.fn(),
      importFolder: jest.fn().mockResolvedValue({
        success: true,
        data: {
          tracks: [sampleTrack],
          importedTrackIds: [sampleTrack.id],
          folderName: "Thunder",
          folderTrackIds: [sampleTrack.id],
        },
      }),
    };
    const view = createNowPlayingView({ api });
    document.body.appendChild(view.element);
    await view.ready;

    view.element.querySelector('[data-action="add-folder"]').click();
    await new Promise((resolve) => setTimeout(resolve, 0));

    expect(view.element.querySelector(".now-playing__status").textContent).toBe(
      "",
    );
    expect(dialog.dataset.mode).toBe("folderPlaylist");
    expect(
      dialog.querySelector('[data-ui="player-form-modal-cancel"]').textContent,
    ).toBe("nowPlaying.folderChoice.libraryOnly");
    dialog
      .querySelector('[data-ui="player-form-modal-form"]')
      .dispatchEvent(new Event("submit", { bubbles: true, cancelable: true }));
    await Promise.resolve();
    await Promise.resolve();

    expect(
      view.element.querySelector('[data-ui="active-playlist-title"]')
        .textContent,
    ).toBe("Thunder");
    expect(view.element.querySelector('[data-ui="library-view"]').hidden).toBe(
      false,
    );
    view.dispose();
  });

  test("keeps an imported folder only in the library when the choice is closed", async () => {
    const dialog = installPlayerDialogFixture();
    const api = {
      getState: jest.fn().mockResolvedValue({
        success: true,
        data: { version: 3, catalog: { tracks: [] }, playlists: [] },
      }),
      setState: jest.fn().mockResolvedValue({ success: true }),
      importFiles: jest.fn(),
      importFolder: jest.fn().mockResolvedValue({
        success: true,
        data: {
          tracks: [sampleTrack],
          importedTrackIds: [sampleTrack.id],
          folderName: "Thunder",
          folderTrackIds: [sampleTrack.id],
        },
      }),
    };
    const view = createNowPlayingView({ api });
    document.body.appendChild(view.element);
    await view.ready;

    view.element.querySelector('[data-action="add-folder"]').click();
    await new Promise((resolve) => setTimeout(resolve, 0));
    dialog.dispatchEvent(
      new KeyboardEvent("keydown", { key: "Escape", bubbles: true }),
    );

    expect(dialog.getAttribute("aria-hidden")).toBe("true");
    expect(
      view.element.querySelectorAll(".player-library__playlist-card"),
    ).toHaveLength(3);
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
      dialog.querySelector('[data-ui="player-form-modal-info-title"]')
        .textContent,
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
    ).toBeNull();
    expect(sidebar.querySelector(".now-playing__brand-label")).toBeNull();
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
    view.onShow();
    const range = view.element.querySelector('[data-action="volume"]');
    const progress = view.element.querySelector('[data-action="seek"]');
    const percent = view.element.querySelector('[data-ui="volume-percent"]');
    const volumePopover = view.element.querySelector(
      '[data-ui="volume-popover"]',
    );
    const mute = view.element.querySelector('[data-action="mute"]');
    jest.useFakeTimers();

    expect(progress.hasAttribute("data-bs-toggle")).toBe(false);
    expect(progress.hasAttribute("title")).toBe(false);
    expect(progress.getAttribute("aria-label")).toBe("nowPlaying.seek");
    expect(percent.textContent).toBe("50%");
    expect(range.getAttribute("aria-valuetext")).toBe("50%");
    expect(range.hasAttribute("data-bs-toggle")).toBe(false);
    expect(range.hasAttribute("title")).toBe(false);
    expect(range.getAttribute("aria-label")).toBe("nowPlaying.volume");
    expect(mute.getAttribute("aria-label")).toBe("nowPlaying.mute");
    expect(volumePopover.closest(".now-playing__volume")).not.toBeNull();
    expect(volumePopover.contains(range)).toBe(true);
    expect(volumePopover.contains(percent)).toBe(true);
    expect(percent.getAttribute("aria-live")).toBe("polite");

    const wheelUp = new WheelEvent("wheel", {
      bubbles: true,
      cancelable: true,
      deltaY: -100,
    });
    percent.dispatchEvent(wheelUp);
    expect(wheelUp.defaultPrevented).toBe(true);
    expect(percent.textContent).toBe("55%");
    expect(range.value).toBe("0.55");
    expect(view.element.classList.contains("is-volume-feedback-visible")).toBe(
      true,
    );

    range.dispatchEvent(
      new WheelEvent("wheel", {
        bubbles: true,
        cancelable: true,
        deltaY: 100,
      }),
    );
    expect(percent.textContent).toBe("50%");
    jest.advanceTimersByTime(1000);
    expect(view.element.classList.contains("is-volume-feedback-visible")).toBe(
      true,
    );
    range.dispatchEvent(
      new WheelEvent("wheel", {
        bubbles: true,
        cancelable: true,
        deltaY: -100,
      }),
    );
    expect(percent.textContent).toBe("55%");
    jest.advanceTimersByTime(1000);
    expect(view.element.classList.contains("is-volume-feedback-visible")).toBe(
      true,
    );
    jest.advanceTimersByTime(500);
    expect(view.element.classList.contains("is-volume-feedback-visible")).toBe(
      false,
    );

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

    const sceneWheel = new WheelEvent("wheel", {
      bubbles: true,
      cancelable: true,
      deltaY: -100,
    });
    view.element
      .querySelector('[data-ui="player-stage"]')
      .dispatchEvent(sceneWheel);
    expect(sceneWheel.defaultPrevented).toBe(true);
    expect(percent.textContent).toBe("10%");

    range.value = "1";
    range.dispatchEvent(new Event("input", { bubbles: true }));
    expect(percent.textContent).toBe("100%");
    jest.advanceTimersByTime(1500);
    const boundaryWheel = new WheelEvent("wheel", {
      bubbles: true,
      cancelable: true,
      deltaY: -100,
    });
    percent.dispatchEvent(boundaryWheel);
    expect(boundaryWheel.defaultPrevented).toBe(true);
    expect(percent.textContent).toBe("100%");
    expect(view.element.classList.contains("is-volume-feedback-visible")).toBe(
      false,
    );

    view.element.querySelector('[data-action="show-library"]').click();
    const libraryWheel = new WheelEvent("wheel", {
      bubbles: true,
      cancelable: true,
      deltaY: -100,
    });
    view.element
      .querySelector('[data-ui="library-view"]')
      .dispatchEvent(libraryWheel);
    expect(libraryWheel.defaultPrevented).toBe(false);
    expect(percent.textContent).toBe("100%");
    view.dispose();
    jest.useRealTimers();
  });

  test("toggles playback with Space while leaving interactive controls alone", async () => {
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
    view.onShow();
    await Promise.resolve();
    HTMLMediaElement.prototype.play.mockClear();
    HTMLMediaElement.prototype.pause.mockClear();

    const pauseEvent = new KeyboardEvent("keydown", {
      key: " ",
      bubbles: true,
      cancelable: true,
    });
    view.element
      .querySelector('[data-ui="player-stage"]')
      .dispatchEvent(pauseEvent);
    expect(pauseEvent.defaultPrevented).toBe(true);
    expect(HTMLMediaElement.prototype.pause).toHaveBeenCalled();

    const playEvent = new KeyboardEvent("keydown", {
      key: " ",
      bubbles: true,
      cancelable: true,
    });
    view.element
      .querySelector('[data-ui="player-stage"]')
      .dispatchEvent(playEvent);
    await Promise.resolve();
    expect(playEvent.defaultPrevented).toBe(true);
    expect(HTMLMediaElement.prototype.play).toHaveBeenCalled();

    HTMLMediaElement.prototype.pause.mockClear();
    const interactiveEvent = new KeyboardEvent("keydown", {
      key: " ",
      bubbles: true,
      cancelable: true,
    });
    view.element
      .querySelector('[data-action="volume"]')
      .dispatchEvent(interactiveEvent);
    expect(interactiveEvent.defaultPrevented).toBe(false);
    expect(HTMLMediaElement.prototype.pause).not.toHaveBeenCalled();
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

  test("routes Player commands through one state-synchronized facade", async () => {
    installPlayerDialogFixture();
    const api = {
      getState: jest.fn().mockResolvedValue({
        data: {
          playlist: { tracks: [sampleTrack] },
          selectedTrackId: "demo",
          volume: 0.5,
          repeat: "off",
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

    await view.executeCommand(PLAYER_COMMANDS.SEEK_FORWARD);
    expect(view.element.querySelector('[data-action="seek"]').value).toBe("10");
    await view.executeCommand(PLAYER_COMMANDS.VOLUME_UP);
    expect(view.element.querySelector('[data-action="volume"]').value).toBe(
      "0.55",
    );
    await view.executeCommand(PLAYER_COMMANDS.TOGGLE_MUTE);
    expect(
      view.element
        .querySelector('[data-action="mute"]')
        .getAttribute("aria-pressed"),
    ).toBe("true");
    await view.executeCommand(PLAYER_COMMANDS.TOGGLE_SHUFFLE);
    expect(
      view.element
        .querySelector('[data-action="shuffle"]')
        .getAttribute("aria-pressed"),
    ).toBe("true");
    await view.executeCommand(PLAYER_COMMANDS.CYCLE_REPEAT);
    expect(
      view.element.querySelector('[data-action="repeat"]').dataset.mode,
    ).toBe("all");
    await view.executeCommand(PLAYER_COMMANDS.SHOW_CURRENT_MEDIA_INFO);
    expect(
      document.querySelector('[data-ui="player-form-modal"]').dataset.mode,
    ).toBe("trackInfo");
    await view.executeCommand(PLAYER_COMMANDS.STOP);
    expect(view.element.classList.contains("is-playing")).toBe(false);

    view.dispose();
  });

  test("toggles fullscreen on player-stage double click only while playing", async () => {
    const api = {
      getState: jest.fn().mockResolvedValue({
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
    view.onShow();
    await view.ready;

    const stage = view.element.querySelector('[data-ui="player-stage"]');
    const playButton = view.element.querySelector('[data-action="play-pause"]');
    window.electron.fullscreen.setState.mockClear();

    stage.dispatchEvent(new MouseEvent("dblclick", { bubbles: true }));
    await Promise.resolve();
    expect(window.electron.fullscreen.setState).toHaveBeenCalledWith(true);

    const fullscreenCalls =
      window.electron.fullscreen.setState.mock.calls.length;
    playButton.dispatchEvent(new MouseEvent("dblclick", { bubbles: true }));
    await Promise.resolve();
    expect(window.electron.fullscreen.setState).toHaveBeenCalledTimes(
      fullscreenCalls,
    );

    playButton.click();
    await Promise.resolve();
    stage.dispatchEvent(new MouseEvent("dblclick", { bubbles: true }));
    await Promise.resolve();
    expect(window.electron.fullscreen.setState).toHaveBeenCalledTimes(
      fullscreenCalls,
    );
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

    const fullscreenButton = view.element.querySelector(
      '[data-action="fullscreen"]',
    );
    fullscreenButton.setAttribute("aria-label", "stale");
    window.dispatchEvent(new CustomEvent("i18n:changed"));

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
    const activeVideo = view.element.querySelector(
      ".now-playing__video.is-visible",
    );
    Object.defineProperties(activeVideo, {
      readyState: { configurable: true, value: 1 },
      videoHeight: { configurable: true, value: 1080 },
      videoWidth: { configurable: true, value: 1920 },
    });
    activeVideo.dispatchEvent(new Event("loadedmetadata"));
    await new Promise((resolve) => setTimeout(resolve, 0));
    view.element.querySelector('[data-action="show-library"]').click();
    expect(
      view.element.querySelector('[data-ui="library-backdrop"]'),
    ).toBeNull();
    expect(
      view.element.querySelector('[data-ui="library-backdrop-cover"]'),
    ).toBeNull();
    view.dispose();
  });

  test("shows the visualizer for actual audio, persists its controls, and clears it for video", async () => {
    const gradient = { addColorStop: jest.fn() };
    const canvasContext = {
      arc: jest.fn(),
      beginPath: jest.fn(),
      clearRect: jest.fn(),
      createLinearGradient: jest.fn(() => gradient),
      fill: jest.fn(),
      fillRect: jest.fn(),
      restore: jest.fn(),
      save: jest.fn(),
      setTransform: jest.fn(),
    };
    jest
      .spyOn(HTMLCanvasElement.prototype, "getContext")
      .mockReturnValue(canvasContext);
    jest
      .spyOn(HTMLCanvasElement.prototype, "getBoundingClientRect")
      .mockReturnValue({ width: 900, height: 600 });
    const source = { connect: jest.fn(), disconnect: jest.fn() };
    const analyser = {
      connect: jest.fn(),
      disconnect: jest.fn(),
      getByteFrequencyData: jest.fn(),
    };
    class MockAudioContext {
      constructor() {
        this.destination = {};
        this.state = "running";
        this.createAnalyser = jest.fn(() => analyser);
        this.createMediaElementSource = jest.fn(() => source);
        this.close = jest.fn().mockResolvedValue(undefined);
        this.resume = jest.fn().mockResolvedValue(undefined);
      }
    }
    Object.defineProperty(window, "AudioContext", {
      configurable: true,
      value: MockAudioContext,
    });
    const videoTrack = {
      ...sampleTrack,
      id: "video-visualizer",
      sourceRef: "/music/video-visualizer.mp4",
      title: "Video",
      kind: "video",
    };
    const opusTrack = {
      ...sampleTrack,
      id: "opus-visualizer",
      sourceRef: "/music/opus-visualizer.webm",
      title: "Opus audio",
      kind: "video",
      mimeType: "audio/webm; codecs=opus",
      mediaInfo: {
        width: 0,
        height: 0,
        videoCodec: "",
        audioCodec: "opus",
      },
    };
    const api = {
      getState: jest.fn().mockResolvedValue({
        data: {
          playlist: { tracks: [sampleTrack, videoTrack, opusTrack] },
          selectedTrackId: sampleTrack.id,
          visualizer: {
            colorScheme: "blue",
            style: "normal",
            sensitivity: 1.2,
            smoothing: 0.7,
            barCount: 72,
            particles: false,
            reflection: true,
          },
        },
      }),
      setState: jest.fn().mockResolvedValue({ success: true }),
      updateSettings: jest.fn(async ({ visualizer }) => ({
        success: true,
        data: { visualizer },
      })),
      importFiles: jest.fn(),
      importFolder: jest.fn(),
    };
    const view = createNowPlayingView({ api });
    document.body.appendChild(view.element);
    await view.ready;
    const activeAudio = view.element.querySelector(
      '.now-playing__video[data-track-id="demo"]',
    );
    Object.defineProperties(activeAudio, {
      readyState: { configurable: true, value: 1 },
      videoHeight: { configurable: true, value: 0 },
      videoWidth: { configurable: true, value: 0 },
    });
    activeAudio.dispatchEvent(new Event("loadedmetadata"));
    await Promise.resolve();
    await Promise.resolve();

    expect(
      view.element.querySelector('[data-ui="audio-visualizer"]').hidden,
    ).toBe(false);
    const visualizerToggle = view.element.querySelector(
      '.now-playing__player-menu [data-action="toggle-visualizer-settings"]',
    );
    const visualizerPanel = view.element.querySelector(
      '[data-ui="visualizer-panel"]',
    );
    const visualizerDetails = view.element.querySelector(
      '[data-ui="visualizer-details"]',
    );
    expect(visualizerToggle.hidden).toBe(false);
    expect(visualizerToggle.getAttribute("aria-expanded")).toBe("false");
    expect(visualizerPanel.hidden).toBe(true);
    expect(visualizerDetails.hidden).toBe(true);

    visualizerToggle.click();
    expect(visualizerToggle.getAttribute("aria-expanded")).toBe("true");
    expect(visualizerPanel.hidden).toBe(false);
    expect(visualizerDetails.hidden).toBe(false);
    expect(view.element.classList.contains("is-visualizer-settings-open")).toBe(
      true,
    );

    visualizerToggle.click();
    expect(visualizerToggle.getAttribute("aria-expanded")).toBe("false");
    expect(visualizerPanel.hidden).toBe(true);
    visualizerToggle.click();
    expect(
      view.element.querySelector('[data-visualizer-setting="colorScheme"]')
        .value,
    ).toBe("blue");

    const color = view.element.querySelector(
      '[data-visualizer-setting="colorScheme"]',
    );
    color.value = "pink";
    color.dispatchEvent(new Event("change", { bubbles: true }));
    await Promise.resolve();
    await Promise.resolve();
    expect(api.updateSettings).toHaveBeenLastCalledWith({
      visualizer: expect.objectContaining({ colorScheme: "pink" }),
    });
    view.element
      .querySelector('[data-action="reset-visualizer-settings"]')
      .click();
    await Promise.resolve();
    await Promise.resolve();
    expect(api.updateSettings).toHaveBeenLastCalledWith({
      visualizer: expect.objectContaining({
        colorScheme: "gradient",
        style: "glow",
        sensitivity: 1,
        smoothing: 0.8,
        barCount: 64,
        particles: true,
        reflection: true,
      }),
    });
    api.updateSettings.mockResolvedValueOnce({
      success: false,
      error: { message: "Visualizer save failed" },
    });
    color.value = "blue";
    color.dispatchEvent(new Event("change", { bubbles: true }));
    await Promise.resolve();
    await Promise.resolve();
    expect(color.value).toBe("gradient");

    view.element
      .querySelector('.now-playing__track[data-track-id="video-visualizer"]')
      .dispatchEvent(new MouseEvent("dblclick", { bubbles: true }));
    await new Promise((resolve) => setTimeout(resolve, 0));
    expect(visualizerToggle.hidden).toBe(true);
    expect(visualizerPanel.hidden).toBe(true);
    const activeVideo = view.element.querySelector(
      '.now-playing__video[data-track-id="video-visualizer"]',
    );
    Object.defineProperties(activeVideo, {
      readyState: { configurable: true, value: 1 },
      videoHeight: { configurable: true, value: 1080 },
      videoWidth: { configurable: true, value: 1920 },
    });
    activeVideo.dispatchEvent(new Event("loadedmetadata"));

    expect(
      view.element.querySelector('[data-ui="audio-visualizer"]').hidden,
    ).toBe(true);
    expect(visualizerToggle.hidden).toBe(true);
    expect(visualizerPanel.hidden).toBe(true);
    expect(visualizerToggle.getAttribute("aria-expanded")).toBe("false");
    expect(canvasContext.clearRect).toHaveBeenCalled();

    view.element
      .querySelector('.now-playing__track[data-track-id="opus-visualizer"]')
      .dispatchEvent(new MouseEvent("dblclick", { bubbles: true }));
    await new Promise((resolve) => setTimeout(resolve, 0));
    const activeOpus = view.element.querySelector(
      '.now-playing__video[data-track-id="opus-visualizer"]',
    );
    Object.defineProperties(activeOpus, {
      readyState: { configurable: true, value: 1 },
      videoHeight: { configurable: true, value: 0 },
      videoWidth: { configurable: true, value: 0 },
    });
    activeOpus.dispatchEvent(new Event("loadedmetadata"));
    await Promise.resolve();
    await Promise.resolve();

    expect(
      view.element.querySelector('[data-ui="audio-visualizer"]').hidden,
    ).toBe(false);
    expect(visualizerToggle.hidden).toBe(false);
    expect(view.element.classList.contains("has-audio-visualizer")).toBe(true);
    view.dispose();
    expect(source.disconnect).toHaveBeenCalled();
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

  test("restores and persists Player panel preferences", async () => {
    jest.useFakeTimers();
    const api = {
      getState: jest.fn().mockResolvedValue({
        data: {
          playlist: { tracks: [sampleTrack] },
          selectedTrackId: "demo",
          backgroundPlayback: false,
          sidebarPinned: true,
          controlsPosition: "bottom",
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
    const pinButtons = [
      ...view.element.querySelectorAll('[data-action="pin-sidebar"]'),
    ];
    const [sidebarPinButton] = pinButtons;
    const positionButton = view.element.querySelector(
      '[data-action="toggle-controls-position"]',
    );

    expect(backgroundButton.getAttribute("aria-pressed")).toBe("false");
    expect(pinButtons).toHaveLength(2);
    pinButtons.forEach((button) => {
      expect(button.getAttribute("aria-pressed")).toBe("true");
    });
    expect(
      sidebarPinButton.closest(".now-playing__sidebar-toolbar"),
    ).not.toBeNull();
    expect(sidebarPinButton.getAttribute("aria-label")).toBe(
      "nowPlaying.pinSidebar",
    );
    expect(positionButton.getAttribute("aria-pressed")).toBe("true");
    expect(positionButton.textContent).toContain(
      "nowPlaying.controlsPosition.moveTop",
    );
    expect(view.element.dataset.controlsPosition).toBe("bottom");
    expect(view.element.classList.contains("is-controls-bottom")).toBe(true);
    expect(
      view.element
        .querySelector('[data-action="play-pause"]')
        .getAttribute("data-bs-placement"),
    ).toBe("top");
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
    HTMLMediaElement.prototype.pause.mockClear();
    backgroundButton.click();
    sidebarPinButton.click();
    positionButton.click();
    expect(HTMLMediaElement.prototype.pause).not.toHaveBeenCalled();
    jest.advanceTimersByTime(250);
    await Promise.resolve();
    await Promise.resolve();
    expect(backgroundButton.getAttribute("aria-pressed")).toBe("true");
    pinButtons.forEach((button) => {
      expect(button.getAttribute("aria-pressed")).toBe("false");
    });
    expect(positionButton.getAttribute("aria-pressed")).toBe("false");
    expect(positionButton.textContent).toContain(
      "nowPlaying.controlsPosition.moveBottom",
    );
    expect(view.element.dataset.controlsPosition).toBe("top");
    expect(view.element.classList.contains("is-controls-bottom")).toBe(false);
    expect(
      view.element
        .querySelector('[data-action="play-pause"]')
        .getAttribute("data-bs-placement"),
    ).toBe("bottom");
    expect(api.setState).toHaveBeenLastCalledWith(
      expect.objectContaining({
        backgroundPlayback: true,
        sidebarPinned: false,
        controlsPosition: "top",
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
          controlsPosition: "top",
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
          controlsPosition: "bottom",
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
    expect(view.element.classList.contains("is-controls-bottom")).toBe(true);
    expect(
      view.element
        .querySelector('[data-action="toggle-controls-position"]')
        .getAttribute("aria-pressed"),
    ).toBe("true");
    expect(
      view.element
        .querySelector('[data-action="shuffle"]')
        .getAttribute("aria-pressed"),
    ).toBe("true");
    expect(
      view.element.querySelector('[data-action="repeat"]').dataset.mode,
    ).toBe("all");
    expect(view.element.querySelector('[data-action="volume"]').value).toBe(
      "0",
    );
    expect(settingsState).toHaveBeenCalledTimes(1);

    jest.advanceTimersByTime(250);
    await Promise.resolve();
    await Promise.resolve();
    expect(api.setState).toHaveBeenLastCalledWith(
      expect.objectContaining({
        sidebarPinned: true,
        backgroundPlayback: false,
        controlsPosition: "bottom",
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

  test("lists local audio tracks and persists an exact selection", async () => {
    jest.useFakeTimers();
    const api = {
      getState: jest.fn().mockResolvedValue({
        data: {
          playlist: { tracks: [sampleTrack] },
          selectedTrackId: "demo",
        },
      }),
      setState: jest.fn().mockResolvedValue({ success: true }),
      getAudioTracks: jest.fn().mockResolvedValue({
        success: true,
        data: {
          trackId: "demo",
          selectedAudioTrackId: null,
          tracks: [
            {
              id: "audio-1",
              order: 0,
              title: "Original",
              language: "eng",
              codec: "aac",
              channels: 2,
              isDefault: true,
            },
            {
              id: "audio-2",
              order: 1,
              title: "Дубляж",
              language: "rus",
              codec: "aac",
              channels: 6,
              isDefault: false,
            },
          ],
        },
      }),
      createLocalPlaybackSession: jest.fn(),
      closePlaybackSession: jest.fn().mockResolvedValue({ success: true }),
      importFiles: jest.fn(),
      importFolder: jest.fn(),
    };
    const view = createNowPlayingView({ api });
    document.body.appendChild(view.element);
    await view.ready;
    const activeMedia = [
      ...view.element.querySelectorAll(".now-playing__video"),
    ].find((media) => media.dataset.trackId === "demo");
    const nativeAudioTracks = [{ enabled: true }, { enabled: false }];
    Object.defineProperty(activeMedia, "audioTracks", {
      configurable: true,
      value: nativeAudioTracks,
    });
    activeMedia.currentTime = 36;
    HTMLMediaElement.prototype.load.mockClear();
    HTMLMediaElement.prototype.play.mockClear();
    api.setState.mockClear();

    const trigger = view.element.querySelector(
      '.now-playing__player-menu [data-action="toggle-audio-tracks"]',
    );
    trigger.click();
    await Promise.resolve();
    await Promise.resolve();

    const menu = view.element.querySelector('[data-ui="audio-track-menu"]');
    const options = [
      ...menu.querySelectorAll('[data-action="select-audio-track"]'),
    ];
    expect(api.getAudioTracks).toHaveBeenCalledWith({ trackId: "demo" });
    expect(menu.hidden).toBe(false);
    expect(options).toHaveLength(3);
    expect(options[0].getAttribute("aria-selected")).toBe("true");
    expect(options[2].textContent).toContain("Дубляж");

    options[0].focus();
    options[0].dispatchEvent(
      new KeyboardEvent("keydown", { key: "ArrowDown", bubbles: true }),
    );
    expect(document.activeElement).toBe(options[1]);

    options[2].click();
    for (let index = 0; index < 12; index += 1) {
      await Promise.resolve();
    }

    expect(api.createLocalPlaybackSession).not.toHaveBeenCalled();
    expect(nativeAudioTracks.map((track) => track.enabled)).toEqual([
      false,
      true,
    ]);
    expect(activeMedia.currentTime).toBe(36);
    expect(HTMLMediaElement.prototype.load).not.toHaveBeenCalled();
    expect(HTMLMediaElement.prototype.play).not.toHaveBeenCalled();
    expect(menu.hidden).toBe(true);
    jest.advanceTimersByTime(250);
    await Promise.resolve();
    await Promise.resolve();
    expect(api.setState).toHaveBeenLastCalledWith(
      expect.objectContaining({
        catalog: {
          tracks: [
            expect.objectContaining({
              id: "demo",
              selectedAudioTrackId: "audio-2",
            }),
          ],
        },
      }),
    );
    view.dispose();
    jest.useRealTimers();
  });

  test("blocks audio selection when native and probed track counts differ", async () => {
    const api = {
      getState: jest.fn().mockResolvedValue({
        data: {
          playlist: { tracks: [sampleTrack] },
          selectedTrackId: "demo",
        },
      }),
      setState: jest.fn().mockResolvedValue({ success: true }),
      getAudioTracks: jest.fn().mockResolvedValue({
        success: true,
        data: {
          trackId: "demo",
          tracks: [
            {
              id: "audio-2",
              order: 0,
              title: "Dub",
              codec: "ac3",
              channels: 6,
            },
          ],
        },
      }),
      createLocalPlaybackSession: jest.fn(),
      importFiles: jest.fn(),
      importFolder: jest.fn(),
    };
    const view = createNowPlayingView({ api });
    document.body.appendChild(view.element);
    await view.ready;
    const activeMedia = [
      ...view.element.querySelectorAll(".now-playing__video"),
    ].find((media) => media.dataset.trackId === "demo");
    Object.defineProperty(activeMedia, "audioTracks", {
      configurable: true,
      value: [{ enabled: true }, { enabled: false }],
    });

    view.element
      .querySelector(
        '.now-playing__player-menu [data-action="toggle-audio-tracks"]',
      )
      .click();
    await Promise.resolve();
    await Promise.resolve();
    expect(
      view.element.querySelector('[data-ui="audio-track-menu"]').hidden,
    ).toBe(false);
    expect(
      view.element.querySelector('[data-ui="audio-track-status"]').textContent,
    ).toBe("nowPlaying.audioTracks.nativeMismatch");
    expect(
      view.element.querySelector('[data-action="select-audio-track"]').disabled,
    ).toBe(true);
    expect(api.createLocalPlaybackSession).not.toHaveBeenCalled();
    view.dispose();
  });

  test("keeps audio track selection unavailable for YouTube media", async () => {
    const youtubeTrack = {
      ...sampleTrack,
      id: "youtube:abcdefghijk",
      providerId: "youtube",
      sourceRef: "https://www.youtube.com/watch?v=abcdefghijk",
    };
    const api = {
      getState: jest.fn().mockResolvedValue({
        data: {
          playlist: { tracks: [youtubeTrack] },
          selectedTrackId: youtubeTrack.id,
        },
      }),
      setState: jest.fn().mockResolvedValue({ success: true }),
      getAudioTracks: jest.fn(),
      importFiles: jest.fn(),
      importFolder: jest.fn(),
    };
    const view = createNowPlayingView({ api });
    document.body.appendChild(view.element);
    await view.ready;
    const trigger = view.element.querySelector(
      '.now-playing__player-menu [data-action="toggle-audio-tracks"]',
    );

    expect(trigger.getAttribute("aria-disabled")).toBe("true");
    trigger.click();
    expect(api.getAudioTracks).not.toHaveBeenCalled();
    expect(
      view.element.querySelector('[data-ui="audio-track-menu"]').hidden,
    ).toBe(true);
    view.dispose();
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
    expect(firstArtwork.hidden).toBe(true);
    firstArtwork.dispatchEvent(new Event("load"));
    expect(firstArtwork.hidden).toBe(false);
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
    expect(secondArtwork.hidden).toBe(true);
    secondArtwork.dispatchEvent(new Event("load"));
    expect(secondArtwork.hidden).toBe(false);
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
      view.element.querySelector(
        '.now-playing__artwork-fallback [data-lucide="music-2"]',
      ),
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
    const miniArtwork = view.element.querySelector('[data-ui="mini-artwork"]');
    miniArtwork.dispatchEvent(new Event("error"));

    const activeMetadata = view.element.querySelector(
      ".now-playing__metadata-slot.is-active",
    );
    expect(artwork.hidden).toBe(true);
    expect(artwork.hasAttribute("src")).toBe(false);
    expect(artwork.classList.contains("is-loaded")).toBe(false);
    expect(miniArtwork.hidden).toBe(true);
    expect(miniArtwork.hasAttribute("src")).toBe(false);
    expect(
      miniArtwork
        .closest(".player-library__mini-artwork")
        .classList.contains("has-artwork"),
    ).toBe(false);
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
    expect(showToast).toHaveBeenCalledWith(
      "nowPlaying.toast.filesAdded",
      "success",
    );
    view.dispose();
  });

  test("shows an error toast when importing files fails", async () => {
    const api = {
      getState: jest.fn().mockResolvedValue({
        data: { version: 3, catalog: { tracks: [] }, playlists: [] },
      }),
      setState: jest.fn().mockResolvedValue({ success: true }),
      importFiles: jest.fn().mockRejectedValue(new Error("Import failed")),
      importFolder: jest.fn(),
    };
    const view = createNowPlayingView({ api });
    document.body.appendChild(view.element);
    await view.ready;

    view.element.querySelector('[data-action="add-files"]').click();
    await Promise.resolve();
    await Promise.resolve();

    expect(showToast).toHaveBeenCalledWith("Import failed", "error");
    expect(view.element.querySelector(".now-playing__status").textContent).toBe(
      "Import failed",
    );
    view.dispose();
  });

  test("announces only a natural end of the final playlist item", async () => {
    const api = {
      getState: jest.fn().mockResolvedValue({
        data: {
          version: 3,
          catalog: { tracks: [sampleTrack] },
          playlists: [],
          selectedTrackId: sampleTrack.id,
          repeat: "off",
        },
      }),
      setState: jest.fn().mockResolvedValue({ success: true }),
      importFiles: jest.fn(),
      importFolder: jest.fn(),
    };
    const view = createNowPlayingView({ api });
    document.body.appendChild(view.element);
    await view.ready;
    showToast.mockClear();

    view.element
      .querySelectorAll(".now-playing__video")
      .forEach((media) => media.dispatchEvent(new Event("ended")));

    expect(showToast).toHaveBeenCalledWith(
      "nowPlaying.toast.playlistFinished",
      "info",
    );
    showToast.mockClear();
    await view.executeCommand(PLAYER_COMMANDS.NEXT);
    expect(showToast).not.toHaveBeenCalled();

    await view.executeCommand(PLAYER_COMMANDS.CYCLE_REPEAT);
    view.element
      .querySelectorAll(".now-playing__video")
      .forEach((media) => media.dispatchEvent(new Event("ended")));
    expect(showToast).not.toHaveBeenCalled();
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
    const topbar = view.element.querySelector(".now-playing__player-topbar");
    topbar.dispatchEvent(new MouseEvent("mouseenter"));
    jest.advanceTimersByTime(3000);
    expect(view.element.classList.contains("is-controls-visible")).toBe(true);
    expect(view.element.classList.contains("is-controls-locked")).toBe(true);

    topbar.dispatchEvent(new MouseEvent("mouseleave"));
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
    expect(view.element.querySelector('[data-ui="library-empty"]').hidden).toBe(
      false,
    );
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
      view.element.querySelectorAll(
        '[data-ui="library-tracks"] [data-track-id]',
      ),
    ).toHaveLength(0);
    expect(view.element.querySelector('[data-ui="library-empty"]').hidden).toBe(
      false,
    );
    expect(clearButton.disabled).toBe(true);
    view.dispose();
  });

  test("clears only filtered items from the system Media Library", async () => {
    const videoTrack = {
      ...sampleTrack,
      id: "video",
      sourceRef: "/video/episode.mkv",
      title: "Episode",
      kind: "video",
    };
    const api = {
      getState: jest.fn().mockResolvedValue({
        data: {
          version: 3,
          catalog: { tracks: [sampleTrack, videoTrack] },
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
    view.element
      .querySelector('[data-action="set-library-filter"][data-filter="video"]')
      .click();
    view.element.querySelector('[data-action="clear-media-library"]').click();
    await Promise.resolve();
    await Promise.resolve();

    expect(showConfirmationDialog).toHaveBeenCalledWith(
      expect.objectContaining({
        message: "nowPlaying.library.clearFilteredQueueConfirm",
        confirmText: "nowPlaying.library.clearFilteredQueueAction",
      }),
    );
    expect(
      view.element.querySelector(
        '[data-ui="library-tracks"] [data-track-id="video"]',
      ),
    ).toBeNull();
    expect(
      view.element.querySelector(
        '[data-ui="library-tracks"] [data-track-id="demo"]',
      ),
    ).not.toBeNull();
    expect(showToast).toHaveBeenCalledWith(
      "nowPlaying.toast.libraryItemsRemoved",
      "success",
    );
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
    expect(
      library.querySelector(".player-library__command-bar"),
    ).not.toBeNull();
    expect(
      library.querySelector(".player-library__column-header"),
    ).not.toBeNull();
    expect(library.querySelector('[data-filter="audio"]').hidden).toBe(false);
    expect(library.querySelector('[data-filter="video"]').hidden).toBe(true);
    expect(library.querySelector('[data-filter="missing"]').hidden).toBe(true);
    expect(
      library.querySelector('[data-ui="library-more-filters"]').hidden,
    ).toBe(true);
    expect(
      library.querySelector('[data-ui="library-search-clear"] [data-lucide]')
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
      [
        ...library.querySelectorAll(".player-library__filters [data-lucide]"),
      ].map((icon) => icon.dataset.lucide),
    ).toEqual(["layout-grid", "clapperboard", "music-2", "list-video"]);
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
      library.querySelector('[data-action="open-rename-playlist-dialog"]')
        .hidden,
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
    ).toHaveLength(4);
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
    expect(library.querySelector('[data-ui="mini-kind"]').textContent).toBe(
      "nowPlaying.audio",
    );
    expect(library.querySelector(".player-library__return")).toBeNull();
    expect(
      library
        .querySelector('[data-ui="mini-player"] [data-action="show-player"]')
        .getAttribute("aria-label"),
    ).toBe("nowPlaying.library.openFullPlayer");
    expect(
      library
        .querySelector('[data-ui="mini-player"] [data-action="show-player"] i')
        .getAttribute("data-lucide"),
    ).toBe("arrow-right");
    expect(library.querySelector('[data-action="seek"]').max).toBe("90");
    expect(library.querySelector('[data-ui="mini-duration"]').textContent).toBe(
      "1:30",
    );
    expect(
      library
        .querySelector('[data-action="volume"]')
        .getAttribute("aria-valuetext"),
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
    ).toEqual([
      "media-library",
      "smart:recent",
      "smart:favorites",
      "favorites",
    ]);
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
    view.element.querySelector('[data-context-action="queue"]').click();
    expect(showToast).toHaveBeenCalledWith(
      "nowPlaying.toast.addedToQueue",
      "success",
    );
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
      library.querySelector('[data-action="open-rename-playlist-dialog"]')
        .hidden,
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

  test("can remove playlist files from the media library when deleting it", async () => {
    const secondTrack = {
      ...sampleTrack,
      id: "second",
      sourceRef: "/music/second.mp3",
      title: "Second track",
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
              trackIds: [sampleTrack.id],
            },
            {
              id: "shared",
              title: "Shared",
              trackIds: [sampleTrack.id, secondTrack.id],
            },
          ],
          activePlaylistId: "media-library",
          selectedTrackId: sampleTrack.id,
        },
      }),
      setState: jest.fn().mockResolvedValue({ success: true }),
      importFiles: jest.fn(),
      importFolder: jest.fn(),
    };
    showConfirmationDialog.mockResolvedValueOnce("playlist-and-library");
    const view = createNowPlayingView({ api });
    document.body.appendChild(view.element);
    await view.ready;
    view.element.querySelector('[data-action="show-library"]').click();
    const library = view.element.querySelector('[data-ui="library-view"]');

    library
      .querySelector(
        '.player-library__playlist-card[data-playlist-id="favorites"]',
      )
      .click();
    library.querySelector('[data-action="delete-playlist"]').click();
    await Promise.resolve();
    await Promise.resolve();

    expect(showConfirmationDialog).toHaveBeenCalledWith(
      expect.objectContaining({
        choices: [
          expect.objectContaining({ value: "playlist-only" }),
          expect.objectContaining({ value: "playlist-and-library" }),
        ],
        defaultChoice: "playlist-only",
      }),
    );
    expect(
      library.querySelector(
        '.player-library__playlist-card[data-playlist-id="favorites"]',
      ),
    ).toBeNull();
    expect(
      library.querySelector('.player-library__track[data-track-id="demo"]'),
    ).toBeNull();
    expect(
      library.querySelector('.player-library__track[data-track-id="second"]'),
    ).not.toBeNull();
    expect(showToast).toHaveBeenCalledWith(
      "nowPlaying.toast.playlistAndMediaDeleted",
      "success",
    );

    library
      .querySelector(
        '.player-library__playlist-card[data-playlist-id="shared"]',
      )
      .click();
    expect(
      library.querySelector('.player-library__track[data-track-id="demo"]'),
    ).toBeNull();
    expect(library.querySelectorAll(".player-library__track")).toHaveLength(1);
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
    expect(currentPoster.hidden).toBe(true);
    currentPoster.dispatchEvent(new Event("load"));
    expect(currentPoster.hidden).toBe(false);
    expect(currentPoster.src).toBe("data:image/jpeg;base64,eager-poster");
    const topbarPoster = view.element.querySelector(
      '[data-ui="topbar-artwork"]',
    );
    expect(topbarPoster.src).toBe("data:image/jpeg;base64,eager-poster");
    topbarPoster.dispatchEvent(new Event("load"));
    expect(topbarPoster.hidden).toBe(false);
    const miniPoster = view.element.querySelector('[data-ui="mini-artwork"]');
    expect(miniPoster.hidden).toBe(false);
    expect(miniPoster.src).toBe("data:image/jpeg;base64,eager-poster");
    const library = view.element.querySelector('[data-ui="library-view"]');
    expect(
      library.querySelector('[data-ui="library-backdrop-cover"]'),
    ).toBeNull();
    expect(library.querySelector('[data-ui="library-backdrop"]')).toBeNull();
    expect(library.querySelector('[data-filter="video"]').hidden).toBe(false);
    expect(library.querySelector('[data-filter="audio"]').hidden).toBe(true);
    expect(library.querySelector('[data-filter="missing"]').hidden).toBe(true);
    expect(
      library.querySelector('[data-ui="library-more-filters"]').hidden,
    ).toBe(true);
    view.dispose();
  });

  test("keeps the sidebar fallback visible when a generated poster fails", async () => {
    const videoTrack = {
      ...sampleTrack,
      id: "broken-poster-video",
      sourceRef: "/video/broken-poster.mkv",
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
          dataUrl: "data:image/jpeg;base64,broken-poster",
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

    const poster = view.element.querySelector('[data-ui="generated-poster"]');
    const topbarPoster = view.element.querySelector(
      '[data-ui="topbar-artwork"]',
    );
    poster.dispatchEvent(new Event("error"));
    topbarPoster.dispatchEvent(new Event("error"));

    expect(poster.hidden).toBe(true);
    expect(poster.hasAttribute("src")).toBe(false);
    expect(view.element.classList.contains("has-generated-poster")).toBe(false);
    expect(topbarPoster.hidden).toBe(true);
    expect(topbarPoster.hasAttribute("src")).toBe(false);
    expect(
      view.element.querySelector(".now-playing__artwork-fallback").hidden,
    ).toBe(false);
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
    expect(library.querySelector('[data-filter="audio"]').hidden).toBe(false);
    expect(library.querySelector('[data-filter="video"]').hidden).toBe(false);
    expect(library.querySelector('[data-filter="missing"]').hidden).toBe(false);
    expect(
      library.querySelector('[data-ui="library-more-filters"]').hidden,
    ).toBe(false);

    search.value = "season one";
    search.dispatchEvent(new Event("input", { bubbles: true }));
    expect(
      library.querySelector('[data-ui="library-search-clear"]').hidden,
    ).toBe(false);
    expect(library.querySelectorAll(".player-library__track")).toHaveLength(1);
    expect(
      library.querySelector(".player-library__track").dataset.trackId,
    ).toBe("video");

    library
      .querySelector('[data-action="set-library-filter"][data-filter="audio"]')
      .click();
    expect(library.querySelector('[data-ui="library-tracks"]').hidden).toBe(
      true,
    );
    expect(library.querySelector('[data-ui="library-no-results"]').hidden).toBe(
      false,
    );

    library.querySelector('[data-action="clear-library-search"]').click();
    expect(search.value).toBe("");
    expect(
      library.querySelector('[data-filter="all"]').getAttribute("aria-pressed"),
    ).toBe("true");
    expect(library.querySelectorAll(".player-library__track")).toHaveLength(3);

    library
      .querySelector(
        '[data-action="set-library-filter"][data-filter="missing"]',
      )
      .click();
    expect(library.querySelectorAll(".player-library__track")).toHaveLength(1);
    expect(library.querySelector(".player-library__track").classList).toContain(
      "is-missing",
    );
    expect(library.querySelector('[data-ui="mini-title"]').textContent).toBe(
      "Demo track",
    );

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

  test("switches playlists from the library and sidebar without interrupting playback", async () => {
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
      '[data-ui="playback-controls"] [data-action="play-pause"]',
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

    expect(HTMLMediaElement.prototype.pause).not.toHaveBeenCalled();
    expect(HTMLMediaElement.prototype.play).not.toHaveBeenCalled();
    expect(
      view.element.querySelector(".now-playing__track.is-current"),
    ).toBeNull();
    expect(
      [...view.element.querySelectorAll(".now-playing__track")].map(
        (row) => row.dataset.trackId,
      ),
    ).toEqual(["second"]);
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

    expect(HTMLMediaElement.prototype.pause).not.toHaveBeenCalled();
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
        version: 4,
        activePlaylistId: "media-library",
        playlists: expect.arrayContaining([
          expect.objectContaining({ title: "Road trip" }),
        ]),
      }),
    );
    expect(showToast).toHaveBeenCalledWith(
      "nowPlaying.toast.playlistCreated",
      "success",
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
    expect(showToast).toHaveBeenCalledWith(
      "nowPlaying.toast.linkAdded",
      "success",
    );
    expect(
      view.element.querySelector('[data-ui="library-operation-status"]').hidden,
    ).toBe(true);
    expect(view.element.querySelector(".now-playing__status").textContent).toBe(
      "",
    );
    view.dispose();
    jest.useRealTimers();
  });

  test("browses and searches user playlists from the segmented filter", async () => {
    const api = {
      getState: jest.fn().mockResolvedValue({
        data: {
          version: 4,
          catalog: { tracks: [sampleTrack] },
          playlists: [
            { id: "road", title: "Road trip", trackIds: [sampleTrack.id] },
            { id: "focus", title: "Focus", trackIds: [] },
          ],
          activePlaylistId: "media-library",
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
    view.element.querySelector('[data-action="show-library"]').click();
    const library = view.element.querySelector('[data-ui="library-view"]');

    library.querySelector('[data-filter="playlists"]').click();
    expect(
      library.querySelectorAll('[data-ui="library-playlist-browser"] > button'),
    ).toHaveLength(2);
    const search = library.querySelector('[data-ui="library-search"]');
    search.value = "road";
    search.dispatchEvent(new Event("input", { bubbles: true }));
    expect(
      library.querySelectorAll('[data-ui="library-playlist-browser"] > button'),
    ).toHaveLength(1);
    library
      .querySelector(
        '[data-ui="library-playlist-browser"] [data-playlist-id="road"]',
      )
      .click();
    expect(library.querySelector('[data-filter="all"]').ariaPressed).toBe(
      "true",
    );
    expect(
      library.querySelector('[data-ui="active-playlist-title"]').textContent,
    ).toBe("Road trip");
    view.dispose();
  });

  test("toggles a favorite through the shared track context menu", async () => {
    const api = {
      getState: jest.fn().mockResolvedValue({
        data: {
          version: 4,
          catalog: { tracks: [sampleTrack] },
          playlists: [],
          activePlaylistId: "media-library",
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
    view.element.querySelector('[data-action="show-library"]').click();
    view.element
      .querySelector('[data-action="open-track-context-menu"]')
      .click();
    const favoriteAction = view.element.querySelector(
      '[data-context-action="favorite"]',
    );
    expect(favoriteAction.textContent).toContain(
      "nowPlaying.library.favorite.add",
    );
    favoriteAction.click();
    view.element.querySelector('[data-playlist-id="smart:favorites"]').click();
    expect(
      view.element.querySelector(
        '.player-library__track[data-track-id="demo"]',
      ),
    ).not.toBeNull();
    expect(showToast).toHaveBeenCalledWith(
      "nowPlaying.toast.favoriteAdded",
      "success",
    );
    view.dispose();
  });

  test("opens the compact collections drawer and restores focus on Escape", async () => {
    const originalMatchMedia = window.matchMedia;
    const mediaQuery = {
      matches: true,
      addEventListener: jest.fn(),
      removeEventListener: jest.fn(),
    };
    window.matchMedia = jest.fn(() => mediaQuery);
    const api = {
      getState: jest.fn().mockResolvedValue({
        data: { version: 4, catalog: { tracks: [] }, playlists: [] },
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
    const toggle = library.querySelector(
      '[data-action="toggle-library-sidebar"]',
    );
    const sidebar = library.querySelector('[data-ui="library-sidebar"]');
    expect(library.querySelector('[data-filter="audio"]').hidden).toBe(true);
    expect(library.querySelector('[data-filter="video"]').hidden).toBe(true);
    expect(
      library.querySelector('[data-ui="library-more-filters"]').hidden,
    ).toBe(true);
    expect(sidebar.inert).toBe(true);

    toggle.click();
    expect(library.classList).toContain("is-sidebar-open");
    expect(sidebar.inert).toBe(false);
    library.dispatchEvent(
      new KeyboardEvent("keydown", { key: "Escape", bubbles: true }),
    );
    expect(library.classList).not.toContain("is-sidebar-open");
    expect(document.activeElement).toBe(toggle);
    view.dispose();
    window.matchMedia = originalMatchMedia;
  });

  test("positions playlist actions as a viewport overlay", async () => {
    const api = {
      getState: jest.fn().mockResolvedValue({
        data: {
          version: 4,
          catalog: { tracks: [sampleTrack] },
          playlists: [
            { id: "mix", title: "Mix", trackIds: [sampleTrack.id] },
          ],
          activePlaylistId: "mix",
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
    const menu = view.element.querySelector(
      ".player-library__playlist-actions",
    );
    const summary = menu.querySelector("summary");
    const popup = menu.querySelector('[role="menu"]');
    summary.getBoundingClientRect = jest.fn(() => ({
      top: 100,
      right: 300,
      bottom: 128,
    }));
    popup.getBoundingClientRect = jest.fn(() => ({ width: 210, height: 82 }));

    menu.open = true;
    menu.dispatchEvent(new Event("toggle"));

    expect(summary.getAttribute("aria-expanded")).toBe("true");
    expect(summary.getAttribute("aria-controls")).toBe(popup.id);
    expect(popup.style.left).not.toBe("");
    expect(popup.style.top).not.toBe("");
    expect(popup.dataset.placement).toBe("bottom");

    menu.open = false;
    menu.dispatchEvent(new Event("toggle"));
    expect(summary.getAttribute("aria-expanded")).toBe("false");
    view.dispose();
  });
});
