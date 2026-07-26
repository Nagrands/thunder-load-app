import { t } from "../i18n.js";

function iconButton(action, icon, labelKey, extraClass = "") {
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
    >
      <i class="${icon}" aria-hidden="true"></i>
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
      <i class="${icon}" aria-hidden="true"></i>
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

    <div
      class="now-playing__topbar-reveal-zone"
      tabindex="0"
      aria-label="${t("topbar.nav")}"
    ></div>
    <div
      class="now-playing__sidebar-reveal-zone"
      tabindex="0"
      aria-label="${t("nowPlaying.playlist")}"
    ></div>

    <div class="now-playing__layout">
      <aside class="now-playing__sidebar" aria-label="${t("nowPlaying.playlist")}">
        <button
          class="now-playing__view-switch"
          type="button"
          data-action="show-library"
          data-i18n-aria="nowPlaying.library.open"
          aria-label="${t("nowPlaying.library.open")}"
        >
          <i class="fa-solid fa-photo-film" aria-hidden="true"></i>
          <span data-i18n="nowPlaying.library.title">${t("nowPlaying.library.title")}</span>
        </button>
        <span class="now-playing__brand-label" data-ui="brand-label">${t("nowPlaying.label")}</span>
        <div class="now-playing__library-heading">
          <label class="now-playing__playlist-switcher">
            <span data-i18n="nowPlaying.playlists.active">${t("nowPlaying.playlists.active")}</span>
            <span class="now-playing__playlist-select-shell">
              <i class="fa-solid fa-list" aria-hidden="true"></i>
              <select
                class="now-playing__library-title"
                data-ui="sidebar-playlist-switcher"
                data-i18n-aria="nowPlaying.playlists.select"
                aria-label="${t("nowPlaying.playlists.select")}"
                aria-controls="now-playing-sidebar-queue"
              ></select>
              <i class="fa-solid fa-chevron-down" aria-hidden="true"></i>
            </span>
          </label>
          <span class="now-playing__library-count" data-ui="playlist-count"></span>
        </div>

        <div class="now-playing__track-stage">
          <div class="now-playing__artwork-stack" aria-hidden="true" hidden>
            ${artworkLayer(0)}
            ${artworkLayer(1)}
          </div>
          <div class="now-playing__metadata-stage" aria-live="polite">
            ${metadataSlot(0)}
            ${metadataSlot(1)}
          </div>
        </div>

        <div class="now-playing__playlist-section">
          <div class="now-playing__playlist-header">
            <span class="now-playing__playlist-label" data-i18n="nowPlaying.playlist">${t("nowPlaying.playlist")}</span>
            <div class="now-playing__playlist-actions">
              ${iconButton("background-playback", "fa-solid fa-headphones", "nowPlaying.backgroundPlayback", "now-playing__preference-control")}
              ${iconButton("pin-sidebar", "fa-solid fa-thumbtack", "nowPlaying.pinSidebar", "now-playing__preference-control")}
              ${iconButton("add-files", "fa-solid fa-file-audio", "nowPlaying.addFiles")}
              ${iconButton("add-folder", "fa-solid fa-folder-plus", "nowPlaying.addFolder")}
              ${iconButton("clear", "fa-solid fa-trash", "nowPlaying.clear")}
            </div>
          </div>
          <div class="now-playing__playlist" id="now-playing-sidebar-queue" role="listbox" aria-label="${t("nowPlaying.playlist")}"></div>
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
          <span class="now-playing__time" data-ui="duration">0:00</span>
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
          ${iconButton("fullscreen", "fa-solid fa-expand", "nowPlaying.enterFullscreen", "now-playing__control--fullscreen")}
        </div>
      </section>
    </div>

    <section class="now-playing__scene-overlay now-playing__error" role="alert" hidden>
      <i class="fa-solid fa-triangle-exclamation" aria-hidden="true"></i>
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
        <div>
          <span class="player-library__eyebrow" data-i18n="tabs.nowPlaying">${t("tabs.nowPlaying")}</span>
          <h1 id="player-library-title" tabindex="-1" data-i18n="nowPlaying.library.title">${t("nowPlaying.library.title")}</h1>
          <p data-i18n="nowPlaying.library.subtitle">${t("nowPlaying.library.subtitle")}</p>
        </div>
        <div class="player-library__header-actions" aria-label="${t("nowPlaying.library.actions")}">
          ${libraryActionButton("add-files", "fa-solid fa-file-audio", "nowPlaying.addFiles")}
          ${libraryActionButton("add-folder", "fa-solid fa-folder-plus", "nowPlaying.addFolder")}
          ${libraryActionButton("open-youtube-dialog", "fa-brands fa-youtube", "nowPlaying.youtube.add")}
          ${libraryActionButton("open-create-playlist-dialog", "fa-solid fa-plus", "nowPlaying.playlists.create", "player-library__action--primary")}
          <button
            class="player-library__close"
            type="button"
            data-action="show-player"
            data-i18n-aria="nowPlaying.library.close"
            aria-label="${t("nowPlaying.library.close")}"
          >
            <i class="fa-solid fa-xmark" aria-hidden="true"></i>
          </button>
        </div>
      </header>
      <div
        class="player-library__operation-status"
        data-ui="library-operation-status"
        role="status"
        aria-live="polite"
        hidden
      >
        <i class="fa-solid fa-spinner fa-spin" aria-hidden="true"></i>
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
              <p data-ui="active-playlist-summary"></p>
            </div>
            <div class="player-library__collection-actions" data-ui="playlist-management-actions">
              ${libraryActionButton("open-rename-playlist-dialog", "fa-solid fa-pen", "nowPlaying.playlists.rename")}
              ${libraryActionButton("delete-playlist", "fa-solid fa-trash", "nowPlaying.playlists.delete")}
            </div>
          </div>
          <div
            class="player-library__tracks"
            data-ui="library-tracks"
            role="listbox"
            aria-label="${t("nowPlaying.library.items")}"
          ></div>
          <div class="player-library__empty" data-ui="library-empty" hidden>
            <i class="fa-solid fa-circle-play" aria-hidden="true"></i>
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
        </section>
      </div>

      <section class="player-library__mini-player" data-ui="mini-player" aria-label="${t("nowPlaying.miniPlayer")}" hidden>
        <div class="player-library__mini-identity">
          <div class="player-library__mini-artwork" aria-hidden="true">
            <img data-ui="mini-artwork" alt="" />
            <i class="fa-solid fa-music"></i>
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
