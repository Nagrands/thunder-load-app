import { openDownloadQualityModal } from "./downloadQualityModal.js";
import {
  buildCompactQualityOptions,
  buildDownloaderSelection,
  buildSubtitleQualityOptions,
} from "./downloadQualityOptions.js";
import { t } from "./i18n.js";
import { getVideoInfo } from "./videoInfoBroker.js";
import { getCachedVideoInfo, setCachedVideoInfo } from "./videoInfoCache.js";
import { normalizeUrlInput } from "./validation.js";

const PREVIEW_EVENT = "downloader:preview-info";
const QUALITY_PROFILE_KEY = "downloadQualityProfile";
const LAST_QUALITY_KEY = "downloadLastQuality";

const state = {
  currentUrl: "",
  info: null,
  videoOptions: [],
  audioOptions: [],
  subtitleOptions: [],
  loadingRequest: 0,
};

const elements = {
  urlInput: document.getElementById("url"),
  card: document.getElementById("preview-card"),
  videoSelect: document.getElementById("downloader-video-quality"),
  audioSelect: document.getElementById("downloader-audio-quality"),
  subtitleSelect: document.getElementById("downloader-subtitle-quality"),
  videoMeta: document.getElementById("downloader-video-meta"),
  audioMeta: document.getElementById("downloader-audio-meta"),
  subtitleMeta: document.getElementById("downloader-subtitle-meta"),
  summary: document.getElementById("downloader-output-summary"),
  status: document.getElementById("downloader-quality-status"),
  advanced: document.getElementById("downloader-advanced-formats"),
  download: document.getElementById("download-button"),
  enqueue: document.getElementById("enqueue-button"),
};

function optionLabel(option) {
  return option?.meta
    ? `${option.title} · ${option.meta}`
    : option?.title || "";
}

function getSelected(options, select) {
  return (
    options.find((option) => option.id === select?.value) || options[0] || null
  );
}

function renderOptions(select, options, selectedId = "") {
  if (!select) return;
  select.innerHTML = "";
  options.forEach((option) => {
    const element = document.createElement("option");
    element.value = option.id;
    element.textContent = optionLabel(option);
    element.disabled = Boolean(option.disabled);
    select.appendChild(element);
  });
  if (selectedId && options.some((option) => option.id === selectedId)) {
    select.value = selectedId;
  }
  select.disabled = options.length === 0;
}

function setMeta(element, option) {
  if (element) element.textContent = option?.meta || "";
}

function setActionAvailability(enabled) {
  [elements.download, elements.enqueue].forEach((button) => {
    if (!button) return;
    button.disabled = !enabled;
    button.setAttribute("aria-disabled", enabled ? "false" : "true");
  });
}

function getCurrentSelection() {
  const videoOption = getSelected(state.videoOptions, elements.videoSelect);
  const audioOption = getSelected(state.audioOptions, elements.audioSelect);
  const subtitleOption = getSelected(
    state.subtitleOptions,
    elements.subtitleSelect,
  );
  const selection = buildDownloaderSelection({
    videoOption,
    audioOption,
    subtitleOption,
    t,
  });
  if (
    selection &&
    Number(state.info?.playlistCount || state.info?.entries?.length || 0) > 1
  ) {
    selection.subtitlePayloads = [];
  }
  return selection;
}

function syncCompatibility() {
  const video = getSelected(state.videoOptions, elements.videoSelect);
  const subtitle = getSelected(state.subtitleOptions, elements.subtitleSelect);
  state.audioOptions.forEach((option) => {
    if (option.source === "mp3") option.disabled = video?.kind !== "none";
    if (option.id === "no-audio") {
      option.disabled =
        video?.source !== "video-only" &&
        !(video?.kind === "none" && subtitle?.kind === "subtitle");
    }
  });
  const selectedAudioId = elements.audioSelect?.value || "";
  renderOptions(elements.audioSelect, state.audioOptions, selectedAudioId);
  const selectedAudio = getSelected(state.audioOptions, elements.audioSelect);
  if (selectedAudio?.disabled && elements.audioSelect) {
    const fallback = state.audioOptions.find((option) => !option.disabled);
    if (fallback) elements.audioSelect.value = fallback.id;
  }
}

function syncSelectionUi() {
  syncCompatibility();
  const video = getSelected(state.videoOptions, elements.videoSelect);
  const audio = getSelected(state.audioOptions, elements.audioSelect);
  const subtitle = getSelected(state.subtitleOptions, elements.subtitleSelect);
  setMeta(elements.videoMeta, video);
  setMeta(elements.audioMeta, audio);
  setMeta(elements.subtitleMeta, subtitle);
  const selection = getCurrentSelection();
  if (elements.summary) {
    elements.summary.textContent =
      selection?.summary?.text || t("quality.quick.invalidSelection");
  }
  if (elements.status) {
    const playlistCount = Number(
      state.info?.playlistCount || state.info?.entries?.length || 0,
    );
    elements.status.textContent =
      playlistCount > 1 && subtitle?.kind === "subtitle"
        ? t("quality.quick.subtitleSingleOnly")
        : "";
  }
  setActionAvailability(Boolean(selection));
}

function selectDefaults() {
  const defaultVideo =
    state.videoOptions.find((option) => option.kind === "video") ||
    state.videoOptions[0];
  const defaultAudio =
    state.audioOptions.find(
      (option) => option.kind === "audio" && option.source !== "mp3",
    ) || state.audioOptions.find((option) => option.kind === "audio");
  let video = defaultVideo;
  let audio = defaultAudio;
  try {
    const profile = localStorage.getItem(QUALITY_PROFILE_KEY) || "remember";
    const remembered = localStorage.getItem(LAST_QUALITY_KEY) || "";
    if (profile === "audio") {
      video =
        state.videoOptions.find((option) => option.kind === "none") || video;
    } else if (profile === "remember" && remembered) {
      const rememberedVideo = state.videoOptions.find(
        (option) =>
          option.payload?.label === remembered || option.title === remembered,
      );
      const rememberedAudio = state.audioOptions.find(
        (option) =>
          option.payload?.label === remembered || option.title === remembered,
      );
      if (rememberedVideo) video = rememberedVideo;
      if (rememberedAudio) {
        video =
          state.videoOptions.find((option) => option.kind === "none") || video;
        audio = rememberedAudio;
      }
    }
  } catch {}
  if (elements.videoSelect && video) elements.videoSelect.value = video.id;
  if (elements.audioSelect && audio) elements.audioSelect.value = audio.id;
  if (elements.subtitleSelect && state.subtitleOptions[0]) {
    elements.subtitleSelect.value = state.subtitleOptions[0].id;
  }
  syncSelectionUi();
}

function renderQualityControls(info, url = "") {
  if (!info?.success || !Array.isArray(info.formats) || !info.formats.length) {
    state.info = null;
    state.currentUrl = "";
    state.videoOptions = [];
    state.audioOptions = [];
    state.subtitleOptions = [];
    renderOptions(elements.videoSelect, []);
    renderOptions(elements.audioSelect, []);
    renderOptions(elements.subtitleSelect, []);
    if (elements.summary) {
      elements.summary.textContent = t("quality.quick.summaryWaiting");
    }
    if (elements.status) elements.status.textContent = "";
    if (elements.advanced) elements.advanced.disabled = true;
    setActionAvailability(false);
    return;
  }
  state.info = info;
  state.currentUrl = normalizeUrlInput(
    url || info.webpage_url || info.original_url || "",
  ).trim();
  const groups = buildCompactQualityOptions(info, t);
  state.videoOptions = groups.videoOptions;
  state.audioOptions = groups.audioOptions;
  state.subtitleOptions = buildSubtitleQualityOptions(info, t);
  renderOptions(elements.videoSelect, state.videoOptions);
  renderOptions(elements.audioSelect, state.audioOptions);
  renderOptions(elements.subtitleSelect, state.subtitleOptions);
  if (elements.advanced) elements.advanced.disabled = false;
  selectDefaults();
}

function renderQualityState(key, url = "") {
  renderQualityControls(null);
  state.currentUrl = normalizeUrlInput(url).trim();
  if (elements.status) elements.status.textContent = t(key);
}

async function ensureSelectionReady(url) {
  const normalized = normalizeUrlInput(url).trim();
  if (!normalized) return false;
  if (state.info && state.currentUrl === normalized) return true;
  const cached = getCachedVideoInfo(normalized);
  if (
    cached?.success &&
    Array.isArray(cached.formats) &&
    cached.formats.length
  ) {
    renderQualityControls(cached, normalized);
    return true;
  }
  const requestId = ++state.loadingRequest;
  if (elements.status) elements.status.textContent = t("quality.quick.loading");
  try {
    const info = await getVideoInfo(normalized);
    if (requestId !== state.loadingRequest) return false;
    if (
      !info?.success ||
      !Array.isArray(info.formats) ||
      !info.formats.length
    ) {
      if (elements.status)
        elements.status.textContent = t("quality.quick.error");
      return false;
    }
    setCachedVideoInfo(normalized, info);
    renderQualityControls(info, normalized);
    return true;
  } catch {
    if (requestId === state.loadingRequest && elements.status) {
      elements.status.textContent = t("quality.quick.error");
    }
    return false;
  }
}

async function resolveDownloaderSelection(url) {
  const ready = await ensureSelectionReady(url);
  return ready ? getCurrentSelection() : null;
}

function findOptionByPayload(options, payload) {
  return options.find((option) => {
    const candidate = option.payload || {};
    return (
      candidate.type === payload?.type &&
      candidate.videoFormatId === (payload?.videoFormatId || null) &&
      candidate.audioFormatId === (payload?.audioFormatId || null)
    );
  });
}

function applyAdvancedSelection(payload) {
  if (!payload) return;
  if (payload.type === "subtitle-only") {
    const option = state.subtitleOptions.find(
      (entry) =>
        entry.payload?.subtitleLang === payload.subtitleLang &&
        entry.payload?.subtitleSource === payload.subtitleSource,
    );
    if (option && elements.subtitleSelect)
      elements.subtitleSelect.value = option.id;
    syncSelectionUi();
    return;
  }
  const video =
    findOptionByPayload(state.videoOptions, payload) ||
    state.videoOptions.find(
      (option) => option.fmt?.format_id === payload.videoFormatId,
    );
  const audio = findOptionByPayload(state.audioOptions, payload);
  if (payload.type === "audio-only") {
    const noVideo = state.videoOptions.find((option) => option.kind === "none");
    if (noVideo && elements.videoSelect)
      elements.videoSelect.value = noVideo.id;
    if (audio && elements.audioSelect) elements.audioSelect.value = audio.id;
  } else {
    if (video && elements.videoSelect) elements.videoSelect.value = video.id;
    if (payload.audioFormatId && elements.audioSelect) {
      const matchingAudio = state.audioOptions.find(
        (option) => option.fmt?.format_id === payload.audioFormatId,
      );
      if (matchingAudio) elements.audioSelect.value = matchingAudio.id;
    }
  }
  syncSelectionUi();
}

function resetDownloaderSelection() {
  state.loadingRequest += 1;
  renderQualityControls(null);
}

function initDownloaderSelectionCard() {
  if (
    !elements.videoSelect ||
    !elements.audioSelect ||
    !elements.subtitleSelect
  ) {
    return;
  }
  [elements.videoSelect, elements.audioSelect, elements.subtitleSelect].forEach(
    (select) => select.addEventListener("change", syncSelectionUi),
  );
  elements.advanced?.addEventListener("click", async () => {
    if (!state.currentUrl || !state.info) return;
    const payload = await openDownloadQualityModal(state.currentUrl, {
      confirmationMode: "apply",
      cachedInfo: state.info,
    });
    applyAdvancedSelection(payload);
  });
  window.addEventListener(PREVIEW_EVENT, (event) => {
    const info = event?.detail?.info || null;
    const url = event?.detail?.url || "";
    const inputUrl = normalizeUrlInput(elements.urlInput?.value || "").trim();
    const responseUrl = normalizeUrlInput(url).trim();
    if (inputUrl && responseUrl && inputUrl !== responseUrl) return;
    if (event?.detail?.error) {
      renderQualityState("quality.quick.error", responseUrl);
      return;
    }
    if (!info) {
      resetDownloaderSelection();
      return;
    }
    if (!Array.isArray(info.formats) || !info.formats.length) {
      renderQualityState("quality.quick.loading", responseUrl);
      return;
    }
    renderQualityControls(info, url);
  });
  resetDownloaderSelection();
}

export {
  PREVIEW_EVENT,
  applyAdvancedSelection,
  ensureSelectionReady,
  initDownloaderSelectionCard,
  resetDownloaderSelection,
  resolveDownloaderSelection,
};
