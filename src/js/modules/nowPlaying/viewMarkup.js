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

    <div class="now-playing__layout">
      <aside class="now-playing__sidebar" aria-labelledby="now-playing-title">
        <div class="now-playing__metadata">
          <span class="now-playing__now-label" data-i18n="nowPlaying.label">${t("nowPlaying.label")}</span>
          <div class="now-playing__track-heading">
            <div class="now-playing__track-copy">
              <h1 id="now-playing-title" class="now-playing__track-title">—</h1>
              <p class="now-playing__track-artist">—</p>
            </div>
          </div>
          <div class="now-playing__summary">
            <div class="now-playing__artwork-frame" aria-hidden="true">
              <img class="now-playing__artwork" alt="" hidden />
              <span class="now-playing__artwork-fallback">
                <i class="fa-solid fa-music"></i>
              </span>
            </div>
            <div class="now-playing__metadata-row">
              <i class="fa-solid fa-compact-disc" aria-hidden="true"></i>
              <span class="now-playing__album" data-ui="album"></span>
            </div>
          </div>
        </div>

        <div class="now-playing__playlist-section">
          <div class="now-playing__playlist-header">
            <div>
              <span class="now-playing__playlist-label" data-i18n="nowPlaying.playlist">${t("nowPlaying.playlist")}</span>
              <small data-ui="playlist-count"></small>
            </div>
            <div class="now-playing__playlist-actions">
              ${iconButton("add-files", "fa-solid fa-file-audio", "nowPlaying.addFiles")}
              ${iconButton("add-folder", "fa-solid fa-folder-plus", "nowPlaying.addFolder")}
              ${iconButton("clear", "fa-solid fa-trash", "nowPlaying.clear")}
            </div>
          </div>

          <div class="now-playing__playlist" role="listbox" aria-label="${t("nowPlaying.playlist")}"></div>
          <div class="now-playing__empty">
            <i class="fa-solid fa-music" aria-hidden="true"></i>
            <h2 data-i18n="nowPlaying.empty.title">${t("nowPlaying.empty.title")}</h2>
            <p data-i18n="nowPlaying.empty.hint">${t("nowPlaying.empty.hint")}</p>
            <div class="now-playing__empty-actions">
              <button class="now-playing__empty-button" type="button" data-action="add-files" data-i18n="nowPlaying.addFiles">${t("nowPlaying.addFiles")}</button>
              <button class="now-playing__empty-button" type="button" data-action="add-folder" data-i18n="nowPlaying.addFolder">${t("nowPlaying.addFolder")}</button>
            </div>
          </div>
          <div class="now-playing__error" role="alert" hidden>
            <i class="fa-solid fa-triangle-exclamation" aria-hidden="true"></i>
            <p data-ui="error-message"></p>
            <div class="now-playing__error-actions">
              <button class="now-playing__empty-button now-playing__retry" type="button" data-action="retry" data-i18n="nowPlaying.retry">${t("nowPlaying.retry")}</button>
            </div>
          </div>
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
        </div>
      </section>
    </div>
    <div class="now-playing__status" role="status" aria-live="polite"></div>
  `;
}

export default buildNowPlayingMarkup;
