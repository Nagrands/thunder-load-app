// src/js/modules/views/toolsView.js

import { showToast } from "../toast.js";
import { showConfirmationDialog } from "../modals.js";
import { initTooltips } from "../tooltipInitializer.js";
import { applyI18n, getLanguage, t } from "../i18n.js";
import { consumeRequestedToolsView } from "../toolsNavigation.js";
import renderBackup from "./backupView.js";
import { initMediaInspectorSection } from "./tools/mediaInspectorSection.js";
import { initFileSorterSection } from "./tools/fileSorterSection.js";
import { createCleanupRegistry } from "./tools/cleanupRegistry.js";
import { TOOLS_STORAGE_KEYS } from "./tools/storage.js";
import { createLogController } from "./tools/logController.js";
import { createToolViewState } from "./tools/toolViewState.js";
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
  let shutdownTicker = null;
  let shutdownDeadlineTs = null;
  let lastLoggedRemaining = null;
  let tipsIntervalId = null;
  let tipsSwapTimer = null;
  let tipsFadeTimer = null;
  let tipsPaused = false;
  let tipsItems = [];
  let tipsIndex = 0;
  let hashSelectedFile = "";
  let hashSelectedFileSecond = "";
  let hashCopyFeedbackTimerFirst = null;
  let hashCopyFeedbackTimerSecond = null;
  let wgHowtoPrevOverflow = null;
  let powerHowtoPrevOverflow = null;
  let hashHowtoPrevOverflow = null;
  let sorterHowtoPrevOverflow = null;

  const disposeView = () => {
    if (wgHowtoPrevOverflow !== null) {
      document.documentElement.style.overflow = wgHowtoPrevOverflow;
      wgHowtoPrevOverflow = null;
    }
    if (powerHowtoPrevOverflow !== null) {
      document.documentElement.style.overflow = powerHowtoPrevOverflow;
      powerHowtoPrevOverflow = null;
    }
    if (hashHowtoPrevOverflow !== null) {
      document.documentElement.style.overflow = hashHowtoPrevOverflow;
      hashHowtoPrevOverflow = null;
    }
    if (sorterHowtoPrevOverflow !== null) {
      document.documentElement.style.overflow = sorterHowtoPrevOverflow;
      sorterHowtoPrevOverflow = null;
    }
    stopCountdown();
    tipsIntervalId = cleanup.clearInterval(tipsIntervalId);
    tipsSwapTimer = cleanup.clearTimeout(tipsSwapTimer);
    tipsFadeTimer = cleanup.clearTimeout(tipsFadeTimer);
    hashCopyFeedbackTimerFirst = cleanup.clearTimeout(
      hashCopyFeedbackTimerFirst,
    );
    hashCopyFeedbackTimerSecond = cleanup.clearTimeout(
      hashCopyFeedbackTimerSecond,
    );
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
  // ФУНКЦИИ АВТО-ЗАКРЫТИЯ
  // =============================================

  const stopCountdown = () => {
    log(t("wg.log.autoShutdown.timerStopped"));
    shutdownTicker = cleanup.clearInterval(shutdownTicker);
    shutdownDeadlineTs = null;
    lastLoggedRemaining = null;
  };

  const startCountdownWithDeadline = (deadlineMs) => {
    stopCountdown();
    shutdownDeadlineTs = Number(deadlineMs);
    log(
      t("wg.log.autoShutdown.timerStartedUntil", {
        time: new Date(shutdownDeadlineTs).toLocaleTimeString(),
      }),
    );

    if (!Number.isFinite(shutdownDeadlineTs)) return;

    const tick = () => {
      const now = Date.now();
      let remaining = Math.ceil((shutdownDeadlineTs - now) / 1000);
      if (remaining < 0) remaining = 0;
      if (lastLoggedRemaining !== remaining) {
        log(t("wg.log.autoShutdown.remaining", { seconds: remaining }));
        lastLoggedRemaining = remaining;
      }
      if (remaining <= 0) {
        stopCountdown();
      }
    };

    tick();
    shutdownTicker = cleanup.setInterval(tick, 1000);
  };

  const startCountdownFromSeconds = (secs) => {
    const s = Number(secs);
    const safeSecs = Number.isFinite(s) ? s : 30;
    const deadline = Date.now() + safeSecs * 1000;
    startCountdownWithDeadline(deadline);
  };

  const initAutoShutdown = async () => {
    try {
      const [enabled, seconds] = await Promise.all([
        window.electron.ipcRenderer.invoke("get-auto-shutdown-status"),
        window.electron.ipcRenderer.invoke("get-auto-shutdown-seconds"),
      ]);

      let deadline = null;
      try {
        deadline = await window.electron.ipcRenderer.invoke(
          "get-auto-shutdown-deadline",
        );
      } catch (_) {}

      if (enabled) {
        if (deadline && Number.isFinite(Number(deadline))) {
          startCountdownWithDeadline(Number(deadline));
          const eta = new Date(Number(deadline)).toLocaleTimeString();
          log(t("wg.log.autoShutdown.loaded.enabledWithEta", { time: eta }));
        } else {
          startCountdownFromSeconds(seconds);
          log(
            t("wg.log.autoShutdown.loaded.enabledWithSeconds", {
              seconds: Number(seconds) || 30,
            }),
          );
        }
      } else {
        log(
          t("wg.log.autoShutdown.loaded.disabled", {
            seconds: Number(seconds) || 30,
          }),
        );
      }
    } catch (e) {
      console.error("auto-shutdown init error:", e);
      log(t("wg.log.autoShutdown.initError", { message: e.message }), true);
    }
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

      <div class="tools-breadcrumbs" aria-label="${t("tools.launcher.breadcrumbs.aria")}" data-i18n-aria="tools.launcher.breadcrumbs.aria">
        <button
          id="tools-breadcrumb-home"
          type="button"
          class="tools-breadcrumbs__item tools-breadcrumbs__link"
          data-i18n-aria="tools.launcher.breadcrumbs.home"
          aria-label="${t("tools.launcher.breadcrumbs.home")}"
        >
          <i class="fa-solid fa-screwdriver-wrench"></i>
          <span data-i18n="tools.launcher.breadcrumbs.home">${t("tools.launcher.breadcrumbs.home")}</span>
        </button>
        <i class="fa-solid fa-chevron-right tools-breadcrumbs__sep" aria-hidden="true"></i>
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
        <h2 id="tools-view-title" class="tools-view-title" data-i18n="tools.launcher.title">
          ${t("tools.launcher.title")}
        </h2>
      </div>

      <div id="tools-launcher-section-header" class="tools-launcher-section-header">
        <h2 class="tools-launcher-section-title" data-i18n="tools.launcher.availableTitle">${t("tools.launcher.availableTitle")}</h2>
        <span id="tools-launcher-tools-count" class="tools-launcher-tools-count" data-i18n="tools.launcher.totalLabel">${t("tools.launcher.totalLabel")}</span>
      </div>

      <section id="tools-launcher" class="tools-launcher" aria-label="${t("tools.launcher.title")}">
        <div class="tools-launcher-inner">
          <div class="tools-launcher-grid">
            <button id="tools-open-wg" type="button" class="tools-launcher-button">
              <i class="fa-solid fa-satellite-dish"></i>
              <span data-i18n="tools.launcher.open.wg">WG Unlock</span>
              <small class="tools-launcher-button__desc" data-i18n="tools.launcher.desc.wg">
                ${t("tools.launcher.desc.wg")}
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
            <button id="tools-open-power" type="button" class="tools-launcher-button">
              <i class="fa-solid fa-power-off"></i>
              <span data-i18n="tools.launcher.open.power">Power Shortcuts</span>
              <small class="tools-launcher-button__desc" data-i18n="tools.launcher.desc.power">
                ${t("tools.launcher.desc.power")}
              </small>
            </button>
            <button id="tools-open-backup" type="button" class="tools-launcher-button">
              <i class="fa-solid fa-box-archive"></i>
              <span data-i18n="tools.launcher.open.backup">Backup</span>
              <small class="tools-launcher-button__desc" data-i18n="tools.launcher.desc.backup">
                ${t("tools.launcher.desc.backup")}
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
              <span data-i18n="tools.launcher.open.sorter">File Sorter</span>
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

        <section class="tools-view hidden" data-tool-view="hash" aria-label="${t("tools.nav.current.hash")}">
          <article class="tools-card tools-detail-card">
            <div class="tools-card__header">
              <h2 data-i18n="hashCheck.title">${t("hashCheck.title")}</h2>
              <button
                id="hash-open-howto"
                type="button"
                class="small-button hash-howto-open"
                data-bs-toggle="tooltip"
                data-bs-placement="top"
                data-i18n-title="hashCheck.howto.open"
                data-i18n-aria="hashCheck.howto.open"
                title="${t("hashCheck.howto.open")}"
                aria-label="${t("hashCheck.howto.open")}"
              >
                <i class="fa-regular fa-circle-question"></i>
              </button>
            </div>
            <p class="tools-card__hint" data-i18n="hashCheck.subtitle">${t("hashCheck.subtitle")}</p>
            <div class="hash-check-grid">
              <div class="hash-row hash-row--top">
                <div class="hash-file-control">
                  <span class="muted hash-file-label" data-i18n="hashCheck.file1">${t("hashCheck.file1")}</span>
                  <div class="hash-actions-inline">
                    <button id="hash-pick-file" type="button" class="small-button">
                      <i class="fa-regular fa-file"></i>
                      <span data-i18n="hashCheck.pickFile">${t("hashCheck.pickFile")}</span>
                    </button>
                    <span id="hash-file-name" class="hash-file-pill muted" data-i18n="hashCheck.noFile">${t("hashCheck.noFile")}</span>
                  </div>
                </div>
                <div class="hash-algorithm-wrap">
                  <label for="hash-algorithm" class="muted" data-i18n="hashCheck.algorithm">${t("hashCheck.algorithm")}</label>
                  <select id="hash-algorithm" class="wg-input">
                    <option value="MD5">MD5</option>
                    <option value="SHA-1">SHA-1</option>
                    <option value="SHA-256" selected>SHA-256</option>
                    <option value="SHA-512">SHA-512</option>
                  </select>
                </div>
              </div>
              <div class="hash-row">
                <div class="hash-file-control">
                  <span class="muted hash-file-label" data-i18n="hashCheck.file2">${t("hashCheck.file2")}</span>
                  <div class="hash-actions-inline">
                    <button id="hash-pick-file-2" type="button" class="small-button">
                      <i class="fa-regular fa-file"></i>
                      <span data-i18n="hashCheck.pickFileSecond">${t("hashCheck.pickFileSecond")}</span>
                    </button>
                    <span id="hash-file-name-2" class="hash-file-pill muted" data-i18n="hashCheck.noFileSecond">${t("hashCheck.noFileSecond")}</span>
                    <button
                      id="hash-clear-file-2"
                      type="button"
                      class="small-button hash-clear-btn"
                      data-bs-toggle="tooltip"
                      data-bs-placement="top"
                      data-i18n-title="hashCheck.clearSecond"
                      data-i18n-aria="hashCheck.clearSecond"
                      title="${t("hashCheck.clearSecond")}"
                      aria-label="${t("hashCheck.clearSecond")}"
                      disabled
                    >
                      <i class="fa-solid fa-xmark"></i>
                    </button>
                  </div>
                </div>
              </div>

              <div class="hash-row hash-row--bottom">
                <div class="hash-expected-wrap">
                  <label for="hash-expected" class="muted" data-i18n="hashCheck.expected">${t("hashCheck.expected")}</label>
                  <input
                    id="hash-expected"
                    type="text"
                    class="wg-input"
                    data-i18n-placeholder="hashCheck.expectedPlaceholder"
                    placeholder="${t("hashCheck.expectedPlaceholder")}"
                  />
                </div>
                <button id="hash-run" type="button" class="large-button">
                  <i class="fa-solid fa-play"></i>
                  <span data-i18n="hashCheck.run">${t("hashCheck.run")}</span>
                </button>
              </div>
              <div class="hash-row">
                <span class="muted hash-expected-hint" data-i18n="hashCheck.expectedHint">
                  ${t("hashCheck.expectedHint")}
                </span>
              </div>
            </div>

            <div id="hash-result-panel" class="hash-result-panel is-idle">
              <div class="hash-result-panel__top">
                <span id="hash-status-badge" class="hash-status-badge muted" data-i18n="hashCheck.status.idle">${t("hashCheck.status.idle")}</span>
              </div>
              <div class="hash-actual-box">
                <div class="hash-actual-box__top">
                  <span id="hash-actual-label" class="muted">${t("hashCheck.actualLabelWithAlgorithm", { algorithm: "SHA-256" })}</span>
                  <div class="hash-copy-wrap">
                    <span id="hash-copy-feedback-1" class="hash-copy-feedback muted" aria-live="polite"></span>
                    <button
                      id="hash-copy-actual-1"
                      type="button"
                      class="small-button hash-copy-btn"
                      data-bs-toggle="tooltip"
                      data-bs-placement="top"
                      data-i18n-title="hashCheck.copyActual"
                      data-i18n-aria="hashCheck.copyActual"
                      title="${t("hashCheck.copyActual")}"
                      aria-label="${t("hashCheck.copyActual")}"
                      disabled
                    >
                      <i class="fa-regular fa-copy"></i>
                    </button>
                  </div>
                </div>
                <code id="hash-actual-value">-</code>
              </div>
              <div id="hash-actual-box-2" class="hash-actual-box hidden">
                <div class="hash-actual-box__top">
                  <span id="hash-actual-label-2" class="muted">${t("hashCheck.secondActualLabelWithAlgorithm", { algorithm: "SHA-256" })}</span>
                  <div class="hash-copy-wrap">
                    <span id="hash-copy-feedback-2" class="hash-copy-feedback muted" aria-live="polite"></span>
                    <button
                      id="hash-copy-actual-2"
                      type="button"
                      class="small-button hash-copy-btn"
                      data-bs-toggle="tooltip"
                      data-bs-placement="top"
                      data-i18n-title="hashCheck.copyActualSecond"
                      data-i18n-aria="hashCheck.copyActualSecond"
                      title="${t("hashCheck.copyActualSecond")}"
                      aria-label="${t("hashCheck.copyActualSecond")}"
                      disabled
                    >
                      <i class="fa-regular fa-copy"></i>
                    </button>
                  </div>
                </div>
                <code id="hash-actual-value-2">-</code>
              </div>
              <div id="hash-compare-details" class="hash-compare-details hidden">
                <div class="hash-compare-row">
                  <span id="hash-compare-name-1" class="muted">${t("hashCheck.file1")}</span>
                  <span id="hash-compare-state-1" class="hash-compare-state muted">-</span>
                </div>
                <div class="hash-compare-row">
                  <span id="hash-compare-name-2" class="muted">${t("hashCheck.file2")}</span>
                  <span id="hash-compare-state-2" class="hash-compare-state muted">-</span>
                </div>
              </div>
              <div id="hash-result" class="quick-action-result muted" data-i18n="hashCheck.resultIdle">${t("hashCheck.resultIdle")}</div>
            </div>
            <div id="hash-howto-modal" class="hash-howto-overlay hidden" aria-hidden="true">
              <div
                id="hash-howto-dialog"
                class="hash-howto-dialog"
                role="dialog"
                aria-modal="true"
                aria-hidden="true"
                aria-labelledby="hash-howto-title"
                tabindex="-1"
              >
                <div class="hash-howto-header">
                  <h3 id="hash-howto-title" data-i18n="hashCheck.howto.title">${t("hashCheck.howto.title")}</h3>
                  <button id="hash-howto-close" type="button" class="small-button" data-i18n-aria="hashCheck.howto.close" aria-label="${t("hashCheck.howto.close")}">
                    <i class="fa-solid fa-xmark"></i>
                  </button>
                </div>
                <div id="hash-howto-step" class="hash-howto-step muted"></div>
                <div class="hash-howto-viewport">
                  <div id="hash-howto-track" class="hash-howto-track">
                    <article class="hash-howto-slide" data-howto-slide="0">
                      <div class="hash-howto-slide__icon"><i class="fa-regular fa-file"></i></div>
                      <h4 data-i18n="hashCheck.howto.slide1.title">${t("hashCheck.howto.slide1.title")}</h4>
                      <p data-i18n="hashCheck.howto.slide1.desc">${t("hashCheck.howto.slide1.desc")}</p>
                    </article>
                    <article class="hash-howto-slide" data-howto-slide="1">
                      <div class="hash-howto-slide__icon"><i class="fa-solid fa-hashtag"></i></div>
                      <h4 data-i18n="hashCheck.howto.slide2.title">${t("hashCheck.howto.slide2.title")}</h4>
                      <p data-i18n="hashCheck.howto.slide2.desc">${t("hashCheck.howto.slide2.desc")}</p>
                    </article>
                    <article class="hash-howto-slide" data-howto-slide="2">
                      <div class="hash-howto-slide__icon"><i class="fa-solid fa-scale-balanced"></i></div>
                      <h4 data-i18n="hashCheck.howto.slide3.title">${t("hashCheck.howto.slide3.title")}</h4>
                      <p data-i18n="hashCheck.howto.slide3.desc">${t("hashCheck.howto.slide3.desc")}</p>
                    </article>
                    <article class="hash-howto-slide" data-howto-slide="3">
                      <div class="hash-howto-slide__icon"><i class="fa-regular fa-copy"></i></div>
                      <h4 data-i18n="hashCheck.howto.slide4.title">${t("hashCheck.howto.slide4.title")}</h4>
                      <p data-i18n="hashCheck.howto.slide4.desc">${t("hashCheck.howto.slide4.desc")}</p>
                    </article>
                  </div>
                </div>
                <div id="hash-howto-dots" class="hash-howto-dots" role="tablist" data-i18n-aria="hashCheck.howto.title" aria-label="${t("hashCheck.howto.title")}">
                  <button type="button" class="hash-howto-dot" data-index="0" aria-label="${t("hashCheck.howto.step", { current: 1, total: 4 })}"></button>
                  <button type="button" class="hash-howto-dot" data-index="1" aria-label="${t("hashCheck.howto.step", { current: 2, total: 4 })}"></button>
                  <button type="button" class="hash-howto-dot" data-index="2" aria-label="${t("hashCheck.howto.step", { current: 3, total: 4 })}"></button>
                  <button type="button" class="hash-howto-dot" data-index="3" aria-label="${t("hashCheck.howto.step", { current: 4, total: 4 })}"></button>
                </div>
                <div class="hash-howto-actions">
                  <button id="hash-howto-prev" type="button" class="small-button">
                    <i class="fa-solid fa-arrow-left"></i>
                    <span data-i18n="hashCheck.howto.prev">${t("hashCheck.howto.prev")}</span>
                  </button>
                  <button id="hash-howto-next" type="button" class="small-button">
                    <span data-i18n="hashCheck.howto.next">${t("hashCheck.howto.next")}</span>
                    <i class="fa-solid fa-arrow-right"></i>
                  </button>
                </div>
              </div>
            </div>
          </article>
        </section>

        <section class="tools-view hidden" data-tool-view="media-inspector" aria-label="${t("tools.nav.current.mediaInspector")}"></section>

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
              <section class="power-shortcuts-summary">
                <div class="power-shortcuts-summary__intro">
                  <strong data-i18n="quickActions.power.summary.title">${t("quickActions.power.summary.title")}</strong>
                  <p data-i18n="quickActions.power.summary.subtitle">${t("quickActions.power.summary.subtitle")}</p>
                </div>
                <div class="power-shortcuts-summary__grid">
                  <div class="power-shortcuts-summary__item">
                    <span class="power-shortcuts-summary__label" data-i18n="quickActions.power.summary.location.label">${t("quickActions.power.summary.location.label")}</span>
                    <strong id="power-summary-location" data-i18n="quickActions.power.summary.location.value">${t("quickActions.power.summary.location.value")}</strong>
                  </div>
                  <div class="power-shortcuts-summary__item">
                    <span class="power-shortcuts-summary__label" data-i18n="quickActions.power.summary.requirements.label">${t("quickActions.power.summary.requirements.label")}</span>
                    <strong id="power-summary-requirements" data-i18n="quickActions.power.summary.requirements.value">${t("quickActions.power.summary.requirements.value")}</strong>
                  </div>
                  <div class="power-shortcuts-summary__item">
                    <span class="power-shortcuts-summary__label" data-i18n="quickActions.power.summary.platform.label">${t("quickActions.power.summary.platform.label")}</span>
                    <strong id="power-summary-platform">${t("quickActions.power.summary.platform.windows")}</strong>
                  </div>
                </div>
              </section>
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

        <section class="tools-view hidden" data-tool-view="sorter" aria-label="${t("tools.nav.current.sorter")}">
          <article class="tools-card tools-detail-card">
            <div class="tools-card__header">
              <h2 data-i18n="tools.sorter.title">${t("tools.sorter.title")}</h2>
              <button
                id="sorter-open-howto"
                type="button"
                class="small-button sorter-howto-open"
                data-bs-toggle="tooltip"
                data-bs-placement="top"
                data-i18n-title="tools.sorter.howto.open"
                data-i18n-aria="tools.sorter.howto.open"
                title="${t("tools.sorter.howto.open")}"
                aria-label="${t("tools.sorter.howto.open")}"
              >
                <i class="fa-regular fa-circle-question"></i>
              </button>
            </div>
            <p class="tools-card__hint" data-i18n="tools.sorter.subtitle">
              ${t("tools.sorter.subtitle")}
            </p>
            <section class="sorter-workspace-panel" aria-label="${t("tools.sorter.workspace.title")}">
              <div class="sorter-workspace-panel__header">
                <div>
                  <h3 data-i18n="tools.sorter.workspace.title">${t("tools.sorter.workspace.title")}</h3>
                  <p class="muted" data-i18n="tools.sorter.workspace.subtitle">
                    ${t("tools.sorter.workspace.subtitle")}
                  </p>
                </div>
                <div class="sorter-actions">
                  <button id="sorter-preview-run" type="button" class="large-button secondary">
                    <i class="fa-regular fa-eye"></i>
                    <span data-i18n="tools.sorter.previewAction">${t("tools.sorter.previewAction")}</span>
                  </button>
                  <button id="sorter-apply-run" type="button" class="large-button">
                    <i class="fa-solid fa-play"></i>
                    <span data-i18n="tools.sorter.applyAction">${t("tools.sorter.applyAction")}</span>
                  </button>
                </div>
              </div>
              <div class="sorter-workspace-grid">
                <div class="sorter-workspace-field sorter-workspace-field--folder">
                  <span class="muted hash-file-label" data-i18n="tools.sorter.folder">${t("tools.sorter.folder")}</span>
                  <div class="hash-actions-inline sorter-folder-actions">
                    <button id="sorter-pick-folder" type="button" class="small-button">
                      <i class="fa-regular fa-folder-open"></i>
                      <span data-i18n="tools.sorter.pickFolder">${t("tools.sorter.pickFolder")}</span>
                    </button>
                    <span id="sorter-folder-pill" class="hash-file-pill muted" data-i18n="tools.sorter.noFolder">${t("tools.sorter.noFolder")}</span>
                    <button id="sorter-open-folder" type="button" class="small-button" disabled>
                      <i class="fa-solid fa-up-right-from-square"></i>
                      <span data-i18n="tools.sorter.openFolder">${t("tools.sorter.openFolder")}</span>
                    </button>
                  </div>
                </div>
                <div class="sorter-workspace-field sorter-workspace-field--log">
                  <label for="sorter-log-path" class="muted" data-i18n="tools.sorter.logLabel">${t("tools.sorter.logLabel")}</label>
                  <input
                    id="sorter-log-path"
                    type="text"
                    class="wg-input"
                    data-i18n-placeholder="tools.sorter.logPlaceholder"
                    placeholder="${t("tools.sorter.logPlaceholder")}"
                  />
                </div>
              </div>
            </section>
            <div class="sorter-setup-grid">
              <section class="sorter-rules-panel" aria-label="${t("tools.sorter.rules.title")}">
                <div class="sorter-rules-panel__header">
                  <h3 data-i18n="tools.sorter.rules.title">${t("tools.sorter.rules.title")}</h3>
                  <p class="muted" data-i18n="tools.sorter.rules.subtitle">
                    ${t("tools.sorter.rules.subtitle")}
                  </p>
                </div>
                <div id="sorter-rules-list" class="sorter-rules-list"></div>
              </section>
              <section class="sorter-options-panel" aria-label="${t("tools.sorter.options.title")}">
                <div class="sorter-options-panel__header">
                  <h3 data-i18n="tools.sorter.options.title">${t("tools.sorter.options.title")}</h3>
                  <p class="muted" data-i18n="tools.sorter.options.subtitle">
                    ${t("tools.sorter.options.subtitle")}
                  </p>
                </div>
                <div class="sorter-options-grid">
                  <div class="sorter-option-field">
                    <label for="sorter-conflict-mode" class="muted" data-i18n="tools.sorter.conflicts.label">${t("tools.sorter.conflicts.label")}</label>
                    <select id="sorter-conflict-mode" class="wg-input">
                      <option value="rename" data-i18n="tools.sorter.conflicts.rename">${t("tools.sorter.conflicts.rename")}</option>
                      <option value="skip" data-i18n="tools.sorter.conflicts.skip">${t("tools.sorter.conflicts.skip")}</option>
                      <option value="replace" data-i18n="tools.sorter.conflicts.replace">${t("tools.sorter.conflicts.replace")}</option>
                    </select>
                  </div>
                  <label class="sorter-option-toggle" for="sorter-recursive">
                    <input id="sorter-recursive" type="checkbox" />
                    <span>
                      <strong data-i18n="tools.sorter.recursive.label">${t("tools.sorter.recursive.label")}</strong>
                      <small class="muted" data-i18n="tools.sorter.recursive.hint">
                        ${t("tools.sorter.recursive.hint")}
                      </small>
                    </span>
                  </label>
                  <div class="sorter-option-field">
                    <label for="sorter-ignore-extensions" class="muted" data-i18n="tools.sorter.ignoreExtensions.label">${t("tools.sorter.ignoreExtensions.label")}</label>
                    <input
                      id="sorter-ignore-extensions"
                      type="text"
                      class="wg-input"
                      data-i18n-placeholder="tools.sorter.ignoreExtensions.placeholder"
                      placeholder=".tmp, .part, .crdownload"
                    />
                  </div>
                  <div class="sorter-option-field">
                    <label for="sorter-ignore-folders" class="muted" data-i18n="tools.sorter.ignoreFolders.label">${t("tools.sorter.ignoreFolders.label")}</label>
                    <input
                      id="sorter-ignore-folders"
                      type="text"
                      class="wg-input"
                      data-i18n-placeholder="tools.sorter.ignoreFolders.placeholder"
                      placeholder="temp, cache"
                    />
                  </div>
                </div>
              </section>
            </div>
            <div id="sorter-result" class="quick-action-result muted" data-i18n="tools.sorter.resultIdle">
              ${t("tools.sorter.resultIdle")}
            </div>
            <section id="sorter-preview-panel" class="sorter-preview-panel hidden" aria-live="polite">
              <div class="sorter-preview-header">
                <h3 id="sorter-preview-title" data-i18n="tools.sorter.preview.title">${t("tools.sorter.preview.title")}</h3>
                <span
                  id="sorter-preview-badge"
                  class="sorter-preview-badge"
                  data-i18n="tools.sorter.preview.badge"
                >
                  ${t("tools.sorter.preview.badge")}
                </span>
              </div>
              <div class="sorter-preview-toolbar">
                <div class="sorter-preview-toolbar__filters">
                  <input
                    id="sorter-preview-search"
                    type="text"
                    class="wg-input"
                    data-i18n-placeholder="tools.sorter.preview.searchPlaceholder"
                    placeholder="${t("tools.sorter.preview.searchPlaceholder")}"
                  />
                  <select id="sorter-preview-category-filter" class="wg-input">
                    <option value="all" data-i18n="tools.sorter.preview.filter.all">${t("tools.sorter.preview.filter.all")}</option>
                  </select>
                  <select id="sorter-preview-status-filter" class="wg-input">
                    <option value="all" data-i18n="tools.sorter.preview.statusFilter.all">${t("tools.sorter.preview.statusFilter.all")}</option>
                    <option value="planned" data-i18n="tools.sorter.preview.statusFilter.planned">${t("tools.sorter.preview.statusFilter.planned")}</option>
                    <option value="moved" data-i18n="tools.sorter.preview.statusFilter.moved">${t("tools.sorter.preview.statusFilter.moved")}</option>
                    <option value="skipped" data-i18n="tools.sorter.preview.statusFilter.skipped">${t("tools.sorter.preview.statusFilter.skipped")}</option>
                    <option value="error" data-i18n="tools.sorter.preview.statusFilter.error">${t("tools.sorter.preview.statusFilter.error")}</option>
                  </select>
                </div>
                <div class="sorter-preview-toolbar__actions">
                  <select id="sorter-export-format" class="wg-input sorter-export-format">
                    <option value="txt">TXT</option>
                    <option value="csv">CSV</option>
                    <option value="json">JSON</option>
                  </select>
                  <button id="sorter-copy-result" type="button" class="small-button">
                    <i class="fa-regular fa-copy"></i>
                    <span data-i18n="tools.sorter.copy">${t("tools.sorter.copy")}</span>
                  </button>
                  <button id="sorter-export-result" type="button" class="small-button">
                    <i class="fa-regular fa-file-export"></i>
                    <span data-i18n="tools.sorter.export">${t("tools.sorter.export")}</span>
                  </button>
                </div>
              </div>
              <div id="sorter-preview-stats" class="sorter-preview-stats">
                <div class="sorter-preview-stat sorter-preview-stat--primary">
                  <span class="muted" data-i18n="tools.sorter.preview.stats.moved">${t("tools.sorter.preview.stats.moved")}</span>
                  <strong id="sorter-preview-stat-moved">0</strong>
                </div>
                <div class="sorter-preview-stat">
                  <span class="muted" data-i18n="tools.sorter.preview.stats.total">${t("tools.sorter.preview.stats.total")}</span>
                  <strong id="sorter-preview-stat-total">0</strong>
                </div>
                <div class="sorter-preview-stat sorter-preview-stat--warning">
                  <span class="muted" data-i18n="tools.sorter.preview.stats.skipped">${t("tools.sorter.preview.stats.skipped")}</span>
                  <strong id="sorter-preview-stat-skipped">0</strong>
                </div>
                <div class="sorter-preview-stat sorter-preview-stat--danger">
                  <span class="muted" data-i18n="tools.sorter.preview.stats.errors">${t("tools.sorter.preview.stats.errors")}</span>
                  <strong id="sorter-preview-stat-errors">0</strong>
                </div>
              </div>
              <div class="sorter-preview-layout">
                <div class="sorter-preview-main">
                  <div class="sorter-preview-list-panel">
                    <div class="sorter-preview-list-panel__header">
                      <h4 data-i18n="tools.sorter.preview.list.title">${t("tools.sorter.preview.list.title")}</h4>
                      <span id="sorter-preview-list-count" class="sorter-section-count muted">0</span>
                    </div>
                    <div id="sorter-preview-list" class="sorter-preview-list"></div>
                    <p id="sorter-preview-filter-empty" class="sorter-preview-list__empty muted hidden" data-i18n="tools.sorter.preview.filterEmpty">
                      ${t("tools.sorter.preview.filterEmpty")}
                    </p>
                    <p id="sorter-preview-more" class="sorter-preview-more muted hidden"></p>
                  </div>
                </div>
                <aside class="sorter-preview-sidebar">
                  <div class="sorter-breakdown">
                    <div class="sorter-breakdown__header">
                      <h4 data-i18n="tools.sorter.breakdown.title">${t("tools.sorter.breakdown.title")}</h4>
                      <span id="sorter-breakdown-count" class="sorter-section-count muted">0</span>
                    </div>
                    <div id="sorter-breakdown-list" class="sorter-breakdown-list"></div>
                  </div>
                  <div id="sorter-errors-panel" class="sorter-errors-panel hidden">
                    <div class="sorter-errors-panel__header">
                      <h4 data-i18n="tools.sorter.errorsPanel.title">${t("tools.sorter.errorsPanel.title")}</h4>
                      <span id="sorter-errors-count" class="sorter-section-count muted">0</span>
                    </div>
                    <div id="sorter-errors-list" class="sorter-errors-list"></div>
                  </div>
                </aside>
              </div>
            </section>
            <div id="sorter-howto-modal" class="sorter-howto-overlay hidden" aria-hidden="true">
              <div
                id="sorter-howto-dialog"
                class="sorter-howto-dialog"
                role="dialog"
                aria-modal="true"
                aria-hidden="true"
                aria-labelledby="sorter-howto-title"
                tabindex="-1"
              >
                <div class="sorter-howto-header">
                  <h3 id="sorter-howto-title" data-i18n="tools.sorter.howto.title">${t("tools.sorter.howto.title")}</h3>
                  <button id="sorter-howto-close" type="button" class="small-button" data-i18n-aria="tools.sorter.howto.close" aria-label="${t("tools.sorter.howto.close")}">
                    <i class="fa-solid fa-xmark"></i>
                  </button>
                </div>
                <div id="sorter-howto-step" class="sorter-howto-step muted"></div>
                <div class="sorter-howto-viewport">
                  <div id="sorter-howto-track" class="sorter-howto-track">
                    <article class="sorter-howto-slide" data-howto-slide="0">
                      <div class="sorter-howto-slide__icon"><i class="fa-regular fa-folder-open"></i></div>
                      <h4 data-i18n="tools.sorter.howto.slide1.title">${t("tools.sorter.howto.slide1.title")}</h4>
                      <p data-i18n="tools.sorter.howto.slide1.desc">${t("tools.sorter.howto.slide1.desc")}</p>
                    </article>
                    <article class="sorter-howto-slide" data-howto-slide="1">
                      <div class="sorter-howto-slide__icon"><i class="fa-regular fa-eye"></i></div>
                      <h4 data-i18n="tools.sorter.howto.slide2.title">${t("tools.sorter.howto.slide2.title")}</h4>
                      <p data-i18n="tools.sorter.howto.slide2.desc">${t("tools.sorter.howto.slide2.desc")}</p>
                    </article>
                    <article class="sorter-howto-slide" data-howto-slide="2">
                      <div class="sorter-howto-slide__icon"><i class="fa-solid fa-list-check"></i></div>
                      <h4 data-i18n="tools.sorter.howto.slide3.title">${t("tools.sorter.howto.slide3.title")}</h4>
                      <p data-i18n="tools.sorter.howto.slide3.desc">${t("tools.sorter.howto.slide3.desc")}</p>
                    </article>
                    <article class="sorter-howto-slide" data-howto-slide="3">
                      <div class="sorter-howto-slide__icon"><i class="fa-regular fa-file-lines"></i></div>
                      <h4 data-i18n="tools.sorter.howto.slide4.title">${t("tools.sorter.howto.slide4.title")}</h4>
                      <p data-i18n="tools.sorter.howto.slide4.desc">${t("tools.sorter.howto.slide4.desc")}</p>
                    </article>
                  </div>
                </div>
                <div id="sorter-howto-dots" class="sorter-howto-dots" role="tablist" data-i18n-aria="tools.sorter.howto.title" aria-label="${t("tools.sorter.howto.title")}">
                  <button type="button" class="sorter-howto-dot" data-index="0" aria-label="${t("tools.sorter.howto.step", { current: 1, total: 4 })}"></button>
                  <button type="button" class="sorter-howto-dot" data-index="1" aria-label="${t("tools.sorter.howto.step", { current: 2, total: 4 })}"></button>
                  <button type="button" class="sorter-howto-dot" data-index="2" aria-label="${t("tools.sorter.howto.step", { current: 3, total: 4 })}"></button>
                  <button type="button" class="sorter-howto-dot" data-index="3" aria-label="${t("tools.sorter.howto.step", { current: 4, total: 4 })}"></button>
                </div>
                <div class="sorter-howto-actions">
                  <button id="sorter-howto-prev" type="button" class="small-button">
                    <i class="fa-solid fa-arrow-left"></i>
                    <span data-i18n="tools.sorter.howto.prev">${t("tools.sorter.howto.prev")}</span>
                  </button>
                  <button id="sorter-howto-next" type="button" class="small-button">
                    <span data-i18n="tools.sorter.howto.next">${t("tools.sorter.howto.next")}</span>
                    <i class="fa-solid fa-arrow-right"></i>
                  </button>
                </div>
              </div>
            </div>
          </article>
        </section>
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

  const isSorterHowtoOpen = () => {
    const modal = getEl("sorter-howto-modal", view);
    return !!modal && !modal.classList.contains("hidden");
  };

  const updateLauncherToolsCount = () => {
    const countEl = getEl("tools-launcher-tools-count", view);
    if (!countEl) return;
    const availableToolViews = [
      "wg",
      "hash",
      "media-inspector",
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
    const openSorterBtn = getEl("tools-open-sorter", view);
    const backBtn = getEl("tools-back-btn", view);
    const breadcrumbHomeBtn = getEl("tools-breadcrumb-home", view);
    const breadcrumbToolsBtn = getEl("tools-breadcrumb-tools", view);

    const applyDeveloperToolsAvailability = () => {
      toolState.setDeveloperToolsUnlocked(toolState.readDeveloperToolsUnlocked());
      if (
        !openPowerBtn ||
        !openBackupBtn ||
        !openSorterBtn ||
        !launcherAvailableGrid ||
        !launcherUnavailableGrid ||
        !launcherUnavailableSection
      ) {
        return;
      }

      const powerSupported = isPowerToolSupportedPlatform(toolState.toolsPlatformInfo);
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
    breadcrumbHomeBtn?.addEventListener("click", () =>
      setToolView("launcher", { persist: false, focusLauncher: true }),
    );
    breadcrumbToolsBtn?.addEventListener("click", () =>
      setToolView("launcher", { persist: false, focusLauncher: true }),
    );

    const isWgHowtoOpen = () => {
      const modal = getEl("wg-howto-modal", view);
      return !!modal && !modal.classList.contains("hidden");
    };

    const isHashHowtoOpen = () => {
      const modal = getEl("hash-howto-modal", view);
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
      if (isHashHowtoOpen()) {
        const key = String(e.key || "");
        if (key === "Escape" || key === "Esc") {
          e.preventDefault();
          closeHashHowtoModal();
          return;
        }
        if (key === "ArrowLeft") {
          e.preventDefault();
          setHashHowtoSlide(hashHowtoIndex - 1);
          return;
        }
        if (key === "ArrowRight") {
          e.preventDefault();
          setHashHowtoSlide(hashHowtoIndex + 1);
          return;
        }
      }
      if (isSorterHowtoOpen()) {
        const key = String(e.key || "");
        if (key === "Escape" || key === "Esc") {
          e.preventDefault();
          closeSorterHowtoModal();
          return;
        }
        if (key === "ArrowLeft") {
          e.preventDefault();
          setSorterHowtoSlide(sorterHowtoIndex - 1);
          return;
        }
        if (key === "ArrowRight") {
          e.preventDefault();
          setSorterHowtoSlide(sorterHowtoIndex + 1);
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
      if (wgHowtoPrevOverflow === null) {
        wgHowtoPrevOverflow = document.documentElement.style.overflow;
      }
      document.documentElement.style.overflow = "hidden";
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
      if (wgHowtoPrevOverflow !== null) {
        document.documentElement.style.overflow = wgHowtoPrevOverflow;
        wgHowtoPrevOverflow = null;
      }
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

    const hashPickFileBtn = getEl("hash-pick-file", view);
    const hashPickFileSecondBtn = getEl("hash-pick-file-2", view);
    const hashClearFileSecondBtn = getEl("hash-clear-file-2", view);
    const hashRunBtn = getEl("hash-run", view);
    const hashFileNameEl = getEl("hash-file-name", view);
    const hashFileNameSecondEl = getEl("hash-file-name-2", view);
    const hashAlgorithmEl = getEl("hash-algorithm", view);
    const hashExpectedEl = getEl("hash-expected", view);
    const hashResultEl = getEl("hash-result", view);
    const hashResultPanelEl = getEl("hash-result-panel", view);
    const hashStatusBadgeEl = getEl("hash-status-badge", view);
    const hashActualLabelEl = getEl("hash-actual-label", view);
    const hashActualLabelSecondEl = getEl("hash-actual-label-2", view);
    const hashActualValueEl = getEl("hash-actual-value", view);
    const hashActualBoxSecondEl = getEl("hash-actual-box-2", view);
    const hashActualValueSecondEl = getEl("hash-actual-value-2", view);
    const hashCompareDetailsEl = getEl("hash-compare-details", view);
    const hashCompareNameFirstEl = getEl("hash-compare-name-1", view);
    const hashCompareNameSecondEl = getEl("hash-compare-name-2", view);
    const hashCompareStateFirstEl = getEl("hash-compare-state-1", view);
    const hashCompareStateSecondEl = getEl("hash-compare-state-2", view);
    const hashCopyActualFirstBtn = getEl("hash-copy-actual-1", view);
    const hashCopyActualSecondBtn = getEl("hash-copy-actual-2", view);
    const hashCopyFeedbackFirstEl = getEl("hash-copy-feedback-1", view);
    const hashCopyFeedbackSecondEl = getEl("hash-copy-feedback-2", view);
    const hashOpenHowtoBtn = getEl("hash-open-howto", view);
    const hashHowtoModalEl = getEl("hash-howto-modal", view);
    const hashHowtoDialogEl = getEl("hash-howto-dialog", view);
    const hashHowtoTrackEl = getEl("hash-howto-track", view);
    const hashHowtoStepEl = getEl("hash-howto-step", view);
    const hashHowtoCloseBtn = getEl("hash-howto-close", view);
    const hashHowtoPrevBtn = getEl("hash-howto-prev", view);
    const hashHowtoNextBtn = getEl("hash-howto-next", view);
    const hashHowtoDotsEl = getEl("hash-howto-dots", view);
    const hashHowtoDots = Array.from(
      hashHowtoDotsEl?.querySelectorAll(".hash-howto-dot") || [],
    );
    const hashHowtoSlideCount = 4;
    let hashHowtoIndex = 0;
    let hashHowtoReturnFocusEl = null;
    let hashActualValueFirst = "";
    let hashActualValueSecond = "";
    let hashBusy = false;

    const syncSecondFileControls = () => {
      if (!hashClearFileSecondBtn) return;
      hashClearFileSecondBtn.disabled = hashBusy || !hashSelectedFileSecond;
    };

    const updateHashHowtoUi = () => {
      if (!hashHowtoTrackEl) return;
      hashHowtoTrackEl.style.transform = `translateX(-${hashHowtoIndex * 100}%)`;
      if (hashHowtoStepEl) {
        hashHowtoStepEl.textContent = t("hashCheck.howto.step", {
          current: hashHowtoIndex + 1,
          total: hashHowtoSlideCount,
        });
      }
      if (hashHowtoPrevBtn) hashHowtoPrevBtn.disabled = hashHowtoIndex <= 0;
      if (hashHowtoNextBtn) {
        hashHowtoNextBtn.disabled = hashHowtoIndex >= hashHowtoSlideCount - 1;
      }
      hashHowtoDots.forEach((dot, idx) => {
        const isActive = idx === hashHowtoIndex;
        dot.classList.toggle("is-active", isActive);
        dot.setAttribute("aria-current", isActive ? "true" : "false");
      });
    };

    const setHashHowtoSlide = (index) => {
      const nextIndex = Math.max(
        0,
        Math.min(Number(index) || 0, hashHowtoSlideCount - 1),
      );
      hashHowtoIndex = nextIndex;
      updateHashHowtoUi();
    };

    const openHashHowtoModal = () => {
      if (!hashHowtoModalEl || !hashHowtoDialogEl) return;
      hashHowtoReturnFocusEl = document.activeElement;
      if (hashHowtoPrevOverflow === null) {
        hashHowtoPrevOverflow = document.documentElement.style.overflow;
      }
      document.documentElement.style.overflow = "hidden";
      hashHowtoModalEl.classList.remove("hidden");
      hashHowtoModalEl.setAttribute("aria-hidden", "false");
      hashHowtoDialogEl.setAttribute("aria-hidden", "false");
      setHashHowtoSlide(0);
      cleanup.setTimeout(() => hashHowtoCloseBtn?.focus(), 0);
    };

    const closeHashHowtoModal = ({ returnFocus = true } = {}) => {
      if (!hashHowtoModalEl || !hashHowtoDialogEl) return;
      hashHowtoModalEl.classList.add("hidden");
      hashHowtoModalEl.setAttribute("aria-hidden", "true");
      hashHowtoDialogEl.setAttribute("aria-hidden", "true");
      if (hashHowtoPrevOverflow !== null) {
        document.documentElement.style.overflow = hashHowtoPrevOverflow;
        hashHowtoPrevOverflow = null;
      }
      if (returnFocus) {
        if (hashHowtoReturnFocusEl?.focus) hashHowtoReturnFocusEl.focus();
        else hashOpenHowtoBtn?.focus();
      }
    };

    const setHashBusy = (busy) => {
      hashBusy = !!busy;
      if (hashPickFileBtn) hashPickFileBtn.disabled = hashBusy;
      if (hashPickFileSecondBtn) hashPickFileSecondBtn.disabled = hashBusy;
      if (hashRunBtn) hashRunBtn.disabled = hashBusy;
      if (hashAlgorithmEl) hashAlgorithmEl.disabled = hashBusy;
      if (hashExpectedEl) hashExpectedEl.disabled = hashBusy;
      if (hashResultPanelEl) {
        hashResultPanelEl.setAttribute(
          "aria-busy",
          hashBusy ? "true" : "false",
        );
      }
      syncSecondFileControls();
    };

    const setHashUiState = ({
      tone = "muted",
      statusKey = "hashCheck.status.idle",
      message = "",
      messageKey = "hashCheck.resultIdle",
      actualHash = "",
      actualHashSecond = "",
      canCopyFirst = false,
      canCopySecond = false,
      showCompareDetails = false,
      compareStateFirstKey = "",
      compareStateSecondKey = "",
      compareStateFirstTone = "muted",
      compareStateSecondTone = "muted",
      compareNameFirst = "",
      compareNameSecond = "",
    } = {}) => {
      hashActualValueFirst = actualHash || "";
      hashActualValueSecond = actualHashSecond || "";
      const statusTone =
        tone === "error"
          ? "error"
          : tone === "success"
            ? "success"
            : tone === "warning"
              ? "warning"
              : "muted";
      if (hashStatusBadgeEl) {
        hashStatusBadgeEl.textContent = t(statusKey);
        hashStatusBadgeEl.className = `hash-status-badge ${statusTone}`;
      }
      if (hashResultPanelEl) {
        hashResultPanelEl.classList.remove(
          "is-idle",
          "is-calculating",
          "is-success",
          "is-warning",
          "is-error",
        );
        hashResultPanelEl.classList.add(
          statusTone === "success"
            ? "is-success"
            : statusTone === "warning"
              ? "is-warning"
              : statusTone === "error"
                ? "is-error"
                : statusKey === "hashCheck.status.calculating"
                  ? "is-calculating"
                  : "is-idle",
        );
      }
      if (hashResultEl) {
        hashResultEl.textContent = message || t(messageKey);
        hashResultEl.className = `quick-action-result ${statusTone}`;
      }
      if (hashActualValueEl) {
        hashActualValueEl.textContent = hashActualValueFirst || "-";
      }
      if (hashActualValueSecondEl) {
        hashActualValueSecondEl.textContent = hashActualValueSecond || "-";
      }
      if (hashActualBoxSecondEl) {
        hashActualBoxSecondEl.classList.toggle(
          "hidden",
          !hashActualValueSecond,
        );
      }
      if (hashCopyActualFirstBtn)
        hashCopyActualFirstBtn.disabled = !canCopyFirst;
      if (hashCopyActualSecondBtn)
        hashCopyActualSecondBtn.disabled = !canCopySecond;
      if (hashCompareDetailsEl) {
        hashCompareDetailsEl.classList.toggle("hidden", !showCompareDetails);
      }
      if (hashCompareStateFirstEl) {
        const firstTone = ["success", "warning", "error", "muted"].includes(
          compareStateFirstTone,
        )
          ? compareStateFirstTone
          : "muted";
        hashCompareStateFirstEl.textContent = compareStateFirstKey
          ? t(compareStateFirstKey)
          : "-";
        hashCompareStateFirstEl.className = `hash-compare-state ${firstTone}`;
      }
      if (hashCompareStateSecondEl) {
        const secondTone = ["success", "warning", "error", "muted"].includes(
          compareStateSecondTone,
        )
          ? compareStateSecondTone
          : "muted";
        hashCompareStateSecondEl.textContent = compareStateSecondKey
          ? t(compareStateSecondKey)
          : "-";
        hashCompareStateSecondEl.className = `hash-compare-state ${secondTone}`;
      }
      if (hashCompareNameFirstEl) {
        hashCompareNameFirstEl.textContent =
          compareNameFirst || t("hashCheck.file1");
      }
      if (hashCompareNameSecondEl) {
        hashCompareNameSecondEl.textContent =
          compareNameSecond || t("hashCheck.file2");
      }
    };

    const setCopyFeedback = (el, key = "") => {
      if (!el) return;
      el.textContent = key ? t(key) : "";
    };

    const setHashFilePill = (element, filePath, emptyKey) => {
      if (!element) return;
      if (!filePath) {
        element.textContent = t(emptyKey);
        element.title = "";
        return;
      }
      const fileName = String(filePath).split(/[\\/]/).pop();
      element.textContent = fileName || filePath;
      element.title = filePath;
    };

    const getHashFileDisplayName = (filePath, fallbackKey) => {
      if (!filePath) return t(fallbackKey);
      const fileName = String(filePath).split(/[\\/]/).pop();
      return fileName || String(filePath);
    };

    const normalizeHashValue = (value) =>
      String(value || "")
        .replace(/\s+/g, "")
        .toLowerCase();

    const setHashActualLabels = (
      algorithm = hashAlgorithmEl?.value || "SHA-256",
    ) => {
      if (hashActualLabelEl) {
        hashActualLabelEl.textContent = t(
          "hashCheck.actualLabelWithAlgorithm",
          {
            algorithm,
          },
        );
      }
      if (hashActualLabelSecondEl) {
        hashActualLabelSecondEl.textContent = t(
          "hashCheck.secondActualLabelWithAlgorithm",
          { algorithm },
        );
      }
    };

    hashPickFileBtn?.addEventListener("click", async () => {
      if (hashBusy) return;
      const res = await window.electron?.tools?.pickFileForHash?.();
      if (!res?.success || !res.filePath) {
        if (!res?.canceled) {
          setHashUiState({
            tone: "error",
            statusKey: "hashCheck.status.error",
            message: res?.error || t("hashCheck.pickError"),
            canCopyFirst: false,
            canCopySecond: false,
            showCompareDetails: false,
          });
        }
        return;
      }
      hashSelectedFile = res.filePath;
      setHashFilePill(hashFileNameEl, hashSelectedFile, "hashCheck.noFile");
      setHashUiState({
        tone: "muted",
        statusKey: "hashCheck.status.idle",
        messageKey: "hashCheck.resultIdle",
        canCopyFirst: false,
        canCopySecond: false,
        showCompareDetails: false,
      });
    });

    hashPickFileSecondBtn?.addEventListener("click", async () => {
      if (hashBusy) return;
      const res = await window.electron?.tools?.pickFileForHash?.();
      if (!res?.success || !res.filePath) {
        if (!res?.canceled) {
          setHashUiState({
            tone: "error",
            statusKey: "hashCheck.status.error",
            message: res?.error || t("hashCheck.pickError"),
            canCopyFirst: false,
            canCopySecond: false,
            showCompareDetails: false,
          });
        }
        return;
      }
      hashSelectedFileSecond = res.filePath;
      setHashFilePill(
        hashFileNameSecondEl,
        hashSelectedFileSecond,
        "hashCheck.noFileSecond",
      );
      syncSecondFileControls();
      setHashUiState({
        tone: "muted",
        statusKey: "hashCheck.status.idle",
        messageKey: "hashCheck.resultIdle",
        canCopyFirst: false,
        canCopySecond: false,
        showCompareDetails: false,
      });
    });

    hashClearFileSecondBtn?.addEventListener("click", () => {
      if (hashBusy || !hashSelectedFileSecond) return;
      hashSelectedFileSecond = "";
      setHashFilePill(hashFileNameSecondEl, "", "hashCheck.noFileSecond");
      syncSecondFileControls();
      setHashUiState({
        tone: "muted",
        statusKey: "hashCheck.status.idle",
        messageKey: "hashCheck.resultIdle",
        canCopyFirst: false,
        canCopySecond: false,
        showCompareDetails: false,
      });
    });

    hashRunBtn?.addEventListener("click", async () => {
      if (hashBusy) return;
      if (!hashSelectedFile) {
        setHashUiState({
          tone: "error",
          statusKey: "hashCheck.status.error",
          messageKey: "hashCheck.needFile",
          canCopyFirst: false,
          canCopySecond: false,
          showCompareDetails: false,
        });
        return;
      }
      setHashUiState({
        tone: "muted",
        statusKey: "hashCheck.status.calculating",
        messageKey: "hashCheck.calculating",
        canCopyFirst: false,
        canCopySecond: false,
        showCompareDetails: false,
      });
      setHashBusy(true);
      try {
        const algorithm = hashAlgorithmEl?.value || "SHA-256";
        setHashActualLabels(algorithm);
        const expectedHash = normalizeHashValue(hashExpectedEl?.value || "");
        const hasExpectedHash = expectedHash.length > 0;
        const hasSecondFile = !!hashSelectedFileSecond;

        const res = await window.electron?.tools?.calculateHash?.({
          filePath: hashSelectedFile,
          algorithm,
          expectedHash: hasSecondFile ? "" : expectedHash,
        });
        if (!res?.success) {
          setHashUiState({
            tone: "error",
            statusKey: "hashCheck.status.error",
            message: res?.error || t("hashCheck.error"),
            canCopyFirst: false,
            canCopySecond: false,
            showCompareDetails: false,
          });
          return;
        }
        if (hasSecondFile) {
          const resSecond = await window.electron?.tools?.calculateHash?.({
            filePath: hashSelectedFileSecond,
            algorithm,
            expectedHash: "",
          });
          if (!resSecond?.success) {
            setHashUiState({
              tone: "error",
              statusKey: "hashCheck.status.error",
              message: resSecond?.error || t("hashCheck.error"),
              actualHash: res.actualHash || "",
              canCopyFirst: !!res.actualHash,
              canCopySecond: false,
              showCompareDetails: false,
            });
            return;
          }
          const firstHash = String(res.actualHash || "").trim();
          const secondHash = String(resSecond.actualHash || "").trim();
          const firstHashNormalized = normalizeHashValue(firstHash);
          const secondHashNormalized = normalizeHashValue(secondHash);
          const firstMatchesExpected = expectedHash
            ? firstHashNormalized === expectedHash
            : false;
          const secondMatchesExpected = expectedHash
            ? secondHashNormalized === expectedHash
            : false;

          if (expectedHash) {
            const anyExpectedMatch =
              firstMatchesExpected || secondMatchesExpected;
            setHashUiState({
              tone: anyExpectedMatch ? "success" : "warning",
              statusKey: anyExpectedMatch
                ? "hashCheck.status.match"
                : "hashCheck.status.mismatch",
              messageKey: "hashCheck.expectedCompared",
              actualHash: firstHash,
              actualHashSecond: secondHash,
              canCopyFirst: !!firstHash,
              canCopySecond: !!secondHash,
              showCompareDetails: true,
              compareStateFirstKey: firstMatchesExpected
                ? "hashCheck.compareState.match"
                : "hashCheck.compareState.mismatch",
              compareStateSecondKey: secondMatchesExpected
                ? "hashCheck.compareState.match"
                : "hashCheck.compareState.mismatch",
              compareStateFirstTone: firstMatchesExpected
                ? "success"
                : "warning",
              compareStateSecondTone: secondMatchesExpected
                ? "success"
                : "warning",
              compareNameFirst: getHashFileDisplayName(
                hashSelectedFile,
                "hashCheck.file1",
              ),
              compareNameSecond: getHashFileDisplayName(
                hashSelectedFileSecond,
                "hashCheck.file2",
              ),
            });
            return;
          }

          const matches =
            firstHashNormalized && secondHashNormalized
              ? firstHashNormalized === secondHashNormalized
              : false;
          setHashUiState({
            tone: matches ? "success" : "warning",
            statusKey: matches
              ? "hashCheck.status.match"
              : "hashCheck.status.mismatch",
            messageKey: "hashCheck.filesCompared",
            actualHash: firstHash,
            actualHashSecond: secondHash,
            canCopyFirst: !!firstHash,
            canCopySecond: !!secondHash,
            showCompareDetails: true,
            compareStateFirstKey: matches
              ? "hashCheck.compareState.match"
              : "hashCheck.compareState.mismatch",
            compareStateSecondKey: matches
              ? "hashCheck.compareState.match"
              : "hashCheck.compareState.mismatch",
            compareStateFirstTone: matches ? "success" : "warning",
            compareStateSecondTone: matches ? "success" : "warning",
            compareNameFirst: getHashFileDisplayName(
              hashSelectedFile,
              "hashCheck.file1",
            ),
            compareNameSecond: getHashFileDisplayName(
              hashSelectedFileSecond,
              "hashCheck.file2",
            ),
          });
          return;
        }
        if (hasExpectedHash && res.matches === true) {
          setHashUiState({
            tone: "success",
            statusKey: "hashCheck.status.match",
            messageKey: "hashCheck.match",
            actualHash: res.actualHash || "",
            actualHashSecond: "",
            canCopyFirst: !!res.actualHash,
            canCopySecond: false,
            showCompareDetails: false,
          });
          return;
        }
        if (hasExpectedHash && res.matches === false) {
          setHashUiState({
            tone: "warning",
            statusKey: "hashCheck.status.mismatch",
            messageKey: "hashCheck.mismatch",
            actualHash: res.actualHash || "",
            actualHashSecond: "",
            canCopyFirst: !!res.actualHash,
            canCopySecond: false,
            showCompareDetails: false,
          });
          return;
        }
        setHashUiState({
          tone: "muted",
          statusKey: "hashCheck.status.calculated",
          messageKey: "hashCheck.calculated",
          actualHash: res.actualHash || "",
          actualHashSecond: "",
          canCopyFirst: !!res.actualHash,
          canCopySecond: false,
          showCompareDetails: false,
        });
      } catch (error) {
        setHashUiState({
          tone: "error",
          statusKey: "hashCheck.status.error",
          message: error?.message || t("hashCheck.error"),
          canCopyFirst: false,
          canCopySecond: false,
          showCompareDetails: false,
        });
      } finally {
        setHashBusy(false);
      }
    });

    const attachHashCopyHandler = (button, getValue, feedbackEl, timerKey) => {
      button?.addEventListener("click", async () => {
        const value = getValue();
        if (!value || hashBusy) return;
        if (timerKey === "first" && hashCopyFeedbackTimerFirst) {
          hashCopyFeedbackTimerFirst = cleanup.clearTimeout(
            hashCopyFeedbackTimerFirst,
          );
        }
        if (timerKey === "second" && hashCopyFeedbackTimerSecond) {
          hashCopyFeedbackTimerSecond = cleanup.clearTimeout(
            hashCopyFeedbackTimerSecond,
          );
        }

        try {
          await navigator.clipboard?.writeText?.(value);
          const icon = button.querySelector("i");
          if (icon) icon.className = "fa-solid fa-check";
          setCopyFeedback(feedbackEl, "hashCheck.copySuccess");
        } catch {
          hashResultEl.textContent = t("hashCheck.copyError");
          hashResultEl.className = "quick-action-result error";
          setCopyFeedback(feedbackEl, "hashCheck.copyError");
        } finally {
          const resetTimer = cleanup.setTimeout(() => {
            const icon = button.querySelector("i");
            if (icon) icon.className = "fa-regular fa-copy";
            setCopyFeedback(feedbackEl);
          }, 1500);
          if (timerKey === "first") hashCopyFeedbackTimerFirst = resetTimer;
          if (timerKey === "second") hashCopyFeedbackTimerSecond = resetTimer;
        }
      });
    };

    attachHashCopyHandler(
      hashCopyActualFirstBtn,
      () => hashActualValueFirst,
      hashCopyFeedbackFirstEl,
      "first",
    );
    attachHashCopyHandler(
      hashCopyActualSecondBtn,
      () => hashActualValueSecond,
      hashCopyFeedbackSecondEl,
      "second",
    );

    setHashUiState({
      tone: "muted",
      statusKey: "hashCheck.status.idle",
      messageKey: "hashCheck.resultIdle",
      canCopyFirst: false,
      canCopySecond: false,
      showCompareDetails: false,
    });
    setHashActualLabels();
    setHashBusy(false);
    syncSecondFileControls();
    hashAlgorithmEl?.addEventListener("change", () => setHashActualLabels());
    hashOpenHowtoBtn?.addEventListener("click", () => openHashHowtoModal());
    hashHowtoCloseBtn?.addEventListener("click", () => closeHashHowtoModal());
    hashHowtoPrevBtn?.addEventListener("click", () =>
      setHashHowtoSlide(hashHowtoIndex - 1),
    );
    hashHowtoNextBtn?.addEventListener("click", () =>
      setHashHowtoSlide(hashHowtoIndex + 1),
    );
    hashHowtoDots.forEach((dot) => {
      dot.addEventListener("click", () => {
        setHashHowtoSlide(Number(dot.dataset.index || "0"));
      });
    });
    hashHowtoModalEl?.addEventListener("mousedown", (event) => {
      if (event.target === hashHowtoModalEl) closeHashHowtoModal();
    });
    updateHashHowtoUi();

    const sorterOpenHowtoBtn = getEl("sorter-open-howto", view);
    const sorterHowtoModalEl = getEl("sorter-howto-modal", view);
    const sorterHowtoDialogEl = getEl("sorter-howto-dialog", view);
    const sorterHowtoTrackEl = getEl("sorter-howto-track", view);
    const sorterHowtoStepEl = getEl("sorter-howto-step", view);
    const sorterHowtoCloseBtn = getEl("sorter-howto-close", view);
    const sorterHowtoPrevBtn = getEl("sorter-howto-prev", view);
    const sorterHowtoNextBtn = getEl("sorter-howto-next", view);
    const sorterHowtoDotsEl = getEl("sorter-howto-dots", view);
    const sorterHowtoDots = Array.from(
      sorterHowtoDotsEl?.querySelectorAll(".sorter-howto-dot") || [],
    );
    const sorterHowtoSlideCount = 4;
    let sorterHowtoIndex = 0;
    let sorterHowtoReturnFocusEl = null;

    const updateSorterHowtoUi = () => {
      if (!sorterHowtoTrackEl) return;
      sorterHowtoTrackEl.style.transform = `translateX(-${sorterHowtoIndex * 100}%)`;
      if (sorterHowtoStepEl) {
        sorterHowtoStepEl.textContent = t("tools.sorter.howto.step", {
          current: sorterHowtoIndex + 1,
          total: sorterHowtoSlideCount,
        });
      }
      if (sorterHowtoPrevBtn) {
        sorterHowtoPrevBtn.disabled = sorterHowtoIndex <= 0;
      }
      if (sorterHowtoNextBtn) {
        sorterHowtoNextBtn.disabled =
          sorterHowtoIndex >= sorterHowtoSlideCount - 1;
      }
      sorterHowtoDots.forEach((dot, idx) => {
        const isActive = idx === sorterHowtoIndex;
        dot.classList.toggle("is-active", isActive);
        dot.setAttribute("aria-current", isActive ? "true" : "false");
      });
    };

    const setSorterHowtoSlide = (index) => {
      const nextIndex = Math.max(
        0,
        Math.min(Number(index) || 0, sorterHowtoSlideCount - 1),
      );
      sorterHowtoIndex = nextIndex;
      updateSorterHowtoUi();
    };

    const openSorterHowtoModal = () => {
      if (!sorterHowtoModalEl || !sorterHowtoDialogEl) return;
      sorterHowtoReturnFocusEl = document.activeElement;
      if (sorterHowtoPrevOverflow === null) {
        sorterHowtoPrevOverflow = document.documentElement.style.overflow;
      }
      document.documentElement.style.overflow = "hidden";
      sorterHowtoModalEl.classList.remove("hidden");
      sorterHowtoModalEl.setAttribute("aria-hidden", "false");
      sorterHowtoDialogEl.setAttribute("aria-hidden", "false");
      setSorterHowtoSlide(0);
      cleanup.setTimeout(() => sorterHowtoCloseBtn?.focus(), 0);
    };

    const closeSorterHowtoModal = ({ returnFocus = true } = {}) => {
      if (!sorterHowtoModalEl || !sorterHowtoDialogEl) return;
      sorterHowtoModalEl.classList.add("hidden");
      sorterHowtoModalEl.setAttribute("aria-hidden", "true");
      sorterHowtoDialogEl.setAttribute("aria-hidden", "true");
      if (sorterHowtoPrevOverflow !== null) {
        document.documentElement.style.overflow = sorterHowtoPrevOverflow;
        sorterHowtoPrevOverflow = null;
      }
      if (returnFocus) {
        if (sorterHowtoReturnFocusEl?.focus) sorterHowtoReturnFocusEl.focus();
        else sorterOpenHowtoBtn?.focus();
      }
    };

    sorterOpenHowtoBtn?.addEventListener("click", () => openSorterHowtoModal());
    sorterHowtoCloseBtn?.addEventListener("click", () =>
      closeSorterHowtoModal(),
    );
    sorterHowtoPrevBtn?.addEventListener("click", () =>
      setSorterHowtoSlide(sorterHowtoIndex - 1),
    );
    sorterHowtoNextBtn?.addEventListener("click", () =>
      setSorterHowtoSlide(sorterHowtoIndex + 1),
    );
    sorterHowtoDots.forEach((dot) => {
      dot.addEventListener("click", () => {
        setSorterHowtoSlide(Number(dot.dataset.index || "0"));
      });
    });
    sorterHowtoModalEl?.addEventListener("mousedown", (event) => {
      if (event.target === sorterHowtoModalEl) closeSorterHowtoModal();
    });
    updateSorterHowtoUi();

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
    const powerSummaryPlatform = getEl("power-summary-platform", view);
    const powerSummaryRequirements = getEl("power-summary-requirements", view);
    const powerSessionSummary = getEl("power-session-summary", view);
    const powerSessionSummaryText = getEl("power-session-summary-text", view);
    const powerSessionSummaryDetail = getEl("power-session-summary-detail", view);
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
      if (powerHowtoPrevOverflow === null) {
        powerHowtoPrevOverflow = document.documentElement.style.overflow;
      }
      document.documentElement.style.overflow = "hidden";
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
      if (powerHowtoPrevOverflow !== null) {
        document.documentElement.style.overflow = powerHowtoPrevOverflow;
        powerHowtoPrevOverflow = null;
      }
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
        powerSessionSummaryText.textContent = t("quickActions.power.session.empty");
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
      const summaryPlatformKey = isWindows
        ? "quickActions.power.summary.platform.windows"
        : "quickActions.power.summary.platform.preview";
      if (!showTool) {
        restartCard?.classList.add("hidden");
        openPowerBtn?.classList.add("hidden");
        powerPlatformBanner?.classList.add("hidden");
        if (powerPlatformBannerText) {
          powerPlatformBannerText.textContent = windowsOnlyBannerText;
        }
        if (powerSummaryPlatform) {
          powerSummaryPlatform.textContent = t(summaryPlatformKey);
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
        if (powerSummaryPlatform) {
          powerSummaryPlatform.textContent = t(summaryPlatformKey);
        }
        if (powerSummaryRequirements) {
          powerSummaryRequirements.textContent = t(
            isWindows
              ? "quickActions.power.summary.requirements.value"
              : "quickActions.power.summary.requirements.preview",
          );
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
        const detail =
          res?.path || t("quickActions.power.summary.location.value");
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

    const showPowerTool = isPowerToolSupportedPlatform(toolState.toolsPlatformInfo);
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
        cleanup.setTimeout(() => view.classList.remove("wg-success-pulse"), 2000);

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

      toolState.setPlatformInfo((await window.electron
        .getPlatformInfo?.()
        .catch(() => null)) || {
        isWindows: false,
        platform: "",
      });
      toolState.setDeveloperToolsUnlocked(toolState.readDeveloperToolsUnlocked());
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
      await initAutoShutdown();

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

  // Обработчик обновления авто-закрытия
  const onAutoShutdownUpdated = (payload) => {
    try {
      const { enabled, seconds, deadline } = payload || {};
      if (enabled) {
        if (deadline && Number.isFinite(Number(deadline))) {
          startCountdownWithDeadline(Number(deadline));
          const eta = new Date(Number(deadline)).toLocaleTimeString();
          log(t("wg.log.autoShutdown.enabledWithEta", { time: eta }));
        } else {
          startCountdownFromSeconds(seconds);
          log(
            t("wg.log.autoShutdown.enabledWithSeconds", {
              seconds: Number(seconds) || 30,
            }),
          );
        }
      } else {
        stopCountdown();
        log(t("wg.log.autoShutdown.disabledStopped"));
      }
    } catch (err) {
      console.error("wg-auto-shutdown-updated handler error:", err);
      log(t("wg.log.error.autoShutdownUpdate", { message: err.message }), true);
    }
  };
    cleanup.onIpcEvent(
      window.electron.ipcRenderer,
      "wg-auto-shutdown-updated",
      onAutoShutdownUpdated,
    );

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
