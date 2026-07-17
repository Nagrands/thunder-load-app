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
      <span class="now-playing__artwork-fallback">
        <i class="fa-solid fa-music"></i>
      </span>
    </div>
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
        <span class="now-playing__brand-label" data-ui="brand-label">${t("nowPlaying.label")}</span>
        <div class="now-playing__library-heading">
          <h2 class="now-playing__library-title" data-i18n="nowPlaying.libraryTitle">${t("nowPlaying.libraryTitle")}</h2>
          <span class="now-playing__library-count" data-ui="playlist-count"></span>
        </div>

        <div class="now-playing__track-stage">
          <div class="now-playing__artwork-stack" aria-hidden="true">
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
          <div class="now-playing__playlist" role="listbox" aria-label="${t("nowPlaying.playlist")}"></div>
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
          ${iconButton("fullscreen", "fa-solid fa-expand", "nowPlaying.enterFullscreen", "now-playing__control--fullscreen")}
        </div>
      </section>
    </div>

    <section class="now-playing__scene-overlay now-playing__empty" aria-labelledby="now-playing-empty-title">
      <i class="fa-solid fa-music" aria-hidden="true"></i>
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
    <div class="now-playing__status" role="status" aria-live="polite"></div>
  `;
}

export default buildNowPlayingMarkup;
