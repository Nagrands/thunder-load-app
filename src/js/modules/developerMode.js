const DEVELOPER_TOOLS_UNLOCK_GLOBAL_KEY = "__thunder_dev_tools_unlocked__";
const DEVELOPER_TOOLS_UNLOCK_STORAGE_KEY = "developerToolsUnlocked";
const DEVELOPER_DISABLE_DOWNLOADER_TAB_STORAGE_KEY =
  "developerDisableDownloaderTab";

function readBooleanStorage(key, fallback = false) {
  try {
    const raw = window.localStorage.getItem(key);
    if (raw === null) return fallback;
    if (raw === "1" || raw === "true") return true;
    if (raw === "0" || raw === "false") return false;
    return JSON.parse(raw) === true;
  } catch {
    return fallback;
  }
}

function writeBooleanStorage(key, value) {
  try {
    window.localStorage.setItem(key, JSON.stringify(!!value));
  } catch {}
}

function writeDeveloperModeGlobal(enabled) {
  try {
    window[DEVELOPER_TOOLS_UNLOCK_GLOBAL_KEY] = !!enabled;
  } catch {}
}

export function readDeveloperModeEnabled() {
  let enabled = false;
  try {
    const raw = window.localStorage.getItem(DEVELOPER_TOOLS_UNLOCK_STORAGE_KEY);
    enabled =
      raw === null
        ? window[DEVELOPER_TOOLS_UNLOCK_GLOBAL_KEY] === true
        : readBooleanStorage(DEVELOPER_TOOLS_UNLOCK_STORAGE_KEY, false);
  } catch {
    enabled = false;
  }
  writeDeveloperModeGlobal(enabled);
  return enabled;
}

export function syncDeveloperModeState() {
  return readDeveloperModeEnabled();
}

export function readDeveloperDisableDownloaderTab() {
  return readBooleanStorage(
    DEVELOPER_DISABLE_DOWNLOADER_TAB_STORAGE_KEY,
    false,
  );
}

export function isDownloaderTabEffectivelyDisabled() {
  return readDeveloperModeEnabled() && readDeveloperDisableDownloaderTab();
}

export function dispatchDeveloperModeChanged(enabled) {
  window.dispatchEvent(
    new CustomEvent("tools:developer-unlock-changed", {
      detail: { enabled: !!enabled },
    }),
  );
}

export function dispatchDownloaderTabDisabledChanged() {
  window.dispatchEvent(
    new CustomEvent("download:toggleDisabled", {
      detail: { disabled: isDownloaderTabEffectivelyDisabled() },
    }),
  );
}

export function setDeveloperModeEnabled(enabled, options = {}) {
  const shouldEmit = options.emit !== false;
  const normalized = !!enabled;
  writeBooleanStorage(DEVELOPER_TOOLS_UNLOCK_STORAGE_KEY, normalized);
  writeDeveloperModeGlobal(normalized);
  if (shouldEmit) {
    dispatchDeveloperModeChanged(normalized);
    dispatchDownloaderTabDisabledChanged();
  }
  return normalized;
}

export function setDeveloperDisableDownloaderTab(disabled, options = {}) {
  const shouldEmit = options.emit !== false;
  const normalized = !!disabled;
  writeBooleanStorage(DEVELOPER_DISABLE_DOWNLOADER_TAB_STORAGE_KEY, normalized);
  if (shouldEmit) {
    dispatchDownloaderTabDisabledChanged();
  }
  return normalized;
}

export {
  DEVELOPER_TOOLS_UNLOCK_GLOBAL_KEY,
  DEVELOPER_TOOLS_UNLOCK_STORAGE_KEY,
  DEVELOPER_DISABLE_DOWNLOADER_TAB_STORAGE_KEY,
};
