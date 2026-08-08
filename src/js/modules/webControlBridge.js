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
import {
  cancelVideoInfoRequest,
  getVideoInfo,
} from "./videoInfoBroker.js";
import { buildWebCompactQualityOptions } from "./downloadQualityOptions.js";

const RESPONSE_CHANNEL = "web:rendererResponse";
const REQUEST_CHANNEL = "web:rendererRequest";
const CANCEL_CHANNEL = "web:rendererCancel";
let disposeActiveBridge = null;

const BOOLEAN_SETTINGS = new Set([
  "openOnCopyUrl",
  "openOnDownloadComplete",
  "disableCompleteModal",
  "autoOpenQualityModal",
  "showToolsStatus",
]);
const THEME_SETTINGS = new Set([
  "dark",
  "midnight",
  "emerald",
  "sunset",
  "violet",
]);
const LANGUAGE_SETTINGS = new Set(["ru", "en"]);
const FONT_SIZE_SETTINGS = new Set(["14", "16", "18", "20"]);
const QUALITY_PROFILE_SETTINGS = new Set(["remember", "best", "audio"]);
const SETTINGS_KEYS = new Set([
  ...BOOLEAN_SETTINGS,
  "downloadPath",
  "parallelLimit",
  "qualityProfile",
  "theme",
  "fontSize",
  "language",
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
  return QUALITY_PROFILE_SETTINGS.has(value) ? value : QUALITY_PROFILE_DEFAULT;
}

function validateWebControlSettingsPatch(payload) {
  if (!payload || typeof payload !== "object" || Array.isArray(payload)) {
    throw new Error("Settings patch must be an object");
  }

  for (const [key, value] of Object.entries(payload)) {
    if (!SETTINGS_KEYS.has(key)) throw new Error(`Unknown setting: ${key}`);
    if (BOOLEAN_SETTINGS.has(key) && typeof value !== "boolean") {
      throw new Error(`Invalid boolean setting: ${key}`);
    }
    if (
      key === "downloadPath" &&
      (typeof value !== "string" || !value.trim())
    ) {
      throw new Error("Invalid download path");
    }
    if (key === "parallelLimit" && ![1, 2].includes(value)) {
      throw new Error("Invalid parallel limit");
    }
    if (key === "qualityProfile" && !QUALITY_PROFILE_SETTINGS.has(value)) {
      throw new Error("Invalid quality profile");
    }
    if (key === "theme" && !THEME_SETTINGS.has(value)) {
      throw new Error("Invalid theme");
    }
    if (key === "fontSize" && !FONT_SIZE_SETTINGS.has(value)) {
      throw new Error("Invalid font size");
    }
    if (key === "language" && !LANGUAGE_SETTINGS.has(value)) {
      throw new Error("Invalid language");
    }
  }

  return payload;
}

function assertSuccessfulResult(result, setting) {
  if (result && typeof result === "object" && result.success === false) {
    throw new Error(result.error || `Failed to apply ${setting}`);
  }
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
  const patch = validateWebControlSettingsPatch(payload);
  const entries = Object.entries(patch);
  for (const [key, value] of entries) {
    if (BOOLEAN_SETTINGS.has(key)) {
      await setBooleanSetting(key, value);
      continue;
    }
    if (key === "downloadPath") {
      const path = value.trim();
      const result = await window.electron.invoke("set-download-path", path);
      assertSuccessfulResult(result, "download path");
    } else if (key === "parallelLimit") {
      const limit = value;
      const result = await window.electron.invoke(
        "set-download-parallel-limit",
        limit,
      );
      assertSuccessfulResult(result, "parallel limit");
      localStorage.setItem("downloadParallelLimit", String(limit));
      window.dispatchEvent(
        new CustomEvent("download:parallel-limit-changed", {
          detail: { limit },
        }),
      );
    } else if (key === "qualityProfile") {
      localStorage.setItem(QUALITY_PROFILE_KEY, value);
    } else if (key === "theme") {
      await setTheme(value);
    } else if (key === "fontSize") {
      await setFontSize(value);
    } else if (key === "language") {
      setLanguagePreview(value);
    }
  }
  return getWebControlSettings();
}

function translateWebQuality(key, params = {}) {
  const labels = {
    "quality.custom": "Другой формат",
    "quality.label.audio": "Аудио",
    "quality.label.audioMp3": "Аудио MP3",
    "quality.label.video": "Видео",
    "quality.compact.noAudio": "Без аудио",
    "quality.compact.noAudioHint": "Скачать только видеодорожку",
    "quality.compact.noVideo": "Без видео",
    "quality.compact.noVideoHint": "Скачать только аудиодорожку",
  };
  if (key === "quality.label.videoNoAudio") {
    return `${params.label || "Видео"} без аудио`;
  }
  if (key === "quality.label.videoWithAudio") {
    return `${params.label || "Видео"} с аудио`;
  }
  if (key === "quality.desc.audioMp3") {
    return `MP3 • ${params.bitrate || "?"} kbps`;
  }
  return labels[key] || key;
}

async function getWebCompactPreview(payload = {}) {
  const url = String(payload.url || "").trim();
  if (!url) throw new Error("URL is required");
  const info = await getVideoInfo(url);
  if (!info?.success || !Array.isArray(info.formats) || !info.formats.length) {
    throw new Error(info?.error || "Formats are unavailable");
  }
  return {
    title: info.title || "",
    url: info.webpage_url || info.original_url || url,
    ...buildWebCompactQualityOptions(info, translateWebQuality),
  };
}

async function handleWebControlRequest(message = {}) {
  const command = String(message.command || "");
  const payload = message.payload || {};
  if (command === "snapshot") return getWebControlSnapshot();
  if (command === "settings:get") return getWebControlSettings();
  if (command === "settings:set") return setWebControlSettings(payload);
  if (command === "preview:get") return getWebCompactPreview(payload);
  return handleWebControlDownloaderAction(command, payload);
}

export function initWebControlBridge() {
  disposeActiveBridge?.();

  const disposeRequest = window.electron?.on?.(
    REQUEST_CHANNEL,
    async (message = {}) => {
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
    },
  );
  const disposeCancel = window.electron?.on?.(
    CANCEL_CHANNEL,
    (message = {}) => {
      if (message.command !== "preview:get") return;
      const url = String(message.payload?.url || "").trim();
      if (url) void cancelVideoInfoRequest(url);
    },
  );

  let disposed = false;
  const dispose = () => {
    if (disposed) return;
    disposed = true;
    disposeRequest?.();
    disposeCancel?.();
    if (disposeActiveBridge === dispose) disposeActiveBridge = null;
  };
  disposeActiveBridge = dispose;
  return dispose;
}

export {
  getWebControlSettings,
  setWebControlSettings,
  getWebCompactPreview,
  handleWebControlRequest,
  validateWebControlSettingsPatch,
};
