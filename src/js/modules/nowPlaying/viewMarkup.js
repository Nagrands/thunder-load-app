import { t } from "../i18n.js";

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
  "fa-solid fa-up-right-and-down-left-from-center": "maximize-2",
  "fa-brands fa-youtube": "youtube",
});

function lucideIcon(icon) {
  return ICONS[icon] || icon || "circle";
}

function iconButton(action, icon, labelKey, extraClass = "") {
  const placeholder = extraClass.includes("now-playing__placeholder-control");
  return `
    <button
      type="button"
      class="now-playing__control ${extraClass}"
      data-action="${action}"
      data-i18n-aria="${labelKey}"
      data-bs-toggle="tooltip"
      data-bs-placement="top"
      data-i18n-title="${labelKey}"
      title="${t(labelKey)}"
      aria-label="${t(labelKey)}"
      ${placeholder ? 'aria-disabled="true"' : ""}
    >
      <i data-lucide="${lucideIcon(icon)}" aria-hidden="true"></i>
    </button>
  `;
}

function artworkLayer(index) {
  return `
    <div class="now-playing__artwork-layer" data-artwork-layer="${index}">
      <img class="now-playing__artwork" alt="" />
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
      <div class="now-playing__scrim"></div>
      <div class="now-playing__color-wash"></div>
    </div>

    <div class="now-playing__topbar-reveal-zone" tabindex="0" aria-label="${t("nowPlaying.controls")}"></div>
    <div
      class="now-playing__sidebar-reveal-zone"
      tabindex="0"
      aria-label="${t("nowPlaying.playlist")}"
    ></div>

    <div class="now-playing__layout">
      <header class="now-playing__player-topbar" data-ui="player-topbar">
        <button
          class="now-playing__floating-title"
          type="button"
          data-action="current-track-info"
          data-i18n-aria="nowPlaying.trackInfo"
          aria-label="${t("nowPlaying.trackInfo")}"
          disabled
        >
          <span data-ui="floating-title">${t("nowPlaying.label")}</span>
          <i data-lucide="chevron-down" aria-hidden="true"></i>
        </button>
        <div class="now-playing__top-actions" aria-label="${t("nowPlaying.tools")}">
          ${iconButton("placeholder-subtitles", "captions", "nowPlaying.unavailable.subtitles", "now-playing__control--glass now-playing__placeholder-control")}
          ${iconButton("placeholder-audio", "audio-lines", "nowPlaying.unavailable.audioTracks", "now-playing__control--glass now-playing__placeholder-control")}
          ${iconButton("placeholder-mini-player", "music-2", "nowPlaying.unavailable.miniPlayer", "now-playing__control--glass now-playing__placeholder-control")}
          ${iconButton("placeholder-picture", "image", "nowPlaying.unavailable.picture", "now-playing__control--glass now-playing__placeholder-control")}
          ${iconButton("toggle-player-menu", "ellipsis-vertical", "nowPlaying.more", "now-playing__control--glass")}
        </div>
      </header>

      <aside class="now-playing__sidebar" aria-label="${t("nowPlaying.playlist")}">
        <button
          class="now-playing__view-switch"
          type="button"
          data-action="show-library"
          data-i18n-aria="nowPlaying.library.open"
          aria-label="${t("nowPlaying.library.open")}"
        >
          <i data-lucide="library" aria-hidden="true"></i>
          <span data-i18n="nowPlaying.library.title">${t("nowPlaying.library.title")}</span>
        </button>
        <span class="now-playing__brand-label" data-ui="brand-label">${t("nowPlaying.label")}</span>

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
            <span data-i18n="nowPlaying.playlists.active">${t("nowPlaying.playlists.active")}</span>
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
                <i data-lucide="chevron-down" aria-hidden="true"></i>
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
          <span class="now-playing__library-count" data-ui="playlist-count"></span>
        </div>

        <div class="now-playing__playlist-section">
          <div class="now-playing__playlist-header">
            <span class="now-playing__playlist-label" data-i18n="nowPlaying.playlist">${t("nowPlaying.playlist")}</span>
            <span class="now-playing__playlist-caption" data-ui="playlist-caption"></span>
          </div>
          <div class="now-playing__playlist" id="now-playing-sidebar-queue" role="listbox" aria-label="${t("nowPlaying.playlist")}"></div>
        </div>

        <div class="now-playing__sidebar-toolbar" aria-label="${t("nowPlaying.library.actions")}">
          ${iconButton("add-files", "plus", "nowPlaying.addFiles", "now-playing__sidebar-tool")}
          ${iconButton("show-library", "list-plus", "nowPlaying.playlists.title", "now-playing__sidebar-tool")}
          ${iconButton("placeholder-download", "download", "nowPlaying.unavailable.download", "now-playing__sidebar-tool now-playing__placeholder-control")}
          ${iconButton("toggle-player-menu", "ellipsis", "nowPlaying.more", "now-playing__sidebar-tool")}
        </div>
      </aside>

      <section class="now-playing__dock" aria-label="${t("nowPlaying.controls")}" aria-hidden="true" inert>
        <div class="now-playing__transport">
          ${iconButton("shuffle", "fa-solid fa-shuffle", "nowPlaying.shuffle")}
          ${iconButton("previous", "fa-solid fa-backward-step", "nowPlaying.previous")}
          ${iconButton("play-pause", "fa-solid fa-play", "nowPlaying.play", "now-playing__control--primary")}
          ${iconButton("next", "fa-solid fa-forward-step", "nowPlaying.next")}
          ${iconButton("repeat", "fa-solid fa-repeat", "nowPlaying.repeat")}
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
              aria-label="${t("nowPlaying.seek")}"
            />
          </span>
          <span class="now-playing__time" data-ui="duration">-0:00</span>
        </div>
        <div class="now-playing__volume">
          ${iconButton("mute", "fa-solid fa-volume-high", "nowPlaying.mute")}
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
            aria-label="${t("nowPlaying.volume")}"
          />
          <output
            class="now-playing__volume-percent"
            data-ui="volume-percent"
            for="now-playing-volume"
          >100%</output>
          ${iconButton("placeholder-subtitles", "captions", "nowPlaying.unavailable.subtitles", "now-playing__placeholder-control")}
          ${iconButton("placeholder-settings", "settings", "nowPlaying.unavailable.settings", "now-playing__placeholder-control")}
          ${iconButton("fullscreen", "fa-solid fa-expand", "nowPlaying.enterFullscreen", "now-playing__control--fullscreen")}
        </div>
      </section>

      <div class="now-playing__player-menu" data-ui="player-menu" hidden>
        <button type="button" data-action="background-playback">
          <i data-lucide="headphones" aria-hidden="true"></i>
          <span data-i18n="nowPlaying.backgroundPlayback">${t("nowPlaying.backgroundPlayback")}</span>
        </button>
        <button type="button" data-action="pin-sidebar">
          <i data-lucide="pin" aria-hidden="true"></i>
          <span data-i18n="nowPlaying.pinSidebar">${t("nowPlaying.pinSidebar")}</span>
        </button>
        <button type="button" data-action="current-track-info">
          <i data-lucide="info" aria-hidden="true"></i>
          <span data-i18n="nowPlaying.trackInfo">${t("nowPlaying.trackInfo")}</span>
        </button>
        <button type="button" data-action="add-folder">
          <i data-lucide="folder-plus" aria-hidden="true"></i>
          <span data-i18n="nowPlaying.addFolder">${t("nowPlaying.addFolder")}</span>
        </button>
        <button type="button" data-action="clear">
          <i data-lucide="trash-2" aria-hidden="true"></i>
          <span data-i18n="nowPlaying.clear">${t("nowPlaying.clear")}</span>
        </button>
      </div>
    </div>

    <section class="now-playing__scene-overlay now-playing__error" role="alert" hidden>
      <i data-lucide="triangle-alert" aria-hidden="true"></i>
      <p data-ui="error-message"></p>
      <div class="now-playing__error-actions">
        <button class="now-playing__retry" type="button" data-action="retry" data-i18n="nowPlaying.retry">${t("nowPlaying.retry")}</button>
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
            <i data-lucide="circle-x" aria-hidden="true"></i>
          </button>
        </div>
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
          <button type="button" data-action="set-library-filter" data-filter="missing" aria-pressed="false">
            <i data-lucide="file-warning" aria-hidden="true"></i>
            <span data-i18n="nowPlaying.library.filter.missing">${t("nowPlaying.library.filter.missing")}</span>
          </button>
        </div>
        <div class="player-library__header-actions" aria-label="${t("nowPlaying.library.actions")}">
          ${libraryActionButton("add-files", "fa-solid fa-file-audio", "nowPlaying.addFiles")}
          ${libraryActionButton("add-folder", "fa-solid fa-folder-plus", "nowPlaying.addFolder")}
          ${libraryActionButton("open-youtube-dialog", "fa-brands fa-youtube", "nowPlaying.youtube.add")}
          ${libraryActionButton("open-create-playlist-dialog", "fa-solid fa-plus", "nowPlaying.playlists.create", "player-library__action--primary")}
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

      <div class="player-library__body">
        <nav class="player-library__playlists" aria-labelledby="player-playlists-title">
          <div class="player-library__section-heading">
            <div>
              <span data-i18n="nowPlaying.playlists.kicker">${t("nowPlaying.playlists.kicker")}</span>
              <h2 id="player-playlists-title" data-i18n="nowPlaying.playlists.title">${t("nowPlaying.playlists.title")}</h2>
            </div>
            <span class="player-library__count" data-ui="library-playlist-count"></span>
          </div>
          <div class="player-library__playlist-grid" data-ui="library-playlists"></div>
          <section class="player-library__up-next" aria-labelledby="player-up-next-title">
            <div class="player-library__up-next-heading">
              <h3 id="player-up-next-title" data-i18n="nowPlaying.queue.upNext">${t("nowPlaying.queue.upNext")}</h3>
              <button type="button" data-action="clear-transient-queue" data-i18n="nowPlaying.queue.clear">${t("nowPlaying.queue.clear")}</button>
            </div>
            <div data-ui="transient-queue"></div>
          </section>
        </nav>

        <section class="player-library__collection" aria-labelledby="player-collection-title">
          <div class="player-library__collection-header">
            <div>
              <span class="player-library__collection-kicker" data-ui="active-playlist-type"></span>
              <h2 id="player-collection-title" data-ui="active-playlist-title"></h2>
            </div>
            <div class="player-library__collection-actions" data-ui="playlist-management-actions">
              ${libraryActionButton("open-rename-playlist-dialog", "fa-solid fa-pen", "nowPlaying.playlists.rename")}
              ${libraryActionButton("delete-playlist", "fa-solid fa-trash", "nowPlaying.playlists.delete")}
            </div>
          </div>
          <div class="player-library__results-bar">
            <span data-ui="active-playlist-summary"></span>
            <span data-ui="library-results-count" role="status" aria-live="polite"></span>
          </div>
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
            <i data-lucide="circle-play" aria-hidden="true"></i>
            <h3 data-i18n="nowPlaying.library.empty.title">${t("nowPlaying.library.empty.title")}</h3>
            <p data-i18n="nowPlaying.library.empty.hint">${t("nowPlaying.library.empty.hint")}</p>
            <ul aria-label="${t("nowPlaying.library.empty.canAdd")}">
              <li data-i18n="nowPlaying.audio">${t("nowPlaying.audio")}</li>
              <li data-i18n="nowPlaying.video">${t("nowPlaying.video")}</li>
              <li data-i18n="nowPlaying.addFolder">${t("nowPlaying.addFolder")}</li>
              <li>YouTube</li>
            </ul>
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
            <span data-ui="mini-artist"></span>
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
          ${iconButton("show-player", "fa-solid fa-up-right-and-down-left-from-center", "nowPlaying.library.openFullPlayer", "player-library__mini-control player-library__mini-open")}
        </div>
      </section>
    </section>
    <div class="now-playing__status" role="status" aria-live="polite"></div>
  `;
}

export default buildNowPlayingMarkup;
