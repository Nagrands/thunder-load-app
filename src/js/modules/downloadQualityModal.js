// src/js/modules/downloadQualityModal.js

import { showToast } from "./toast.js";
import { setCachedVideoInfo } from "./videoInfoCache.js";
import { t } from "./i18n.js";
import {
  formatDownloadErrorToast,
  getDownloadErrorDetails,
} from "./downloadErrorUi.js";

const INFO_REQUEST_TIMEOUT = 15000;

const modal = document.getElementById("download-quality-modal");
const optionsContainer = document.getElementById("download-quality-options");
const loadingEl = document.getElementById("download-quality-loading");
const optionsPlaceholderEl = document.getElementById(
  "download-quality-options-placeholder",
);
const loadingDetailEl = document.getElementById(
  "download-quality-loading-detail",
);
const emptyEl = document.getElementById("download-quality-empty");
const errorEl = document.getElementById("download-quality-error");
const errorTextEl = errorEl?.querySelector(".quality-error-text");
const retryBtn = document.getElementById("download-quality-retry");
const primaryBtn = document.getElementById("download-quality-primary");
const actionEnqueueBtn = document.getElementById(
  "download-quality-action-enqueue",
);
const cancelBtn = document.getElementById("download-quality-cancel");
const closeBtn = modal?.querySelector("[data-quality-close]");
const tabButtons = Array.from(
  document.querySelectorAll(".quality-tab[data-quality-tab]"),
);
const optionsPanel = document.getElementById("download-quality-options-panel");
const tabCountEls = {
  video: document.getElementById("download-quality-count-video"),
  "video-only": document.getElementById("download-quality-count-video-only"),
  audio: document.getElementById("download-quality-count-audio"),
};
const bestCurrentBtn = document.getElementById("download-quality-best-current");
const thumbEl = document.getElementById("download-quality-thumb");
const titleEl = document.getElementById("download-quality-name");
const uploaderEl = document.getElementById("download-quality-uploader");
const durationEl = document.getElementById("download-quality-duration");
const previewResolutionEl = document.getElementById(
  "download-quality-preview-resolution",
);
const openSourceBtn = document.getElementById("download-quality-open-source");
const copySourceUrlBtn = document.getElementById(
  "download-quality-copy-source",
);
const downloadPreviewBtn = document.getElementById(
  "download-quality-download-preview",
);
const thumbFallbackEl = document.getElementById(
  "download-quality-thumb-fallback",
);
const selectionTitleEl = document.getElementById(
  "download-quality-selection-title",
);
const selectionMetaEl = document.getElementById(
  "download-quality-selection-meta",
);
const selectionOutputEl = document.getElementById(
  "download-quality-selection-output",
);
const selectionSummaryEl = document.getElementById(
  "download-quality-selection-summary",
);

const bytesToSize = (bytes) => {
  if (!bytes || Number(bytes) <= 0) return "";
  const units = ["B", "KB", "MB", "GB"];
  const exponent = Math.min(
    units.length - 1,
    Math.floor(Math.log(bytes) / Math.log(1024)),
  );
  const value = bytes / 1024 ** exponent;
  return `${value.toFixed(value > 9 ? 0 : 1)} ${units[exponent]}`;
};

const secondsToTime = (sec) => {
  const total = Math.max(0, Number(sec) || 0);
  const h = Math.floor(total / 3600);
  const m = Math.floor((total % 3600) / 60);
  const s = Math.floor(total % 60);
  return h > 0
    ? `${h}:${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`
    : `${m}:${String(s).padStart(2, "0")}`;
};

const state = {
  resolver: null,
  currentTab: "video",
  selectedOption: null,
  optionMap: new Map(),
  info: null,
  forceAudio: false,
  defaultQualityProfile: "remember",
  defaultQuality: "Source",
  currentUrl: "",
  currentFetchToken: 0,
  selectedByTab: new Map(),
  expandedOptions: new Set(),
  loadingStartedAt: 0,
  loadingTickTimer: null,
};

const extractHeight = (fmt) => {
  if (fmt?.height) return Number(fmt.height) || 0;
  const res =
    fmt?.resolution || fmt?.format_note || fmt?.quality || fmt?.format || "";
  const m1 = String(res).match(/(\d{3,4})[pP]/);
  if (m1) return Number(m1[1]) || 0;
  const m2 = String(res).match(/x(\d{3,4})/);
  if (m2) return Number(m2[1]) || 0;
  return 0;
};

const sortScore = (fmt) => {
  let score = 0;
  if (fmt?.downloader_options?.http_chunk_size) score -= 0.5;
  if (Array.isArray(fmt?.downloader_options?.http_headers)) {
    const host = fmt.downloader_options.http_headers
      .map((h) => h.value || "")
      .find((val) => /GoogleAccounts|cookie/i.test(val));
    if (host) score -= 1;
  }
  if (fmt.fragment_base_url && state.info?.webpage_url) {
    if (!fmt.fragment_base_url.includes(state.info.webpage_url)) {
      score -= 0.5;
    }
  }
  const realHeight = extractHeight(fmt);
  const fps = Number(fmt?.fps || 0);
  const tbr = Number(fmt?.tbr || fmt?.vbr || 0);
  const abr = Number(fmt?.abr || 0);
  score += realHeight * 2;
  score += fps * 0.5;
  score += (tbr + abr) / 50;
  return score;
};

function setModalOpen(flag) {
  if (!modal) return;
  modal.classList.toggle("is-open", flag);
  modal.setAttribute("aria-hidden", flag ? "false" : "true");
  document.body.classList.toggle("modal-scroll-lock", flag);
}

function escapeHTML(value) {
  return String(value || "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}

function getSortedOptions(tab) {
  return (state.optionMap.get(tab) || [])
    .slice()
    .sort((a, b) => (b.score || 0) - (a.score || 0));
}

function updateTabCounts() {
  Object.entries(tabCountEls).forEach(([tab, el]) => {
    if (!el) return;
    el.textContent = String((state.optionMap.get(tab) || []).length || 0);
  });
}

function updateSelectionSummary(option) {
  if (!selectionTitleEl || !selectionMetaEl) return;
  if (!option) {
    selectionTitleEl.textContent = t("quality.notSelected");
    selectionMetaEl.textContent = t("quality.selectHint");
    if (selectionOutputEl) {
      selectionOutputEl.textContent = t("quality.resultPlaceholder");
    }
    return;
  }
  selectionTitleEl.textContent =
    option.payload?.label || option.title || t("quality.selected");
  selectionMetaEl.textContent =
    option.description ||
    [option.extLabel, option.sizeLabel].filter(Boolean).join(" • ");
  if (selectionOutputEl) {
    selectionOutputEl.textContent = t("quality.resultSummary", {
      container: option.containerLabel || "—",
      quality: option.title || option.payload?.label || "—",
      size: option.sizeLabel || "—",
    });
  }
}

function restoreSelectionForTab(tab) {
  const sorted = getSortedOptions(tab);
  if (!sorted.length) {
    selectOption(null, { remember: false });
    return false;
  }
  const rememberedId = state.selectedByTab.get(tab);
  const remembered = rememberedId
    ? sorted.find((option) => option.id === rememberedId)
    : null;
  selectOption(remembered || sorted[0], { remember: true });
  return true;
}

function resetModalState() {
  state.selectedOption = null;
  state.optionMap.clear();
  state.selectedByTab.clear();
  state.expandedOptions.clear();
  optionsContainer.innerHTML = "";
  if (primaryBtn) {
    primaryBtn.disabled = true;
    primaryBtn.textContent = t("quality.split.primaryDisabledHint");
  }
  if (actionEnqueueBtn) actionEnqueueBtn.disabled = true;
  emptyEl?.classList.add("hidden");
  errorEl?.classList.add("hidden");
  optionsPlaceholderEl?.classList.add("hidden");
  clearLoadingTimer();
  optionsContainer?.setAttribute("aria-busy", "false");
  if (downloadPreviewBtn) {
    downloadPreviewBtn.disabled = true;
    downloadPreviewBtn.onclick = null;
  }
  if (copySourceUrlBtn) {
    copySourceUrlBtn.disabled = true;
    copySourceUrlBtn.onclick = null;
  }
  if (openSourceBtn) {
    openSourceBtn.disabled = true;
    openSourceBtn.onclick = null;
  }
  if (previewResolutionEl) {
    previewResolutionEl.textContent = t("quality.previewResolutionUnknown");
  }
  if (thumbEl) {
    thumbEl.onload = null;
    thumbEl.onerror = null;
  }
  thumbFallbackEl?.classList.add("hidden");
  updateTabCounts();
  updateSelectionSummary(null);
}

function clearLoadingTimer() {
  if (state.loadingTickTimer) {
    clearInterval(state.loadingTickTimer);
    state.loadingTickTimer = null;
  }
}

function updateLoadingDetail() {
  if (!loadingDetailEl) return;
  const elapsed = Math.max(
    0,
    Math.floor((Date.now() - (state.loadingStartedAt || Date.now())) / 1000),
  );
  loadingDetailEl.textContent = t("quality.loading.detailTimed", {
    seconds: elapsed,
  });
}

function syncLoadingUi(isLoading) {
  selectionSummaryEl?.classList.toggle("hidden", isLoading);
  openSourceBtn?.classList.toggle("hidden", isLoading);
  copySourceUrlBtn?.classList.toggle("hidden", isLoading);
  downloadPreviewBtn?.classList.toggle("hidden", isLoading);
  const hasOption = !!state.selectedOption;
  const disableActions = isLoading || !hasOption;
  if (primaryBtn) primaryBtn.disabled = disableActions;
  if (actionEnqueueBtn) actionEnqueueBtn.disabled = disableActions;
}

function setLoading(flag) {
  if (flag) {
    loadingEl?.classList.remove("hidden");
    optionsPlaceholderEl?.classList.remove("hidden");
    state.loadingStartedAt = Date.now();
    updateLoadingDetail();
    clearLoadingTimer();
    state.loadingTickTimer = setInterval(updateLoadingDetail, 1000);
    optionsContainer?.setAttribute("aria-busy", "true");
  } else {
    loadingEl?.classList.add("hidden");
    optionsPlaceholderEl?.classList.add("hidden");
    clearLoadingTimer();
    optionsContainer?.setAttribute("aria-busy", "false");
  }
  syncLoadingUi(flag);
}

function beginFetchView() {
  setLoading(true);
  errorEl?.classList.add("hidden");
  emptyEl?.classList.add("hidden");
  optionsContainer.innerHTML = "";
  if (primaryBtn) primaryBtn.disabled = true;
  if (actionEnqueueBtn) actionEnqueueBtn.disabled = true;
  if (bestCurrentBtn) bestCurrentBtn.disabled = true;
  updateTabCounts();
  updateSelectionSummary(null);
}

function showError(message) {
  if (!errorEl) return;
  setLoading(false);
  optionsContainer.innerHTML = "";
  errorEl.classList.remove("hidden");
  emptyEl?.classList.add("hidden");
  optionsPlaceholderEl?.classList.add("hidden");
  if (primaryBtn) primaryBtn.disabled = true;
  if (actionEnqueueBtn) actionEnqueueBtn.disabled = true;
  if (bestCurrentBtn) bestCurrentBtn.disabled = true;
  if (errorTextEl) {
    errorTextEl.textContent = message || t("quality.error");
  }
  updateSelectionSummary(null);
}

function showEmpty() {
  emptyEl?.classList.remove("hidden");
  optionsPlaceholderEl?.classList.add("hidden");
  optionsContainer.innerHTML = "";
  if (primaryBtn) primaryBtn.disabled = true;
  if (actionEnqueueBtn) actionEnqueueBtn.disabled = true;
  if (bestCurrentBtn) bestCurrentBtn.disabled = true;
  updateSelectionSummary(null);
}

function withTimeout(promise, ms) {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => {
      reject(new Error("timeout"));
    }, ms);
    promise
      .then((res) => {
        clearTimeout(timer);
        resolve(res);
      })
      .catch((err) => {
        clearTimeout(timer);
        reject(err);
      });
  });
}

function sanitizeFilename(value) {
  const base = String(value || "")
    .replace(/[\\/:*?"<>|]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
  return base.length ? base.slice(0, 80) : "preview";
}

function detectPreviewExt(source, blob) {
  const typeExt = {
    "image/jpeg": "jpg",
    "image/png": "png",
    "image/webp": "webp",
    "image/gif": "gif",
  }[blob?.type || ""];
  if (typeExt) return typeExt;
  try {
    const parsed = new URL(source);
    const match = parsed.pathname.match(/\.([a-z0-9]{2,5})$/i);
    if (match?.[1]) return match[1].toLowerCase();
  } catch {}
  return "jpg";
}

function getPreviewData(info = {}) {
  const directUrl = String(info?.thumbnail || "").trim();
  const directWidth = Number(info?.thumbnail_width || 0);
  const directHeight = Number(info?.thumbnail_height || 0);
  const thumbs = (Array.isArray(info?.thumbnails) ? info.thumbnails : [])
    .map((thumb) => ({
      url: String(thumb?.url || "").trim(),
      width: Number(thumb?.width || 0),
      height: Number(thumb?.height || 0),
    }))
    .filter((thumb) => !!thumb.url)
    .sort((a, b) => {
      const areaA = (a.width || 0) * (a.height || 0);
      const areaB = (b.width || 0) * (b.height || 0);
      return areaB - areaA;
    });

  if (directUrl) {
    const matched = thumbs.find((thumb) => thumb.url === directUrl);
    return {
      url: directUrl,
      width: directWidth || matched?.width || 0,
      height: directHeight || matched?.height || 0,
    };
  }

  if (thumbs.length) return thumbs[0];

  return {
    url: "",
    width: directWidth || 0,
    height: directHeight || 0,
  };
}

async function copyTextToClipboard(value) {
  const text = String(value || "");
  if (!text) throw new Error("empty");
  if (navigator?.clipboard?.writeText) {
    await navigator.clipboard.writeText(text);
    return;
  }
  const area = document.createElement("textarea");
  area.value = text;
  area.setAttribute("readonly", "");
  area.style.position = "fixed";
  area.style.opacity = "0";
  document.body.appendChild(area);
  area.select();
  const success = document.execCommand("copy");
  area.remove();
  if (!success) throw new Error("copy_failed");
}

async function downloadPreviewImage(sourceUrl, title) {
  if (!sourceUrl) return;
  try {
    const response = await fetch(sourceUrl, { cache: "no-cache" });
    if (!response.ok) throw new Error(`status-${response.status}`);
    const blob = await response.blob();
    const objectUrl = URL.createObjectURL(blob);
    const anchor = document.createElement("a");
    const ext = detectPreviewExt(sourceUrl, blob);
    anchor.href = objectUrl;
    anchor.download = `${sanitizeFilename(title)}.${ext}`;
    document.body.appendChild(anchor);
    anchor.click();
    anchor.remove();
    setTimeout(() => URL.revokeObjectURL(objectUrl), 2000);
    showToast(t("history.toast.previewSaved"), "success");
  } catch (error) {
    console.error("Не удалось скачать превью:", error);
    showToast(t("history.toast.previewDownloadError"), "error");
  }
}

function renderPreview(info, url) {
  if (!info) return;
  try {
    setCachedVideoInfo(info.webpage_url || info.original_url || url, info);
  } catch (_) {}
  titleEl.textContent = info.title || t("quality.previewUnavailable");
  uploaderEl.textContent = info.uploader || info.channel || "";
  durationEl.textContent = info.duration
    ? t("input.url.preview.duration", { duration: secondsToTime(info.duration) })
    : "";
  const preview = getPreviewData(info);
  const previewResolution =
    preview.width > 0 && preview.height > 0
      ? `${preview.width}x${preview.height}`
      : "";
  if (previewResolutionEl) {
    previewResolutionEl.textContent = previewResolution
      ? t("quality.previewResolution", { resolution: previewResolution })
      : t("quality.previewResolutionUnknown");
  }
  if (preview.url) {
    thumbEl.src = preview.url;
    thumbEl.style.display = "";
    thumbFallbackEl?.classList.add("hidden");
    thumbEl.onload = () => {
      thumbEl.style.display = "";
      thumbFallbackEl?.classList.add("hidden");
      if (
        previewResolutionEl &&
        (!preview.width || !preview.height) &&
        thumbEl.naturalWidth > 0 &&
        thumbEl.naturalHeight > 0
      ) {
        previewResolutionEl.textContent = t("quality.previewResolution", {
          resolution: `${thumbEl.naturalWidth}x${thumbEl.naturalHeight}`,
        });
      }
    };
    thumbEl.onerror = () => {
      thumbEl.style.display = "none";
      thumbFallbackEl?.classList.remove("hidden");
    };
  } else {
    thumbEl.removeAttribute("src");
    thumbEl.style.display = "none";
    thumbFallbackEl?.classList.remove("hidden");
  }
  if (downloadPreviewBtn) {
    const previewUrl = preview.url || "";
    downloadPreviewBtn.disabled = !previewUrl;
    downloadPreviewBtn.onclick = () => {
      if (!previewUrl) return;
      downloadPreviewImage(previewUrl, info.title || "preview");
    };
  }
  const targetUrl =
    info.webpage_url || info.original_url || info.url || url || "";
  if (openSourceBtn) {
    openSourceBtn.disabled = !targetUrl;
    openSourceBtn.onclick = () => {
      if (!targetUrl) return;
      window.electron.invoke("open-external-link", targetUrl).catch((err) => {
        console.error("Не удалось открыть источник:", err);
        showToast(t("quality.openSourceError"), "error");
      });
    };
  }
  if (copySourceUrlBtn) {
    copySourceUrlBtn.disabled = !targetUrl;
    copySourceUrlBtn.onclick = async () => {
      if (!targetUrl) return;
      try {
        await copyTextToClipboard(targetUrl);
        showToast(t("quality.copySourceUrlSuccess"), "success");
      } catch (err) {
        console.error("Не удалось скопировать URL источника:", err);
        showToast(t("quality.copySourceUrlError"), "error");
      }
    };
  }
}

function describeFormat(format) {
  const parts = [];
  if (format.height) parts.push(`${format.height}p`);
  else if (format.format_note) parts.push(format.format_note);
  if (format.fps) parts.push(`${format.fps}fps`);
  if (format.vcodec && format.vcodec !== "none")
    parts.push(format.vcodec.replace(/^avc1\./, "h.264"));
  if (format.acodec && format.acodec !== "none")
    parts.push(format.acodec.replace(/^mp4a\./, "aac"));
  return parts.join(" • ").trim();
}

function describeOption(option) {
  if (!option) return "";
  const bitrate = option.audioBitrateLabel || "";
  switch (option.payload?.type) {
    case "muxed":
      return t("quality.desc.muxed");
    case "pair":
      return bitrate
        ? `${t("quality.desc.pair")} • ${t("quality.metric.bitrate")}: ${bitrate}`
        : t("quality.desc.pair");
    case "video-only":
      return t("quality.desc.videoOnly");
    case "audio-only":
      return bitrate
        ? `${t("quality.desc.audioOnly")} • ${t("quality.metric.bitrate")}: ${bitrate}`
        : t("quality.desc.audioOnly");
    default:
      return option.description || "";
  }
}

function codecLabel(fmt) {
  const vcodec = fmt?.vcodec && fmt.vcodec !== "none" ? fmt.vcodec : "";
  const acodec = fmt?.acodec && fmt.acodec !== "none" ? fmt.acodec : "";
  if (vcodec && acodec) return `${vcodec} + ${acodec}`;
  return vcodec || acodec || "—";
}

function collectFormats(info) {
  const formats = Array.isArray(info?.formats) ? info.formats : [];
  const muxed = [];
  const videoOnly = [];
  const audioOnly = [];

  formats.forEach((fmt) => {
    if (fmt.vcodec !== "none" && fmt.acodec !== "none") muxed.push(fmt);
    else if (fmt.vcodec !== "none" && fmt.acodec === "none")
      videoOnly.push(fmt);
    else if (fmt.vcodec === "none" && fmt.acodec !== "none")
      audioOnly.push(fmt);
  });

  const sorted = (arr, getter) =>
    arr
      .slice()
      .sort((a, b) => (getter(b) || 0) - (getter(a) || 0))
      .filter((fmt) => !!fmt.format_id);

  const muxedSorted = muxed
    .map((fmt) => ({ fmt, score: sortScore(fmt) }))
    .sort((a, b) => b.score - a.score)
    .map((entry) => entry.fmt);

  return {
    muxed: muxedSorted.length
      ? muxedSorted
      : sorted(videoOnly, (f) => f.height || f.tbr),
    videoOnly: sorted(videoOnly, (f) => f.height || f.tbr),
    audioOnly: sorted(audioOnly, (f) => f.abr || f.tbr),
  };
}

function buildOptionPayload({
  type,
  label,
  videoFormat,
  audioFormat,
  videoExt,
  audioExt,
  resolution,
  fps,
  isMuxed,
}) {
  return {
    type,
    label,
    videoFormatId: videoFormat || null,
    audioFormatId: audioFormat || null,
    videoExt: videoExt || null,
    audioExt: audioExt || null,
    resolution: resolution || "",
    fps: fps || null,
    isMuxed: !!isMuxed,
  };
}

function formatOptionData(fmt, overrides = {}) {
  const resolution =
    overrides.resolution ||
    fmt.resolution ||
    (fmt.height ? `${fmt.height}p` : "");
  const fps = overrides.fps || fmt.fps || null;
  const videoExt = overrides.videoExt || fmt.ext || null;
  return { resolution, fps, videoExt };
}

function buildOptions(info) {
  const { muxed, videoOnly, audioOnly } = collectFormats(
    info,
    info?.webpage_url || info?.original_url,
  );
  const bestAudio = audioOnly[0] || null;
  const optionGroups = {
    video: [],
    "video-only": [],
    audio: [],
  };

  muxed.forEach((fmt) => {
    const { resolution, fps, videoExt } = formatOptionData(fmt);
    optionGroups.video.push({
      id: `muxed-${fmt.format_id}`,
      tab: "video",
      title: resolution || fmt.format_note || fmt.format_id,
      description: describeFormat(fmt),
      extLabel: (videoExt || fmt.ext || "").toUpperCase(),
      sizeLabel: bytesToSize(fmt.filesize || fmt.filesize_approx),
      extra: fmt.dynamic_range ? fmt.dynamic_range.toUpperCase() : "",
      resolutionLabel: resolution || "—",
      fpsLabel: fps ? `${fps}` : "—",
      codecLabel: codecLabel(fmt),
      containerLabel: (videoExt || fmt.ext || "").toUpperCase() || "—",
      audioBitrateLabel: fmt?.abr ? `${fmt.abr} kbps` : "",
      score: sortScore(fmt) + 10, // бонус за готовое muxed-видео
      payload: buildOptionPayload({
        type: "muxed",
        label: resolution || fmt.format_note || t("quality.label.video"),
        videoFormat: fmt.format_id,
        audioFormat: null,
        videoExt,
        audioExt: null,
        resolution,
        fps,
        isMuxed: true,
      }),
    });
  });

  videoOnly.forEach((fmt) => {
    const { resolution, fps, videoExt } = formatOptionData(fmt);
    const hasAudioPair = !!bestAudio;
    optionGroups.video.push({
      id: `pair-${fmt.format_id}`,
      tab: "video",
      title: resolution || fmt.format_note || fmt.format_id,
      description: `${describeFormat(fmt)} • ${t("quality.label.audio").toLowerCase()}: ${
        bestAudio?.abr ? `${bestAudio.abr}kbps` : t("quality.extra.noAudio")
      }`,
      extLabel: (videoExt || "mp4").toUpperCase(),
      sizeLabel: bytesToSize(
        (fmt.filesize || fmt.filesize_approx || 0) +
          (bestAudio?.filesize || bestAudio?.filesize_approx || 0),
      ),
      extra: hasAudioPair
        ? t("quality.extra.bestAudio")
        : t("quality.extra.noAudio"),
      resolutionLabel: resolution || "—",
      fpsLabel: fps ? `${fps}` : "—",
      codecLabel: codecLabel(fmt),
      containerLabel: (videoExt || "mp4").toUpperCase(),
      audioBitrateLabel: bestAudio?.abr ? `${bestAudio.abr} kbps` : "",
      score: sortScore(fmt) + (hasAudioPair ? 5 : 0),
      payload: buildOptionPayload({
        type: "pair",
        label: hasAudioPair
          ? t("quality.label.videoWithAudio", {
              label: resolution || t("quality.label.video"),
            })
          : `${resolution || t("quality.label.video")}`,
        videoFormat: fmt.format_id,
        audioFormat: bestAudio?.format_id || null,
        videoExt,
        audioExt: bestAudio?.ext || null,
        resolution,
        fps,
      }),
    });

    optionGroups["video-only"].push({
      id: `video-only-${fmt.format_id}`,
      tab: "video-only",
      title: resolution || fmt.format_note || fmt.format_id,
      description: describeFormat(fmt),
      extLabel: (videoExt || "mp4").toUpperCase(),
      sizeLabel: bytesToSize(fmt.filesize || fmt.filesize_approx),
      extra: t("quality.extra.noAudio"),
      resolutionLabel: resolution || "—",
      fpsLabel: fps ? `${fps}` : "—",
      codecLabel: codecLabel(fmt),
      containerLabel: (videoExt || "mp4").toUpperCase(),
      audioBitrateLabel: "",
      score: sortScore(fmt),
      payload: buildOptionPayload({
        type: "video-only",
        label: t("quality.label.videoNoAudio", {
          label: resolution || t("quality.label.video"),
        }),
        videoFormat: fmt.format_id,
        audioFormat: null,
        videoExt,
        audioExt: null,
        resolution,
        fps,
      }),
    });
  });

  audioOnly.forEach((fmt) => {
    const size = bytesToSize(fmt.filesize || fmt.filesize_approx);
    optionGroups.audio.push({
      id: `audio-${fmt.format_id}`,
      tab: "audio",
      title: fmt.format_note || `${fmt.abr || fmt.tbr || 0}kbps`,
      description: `${(fmt.acodec || "").toUpperCase()} • ${
        fmt.abr || fmt.tbr || "?"
      } kbps`,
      extLabel: (fmt.ext || "m4a").toUpperCase(),
      sizeLabel: size,
      extra: "",
      resolutionLabel: t("quality.label.audio"),
      fpsLabel: "—",
      codecLabel: codecLabel(fmt),
      containerLabel: (fmt.ext || "m4a").toUpperCase(),
      audioBitrateLabel: `${fmt.abr || fmt.tbr || "?"} kbps`,
      score: (fmt.abr || fmt.tbr || 0) / 10,
      payload: buildOptionPayload({
        type: "audio-only",
        label: fmt.format_note || t("quality.label.audio"),
        videoFormat: null,
        audioFormat: fmt.format_id,
        videoExt: null,
        audioExt: fmt.ext || "m4a",
        resolution: fmt.format_note || "audio",
        fps: null,
      }),
    });
  });

  return optionGroups;
}

function renderOptions(tab) {
  const list = getSortedOptions(tab);
  optionsContainer.innerHTML = "";
  if (list.length === 0) {
    emptyEl?.classList.remove("hidden");
    if (bestCurrentBtn) bestCurrentBtn.disabled = true;
    return;
  }
  emptyEl?.classList.add("hidden");
  if (bestCurrentBtn) bestCurrentBtn.disabled = false;
  const frag = document.createDocumentFragment();
  list.forEach((option, index) => {
    const isExpanded = state.expandedOptions.has(option.id);
    const compactMeta = [
      option.containerLabel && option.containerLabel !== "—"
        ? option.containerLabel
        : "",
      option.sizeLabel || "",
      option.audioBitrateLabel || "",
    ]
      .filter(Boolean)
      .join(" • ");
    const metrics = [];
    if (option.resolutionLabel && option.resolutionLabel !== "Audio") {
      metrics.push([
        t("quality.metric.resolution"),
        escapeHTML(option.resolutionLabel),
      ]);
    }
    if (option.fpsLabel && option.fpsLabel !== "—") {
      metrics.push([t("quality.metric.fps"), escapeHTML(option.fpsLabel)]);
    }
    if (option.codecLabel && option.codecLabel !== "—") {
      metrics.push([t("quality.metric.codec"), escapeHTML(option.codecLabel)]);
    }
    if (option.audioBitrateLabel) {
      metrics.push([
        t("quality.metric.bitrate"),
        escapeHTML(option.audioBitrateLabel),
      ]);
    }
    if (option.sizeLabel) {
      metrics.push([t("quality.metric.size"), escapeHTML(option.sizeLabel)]);
    }
    if (option.containerLabel && option.containerLabel !== "—") {
      metrics.push([
        t("quality.metric.container"),
        escapeHTML(option.containerLabel),
      ]);
    }

    const tags = [];
    if (index === 0) tags.push('<span class="tag tag-top">TOP</span>');
    if (option.extra) {
      tags.push(
        `<span class="tag tag-accent">${escapeHTML(option.extra)}</span>`,
      );
    }
    const tagsMarkup = tags.length
      ? `<div class="quality-option-tags">${tags.join("")}</div>`
      : '<div class="quality-option-tags quality-option-tags-empty" aria-hidden="true"></div>';

    const el = document.createElement("div");
    el.className = "quality-option";
    el.dataset.optionId = option.id;
    el.id = `quality-option-${option.id}`;
    el.setAttribute("role", "radio");
    el.setAttribute("aria-checked", "false");
    el.setAttribute(
      "aria-label",
      `${option.title || ""}. ${option.codecLabel || ""}. ${option.sizeLabel || ""}`,
    );
    el.setAttribute("aria-describedby", `quality-option-desc-${option.id}`);
    el.innerHTML = `
      <div class="quality-option-main">
        <div class="quality-option-content">
          <div class="quality-option-head">
            <p class="quality-option-title">${escapeHTML(option.title)}</p>
            ${tagsMarkup}
          </div>
          <p class="quality-option-desc" id="quality-option-desc-${option.id}">${escapeHTML(
            describeOption(option),
          )}</p>
          ${
            compactMeta
              ? `<p class="quality-option-meta">${escapeHTML(compactMeta)}</p>`
              : ""
          }
          <div class="quality-option-metrics ${isExpanded ? "" : "is-collapsed"}" aria-hidden="${isExpanded ? "false" : "true"}">
            ${metrics
              .map(
                ([label, value]) =>
                  `<span class="metric"><strong>${label}:</strong> ${value}</span>`,
              )
              .join("")}
          </div>
          <button type="button" class="quality-option-toggle" data-quality-toggle="metrics" aria-label="${escapeHTML(
            t("quality.metrics.aria"),
          )}" aria-expanded="${isExpanded ? "true" : "false"}">
            ${escapeHTML(
              isExpanded
                ? t("quality.metrics.collapse")
                : t("quality.metrics.expand"),
            )}
          </button>
        </div>
      </div>
    `;
    frag.appendChild(el);
  });
  optionsContainer.appendChild(frag);
}

function selectOption(option, { remember = true } = {}) {
  state.selectedOption = option;
  if (remember) {
    if (option?.id) state.selectedByTab.set(state.currentTab, option.id);
    else state.selectedByTab.delete(state.currentTab);
  }
  const hasOption = !!option;
  if (primaryBtn) primaryBtn.disabled = !hasOption;
  if (actionEnqueueBtn) actionEnqueueBtn.disabled = !hasOption;
  if (option) {
    if (primaryBtn) {
      primaryBtn.textContent = t("quality.confirmWithLabel", {
        label: option.payload.label,
      });
    }
  } else {
    if (primaryBtn) {
      primaryBtn.textContent = t("quality.split.primaryDisabledHint");
    }
  }
  Array.from(optionsContainer.children).forEach((el) => {
    const isActive = el.dataset.optionId === option?.id;
    el.classList.toggle("active", isActive);
    el.setAttribute("aria-checked", String(isActive));
    el.tabIndex = isActive ? 0 : -1;
  });
  if (option) {
    optionsContainer.setAttribute(
      "aria-activedescendant",
      `quality-option-${option.id}`,
    );
  } else {
    optionsContainer.removeAttribute("aria-activedescendant");
  }
  updateSelectionSummary(option);
}

function handleOptionClick(event) {
  const optionEl = event.target.closest(".quality-option");
  if (!optionEl) return;
  const toggleBtn = event.target.closest("[data-quality-toggle='metrics']");
  if (toggleBtn) {
    const optionId = optionEl.dataset.optionId;
    if (!optionId) return;
    if (state.expandedOptions.has(optionId)) {
      state.expandedOptions.delete(optionId);
    } else {
      state.expandedOptions.add(optionId);
    }
    renderOptions(state.currentTab);
    selectOption(state.selectedOption, { remember: false });
    return;
  }
  const options = state.optionMap.get(state.currentTab) || [];
  const option = options.find((opt) => opt.id === optionEl.dataset.optionId);
  if (!option) return;
  selectOption(option);
  if (event.detail >= 2) {
    confirmSelection();
  }
}

async function loadFormatsWithRetry(
  url,
  { preferredLabel = null, force = false } = {},
) {
  if (!url) {
    showError(t("quality.error.urlUnavailable"));
    return false;
  }
  if (!force && state.optionMap.size > 0 && state.currentUrl === url) {
    return true;
  }

  const token = Date.now();
  state.currentFetchToken = token;
  state.currentUrl = url;

  beginFetchView();

  try {
    const info = await withTimeout(
      window.electron.ipcRenderer.invoke("get-video-info", url),
      INFO_REQUEST_TIMEOUT,
    );
    if (!info || info.success === false) {
      throw (
        info || {
          success: false,
          error: t("quality.error"),
        }
      );
    }
    if (state.currentFetchToken !== token) return false;

    state.info = info;
    renderPreview(info, url);
    const groups = buildOptions(info);
    state.optionMap = new Map(Object.entries(groups));
    updateTabCounts();

    const totalOptions = Array.from(state.optionMap.values()).reduce(
      (acc, list) => acc + ((list || []).length || 0),
      0,
    );

    setLoading(false);

    if (totalOptions === 0) {
      showEmpty();
      return false;
    }

    const targetTab = state.forceAudio ? "audio" : "video";
    setActiveTab(targetTab);
    let picked = false;
    if (preferredLabel) {
      picked = selectByPreferredLabel(preferredLabel);
    }

    if (!picked) {
      const audioProfileSelected =
        state.defaultQualityProfile === "audio" ||
        state.defaultQuality === "Audio Only";
      if (state.forceAudio || audioProfileSelected) {
        const audioSelected = selectBestFromTab("audio");
        if (!audioSelected) {
          showToast(t("quality.audioUnavailable"), "warning");
          selectBestVideoOption();
        } else if (state.forceAudio) {
          confirmSelection();
        }
      } else {
        if (!selectBestVideoOption() && !selectBestFromTab("video-only")) {
          selectBestFromTab("audio");
        }
      }
    }
    return true;
  } catch (error) {
    if (state.currentFetchToken !== token) return false;
    const errorDetails = getDownloadErrorDetails(error);
    if (errorDetails.code === "UNKNOWN") {
      console.warn("Неожиданная ошибка получения форматов:", error);
    }
    const message = formatDownloadErrorToast(error);
    showError(message);
    showToast(message, "error");
    return false;
  } finally {
    if (state.currentFetchToken === token) setLoading(false);
  }
}

function setActiveTab(tab) {
  state.currentTab = tab;
  let activeTabId = "";
  tabButtons.forEach((btn) => {
    const active = btn.dataset.qualityTab === tab;
    btn.classList.toggle("active", active);
    btn.setAttribute("aria-selected", String(active));
    btn.tabIndex = active ? 0 : -1;
    if (active) activeTabId = btn.id || "";
  });
  if (optionsPanel && activeTabId) {
    optionsPanel.setAttribute("aria-labelledby", activeTabId);
  }
  renderOptions(tab);
  restoreSelectionForTab(tab);
}

function selectBestFromTab(tab) {
  const list = getSortedOptions(tab);
  if (!list.length) return false;
  const best = list[0];
  if (state.currentTab !== tab) setActiveTab(tab);
  selectOption(best);
  return true;
}

function selectBestVideoOption(showWarning = false) {
  const ok = selectBestFromTab("video");
  if (!ok && showWarning) {
    showToast(t("quality.videoUnavailable"), "warning");
  }
  return ok;
}

function selectByPreferredLabel(label) {
  if (!label) return false;
  const tabs = ["video", "video-only", "audio"];
  for (const tab of tabs) {
    const options = state.optionMap.get(tab) || [];
    const match = options.find(
      (opt) =>
        opt?.payload?.label === label ||
        opt?.title === label ||
        opt?.payload?.resolution === label,
    );
    if (match) {
      setActiveTab(tab);
      selectOption(match);
      return true;
    }
  }
  return false;
}

function moveSelection(step) {
  const options = getSortedOptions(state.currentTab);
  if (!options.length) return;
  const currentId = state.selectedOption?.id;
  const currentIndex = Math.max(
    0,
    options.findIndex((option) => option.id === currentId),
  );
  const nextIndex =
    currentId == null
      ? 0
      : (currentIndex + step + options.length) % options.length;
  selectOption(options[nextIndex]);
}

function closeModal(result = null) {
  setModalOpen(false);
  resetModalState();
  tabButtons.forEach((btn) => btn.classList.remove("active"));
  tabButtons.forEach((btn) => btn.setAttribute("aria-selected", "false"));
  tabButtons.forEach((btn) => (btn.tabIndex = -1));
  const defaultTab = tabButtons.find(
    (btn) => btn.dataset.qualityTab === "video",
  );
  defaultTab?.classList.add("active");
  defaultTab?.setAttribute("aria-selected", "true");
  if (defaultTab) defaultTab.tabIndex = 0;
  if (optionsPanel && defaultTab?.id) {
    optionsPanel.setAttribute("aria-labelledby", defaultTab.id);
  }
  if (state.resolver) {
    state.resolver(result);
    state.resolver = null;
  }
}

function confirmSelection() {
  if (!state.selectedOption) return;
  console.log("[quality]", "confirm-download", {
    label: state.selectedOption?.payload?.label || "",
  });
  closeModal(state.selectedOption.payload);
}

function confirmEnqueue() {
  if (!state.selectedOption) return;
  console.log("[quality]", "confirm-enqueue", {
    label: state.selectedOption?.payload?.label || "",
  });
  setTimeout(() => {
    closeModal({ payload: state.selectedOption.payload, enqueue: true });
  }, 120);
}

function bindEvents() {
  if (!modal.dataset.listenerAttached) {
    optionsContainer.addEventListener("click", handleOptionClick);
    cancelBtn?.addEventListener("click", () => closeModal(null));
    closeBtn?.addEventListener("click", () => closeModal(null));
    tabButtons.forEach((btn) =>
      btn.addEventListener("click", () => {
        const tab = btn.dataset.qualityTab;
        if (tab) setActiveTab(tab);
      }),
    );
    tabButtons.forEach((btn) =>
      btn.addEventListener("keydown", (event) => {
        if (event.key !== "ArrowLeft" && event.key !== "ArrowRight") return;
        event.preventDefault();
        const index = tabButtons.indexOf(btn);
        if (index < 0) return;
        const step = event.key === "ArrowRight" ? 1 : -1;
        const nextIndex =
          (index + step + tabButtons.length) % tabButtons.length;
        const nextBtn = tabButtons[nextIndex];
        if (!nextBtn) return;
        const tab = nextBtn.dataset.qualityTab;
        if (tab) setActiveTab(tab);
        nextBtn.focus();
      }),
    );
    actionEnqueueBtn?.addEventListener("click", () => {
      confirmEnqueue();
    });
    modal.addEventListener("click", (event) => {
      if (event.target?.closest?.("[data-quality-close]")) {
        event.preventDefault();
        closeModal(null);
        return;
      }
      if (event.target === modal) closeModal(null);
    });
    document.addEventListener("keydown", (event) => {
      if (!modal.classList.contains("is-open")) return;
      const target = event.target;
      const targetTag = String(target?.tagName || "").toLowerCase();
      const isEditableTarget =
        target?.isContentEditable ||
        targetTag === "input" ||
        targetTag === "textarea" ||
        targetTag === "select";
      if (event.key === "Escape") {
        event.preventDefault();
        closeModal(null);
        return;
      }
      if (event.key === "ArrowDown") {
        event.preventDefault();
        moveSelection(1);
        return;
      }
      if (event.key === "ArrowUp") {
        event.preventDefault();
        moveSelection(-1);
        return;
      }
      if (
        event.key === "Enter" &&
        state.selectedOption
      ) {
        event.preventDefault();
        confirmSelection();
        return;
      }
      if (
        !isEditableTarget &&
        !event.ctrlKey &&
        !event.metaKey &&
        !event.altKey &&
        event.key.toLowerCase() === "a" &&
        state.selectedOption &&
        !actionEnqueueBtn?.disabled
      ) {
        event.preventDefault();
        confirmEnqueue();
      }
    });
    primaryBtn?.addEventListener("click", confirmSelection);
    bestCurrentBtn?.addEventListener("click", () => {
      if (bestCurrentBtn.disabled) return;
      selectBestFromTab(state.currentTab);
    });
    retryBtn?.addEventListener("click", () => {
      if (!state.currentUrl) return;
      loadFormatsWithRetry(state.currentUrl, { force: true });
    });
    modal.dataset.listenerAttached = "1";
  }
}

async function openDownloadQualityModal(url, opts = {}) {
  if (!modal) {
    showToast(t("quality.openError"), "error");
    return null;
  }
  bindEvents();
  state.forceAudio = !!opts.forceAudioOnly;
  state.defaultQualityProfile =
    opts.defaultQualityProfile === "audio" ? "audio" : "remember";
  state.defaultQuality = opts.presetQuality || "Source";
  state.currentUrl = url;
  setModalOpen(true);
  setLoading(true);
  if (bestCurrentBtn) bestCurrentBtn.disabled = true;
  resetModalState();
  return new Promise(async (resolve) => {
    state.resolver = resolve;
    await loadFormatsWithRetry(url, {
      preferredLabel: opts.preferredLabel,
      force: true,
    });
  });
}

export { openDownloadQualityModal };
