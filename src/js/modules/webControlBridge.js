import {
  getWebControlSnapshot,
  handleWebControlDownloaderAction,
} from "./downloadManager.js";
import {
  getTheme,
  setTheme,
  getFontSize,
  setFontSize,
} from "./settingsStore.js";
import { getLanguage, setLanguagePreview } from "./i18n.js";
import {
  QUALITY_PROFILE_DEFAULT,
  QUALITY_PROFILE_KEY,
} from "./features/settings/defaults.js";

const RESPONSE_CHANNEL = "web:rendererResponse";
const REQUEST_CHANNEL = "web:rendererRequest";

const BOOLEAN_SETTINGS = new Set([
  "openOnCopyUrl",
  "openOnDownloadComplete",
  "disableCompleteModal",
  "autoOpenQualityModal",
  "showToolsStatus",
]);

function readLocalFlag(key, defaultValue) {
  try {
    const value = localStorage.getItem(key);
    if (value === null) return defaultValue;
    return value !== "0" && value !== "false";
  } catch {
    return defaultValue;
  }
}

function normalizeQualityProfile(value) {
  return value === "audio" || value === "remember"
    ? value
    : QUALITY_PROFILE_DEFAULT;
}

async function getWebControlSettings() {
  const [
    downloadPath,
    parallelLimit,
    openOnCopyUrl,
    openOnDownloadComplete,
    disableCompleteModal,
  ] = await Promise.all([
    window.electron.invoke("get-download-path"),
    window.electron.invoke("get-download-parallel-limit"),
    window.electron.invoke("get-open-on-copy-url-status"),
    window.electron.invoke("get-open-on-download-complete-status"),
    window.electron.invoke("get-disable-complete-modal-status"),
  ]);

  return {
    downloadPath: downloadPath || "",
    parallelLimit: Number(parallelLimit) || 1,
    qualityProfile: normalizeQualityProfile(
      localStorage.getItem(QUALITY_PROFILE_KEY),
    ),
    autoOpenQualityModal: readLocalFlag("downloadAutoOpenQualityModal", true),
    openOnCopyUrl: Boolean(openOnCopyUrl),
    openOnDownloadComplete: Boolean(openOnDownloadComplete),
    disableCompleteModal: Boolean(disableCompleteModal),
    showToolsStatus:
      localStorage.getItem("downloaderToolsStatusHidden") !== "1",
    theme: await getTheme(),
    language: getLanguage(),
    fontSize: await getFontSize(),
  };
}

async function setBooleanSetting(key, value) {
  const enabled = Boolean(value);
  if (key === "openOnCopyUrl") {
    await window.electron.invoke("set-open-on-copy-url-status", enabled);
  } else if (key === "openOnDownloadComplete") {
    await window.electron.invoke(
      "set-open-on-download-complete-status",
      enabled,
    );
  } else if (key === "disableCompleteModal") {
    await window.electron.invoke("set-disable-complete-modal-status", enabled);
  } else if (key === "autoOpenQualityModal") {
    if (enabled) {
      localStorage.removeItem("downloadAutoOpenQualityModal");
    } else {
      localStorage.setItem("downloadAutoOpenQualityModal", "0");
    }
  } else if (key === "showToolsStatus") {
    if (enabled) {
      localStorage.removeItem("downloaderToolsStatusHidden");
    } else {
      localStorage.setItem("downloaderToolsStatusHidden", "1");
    }
    window.dispatchEvent(
      new CustomEvent("tools:visibility", { detail: { hidden: !enabled } }),
    );
  }
}

async function setWebControlSettings(payload = {}) {
  const entries = Object.entries(payload || {});
  for (const [key, value] of entries) {
    if (BOOLEAN_SETTINGS.has(key)) {
      await setBooleanSetting(key, value);
      continue;
    }
    if (key === "downloadPath") {
      const path = String(value || "").trim();
      if (path) await window.electron.invoke("set-download-path", path);
    } else if (key === "parallelLimit") {
      const limit = Math.max(1, Math.min(2, Number(value) || 1));
      await window.electron.invoke("set-download-parallel-limit", limit);
      localStorage.setItem("downloadParallelLimit", String(limit));
      window.dispatchEvent(
        new CustomEvent("download:parallel-limit-changed", {
          detail: { limit },
        }),
      );
    } else if (key === "qualityProfile") {
      localStorage.setItem(QUALITY_PROFILE_KEY, normalizeQualityProfile(value));
    } else if (key === "theme") {
      await setTheme(String(value || "dark"));
    } else if (key === "fontSize") {
      await setFontSize(String(value || "16"));
    } else if (key === "language") {
      setLanguagePreview(value);
    }
  }
  return getWebControlSettings();
}

async function handleWebControlRequest(message = {}) {
  const command = String(message.command || "");
  const payload = message.payload || {};
  if (command === "snapshot") return getWebControlSnapshot();
  if (command === "settings:get") return getWebControlSettings();
  if (command === "settings:set") return setWebControlSettings(payload);
  return handleWebControlDownloaderAction(command, payload);
}

export function initWebControlBridge() {
  window.electron?.on?.(REQUEST_CHANNEL, async (message = {}) => {
    const requestId = String(message.requestId || "");
    try {
      const result = await handleWebControlRequest(message);
      window.electron.send(RESPONSE_CHANNEL, {
        requestId,
        success: true,
        result,
      });
    } catch (error) {
      window.electron.send(RESPONSE_CHANNEL, {
        requestId,
        success: false,
        error: error.message || String(error),
      });
    }
  });
}

export {
  getWebControlSettings,
  setWebControlSettings,
  handleWebControlRequest,
};
