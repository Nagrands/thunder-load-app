// src/js/modules/views/downloaderView.js

/**
 * Build a glassy layout for the Downloader tab using the existing
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
    // Prevent double-build
    if (wrapper.__dl_built) return wrapper;

    const find = (sel) => wrapper.querySelector(sel);

    // Grab existing blocks we want to group
    const headerEl = find("header");
    const buttonGroup = find("nav.button-group");
    const historySection = find("#history-container");
    const queueInfo = find("#download-queue-info");
    const queueStart = find("#queue-start-indicator");

    // Create glass layout similar to other tabs
    const center = document.createElement("div");
    center.className = "downloader-center";

    const glass = document.createElement("div");
    glass.className = "wg-glass";

    // Header block (title + subtitle)
    const hdr = document.createElement("div");
    hdr.className = "downloader-header";
    hdr.innerHTML = `
      <div class="title">
        <i class="fa-solid fa-download"></i>
        <div class="text">
          <h2>Downloader</h2>
          <p class="subtitle">Загрузка видео и аудио из различных источников</p>
        </div>
      </div>`;

    // Tools readiness status (yt-dlp / ffmpeg)
    const toolsStatus = document.createElement("div");
    toolsStatus.className = "downloader-tools-status";
    toolsStatus.innerHTML = `
      <div class="status-line" id="dl-tools-status" role="status" aria-live="polite">
        <i class="fa-solid fa-circle-notch fa-spin" id="dl-tools-icon" aria-hidden="true"></i>
        <span id="dl-tools-text">Проверяем инструменты…</span>
        <div class="tool-badges" id="dl-tools-badges"></div>
      </div>
      <button
        type="button"
        class="btn btn-ghost btn-sm"
        id="dl-tools-reinstall"
        title="Переустановить зависимости (yt-dlp, ffmpeg, Deno)"
        data-bs-toggle="tooltip"
      >
        <i class="fa-solid fa-arrow-rotate-right"></i>
        <span>Переустановить</span>
      </button>
    `;
    hdr.appendChild(toolsStatus);

    // Compose sections in order
    glass.appendChild(hdr);
    if (headerEl) glass.appendChild(headerEl);
    if (buttonGroup) glass.appendChild(buttonGroup);
    if (queueInfo) glass.appendChild(queueInfo);
    if (queueStart) glass.appendChild(queueStart);
    if (historySection) glass.appendChild(historySection);

    center.appendChild(glass);

    // Move everything else (if any) below, but keep modals etc. separate
    wrapper.innerHTML = "";
    wrapper.classList.add("downloader-view", "tab-content");
    wrapper.appendChild(center);

    wrapper.__dl_built = true;
  } catch (e) {
    console.warn("[DownloaderView] build failed:", e);
  }

  return wrapper;
}
