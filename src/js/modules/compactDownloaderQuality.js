import { t } from "./i18n.js";
import { getCachedVideoInfo, setCachedVideoInfo } from "./videoInfoCache.js";
import { getVideoInfo } from "./videoInfoBroker.js";
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
  grid: document.querySelector(".compact-quality-panel__grid"),
  videoField: document
    .getElementById("compact-video-quality")
    ?.closest(".compact-quality-field"),
  audioField: document
    .getElementById("compact-audio-quality")
    ?.closest(".compact-quality-field"),
  videoSelect: document.getElementById("compact-video-quality"),
  audioSelect: document.getElementById("compact-audio-quality"),
  status: document.getElementById("compact-quality-status"),
};

const customSelects = new WeakMap();

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
  elements.shell?.classList.toggle(
    "is-downloader-detailed",
    state.mode === "detailed",
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
  elements.toggleCompact?.classList.toggle("active", state.mode === "compact");
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

function getOptionByValue(selectEl) {
  return Array.from(selectEl?.options || []).find(
    (option) => option.value === selectEl.value,
  );
}

function closeCustomSelect(instance) {
  if (!instance) return;
  instance.root.classList.remove("is-open");
  instance.button.setAttribute("aria-expanded", "false");
}

function closeOtherCustomSelects(current) {
  [elements.videoSelect, elements.audioSelect].forEach((selectEl) => {
    const instance = customSelects.get(selectEl);
    if (instance && instance !== current) closeCustomSelect(instance);
  });
}

function syncCustomSelect(selectEl) {
  const instance = customSelects.get(selectEl);
  if (!instance) return;

  const selectedOption = getOptionByValue(selectEl);
  instance.value.textContent =
    selectedOption?.textContent || t("quality.compact.waiting");
  instance.list.innerHTML = "";

  Array.from(selectEl.options).forEach((option) => {
    const item = document.createElement("button");
    item.type = "button";
    item.className = "compact-quality-menu__option";
    item.dataset.value = option.value;
    item.textContent = option.textContent;
    item.disabled = option.disabled;
    item.setAttribute("role", "option");
    item.setAttribute(
      "aria-selected",
      option.value === selectEl.value ? "true" : "false",
    );
    item.addEventListener("click", () => {
      if (option.disabled) return;
      selectEl.value = option.value;
      selectEl.dispatchEvent(new Event("change", { bubbles: true }));
      closeCustomSelect(instance);
    });
    instance.list.appendChild(item);
  });

  instance.root.classList.toggle("is-empty", selectEl.options.length === 0);
}

function enhanceSelect(selectEl) {
  if (!selectEl || customSelects.has(selectEl)) return;

  const root = document.createElement("div");
  root.className = "compact-quality-menu";

  const button = document.createElement("button");
  button.type = "button";
  button.className = "compact-quality-menu__button";
  button.setAttribute("aria-haspopup", "listbox");
  button.setAttribute("aria-expanded", "false");
  const labelId = selectEl.getAttribute("aria-labelledby");
  const labelText = labelId
    ? document.getElementById(labelId)?.textContent?.trim()
    : "";
  if (labelText) button.setAttribute("aria-label", labelText);

  const value = document.createElement("span");
  value.className = "compact-quality-menu__value";
  button.appendChild(value);

  const list = document.createElement("div");
  list.className = "compact-quality-menu__list";
  list.setAttribute("role", "listbox");

  root.append(button, list);
  selectEl.classList.add("is-enhanced");
  selectEl.tabIndex = -1;
  selectEl.setAttribute("aria-hidden", "true");
  selectEl.insertAdjacentElement("afterend", root);

  const instance = { root, button, value, list };
  customSelects.set(selectEl, instance);

  button.addEventListener("click", () => {
    const shouldOpen = !root.classList.contains("is-open");
    closeOtherCustomSelects(instance);
    root.classList.toggle("is-open", shouldOpen);
    button.setAttribute("aria-expanded", shouldOpen ? "true" : "false");
  });

  button.addEventListener("keydown", (event) => {
    if (event.key === "Escape") {
      closeCustomSelect(instance);
    }
  });

  selectEl.addEventListener("change", () => syncCustomSelect(selectEl));
  syncCustomSelect(selectEl);
}

function setQualityFieldsVisible(visible) {
  [elements.videoField, elements.audioField].forEach((field) => {
    if (!field) return;
    field.hidden = !visible;
    field.setAttribute("aria-hidden", visible ? "false" : "true");
  });
  if (elements.grid) {
    elements.grid.hidden = !visible;
  }
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
  syncCustomSelect(selectEl);
}

function getSelectedOption(options, selectedId) {
  return (
    options.find((option) => option.id === selectedId) || options[0] || null
  );
}

function syncAudioAvailability() {
  const video = getSelectedOption(
    state.videoOptions,
    elements.videoSelect?.value,
  );
  const mp3Options = state.audioOptions.filter(
    (option) => option.source === "mp3",
  );
  const allowAudioOnlyFormats = video?.kind === "none";
  mp3Options.forEach((option) => {
    option.disabled = !allowAudioOnlyFormats;
  });
  const noAudio = state.audioOptions.find((option) => option.id === "no-audio");
  if (noAudio) {
    noAudio.disabled = video?.source !== "video-only";
  }
  renderSelect(
    elements.audioSelect,
    state.audioOptions,
    elements.audioSelect?.value,
  );
  const selectedAudio = getSelectedOption(
    state.audioOptions,
    elements.audioSelect?.value,
  );
  if (selectedAudio?.disabled) {
    const fallback =
      state.audioOptions.find(
        (option) => !option.disabled && option.kind === "audio",
      ) || state.audioOptions.find((option) => !option.disabled);
    if (fallback && elements.audioSelect) {
      elements.audioSelect.value = fallback.id;
      syncCustomSelect(elements.audioSelect);
    }
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
    setQualityFieldsVisible(false);
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
  setQualityFieldsVisible(true);
  selectDefaults();
}

async function ensureCompactQualityReady(url) {
  const normalized = normalizeUrlInput(url).trim();
  const cached = getCachedVideoInfo(normalized);
  if (
    cached?.success &&
    Array.isArray(cached.formats) &&
    cached.formats.length
  ) {
    renderQualityControls(cached, normalized);
    return true;
  }
  if (state.loading) return false;
  state.loading = true;
  setStatus("quality.compact.loading", "muted");
  try {
    const info = await getVideoInfo(normalized);
    if (
      !info?.success ||
      !Array.isArray(info.formats) ||
      !info.formats.length
    ) {
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
  enhanceSelect(elements.videoSelect);
  enhanceSelect(elements.audioSelect);
  setQualityFieldsVisible(false);
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

  document.addEventListener("click", (event) => {
    if (event.target.closest(".compact-quality-menu")) return;
    closeOtherCustomSelects(null);
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
