// src/js/modules/views/toolsView.js

import { showToast } from "../toast.js";
import { showConfirmationDialog } from "../modals.js";
import { initTooltips } from "../tooltipInitializer.js";
import { applyI18n, getLanguage, t } from "../i18n.js";
import { consumeRequestedToolsView } from "../toolsNavigation.js";
import renderBackup from "./backupView.js";
import { initMediaInspectorSection } from "./tools/mediaInspectorSection.js";
import { initFileSorterSection } from "./tools/fileSorterSection.js";
import { renderFileSorterView } from "./tools/fileSorterView.js";
import {
  initHashCheckSection,
  renderHashCheckSection,
} from "./tools/hashCheckSection.js";
import {
  initWingetInstallerSection,
  renderWingetInstallerSection,
} from "./tools/wingetInstallerSection.js";
import { createCleanupRegistry } from "./tools/cleanupRegistry.js";
import { TOOLS_STORAGE_KEYS } from "./tools/storage.js";
import { createLogController } from "./tools/logController.js";
import { createToolViewState } from "./tools/toolViewState.js";
import {
  acquireDocumentScrollLock,
  releaseDocumentScrollLock,
} from "../scrollLockManager.js";
import {
  POWER_SHORTCUT_ACTIONS,
  POWER_SHORTCUT_GROUPS,
  getPowerActionStateTone,
  isPowerActionEnabled,
} from "./tools/powerShortcuts.js";

export default function renderToolsView() {
  // Guard: если вкладка WG Unlock отключена — не инициализируем UI
  const _isWgDisabled = () => {
    try {
      const raw = localStorage.getItem("wgUnlockDisabled");
      if (raw === null) return true;
      return JSON.parse(raw) === true;
    } catch {
      return true;
    }
  };

  if (_isWgDisabled()) {
    const placeholder = document.createElement("div");
    placeholder.id = "wireguard-view";
    placeholder.className = "wireguard-view tab-content";
    placeholder.style.display = "none";
    return placeholder;
  }

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
  const POWER_HOWTO_SCROLL_LOCK_OWNER = "tools-howto-power";

  const disposeView = () => {
    releaseDocumentScrollLock(WG_HOWTO_SCROLL_LOCK_OWNER);
    releaseDocumentScrollLock(POWER_HOWTO_SCROLL_LOCK_OWNER);
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

  const renderPowerShortcutAction = (action) => `
    <article class="power-shortcut-card power-shortcut-card--${action.id}" data-power-action="${action.id}">
      <div class="power-shortcut-card__header">
        <h3 class="power-shortcut-card__title">
          <i class="${action.icon}"></i>
          <span data-i18n="${action.cardTitleKey}">${t(action.cardTitleKey)}</span>
        </h3>
        <span
          id="${action.stateId}"
          class="power-shortcut-card__state is-idle"
          data-power-state="${action.id}"
          data-i18n="quickActions.power.status.idle"
        >
          ${t("quickActions.power.status.idle")}
        </span>
      </div>
      <p class="power-shortcut-card__hint" data-i18n="${action.cardHintKey}">
        ${t(action.cardHintKey)}
      </p>
      <div class="power-shortcut-card__actions">
        <button id="${action.buttonId}" type="button" class="large-button" data-power-action-trigger="${action.id}">
          <i class="${action.actionIcon}"></i>
          <span data-i18n="${action.actionKey}">${t(action.actionKey)}</span>
        </button>
      </div>
      <div class="power-shortcut-card__result">
        <div
          id="${action.resultId}"
          class="quick-action-result power-shortcut-card__result-text muted"
        ></div>
        <small
          id="${action.detailId}"
          class="power-shortcut-card__detail hidden"
          data-power-action-detail="${action.id}"
        ></small>
      </div>
    </article>
  `;

  const renderPowerShortcutGroup = (group) => {
    const actions = POWER_SHORTCUT_ACTIONS.filter(
      (action) => action.groupId === group.id,
    )
      .map(renderPowerShortcutAction)
      .join("");

    return `
      <section class="power-shortcuts-group" data-power-group="${group.id}">
        <div class="power-shortcuts-group__header">
          <h3 class="power-shortcuts-group__title" data-i18n="${group.titleKey}">
            ${t(group.titleKey)}
          </h3>
          <p class="power-shortcuts-group__hint" data-i18n="${group.hintKey}">
            ${t(group.hintKey)}
          </p>
        </div>
        <div class="power-shortcuts-group__grid">
          ${actions}
        </div>
      </section>
    `;
  };

  const powerShortcutGroupsHtml = POWER_SHORTCUT_GROUPS.map(
    renderPowerShortcutGroup,
  ).join("");

  view.innerHTML = `
    <div class="tools-shell">
      <header id="tools-launcher-header" class="tools-shell-header">
        <div class="title">
          <i class="fa-solid fa-screwdriver-wrench"></i>
          <div class="title-content">
            <h1 class="wg-text-gradient" data-i18n="wg.title">${t("wg.title")}</h1>
            <p class="subtitle" data-i18n="wg.subtitle">${t("wg.subtitle")}</p>
          </div>
        </div>
      </header>

      <div id="tools-nav" class="tools-nav">
        <button
          id="tools-back-btn"
          type="button"
          class="small-button hidden"
          data-i18n-title="tools.nav.back"
          data-i18n-aria="tools.nav.back"
          title="${t("tools.nav.back")}"
          aria-label="${t("tools.nav.back")}"
        >
          <i class="fa-solid fa-arrow-left"></i>
        </button>
        <div class="tools-breadcrumbs" aria-label="${t("tools.launcher.breadcrumbs.aria")}" data-i18n-aria="tools.launcher.breadcrumbs.aria">
          <button
            id="tools-breadcrumb-tools"
            type="button"
            class="tools-breadcrumbs__item tools-breadcrumbs__link is-active"
            data-i18n-aria="tools.launcher.breadcrumbs.tools"
            aria-label="${t("tools.launcher.breadcrumbs.tools")}"
          >
            <span data-i18n="tools.launcher.breadcrumbs.tools">${t("tools.launcher.breadcrumbs.tools")}</span>
          </button>
          <i
            id="tools-breadcrumb-current-sep"
            class="fa-solid fa-chevron-right tools-breadcrumbs__sep hidden"
            aria-hidden="true"
          ></i>
          <span
            id="tools-breadcrumb-current"
            class="tools-breadcrumbs__item tools-breadcrumbs__item--current hidden"
          ></span>
        </div>
      </div>

      <div id="tools-launcher-section-header" class="tools-launcher-section-header">
        <h2 class="tools-launcher-section-title" data-i18n="tools.launcher.availableTitle">${t("tools.launcher.availableTitle")}</h2>
        <span id="tools-launcher-tools-count" class="tools-launcher-tools-count" data-i18n="tools.launcher.totalLabel">${t("tools.launcher.totalLabel")}</span>
      </div>

      <section id="tools-launcher" class="tools-launcher" aria-label="${t("tools.launcher.title")}">
        <div class="tools-launcher-inner">
          <div class="tools-launcher-grid">
            <button id="tools-open-power" type="button" class="tools-launcher-button">
              <i class="fa-solid fa-power-off"></i>
              <span data-i18n="tools.launcher.open.power">Power Shortcuts</span>
              <small class="tools-launcher-button__desc" data-i18n="tools.launcher.desc.power">
                ${t("tools.launcher.desc.power")}
              </small>
            </button>
            <button id="tools-open-hash" type="button" class="tools-launcher-button">
              <i class="fa-solid fa-fingerprint"></i>
              <span data-i18n="tools.launcher.open.hash">Hash Check</span>
              <small class="tools-launcher-button__desc" data-i18n="tools.launcher.desc.hash">
                ${t("tools.launcher.desc.hash")}
              </small>
            </button>
            <button id="tools-open-media-inspector" type="button" class="tools-launcher-button">
              <i class="fa-solid fa-film"></i>
              <span data-i18n="tools.launcher.open.mediaInspector">Media Inspector</span>
              <small class="tools-launcher-button__desc" data-i18n="tools.launcher.desc.mediaInspector">
                ${t("tools.launcher.desc.mediaInspector")}
              </small>
            </button>
            <button id="tools-open-wg" type="button" class="tools-launcher-button">
              <i class="fa-solid fa-satellite-dish"></i>
              <span data-i18n="tools.launcher.open.wg">WG Unlock</span>
              <small class="tools-launcher-button__desc" data-i18n="tools.launcher.desc.wg">
                ${t("tools.launcher.desc.wg")}
              </small>
            </button>
            <button id="tools-open-backup" type="button" class="tools-launcher-button">
              <i class="fa-solid fa-box-archive"></i>
              <span data-i18n="tools.launcher.open.backup">Backup</span>
              <small class="tools-launcher-button__desc" data-i18n="tools.launcher.desc.backup">
                ${t("tools.launcher.desc.backup")}
              </small>
            </button>
            <button id="tools-open-winget-installer" type="button" class="tools-launcher-button">
              <i class="fa-brands fa-windows"></i>
              <span data-i18n="tools.launcher.open.wingetInstaller">${t("tools.launcher.open.wingetInstaller")}</span>
              <small class="tools-launcher-button__desc" data-i18n="tools.launcher.desc.wingetInstaller">
                ${t("tools.launcher.desc.wingetInstaller")}
              </small>
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
            <div class="tools-launcher-unavailable-grid">
              <button
                id="tools-open-sorter"
                type="button"
                class="tools-launcher-button"
              >
              <i class="fa-solid fa-folder-tree"></i>
              <span data-i18n="tools.launcher.open.sorter">${t("tools.launcher.open.sorter")}</span>
              <small class="tools-launcher-button__desc" data-i18n="tools.launcher.desc.sorter">
                ${t("tools.launcher.desc.sorter")}
              </small>
              </button>
            </div>
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

        <section class="tools-view hidden" data-tool-view="media-inspector" aria-label="${t("tools.nav.current.mediaInspector")}"></section>

        ${renderWingetInstallerSection(t)}

        <section class="tools-view hidden" data-tool-view="power" aria-label="${t("tools.nav.current.power")}">
          <article id="tools-restart-card" class="tools-card tools-detail-card">
            <div class="power-shortcuts-dashboard">
              <div class="power-shortcuts-header">
                <div class="power-shortcuts-header__top">
                  <div class="power-shortcuts-header__title-wrap">
                    <h2 data-i18n="quickActions.power.title">${t("quickActions.power.title")}</h2>
                    <p id="restart-shortcut-note" class="tools-card__hint power-shortcuts-header__hint" data-i18n="quickActions.power.hint">
                      ${t("quickActions.power.hint")}
                    </p>
                  </div>
                  <div class="power-shortcuts-header__actions">
                    <button
                      id="power-open-howto"
                      type="button"
                      class="small-button power-howto-open"
                      data-bs-toggle="tooltip"
                      data-bs-placement="top"
                      data-i18n-title="quickActions.power.howto.open"
                      data-i18n-aria="quickActions.power.howto.open"
                      title="${t("quickActions.power.howto.open")}"
                      aria-label="${t("quickActions.power.howto.open")}"
                    >
                      <i class="fa-regular fa-circle-question"></i>
                    </button>
                  </div>
                </div>
              </div>
              <section
                id="power-session-summary"
                class="power-session-summary hidden"
                aria-live="polite"
              >
                <div class="power-session-summary__copy">
                  <strong data-i18n="quickActions.power.session.title">${t("quickActions.power.session.title")}</strong>
                  <span id="power-session-summary-text">${t("quickActions.power.session.empty")}</span>
                  <small id="power-session-summary-detail" class="power-session-summary__detail hidden"></small>
                </div>
                <div class="power-session-summary__actions">
                  <button id="power-repeat-last-action" type="button" class="small-button">
                    <span data-i18n="quickActions.power.createAnother">${t("quickActions.power.createAnother")}</span>
                  </button>
                  <button id="power-clear-status" type="button" class="small-button">
                    <span data-i18n="quickActions.power.clearStatus">${t("quickActions.power.clearStatus")}</span>
                  </button>
                </div>
              </section>
              <div
                id="power-platform-banner"
                class="power-platform-banner hidden"
                role="status"
                aria-live="polite"
              >
                <i class="fa-solid fa-circle-info"></i>
                <div class="power-platform-banner__content">
                  <strong data-i18n="quickActions.power.banner.title">${t("quickActions.power.banner.title")}</strong>
                  <span id="power-platform-banner-text" data-i18n="quickActions.power.banner.windowsOnly">
                    ${t("quickActions.power.banner.windowsOnly")}
                  </span>
                </div>
              </div>
              <div class="power-shortcuts-groups power-shortcuts-actions">
                ${powerShortcutGroupsHtml}
              </div>
            </div>
            <div id="power-howto-modal" class="power-howto-overlay hidden" aria-hidden="true">
              <div
                id="power-howto-dialog"
                class="power-howto-dialog"
                role="dialog"
                aria-modal="true"
                aria-hidden="true"
                aria-labelledby="power-howto-title"
                tabindex="-1"
              >
                <div class="power-howto-header">
                  <h3 id="power-howto-title" data-i18n="quickActions.power.howto.title">${t("quickActions.power.howto.title")}</h3>
                  <button id="power-howto-close" type="button" class="small-button" data-i18n-aria="quickActions.power.howto.close" aria-label="${t("quickActions.power.howto.close")}">
                    <i class="fa-solid fa-xmark"></i>
                  </button>
                </div>
                <div id="power-howto-step" class="power-howto-step muted"></div>
                <div class="power-howto-viewport">
                  <div id="power-howto-track" class="power-howto-track">
                    <article class="power-howto-slide" data-howto-slide="0">
                      <div class="power-howto-slide__icon"><i class="fa-brands fa-windows"></i></div>
                      <h4 data-i18n="quickActions.power.howto.slide1.title">${t("quickActions.power.howto.slide1.title")}</h4>
                      <p data-i18n="quickActions.power.howto.slide1.desc">${t("quickActions.power.howto.slide1.desc")}</p>
                    </article>
                    <article class="power-howto-slide" data-howto-slide="1">
                      <div class="power-howto-slide__icon"><i class="fa-solid fa-list-check"></i></div>
                      <h4 data-i18n="quickActions.power.howto.slide2.title">${t("quickActions.power.howto.slide2.title")}</h4>
                      <p data-i18n="quickActions.power.howto.slide2.desc">${t("quickActions.power.howto.slide2.desc")}</p>
                    </article>
                    <article class="power-howto-slide" data-howto-slide="2">
                      <div class="power-howto-slide__icon"><i class="fa-solid fa-desktop"></i></div>
                      <h4 data-i18n="quickActions.power.howto.slide3.title">${t("quickActions.power.howto.slide3.title")}</h4>
                      <p data-i18n="quickActions.power.howto.slide3.desc">${t("quickActions.power.howto.slide3.desc")}</p>
                    </article>
                    <article class="power-howto-slide" data-howto-slide="3">
                      <div class="power-howto-slide__icon"><i class="fa-regular fa-circle-check"></i></div>
                      <h4 data-i18n="quickActions.power.howto.slide4.title">${t("quickActions.power.howto.slide4.title")}</h4>
                      <p data-i18n="quickActions.power.howto.slide4.desc">${t("quickActions.power.howto.slide4.desc")}</p>
                    </article>
                  </div>
                </div>
                <div id="power-howto-dots" class="power-howto-dots" role="tablist" data-i18n-aria="quickActions.power.howto.title" aria-label="${t("quickActions.power.howto.title")}">
                  <button type="button" class="power-howto-dot" data-index="0" aria-label="${t("quickActions.power.howto.step", { current: 1, total: 4 })}"></button>
                  <button type="button" class="power-howto-dot" data-index="1" aria-label="${t("quickActions.power.howto.step", { current: 2, total: 4 })}"></button>
                  <button type="button" class="power-howto-dot" data-index="2" aria-label="${t("quickActions.power.howto.step", { current: 3, total: 4 })}"></button>
                  <button type="button" class="power-howto-dot" data-index="3" aria-label="${t("quickActions.power.howto.step", { current: 4, total: 4 })}"></button>
                </div>
                <div class="power-howto-actions">
                  <button id="power-howto-prev" type="button" class="small-button">
                    <i class="fa-solid fa-arrow-left"></i>
                    <span data-i18n="quickActions.power.howto.prev">${t("quickActions.power.howto.prev")}</span>
                  </button>
                  <button id="power-howto-next" type="button" class="small-button">
                    <span data-i18n="quickActions.power.howto.next">${t("quickActions.power.howto.next")}</span>
                    <i class="fa-solid fa-arrow-right"></i>
                  </button>
                </div>
              </div>
            </div>
          </article>
        </section>

        ${renderFileSorterView(t)}

        <section
          class="tools-view hidden"
          data-tool-view="backup"
          aria-label="${t("tools.nav.current.backup")}"
        ></section>
      </section>
    </div>
  `;

  container.appendChild(view);
  applyI18n(view);

  const isPowerToolSupportedPlatform = (info = toolState.toolsPlatformInfo) =>
    toolState.isPowerToolSupportedPlatform(info);

  const isToolAvailable = (toolView, info = toolState.toolsPlatformInfo) =>
    toolState.isToolAvailable(toolView, info);

  const updateLauncherToolsCount = () => {
    const countEl = getEl("tools-launcher-tools-count", view);
    if (!countEl) return;
    const availableToolViews = [
      "wg",
      "hash",
      "media-inspector",
      "winget-installer",
      "power",
      "backup",
      "sorter",
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

  const setToolView = (
    nextView,
    { persist = true, focusLauncher = false } = {},
  ) => {
    const shell = view.querySelector(".tools-shell");
    const launcher = getEl("tools-launcher", view);
    const launcherSectionHeader = getEl("tools-launcher-section-header", view);
    const breadcrumbCurrentSep = getEl("tools-breadcrumb-current-sep", view);
    const breadcrumbCurrent = getEl("tools-breadcrumb-current", view);
    const toolsNav = getEl("tools-nav", view);
    const backBtn = getEl("tools-back-btn", view);
    const title = getEl("tools-view-title", view);
    const requested = String(nextView || "launcher");
    const targetView = isToolAvailable(requested) ? requested : "launcher";
    toolState.setCurrentToolView(targetView);

    const showLauncher = targetView === "launcher";
    shell?.classList.toggle("is-launcher", showLauncher);
    launcher?.classList.toggle("hidden", !showLauncher);
    launcherSectionHeader?.classList.toggle("hidden", !showLauncher);
    toolsNav?.classList.toggle("hidden", showLauncher);
    updateLauncherToolsCount();

    view.querySelectorAll(".tools-view[data-tool-view]").forEach((section) => {
      const sectionView = section.getAttribute("data-tool-view");
      const active = sectionView === targetView;
      section.classList.toggle("hidden", !active);
      section.classList.toggle("is-active", active);
    });

    backBtn?.classList.toggle("hidden", showLauncher);

    const titleKey = showLauncher
      ? "tools.launcher.title"
      : targetView === "wg"
        ? "tools.nav.current.wg"
        : targetView === "hash"
          ? "tools.nav.current.hash"
          : targetView === "media-inspector"
            ? "tools.nav.current.mediaInspector"
            : targetView === "winget-installer"
              ? "tools.nav.current.wingetInstaller"
              : targetView === "power"
                ? "tools.nav.current.power"
                : targetView === "backup"
                  ? "tools.nav.current.backup"
                  : "tools.nav.current.sorter";
    if (title) title.textContent = t(titleKey);
    if (breadcrumbCurrent)
      breadcrumbCurrent.textContent = showLauncher ? "" : t(titleKey);
    breadcrumbCurrent?.classList.toggle("hidden", showLauncher);
    breadcrumbCurrentSep?.classList.toggle("hidden", showLauncher);

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

    if (showLauncher && focusLauncher) {
      const firstLauncherBtn = getEl("tools-open-wg", view);
      firstLauncherBtn?.focus();
    }
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

      if (cfg.autosend) {
        log(t("wg.log.send.scheduleAuto"));
        cleanup.setTimeout(() => getEl("wg-send", view)?.click(), 50);
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
    const openMediaInspectorBtn = getEl("tools-open-media-inspector", view);
    const openPowerBtn = getEl("tools-open-power", view);
    const openBackupBtn = getEl("tools-open-backup", view);
    const openWingetInstallerBtn = getEl("tools-open-winget-installer", view);
    const openSorterBtn = getEl("tools-open-sorter", view);
    const backBtn = getEl("tools-back-btn", view);
    const breadcrumbToolsBtn = getEl("tools-breadcrumb-tools", view);

    const applyDeveloperToolsAvailability = () => {
      toolState.setDeveloperToolsUnlocked(
        toolState.readDeveloperToolsUnlocked(),
      );
      if (
        !openPowerBtn ||
        !openBackupBtn ||
        !openWingetInstallerBtn ||
        !openSorterBtn ||
        !launcherAvailableGrid ||
        !launcherUnavailableGrid ||
        !launcherUnavailableSection
      ) {
        return;
      }

      const powerSupported = isPowerToolSupportedPlatform(
        toolState.toolsPlatformInfo,
      );
      const powerAvailable = isToolAvailable("power");
      if (!powerSupported) {
        openPowerBtn.classList.add("hidden");
        openPowerBtn.disabled = true;
        openPowerBtn.setAttribute("aria-disabled", "true");
      } else if (powerAvailable) {
        openPowerBtn.classList.remove("hidden");
        if (openPowerBtn.parentElement !== launcherAvailableGrid) {
          launcherAvailableGrid.appendChild(openPowerBtn);
        }
        openPowerBtn.disabled = false;
        openPowerBtn.removeAttribute("aria-disabled");
        openPowerBtn.classList.remove("is-unavailable");
      } else {
        openPowerBtn.classList.remove("hidden");
        if (openPowerBtn.parentElement !== launcherUnavailableGrid) {
          launcherUnavailableGrid.appendChild(openPowerBtn);
        }
        openPowerBtn.disabled = true;
        openPowerBtn.setAttribute("aria-disabled", "true");
        openPowerBtn.classList.add("is-unavailable");
      }

      if (openSorterBtn.parentElement !== launcherAvailableGrid) {
        launcherAvailableGrid.appendChild(openSorterBtn);
      }
      if (openBackupBtn.parentElement !== launcherAvailableGrid) {
        launcherAvailableGrid.appendChild(openBackupBtn);
      }
      if (isToolAvailable("winget-installer")) {
        if (openWingetInstallerBtn.parentElement !== launcherAvailableGrid) {
          launcherAvailableGrid.appendChild(openWingetInstallerBtn);
        }
        openWingetInstallerBtn.disabled = false;
        openWingetInstallerBtn.removeAttribute("aria-disabled");
        openWingetInstallerBtn.classList.remove("is-unavailable");
      } else {
        if (openWingetInstallerBtn.parentElement !== launcherUnavailableGrid) {
          launcherUnavailableGrid.appendChild(openWingetInstallerBtn);
        }
        openWingetInstallerBtn.disabled = true;
        openWingetInstallerBtn.setAttribute("aria-disabled", "true");
        openWingetInstallerBtn.classList.add("is-unavailable");
      }
      openSorterBtn.disabled = false;
      openSorterBtn.removeAttribute("aria-disabled");
      openSorterBtn.classList.remove("is-unavailable");
      openBackupBtn.disabled = false;
      openBackupBtn.removeAttribute("aria-disabled");
      openBackupBtn.classList.remove("is-unavailable");
      openBackupBtn.classList.toggle("hidden", !isToolAvailable("backup"));
      launcherUnavailableSection.classList.toggle(
        "hidden",
        launcherUnavailableGrid.children.length === 0,
      );
      updateLauncherToolsCount();
    };

    openWgBtn?.addEventListener("click", () => setToolView("wg"));
    openHashBtn?.addEventListener("click", () => setToolView("hash"));
    openMediaInspectorBtn?.addEventListener("click", () =>
      setToolView("media-inspector"),
    );
    openPowerBtn?.addEventListener("click", () => setToolView("power"));
    openWingetInstallerBtn?.addEventListener("click", () =>
      setToolView("winget-installer"),
    );
    openBackupBtn?.addEventListener("click", () => {
      ensureBackupToolView();
      setToolView("backup");
    });
    openSorterBtn?.addEventListener("click", () => {
      if (!isToolAvailable("sorter")) return;
      setToolView("sorter");
    });
    backBtn?.addEventListener("click", () =>
      setToolView("launcher", { persist: false, focusLauncher: true }),
    );
    breadcrumbToolsBtn?.addEventListener("click", () =>
      setToolView("launcher", { persist: false, focusLauncher: true }),
    );

    const isWgHowtoOpen = () => {
      const modal = getEl("wg-howto-modal", view);
      return !!modal && !modal.classList.contains("hidden");
    };

    const isPowerHowtoOpen = () => {
      const modal = getEl("power-howto-modal", view);
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
      if (isPowerHowtoOpen()) {
        const key = String(e.key || "");
        if (key === "Escape" || key === "Esc") {
          e.preventDefault();
          closePowerHowtoModal();
          return;
        }
        if (key === "ArrowLeft") {
          e.preventDefault();
          setPowerHowtoSlide(powerHowtoIndex - 1);
          return;
        }
        if (key === "ArrowRight") {
          e.preventDefault();
          setPowerHowtoSlide(powerHowtoIndex + 1);
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

      if (isEscapePressed && toolState.currentToolView !== "launcher") {
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
          const launcherButtons = [
            openWgBtn,
            openHashBtn,
            openPowerBtn,
            openBackupBtn,
            openSorterBtn,
          ].filter(
            (btn) =>
              btn &&
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
      setPowerAvailabilityUi({
        isWindows: toolState.isWindowsPlatform,
        showTool: isPowerToolSupportedPlatform(toolState.toolsPlatformInfo),
      });
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

    initFileSorterSection({
      view,
      getEl,
      t,
      registerCleanup: cleanup.addCleanup,
    });
    initMediaInspectorSection({
      view,
      getEl,
      t,
      registerCleanup: cleanup.addCleanup,
    });

    const restartCard = getEl("tools-restart-card", view);
    const powerOpenHowtoBtn = getEl("power-open-howto", view);
    const powerHowtoModalEl = getEl("power-howto-modal", view);
    const powerHowtoDialogEl = getEl("power-howto-dialog", view);
    const powerHowtoTrackEl = getEl("power-howto-track", view);
    const powerHowtoStepEl = getEl("power-howto-step", view);
    const powerHowtoCloseBtn = getEl("power-howto-close", view);
    const powerHowtoPrevBtn = getEl("power-howto-prev", view);
    const powerHowtoNextBtn = getEl("power-howto-next", view);
    const powerHowtoDotsEl = getEl("power-howto-dots", view);
    const powerHowtoDots = Array.from(
      powerHowtoDotsEl?.querySelectorAll(".power-howto-dot") || [],
    );
    const powerHowtoSlideCount = 4;
    let powerHowtoIndex = 0;
    let powerHowtoReturnFocusEl = null;
    const restartShortcutNote = getEl("restart-shortcut-note", view);
    const powerPlatformBanner = getEl("power-platform-banner", view);
    const powerPlatformBannerText = getEl("power-platform-banner-text", view);
    const powerSessionSummary = getEl("power-session-summary", view);
    const powerSessionSummaryText = getEl("power-session-summary-text", view);
    const powerSessionSummaryDetail = getEl(
      "power-session-summary-detail",
      view,
    );
    const powerRepeatLastActionBtn = getEl("power-repeat-last-action", view);
    const powerClearStatusBtn = getEl("power-clear-status", view);
    const powerShortcutActions = POWER_SHORTCUT_ACTIONS.map((action) => ({
      ...action,
      button: getEl(action.buttonId, view),
      resultEl: getEl(action.resultId, view),
      detailEl: getEl(action.detailId, view),
      stateEl: getEl(action.stateId, view),
      cardEl: view.querySelector(`[data-power-action="${action.id}"]`),
      invoke: () => window.electron?.tools?.[action.invokeMethod]?.(),
    }));
    let powerBusy = false;
    let powerLastSuccessfulActionId = "";

    const updatePowerHowtoUi = () => {
      if (!powerHowtoTrackEl) return;
      powerHowtoTrackEl.style.transform = `translateX(-${powerHowtoIndex * 100}%)`;
      if (powerHowtoStepEl) {
        powerHowtoStepEl.textContent = t("quickActions.power.howto.step", {
          current: powerHowtoIndex + 1,
          total: powerHowtoSlideCount,
        });
      }
      if (powerHowtoPrevBtn) powerHowtoPrevBtn.disabled = powerHowtoIndex <= 0;
      if (powerHowtoNextBtn) {
        powerHowtoNextBtn.disabled =
          powerHowtoIndex >= powerHowtoSlideCount - 1;
      }
      powerHowtoDots.forEach((dot, idx) => {
        const isActive = idx === powerHowtoIndex;
        dot.classList.toggle("is-active", isActive);
        dot.setAttribute("aria-current", isActive ? "true" : "false");
      });
    };

    const setPowerHowtoSlide = (index) => {
      const nextIndex = Math.max(
        0,
        Math.min(Number(index) || 0, powerHowtoSlideCount - 1),
      );
      powerHowtoIndex = nextIndex;
      updatePowerHowtoUi();
    };

    const openPowerHowtoModal = () => {
      if (!powerHowtoModalEl || !powerHowtoDialogEl) return;
      powerHowtoReturnFocusEl = document.activeElement;
      acquireDocumentScrollLock(POWER_HOWTO_SCROLL_LOCK_OWNER);
      powerHowtoModalEl.classList.remove("hidden");
      powerHowtoModalEl.setAttribute("aria-hidden", "false");
      powerHowtoDialogEl.setAttribute("aria-hidden", "false");
      setPowerHowtoSlide(0);
      cleanup.setTimeout(() => powerHowtoCloseBtn?.focus(), 0);
    };

    const closePowerHowtoModal = ({ returnFocus = true } = {}) => {
      if (!powerHowtoModalEl || !powerHowtoDialogEl) return;
      powerHowtoModalEl.classList.add("hidden");
      powerHowtoModalEl.setAttribute("aria-hidden", "true");
      powerHowtoDialogEl.setAttribute("aria-hidden", "true");
      releaseDocumentScrollLock(POWER_HOWTO_SCROLL_LOCK_OWNER);
      if (returnFocus) {
        if (powerHowtoReturnFocusEl?.focus) powerHowtoReturnFocusEl.focus();
        else powerOpenHowtoBtn?.focus();
      }
    };

    const setPowerActionVisualState = (
      action,
      state,
      { message = "", detail = "", detailTitle = "" } = {},
    ) => {
      const tone = getPowerActionStateTone(state);
      if (action.stateEl) {
        action.stateEl.textContent = t(`quickActions.power.status.${state}`);
        action.stateEl.className = `power-shortcut-card__state is-${state}`;
      }
      if (action.resultEl) {
        action.resultEl.textContent = message;
        action.resultEl.className = `quick-action-result power-shortcut-card__result-text ${tone}`;
      }
      if (action.detailEl) {
        action.detailEl.textContent = detail;
        action.detailEl.classList.toggle("hidden", !detail);
        action.detailEl.title = detailTitle || detail || "";
      }
      if (action.cardEl) {
        action.cardEl.classList.toggle("is-busy", state === "creating");
        action.cardEl.classList.toggle("is-success", state === "success");
        action.cardEl.classList.toggle("is-error", state === "error");
      }
    };

    const resetPowerActionState = (action) => {
      setPowerActionVisualState(action, "idle");
    };

    const resetAllPowerActionStates = () => {
      powerShortcutActions.forEach(resetPowerActionState);
      powerLastSuccessfulActionId = "";
      powerSessionSummary?.classList.add("hidden");
      if (powerSessionSummaryText) {
        powerSessionSummaryText.textContent = t(
          "quickActions.power.session.empty",
        );
      }
      if (powerSessionSummaryDetail) {
        powerSessionSummaryDetail.textContent = "";
        powerSessionSummaryDetail.classList.add("hidden");
        powerSessionSummaryDetail.title = "";
      }
    };

    const showPowerSessionSummary = (action, detail = "") => {
      powerLastSuccessfulActionId = action.id;
      powerSessionSummary?.classList.remove("hidden");
      if (powerSessionSummaryText) {
        powerSessionSummaryText.textContent = t(
          "quickActions.power.session.success",
          {
            action: t(action.cardTitleKey),
          },
        );
      }
      if (powerSessionSummaryDetail) {
        powerSessionSummaryDetail.textContent = detail;
        powerSessionSummaryDetail.classList.toggle("hidden", !detail);
        powerSessionSummaryDetail.title = detail || "";
      }
    };

    const setPowerButtonsBusy = (busy, { isWindows, showTool }) => {
      powerBusy = !!busy;
      const enabled = isPowerActionEnabled({ isWindows, showTool, busy });
      powerShortcutActions.forEach((action) => {
        if (!action.button) return;
        action.button.toggleAttribute("disabled", !enabled);
        action.button.classList.toggle("is-disabled", !enabled);
      });
    };

    function setPowerAvailabilityUi({ isWindows, showTool }) {
      const windowsOnlyText = t("quickActions.power.windowsOnly");
      const windowsReadyText = t("quickActions.power.windowsReady");
      const windowsOnlyBannerText = t("quickActions.power.banner.windowsOnly");
      const previewBannerText = t("quickActions.power.banner.previewOnly");
      if (!showTool) {
        restartCard?.classList.add("hidden");
        openPowerBtn?.classList.add("hidden");
        powerPlatformBanner?.classList.add("hidden");
        if (powerPlatformBannerText) {
          powerPlatformBannerText.textContent = windowsOnlyBannerText;
        }
        if (restartShortcutNote) {
          restartShortcutNote.textContent = windowsOnlyText;
        }
      } else {
        restartCard?.classList.remove("hidden");
        openPowerBtn?.classList.remove("hidden");
        if (restartShortcutNote) {
          restartShortcutNote.textContent = isWindows
            ? windowsReadyText
            : windowsOnlyText;
        }
        if (powerPlatformBannerText) {
          powerPlatformBannerText.textContent = isWindows
            ? windowsOnlyBannerText
            : previewBannerText;
        }
        powerPlatformBanner?.classList.toggle("hidden", !!isWindows);
      }

      setPowerButtonsBusy(powerBusy, { isWindows, showTool });
    }

    powerShortcutActions.forEach((action) => {
      action.button?.addEventListener("click", async () => {
        if (powerBusy || action.button?.disabled) return;
        const confirmed = await showConfirmationDialog({
          title: t(action.titleKey),
          subtitle: t("confirm.default.subtitle"),
          message: t(action.confirmKey),
          tone: "info",
        });
        if (!confirmed) return;

        powerShortcutActions.forEach((item) =>
          item.id === action.id
            ? setPowerActionVisualState(item, "creating", {
                message: t("quickActions.power.result.creating", {
                  action: t(item.cardTitleKey),
                }),
              })
            : resetPowerActionState(item),
        );
        setPowerButtonsBusy(true, {
          isWindows: toolState.isWindowsPlatform,
          showTool: isPowerToolSupportedPlatform(toolState.toolsPlatformInfo),
        });

        const res = await action.invoke();
        setPowerButtonsBusy(false, {
          isWindows: toolState.isWindowsPlatform,
          showTool: isPowerToolSupportedPlatform(toolState.toolsPlatformInfo),
        });
        if (!res?.success) {
          setPowerActionVisualState(action, "error", {
            message: t("quickActions.power.result.error", {
              action: t(action.cardTitleKey),
            }),
            detail: res?.error || "",
            detailTitle: res?.error || "",
          });
          powerSessionSummary?.classList.add("hidden");
          powerLastSuccessfulActionId = "";
          return;
        }
        const detail = res?.path || t("quickActions.power.desktopLocation");
        setPowerActionVisualState(action, "success", {
          message: t("quickActions.power.result.created", {
            action: t(action.cardTitleKey),
          }),
          detail,
          detailTitle: detail,
        });
        showPowerSessionSummary(action, detail);
      });
    });

    powerRepeatLastActionBtn?.addEventListener("click", () => {
      const action = powerShortcutActions.find(
        (item) => item.id === powerLastSuccessfulActionId,
      );
      resetAllPowerActionStates();
      action?.button?.focus();
    });

    powerClearStatusBtn?.addEventListener("click", () => {
      resetAllPowerActionStates();
      powerClearStatusBtn?.focus();
    });

    resetAllPowerActionStates();

    powerOpenHowtoBtn?.addEventListener("click", () => openPowerHowtoModal());
    powerHowtoCloseBtn?.addEventListener("click", () => closePowerHowtoModal());
    powerHowtoPrevBtn?.addEventListener("click", () =>
      setPowerHowtoSlide(powerHowtoIndex - 1),
    );
    powerHowtoNextBtn?.addEventListener("click", () =>
      setPowerHowtoSlide(powerHowtoIndex + 1),
    );
    powerHowtoDots.forEach((dot) => {
      dot.addEventListener("click", () => {
        setPowerHowtoSlide(Number(dot.dataset.index || "0"));
      });
    });
    powerHowtoModalEl?.addEventListener("mousedown", (event) => {
      if (event.target === powerHowtoModalEl) closePowerHowtoModal();
    });
    updatePowerHowtoUi();

    const showPowerTool = isPowerToolSupportedPlatform(
      toolState.toolsPlatformInfo,
    );
    setPowerAvailabilityUi({
      isWindows: toolState.isWindowsPlatform,
      showTool: showPowerTool,
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
      initWingetInstallerSection({
        cleanup,
        getEl,
        platformInfo: toolState.toolsPlatformInfo,
        showToast,
        t,
        view,
      });
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
