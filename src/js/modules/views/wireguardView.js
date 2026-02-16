// src/js/modules/views/wireguardView.js

import { showToast } from "../toast.js";
import { showConfirmationDialog } from "../modals.js";
import { initTooltips } from "../tooltipInitializer.js";
import { applyI18n, getLanguage, t } from "../i18n.js";

export default function renderWireGuard() {
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

  // Ensure WG background is preloaded to prevent layout jump on first render
  if (!document.querySelector(".wg-bg-preload")) {
    const bgPreload = document.createElement("div");
    bgPreload.className = "wg-bg-preload";
    document.body.appendChild(bgPreload);
  }

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

  let currentMsg = ")";
  let lastSendTime = null;
  let shutdownTicker = null;
  let shutdownDeadlineTs = null;
  let lastLoggedRemaining = null;
  let logEntries = [];
  let logAutoScroll = true;
  let logErrorOnly = false;
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
  let isWindowsPlatform = false;
  const WG_ADVANCED_STATE_KEY = "toolsWgAdvancedOpen";
  const LAST_TOOL_KEY = "toolsLastView";
  let currentToolView = "launcher";
  let toolsPlatformInfo = { isWindows: false, platform: "" };
  const cleanupFns = [];

  const addCleanup = (fn) => {
    if (typeof fn === "function") cleanupFns.push(fn);
  };

  const onWindowEvent = (type, handler, options) => {
    window.addEventListener(type, handler, options);
    addCleanup(() => window.removeEventListener(type, handler, options));
  };

  const onIpcEvent = (channel, handler) => {
    window.electron.ipcRenderer.on(channel, handler);
    addCleanup(() =>
      window.electron.ipcRenderer.removeListener(channel, handler),
    );
  };

  const disposeView = () => {
    stopCountdown();
    if (tipsIntervalId) {
      clearInterval(tipsIntervalId);
      tipsIntervalId = null;
    }
    if (tipsSwapTimer) {
      clearTimeout(tipsSwapTimer);
      tipsSwapTimer = null;
    }
    if (tipsFadeTimer) {
      clearTimeout(tipsFadeTimer);
      tipsFadeTimer = null;
    }
    if (hashCopyFeedbackTimerFirst) {
      clearTimeout(hashCopyFeedbackTimerFirst);
      hashCopyFeedbackTimerFirst = null;
    }
    if (hashCopyFeedbackTimerSecond) {
      clearTimeout(hashCopyFeedbackTimerSecond);
      hashCopyFeedbackTimerSecond = null;
    }
    const finalizers = cleanupFns.splice(0);
    finalizers.forEach((fn) => {
      try {
        fn();
      } catch {}
    });
  };

  // =============================================
  // ЛОКАЛЬНОЕ СОХРАНЕНИЕ ЛОГА И ВРЕМЕНИ ОТПРАВКИ
  // =============================================

  const WG_LOG_V2_KEY = "wg-log-v2";
  const WG_LOG_LEGACY_KEY = "wg-log";
  const WG_LOG_MAX_ENTRIES = 300;

  const formatLogEntry = (entry) => {
    const dt = new Date(entry.ts || Date.now());
    const pad = (n) => String(n).padStart(2, "0");
    const time = `${pad(dt.getHours())}:${pad(dt.getMinutes())}:${pad(dt.getSeconds())}`;
    const level = (entry.level || "info").toUpperCase().padEnd(5, " ");
    return `${time} | ${level} | ${entry.text || ""}`;
  };

  const getVisibleLogEntries = () =>
    logErrorOnly
      ? logEntries.filter((entry) => entry.level === "error")
      : logEntries;

  const saveLog = () => {
    try {
      window.localStorage.setItem(
        WG_LOG_V2_KEY,
        JSON.stringify({
          autoScroll: !!logAutoScroll,
          entries: logEntries.slice(-WG_LOG_MAX_ENTRIES),
        }),
      );
    } catch {}
  };

  const renderLog = () => {
    const pre = getEl("wg-log", view);
    if (!pre) return;
    const visible = getVisibleLogEntries();
    pre.textContent = visible.length
      ? visible.map(formatLogEntry).join("\n")
      : t("wg.log.placeholder");
    if (logErrorOnly) {
      pre.classList.add("error-log");
    } else {
      pre.classList.remove("error-log");
    }
    if (logAutoScroll) {
      pre.scrollTop = pre.scrollHeight;
    }
  };

  const updateLogControls = () => {
    const autoBtn = getEl("wg-log-autoscroll", view);
    const filterBtn = getEl("wg-log-filter-errors", view);
    if (autoBtn) {
      autoBtn.classList.toggle("is-active", logAutoScroll);
      autoBtn.title = logAutoScroll
        ? t("wg.log.autoscroll.on")
        : t("wg.log.autoscroll.off");
    }
    if (filterBtn) {
      filterBtn.classList.toggle("is-active", logErrorOnly);
      filterBtn.title = logErrorOnly
        ? t("wg.log.filter.errorsOn")
        : t("wg.log.filter.errorsOff");
    }
  };

  const appendLogEntry = (text, level = "info") => {
    logEntries.push({
      level,
      text: String(text || ""),
      ts: Date.now(),
    });
    if (logEntries.length > WG_LOG_MAX_ENTRIES) {
      logEntries = logEntries.slice(-WG_LOG_MAX_ENTRIES);
    }
    renderLog();
    saveLog();
  };

  const loadLog = () => {
    try {
      const raw = window.localStorage.getItem(WG_LOG_V2_KEY);
      if (raw) {
        const parsed = JSON.parse(raw);
        logEntries = Array.isArray(parsed?.entries) ? parsed.entries : [];
        logAutoScroll = parsed?.autoScroll !== false;
        renderLog();
        return;
      }
    } catch {}

    const legacy = window.localStorage.getItem(WG_LOG_LEGACY_KEY);
    if (legacy) {
      logEntries = String(legacy)
        .split("\n")
        .map((line) => line.trim())
        .filter(Boolean)
        .map((line) => ({
          level: /\berror|ошибка|err\b/i.test(line) ? "error" : "info",
          text: line,
          ts: Date.now(),
        }))
        .slice(-WG_LOG_MAX_ENTRIES);
      renderLog();
      saveLog();
      return;
    }

    renderLog();
  };

  const saveLastSendTime = (time = new Date()) => {
    window.localStorage.setItem("wg-last-send-time", time.toISOString());
  };

  const loadLastSendTime = () => {
    const el = getEl("wg-last-send-time", view);
    const saved = window.localStorage.getItem("wg-last-send-time");
    if (el && saved) {
      const dt = new Date(saved);
      if (!isNaN(dt)) {
        const pad = (n) => String(n).padStart(2, "0");
        const atLabel = t("wg.time.at");
        el.textContent = `${dt.getFullYear()}-${pad(dt.getMonth() + 1)}-${pad(dt.getDate())} ${atLabel} ${pad(dt.getHours())}:${pad(dt.getMinutes())}:${pad(dt.getSeconds())}`;
      }
    }
  };

  // =============================================
  // ВСПОМОГАТЕЛЬНЫЕ ФУНКЦИИ
  // =============================================

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

  const updateLastSendTime = () => {
    const timeEl = getEl("wg-last-send-time", view);
    if (timeEl) {
      lastSendTime = new Date();
      const pad = (n) => String(n).padStart(2, "0");
      timeEl.textContent = `${pad(lastSendTime.getHours())}:${pad(lastSendTime.getMinutes())}:${pad(lastSendTime.getSeconds())}`;
      saveLastSendTime(lastSendTime);
    }
  };

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

  // Флаг для отслеживания новой сессии приложения (инициализации)
  let isNewSession = false;
  const log = (text, error = false) => {
    // Всегда показывать ошибки, независимо от режима отладки
    const debugToggle = getEl("debug-toggle", view);
    const debugEnabled = debugToggle
      ? debugToggle.classList.contains("is-active")
      : false;

    if (!debugEnabled && !error) return;

    // Добавляем маркер новой сессии
    if (isNewSession) {
      appendLogEntry("────────────────────────", "info");
      isNewSession = false;
    }

    appendLogEntry(text, error ? "error" : "info");

    // Автоматически раскрывать details при новых сообщениях
    const pre = getEl("wg-log", view);
    const details = pre?.closest("details");
    if (details && !details.open) details.open = true;
  };

  const withTimeout = (promise, ms = 5000) => {
    let timer;
    return Promise.race([
      promise,
      new Promise((_, reject) => {
        timer = setTimeout(
          () => reject(new Error(t("wg.error.timeoutWaiting"))),
          ms,
        );
      }),
    ]).finally(() => clearTimeout(timer));
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
    if (shutdownTicker) {
      clearInterval(shutdownTicker);
      shutdownTicker = null;
    }
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
    shutdownTicker = setInterval(tick, 1000);
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

  view.innerHTML = `
    <div class="tools-shell">
      <header class="tools-shell-header">
        <div class="title">
          <i class="fa-solid fa-screwdriver-wrench"></i>
          <div class="title-content">
            <h1 class="wg-text-gradient" data-i18n="wg.title">Tools</h1>
            <p class="subtitle" data-i18n="wg.subtitle">Quick actions for file and network tasks.</p>
          </div>
        </div>
      </header>

      <div class="tools-nav">
        <button
          id="tools-back-btn"
          type="button"
          class="small-button hidden"
          data-i18n-title="tools.nav.back"
          data-i18n-aria="tools.nav.back"
          title="Назад"
          aria-label="Назад"
        >
          <i class="fa-solid fa-arrow-left"></i>
        </button>
        <h2 id="tools-view-title" class="tools-view-title" data-i18n="tools.launcher.title">
          Инструменты
        </h2>
      </div>

      <section id="tools-launcher" class="tools-launcher" aria-label="Tools Launcher">
        <div class="tools-launcher-inner">
          <p class="tools-launcher-subtitle" data-i18n="tools.launcher.subtitle">
            Выберите инструмент для открытия
          </p>
          <div class="tools-launcher-grid">
            <button id="tools-open-wg" type="button" class="tools-launcher-button">
              <i class="fa-solid fa-satellite-dish"></i>
              <span data-i18n="tools.launcher.open.wg">WG Unlock</span>
            </button>
            <button id="tools-open-hash" type="button" class="tools-launcher-button">
              <i class="fa-solid fa-fingerprint"></i>
              <span data-i18n="tools.launcher.open.hash">Hash Check</span>
            </button>
            <button id="tools-open-power" type="button" class="tools-launcher-button">
              <i class="fa-solid fa-power-off"></i>
              <span data-i18n="tools.launcher.open.power">Power Shortcuts</span>
            </button>
          </div>
        </div>
      </section>

      <section id="tools-views" class="tools-views">
        <section class="tools-view hidden" data-tool-view="wg" aria-label="WG Tool View">
          <article class="tools-card tools-card-wg-quick">
            <div class="tools-card__header">
              <h2 data-i18n="tools.wg.quick.title">WG Quick</h2>
              <button
                id="tools-wg-advanced-toggle"
                type="button"
                class="small-button"
                aria-controls="tools-wg-advanced-panel"
                aria-expanded="false"
                data-i18n="tools.wg.advanced.toggle.open"
              >
                Advanced
              </button>
            </div>
            <p class="tools-card__hint" data-i18n="tools.wg.quick.hint">Quick recovery actions for WireGuard.</p>
            <div class="tools-card__meta">
              <div>
                <span data-i18n="wg.lastSend.title">Последняя отправка</span>
                <strong id="wg-last-send-time" data-i18n="wg.lastSend.never">Никогда</strong>
              </div>
              <div>
                <span data-i18n="wg.status.title">Статус</span>
                <strong id="wg-connection-status" data-i18n="wg.status.inactive">Неактивно</strong>
              </div>
            </div>
            <div class="tools-card__actions buttons">
              <button id="wg-send" class="large-button">
                <i class="fa-solid fa-paper-plane"></i>
                <span data-i18n="wg.action.send">Отправить</span>
              </button>
            </div>
            <div class="tools-card__secondary">
              <span class="tools-card__secondary-label" data-i18n="wg.actions.more">More actions</span>
              <div class="tools-card__secondary-actions">
              <button id="wg-reset" class="small-button" data-bs-toggle="tooltip" data-bs-placement="top" title="Сброс" data-i18n-title="wg.action.reset.title">
                <i class="fa-solid fa-rotate-left"></i>
              </button>
              <button id="wg-open-config-file" class="small-button" data-bs-toggle="tooltip" data-bs-placement="top" title="Редактировать конфигурацию" data-i18n-title="wg.action.editConfig.title">
                <i class="fa-solid fa-file-edit"></i>
              </button>
              <button id="wg-open-network-settings" class="small-button hidden" data-bs-toggle="tooltip" data-bs-placement="top" title="Открыть сетевые настройки системы" data-i18n-title="wg.action.openNetworkSettings.title">
                <i class="fa-solid fa-network-wired"></i>
              </button>
              <button id="wg-help" class="small-button" data-bs-toggle="tooltip" data-bs-placement="top" title="Зачем нужна эта вкладка" data-i18n-title="wg.help.tooltip">
                <i class="fa-solid fa-circle-info"></i>
              </button>
              </div>
            </div>
            <div id="wg-status-indicator" class="hidden" role="status" aria-live="polite"></div>
          </article>

          <section id="tools-wg-advanced-panel" class="tools-wg-advanced-panel is-collapsed" aria-hidden="true">
            <div class="tools-wg-advanced-grid">
              <div class="wg-glass">
                <div class="wg-header wg-header-advanced">
                  <h2 class="section-heading" data-i18n="tools.wg.advanced.title">WG Advanced</h2>
                  <div class="debug-toggle" id="debug-toggle">
                    <div class="toggle-track"></div>
                    <span class="toggle-label" data-i18n="wg.debug.label">Лог активности</span>
                  </div>
                </div>
                <div class="wg-section">
                  <h3 class="section-heading" data-i18n="wg.section.network">Сетевые параметры</h3>
                  <div class="wg-grid">
                    ${fieldsHtml}
                  </div>
                </div>
              </div>

              <div class="wg-side-panel">
                <div class="info-card">
                  <h3><i class="fa-solid fa-circle-info"></i> <span data-i18n="wg.info.title">Информация</span></h3>
                  <p data-i18n="wg.info.body">Эта функция отправляет UDP-пакет с указанными параметрами для разблокировки WireGuard.</p>
                </div>
                <div class="info-card wg-meta-card">
                  <div class="meta-row wg-meta-tips">
                    <h3><i class="fa-solid fa-lightbulb"></i> <span data-i18n="wg.tips.title">Советы</span></h3>
                    <p id="wg-tips-text" data-i18n-html="wg.tips.body">• Используйте режим отладки для подробного лога<br>
                    • Проверьте настройки брандмауэра<br>
                    • Убедитесь, что удаленный хост доступен</p>
                    <div class="wg-tips-controls">
                      <button id="wg-tip-prev" type="button" class="small-button" data-bs-toggle="tooltip" data-bs-placement="top" data-i18n-title="wg.tips.prev" title="Предыдущий совет">
                        <i class="fa-solid fa-chevron-left"></i>
                      </button>
                      <button id="wg-tip-toggle" type="button" class="small-button" data-bs-toggle="tooltip" data-bs-placement="top" data-i18n-title="wg.tips.pause" title="Пауза">
                        <i class="fa-solid fa-pause"></i>
                      </button>
                      <button id="wg-tip-next" type="button" class="small-button" data-bs-toggle="tooltip" data-bs-placement="top" data-i18n-title="wg.tips.next" title="Следующий совет">
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
                      <span data-i18n="wg.log.title">Лог активности</span>
                    </summary>
                    <div class="log-actions" aria-label="Действия с логом" data-i18n-aria="wg.log.actions.aria">
                      <button id="wg-log-copy" type="button" class="log-action-btn"
                        data-bs-toggle="tooltip" data-bs-placement="top" title="Скопировать лог в буфер обмена" data-i18n-title="wg.log.copy.title">
                        <i class="fa-solid fa-copy"></i>
                      </button>
                      <button id="wg-log-export" type="button" class="log-action-btn"
                        data-bs-toggle="tooltip" data-bs-placement="top" title="Экспортировать лог в файл" data-i18n-title="wg.log.export.title">
                        <i class="fa-solid fa-download"></i>
                      </button>
                      <button id="wg-log-clear" type="button" class="log-action-btn"
                        data-bs-toggle="tooltip" data-bs-placement="top" title="Очистить лог" data-i18n-title="wg.log.clear.title">
                        <i class="fa-solid fa-trash"></i>
                      </button>
                      <button id="wg-log-filter-errors" type="button" class="log-action-btn"
                        data-bs-toggle="tooltip" data-bs-placement="top" title="Показывать только ошибки">
                        <i class="fa-solid fa-triangle-exclamation"></i>
                      </button>
                      <button id="wg-log-autoscroll" type="button" class="log-action-btn is-active"
                        data-bs-toggle="tooltip" data-bs-placement="top" title="Автопрокрутка включена">
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

        <section class="tools-view hidden" data-tool-view="hash" aria-label="Hash Tool View">
          <article class="tools-card">
            <div class="tools-card__header">
              <h2 data-i18n="hashCheck.title">Проверка хеша</h2>
            </div>
            <p class="tools-card__hint" data-i18n="hashCheck.subtitle">Проверьте целостность файла по контрольной сумме.</p>
            <div class="hash-check-grid">
              <div class="hash-row hash-row--top">
                <div class="hash-file-control">
                  <span class="muted hash-file-label" data-i18n="hashCheck.file1">Файл 1</span>
                  <div class="hash-actions-inline">
                    <button id="hash-pick-file" type="button" class="small-button">
                      <i class="fa-regular fa-file"></i>
                      <span data-i18n="hashCheck.pickFile">Выбрать файл</span>
                    </button>
                    <span id="hash-file-name" class="hash-file-pill muted" data-i18n="hashCheck.noFile">Файл не выбран</span>
                  </div>
                </div>
                <div class="hash-algorithm-wrap">
                  <label for="hash-algorithm" class="muted" data-i18n="hashCheck.algorithm">Алгоритм</label>
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
                  <span class="muted hash-file-label" data-i18n="hashCheck.file2">Файл 2</span>
                  <div class="hash-actions-inline">
                    <button id="hash-pick-file-2" type="button" class="small-button">
                      <i class="fa-regular fa-file"></i>
                      <span data-i18n="hashCheck.pickFileSecond">Выбрать файл</span>
                    </button>
                    <span id="hash-file-name-2" class="hash-file-pill muted" data-i18n="hashCheck.noFileSecond">Второй файл не выбран</span>
                    <button
                      id="hash-clear-file-2"
                      type="button"
                      class="small-button hash-clear-btn"
                      data-bs-toggle="tooltip"
                      data-bs-placement="top"
                      data-i18n-title="hashCheck.clearSecond"
                      data-i18n-aria="hashCheck.clearSecond"
                      title="Очистить файл 2"
                      aria-label="Очистить файл 2"
                      disabled
                    >
                      <i class="fa-solid fa-xmark"></i>
                    </button>
                  </div>
                </div>
              </div>

              <div class="hash-row hash-row--bottom">
                <div class="hash-expected-wrap">
                  <label for="hash-expected" class="muted" data-i18n="hashCheck.expected">Ожидаемый хеш</label>
                  <input
                    id="hash-expected"
                    type="text"
                    class="wg-input"
                    data-i18n-placeholder="hashCheck.expectedPlaceholder"
                    placeholder="Вставьте хеш для сравнения (опционально)"
                  />
                </div>
                <button id="hash-run" type="button" class="large-button">
                  <i class="fa-solid fa-play"></i>
                  <span data-i18n="hashCheck.run">Проверить</span>
                </button>
              </div>
              <div class="hash-row">
                <span class="muted hash-expected-hint" data-i18n="hashCheck.expectedHint">
                  Если выбран второй файл, ожидаемый хеш сравнивается с каждым файлом отдельно.
                </span>
              </div>
            </div>

            <div id="hash-result-panel" class="hash-result-panel is-idle">
              <div class="hash-result-panel__top">
                <span id="hash-status-badge" class="hash-status-badge muted" data-i18n="hashCheck.status.idle">Ожидание</span>
              </div>
              <div class="hash-actual-box">
                <div class="hash-actual-box__top">
                  <span id="hash-actual-label" class="muted">Вычисленный хеш (SHA-256)</span>
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
                      title="Копировать хеш"
                      aria-label="Копировать хеш"
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
                  <span id="hash-actual-label-2" class="muted">Вычисленный хеш (файл 2, SHA-256)</span>
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
                      title="Копировать хеш файла 2"
                      aria-label="Копировать хеш файла 2"
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
                  <span id="hash-compare-name-1" class="muted">Файл 1</span>
                  <span id="hash-compare-state-1" class="hash-compare-state muted">-</span>
                </div>
                <div class="hash-compare-row">
                  <span id="hash-compare-name-2" class="muted">Файл 2</span>
                  <span id="hash-compare-state-2" class="hash-compare-state muted">-</span>
                </div>
              </div>
              <div id="hash-result" class="quick-action-result muted" data-i18n="hashCheck.resultIdle">Результат появится после проверки.</div>
            </div>
          </article>
        </section>

        <section class="tools-view hidden" data-tool-view="power" aria-label="Power Tool View">
          <article id="tools-restart-card" class="tools-card">
            <div class="tools-card__header">
              <h2 data-i18n="quickActions.power.title">Ярлыки питания Windows</h2>
            </div>
            <p id="restart-shortcut-note" class="tools-card__hint" data-i18n="quickActions.power.hint">
              Создаёт ярлыки питания на рабочем столе Windows.
            </p>
            <div class="power-actions-grid">
              <section class="power-action-item power-action-item--restart">
                <h3 class="power-action-item__title">
                  <i class="fa-solid fa-rotate-right"></i>
                  <span data-i18n="quickActions.restart.cardTitle">Перезагрузка</span>
                </h3>
                <p class="power-action-item__hint" data-i18n="quickActions.restart.cardHint">
                  Мгновенная перезагрузка системы.
                </p>
                <button id="create-restart-shortcut" type="button" class="large-button">
                  <i class="fa-solid fa-plug-circle-bolt"></i>
                  <span data-i18n="quickActions.restart.action">Создать ярлык перезагрузки</span>
                </button>
                <div
                  id="restart-shortcut-result"
                  class="quick-action-result power-action-item__result muted"
                ></div>
              </section>
              <section class="power-action-item power-action-item--shutdown">
                <h3 class="power-action-item__title">
                  <i class="fa-solid fa-power-off"></i>
                  <span data-i18n="quickActions.shutdown.cardTitle">Выключение</span>
                </h3>
                <p class="power-action-item__hint" data-i18n="quickActions.shutdown.cardHint">
                  Мгновенное выключение системы.
                </p>
                <button id="create-shutdown-shortcut" type="button" class="large-button">
                  <i class="fa-solid fa-power-off"></i>
                  <span data-i18n="quickActions.shutdown.action">Создать ярлык выключения</span>
                </button>
                <div
                  id="shutdown-shortcut-result"
                  class="quick-action-result power-action-item__result muted"
                ></div>
              </section>
            </div>
          </article>
        </section>
      </section>
    </div>
  `;

  container.appendChild(view);
  applyI18n(view);

  const isToolAvailable = (toolView, info = toolsPlatformInfo) => {
    if (toolView === "power") return !!info?.isWindows;
    return toolView === "launcher" || toolView === "wg" || toolView === "hash";
  };

  const readLastToolView = () => {
    try {
      const value = window.localStorage.getItem(LAST_TOOL_KEY);
      return value || "launcher";
    } catch {
      return "launcher";
    }
  };

  const resolveInitialToolView = () => {
    const remembered = readLastToolView();
    return isToolAvailable(remembered) ? remembered : "launcher";
  };

  const setToolView = (nextView, { persist = true, focusLauncher = false } = {}) => {
    const launcher = getEl("tools-launcher", view);
    const backBtn = getEl("tools-back-btn", view);
    const title = getEl("tools-view-title", view);
    const requested = String(nextView || "launcher");
    const targetView = isToolAvailable(requested) ? requested : "launcher";
    currentToolView = targetView;

    const showLauncher = targetView === "launcher";
    launcher?.classList.toggle("hidden", !showLauncher);

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
          : "tools.nav.current.power";
    if (title) title.textContent = t(titleKey);

    if (persist && targetView !== "launcher") {
      try {
        window.localStorage.setItem(LAST_TOOL_KEY, targetView);
      } catch {}
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
      setTimeout(() => {
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

      if (currentToolView === "wg") {
        getEl(fields[0].id, view)?.focus();
      }

      // Загрузка состояния отладки
      const debugToggle = getEl("debug-toggle", view);
      if (debugToggle && cfg.debug) {
        debugToggle.classList.add("is-active");
        // Принудительно добавить сообщение при загрузке с включенной отладкой
        setTimeout(() => {
          log(t("wg.log.system.debugInit"));
        }, 100);
      }

      if (cfg.autosend) {
        log(t("wg.log.send.scheduleAuto"));
        setTimeout(() => getEl("wg-send", view)?.click(), 50);
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
                setTimeout(() => status.classList.add("hidden"), 500);

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
    const openWgBtn = getEl("tools-open-wg", view);
    const openHashBtn = getEl("tools-open-hash", view);
    const openPowerBtn = getEl("tools-open-power", view);
    const backBtn = getEl("tools-back-btn", view);

    openWgBtn?.addEventListener("click", () => setToolView("wg"));
    openHashBtn?.addEventListener("click", () => setToolView("hash"));
    openPowerBtn?.addEventListener("click", () => setToolView("power"));
    backBtn?.addEventListener("click", () =>
      setToolView("launcher", { persist: false, focusLauncher: true }),
    );

    // Отправка по Enter и Ctrl/Cmd+Enter
    view.addEventListener("keydown", (e) => {
      if (e.key === "Escape" && currentToolView !== "launcher") {
        e.preventDefault();
        setToolView("launcher", { persist: false, focusLauncher: true });
        return;
      }
      if (e.key !== "Enter") return;
      const target = e.target;
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
      logEntries = [];
      renderLog();
      saveLog();
      log(t("wg.log.log.clearedByUser"));
    });

    const filterErrorsBtn = getEl("wg-log-filter-errors", view);
    filterErrorsBtn?.addEventListener("click", () => {
      logErrorOnly = !logErrorOnly;
      updateLogControls();
      renderLog();
      initTooltips();
    });

    const autoScrollBtn = getEl("wg-log-autoscroll", view);
    autoScrollBtn?.addEventListener("click", () => {
      logAutoScroll = !logAutoScroll;
      updateLogControls();
      renderLog();
      saveLog();
      initTooltips();
    });

    // Отправка UDP-пакета
    getEl("wg-send", view)?.addEventListener("click", handleSend);

    // Подсказка о назначении вкладки WG Unlock
    const helpBtn = getEl("wg-help", view);
    helpBtn?.addEventListener("click", () => {
      showConfirmationDialog({
        title: t("wg.help.title"),
        subtitle: t("wg.help.subtitle"),
        confirmText: t("wg.help.confirm"),
        singleButton: true,
        tone: "info",
        message: t("wg.help.messageHtml"),
      });
    });

    //
    // Добавим новые обработчики после существующего обработчика очистки лога:
    // После обработчика очистки лога добавить:

    // Копирование лога в буфер обмена
    const copyLogBtn = getEl("wg-log-copy", view);
    copyLogBtn?.addEventListener("click", async () => {
      const pre = getEl("wg-log", view);
      if (pre && pre.textContent) {
        try {
          await navigator.clipboard.writeText(pre.textContent);
          toast(t("wg.toast.logCopied"));
          log(t("wg.log.log.copied"));

          // Визуальная обратная связь
          copyLogBtn.innerHTML = `<i class="fa-solid fa-check"></i><span>${t(
            "wg.log.ui.copied",
          )}</span>`;
          copyLogBtn.style.background = "rgba(var(--color-success-rgb), 0.1)";
          copyLogBtn.style.borderColor = "var(--color-success)";
          copyLogBtn.style.color = "var(--color-success)";

          setTimeout(() => {
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
      const pre = getEl("wg-log", view);
      if (pre && pre.textContent) {
        log(t("wg.log.log.exportStarted"));
        window.electron.ipcRenderer.send("wg-export-log", pre.textContent);

        // Визуальная обратная связь
        exportLogBtn.innerHTML = `<i class="fa-solid fa-spinner fa-spin"></i><span>${t(
          "wg.log.ui.exporting",
        )}</span>`;
        exportLogBtn.disabled = true;

        setTimeout(() => {
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
    onIpcEvent("wg-log-export-success", onLogExportSuccess);
    onIpcEvent("wg-log-export-error", onLogExportError);

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
        window.localStorage.setItem(WG_ADVANCED_STATE_KEY, isOpen ? "1" : "0");
      } catch {}
    };

    const readAdvancedState = () => {
      try {
        return window.localStorage.getItem(WG_ADVANCED_STATE_KEY) === "1";
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
    onWindowEvent("i18n:changed", () => {
      setAdvancedOpen(advancedPanel?.classList.contains("is-open"));
      setToolView(currentToolView, { persist: false });
    });

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
    let hashActualValueFirst = "";
    let hashActualValueSecond = "";
    let hashBusy = false;

    const syncSecondFileControls = () => {
      if (!hashClearFileSecondBtn) return;
      hashClearFileSecondBtn.disabled = hashBusy || !hashSelectedFileSecond;
    };

    const setHashBusy = (busy) => {
      hashBusy = !!busy;
      if (hashPickFileBtn) hashPickFileBtn.disabled = hashBusy;
      if (hashPickFileSecondBtn) hashPickFileSecondBtn.disabled = hashBusy;
      if (hashRunBtn) hashRunBtn.disabled = hashBusy;
      if (hashAlgorithmEl) hashAlgorithmEl.disabled = hashBusy;
      if (hashExpectedEl) hashExpectedEl.disabled = hashBusy;
      if (hashResultPanelEl) {
        hashResultPanelEl.setAttribute("aria-busy", hashBusy ? "true" : "false");
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
      const statusTone = tone === "error" ? "error" : tone === "success" ? "success" : tone === "warning" ? "warning" : "muted";
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
        hashActualBoxSecondEl.classList.toggle("hidden", !hashActualValueSecond);
      }
      if (hashCopyActualFirstBtn) hashCopyActualFirstBtn.disabled = !canCopyFirst;
      if (hashCopyActualSecondBtn) hashCopyActualSecondBtn.disabled = !canCopySecond;
      if (hashCompareDetailsEl) {
        hashCompareDetailsEl.classList.toggle("hidden", !showCompareDetails);
      }
      if (hashCompareStateFirstEl) {
        const firstTone = ["success", "warning", "error", "muted"].includes(compareStateFirstTone)
          ? compareStateFirstTone
          : "muted";
        hashCompareStateFirstEl.textContent = compareStateFirstKey
          ? t(compareStateFirstKey)
          : "-";
        hashCompareStateFirstEl.className = `hash-compare-state ${firstTone}`;
      }
      if (hashCompareStateSecondEl) {
        const secondTone = ["success", "warning", "error", "muted"].includes(compareStateSecondTone)
          ? compareStateSecondTone
          : "muted";
        hashCompareStateSecondEl.textContent = compareStateSecondKey
          ? t(compareStateSecondKey)
          : "-";
        hashCompareStateSecondEl.className = `hash-compare-state ${secondTone}`;
      }
      if (hashCompareNameFirstEl) {
        hashCompareNameFirstEl.textContent = compareNameFirst || t("hashCheck.file1");
      }
      if (hashCompareNameSecondEl) {
        hashCompareNameSecondEl.textContent = compareNameSecond || t("hashCheck.file2");
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
      String(value || "").replace(/\s+/g, "").toLowerCase();

    const setHashActualLabels = (algorithm = hashAlgorithmEl?.value || "SHA-256") => {
      if (hashActualLabelEl) {
        hashActualLabelEl.textContent = t("hashCheck.actualLabelWithAlgorithm", {
          algorithm,
        });
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
            const anyExpectedMatch = firstMatchesExpected || secondMatchesExpected;
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
              compareStateFirstTone: firstMatchesExpected ? "success" : "warning",
              compareStateSecondTone: secondMatchesExpected ? "success" : "warning",
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

          const matches = firstHashNormalized && secondHashNormalized
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
          clearTimeout(hashCopyFeedbackTimerFirst);
          hashCopyFeedbackTimerFirst = null;
        }
        if (timerKey === "second" && hashCopyFeedbackTimerSecond) {
          clearTimeout(hashCopyFeedbackTimerSecond);
          hashCopyFeedbackTimerSecond = null;
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
          const resetTimer = setTimeout(() => {
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

    const restartCard = getEl("tools-restart-card", view);
    const createRestartShortcutBtn = getEl("create-restart-shortcut", view);
    const createShutdownShortcutBtn = getEl("create-shutdown-shortcut", view);
    const restartShortcutNote = getEl("restart-shortcut-note", view);
    const restartShortcutResult = getEl("restart-shortcut-result", view);
    const shutdownShortcutResult = getEl("shutdown-shortcut-result", view);
    const setPowerResult = (resultEl, text, tone = "muted") => {
      if (!resultEl) return;
      resultEl.textContent = text;
      resultEl.className = `quick-action-result power-action-item__result ${tone}`;
    };

    createRestartShortcutBtn?.addEventListener("click", async () => {
      const confirmed = await showConfirmationDialog({
        title: t("quickActions.restart.title"),
        subtitle: t("confirm.default.subtitle"),
        message: t("quickActions.restart.confirm"),
        tone: "warning",
      });
      if (!confirmed) return;

      const res = await window.electron?.tools?.createWindowsRestartShortcut?.();
      if (!res?.success) {
        setPowerResult(
          restartShortcutResult,
          res?.error || t("quickActions.restart.error"),
          "error",
        );
        return;
      }
      setPowerResult(
        restartShortcutResult,
        t("quickActions.restart.created"),
        "success",
      );
    });

    createShutdownShortcutBtn?.addEventListener("click", async () => {
      const confirmed = await showConfirmationDialog({
        title: t("quickActions.shutdown.title"),
        subtitle: t("confirm.default.subtitle"),
        message: t("quickActions.shutdown.confirm"),
        tone: "danger",
      });
      if (!confirmed) return;

      const res = await window.electron?.tools?.createWindowsShutdownShortcut?.();
      if (!res?.success) {
        setPowerResult(
          shutdownShortcutResult,
          res?.error || t("quickActions.shutdown.error"),
          "error",
        );
        return;
      }
      setPowerResult(
        shutdownShortcutResult,
        t("quickActions.shutdown.created"),
        "success",
      );
    });

    isWindowsPlatform = !!toolsPlatformInfo?.isWindows;
    if (isWindowsPlatform) {
      restartCard?.classList.remove("hidden");
      createRestartShortcutBtn?.removeAttribute("disabled");
      createRestartShortcutBtn?.classList.remove("is-disabled");
      createShutdownShortcutBtn?.removeAttribute("disabled");
      createShutdownShortcutBtn?.classList.remove("is-disabled");
      restartShortcutNote.textContent = t(
        "quickActions.power.windowsReady",
      );
      openPowerBtn?.classList.remove("hidden");
    } else {
      restartCard?.classList.add("hidden");
      createRestartShortcutBtn?.setAttribute("disabled", "disabled");
      createRestartShortcutBtn?.classList.add("is-disabled");
      createShutdownShortcutBtn?.setAttribute("disabled", "disabled");
      createShutdownShortcutBtn?.classList.add("is-disabled");
      restartShortcutNote.textContent = t(
        "quickActions.power.windowsOnly",
      );
      openPowerBtn?.classList.add("hidden");
    }
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
      setTimeout(() => status.classList.add("hidden"), 3000);
      return;
    }

    const sendBtn = getEl("wg-send", view);
    const hideLater = () =>
      setTimeout(() => status.classList.add("hidden"), 500);

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
        setTimeout(() => view.classList.remove("wg-success-pulse"), 2000);

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
        setTimeout(() => status.classList.add("hidden"), 5000);
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
      setTimeout(() => debugToggle.classList.remove("pulse"), 600);

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
      // При инициализации устанавливаем флаг новой сессии
      isNewSession = true;
      // Сначала устанавливаем начальное сообщение в лог
      const pre = getEl("wg-log", view);
      if (pre && !pre.textContent.trim()) {
        pre.textContent = t("wg.log.placeholder");
      }

      toolsPlatformInfo =
        (await window.electron.getPlatformInfo?.().catch(() => null)) || {
          isWindows: false,
          platform: "",
        };
      isWindowsPlatform = !!toolsPlatformInfo?.isWindows;
      setToolView(resolveInitialToolView(), { persist: false });

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
          const tipsPath = lang === "en" ? "info/tips.en.json" : "info/tips.json";
          const response = await fetch(tipsPath);
          const data = await response.json();
          tipsItems = Array.isArray(data.tips) ? data.tips : [];
          if (!tipsItems.length) return;

          const clearTipsTimers = () => {
            if (tipsIntervalId) {
              clearInterval(tipsIntervalId);
              tipsIntervalId = null;
            }
          };

          const clearTipsAnimationTimers = () => {
            if (tipsSwapTimer) {
              clearTimeout(tipsSwapTimer);
              tipsSwapTimer = null;
            }
            if (tipsFadeTimer) {
              clearTimeout(tipsFadeTimer);
              tipsFadeTimer = null;
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
            tipsIndex = ((nextIndex % tipsItems.length) + tipsItems.length) % tipsItems.length;
            const text = tipsItems[tipsIndex];
            if (!animate) {
              p.textContent = text;
              p.classList.remove("fade-out", "fade-in");
              updateCounter();
              return;
            }
            p.classList.add("fade-out");
            clearTipsAnimationTimers();
            tipsSwapTimer = setTimeout(() => {
              p.textContent = text;
              p.classList.remove("fade-out");
              p.classList.add("fade-in");
              tipsFadeTimer = setTimeout(() => p.classList.remove("fade-in"), 800);
              updateCounter();
            }, 180);
          };

          const scheduleRotation = () => {
            clearTipsTimers();
            if (tipsPaused || tipsItems.length <= 1) return;
            tipsIntervalId = setInterval(() => {
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
      onWindowEvent("i18n:changed", (e) => {
        const next = e?.detail?.lang || getLanguage();
        initTipsRotation(next);
      });

      const initNetworkSettingsButton = async () => {
        const platform = toolsPlatformInfo?.platform || "";
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
  onIpcEvent("wg-auto-shutdown-updated", onAutoShutdownUpdated);

  const disconnectObserver = new MutationObserver(() => {
    if (!container.isConnected) {
      disposeView();
      disconnectObserver.disconnect();
    }
  });
  if (document.body) {
    disconnectObserver.observe(document.body, { childList: true, subtree: true });
    addCleanup(() => disconnectObserver.disconnect());
  }

  // Запускаем инициализацию
  initialize();

  return container;
}
