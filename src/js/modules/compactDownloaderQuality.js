import { t } from "./i18n.js";
import { getCachedVideoInfo, setCachedVideoInfo } from "./videoInfoCache.js";
import { normalizeUrlInput } from "./validation.js";
import {
  buildCompactPayload,
  buildCompactQualityOptions,
} from "./downloadQualityOptions.js";

const MODE_STORAGE_KEY = "downloaderViewMode";
const PREVIEW_EVENT = "downloader:preview-info";

const state = {
  mode: "detailed",
  currentUrl: "",
  info: null,
  videoOptions: [],
  audioOptions: [],
  loading: false,
};

const elements = {
  container: document.querySelector(".input-container"),
  shell: document.querySelector(".url-entry-shell"),
  toggleDetailed: document.getElementById("downloader-view-detailed"),
  toggleCompact: document.getElementById("downloader-view-compact"),
  panel: document.getElementById("compact-quality-panel"),
  videoSelect: document.getElementById("compact-video-quality"),
  audioSelect: document.getElementById("compact-audio-quality"),
  status: document.getElementById("compact-quality-status"),
};

const readMode = () => {
  try {
    return localStorage.getItem(MODE_STORAGE_KEY) === "compact"
      ? "compact"
      : "detailed";
  } catch {
    return "detailed";
  }
};

const writeMode = (mode) => {
  try {
    localStorage.setItem(MODE_STORAGE_KEY, mode);
  } catch {}
};

function isCompactDownloaderMode() {
  return state.mode === "compact";
}

function setStatus(key = "", tone = "muted") {
  if (!elements.status) return;
  elements.status.textContent = key ? t(key) : "";
  elements.status.dataset.tone = tone;
  elements.status.classList.toggle("hidden", !key);
}

function setMode(mode, { persist = true } = {}) {
  state.mode = mode === "compact" ? "compact" : "detailed";
  elements.container?.classList.toggle(
    "is-downloader-compact",
    state.mode === "compact",
  );
  elements.shell?.classList.toggle(
    "is-downloader-compact",
    state.mode === "compact",
  );
  if (elements.panel) {
    elements.panel.hidden = state.mode !== "compact";
    elements.panel.setAttribute(
      "aria-hidden",
      state.mode === "compact" ? "false" : "true",
    );
  }
  elements.toggleDetailed?.classList.toggle(
    "active",
    state.mode === "detailed",
  );
  elements.toggleCompact?.classList.toggle(
    "active",
    state.mode === "compact",
  );
  elements.toggleDetailed?.setAttribute(
    "aria-pressed",
    state.mode === "detailed" ? "true" : "false",
  );
  elements.toggleCompact?.setAttribute(
    "aria-pressed",
    state.mode === "compact" ? "true" : "false",
  );
  if (persist) writeMode(state.mode);
}

function optionLabel(option) {
  const meta = option.meta ? ` (${option.meta})` : "";
  return `${option.title}${meta}`;
}

function renderSelect(selectEl, options, selectedId = "") {
  if (!selectEl) return;
  selectEl.innerHTML = "";
  options.forEach((option) => {
    const el = document.createElement("option");
    el.value = option.id;
    el.textContent = optionLabel(option);
    el.disabled = !!option.disabled;
    selectEl.appendChild(el);
  });
  if (selectedId && options.some((option) => option.id === selectedId)) {
    selectEl.value = selectedId;
  }
}

function getSelectedOption(options, selectedId) {
  return options.find((option) => option.id === selectedId) || options[0] || null;
}

function syncAudioAvailability() {
  const video = getSelectedOption(
    state.videoOptions,
    elements.videoSelect?.value,
  );
  const mp3Options = state.audioOptions.filter((option) => option.source === "mp3");
  const allowAudioOnlyFormats = video?.kind === "none";
  mp3Options.forEach((option) => {
    option.disabled = !allowAudioOnlyFormats;
  });
  const noAudio = state.audioOptions.find((option) => option.id === "no-audio");
  if (noAudio) {
    noAudio.disabled = video?.source !== "video-only";
  }
  renderSelect(elements.audioSelect, state.audioOptions, elements.audioSelect?.value);
  const selectedAudio = getSelectedOption(
    state.audioOptions,
    elements.audioSelect?.value,
  );
  if (selectedAudio?.disabled) {
    const fallback =
      state.audioOptions.find((option) => !option.disabled && option.kind === "audio") ||
      state.audioOptions.find((option) => !option.disabled);
    if (fallback && elements.audioSelect) elements.audioSelect.value = fallback.id;
  }
}

function syncStatusForSelection() {
  if (!state.info) {
    setStatus("quality.compact.waiting", "muted");
    return;
  }
  const payload = getCompactQualityPayload({ fetchIfMissing: false });
  setStatus(payload ? "" : "quality.compact.invalidSelection", "warning");
}

function selectDefaults() {
  const defaultVideo =
    state.videoOptions.find((option) => option.kind === "video") ||
    state.videoOptions[0];
  const defaultAudio =
    state.audioOptions.find(
      (option) => option.kind === "audio" && option.source !== "mp3",
    ) || state.audioOptions.find((option) => option.kind === "audio");
  if (elements.videoSelect && defaultVideo) {
    elements.videoSelect.value = defaultVideo.id;
  }
  if (elements.audioSelect && defaultAudio) {
    elements.audioSelect.value = defaultAudio.id;
  }
  syncAudioAvailability();
  syncStatusForSelection();
}

function renderQualityControls(info, url = "") {
  if (!info?.success || !Array.isArray(info.formats) || !info.formats.length) {
    state.info = null;
    state.currentUrl = "";
    state.videoOptions = [];
    state.audioOptions = [];
    renderSelect(elements.videoSelect, []);
    renderSelect(elements.audioSelect, []);
    setStatus("quality.compact.waiting", "muted");
    return;
  }
  state.info = info;
  state.currentUrl = url || info.webpage_url || info.original_url || "";
  const groups = buildCompactQualityOptions(info, t);
  state.videoOptions = groups.videoOptions;
  state.audioOptions = groups.audioOptions;
  renderSelect(elements.videoSelect, state.videoOptions);
  renderSelect(elements.audioSelect, state.audioOptions);
  selectDefaults();
}

async function ensureCompactQualityReady(url) {
  const normalized = normalizeUrlInput(url).trim();
  const cached = getCachedVideoInfo(normalized);
  if (cached?.success && Array.isArray(cached.formats) && cached.formats.length) {
    renderQualityControls(cached, normalized);
    return true;
  }
  if (state.loading) return false;
  state.loading = true;
  setStatus("quality.compact.loading", "muted");
  try {
    const info = await window.electron.ipcRenderer.invoke(
      "get-video-info",
      normalized,
    );
    if (!info?.success || !Array.isArray(info.formats) || !info.formats.length) {
      setStatus("quality.compact.error", "warning");
      return false;
    }
    setCachedVideoInfo(normalized, info);
    renderQualityControls(info, normalized);
    return true;
  } catch {
    setStatus("quality.compact.error", "warning");
    return false;
  } finally {
    state.loading = false;
  }
}

function getCompactQualityPayload({ fetchIfMissing = false } = {}) {
  if (!state.info && fetchIfMissing) return null;
  const videoOption = getSelectedOption(
    state.videoOptions,
    elements.videoSelect?.value,
  );
  const audioOption = getSelectedOption(
    state.audioOptions,
    elements.audioSelect?.value,
  );
  return buildCompactPayload({ videoOption, audioOption, t });
}

async function resolveCompactQualityPayload(url) {
  const normalized = normalizeUrlInput(url).trim();
  const currentUrl = normalizeUrlInput(state.currentUrl).trim();
  const ready =
    state.info && (!normalized || normalized === currentUrl)
      ? true
      : await ensureCompactQualityReady(normalized);
  if (!ready) return null;
  const payload = getCompactQualityPayload();
  syncStatusForSelection();
  return payload;
}

function initCompactDownloaderQuality() {
  if (!elements.toggleDetailed || !elements.toggleCompact || !elements.panel) {
    return;
  }
  setMode(readMode(), { persist: false });
  setStatus("quality.compact.waiting", "muted");

  elements.toggleDetailed.addEventListener("click", () => setMode("detailed"));
  elements.toggleCompact.addEventListener("click", () => setMode("compact"));
  elements.videoSelect?.addEventListener("change", () => {
    syncAudioAvailability();
    syncStatusForSelection();
  });
  elements.audioSelect?.addEventListener("change", syncStatusForSelection);

  window.addEventListener(PREVIEW_EVENT, (event) => {
    const info = event?.detail?.info || null;
    const url = event?.detail?.url || "";
    renderQualityControls(info, url);
  });
}

export {
  PREVIEW_EVENT,
  ensureCompactQualityReady,
  getCompactQualityPayload,
  initCompactDownloaderQuality,
  isCompactDownloaderMode,
  resolveCompactQualityPayload,
};
