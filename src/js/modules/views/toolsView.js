// src/js/modules/views/toolsView.js

import { showToast } from "../toast.js";
import { showConfirmationDialog } from "../modals.js";
import { initTooltips } from "../tooltipInitializer.js";
import { applyI18n, getLanguage, t } from "../i18n.js";
import { consumeRequestedToolsView } from "../toolsNavigation.js";
import {
  deactivateToolsInfo,
  destroyToolsInfo,
  refreshToolsInfoState,
  renderToolsInfo,
} from "../toolsInfo.js";
import renderBackup from "./backupView.js";
import {
  initMediaConverterSection,
  renderMediaConverterSection,
} from "./tools/mediaConverterSection.js";
import { initMediaInspectorSection } from "./tools/mediaInspectorSection.js";
import {
  initHashCheckSection,
  renderHashCheckSection,
} from "./tools/hashCheckSection.js";
import { createCleanupRegistry } from "./tools/cleanupRegistry.js";
import { createToolsEntranceAnimation } from "./tools/toolsEntranceAnimation.js";
import { TOOLS_STORAGE_KEYS } from "./tools/storage.js";
import { createLogController } from "./tools/logController.js";
import { createToolViewState } from "./tools/toolViewState.js";
import {
  acquireDocumentScrollLock,
  releaseDocumentScrollLock,
} from "../scrollLockManager.js";

export default function renderToolsView() {
  const T0 = performance.now();

  const getEl = (id, root = document) => root.querySelector(`#${id}`);
  const isValidIp = (ip) => {
    return /^((25[0-5]|2[0-4]\d|1?\d{1,2})(\.|$)){4}$/.test(ip.trim());
  };

  // Проверяем доступность Electron API
  if (!window.electron?.ipcRenderer) {
    const container = document.createElement("div");
    container.className = "wg-center";
    container.innerHTML = `<div class="wg-card"><p class="error">${t("wg.error.electronUnavailable")}</p></div>`;
    return container;
  }

  const fields = [
    {
      id: "wg-ip",
      labelKey: "wg.field.ip.label",
      key: "ip",
      type: "text",
      placeholderKey: "wg.field.ip.placeholder",
      hintKey: "wg.field.ip.hint",
      icon: "fa-network-wired",
    },
    {
      id: "wg-port-remote",
      labelKey: "wg.field.remotePort.label",
      key: "rPort",
      type: "number",
      placeholderKey: "wg.field.remotePort.placeholder",
      hintKey: "wg.field.remotePort.hint",
      icon: "fa-signal",
    },
    {
      id: "wg-port-local",
      labelKey: "wg.field.localPort.label",
      key: "lPort",
      type: "number",
      placeholderKey: "wg.field.localPort.placeholder",
      hintKey: "wg.field.localPort.hint",
      icon: "fa-plug",
    },
  ];

  const toast = (msg, success = true) =>
    showToast(msg, success ? "success" : "error");

  const isValidPort = (val) => val >= 1 && val <= 65535;

  const container = document.createElement("div");
  container.className = "wg-center";

  const view = document.createElement("div");
  view.id = "wireguard-view";
  view.className = "wireguard-view";

  const cleanup = createCleanupRegistry();
  const toolState = createToolViewState();
  const toolNavigationItems = [
    ["launcher", "fa-grip", "tools.sidebar.all"],
    ["downloader-tools", "fa-download", "tools.nav.current.downloaderTools"],
    ["wg", "fa-globe", "tools.nav.current.wg"],
    ["hash", "fa-fingerprint", "tools.nav.current.hash"],
    ["media-converter", "fa-right-left", "tools.nav.current.mediaConverter"],
    ["media-inspector", "fa-film", "tools.nav.current.mediaInspector"],
    ["backup", "fa-box-archive", "tools.nav.current.backup"],
  ];
  const renderToolNavigation = (className) => toolNavigationItems.map(
    ([tool, icon, labelKey]) => `<button type="button" class="${className}" data-tool-nav="${tool}" data-i18n-title="${labelKey}" title="${t(labelKey)}" aria-label="${t(labelKey)}"><i class="fa-solid ${icon}" aria-hidden="true"></i><span data-i18n="${labelKey}">${t(labelKey)}</span></button>`,
  ).join("");
  let desktopToolNavigation = null;

  const mountDesktopToolNavigation = () => {
    const groupMenu = document.querySelector(".group-menu");
    const toolsTab = groupMenu?.querySelector('[data-menu="wireguard"]');
    if (!groupMenu || !toolsTab) return;
    desktopToolNavigation?.remove();
    desktopToolNavigation = document.createElement("nav");
    desktopToolNavigation.className = "app-sidebar__tools-nav";
    desktopToolNavigation.setAttribute("aria-label", t("tools.sidebar.aria"));
    desktopToolNavigation.setAttribute("role", "group");
    desktopToolNavigation.innerHTML = renderToolNavigation("app-sidebar__tool-item");
    toolsTab.insertAdjacentElement("afterend", desktopToolNavigation);
    const syncVisibility = (event) => {
      desktopToolNavigation?.classList.toggle(
        "is-visible",
        String(event?.detail?.id || "") === "wireguard",
      );
    };
    cleanup.onWindowEvent("tabs:activated", syncVisibility);
    syncVisibility({ detail: { id: document.querySelector(".group-menu .menu-item.active")?.dataset?.menu } });
    cleanup.addCleanup(() => {
      desktopToolNavigation?.remove();
      desktopToolNavigation = null;
    });
    desktopToolNavigation.addEventListener("click", (event) => {
      const button = event.target.closest("[data-tool-nav]");
      if (!button || !desktopToolNavigation.contains(button)) return;
      const nextView = button.dataset.toolNav;
      selectToolView(nextView);
    });
  };
  const logController = createLogController({ view, getEl, t });
  const log = logController.log;
  const clearLog = logController.clearLog;
  const loadLog = logController.loadLog;
  const loadLastSendTime = logController.loadLastSendTime;
  const updateLastSendTime = logController.updateLastSendTime;
  const updateLogControls = logController.updateLogControls;
  const setLogErrorOnly = logController.setErrorOnly;
  const setLogAutoScroll = logController.setAutoScroll;
  const getLogText = logController.getLogText;

  let currentMsg = ")";
  let tipsIntervalId = null;
  let tipsSwapTimer = null;
  let tipsFadeTimer = null;
  let tipsPaused = false;
  let tipsItems = [];
  let tipsIndex = 0;
  const WG_HOWTO_SCROLL_LOCK_OWNER = "tools-howto-wg";

  const disposeView = () => {
    destroyToolsInfo();
    releaseDocumentScrollLock(WG_HOWTO_SCROLL_LOCK_OWNER);
    tipsIntervalId = cleanup.clearInterval(tipsIntervalId);
    tipsSwapTimer = cleanup.clearTimeout(tipsSwapTimer);
    tipsFadeTimer = cleanup.clearTimeout(tipsFadeTimer);
    cleanup.dispose();
  };

  const getPayload = () => {
    const payload = fields.reduce((acc, f) => {
      const val = getEl(f.id, view)?.value || "";
      acc[f.key] = f.type === "number" ? Number(val) : val.trim();
      return acc;
    }, {});
    payload.msg = currentMsg;
    return payload;
  };

  const saveConfig = (key, value) =>
    window.electron.ipcRenderer.send("wg-set-config", { key, val: value });

  function createInputField(f) {
    const labelText = t(f.labelKey);
    const placeholderText = f.placeholderKey ? t(f.placeholderKey) : "";
    const hintText = f.hintKey ? t(f.hintKey) : "";
    return `
    <div class="wg-field">
      <label class="label">
        <i class="fa-solid ${f.icon}"></i>
        <span class="label-text" data-i18n="${f.labelKey}">${labelText}</span>
      </label>
      <div class="input-with-clear">
        <input 
          id="${f.id}" 
          class="input" 
          type="${f.type}" 
          placeholder="${placeholderText}" 
          data-i18n-placeholder="${f.placeholderKey || ""}"
          aria-label="${labelText}"
          data-i18n-aria="${f.labelKey}"
        />
        <button
          type="button"
          class="clear-field-btn"
          data-target="#${f.id}"
          data-bs-toggle="tooltip"
          data-bs-placement="top"
          title="${t("wg.field.clear.title")}"
          data-i18n-title="wg.field.clear.title"
        >
          <i class="fa-solid fa-times"></i>
        </button>
      </div>
      <div class="field-hint" data-i18n="${f.hintKey || ""}">${hintText}</div>
      <div class="field-error" data-error-for="${f.id}"></div>
    </div>
  `;
  }

  const updateConnectionStatus = (status, isError = false) => {
    const statusEl = getEl("wg-connection-status", view);
    if (statusEl) {
      statusEl.textContent = status;
      statusEl.className = isError ? "status-error" : "status-success";
    }
  };

  const markFieldError = (id, hasError = true, message = "") => {
    const el = getEl(id, view);
    const errBox = view.querySelector(`.field-error[data-error-for="${id}"]`);
    if (!el || !errBox) return;
    el.classList.toggle("input-error", hasError);
    errBox.textContent = hasError ? message : "";
    if (hasError) el.focus();
  };

  const withTimeout = (promise, ms = 5000) => {
    let timer;
    return Promise.race([
      promise,
      new Promise((_, reject) => {
        timer = cleanup.setTimeout(
          () => reject(new Error(t("wg.error.timeoutWaiting"))),
          ms,
        );
      }),
    ]).finally(() => cleanup.clearTimeout(timer));
  };

  const humanizeError = (msg) => {
    if (!msg) return t("wg.error.unknown");
    if (msg.includes("EADDRINUSE")) return t("wg.error.portInUse");
    if (msg.includes("ENETUNREACH")) return t("wg.error.networkUnreachable");
    if (msg.includes("ECONNREFUSED")) return t("wg.error.connectionRefused");
    if (msg.toLowerCase().includes("timeout")) return t("wg.error.timeout");
    return msg;
  };

  // =============================================
  // ОСНОВНОЙ HTML
  // =============================================

  const fieldsHtml = fields.map(createInputField).join("");

  view.innerHTML = `
  <header
        id="tools-launcher-header"
        class="tools-shell-header"
        data-ui="tools-entrance-header"
      >
        <div class="tab-hero tools-hero">
          <div class="tab-hero__content tools-hero__content">
            <span class="tab-hero__icon tools-hero__icon" aria-hidden="true">
              <i class="fa-solid fa-screwdriver-wrench"></i>
            </span>
            <div class="title-content">
              <h1 class="wg-text-gradient" data-i18n="wg.title">${t("wg.title")}</h1>
              <p class="subtitle" data-i18n="wg.subtitle">${t("wg.subtitle")}</p>
            </div>
          </div>
          <div class="tab-hero__art tools-hero__art" aria-hidden="true">
            <img
              src="../assets/img/tools-hero.png"
              alt=""
              draggable="false"
              width="1717"
              height="916"
            />
          </div>
        </div>
      </header>
    <div class="tools-shell" data-ui="tools-entrance-root">
      <aside class="tools-sidebar" aria-label="${t("tools.sidebar.aria")}">
        <div class="tools-sidebar__brand">
          <span class="tools-sidebar__brand-icon" aria-hidden="true">
            <i class="fa-solid fa-screwdriver-wrench"></i>
          </span>
          <div>
            <strong data-i18n="tools.title">${t("tools.title")}</strong>
          </div>
          <button
            id="tools-sidebar-toggle"
            type="button"
            class="tools-sidebar__toggle"
            aria-expanded="false"
            aria-controls="tools-sidebar-navigation"
            data-i18n-title="tools.sidebar.toggle"
            data-i18n-aria="tools.sidebar.toggle"
            title="${t("tools.sidebar.toggle")}"
            aria-label="${t("tools.sidebar.toggle")}"
          >
            <i class="fa-solid fa-chevron-down" aria-hidden="true"></i>
          </button>
        </div>
        <nav id="tools-sidebar-navigation" class="tools-sidebar__navigation" aria-label="${t("tools.sidebar.aria")}">
          ${renderToolNavigation("tools-sidebar__item")}
        </nav>
      </aside>

      <main class="tools-workspace">

      <div
        id="tools-launcher-section-header"
        class="tools-launcher-section-header"
        data-ui="tools-entrance-header"
      >
        <h2 class="tools-launcher-section-title" data-i18n="tools.launcher.availableTitle">${t("tools.launcher.availableTitle")}</h2>
        <span id="tools-launcher-tools-count" class="tools-launcher-tools-count" data-i18n="tools.launcher.totalLabel">${t("tools.launcher.totalLabel")}</span>
      </div>

      <section id="tools-launcher" class="tools-launcher" aria-label="${t("tools.launcher.title")}">
        <div class="tools-launcher-inner">
          <div class="tools-launcher-grid">
            <button id="tools-open-downloader-tools" type="button" class="tools-launcher-button" data-ui="tools-launcher-card">
              <span class="tools-launcher-button__icon"><i class="fa-solid fa-download" aria-hidden="true"></i></span>
              <i class="tools-launcher-button__arrow fa-solid fa-arrow-up-right-from-square" aria-hidden="true"></i>
              <span class="tools-launcher-button__title" data-i18n="tools.launcher.open.downloaderTools">${t("tools.launcher.open.downloaderTools")}</span>
              <small class="tools-launcher-button__desc" data-i18n="tools.launcher.desc.downloaderTools">${t("tools.launcher.desc.downloaderTools")}</small>
            </button>
            <button id="tools-open-media-converter" type="button" class="tools-launcher-button" data-ui="tools-launcher-card">
              <span class="tools-launcher-button__icon"><i class="fa-solid fa-right-left" aria-hidden="true"></i></span>
              <i class="tools-launcher-button__arrow fa-solid fa-arrow-up-right-from-square" aria-hidden="true"></i>
              <span class="tools-launcher-button__title" data-i18n="tools.launcher.open.mediaConverter">${t("tools.launcher.open.mediaConverter")}</span>
              <small class="tools-launcher-button__desc" data-i18n="tools.launcher.desc.mediaConverter">${t("tools.launcher.desc.mediaConverter")}</small>
            </button>
            <button id="tools-open-hash" type="button" class="tools-launcher-button" data-ui="tools-launcher-card">
              <span class="tools-launcher-button__icon"><i class="fa-solid fa-fingerprint" aria-hidden="true"></i></span>
              <i class="tools-launcher-button__arrow fa-solid fa-arrow-up-right-from-square" aria-hidden="true"></i>
              <span class="tools-launcher-button__title" data-i18n="tools.launcher.open.hash">Hash Check</span>
              <small class="tools-launcher-button__desc" data-i18n="tools.launcher.desc.hash">${t("tools.launcher.desc.hash")}</small>
            </button>
            <button id="tools-open-backup" type="button" class="tools-launcher-button" data-ui="tools-launcher-card">
              <span class="tools-launcher-button__icon"><i class="fa-solid fa-box-archive" aria-hidden="true"></i></span>
              <i class="tools-launcher-button__arrow fa-solid fa-arrow-up-right-from-square" aria-hidden="true"></i>
              <span class="tools-launcher-button__title" data-i18n="tools.launcher.open.backup">Backup</span>
              <small class="tools-launcher-button__desc" data-i18n="tools.launcher.desc.backup">${t("tools.launcher.desc.backup")}</small>
            </button>
            <button id="tools-open-media-inspector" type="button" class="tools-launcher-button" data-ui="tools-launcher-card">
              <span class="tools-launcher-button__icon"><i class="fa-solid fa-film" aria-hidden="true"></i></span>
              <i class="tools-launcher-button__arrow fa-solid fa-arrow-up-right-from-square" aria-hidden="true"></i>
              <span class="tools-launcher-button__title" data-i18n="tools.launcher.open.mediaInspector">Media Inspector</span>
              <small class="tools-launcher-button__desc" data-i18n="tools.launcher.desc.mediaInspector">${t("tools.launcher.desc.mediaInspector")}</small>
            </button>
            <button id="tools-open-wg" type="button" class="tools-launcher-button" data-ui="tools-launcher-card">
              <span class="tools-launcher-button__icon"><i class="fa-solid fa-satellite-dish" aria-hidden="true"></i></span>
              <i class="tools-launcher-button__arrow fa-solid fa-arrow-up-right-from-square" aria-hidden="true"></i>
              <span class="tools-launcher-button__title" data-i18n="tools.launcher.open.wg">WG Unlock</span>
              <small class="tools-launcher-button__desc" data-i18n="tools.launcher.desc.wg">${t("tools.launcher.desc.wg")}</small>
            </button>
          </div>

          <div
            id="tools-launcher-unavailable-section"
            class="tools-launcher-unavailable-section"
          >
            <h3
              class="tools-launcher-unavailable-title"
              data-i18n="tools.launcher.unavailableTitle"
            >
              ${t("tools.launcher.unavailableTitle")}
            </h3>
            <div class="tools-launcher-unavailable-grid"></div>
          </div>
        </div>
      </section>

      <section id="tools-views" class="tools-views">
        <section class="tools-view hidden" data-tool-view="wg" aria-label="${t("tools.nav.current.wg")}">
          <article class="tools-card tools-card-wg-quick tools-detail-card">
            <div class="tools-card__header">
              <h2 data-i18n="tools.wg.quick.title">${t("tools.wg.quick.title")}</h2>
              <div class="tools-card__header-actions">
                <button
                  id="wg-open-howto"
                  type="button"
                  class="small-button wg-howto-open"
                  data-bs-toggle="tooltip"
                  data-bs-placement="top"
                  data-i18n-title="tools.wg.howto.open"
                  data-i18n-aria="tools.wg.howto.open"
                  title="${t("tools.wg.howto.open")}"
                  aria-label="${t("tools.wg.howto.open")}"
                >
                  <i class="fa-regular fa-circle-question"></i>
                </button>
                <button
                  id="tools-wg-advanced-toggle"
                  type="button"
                  class="small-button"
                  aria-controls="tools-wg-advanced-panel"
                  aria-expanded="false"
                  data-i18n="tools.wg.advanced.toggle.open"
                >
                  ${t("tools.wg.advanced.toggle.open")}
                </button>
              </div>
            </div>
            <p class="tools-card__hint" data-i18n="tools.wg.quick.hint">${t("tools.wg.quick.hint")}</p>
            <div class="tools-card__meta">
              <div>
                <span data-i18n="wg.lastSend.title">${t("wg.lastSend.title")}</span>
                <strong id="wg-last-send-time" data-i18n="wg.lastSend.never">${t("wg.lastSend.never")}</strong>
              </div>
              <div>
                <span data-i18n="wg.status.title">${t("wg.status.title")}</span>
                <strong id="wg-connection-status" data-i18n="wg.status.inactive">${t("wg.status.inactive")}</strong>
              </div>
            </div>
            <div class="tools-card__actions buttons">
              <button id="wg-send" class="large-button">
                <i class="fa-solid fa-paper-plane"></i>
                <span data-i18n="wg.action.send">${t("wg.action.send")}</span>
              </button>
            </div>
            <div class="tools-card__secondary">
              <span class="tools-card__secondary-label" data-i18n="wg.actions.more">${t("wg.actions.more")}</span>
              <div class="tools-card__secondary-actions">
              <button id="wg-reset" class="small-button" data-bs-toggle="tooltip" data-bs-placement="top" title="${t("wg.action.reset.title")}" data-i18n-title="wg.action.reset.title">
                <i class="fa-solid fa-rotate-left"></i>
              </button>
              <button id="wg-open-config-file" class="small-button" data-bs-toggle="tooltip" data-bs-placement="top" title="${t("wg.action.editConfig.title")}" data-i18n-title="wg.action.editConfig.title">
                <i class="fa-solid fa-file-edit"></i>
              </button>
              <button id="wg-open-network-settings" class="small-button hidden" data-bs-toggle="tooltip" data-bs-placement="top" title="${t("wg.action.openNetworkSettings.title")}" data-i18n-title="wg.action.openNetworkSettings.title">
                <i class="fa-solid fa-network-wired"></i>
              </button>
              </div>
            </div>
            <div id="wg-status-indicator" class="hidden" role="status" aria-live="polite"></div>
            <div id="wg-howto-modal" class="wg-howto-overlay hidden" aria-hidden="true">
              <div
                id="wg-howto-dialog"
                class="wg-howto-dialog"
                role="dialog"
                aria-modal="true"
                aria-hidden="true"
                aria-labelledby="wg-howto-title"
                tabindex="-1"
              >
                <div class="wg-howto-header">
                  <h3 id="wg-howto-title" data-i18n="tools.wg.howto.title">${t("tools.wg.howto.title")}</h3>
                  <button id="wg-howto-close" type="button" class="small-button" data-i18n-aria="tools.wg.howto.close" aria-label="${t("tools.wg.howto.close")}">
                    <i class="fa-solid fa-xmark"></i>
                  </button>
                </div>
                <div id="wg-howto-step" class="wg-howto-step muted"></div>
                <div class="wg-howto-viewport">
                  <div id="wg-howto-track" class="wg-howto-track">
                    <article class="wg-howto-slide" data-howto-slide="0">
                      <div class="wg-howto-slide__icon"><i class="fa-solid fa-pen-to-square"></i></div>
                      <h4 data-i18n="tools.wg.howto.slide1.title">${t("tools.wg.howto.slide1.title")}</h4>
                      <p data-i18n="tools.wg.howto.slide1.desc">${t("tools.wg.howto.slide1.desc")}</p>
                    </article>
                    <article class="wg-howto-slide" data-howto-slide="1">
                      <div class="wg-howto-slide__icon"><i class="fa-solid fa-paper-plane"></i></div>
                      <h4 data-i18n="tools.wg.howto.slide2.title">${t("tools.wg.howto.slide2.title")}</h4>
                      <p data-i18n="tools.wg.howto.slide2.desc">${t("tools.wg.howto.slide2.desc")}</p>
                    </article>
                    <article class="wg-howto-slide" data-howto-slide="2">
                      <div class="wg-howto-slide__icon"><i class="fa-solid fa-chart-line"></i></div>
                      <h4 data-i18n="tools.wg.howto.slide3.title">${t("tools.wg.howto.slide3.title")}</h4>
                      <p data-i18n="tools.wg.howto.slide3.desc">${t("tools.wg.howto.slide3.desc")}</p>
                    </article>
                    <article class="wg-howto-slide" data-howto-slide="3">
                      <div class="wg-howto-slide__icon"><i class="fa-regular fa-file-lines"></i></div>
                      <h4 data-i18n="tools.wg.howto.slide4.title">${t("tools.wg.howto.slide4.title")}</h4>
                      <p data-i18n="tools.wg.howto.slide4.desc">${t("tools.wg.howto.slide4.desc")}</p>
                    </article>
                  </div>
                </div>
                <div id="wg-howto-dots" class="wg-howto-dots" role="tablist" data-i18n-aria="tools.wg.howto.title" aria-label="${t("tools.wg.howto.title")}">
                  <button type="button" class="wg-howto-dot" data-index="0" aria-label="${t("tools.wg.howto.step", { current: 1, total: 4 })}"></button>
                  <button type="button" class="wg-howto-dot" data-index="1" aria-label="${t("tools.wg.howto.step", { current: 2, total: 4 })}"></button>
                  <button type="button" class="wg-howto-dot" data-index="2" aria-label="${t("tools.wg.howto.step", { current: 3, total: 4 })}"></button>
                  <button type="button" class="wg-howto-dot" data-index="3" aria-label="${t("tools.wg.howto.step", { current: 4, total: 4 })}"></button>
                </div>
                <div class="wg-howto-actions">
                  <button id="wg-howto-prev" type="button" class="small-button">
                    <i class="fa-solid fa-arrow-left"></i>
                    <span data-i18n="tools.wg.howto.prev">${t("tools.wg.howto.prev")}</span>
                  </button>
                  <button id="wg-howto-next" type="button" class="small-button">
                    <span data-i18n="tools.wg.howto.next">${t("tools.wg.howto.next")}</span>
                    <i class="fa-solid fa-arrow-right"></i>
                  </button>
                </div>
              </div>
            </div>
          </article>

          <section id="tools-wg-advanced-panel" class="tools-wg-advanced-panel is-collapsed" aria-hidden="true">
            <div class="tools-wg-advanced-grid">
              <div class="wg-glass">
                <div class="wg-header wg-header-advanced">
                  <h2 class="section-heading" data-i18n="tools.wg.advanced.title">${t("tools.wg.advanced.title")}</h2>
                  <div class="debug-toggle" id="debug-toggle">
                    <div class="toggle-track"></div>
                    <span class="toggle-label" data-i18n="wg.debug.label">${t("wg.debug.label")}</span>
                  </div>
                </div>
                <div class="wg-section">
                  <h3 class="section-heading" data-i18n="wg.section.network">${t("wg.section.network")}</h3>
                  <div class="wg-grid">
                    ${fieldsHtml}
                  </div>
                </div>
              </div>

              <div class="wg-side-panel">
                <div class="info-card">
                  <h3><i class="fa-solid fa-circle-info"></i> <span data-i18n="wg.info.title">${t("wg.info.title")}</span></h3>
                  <p data-i18n="wg.info.body">${t("wg.info.body")}</p>
                </div>
                <div class="info-card wg-meta-card">
                  <div class="meta-row wg-meta-tips">
                    <h3><i class="fa-solid fa-lightbulb"></i> <span data-i18n="wg.tips.title">${t("wg.tips.title")}</span></h3>
                    <p id="wg-tips-text" data-i18n-html="wg.tips.body">${t("wg.tips.body")}</p>
                    <div class="wg-tips-controls">
                      <button id="wg-tip-prev" type="button" class="small-button" data-bs-toggle="tooltip" data-bs-placement="top" data-i18n-title="wg.tips.prev" title="${t("wg.tips.prev")}">
                        <i class="fa-solid fa-chevron-left"></i>
                      </button>
                      <button id="wg-tip-toggle" type="button" class="small-button" data-bs-toggle="tooltip" data-bs-placement="top" data-i18n-title="wg.tips.pause" title="${t("wg.tips.pause")}">
                        <i class="fa-solid fa-pause"></i>
                      </button>
                      <button id="wg-tip-next" type="button" class="small-button" data-bs-toggle="tooltip" data-bs-placement="top" data-i18n-title="wg.tips.next" title="${t("wg.tips.next")}">
                        <i class="fa-solid fa-chevron-right"></i>
                      </button>
                      <span id="wg-tips-counter" class="wg-tips-counter">1/1</span>
                    </div>
                  </div>
                </div>
                <div class="wg-section">
                  <details class="wg-log-block">
                    <summary>
                      <i class="fa-solid fa-terminal"></i>
                      <span data-i18n="wg.log.title">${t("wg.log.title")}</span>
                    </summary>
                    <div class="log-actions" aria-label="${t("wg.log.actions.aria")}" data-i18n-aria="wg.log.actions.aria">
                      <button id="wg-log-copy" type="button" class="log-action-btn"
                        data-bs-toggle="tooltip" data-bs-placement="top" title="${t("wg.log.copy.title")}" data-i18n-title="wg.log.copy.title">
                        <i class="fa-solid fa-copy"></i>
                      </button>
                      <button id="wg-log-export" type="button" class="log-action-btn"
                        data-bs-toggle="tooltip" data-bs-placement="top" title="${t("wg.log.export.title")}" data-i18n-title="wg.log.export.title">
                        <i class="fa-solid fa-download"></i>
                      </button>
                      <button id="wg-log-clear" type="button" class="log-action-btn"
                        data-bs-toggle="tooltip" data-bs-placement="top" title="${t("wg.log.clear.title")}" data-i18n-title="wg.log.clear.title">
                        <i class="fa-solid fa-trash"></i>
                      </button>
                      <button id="wg-log-filter-errors" type="button" class="log-action-btn"
                        data-bs-toggle="tooltip" data-bs-placement="top" title="${t("wg.log.filter.errorsOff")}">
                        <i class="fa-solid fa-triangle-exclamation"></i>
                      </button>
                      <button id="wg-log-autoscroll" type="button" class="log-action-btn is-active"
                        data-bs-toggle="tooltip" data-bs-placement="top" title="${t("wg.log.autoscroll.on")}">
                        <i class="fa-solid fa-arrow-down-wide-short"></i>
                      </button>
                    </div>
                    <pre id="wg-log" class="wg-status console"></pre>
                  </details>
                </div>
              </div>
            </div>
          </section>
        </section>

        ${renderHashCheckSection()}

        <section class="tools-view hidden" data-tool-view="downloader-tools" aria-label="${t("tools.nav.current.downloaderTools")}">
          <article class="tools-card tools-detail-card tools-downloader-dependencies">
            <section id="tools-info" class="tools-downloader-dependencies__info">
              <p class="muted" data-i18n="tools.loading">
                ${t("tools.loading")}
              </p>
            </section>
          </article>
        </section>

        <section class="tools-view hidden" data-tool-view="media-inspector" aria-label="${t("tools.nav.current.mediaInspector")}"></section>

        ${renderMediaConverterSection(t)}

        <section
          class="tools-view hidden"
          data-tool-view="backup"
          aria-label="${t("tools.nav.current.backup")}"
        ></section>
      </section>
      </main>
    </div>
  `;

  container.appendChild(view);
  applyI18n(view);
  const entranceAnimation = createToolsEntranceAnimation(view);
  cleanup.addCleanup(entranceAnimation.cancel);
  entranceAnimation.prepare();

  const isToolAvailable = (toolView, info = toolState.toolsPlatformInfo) =>
    toolState.isToolAvailable(toolView, info);

  const updateLauncherToolsCount = () => {
    const countEl = getEl("tools-launcher-tools-count", view);
    if (!countEl) return;
    const availableToolViews = [
      "wg",
      "hash",
      "downloader-tools",
      "media-inspector",
      "media-converter",
      "backup",
    ];
    const availableCount = availableToolViews.filter((toolView) =>
      isToolAvailable(toolView),
    ).length;
    const label = t("tools.launcher.totalLabel");
    countEl.textContent = `${label}: ${availableCount}`;
  };

  const ensureBackupToolView = () => {
    const backupSection = view.querySelector(
      '.tools-view[data-tool-view="backup"]',
    );
    if (!backupSection || backupSection.childNodes.length > 0) return;
    backupSection.appendChild(renderBackup());
  };

  let pendingDownloaderToolsRefresh = false;

  const ensureDownloaderToolsInfo = async ({ force = false } = {}) => {
    try {
      const section = view.querySelector("#tools-info");
      if (!section) return;
      if (section.__toolsInfoCtx) {
        await refreshToolsInfoState({ force });
        return;
      }
      await renderToolsInfo({ force });
    } catch (error) {
      console.error("[toolsView] renderToolsInfo failed:", error);
    }
  };

  const setToolView = (
    nextView,
    { persist = true, focusLauncher = false, fromCard = false } = {},
  ) => {
    const shell = view.querySelector(".tools-shell");
    const launcher = getEl("tools-launcher", view);
    const launcherSectionHeader = getEl("tools-launcher-section-header", view);
    const launcherHeader = getEl("tools-launcher-header", view);
    const sidebarNavigation = getEl("tools-sidebar-navigation", view);
    const sidebarToggle = getEl("tools-sidebar-toggle", view);
    const requested = String(nextView || "launcher");
    const targetView = isToolAvailable(requested) ? requested : "launcher";
    toolState.setCurrentToolView(targetView);

    const showLauncher = targetView === "launcher";
    shell?.classList.toggle("is-launcher", showLauncher);
    launcher?.classList.toggle("hidden", !showLauncher);
    launcherSectionHeader?.classList.toggle("hidden", !showLauncher);
    launcherHeader?.classList.toggle("hidden", !showLauncher);
    updateLauncherToolsCount();

    view.querySelectorAll(".tools-view[data-tool-view]").forEach((section) => {
      const sectionView = section.getAttribute("data-tool-view");
      const active = sectionView === targetView;
      section.classList.toggle("hidden", !active);
      section.classList.toggle("is-active", active);
    });

    if (fromCard && !showLauncher) {
      const activeView = view.querySelector(
        `.tools-view[data-tool-view="${targetView}"]`,
      );
      const lowEffects = document.body?.classList.contains("low-effects") ||
        document.documentElement?.classList.contains("low-effects");
      let reduceMotion = lowEffects;
      try {
        reduceMotion ||= window.matchMedia?.("(prefers-reduced-motion: reduce)")?.matches;
      } catch {}
      if (!reduceMotion && typeof activeView?.animate === "function") {
        const animation = activeView.animate(
          [
            { opacity: 0, transform: "translateY(14px)" },
            { opacity: 1, transform: "translateY(0)" },
          ],
          {
            duration: 300,
            easing: "cubic-bezier(0.2, 0.75, 0.25, 1)",
          },
        );
        animation.onfinish = () => animation.cancel();
      }
    }

    [...view.querySelectorAll("[data-tool-nav]"), ...(desktopToolNavigation?.querySelectorAll("[data-tool-nav]") || [])].forEach((button) => {
      const toolView = button.dataset.toolNav;
      const available =
        toolView === "launcher" || isToolAvailable(toolView);
      button.classList.toggle("hidden", !available);
      button.classList.toggle("is-active", toolView === targetView);
      if (toolView === targetView) {
        button.setAttribute("aria-current", "page");
      } else {
        button.removeAttribute("aria-current");
      }
    });

    sidebarNavigation?.classList.remove("is-open");
    sidebarToggle?.setAttribute("aria-expanded", "false");

    if (persist && targetView !== "launcher") {
      toolState.persistCurrentToolView(targetView);
    }

    try {
      window.dispatchEvent(
        new CustomEvent("tools:view-changed", {
          detail: { toolView: targetView },
        }),
      );
    } catch {}

    if (targetView === "downloader-tools") {
      const forceToolsRefresh = pendingDownloaderToolsRefresh;
      pendingDownloaderToolsRefresh = false;
      ensureDownloaderToolsInfo({ force: forceToolsRefresh });
    } else {
      deactivateToolsInfo();
    }

    if (showLauncher && focusLauncher) {
      const firstLauncherBtn = view.querySelector(
        ".tools-launcher-button:not(.hidden):not(:disabled)",
      );
      firstLauncherBtn?.focus();
    }
  };

  const selectToolView = (nextView) => {
    if (!isToolAvailable(nextView)) return;
    if (nextView === "backup") ensureBackupToolView();
    setToolView(nextView, {
      persist: nextView !== "launcher",
      focusLauncher: nextView === "launcher",
    });
  };

  // =============================================
  // ИНИЦИАЛИЗАЦИЯ ПОЛЕЙ И КОНФИГУРАЦИИ
  // =============================================

  const loadConfiguration = async () => {
    try {
      const cfg = await window.electron.ipcRenderer.invoke("wg-get-config");
      log(t("wg.log.settings.loaded"));

      currentMsg = cfg.msg ?? ")";
      fields.forEach((f) => {
        const el = getEl(f.id, view);
        if (el) el.value = cfg[f.key] ?? "";
      });

      log(t("wg.log.settings.fieldsRestored", { count: fields.length }));

      // Инициализация кнопок очистки после загрузки данных
      cleanup.setTimeout(() => {
        fields.forEach((f) => {
          const input = getEl(f.id, view);
          const btn = view.querySelector(
            `.clear-field-btn[data-target="#${f.id}"]`,
          );
          if (input && btn) {
            const hasValue = input.value.length > 0;
            if (hasValue) {
              btn.classList.add("has-value");
              btn.style.opacity = "1";
              btn.style.visibility = "visible";
            }
          }
        });
      }, 100);

      if (toolState.currentToolView === "wg") {
        getEl(fields[0].id, view)?.focus();
      }

      // Загрузка состояния отладки
      const debugToggle = getEl("debug-toggle", view);
      if (debugToggle && cfg.debug) {
        debugToggle.classList.add("is-active");
        // Принудительно добавить сообщение при загрузке с включенной отладкой
        cleanup.setTimeout(() => {
          log(t("wg.log.system.debugInit"));
        }, 100);
      }

    } catch (err) {
      toast(t("wg.toast.loadConfigError"), false);
      console.error(err);
      log(t("wg.log.error.loadConfig", { message: err.message }), true);
    }
  };

  const setupFieldEvents = () => {
    fields.forEach((f) => {
      const input = getEl(f.id, view);
      const btn = view.querySelector(
        `.clear-field-btn[data-target="#${f.id}"]`,
      );

      if (!input || !btn) return;

      const updateClearButton = () => {
        const hasValue = input.value.length > 0;

        // Управление видимостью через класс
        if (hasValue) {
          btn.classList.add("has-value");
          btn.style.opacity = "1";
          btn.style.visibility = "visible";
        } else {
          btn.classList.remove("has-value");
          btn.style.opacity = "0";
          btn.style.visibility = "hidden";
        }
      };

      // События для обновления состояния кнопки
      ["focus", "input", "blur", "change"].forEach((eventType) => {
        input.addEventListener(eventType, updateClearButton);
      });

      // Инициализация при загрузке
      updateClearButton();

      // Обработчик клика на кнопку очистки
      btn.addEventListener("click", (e) => {
        e.preventDefault();
        if (input.value) {
          input.value = "";
          saveConfig(f.key, "");
          markFieldError(f.id, false);
          updateClearButton(); // Обновляем состояние после очистки
          input.focus(); // Возвращаем фокус на поле
        }
      });

      // Сохранение значения при изменении
      input.addEventListener("change", () => {
        const val = f.type === "number" ? Number(input.value) : input.value;
        saveConfig(f.key, val);
        markFieldError(f.id, false);
        updateClearButton(); // Обновляем кнопку
      });

      input.addEventListener("input", () => {
        markFieldError(f.id, false);
        updateClearButton(); // Обновляем кнопку при вводе
      });
    });
  };

  const setupEasterEgg = () => {
    const ipInput = getEl("wg-ip", view);
    if (!ipInput) return;

    ipInput.addEventListener("input", () => {
      const val = ipInput.value.toLowerCase().trim();
      if (val === "kvn") {
        ipInput.value = "127.0.0.2";
        saveConfig("ip", ipInput.value);
        const rPort = getEl("wg-port-remote", view)?.value || "51820";

        showConfirmationDialog(
          t("wg.confirm.send", { target: `<b>${ipInput.value}:${rPort}</b>` }),
          () => {
            const payload = getPayload();
            const status = getEl("wg-status-indicator", view);

            if (status) {
              status.classList.remove("hidden");
              status.textContent = t("wg.statusIndicator.sendingSpecial");
              status.className = "loading";

              const hideLater = () =>
                cleanup.setTimeout(() => status.classList.add("hidden"), 500);

              window.electron.ipcRenderer
                .invoke("wg-send-udp", payload)
                .then(() => {
                  toast(
                    t("wg.toast.specialSent", {
                      target: `${payload.ip}:${payload.rPort}`,
                    }),
                  );
                  log(
                    t("wg.log.send.specialSent", {
                      target: `${payload.ip}:${payload.rPort}`,
                    }),
                  );
                  updateLastSendTime();
                  updateConnectionStatus(t("wg.status.success"));
                  hideLater();
                })
                .catch((err) => {
                  const msg = err.message || err.toString();
                  if (!msg.includes("EADDRINUSE")) {
                    toast(msg, false);
                  }
                  log(msg, true);
                  updateConnectionStatus(t("wg.status.error"), true);
                  hideLater();
                });
            }
          },
        );
      }
    });
  };

  // =============================================
  // ОБРАБОТЧИКИ СОБЫТИЙ
  // =============================================

  const setupEventHandlers = () => {
    const launcherAvailableGrid = view.querySelector(".tools-launcher-grid");
    const launcherUnavailableSection = getEl(
      "tools-launcher-unavailable-section",
      view,
    );
    const launcherUnavailableGrid = view.querySelector(
      ".tools-launcher-unavailable-grid",
    );
    const openWgBtn = getEl("tools-open-wg", view);
    const openHashBtn = getEl("tools-open-hash", view);
    const openDownloaderToolsBtn = getEl("tools-open-downloader-tools", view);
    const openMediaInspectorBtn = getEl("tools-open-media-inspector", view);
    const openMediaConverterBtn = getEl("tools-open-media-converter", view);
    const openBackupBtn = getEl("tools-open-backup", view);
    const sidebarToggle = getEl("tools-sidebar-toggle", view);
    const sidebarNavigation = getEl("tools-sidebar-navigation", view);

    const applyDeveloperToolsAvailability = () => {
      toolState.setDeveloperToolsUnlocked(
        toolState.readDeveloperToolsUnlocked(),
      );
      if (
        !openBackupBtn ||
        !launcherAvailableGrid ||
        !launcherUnavailableGrid ||
        !launcherUnavailableSection
      ) {
        return;
      }

      if (openBackupBtn.parentElement !== launcherAvailableGrid) {
        launcherAvailableGrid.appendChild(openBackupBtn);
      }
      openBackupBtn.disabled = false;
      openBackupBtn.removeAttribute("aria-disabled");
      openBackupBtn.classList.remove("is-unavailable");
      openBackupBtn.classList.toggle("hidden", !isToolAvailable("backup"));
      launcherUnavailableSection.classList.toggle(
        "hidden",
        launcherUnavailableGrid.children.length === 0,
      );
      [...view.querySelectorAll("[data-tool-nav]"), ...(desktopToolNavigation?.querySelectorAll("[data-tool-nav]") || [])].forEach((button) => {
        const toolView = button.dataset.toolNav;
        button.classList.toggle(
          "hidden",
          toolView !== "launcher" && !isToolAvailable(toolView),
        );
      });
      updateLauncherToolsCount();
    };

    openWgBtn?.addEventListener("click", () =>
      setToolView("wg", { fromCard: true }),
    );
    openHashBtn?.addEventListener("click", () =>
      setToolView("hash", { fromCard: true }),
    );
    openDownloaderToolsBtn?.addEventListener("click", () =>
      setToolView("downloader-tools", { fromCard: true }),
    );
    openMediaInspectorBtn?.addEventListener("click", () =>
      setToolView("media-inspector", { fromCard: true }),
    );
    openMediaConverterBtn?.addEventListener("click", () =>
      setToolView("media-converter", { fromCard: true }),
    );
    openBackupBtn?.addEventListener("click", () => {
      ensureBackupToolView();
      setToolView("backup", { fromCard: true });
    });
    view.querySelectorAll("[data-tool-nav]").forEach((button) => {
      button.addEventListener("click", () => {
        selectToolView(button.dataset.toolNav);
      });
    });
    mountDesktopToolNavigation();
    setToolView(toolState.currentToolView, { persist: false });
    sidebarToggle?.addEventListener("click", () => {
      const open = sidebarToggle.getAttribute("aria-expanded") !== "true";
      sidebarToggle.setAttribute("aria-expanded", String(open));
      sidebarNavigation?.classList.toggle("is-open", open);
    });

    const isWgHowtoOpen = () => {
      const modal = getEl("wg-howto-modal", view);
      return !!modal && !modal.classList.contains("hidden");
    };


    cleanup.onWindowEvent("tools:developer-unlock-changed", (event) => {
      const enabled = !!event?.detail?.enabled;
      toolState.setDeveloperToolsUnlocked(enabled);
      applyDeveloperToolsAvailability();
      if (!isToolAvailable(toolState.currentToolView)) {
        setToolView("launcher", { persist: false, focusLauncher: true });
      } else if (toolState.currentToolView === "launcher") {
        setToolView("launcher", { persist: false });
      }
    });

    cleanup.onWindowEvent("backup:toggleDisabled", () => {
      applyDeveloperToolsAvailability();
      if (!isToolAvailable(toolState.currentToolView)) {
        setToolView("launcher", { persist: false, focusLauncher: true });
      }
    });

    // Отправка по Enter и Ctrl/Cmd+Enter
    view.addEventListener("keydown", (e) => {
      if (isWgHowtoOpen()) {
        const key = String(e.key || "");
        if (key === "Escape" || key === "Esc") {
          e.preventDefault();
          closeWgHowtoModal();
          return;
        }
        if (key === "ArrowLeft") {
          e.preventDefault();
          setWgHowtoSlide(wgHowtoIndex - 1);
          return;
        }
        if (key === "ArrowRight") {
          e.preventDefault();
          setWgHowtoSlide(wgHowtoIndex + 1);
          return;
        }
      }
      const target = e.target;
      const targetEl = target instanceof Element ? target : null;
      const isEditableTarget = !!targetEl?.closest(
        "input, textarea, select, [contenteditable=''], [contenteditable='true']",
      );
      const key = String(e.key || "");
      const code = String(e.code || "");
      const isEscapePressed =
        key === "Escape" || key === "Esc" || code === "Escape";
      const dependenciesSection = view.querySelector(
        '[data-tool-view="downloader-tools"]',
      );
      const dependenciesViewActive =
        !!dependenciesSection &&
        !dependenciesSection.classList.contains("hidden");

      if (
        isEscapePressed &&
        toolState.currentToolView !== "launcher" &&
        !dependenciesViewActive
      ) {
        if (
          e.defaultPrevented ||
          targetEl?.closest(
            "[data-tool-menu-trigger], [data-tool-menu], [role='menuitem']",
          ) ||
          view.querySelector("[data-tool-menu]:not([hidden])")
        ) {
          return;
        }
        e.preventDefault();
        setToolView("launcher", { persist: false, focusLauncher: true });
        return;
      }

      if (!isEditableTarget && toolState.currentToolView === "launcher") {
        const isArrowKey =
          e.key === "ArrowLeft" ||
          e.key === "ArrowRight" ||
          e.key === "ArrowUp" ||
          e.key === "ArrowDown";
        if (isArrowKey) {
          const launcherButtons = Array.from(
            view.querySelectorAll(".tools-launcher-button"),
          ).filter(
            (btn) =>
              !btn.disabled &&
              !btn.classList.contains("hidden") &&
              btn.closest(".tools-launcher"),
          );

          if (launcherButtons.length) {
            const focusedLauncherBtn = targetEl?.closest(
              ".tools-launcher-button",
            );
            const activeButton =
              launcherButtons.find((btn) => btn === document.activeElement) ||
              focusedLauncherBtn;
            const currentIndex = launcherButtons.findIndex(
              (btn) => btn === activeButton,
            );
            const fallbackIndex = 0;
            const safeIndex = currentIndex >= 0 ? currentIndex : fallbackIndex;
            const moveBackward = e.key === "ArrowLeft" || e.key === "ArrowUp";
            const step = moveBackward ? -1 : 1;
            const nextIndex =
              (safeIndex + step + launcherButtons.length) %
              launcherButtons.length;
            launcherButtons[nextIndex]?.focus();
            e.preventDefault();
            return;
          }
        }
      }

      if (e.key !== "Enter") return;
      if (!(target instanceof Element)) return;
      if (!target.closest("#tools-wg-advanced-panel")) return;
      if (e.metaKey || e.ctrlKey) {
        e.preventDefault();
        const send = getEl("wg-send", view);
        if (send && !send.disabled) send.click();
        return;
      }
      e.preventDefault();
      const send = getEl("wg-send", view);
      if (send && !send.disabled) send.click();
    });

    // Очистка лога
    const clearLogBtn = getEl("wg-log-clear", view);
    clearLogBtn?.addEventListener("click", () => {
      clearLog();
      log(t("wg.log.log.clearedByUser"));
    });

    const filterErrorsBtn = getEl("wg-log-filter-errors", view);
    filterErrorsBtn?.addEventListener("click", () => {
      setLogErrorOnly(!logController.errorOnly);
      initTooltips();
    });

    const autoScrollBtn = getEl("wg-log-autoscroll", view);
    autoScrollBtn?.addEventListener("click", () => {
      setLogAutoScroll(!logController.autoScroll);
      initTooltips();
    });

    // Отправка UDP-пакета
    getEl("wg-send", view)?.addEventListener("click", handleSend);

    //
    // Добавим новые обработчики после существующего обработчика очистки лога:
    // После обработчика очистки лога добавить:

    // Копирование лога в буфер обмена
    const copyLogBtn = getEl("wg-log-copy", view);
    copyLogBtn?.addEventListener("click", async () => {
      const logText = getLogText();
      if (logText) {
        try {
          await navigator.clipboard.writeText(logText);
          toast(t("wg.toast.logCopied"));
          log(t("wg.log.log.copied"));

          // Визуальная обратная связь
          copyLogBtn.innerHTML = `<i class="fa-solid fa-check"></i><span>${t(
            "wg.log.ui.copied",
          )}</span>`;
          copyLogBtn.style.background = "rgba(var(--color-success-rgb), 0.1)";
          copyLogBtn.style.borderColor = "var(--color-success)";
          copyLogBtn.style.color = "var(--color-success)";

          cleanup.setTimeout(() => {
            copyLogBtn.innerHTML = '<i class="fa-solid fa-copy"></i>';
            copyLogBtn.style.background = "";
            copyLogBtn.style.borderColor = "";
            copyLogBtn.style.color = "";
          }, 2000);
        } catch (err) {
          console.error("Copy error:", err);
          toast(t("wg.toast.logCopyFailed"), false);
          log(t("wg.log.error.copyLog", { message: err.message }), true);
        }
      } else {
        toast(t("wg.toast.logEmpty"), false);
      }
    });

    // Экспорт лога в файл
    const exportLogBtn = getEl("wg-log-export", view);
    exportLogBtn?.addEventListener("click", () => {
      const logText = getLogText();
      if (logText) {
        log(t("wg.log.log.exportStarted"));
        window.electron.ipcRenderer.send("wg-export-log", logText);

        // Визуальная обратная связь
        exportLogBtn.innerHTML = `<i class="fa-solid fa-spinner fa-spin"></i><span>${t(
          "wg.log.ui.exporting",
        )}</span>`;
        exportLogBtn.disabled = true;

        cleanup.setTimeout(() => {
          exportLogBtn.innerHTML = '<i class="fa-solid fa-download"></i>';
          exportLogBtn.disabled = false;
        }, 3000);
      } else {
        toast(t("wg.toast.logEmpty"), false);
      }
    });

    // Добавим обработчик для события успешного экспорта
    const onLogExportSuccess = (_event, filePath) => {
      toast(t("wg.toast.logExported"));
      log(t("wg.log.log.exportSuccess", { path: filePath }));
    };
    const onLogExportError = (_event, error) => {
      toast(t("wg.toast.logExportFailed"), false);
      log(t("wg.log.error.exportLog", { message: error }), true);
    };
    cleanup.onIpcEvent(
      window.electron.ipcRenderer,
      "wg-log-export-success",
      onLogExportSuccess,
    );
    cleanup.onIpcEvent(
      window.electron.ipcRenderer,
      "wg-log-export-error",
      onLogExportError,
    );

    // Открыть файл конфигурации
    const openConfigBtn = getEl("wg-open-config-file", view);
    openConfigBtn?.addEventListener("click", () => {
      log(t("wg.log.action.openConfigFile"));
      window.electron.ipcRenderer.send("wg-open-config-folder");
    });

    // Сброс настроек
    getEl("wg-reset", view)?.addEventListener("click", handleReset);

    // Переключатель отладки
    const debugToggle = getEl("debug-toggle", view);
    debugToggle?.addEventListener("click", handleDebugToggle);

    const advancedPanel = getEl("tools-wg-advanced-panel", view);
    const advancedToggle = getEl("tools-wg-advanced-toggle", view);
    const setAdvancedOpen = (open, { manageFocus = false } = {}) => {
      if (!advancedPanel || !advancedToggle) return;
      const isOpen = !!open;
      advancedPanel.classList.toggle("is-collapsed", !isOpen);
      advancedPanel.classList.toggle("is-open", isOpen);
      advancedPanel.setAttribute("aria-hidden", isOpen ? "false" : "true");
      advancedToggle.setAttribute("aria-expanded", isOpen ? "true" : "false");
      advancedToggle.textContent = isOpen
        ? t("tools.wg.advanced.toggle.close")
        : t("tools.wg.advanced.toggle.open");
      if (manageFocus) {
        if (isOpen) {
          const firstInput =
            getEl("wg-ip", view) ||
            getEl("wg-port-remote", view) ||
            getEl("wg-port-local", view);
          firstInput?.focus();
        } else {
          advancedToggle.focus();
        }
      }
      try {
        window.localStorage.setItem(
          TOOLS_STORAGE_KEYS.WG_ADVANCED_STATE,
          isOpen ? "1" : "0",
        );
      } catch {}
    };

    const readAdvancedState = () => {
      try {
        return (
          window.localStorage.getItem(TOOLS_STORAGE_KEYS.WG_ADVANCED_STATE) ===
          "1"
        );
      } catch {
        return false;
      }
    };

    setAdvancedOpen(readAdvancedState());
    advancedToggle?.addEventListener("click", () => {
      const currentlyOpen = advancedPanel?.classList.contains("is-open");
      setAdvancedOpen(!currentlyOpen, { manageFocus: true });
      initTooltips();
    });
    cleanup.onWindowEvent("i18n:changed", () => {
      setAdvancedOpen(advancedPanel?.classList.contains("is-open"));
      setToolView(toolState.currentToolView, { persist: false });
    });

    const wgOpenHowtoBtn = getEl("wg-open-howto", view);
    const wgHowtoModalEl = getEl("wg-howto-modal", view);
    const wgHowtoDialogEl = getEl("wg-howto-dialog", view);
    const wgHowtoTrackEl = getEl("wg-howto-track", view);
    const wgHowtoStepEl = getEl("wg-howto-step", view);
    const wgHowtoCloseBtn = getEl("wg-howto-close", view);
    const wgHowtoPrevBtn = getEl("wg-howto-prev", view);
    const wgHowtoNextBtn = getEl("wg-howto-next", view);
    const wgHowtoDotsEl = getEl("wg-howto-dots", view);
    const wgHowtoDots = Array.from(
      wgHowtoDotsEl?.querySelectorAll(".wg-howto-dot") || [],
    );
    const wgHowtoSlideCount = 4;
    let wgHowtoIndex = 0;
    let wgHowtoReturnFocusEl = null;

    const updateWgHowtoUi = () => {
      if (!wgHowtoTrackEl) return;
      wgHowtoTrackEl.style.transform = `translateX(-${wgHowtoIndex * 100}%)`;
      if (wgHowtoStepEl) {
        wgHowtoStepEl.textContent = t("tools.wg.howto.step", {
          current: wgHowtoIndex + 1,
          total: wgHowtoSlideCount,
        });
      }
      if (wgHowtoPrevBtn) wgHowtoPrevBtn.disabled = wgHowtoIndex <= 0;
      if (wgHowtoNextBtn) {
        wgHowtoNextBtn.disabled = wgHowtoIndex >= wgHowtoSlideCount - 1;
      }
      wgHowtoDots.forEach((dot, idx) => {
        const isActive = idx === wgHowtoIndex;
        dot.classList.toggle("is-active", isActive);
        dot.setAttribute("aria-current", isActive ? "true" : "false");
      });
    };

    const setWgHowtoSlide = (index) => {
      const nextIndex = Math.max(
        0,
        Math.min(Number(index) || 0, wgHowtoSlideCount - 1),
      );
      wgHowtoIndex = nextIndex;
      updateWgHowtoUi();
    };

    const openWgHowtoModal = () => {
      if (!wgHowtoModalEl || !wgHowtoDialogEl) return;
      wgHowtoReturnFocusEl = document.activeElement;
      acquireDocumentScrollLock(WG_HOWTO_SCROLL_LOCK_OWNER);
      wgHowtoModalEl.classList.remove("hidden");
      wgHowtoModalEl.setAttribute("aria-hidden", "false");
      wgHowtoDialogEl.setAttribute("aria-hidden", "false");
      setWgHowtoSlide(0);
      cleanup.setTimeout(() => wgHowtoCloseBtn?.focus(), 0);
    };

    const closeWgHowtoModal = ({ returnFocus = true } = {}) => {
      if (!wgHowtoModalEl || !wgHowtoDialogEl) return;
      wgHowtoModalEl.classList.add("hidden");
      wgHowtoModalEl.setAttribute("aria-hidden", "true");
      wgHowtoDialogEl.setAttribute("aria-hidden", "true");
      releaseDocumentScrollLock(WG_HOWTO_SCROLL_LOCK_OWNER);
      if (returnFocus) {
        if (wgHowtoReturnFocusEl?.focus) wgHowtoReturnFocusEl.focus();
        else wgOpenHowtoBtn?.focus();
      }
    };

    wgOpenHowtoBtn?.addEventListener("click", () => openWgHowtoModal());
    wgHowtoCloseBtn?.addEventListener("click", () => closeWgHowtoModal());
    wgHowtoPrevBtn?.addEventListener("click", () =>
      setWgHowtoSlide(wgHowtoIndex - 1),
    );
    wgHowtoNextBtn?.addEventListener("click", () =>
      setWgHowtoSlide(wgHowtoIndex + 1),
    );
    wgHowtoDots.forEach((dot) => {
      dot.addEventListener("click", () => {
        setWgHowtoSlide(Number(dot.dataset.index || "0"));
      });
    });
    wgHowtoModalEl?.addEventListener("mousedown", (event) => {
      if (event.target === wgHowtoModalEl) closeWgHowtoModal();
    });
    updateWgHowtoUi();

    initHashCheckSection({ view, cleanup });

    initMediaInspectorSection({
      view,
      getEl,
      t,
      registerCleanup: cleanup.addCleanup,
    });
    initMediaConverterSection({
      view,
      getEl,
      t,
      registerCleanup: cleanup.addCleanup,
    });

    applyDeveloperToolsAvailability();
  };

  const handleSend = () => {
    // Автоматически показывать лог при отправке
    const logDetails = view.querySelector(".wg-log-block");
    if (logDetails && !logDetails.open) {
      logDetails.open = true;
    }

    const payload = getPayload();
    log(t("wg.log.send.payloadPrepared", { payload: JSON.stringify(payload) }));

    let hasError = false;

    if (!isValidIp(payload.ip)) {
      markFieldError("wg-ip", true, t("wg.validation.ipInvalid"));
      hasError = true;
      log(t("wg.log.validation.ipInvalid"), true);
    }

    if (!isValidPort(payload.rPort)) {
      markFieldError("wg-port-remote", true, t("wg.validation.portRange"));
      hasError = true;
      log(t("wg.log.validation.remotePortInvalid"), true);
    }

    if (payload.lPort && !isValidPort(payload.lPort)) {
      markFieldError("wg-port-local", true, t("wg.validation.portRange"));
      hasError = true;
      log(t("wg.log.validation.localPortInvalid"), true);
    }

    const status = getEl("wg-status-indicator", view);
    if (!status) return;

    status.classList.remove("hidden");
    status.textContent = t("wg.statusIndicator.sending");
    status.className = "loading";

    if (hasError) {
      log(t("wg.log.send.abortedValidation"), true);
      status.textContent = t("wg.statusIndicator.validationErrors");
      status.className = "error";
      cleanup.setTimeout(() => status.classList.add("hidden"), 3000);
      return;
    }

    const sendBtn = getEl("wg-send", view);
    const hideLater = () =>
      cleanup.setTimeout(() => status.classList.add("hidden"), 500);

    sendBtn.disabled = true;
    sendBtn.classList.add("is-loading");

    log(t("wg.log.send.ipcRequest"));

    withTimeout(
      window.electron.ipcRenderer.invoke("wg-send-udp", payload),
      5000,
    )
      .then(() => {
        log(t("wg.log.send.successResponse"));
        toast(t("wg.toast.sent", { target: `${payload.ip}:${payload.rPort}` }));
        log(
          t("wg.log.send.sentSuccess", {
            target: `${payload.ip}:${payload.rPort}`,
          }),
        );

        updateLastSendTime();
        updateConnectionStatus(t("wg.status.sent"));
        status.textContent = t("wg.statusIndicator.sent");
        status.className = "success";

        view.classList.add("wg-success-pulse");
        cleanup.setTimeout(
          () => view.classList.remove("wg-success-pulse"),
          2000,
        );

        sendBtn.disabled = false;
        sendBtn.classList.remove("is-loading");
        hideLater();
      })
      .catch((err) => {
        log(
          t("wg.log.send.ipcError", {
            message: err && (err.message || String(err)),
          }),
          true,
        );
        const raw = err && (err.message || String(err));
        const msg = humanizeError(raw);

        if (!raw?.includes("EADDRINUSE")) {
          toast(msg, false);
        }

        log(msg, true);
        updateConnectionStatus(t("wg.status.sendError"), true);
        status.textContent = t("wg.statusIndicator.sendError");
        status.className = "error";

        sendBtn.disabled = false;
        sendBtn.classList.remove("is-loading");
        cleanup.setTimeout(() => status.classList.add("hidden"), 5000);
      });
  };

  const handleReset = () => {
    showConfirmationDialog(t("wg.confirm.resetAll"), () => {
      window.electron.ipcRenderer
        .invoke("wg-reset-config-defaults")
        .then(() => {
          toast(t("wg.toast.resetDone"));
          return window.electron.ipcRenderer.invoke("wg-get-config");
        })
        .then((cfg) => {
          log(t("wg.log.settings.loaded"));
          fields.forEach((f) => {
            getEl(f.id, view).value = cfg[f.key] ?? "";
            markFieldError(f.id, false);
          });
          log(t("wg.log.settings.fieldsRestored", { count: fields.length }));

          // При сбросе устанавливаем начальное сообщение в лог
          const pre = getEl("wg-log", view);
          const debugToggle = getEl("debug-toggle", view);
          const debugEnabled = debugToggle
            ? debugToggle.classList.contains("is-active")
            : false;

          if (pre && !debugEnabled) {
            pre.textContent = t("wg.log.placeholder");
          }

          currentMsg = ")";
          updateConnectionStatus(t("wg.status.reset"));
        })
        .catch((err) => {
          toast(t("wg.toast.resetFailed"), false);
          console.error(err);
          log(t("wg.log.error.resetSettings", { message: err.message }), true);
        });
    });
  };

  const handleDebugToggle = () => {
    const debugToggle = getEl("debug-toggle", view);
    const enabled = !debugToggle.classList.contains("is-active");

    if (enabled) {
      debugToggle.classList.add("is-active", "pulse");
      cleanup.setTimeout(() => debugToggle.classList.remove("pulse"), 600);

      // При включении отладки добавляем информационное сообщение
      log(t("wg.log.debug.enabled"));

      // Показываем текущее состояние
      const status =
        getEl("wg-connection-status", view)?.textContent ||
        t("wg.status.inactive");
      log(t("wg.log.debug.currentStatus", { status }));
    } else {
      debugToggle.classList.remove("is-active");
      log(t("wg.log.debug.disabled"));
    }

    window.electron.ipcRenderer.send("wg-set-config", {
      key: "debug",
      val: enabled,
    });
  };

  // =============================================
  // ИНИЦИАЛИЗАЦИЯ
  // =============================================

  const initialize = async () => {
    try {
      logController.startSession();
      // Сначала устанавливаем начальное сообщение в лог
      const pre = getEl("wg-log", view);
      if (pre && !pre.textContent.trim()) {
        pre.textContent = t("wg.log.placeholder");
      }

      toolState.setPlatformInfo(
        (await window.electron.getPlatformInfo?.().catch(() => null)) || {
          isWindows: false,
          platform: "",
        },
      );
      toolState.setDeveloperToolsUnlocked(
        toolState.readDeveloperToolsUnlocked(),
      );
      const requestedToolView =
        consumeRequestedToolsView() || toolState.resolveInitialToolView();
      if (requestedToolView === "backup") {
        ensureBackupToolView();
      }
      setToolView(requestedToolView, { persist: false });

      await loadConfiguration();
      loadLog();
      loadLastSendTime();
      setupFieldEvents();
      setupEasterEgg();
      setupEventHandlers();
      entranceAnimation.play();
      updateLogControls();
      // Анимация и автосмена советов
      const initTipsRotation = async (lang = "ru") => {
        const tipsCard = view
          .querySelector(".info-card h3 i.fa-lightbulb")
          ?.closest(".info-card");
        if (!tipsCard) return;

        const p = tipsCard.querySelector("#wg-tips-text");
        const prevBtn = tipsCard.querySelector("#wg-tip-prev");
        const nextBtn = tipsCard.querySelector("#wg-tip-next");
        const toggleBtn = tipsCard.querySelector("#wg-tip-toggle");
        const counterEl = tipsCard.querySelector("#wg-tips-counter");
        if (!p || !prevBtn || !nextBtn || !toggleBtn || !counterEl) return;

        try {
          const tipsPath =
            lang === "en" ? "info/tips.en.json" : "info/tips.json";
          const response = await fetch(tipsPath);
          const data = await response.json();
          tipsItems = Array.isArray(data.tips) ? data.tips : [];
          if (!tipsItems.length) return;

          const clearTipsTimers = () => {
            if (tipsIntervalId) {
              tipsIntervalId = cleanup.clearInterval(tipsIntervalId);
            }
          };

          const clearTipsAnimationTimers = () => {
            if (tipsSwapTimer) {
              tipsSwapTimer = cleanup.clearTimeout(tipsSwapTimer);
            }
            if (tipsFadeTimer) {
              tipsFadeTimer = cleanup.clearTimeout(tipsFadeTimer);
            }
          };

          const updateToggleUi = () => {
            const icon = toggleBtn.querySelector("i");
            prevBtn.setAttribute("title", t("wg.tips.prev"));
            nextBtn.setAttribute("title", t("wg.tips.next"));
            if (tipsPaused) {
              if (icon) icon.className = "fa-solid fa-play";
              toggleBtn.setAttribute("title", t("wg.tips.play"));
              toggleBtn.setAttribute("data-i18n-title", "wg.tips.play");
            } else {
              if (icon) icon.className = "fa-solid fa-pause";
              toggleBtn.setAttribute("title", t("wg.tips.pause"));
              toggleBtn.setAttribute("data-i18n-title", "wg.tips.pause");
            }
          };

          const updateCounter = () => {
            counterEl.textContent = t("wg.tips.counter", {
              current: Math.min(tipsItems.length, tipsIndex + 1),
              total: tipsItems.length,
            });
          };

          const renderTip = (nextIndex, { animate = true } = {}) => {
            if (!tipsItems.length) return;
            tipsIndex =
              ((nextIndex % tipsItems.length) + tipsItems.length) %
              tipsItems.length;
            const text = tipsItems[tipsIndex];
            if (!animate) {
              p.textContent = text;
              p.classList.remove("fade-out", "fade-in");
              updateCounter();
              return;
            }
            p.classList.add("fade-out");
            clearTipsAnimationTimers();
            tipsSwapTimer = cleanup.setTimeout(() => {
              p.textContent = text;
              p.classList.remove("fade-out");
              p.classList.add("fade-in");
              tipsFadeTimer = cleanup.setTimeout(
                () => p.classList.remove("fade-in"),
                800,
              );
              updateCounter();
            }, 180);
          };

          const scheduleRotation = () => {
            clearTipsTimers();
            if (tipsPaused || tipsItems.length <= 1) return;
            tipsIntervalId = cleanup.setInterval(() => {
              renderTip(tipsIndex + 1);
            }, 8000);
          };

          renderTip(tipsIndex, { animate: false });
          updateToggleUi();
          scheduleRotation();

          if (!tipsCard.dataset.tipsWired) {
            tipsCard.dataset.tipsWired = "1";

            prevBtn.addEventListener("click", () => {
              renderTip(tipsIndex - 1);
              scheduleRotation();
            });
            nextBtn.addEventListener("click", () => {
              renderTip(tipsIndex + 1);
              scheduleRotation();
            });
            toggleBtn.addEventListener("click", () => {
              tipsPaused = !tipsPaused;
              updateToggleUi();
              scheduleRotation();
              initTooltips();
            });
          }
          initTooltips();
        } catch (err) {
          console.error("Не удалось загрузить советы:", err);
        }
      };
      await initTipsRotation(getLanguage());
      cleanup.onWindowEvent("i18n:changed", (e) => {
        const next = e?.detail?.lang || getLanguage();
        initTipsRotation(next);
      });
      cleanup.onWindowEvent("tools:navigate", (event) => {
        const requestedTool = String(event?.detail?.toolView || "").trim();
        if (!requestedTool) return;
        if (requestedTool === "backup") {
          ensureBackupToolView();
        }
        setToolView(requestedTool, { persist: false });
      });
      cleanup.onWindowEvent("tools:refresh-info", (event) => {
        if (toolState.currentToolView !== "downloader-tools") {
          pendingDownloaderToolsRefresh = true;
          return;
        }
        ensureDownloaderToolsInfo({ force: event?.detail?.force !== false });
      });

      const initNetworkSettingsButton = async () => {
        const platform = toolState.toolsPlatformInfo?.platform || "";
        const btn = view.querySelector("#wg-open-network-settings");
        if (!btn) return;
        const supportedPlatform = platform === "darwin" || platform === "win32";

        // Меняем тултип в зависимости от платформы
        if (platform === "darwin") {
          btn.setAttribute(
            "data-i18n-title",
            "wg.action.openNetworkSettings.mac",
          );
        } else if (platform === "win32") {
          btn.setAttribute(
            "data-i18n-title",
            "wg.action.openNetworkSettings.windows",
          );
        } else {
          btn.setAttribute(
            "data-i18n-title",
            "wg.action.openNetworkSettings.title",
          );
        }
        applyI18n(btn);
        if (!supportedPlatform) {
          btn.classList.add("hidden");
          return;
        }
        btn.classList.remove("hidden");
        btn.style.display = "inline-flex";

        btn.addEventListener("click", () => {
          window.electron.send("open-network-settings");
        });
      };
      await initNetworkSettingsButton();

      // Инициализация тултипов
      queueMicrotask(() => {
        initTooltips();
        log(t("wg.log.ui.tooltipsReady"));
      });

      const dt = Math.round(performance.now() - T0);

      // Добавляем отладочную информацию если отладка включена
      const debugToggle = getEl("debug-toggle", view);
      const debugEnabled = debugToggle
        ? debugToggle.classList.contains("is-active")
        : false;

      if (debugEnabled) {
        log(t("wg.log.init.renderReady", { ms: dt }));
        const ua = navigator.userAgent || "";
        log(t("wg.log.env.ua", { ua: ua.split(")")[0] + ")" }));
        log(t("wg.log.debug.active"));
      }
    } catch (error) {
      entranceAnimation.cancel();
      console.error("Ошибка инициализации WireGuard:", error);
      log(t("wg.log.error.init", { message: error.message }), true);
    }
  };

  const disconnectObserver = new MutationObserver(() => {
    if (!container.isConnected) {
      disposeView();
      disconnectObserver.disconnect();
    }
  });
  if (document.body) {
    disconnectObserver.observe(document.body, {
      childList: true,
      subtree: true,
    });
    cleanup.addCleanup(() => disconnectObserver.disconnect());
  }

  container.addEventListener("tools:view-hidden", disposeView, { once: true });

  // Запускаем инициализацию
  initialize();

  return container;
}
