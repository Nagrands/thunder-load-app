import { t } from "../i18n.js";

function iconButton(action, icon, labelKey, extraClass = "") {
  return `
    <button
      type="button"
      class="now-playing__control ${extraClass}"
      data-action="${action}"
      data-i18n-aria="${labelKey}"
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

      <section class="now-playing__dock" aria-label="${t("nowPlaying.controls")}">
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

    <section class="now-playing__scene-overlay now-playing__empty" aria-labelledby="now-playing-empty-title">
      <i class="fa-solid fa-circle-play" aria-hidden="true"></i>
      <h2 id="now-playing-empty-title" data-i18n="nowPlaying.empty.title">${t("nowPlaying.empty.title")}</h2>
      <p data-i18n="nowPlaying.empty.hint">${t("nowPlaying.empty.hint")}</p>
      <div class="now-playing__empty-actions">
        <button class="now-playing__empty-button" type="button" data-action="add-files" data-i18n="nowPlaying.addFiles">${t("nowPlaying.addFiles")}</button>
        <button class="now-playing__empty-button" type="button" data-action="add-folder" data-i18n="nowPlaying.addFolder">${t("nowPlaying.addFolder")}</button>
      </div>
    </section>
    <section class="now-playing__scene-overlay now-playing__error" role="alert" hidden>
      <i class="fa-solid fa-triangle-exclamation" aria-hidden="true"></i>
      <p data-ui="error-message"></p>
      <div class="now-playing__error-actions">
        <button class="now-playing__empty-button now-playing__retry" type="button" data-action="retry" data-i18n="nowPlaying.retry">${t("nowPlaying.retry")}</button>
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
          </div>
        </section>
      </div>

      <section class="player-library__mini-player" data-ui="mini-player" aria-label="${t("nowPlaying.miniPlayer")}" hidden>
        <div class="player-library__mini-artwork" aria-hidden="true">
          <img data-ui="mini-artwork" alt="" />
          <i class="fa-solid fa-circle-play"></i>
        </div>
        <div class="player-library__mini-metadata">
          <strong data-ui="mini-title"></strong>
          <span data-ui="mini-artist"></span>
        </div>
        <div class="player-library__mini-controls">
          ${iconButton("previous", "fa-solid fa-backward-step", "nowPlaying.previous")}
          ${iconButton("play-pause", "fa-solid fa-play", "nowPlaying.play", "now-playing__control--primary")}
          ${iconButton("next", "fa-solid fa-forward-step", "nowPlaying.next")}
        </div>
        <button class="player-library__return" type="button" data-action="show-player">
          <span data-i18n="nowPlaying.library.nowPlaying">${t("nowPlaying.library.nowPlaying")}</span>
          <i class="fa-solid fa-arrow-right" aria-hidden="true"></i>
        </button>
      </section>
    </section>

    <dialog class="player-library-dialog" data-ui="library-dialog" aria-labelledby="player-library-dialog-title">
      <form method="dialog" class="player-library-dialog__content" data-ui="library-dialog-form">
        <button
          class="player-library-dialog__close"
          type="button"
          data-action="close-library-dialog"
          data-i18n-aria="modal.close"
          aria-label="${t("modal.close")}"
        >
          <i class="fa-solid fa-xmark" aria-hidden="true"></i>
        </button>
        <span class="player-library-dialog__eyebrow" data-ui="library-dialog-eyebrow"></span>
        <h2 id="player-library-dialog-title" data-ui="library-dialog-title"></h2>
        <p data-ui="library-dialog-hint"></p>
        <label class="player-library-dialog__field">
          <span data-ui="library-dialog-label"></span>
          <input
            type="text"
            maxlength="2048"
            autocomplete="off"
            data-ui="library-dialog-input"
          />
          <select data-ui="library-dialog-select" hidden></select>
        </label>
        <div class="player-library-dialog__error" data-ui="library-dialog-error" role="alert" hidden></div>
        <div class="player-library-dialog__actions">
          <button type="button" class="player-library-dialog__secondary" data-action="close-library-dialog" data-i18n="modal.confirm.cancel">${t("modal.confirm.cancel")}</button>
          <button type="submit" class="player-library-dialog__primary" data-ui="library-dialog-submit"></button>
        </div>
      </form>
    </dialog>
    <div class="now-playing__status" role="status" aria-live="polite"></div>
  `;
}

export default buildNowPlayingMarkup;
