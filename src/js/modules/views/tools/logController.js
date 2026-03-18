import {
  TOOLS_STORAGE_KEYS,
  readJsonStorage,
  readStorageValue,
  writeJsonStorage,
  writeStorageValue,
} from "./storage.js";

const WG_LOG_MAX_ENTRIES = 300;

function createLogController({ view, getEl, t }) {
  const state = {
    autoScroll: true,
    entries: [],
    errorOnly: false,
    sessionBreakPending: false,
  };

  const formatLogEntry = (entry) => {
    const dt = new Date(entry.ts || Date.now());
    const pad = (n) => String(n).padStart(2, "0");
    const time = `${pad(dt.getHours())}:${pad(dt.getMinutes())}:${pad(dt.getSeconds())}`;
    const level = (entry.level || "info").toUpperCase().padEnd(5, " ");
    return `${time} | ${level} | ${entry.text || ""}`;
  };

  const getVisibleEntries = () =>
    state.errorOnly
      ? state.entries.filter((entry) => entry.level === "error")
      : state.entries;

  const renderLog = () => {
    const pre = getEl("wg-log", view);
    if (!pre) return;
    const visible = getVisibleEntries();
    pre.textContent = visible.length
      ? visible.map(formatLogEntry).join("\n")
      : t("wg.log.placeholder");
    pre.classList.toggle("error-log", state.errorOnly);
    if (state.autoScroll) {
      pre.scrollTop = pre.scrollHeight;
    }
  };

  const saveLog = () => {
    writeJsonStorage(TOOLS_STORAGE_KEYS.WG_LOG_V2, {
      autoScroll: !!state.autoScroll,
      entries: state.entries.slice(-WG_LOG_MAX_ENTRIES),
    });
  };

  const appendLogEntry = (text, level = "info") => {
    state.entries.push({
      level,
      text: String(text || ""),
      ts: Date.now(),
    });
    if (state.entries.length > WG_LOG_MAX_ENTRIES) {
      state.entries = state.entries.slice(-WG_LOG_MAX_ENTRIES);
    }
    renderLog();
    saveLog();
  };

  const startSession = () => {
    state.sessionBreakPending = true;
  };

  const log = (text, error = false) => {
    const debugToggle = getEl("debug-toggle", view);
    const debugEnabled = debugToggle
      ? debugToggle.classList.contains("is-active")
      : false;

    if (!debugEnabled && !error) return;

    if (state.sessionBreakPending) {
      appendLogEntry("────────────────────────", "info");
      state.sessionBreakPending = false;
    }

    appendLogEntry(text, error ? "error" : "info");

    const pre = getEl("wg-log", view);
    const details = pre?.closest("details");
    if (details && !details.open) details.open = true;
  };

  const clearLog = () => {
    state.entries = [];
    renderLog();
    saveLog();
  };

  const loadLog = () => {
    const parsed = readJsonStorage(TOOLS_STORAGE_KEYS.WG_LOG_V2, null);
    if (parsed && typeof parsed === "object") {
      state.entries = Array.isArray(parsed.entries) ? parsed.entries : [];
      state.autoScroll = parsed.autoScroll !== false;
      renderLog();
      return;
    }

    const legacy = readStorageValue(TOOLS_STORAGE_KEYS.WG_LOG_LEGACY, "");
    if (legacy) {
      state.entries = String(legacy)
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

  const updateLogControls = () => {
    const autoBtn = getEl("wg-log-autoscroll", view);
    const filterBtn = getEl("wg-log-filter-errors", view);
    if (autoBtn) {
      autoBtn.classList.toggle("is-active", state.autoScroll);
      autoBtn.title = state.autoScroll
        ? t("wg.log.autoscroll.on")
        : t("wg.log.autoscroll.off");
    }
    if (filterBtn) {
      filterBtn.classList.toggle("is-active", state.errorOnly);
      filterBtn.title = state.errorOnly
        ? t("wg.log.filter.errorsOn")
        : t("wg.log.filter.errorsOff");
    }
  };

  const setErrorOnly = (enabled) => {
    state.errorOnly = !!enabled;
    updateLogControls();
    renderLog();
    return state.errorOnly;
  };

  const setAutoScroll = (enabled) => {
    state.autoScroll = !!enabled;
    updateLogControls();
    renderLog();
    saveLog();
    return state.autoScroll;
  };

  const loadLastSendTime = () => {
    const el = getEl("wg-last-send-time", view);
    const saved = readStorageValue(TOOLS_STORAGE_KEYS.WG_LAST_SEND_TIME, "");
    if (el && saved) {
      const dt = new Date(saved);
      if (!Number.isNaN(dt.getTime())) {
        const pad = (n) => String(n).padStart(2, "0");
        const atLabel = t("wg.time.at");
        el.textContent = `${dt.getFullYear()}-${pad(dt.getMonth() + 1)}-${pad(dt.getDate())} ${atLabel} ${pad(dt.getHours())}:${pad(dt.getMinutes())}:${pad(dt.getSeconds())}`;
      }
    }
  };

  const updateLastSendTime = (time = new Date()) => {
    const el = getEl("wg-last-send-time", view);
    if (!el) return;
    const nextTime = time instanceof Date ? time : new Date(time);
    const pad = (n) => String(n).padStart(2, "0");
    el.textContent = `${pad(nextTime.getHours())}:${pad(nextTime.getMinutes())}:${pad(nextTime.getSeconds())}`;
    writeStorageValue(
      TOOLS_STORAGE_KEYS.WG_LAST_SEND_TIME,
      nextTime.toISOString(),
    );
  };

  const getLogText = () => getEl("wg-log", view)?.textContent || "";

  return {
    clearLog,
    get autoScroll() {
      return state.autoScroll;
    },
    getLogText,
    get errorOnly() {
      return state.errorOnly;
    },
    loadLastSendTime,
    loadLog,
    log,
    setAutoScroll,
    setErrorOnly,
    startSession,
    updateLastSendTime,
    updateLogControls,
  };
}

export { createLogController };
