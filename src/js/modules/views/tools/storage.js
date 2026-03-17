const TOOLS_STORAGE_KEYS = Object.freeze({
  WG_ADVANCED_STATE: "toolsWgAdvancedOpen",
  LAST_TOOL_VIEW: "toolsLastView",
  REMEMBER_LAST_VIEW: "toolsRememberLastView",
  WG_LOG_V2: "wg-log-v2",
  WG_LOG_LEGACY: "wg-log",
  WG_LAST_SEND_TIME: "wg-last-send-time",
});

function readStorageValue(key, fallback = "") {
  try {
    const value = window.localStorage.getItem(key);
    return value == null ? fallback : value;
  } catch {
    return fallback;
  }
}

function writeStorageValue(key, value) {
  try {
    window.localStorage.setItem(key, String(value ?? ""));
  } catch {}
}

function readBooleanStorage(key, fallback = false) {
  try {
    const raw = window.localStorage.getItem(key);
    if (raw === null) return fallback;
    return JSON.parse(raw) === true;
  } catch {
    return fallback;
  }
}

function readJsonStorage(key, fallback = null) {
  try {
    const raw = window.localStorage.getItem(key);
    if (raw == null || raw === "") return fallback;
    return JSON.parse(raw);
  } catch {
    return fallback;
  }
}

function writeJsonStorage(key, value) {
  try {
    window.localStorage.setItem(key, JSON.stringify(value));
  } catch {}
}

export {
  TOOLS_STORAGE_KEYS,
  readBooleanStorage,
  readJsonStorage,
  readStorageValue,
  writeJsonStorage,
  writeStorageValue,
};
