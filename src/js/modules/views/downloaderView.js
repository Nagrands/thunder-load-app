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
    hdr.className = "wg-header";
    hdr.innerHTML = `
      <div class="title">
        <i class="fa-solid fa-download"></i>
        <div class="text">
          <h2>Downloader</h2>
          <p class="subtitle text-muted">Загрузка видео и аудио из различных источников</p>
        </div>
      </div>`;

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
