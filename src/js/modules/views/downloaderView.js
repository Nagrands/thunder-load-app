// src/js/modules/views/downloaderView.js

import { t } from "../i18n.js";

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

    const backgroundLayer = document.createElement("div");
    backgroundLayer.id = "downloader-background-preview";
    backgroundLayer.className = "downloader-background-preview";
    backgroundLayer.setAttribute("aria-hidden", "true");
    backgroundLayer.innerHTML = `
      <video
        id="downloader-background-video-a"
        class="downloader-background-preview__video"
        muted
        autoplay
        loop
        playsinline
        preload="metadata"
        tabindex="-1"
        aria-hidden="true"
      >
        <source id="downloader-background-video-source-a" />
      </video>
      <video
        id="downloader-background-video-b"
        class="downloader-background-preview__video"
        muted
        autoplay
        loop
        playsinline
        preload="metadata"
        tabindex="-1"
        aria-hidden="true"
      >
        <source id="downloader-background-video-source-b" />
      </video>
      <div class="downloader-background-preview__overlay"></div>
    `;

    const glass = document.createElement("div");
    glass.className = "wg-glass";

    const shell = document.createElement("div");
    shell.className = "downloader-shell";

    const hdr = document.createElement("header");
    hdr.className = "downloader-shell-header";
    hdr.innerHTML = `
      <div class="downloader-shell-header__hero">
        <div class="title">
          <i class="fa-solid fa-download"></i>
          <div class="title-content">
            <h1 class="wg-text-gradient" data-i18n="downloader.title">${t("downloader.title")}</h1>
            <p class="subtitle" data-i18n="downloader.subtitle">
              ${t("downloader.subtitle")}
            </p>
          </div>
        </div>
      </div>
      <div class="downloader-shell-header__meta">
        <div
          id="downloader-job-summary"
          class="downloader-job-summary hidden"
          role="status"
          aria-live="polite"
        >
          <span
            id="downloader-job-summary-badge"
            class="downloader-job-summary__badge"
            data-i18n="downloader.jobSummary.badge"
          >${t("downloader.jobSummary.badge")}</span>
          <div class="downloader-job-summary__content">
            <strong id="downloader-job-summary-title">${t("downloader.jobSummary.idle")}</strong>
            <span id="downloader-job-summary-meta">${t("downloader.jobSummary.idleMeta")}</span>
          </div>
        </div>
      </div>
    `;

    shell.appendChild(hdr);
    glass.appendChild(shell);

    if (headerEl) glass.appendChild(headerEl);
    if (buttonGroup && !headerEl?.contains(buttonGroup)) {
      glass.appendChild(buttonGroup);
    }
    if (queueInfo) glass.appendChild(queueInfo);
    if (queueStart) glass.appendChild(queueStart);
    if (historySection) glass.appendChild(historySection);

    center.appendChild(glass);

    wrapper.innerHTML = "";
    wrapper.classList.add("downloader-view", "tab-content");
    wrapper.appendChild(backgroundLayer);
    wrapper.appendChild(center);

    wrapper.__dl_built = true;
  } catch (e) {
    console.warn("[ЗагрузчикView] build failed:", e);
  }

  return wrapper;
}
