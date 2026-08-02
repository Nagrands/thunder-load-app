import { t } from "../i18n.js";
import { PLAYER_COMMANDS } from "./playerCommands.js";

const ICONS = Object.freeze({
  "fa-solid fa-headphones": "headphones",
  "fa-solid fa-thumbtack": "pin",
  "fa-solid fa-file-audio": "file-plus-2",
  "fa-solid fa-folder-plus": "folder-plus",
  "fa-solid fa-trash": "trash-2",
  "fa-solid fa-shuffle": "shuffle",
  "fa-solid fa-backward-step": "skip-back",
  "fa-solid fa-play": "play",
  "fa-solid fa-forward-step": "skip-forward",
  "fa-solid fa-repeat": "repeat-2",
  "fa-solid fa-volume-high": "volume-2",
  "fa-solid fa-expand": "maximize",
  "fa-solid fa-plus": "plus",
  "fa-solid fa-pen": "pencil",
  "fa-solid fa-xmark": "x",
  "fa-solid fa-music": "music-2",
  "fa-solid fa-arrow-right": "arrow-right",
  "fa-solid fa-up-right-and-down-left-from-center": "maximize-2",
  "fa-brands fa-youtube": "youtube",
});

const SHORTCUT_ACTIONS = Object.freeze({
  shuffle: [PLAYER_COMMANDS.TOGGLE_SHUFFLE],
  previous: [PLAYER_COMMANDS.PREVIOUS],
  "play-pause": [PLAYER_COMMANDS.TOGGLE_PLAYBACK, PLAYER_COMMANDS.STOP],
  next: [PLAYER_COMMANDS.NEXT],
  repeat: [PLAYER_COMMANDS.CYCLE_REPEAT],
  mute: [PLAYER_COMMANDS.TOGGLE_MUTE],
  fullscreen: [PLAYER_COMMANDS.TOGGLE_FULLSCREEN],
  "show-library": [PLAYER_COMMANDS.OPEN_LIBRARY],
  "show-player": [PLAYER_COMMANDS.OPEN],
  "current-track-info": [PLAYER_COMMANDS.SHOW_CURRENT_MEDIA_INFO],
});

function shortcutAttributes(actionIds = []) {
  if (actionIds.length === 1) {
    return `data-shortcut-action="${actionIds[0]}"`;
  }
  if (actionIds.length > 1) {
    return `data-shortcut-actions="${actionIds.join(",")}"`;
  }
  return "";
}

function lucideIcon(icon) {
  return ICONS[icon] || icon || "circle";
}

function iconButton(
  action,
  icon,
  labelKey,
  extraClass = "",
  placement = "top",
) {
  const placeholder = extraClass.includes("now-playing__placeholder-control");
  return `
    <button
      type="button"
      class="now-playing__control ${extraClass}"
      data-action="${action}"
      data-i18n-aria="${labelKey}"
      data-bs-toggle="tooltip"
      data-bs-placement="${placement}"
      data-i18n-title="${labelKey}"
      ${shortcutAttributes(SHORTCUT_ACTIONS[action])}
      title="${t(labelKey)}"
      aria-label="${t(labelKey)}"
      ${placeholder ? 'aria-disabled="true"' : ""}
    >
      <i data-lucide="${lucideIcon(icon)}" aria-hidden="true"></i>
    </button>
  `;
}

function playerMenuButton(action, icon, labelKey, extraClass = "") {
  return `
    <button
      type="button"
      class="${extraClass}"
      data-action="${action}"
      data-i18n-aria="${labelKey}"
      ${shortcutAttributes(SHORTCUT_ACTIONS[action])}
      role="menuitem"
      aria-label="${t(labelKey)}"
    >
      <i data-lucide="${lucideIcon(icon)}" aria-hidden="true"></i>
      <span data-i18n="${labelKey}">${t(labelKey)}</span>
    </button>
  `;
}

function artworkLayer(index) {
  return `
    <div class="now-playing__artwork-layer" data-artwork-layer="${index}">
      <img class="now-playing__artwork" alt="" hidden />
    </div>
  `;
}

function libraryActionButton(action, icon, labelKey, extraClass = "") {
  return `
    <button
      type="button"
      class="player-library__action ${extraClass}"
      data-action="${action}"
      data-i18n-aria="${labelKey}"
      aria-label="${t(labelKey)}"
    >
      <i data-lucide="${lucideIcon(icon)}" aria-hidden="true"></i>
      <span data-i18n="${labelKey}">${t(labelKey)}</span>
    </button>
  `;
}

function libraryIconButton(action, icon, labelKey, extraClass = "") {
  return `
    <button
      type="button"
      class="player-library__action player-library__action--icon ${extraClass}"
      data-action="${action}"
      data-i18n-aria="${labelKey}"
      data-i18n-title="${labelKey}"
      data-bs-toggle="tooltip"
      data-bs-placement="bottom"
      aria-label="${t(labelKey)}"
      title="${t(labelKey)}"
    >
      <i data-lucide="${lucideIcon(icon)}" aria-hidden="true"></i>
    </button>
  `;
}

function metadataSlot(index) {
  return `
    <div class="now-playing__metadata-slot" data-metadata-slot="${index}">
      <h1 class="now-playing__track-title"></h1>
      <p class="now-playing__track-artist"></p>
      <p class="now-playing__album"></p>
    </div>
  `;
}

export function buildNowPlayingMarkup() {
  return `
    <div class="now-playing__media-stack" aria-hidden="true">
      <div class="now-playing__media-layer" data-media-layer="0">
        <video class="now-playing__video" playsinline preload="metadata" tabindex="-1"></video>
        <div class="now-playing__ambient" data-ambient-layer="0"></div>
      </div>
      <div class="now-playing__media-layer" data-media-layer="1">
        <video class="now-playing__video" playsinline preload="metadata" tabindex="-1"></video>
        <div class="now-playing__ambient" data-ambient-layer="1"></div>
      </div>
      <div class="now-playing__visualizer" data-ui="audio-visualizer" hidden>
        <canvas class="now-playing__visualizer-canvas" data-ui="visualizer-canvas"></canvas>
        <p
          class="now-playing__visualizer-status"
          data-ui="visualizer-status"
          data-i18n="nowPlaying.visualizer.staticFallback"
          hidden
        >${t("nowPlaying.visualizer.staticFallback")}</p>
      </div>
      <div class="now-playing__scrim"></div>
      <div class="now-playing__color-wash"></div>
    </div>

    <div
      class="now-playing__sidebar-reveal-zone"
      tabindex="0"
      aria-label="${t("nowPlaying.playlist")}"
    ></div>

    <div class="now-playing__layout" data-ui="player-stage">
      <header class="now-playing__player-topbar" data-ui="player-topbar">
        <div class="now-playing__topbar-group now-playing__header-leading">
          <button
            class="now-playing__topbar-library"
            type="button"
            data-action="show-library"
            data-i18n-aria="nowPlaying.library.open"
            ${shortcutAttributes(SHORTCUT_ACTIONS["show-library"])}
            aria-label="${t("nowPlaying.library.open")}"
          >
            <i data-lucide="library" aria-hidden="true"></i>
            <span data-i18n="nowPlaying.library.title">${t("nowPlaying.library.title")}</span>
          </button>
          <span class="now-playing__topbar-divider" aria-hidden="true"></span>
          <nav
            class="now-playing__tab-menu"
            data-ui="player-tab-menu"
            data-i18n-aria="topbar.nav"
            aria-label="${t("topbar.nav")}"
          ></nav>
        </div>

        <div
          class="now-playing__topbar-group now-playing__topbar-center"
          data-ui="playback-controls"
          aria-label="${t("nowPlaying.controls")}"
          aria-hidden="true"
          inert
        >
          <button
            class="now-playing__topbar-metadata"
            type="button"
            data-action="current-track-info"
            data-i18n-aria="nowPlaying.trackInfo"
            ${shortcutAttributes(SHORTCUT_ACTIONS["current-track-info"])}
            aria-label="${t("nowPlaying.trackInfo")}"
            disabled
          >
            <span class="now-playing__topbar-artwork" aria-hidden="true">
              <img data-ui="topbar-artwork" alt="" hidden />
              <span data-ui="topbar-artwork-fallback">
                <i data-lucide="clapperboard" aria-hidden="true"></i>
              </span>
            </span>
            <span class="now-playing__topbar-copy">
              <strong data-ui="topbar-title">${t("nowPlaying.label")}</strong>
              <span data-ui="topbar-artist" hidden></span>
            </span>
          </button>
          <div class="now-playing__topbar-transport">
            ${iconButton("previous", "fa-solid fa-backward-step", "nowPlaying.previous", "", "bottom")}
            ${iconButton("play-pause", "fa-solid fa-play", "nowPlaying.play", "now-playing__control--primary", "bottom")}
            ${iconButton("next", "fa-solid fa-forward-step", "nowPlaying.next", "", "bottom")}
          </div>
          <div class="now-playing__timeline">
            <span class="now-playing__time" data-ui="current-time">0:00</span>
            <span class="now-playing__progress-shell">
              <span class="now-playing__timeline-preview" data-ui="timeline-preview" hidden>
                <img data-ui="timeline-preview-image" alt="" />
                <span data-ui="timeline-preview-time">0:00</span>
              </span>
              <input
                class="now-playing__progress"
                data-action="seek"
                type="range"
                min="0"
                max="0"
                step="0.1"
                value="0"
                data-i18n-aria="nowPlaying.seek"
                ${shortcutAttributes([
                  PLAYER_COMMANDS.SEEK_BACKWARD,
                  PLAYER_COMMANDS.SEEK_FORWARD,
                ])}
                aria-label="${t("nowPlaying.seek")}"
              />
            </span>
            <span class="now-playing__time" data-ui="duration">-0:00</span>
          </div>
        </div>

        <div class="now-playing__topbar-group now-playing__top-actions" aria-label="${t("nowPlaying.tools")}">
          <div class="now-playing__volume">
            ${iconButton("mute", "fa-solid fa-volume-high", "nowPlaying.mute", "", "bottom")}
            <div class="now-playing__volume-popover" data-ui="volume-popover">
              <input
                id="now-playing-volume"
                class="now-playing__volume-range"
                data-action="volume"
                type="range"
                min="0"
                max="1"
                step="0.01"
                value="1"
                data-i18n-aria="nowPlaying.volume"
                ${shortcutAttributes([
                  PLAYER_COMMANDS.VOLUME_DOWN,
                  PLAYER_COMMANDS.VOLUME_UP,
                ])}
                aria-label="${t("nowPlaying.volume")}"
              />
              <output
                class="now-playing__volume-percent"
                data-ui="volume-percent"
                for="now-playing-volume"
                aria-live="polite"
              >100%</output>
            </div>
          </div>
          ${iconButton("fullscreen", "fa-solid fa-expand", "nowPlaying.enterFullscreen", "now-playing__fullscreen-control", "bottom")}
          <span class="now-playing__topbar-divider" aria-hidden="true"></span>
          ${iconButton("toggle-player-menu", "ellipsis-vertical", "nowPlaying.more", "now-playing__control--glass", "bottom")}
          <span class="now-playing__window-divider" aria-hidden="true"></span>
          <button
            type="button"
            class="now-playing__window-action now-playing__window-action--minimize"
            data-window-action="minimize"
            data-i18n-aria="topbar.minimize"
            data-i18n-title="topbar.minimize"
            data-bs-toggle="tooltip"
            data-bs-placement="bottom"
            aria-label="${t("topbar.minimize")}"
            title="${t("topbar.minimize")}"
          >
            <i data-lucide="minus" aria-hidden="true"></i>
          </button>
          <button
            type="button"
            class="now-playing__window-action now-playing__window-action--close"
            data-window-action="close"
            data-i18n-aria="topbar.close"
            data-i18n-title="topbar.close"
            data-bs-toggle="tooltip"
            data-bs-placement="bottom"
            aria-label="${t("topbar.close")}"
            title="${t("topbar.close")}"
          >
            <i data-lucide="x" aria-hidden="true"></i>
          </button>
        </div>
      </header>

      <aside class="now-playing__sidebar" aria-label="${t("nowPlaying.playlist")}">
        <div class="now-playing__track-stage">
          <div class="now-playing__current-card">
            <div class="now-playing__artwork-stack" aria-hidden="true">
              ${artworkLayer(0)}
              ${artworkLayer(1)}
              <img class="now-playing__generated-poster" data-ui="generated-poster" alt="" hidden />
              <span class="now-playing__artwork-fallback">
                <i data-lucide="clapperboard" aria-hidden="true"></i>
              </span>
            </div>
            <div class="now-playing__current-copy">
              <div class="now-playing__metadata-stage" aria-live="polite">
                ${metadataSlot(0)}
                ${metadataSlot(1)}
              </div>
              <div class="now-playing__media-badges" data-ui="media-badges"></div>
              <span class="now-playing__media-size" data-ui="media-size"></span>
            </div>
          </div>
        </div>

        <div class="now-playing__library-heading">
          <div class="now-playing__playlist-switcher">
            <span data-i18n="nowPlaying.playlists.title">${t("nowPlaying.playlists.title")}</span>
            <div class="now-playing__playlist-select-shell">
              <button
                type="button"
                class="now-playing__library-title"
                data-ui="sidebar-playlist-switcher"
                data-action="toggle-sidebar-playlist-menu"
                data-i18n-aria="nowPlaying.playlists.select"
                aria-label="${t("nowPlaying.playlists.select")}"
                aria-haspopup="listbox"
                aria-expanded="false"
                aria-controls="now-playing-sidebar-playlist-menu"
              >
                <i data-lucide="list-video" aria-hidden="true"></i>
                <span data-ui="sidebar-playlist-label"></span>
                <i class="now-playing__playlist-chevron" data-lucide="chevron-down" aria-hidden="true"></i>
                <span class="now-playing__library-count" data-ui="playlist-count"></span>
              </button>
              <div
                class="now-playing__playlist-menu"
                id="now-playing-sidebar-playlist-menu"
                data-ui="sidebar-playlist-menu"
                role="listbox"
                data-i18n-aria="nowPlaying.playlists.select"
                aria-label="${t("nowPlaying.playlists.select")}"
                hidden
              ></div>
            </div>
          </div>
        </div>

        <div class="now-playing__playlist-section">
          <div class="now-playing__playlist-header">
            <span class="now-playing__playlist-label" data-i18n="nowPlaying.playlist">${t("nowPlaying.playlist")}</span>
            <span class="now-playing__playlist-caption" data-ui="playlist-caption"></span>
          </div>
          <div class="now-playing__playlist" id="now-playing-sidebar-queue" role="listbox" aria-label="${t("nowPlaying.playlist")}"></div>
        </div>

        <div class="now-playing__sidebar-toolbar" aria-label="${t("nowPlaying.library.actions")}">
          <div class="now-playing__sidebar-add">
            ${iconButton("toggle-add-menu", "plus", "nowPlaying.add", "now-playing__sidebar-tool")}
            <div
              class="now-playing__add-menu"
              id="now-playing-add-menu"
              data-ui="sidebar-add-menu"
              role="menu"
              aria-label="${t("nowPlaying.add")}"
              hidden
            >
              <button type="button" data-action="add-files" role="menuitem">
                <i data-lucide="file-plus-2" aria-hidden="true"></i>
                <span data-i18n="nowPlaying.addFile">${t("nowPlaying.addFile")}</span>
              </button>
              <button type="button" data-action="add-folder" role="menuitem">
                <i data-lucide="folder-plus" aria-hidden="true"></i>
                <span data-i18n="nowPlaying.addFolder">${t("nowPlaying.addFolder")}</span>
              </button>
              <button type="button" data-action="open-youtube-dialog" role="menuitem">
                <i data-lucide="youtube" aria-hidden="true"></i>
                <span data-i18n="nowPlaying.addYouTubeLink">${t("nowPlaying.addYouTubeLink")}</span>
              </button>
            </div>
          </div>
          ${iconButton("show-library", "list-plus", "nowPlaying.playlists.title", "now-playing__sidebar-tool")}
          ${iconButton("pin-sidebar", "pin", "nowPlaying.pinSidebar", "now-playing__sidebar-tool now-playing__preference-control")}
          ${iconButton("placeholder-download", "download", "nowPlaying.unavailable.download", "now-playing__sidebar-tool now-playing__placeholder-control")}
        </div>
      </aside>

      <section
        class="now-playing__visualizer-panel"
        data-ui="visualizer-panel"
        aria-label="${t("nowPlaying.visualizer.settings")}"
        hidden
      >
        <div class="now-playing__visualizer-summary">
          <label>
            <span data-i18n="nowPlaying.visualizer.type">${t("nowPlaying.visualizer.type")}</span>
            <select data-visualizer-setting="type" disabled>
              <option value="spectrum" data-i18n="nowPlaying.visualizer.type.spectrum">${t("nowPlaying.visualizer.type.spectrum")}</option>
            </select>
          </label>
          <label>
            <span data-i18n="nowPlaying.visualizer.color">${t("nowPlaying.visualizer.color")}</span>
            <select data-visualizer-setting="colorScheme">
              <option value="purple" data-i18n="nowPlaying.visualizer.color.purple">${t("nowPlaying.visualizer.color.purple")}</option>
              <option value="blue" data-i18n="nowPlaying.visualizer.color.blue">${t("nowPlaying.visualizer.color.blue")}</option>
              <option value="pink" data-i18n="nowPlaying.visualizer.color.pink">${t("nowPlaying.visualizer.color.pink")}</option>
              <option value="gradient" data-i18n="nowPlaying.visualizer.color.gradient">${t("nowPlaying.visualizer.color.gradient")}</option>
              <option value="accent" data-i18n="nowPlaying.visualizer.color.accent">${t("nowPlaying.visualizer.color.accent")}</option>
            </select>
          </label>
          <label>
            <span data-i18n="nowPlaying.visualizer.style">${t("nowPlaying.visualizer.style")}</span>
            <select data-visualizer-setting="style">
              <option value="normal" data-i18n="nowPlaying.visualizer.style.normal">${t("nowPlaying.visualizer.style.normal")}</option>
              <option value="glow" data-i18n="nowPlaying.visualizer.style.glow">${t("nowPlaying.visualizer.style.glow")}</option>
              <option value="minimal" data-i18n="nowPlaying.visualizer.style.minimal">${t("nowPlaying.visualizer.style.minimal")}</option>
            </select>
          </label>
        </div>
        <div class="now-playing__visualizer-details" data-ui="visualizer-details" hidden>
          <label>
            <span data-i18n="nowPlaying.visualizer.sensitivity">${t("nowPlaying.visualizer.sensitivity")}</span>
            <input type="range" min="50" max="200" step="5" value="100" data-visualizer-setting="sensitivity" />
            <output data-visualizer-output="sensitivity">100%</output>
          </label>
          <label>
            <span data-i18n="nowPlaying.visualizer.smoothing">${t("nowPlaying.visualizer.smoothing")}</span>
            <input type="range" min="0" max="95" step="5" value="80" data-visualizer-setting="smoothing" />
            <output data-visualizer-output="smoothing">80%</output>
          </label>
          <label>
            <span data-i18n="nowPlaying.visualizer.bars">${t("nowPlaying.visualizer.bars")}</span>
            <input type="range" min="24" max="128" step="4" value="64" data-visualizer-setting="barCount" />
            <output data-visualizer-output="barCount">64</output>
          </label>
          <label class="now-playing__visualizer-check">
            <input type="checkbox" data-visualizer-setting="particles" checked />
            <span data-i18n="nowPlaying.visualizer.particles">${t("nowPlaying.visualizer.particles")}</span>
          </label>
          <label class="now-playing__visualizer-check">
            <input type="checkbox" data-visualizer-setting="reflection" checked />
            <span data-i18n="nowPlaying.visualizer.reflection">${t("nowPlaying.visualizer.reflection")}</span>
          </label>
          <button type="button" data-action="reset-visualizer-settings">
            <i data-lucide="rotate-ccw" aria-hidden="true"></i>
            <span data-i18n="nowPlaying.visualizer.reset">${t("nowPlaying.visualizer.reset")}</span>
          </button>
        </div>
      </section>

      <div class="now-playing__player-menu" data-ui="player-menu" role="menu" hidden>
        ${playerMenuButton("toggle-audio-tracks", "audio-lines", "nowPlaying.audioTracks.open", "now-playing__audio-trigger")}
        ${playerMenuButton("shuffle", "fa-solid fa-shuffle", "nowPlaying.shuffle")}
        ${playerMenuButton("repeat", "fa-solid fa-repeat", "nowPlaying.repeat")}
        ${playerMenuButton("toggle-visualizer-settings", "audio-lines", "nowPlaying.visualizer.settings", "now-playing__visualizer-menu-toggle")}
        <span class="now-playing__player-menu-divider" role="separator"></span>
        ${playerMenuButton("toggle-controls-position", "panel-bottom", "nowPlaying.controlsPosition.moveBottom", "now-playing__controls-position-toggle")}
        <button type="button" data-action="background-playback" role="menuitem">
          <i data-lucide="headphones" aria-hidden="true"></i>
          <span data-i18n="nowPlaying.backgroundPlayback">${t("nowPlaying.backgroundPlayback")}</span>
        </button>
        <button type="button" data-action="pin-sidebar" role="menuitem">
          <i data-lucide="pin" aria-hidden="true"></i>
          <span data-i18n="nowPlaying.pinSidebar">${t("nowPlaying.pinSidebar")}</span>
        </button>
        <button
          type="button"
          data-action="current-track-info"
          data-i18n-title="nowPlaying.trackInfo"
          data-bs-toggle="tooltip"
          data-bs-placement="left"
          ${shortcutAttributes(SHORTCUT_ACTIONS["current-track-info"])}
          role="menuitem"
          title="${t("nowPlaying.trackInfo")}"
        >
          <i data-lucide="info" aria-hidden="true"></i>
          <span data-i18n="nowPlaying.trackInfo">${t("nowPlaying.trackInfo")}</span>
        </button>
        <button type="button" data-action="close-playback" role="menuitem">
          <i data-lucide="square-x" aria-hidden="true"></i>
          <span data-i18n="nowPlaying.closePlayback">${t("nowPlaying.closePlayback")}</span>
        </button>
        <button type="button" data-action="add-folder" role="menuitem">
          <i data-lucide="folder-plus" aria-hidden="true"></i>
          <span data-i18n="nowPlaying.addFolder">${t("nowPlaying.addFolder")}</span>
        </button>
        <button type="button" data-action="clear" role="menuitem">
          <i data-lucide="trash-2" aria-hidden="true"></i>
          <span data-i18n="nowPlaying.clear">${t("nowPlaying.clear")}</span>
        </button>
      </div>
      <section
        class="now-playing__audio-menu"
        data-ui="audio-track-menu"
        aria-labelledby="now-playing-audio-title"
        aria-busy="false"
        hidden
      >
        <header>
          <span data-i18n="nowPlaying.audioTracks.kicker">${t("nowPlaying.audioTracks.kicker")}</span>
          <strong id="now-playing-audio-title" data-i18n="nowPlaying.audioTracks.title">${t("nowPlaying.audioTracks.title")}</strong>
        </header>
        <p
          class="now-playing__audio-status"
          data-ui="audio-track-status"
          role="status"
          aria-live="polite"
          hidden
        ></p>
        <div
          id="now-playing-audio-list"
          class="now-playing__audio-list"
          data-ui="audio-track-list"
          role="listbox"
          aria-labelledby="now-playing-audio-title"
        ></div>
      </section>
    </div>

    <section class="now-playing__scene-overlay now-playing__error" role="alert" hidden>
      <i data-lucide="triangle-alert" aria-hidden="true"></i>
      <p data-ui="error-message"></p>
      <div class="now-playing__error-actions">
        <button class="now-playing__retry" type="button" data-action="retry" data-i18n="nowPlaying.retry">${t("nowPlaying.retry")}</button>
        <button class="now-playing__retry now-playing__error-library" type="button" data-action="show-library" data-i18n="nowPlaying.library.open">${t("nowPlaying.library.open")}</button>
      </div>
    </section>

    <section
      class="player-library"
      data-ui="library-view"
      aria-labelledby="player-library-title"
      hidden
    >
      <header class="player-library__header">
        <div class="player-library__heading">
          <span class="player-library__eyebrow" data-i18n="tabs.nowPlaying">${t("tabs.nowPlaying")}</span>
          <h1 id="player-library-title" tabindex="-1" data-i18n="nowPlaying.library.title">${t("nowPlaying.library.title")}</h1>
          <p data-i18n="nowPlaying.library.subtitle">${t("nowPlaying.library.subtitle")}</p>
        </div>
        <div class="player-library__search">
          <i data-lucide="search" aria-hidden="true"></i>
          <input
            type="search"
            data-ui="library-search"
            data-action="filter-library"
            data-i18n-aria="nowPlaying.library.search"
            aria-label="${t("nowPlaying.library.search")}"
            autocomplete="off"
            spellcheck="false"
            data-i18n-placeholder="nowPlaying.library.searchPlaceholder"
            placeholder="${t("nowPlaying.library.searchPlaceholder")}"
          />
          <button
            class="player-library__search-clear"
            type="button"
            data-action="clear-library-search"
            data-ui="library-search-clear"
            data-i18n-aria="nowPlaying.library.clearSearch"
            data-i18n-title="nowPlaying.library.clearSearch"
            data-bs-toggle="tooltip"
            data-bs-placement="top"
            aria-label="${t("nowPlaying.library.clearSearch")}"
            title="${t("nowPlaying.library.clearSearch")}"
            hidden
          >
            <i data-lucide="x" aria-hidden="true"></i>
          </button>
        </div>
        <button
          class="player-library__close"
          type="button"
          data-action="show-player"
          data-i18n-aria="nowPlaying.library.close"
          aria-label="${t("nowPlaying.library.close")}"
        >
          <i data-lucide="panel-top-open" aria-hidden="true"></i>
          <span data-i18n="nowPlaying.library.close">${t("nowPlaying.library.close")}</span>
        </button>
      </header>
      <div class="player-library__command-bar">
        ${libraryIconButton("toggle-library-sidebar", "panel-left", "nowPlaying.library.collections", "player-library__sidebar-toggle")}
        <div class="player-library__filters" role="group" aria-label="${t("nowPlaying.library.filters")}">
          <button type="button" data-action="set-library-filter" data-filter="all" aria-pressed="true">
            <i data-lucide="layout-grid" aria-hidden="true"></i>
            <span data-i18n="nowPlaying.library.filter.all">${t("nowPlaying.library.filter.all")}</span>
          </button>
          <button type="button" data-action="set-library-filter" data-filter="video" aria-pressed="false">
            <i data-lucide="clapperboard" aria-hidden="true"></i>
            <span data-i18n="nowPlaying.library.filter.video">${t("nowPlaying.library.filter.video")}</span>
          </button>
          <button type="button" data-action="set-library-filter" data-filter="audio" aria-pressed="false">
            <i data-lucide="music-2" aria-hidden="true"></i>
            <span data-i18n="nowPlaying.library.filter.audio">${t("nowPlaying.library.filter.audio")}</span>
          </button>
          <button type="button" data-action="set-library-filter" data-filter="playlists" aria-pressed="false">
            <i data-lucide="list-video" aria-hidden="true"></i>
            <span data-i18n="nowPlaying.library.filter.playlists">${t("nowPlaying.library.filter.playlists")}</span>
          </button>
        </div>
        <details class="player-library__more-filters" data-ui="library-more-filters">
          <summary data-i18n-aria="nowPlaying.library.moreFilters" aria-label="${t("nowPlaying.library.moreFilters")}">
            <i data-lucide="sliders-horizontal" aria-hidden="true"></i>
          </summary>
          <div role="group" aria-label="${t("nowPlaying.library.moreFilters")}">
            <button type="button" data-action="set-library-filter" data-filter="missing" aria-pressed="false">
              <i data-lucide="file-warning" aria-hidden="true"></i>
              <span data-i18n="nowPlaying.library.filter.missing">${t("nowPlaying.library.filter.missing")}</span>
            </button>
          </div>
        </details>
        <div class="player-library__header-actions" aria-label="${t("nowPlaying.library.actions")}">
          ${libraryIconButton("add-files", "fa-solid fa-file-audio", "nowPlaying.addFiles")}
          ${libraryIconButton("add-folder", "fa-solid fa-folder-plus", "nowPlaying.addFolder")}
          ${libraryIconButton("open-youtube-dialog", "fa-brands fa-youtube", "nowPlaying.youtube.add")}
          ${libraryIconButton("open-create-playlist-dialog", "fa-solid fa-plus", "nowPlaying.playlists.create", "player-library__action--primary")}
        </div>
      </div>
      <div
        class="player-library__operation-status"
        data-ui="library-operation-status"
        role="status"
        aria-live="polite"
        hidden
      >
        <i data-lucide="loader-circle" class="is-spinning" aria-hidden="true"></i>
        <span></span>
      </div>

      <button class="player-library__sidebar-scrim" type="button" data-action="close-library-sidebar" data-ui="library-sidebar-scrim" aria-label="${t("nowPlaying.library.closeCollections")}" hidden></button>
      <div class="player-library__body">
        <nav class="player-library__playlists" data-ui="library-sidebar" aria-label="${t("nowPlaying.library.collections")}">
          <section class="player-library__sidebar-section" aria-labelledby="player-collections-title">
            <div class="player-library__section-heading">
              <h2 id="player-collections-title" data-i18n="nowPlaying.library.collections">${t("nowPlaying.library.collections")}</h2>
            </div>
            <div class="player-library__playlist-grid" data-ui="library-collections"></div>
          </section>
          <section class="player-library__sidebar-section player-library__sidebar-section--playlists" aria-labelledby="player-playlists-title">
            <div class="player-library__section-heading">
              <h2 id="player-playlists-title" data-i18n="nowPlaying.playlists.title">${t("nowPlaying.playlists.title")}</h2>
              <button type="button" data-action="open-create-playlist-dialog" data-i18n-aria="nowPlaying.playlists.create" aria-label="${t("nowPlaying.playlists.create")}">
                <i data-lucide="plus" aria-hidden="true"></i>
              </button>
            </div>
            <div
              class="player-library__playlist-grid"
              data-ui="library-playlists"
              role="region"
              aria-labelledby="player-playlists-title"
              tabindex="0"
            ></div>
          </section>
          <section class="player-library__up-next" aria-labelledby="player-up-next-title">
            <div class="player-library__up-next-heading">
              <h3 id="player-up-next-title" data-i18n="nowPlaying.queue.upNext">${t("nowPlaying.queue.upNext")}</h3>
              <button type="button" data-action="clear-transient-queue" data-i18n="nowPlaying.queue.clear">${t("nowPlaying.queue.clear")}</button>
            </div>
            <div
              class="player-library__queue-list"
              data-ui="transient-queue"
              role="region"
              aria-labelledby="player-up-next-title"
              tabindex="0"
            ></div>
          </section>
        </nav>

        <section class="player-library__collection" aria-labelledby="player-collection-title">
          <div class="player-library__collection-header">
            <div>
              <span class="player-library__collection-kicker" data-ui="active-playlist-type"></span>
              <h2 id="player-collection-title" data-ui="active-playlist-title"></h2>
            </div>
            <div class="player-library__collection-actions" data-ui="playlist-management-actions">
              ${libraryActionButton("clear-media-library", "fa-solid fa-trash", "nowPlaying.library.clearQueue", "player-library__action--danger")}
              ${libraryActionButton("open-rename-playlist-dialog", "fa-solid fa-pen", "nowPlaying.playlists.rename")}
              ${libraryActionButton("delete-playlist", "fa-solid fa-trash", "nowPlaying.playlists.delete")}
            </div>
          </div>
          <div class="player-library__results-bar">
            <span data-ui="active-playlist-summary"></span>
            <span data-ui="library-results-count" role="status" aria-live="polite"></span>
          </div>
          <div class="player-library__playlist-browser" data-ui="library-playlist-browser" role="list" aria-label="${t("nowPlaying.playlists.title")}" hidden></div>
          <div class="player-library__column-header" aria-hidden="true">
            <span></span>
            <span></span>
            <span data-i18n="nowPlaying.library.columns.media">${t("nowPlaying.library.columns.media")}</span>
            <span data-i18n="nowPlaying.library.columns.duration">${t("nowPlaying.library.columns.duration")}</span>
            <span data-i18n="nowPlaying.library.columns.size">${t("nowPlaying.library.columns.size")}</span>
            <span data-i18n="nowPlaying.library.columns.status">${t("nowPlaying.library.columns.status")}</span>
            <span></span>
          </div>
          <div
            class="player-library__tracks"
            data-ui="library-tracks"
            role="listbox"
            aria-label="${t("nowPlaying.library.items")}"
          ></div>
          <div class="player-library__empty" data-ui="library-empty" hidden>
            <div class="player-library__empty-illustration" aria-hidden="true">
              <i data-lucide="folder-music"></i>
              <i data-lucide="play"></i>
              <i data-lucide="plus"></i>
            </div>
            <h3 data-ui="library-empty-title" data-i18n="nowPlaying.library.empty.playlistTitle">${t("nowPlaying.library.empty.playlistTitle")}</h3>
            <p data-i18n="nowPlaying.library.empty.hint">${t("nowPlaying.library.empty.hint")}</p>
            <div class="player-library__empty-actions">
              ${libraryActionButton("add-files", "fa-solid fa-file-audio", "nowPlaying.addFiles", "player-library__action--primary")}
              ${libraryActionButton("add-folder", "fa-solid fa-folder-plus", "nowPlaying.addFolder")}
              ${libraryActionButton("open-youtube-dialog", "fa-brands fa-youtube", "nowPlaying.youtube.add")}
              ${libraryActionButton("open-create-playlist-dialog", "fa-solid fa-plus", "nowPlaying.playlists.create")}
            </div>
          </div>
          <div class="player-library__empty player-library__no-results" data-ui="library-no-results" hidden>
            <i data-lucide="search-x" aria-hidden="true"></i>
            <h3 data-i18n="nowPlaying.library.noResults.title">${t("nowPlaying.library.noResults.title")}</h3>
            <p data-i18n="nowPlaying.library.noResults.hint">${t("nowPlaying.library.noResults.hint")}</p>
            ${libraryActionButton("clear-library-search", "fa-solid fa-xmark", "nowPlaying.library.noResults.clear")}
          </div>
          <div class="player-library__empty player-library__no-playlists" data-ui="library-no-playlists" hidden>
            <i data-lucide="list-plus" aria-hidden="true"></i>
            <h3 data-i18n="nowPlaying.library.noPlaylists.title">${t("nowPlaying.library.noPlaylists.title")}</h3>
            <p data-i18n="nowPlaying.library.noPlaylists.hint">${t("nowPlaying.library.noPlaylists.hint")}</p>
            ${libraryActionButton("open-create-playlist-dialog", "fa-solid fa-plus", "nowPlaying.playlists.create", "player-library__action--primary")}
          </div>
        </section>
      </div>

      <section class="player-library__mini-player" data-ui="mini-player" aria-label="${t("nowPlaying.miniPlayer")}" hidden>
        <div class="player-library__mini-identity">
          <div class="player-library__mini-artwork" aria-hidden="true">
            <img data-ui="mini-artwork" alt="" />
            <i data-lucide="music-2"></i>
          </div>
          <div class="player-library__mini-metadata">
            <strong data-ui="mini-title"></strong>
            <span><span data-ui="mini-artist"></span><span class="player-library__mini-kind" data-ui="mini-kind"></span></span>
            <span class="player-library__mini-album" data-ui="mini-album"></span>
          </div>
        </div>
        <div class="player-library__mini-center">
          <div class="player-library__mini-controls">
            ${iconButton("previous", "fa-solid fa-backward-step", "nowPlaying.previous", "player-library__mini-control")}
            ${iconButton("play-pause", "fa-solid fa-play", "nowPlaying.play", "now-playing__control--primary player-library__mini-control player-library__mini-control--primary")}
            ${iconButton("next", "fa-solid fa-forward-step", "nowPlaying.next", "player-library__mini-control")}
          </div>
          <div class="player-library__mini-timeline">
            <span class="now-playing__time" data-ui="mini-current-time">0:00</span>
            <input
              class="now-playing__progress player-library__mini-progress"
              data-action="seek"
              type="range"
              min="0"
              max="0"
              step="0.1"
              value="0"
              data-i18n-aria="nowPlaying.seek"
              aria-label="${t("nowPlaying.seek")}"
            />
            <span class="now-playing__time" data-ui="mini-duration">0:00</span>
          </div>
        </div>
        <div class="player-library__mini-actions">
          ${iconButton("mute", "fa-solid fa-volume-high", "nowPlaying.mute", "player-library__mini-control")}
          <input
            class="now-playing__volume-range player-library__mini-volume"
            data-action="volume"
            type="range"
            min="0"
            max="1"
            step="0.01"
            value="1"
            data-i18n-aria="nowPlaying.volume"
            aria-label="${t("nowPlaying.volume")}"
          />
          ${iconButton("close-playback", "square-x", "nowPlaying.closePlayback", "player-library__mini-control player-library__mini-close")}
          ${iconButton("show-player", "fa-solid fa-arrow-right", "nowPlaying.library.openFullPlayer", "player-library__mini-control player-library__mini-open")}
        </div>
      </section>
    </section>
    <div class="now-playing__status" role="status" aria-live="polite"></div>
  `;
}

export default buildNowPlayingMarkup;
