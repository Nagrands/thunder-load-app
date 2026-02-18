// src/js/modules/views/downloaderView.js

/**
 * Build a glassy layout for the Загрузчик tab using the existing
 * UI elements and IDs (so all current logic keeps working).
 *
 * It does not change IDs, only rearranges DOM into a structure
 * similar to WG Unlock / Backup views.
 *
 * @param {HTMLElement} wrapper The existing downloader wrapper (#downloader-view)
 * @returns {HTMLElement} The enhanced wrapper element
 */
export default function renderDownloader(wrapper) {
  if (!wrapper) return wrapper;

  try {
    if (wrapper.__dl_built) return wrapper;

    const find = (sel) => wrapper.querySelector(sel);

    const headerEl = find("header");
    const buttonGroup = find("nav.button-group");
    const historySection = find("#history-container");
    const queueInfo = find("#download-queue-info");
    const queueStart = find("#queue-start-indicator");

    const center = document.createElement("div");
    center.className = "downloader-center";

    const glass = document.createElement("div");
    glass.className = "wg-glass";

    const shell = document.createElement("div");
    shell.className = "downloader-shell";

    const hdr = document.createElement("header");
    hdr.className = "downloader-shell-header";
    hdr.innerHTML = `
      <div class="title">
        <i class="fa-solid fa-download"></i>
        <div class="title-content">
          <h1 class="wg-text-gradient" data-i18n="downloader.title">Downloader</h1>
          <p class="subtitle" data-i18n="downloader.subtitle">
            Download video and audio from various sources
          </p>
        </div>
      </div>
    `;

    const toolsStatus = document.createElement("div");
    toolsStatus.className = "downloader-tools-status";
    toolsStatus.innerHTML = `
      <div class="status-line" id="dl-tools-status" role="status" aria-live="polite">
        <i class="fa-solid fa-circle-notch fa-spin" id="dl-tools-icon" aria-hidden="true"></i>
        <span id="dl-tools-text" data-i18n="downloader.tools.checking">
          Checking tools…
        </span>
        <div class="tool-badges" id="dl-tools-badges"></div>
      </div>
      <button
        type="button"
        id="dl-tools-toggle"
        title="Hide status"
        data-bs-toggle="tooltip"
        data-i18n-title="downloader.tools.hideTitle"
        aria-label="Hide tools status"
        data-i18n-aria="downloader.tools.hideAria"
      >
        <i class="fa-solid fa-xmark"></i>
      </button>
      <button
        type="button"
        id="dl-tools-reinstall"
        title="Reinstall dependencies (yt-dlp, ffmpeg, Deno)"
        data-bs-toggle="tooltip"
        data-i18n-title="downloader.tools.reinstallTitle"
      >
        <i class="fa-solid fa-arrow-rotate-right"></i>
        <span data-i18n="downloader.tools.reinstall">Reinstall</span>
      </button>
    `;

    shell.appendChild(hdr);
    shell.appendChild(toolsStatus);
    glass.appendChild(shell);

    if (headerEl) glass.appendChild(headerEl);
    if (buttonGroup) glass.appendChild(buttonGroup);
    if (queueInfo) glass.appendChild(queueInfo);
    if (queueStart) glass.appendChild(queueStart);
    if (historySection) glass.appendChild(historySection);

    center.appendChild(glass);

    wrapper.innerHTML = "";
    wrapper.classList.add("downloader-view", "tab-content");
    wrapper.appendChild(center);

    wrapper.__dl_built = true;
  } catch (e) {
    console.warn("[ЗагрузчикView] build failed:", e);
  }

  return wrapper;
}
