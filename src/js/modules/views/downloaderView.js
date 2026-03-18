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

    const toolsStatus = document.createElement("div");
    toolsStatus.className = "downloader-tools-status";
    toolsStatus.innerHTML = `
      <div
        class="status-line downloader-tools-status__line"
        id="dl-tools-status"
        role="status"
        aria-live="polite"
      >
        <i
          class="fa-solid fa-circle-notch fa-spin downloader-tools-status__state-icon"
          id="dl-tools-icon"
          aria-hidden="true"
        ></i>
        <span
          id="dl-tools-text"
          class="downloader-tools-status__text"
          data-i18n="downloader.tools.checking"
        >
          ${t("downloader.tools.checking")}
        </span>
        <div
          class="tool-badges downloader-tools-status__badges"
          id="dl-tools-badges"
        ></div>
      </div>
      <button
        type="button"
        class="downloader-tools-status__toggle"
        id="dl-tools-toggle"
        title="${t("downloader.tools.hideTitle")}"
        data-bs-toggle="tooltip"
        data-i18n-title="downloader.tools.hideTitle"
        aria-label="${t("downloader.tools.hideAria")}"
        data-i18n-aria="downloader.tools.hideAria"
      >
        <i class="fa-solid fa-xmark"></i>
      </button>
      <button
        type="button"
        class="downloader-tools-status__reinstall"
        id="dl-tools-reinstall"
        title="${t("downloader.tools.reinstallTitle")}"
        data-bs-toggle="tooltip"
        data-i18n-title="downloader.tools.reinstallTitle"
      >
        <i class="fa-solid fa-arrow-rotate-right"></i>
        <span data-i18n="downloader.tools.reinstall">${t("downloader.tools.reinstall")}</span>
      </button>
    `;

    hdr
      .querySelector(".downloader-shell-header__meta")
      ?.appendChild(toolsStatus);

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
    wrapper.appendChild(center);

    wrapper.__dl_built = true;
  } catch (e) {
    console.warn("[ЗагрузчикView] build failed:", e);
  }

  return wrapper;
}
