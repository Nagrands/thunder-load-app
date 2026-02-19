// src/js/modules/downloadManager.js

import { historyContainer } from "./domElements.js";
import { state, updateButtonState } from "./state.js";
import { showToast } from "./toast.js";
import { updateIcon } from "./iconUpdater.js";
import {
  addNewEntryToHistory,
  updateDownloadCount,
  getHistoryData,
} from "./history.js";
import { isValidUrl, isSupportedUrl } from "./validation.js";
import {
  urlInput,
  downloadButton,
  enqueueButton,
  downloadCancelButton,
  buttonText,
  progressBarContainer,
  openLastVideoButton,
  queueStartButton,
  queueClearButton,
} from "./domElements.js";
import { openDownloadQualityModal } from "./downloadQualityModal.js";
import { hideUrlActionButtons } from "./urlInputHandler.js";
import { initTooltips } from "./tooltipInitializer.js";
import { getLanguage, t } from "./i18n.js";
import { getCachedVideoInfo, setCachedVideoInfo } from "./videoInfoCache.js";

const queueInfo = document.getElementById("download-queue-info");
const queueCount = document.getElementById("queue-count");
const queueIndicator = document.getElementById("queue-start-indicator");
const queueList = document.getElementById("queue-list");
const queueCapState = document.getElementById("queue-cap-state");
const QUEUE_LOG_TAG = "[queue]";

const DOWNLOAD_HISTORY_CACHE_TTL_MS = 12000;
let downloadedUrlCache = { ts: 0, map: new Map() };

function updateDownloaderTabLabel() {
  try {
    const tab = document.querySelector('.group-menu [data-menu="download"]');
    if (!tab) return;
    const label = tab.querySelector(".menu-text");
    const badge = tab.querySelector(".menu-badge");
    if (!label) return;
    const count = (state.isDownloading ? 1 : 0) + state.downloadQueue.length;
    const base = t("tabs.download");
    label.textContent = base;
    if (badge) {
      if (count > 0) {
        badge.textContent = String(count);
        badge.classList.add("is-visible");
      } else {
        badge.textContent = "";
        badge.classList.remove("is-visible");
      }
    }
    tab.classList.toggle("is-busy", count > 0);
    const topBar = document.querySelector(".top-bar");
    if (topBar) {
      topBar.classList.toggle("has-download-activity", count > 0);
    }
    try {
      tab.setAttribute("aria-label", count > 0 ? `${base} (${count})` : base);
    } catch {}
  } catch (_e) {
    // no-op
  }
}

// === Queue helpers ===
const QUEUE_MAX = 200;
const QUEUE_STORAGE_KEY = "downloadQueue";
let currentDownloadSignature = null;

function persistQueue() {
  try {
    window.localStorage.setItem(
      QUEUE_STORAGE_KEY,
      JSON.stringify(state.downloadQueue),
    );
    console.log(QUEUE_LOG_TAG, "persist", {
      count: state.downloadQueue.length,
    });
  } catch {}
}

function loadQueueFromStorage() {
  let raw = null;
  try {
    raw = window.localStorage.getItem(QUEUE_STORAGE_KEY);
  } catch {
    raw = null;
  }
  if (!raw) return [];
  let parsed = [];
  try {
    parsed = JSON.parse(raw);
  } catch {
    parsed = [];
  }
  if (!Array.isArray(parsed)) return [];
  const unique = new Set();
  const restored = [];
  const currentSig = getCurrentDownloadSignature();
  for (const item of parsed) {
    const url = item?.url;
    const quality = item?.quality;
    if (!isValidUrl(url) || !isSupportedUrl(url)) continue;
    const signature = getQueueSignature(url, quality);
    if (!signature || signature === currentSig || unique.has(signature)) continue;
    if (restored.length >= QUEUE_MAX) break;
    unique.add(signature);
    restored.push({ url, quality });
  }
  console.log(QUEUE_LOG_TAG, "restore", {
    stored: parsed.length,
    restored: restored.length,
  });
  return restored;
}

function normalizeUrl(u) {
  try {
    const url = new URL(String(u).trim());
    // strip common tracking params but keep meaningful like 't' (timestamp)
    const toDelete = [
      "utm_source",
      "utm_medium",
      "utm_campaign",
      "utm_term",
      "utm_content",
      "si",
      "spm",
      "fbclid",
      "gclid",
      "yclid",
      "mc_cid",
      "mc_eid",
      "feature",
    ];
    toDelete.forEach((k) => url.searchParams.delete(k));
    // remove trailing slash for consistency
    if (url.pathname !== "/" && url.pathname.endsWith("/")) {
      url.pathname = url.pathname.replace(/\/+$/, "");
    }
    // If short youtu.be link — canonicalize to youtube.com/watch?v=ID
    const hostLower = url.hostname.toLowerCase();
    if (hostLower === "youtu.be") {
      const videoId = url.pathname.replace(/^\/+/, "");
      if (videoId) {
        url.hostname = "www.youtube.com";
        url.pathname = "/watch";
        url.searchParams.set("v", videoId);
      }
    }

    // drop hash except time-like (#t=) to reduce dupes
    if (!/^t=/.test(url.hash?.slice(1) || "")) url.hash = "";
    url.username = "";
    url.password = "";
    // remove playlist parameter when a specific video is requested
    const youtubeHostPattern = /(^|\.)youtube\.com$/;
    if (
      (youtubeHostPattern.test(hostLower) || hostLower === "youtu.be") &&
      url.searchParams.has("v")
    ) {
      url.searchParams.delete("list");
    }
    return url.toString();
  } catch {
    return (u || "").trim();
  }
}

function extractUrls(raw) {
  if (!raw) return [];
  const re = /(https?:\/\/[^\s'"<>]+)/gi;
  const out = [];
  let m;
  while ((m = re.exec(raw))) out.push(m[1]);
  // если ре не нашёл — fallback разбивка по пробелам
  if (out.length === 0) {
    out.push(
      ...String(raw)
        .split(/\s+|,|;|\n|\r/)
        .map((s) => s.trim())
        .filter((s) => /^https?:\/\//i.test(s)),
    );
  }
  return out;
}

function summarizeEnqueueResult(res) {
  const parts = [];
  if (res.added) parts.push(t("queue.summary.added", { count: res.added }));
  if (res.duplicates)
    parts.push(t("queue.summary.duplicates", { count: res.duplicates }));
  if (res.activeDup)
    parts.push(t("queue.summary.activeDup", { count: res.activeDup }));
  if (res.invalid)
    parts.push(t("queue.summary.invalid", { count: res.invalid }));
  if (res.capped) parts.push(t("queue.summary.capped", { count: res.capped }));
  if (res.alreadyDownloaded) {
    parts.push(
      t("queue.summary.alreadyDownloaded", { count: res.alreadyDownloaded }),
    );
  }
  const summary = parts.join(", ");
  return summary || t("queue.summary.fallback");
}

function resolveDownloadKind(payloadOrEntry) {
  const explicitKind = payloadOrEntry?.downloadKind;
  if (explicitKind === "audio" || explicitKind === "video") {
    return explicitKind;
  }
  const payloadType =
    payloadOrEntry?.type || payloadOrEntry?.payload?.type || "";
  if (payloadType === "audio-only") return "audio";
  const qualityLike =
    payloadOrEntry?.quality || payloadOrEntry?.label || payloadOrEntry || "";
  const value = String(qualityLike).toLowerCase();
  if (/(audio|mp3|m4a|aac|opus|ogg|flac|wav)/i.test(value)) {
    return "audio";
  }
  return "video";
}

function getQueueQualityLabel(quality) {
  if (!quality) return t("quality.custom");
  if (typeof quality === "string") return quality;
  if (typeof quality?.label === "string" && quality.label.trim()) {
    return quality.label.trim();
  }
  if (typeof quality?.quality === "string" && quality.quality.trim()) {
    return quality.quality.trim();
  }
  if (quality?.type === "audio-only") return t("quality.audioOnly");
  return t("quality.custom");
}

function getQueueSignature(url, quality) {
  const normalizedUrl = normalizeUrl(url);
  const kind = resolveDownloadKind(quality);
  const label = getQueueQualityLabel(quality).trim().toLowerCase();
  return `${normalizedUrl}::${kind}::${label}`;
}

function isSameQueueTask(a, b) {
  if (!a || !b) return false;
  return (
    getQueueSignature(a.url, a.quality) === getQueueSignature(b.url, b.quality)
  );
}

function getCurrentDownloadSignature() {
  return currentDownloadSignature;
}

function buildDownloadedUrlMap(entries = []) {
  const map = new Map();
  for (const entry of entries) {
    const raw = entry?.sourceUrl || entry?.url || "";
    if (!raw) continue;
    const normalized = normalizeUrl(raw);
    if (!normalized) continue;
    if (!map.has(normalized)) map.set(normalized, new Set());
    map.get(normalized).add(resolveDownloadKind(entry));
  }
  return map;
}

function getDownloadedUrlMapSync() {
  try {
    const entries = getHistoryData();
    return buildDownloadedUrlMap(Array.isArray(entries) ? entries : []);
  } catch {
    return new Map();
  }
}

async function getDownloadedUrlMap(forceRefresh = false) {
  const now = Date.now();
  if (
    !forceRefresh &&
    downloadedUrlCache.map.size > 0 &&
    now - downloadedUrlCache.ts < DOWNLOAD_HISTORY_CACHE_TTL_MS
  ) {
    return downloadedUrlCache.map;
  }

  let entries = [];
  try {
    const local = getHistoryData();
    if (Array.isArray(local) && local.length > 0) {
      entries = local;
    } else {
      const loaded = await window.electron.invoke("load-history");
      entries = Array.isArray(loaded) ? loaded : [];
    }
  } catch {
    entries = [];
  }
  downloadedUrlCache = { ts: now, map: buildDownloadedUrlMap(entries) };
  return downloadedUrlCache.map;
}

function isAlreadyDownloaded(url, downloadedMap, requestedPayload) {
  const normalized = normalizeUrl(url);
  if (!normalized) return false;
  const kinds = downloadedMap.get(normalized);
  if (!kinds || !kinds.size) return false;
  return kinds.has(resolveDownloadKind(requestedPayload));
}

function markAsDownloaded(url, downloadKind) {
  const normalized = normalizeUrl(url);
  if (!normalized) return;
  const kind = resolveDownloadKind({ downloadKind });
  if (!downloadedUrlCache.map.has(normalized)) {
    downloadedUrlCache.map.set(normalized, new Set());
  }
  downloadedUrlCache.map.get(normalized).add(kind);
  downloadedUrlCache.ts = Date.now();
}

function enqueueMany(urls, quality, options = {}) {
  const activeSignature = getCurrentDownloadSignature();
  const existing = new Set(
    state.downloadQueue.map((it) => getQueueSignature(it.url, it.quality)),
  );
  const downloadedMap = options.downloadedMap || getDownloadedUrlMapSync();
  let added = 0,
    duplicates = 0,
    activeDup = 0,
    invalid = 0,
    capped = 0,
    alreadyDownloaded = 0;
  for (const raw of urls) {
    if (!isValidUrl(raw) || !isSupportedUrl(raw)) {
      invalid++;
      continue;
    }
    const signature = getQueueSignature(raw, quality);
    if (isAlreadyDownloaded(raw, downloadedMap, quality)) {
      alreadyDownloaded++;
      continue;
    }
    if (activeSignature && signature === activeSignature) {
      activeDup++;
      continue;
    }
    if (existing.has(signature)) {
      duplicates++;
      continue;
    }
    if (state.downloadQueue.length >= QUEUE_MAX) {
      capped++;
      continue;
    }
    state.downloadQueue.push({ url: raw, quality });
    existing.add(signature);
    added++;
  }
  persistQueue();
  console.log(QUEUE_LOG_TAG, "enqueueMany", {
    added,
    duplicates,
    activeDup,
    invalid,
    capped,
    alreadyDownloaded,
  });
  updateQueueDisplay();
  return { added, duplicates, activeDup, invalid, capped, alreadyDownloaded };
}

function updateQueueDisplay() {
  const count = state.downloadQueue.length;
  if (queueInfo && queueCount) {
    queueInfo.classList.remove("is-near-limit", "is-full");
    if (count > 0) {
      queueInfo.classList.remove("hidden");
      queueCount.textContent = String(count);
      if (count >= QUEUE_MAX) {
        queueInfo.classList.add("is-full");
      } else if (count >= Math.floor(QUEUE_MAX * 0.9)) {
        queueInfo.classList.add("is-near-limit");
      }
      if (queueStartButton) {
        queueStartButton.classList.remove("hidden");
        queueStartButton.disabled = state.isDownloading;
      }
      if (queueClearButton) {
        queueClearButton.classList.remove("hidden");
        queueClearButton.disabled = false;
      }
      const linksLabel = queueInfo.querySelector('[data-i18n="queue.links"]');
      if (linksLabel) {
        const lang = getLanguage();
        if (lang === "ru") {
          let text = t("queue.links.many");
          if (count % 10 === 1 && count % 100 !== 11)
            text = t("queue.links.one");
          else if (
            [2, 3, 4].includes(count % 10) &&
            ![12, 13, 14].includes(count % 100)
          )
            text = t("queue.links.few");
          linksLabel.textContent = text;
        } else {
          linksLabel.textContent =
            count === 1 ? t("queue.links.one") : t("queue.links.many");
        }
      }
      if (queueCapState) {
        if (count >= QUEUE_MAX) {
          queueCapState.textContent = t("queue.limit.full");
          queueCapState.classList.remove("hidden");
        } else if (count >= Math.floor(QUEUE_MAX * 0.9)) {
          queueCapState.textContent = t("queue.limit.near", {
            count: QUEUE_MAX - count,
          });
          queueCapState.classList.remove("hidden");
        } else {
          queueCapState.textContent = "";
          queueCapState.classList.add("hidden");
        }
      }
    } else {
      queueInfo.classList.add("hidden");
      if (queueCapState) {
        queueCapState.textContent = "";
        queueCapState.classList.add("hidden");
      }
      if (queueStartButton) {
        queueStartButton.classList.add("hidden");
        queueStartButton.disabled = true;
      }
      if (queueClearButton) {
        queueClearButton.classList.add("hidden");
        queueClearButton.disabled = true;
      }
    }
  }
  if (queueList) {
    if (count === 0) {
      queueList.innerHTML = "";
    } else {
      const maxLabelLen = 64;
      const escapeHtml = (value) =>
        String(value || "")
          .replace(/&/g, "&amp;")
          .replace(/</g, "&lt;")
          .replace(/>/g, "&gt;")
          .replace(/"/g, "&quot;");
      const makeLabel = (url) => {
        try {
          const parsed = new URL(url);
          const base = `${parsed.hostname}${parsed.pathname}`;
          return base.length > maxLabelLen
            ? `${base.slice(0, maxLabelLen - 1)}…`
            : base;
        } catch {
          const raw = String(url || "");
          return raw.length > maxLabelLen
            ? `${raw.slice(0, maxLabelLen - 1)}…`
            : raw;
        }
      };
      const makeTitle = (url) => {
        const cached = getCachedVideoInfo(url);
        const title = cached?.title ? String(cached.title) : "";
        return title.length > maxLabelLen
          ? `${title.slice(0, maxLabelLen - 1)}…`
          : title;
      };
      queueList.innerHTML = `
        <ul>
          ${state.downloadQueue
            .map((item, idx) => {
              const urlLabel = makeLabel(item.url);
              const titleLabel = makeTitle(item.url);
              const qualityLabel = getQueueQualityLabel(item.quality);
              const titleHtml = titleLabel
                ? `<div class="queue-item-title">${escapeHtml(titleLabel)}</div>`
                : "";
              const urlHtml = `<div class="queue-item-url">${escapeHtml(
                urlLabel,
              )}</div>`;
              const isFirst = idx === 0;
              const isLast = idx === state.downloadQueue.length - 1;
              return `
                <li>
                  <div class="queue-item-meta" title="${escapeHtml(
                    String(item.url || ""),
                  )}">
                    ${titleHtml}
                    ${urlHtml}
                  </div>
                  <div class="queue-item-controls">
                    <span
                      class="queue-quality-chip"
                      title="${escapeHtml(t("queue.quality.label"))}: ${escapeHtml(qualityLabel)}"
                    >${escapeHtml(qualityLabel)}</span>
                    <div class="queue-item-actions">
                      <button
                        type="button"
                        class="queue-item-move"
                        data-queue-move="up"
                        data-index="${idx}"
                        title="${t("queue.item.moveUp.title")}"
                        aria-label="${t("queue.item.moveUp.title")}"
                        data-i18n-title="queue.item.moveUp.title"
                        ${isFirst ? "disabled" : ""}
                      >
                        <i class="fa-solid fa-chevron-up"></i>
                      </button>
                      <button
                        type="button"
                        class="queue-item-move"
                        data-queue-move="down"
                        data-index="${idx}"
                        title="${t("queue.item.moveDown.title")}"
                        aria-label="${t("queue.item.moveDown.title")}"
                        data-i18n-title="queue.item.moveDown.title"
                        ${isLast ? "disabled" : ""}
                      >
                        <i class="fa-solid fa-chevron-down"></i>
                      </button>
                      <button
                        type="button"
                        class="queue-item-remove"
                        data-queue-remove="1"
                        data-index="${idx}"
                        title="${t("queue.item.remove.title")}"
                        aria-label="${t("queue.item.remove.title")}"
                        data-i18n-title="queue.item.remove.title"
                      >
                        <i class="fa-solid fa-xmark"></i>
                      </button>
                    </div>
                  </div>
                </li>
              `;
            })
            .join("")}
        </ul>
      `;
    }
  }
  updateDownloaderTabLabel();
}

let lastInputBeforeDownload = null;
let lastChosenQuality = null;
let lastChosenQualityLabel = null;
let progressResetTimer = null;

const clearProgressResetTimer = () => {
  if (progressResetTimer) {
    clearTimeout(progressResetTimer);
    progressResetTimer = null;
  }
};

const resetProgressIndicator = () => {
  progressBarContainer.style.opacity = 0;
  progressBarContainer.classList.remove("is-active", "is-complete");
  progressBarContainer.setAttribute("aria-valuenow", "0");
  progressBarContainer.style.setProperty("--progress-ratio", "0");
};

const getQualityLabel = (quality) => {
  if (!quality) return t("quality.source");
  if (typeof quality === "string") return quality;
  return quality.label || t("quality.custom");
};

const QUALITY_PROFILE_KEY = "downloadQualityProfile";
const QUALITY_LAST_KEY = "downloadLastQuality";
const QUALITY_PROFILE_DEFAULT = "remember";

const readQualityProfile = () => {
  try {
    return (
      window.localStorage.getItem(QUALITY_PROFILE_KEY) ||
      QUALITY_PROFILE_DEFAULT
    );
  } catch {
    return QUALITY_PROFILE_DEFAULT;
  }
};

const readLastQuality = () => {
  try {
    return window.localStorage.getItem(QUALITY_LAST_KEY) || null;
  } catch {
    return null;
  }
};

const persistLastQuality = (quality) => {
  try {
    if (quality) window.localStorage.setItem(QUALITY_LAST_KEY, quality);
  } catch {}
};

const resolvePresetQuality = () => {
  const profile = readQualityProfile();
  if (profile === "audio") return t("quality.audioOnly");
  if (profile === "best") return t("quality.source");
  const remembered = lastChosenQualityLabel || readLastQuality();
  return remembered || t("quality.source");
};

function normalizeSelection(selection) {
  if (selection && typeof selection === "object" && selection.enqueue) {
    return { payload: selection.payload, enqueue: true };
  }
  return { payload: selection, enqueue: false };
}

const downloadVideo = async (url, quality) => {
  console.log("Инициирование загрузки по URL:", url, "с качеством:", quality);
  const requestedDownloadKind = resolveDownloadKind(quality);
  currentDownloadSignature = getQueueSignature(url, quality);
  state.isDownloading = true;
  state.currentUrl = url;
  urlInput.disabled = true;
  downloadCancelButton.disabled = true;
  updateButtonState();
  updateQueueDisplay();
  try {
    window.dispatchEvent(
      new CustomEvent("download:state", { detail: { isDownloading: true } }),
    );
  } catch {}
  updateDownloaderTabLabel();

  try {
    // Поменяем содержимое поля URL на название ролика, чтобы во время загрузки показывать title
    lastInputBeforeDownload = urlInput.value;
    try {
      const meta = await window.electron.ipcRenderer.invoke(
        "get-video-info",
        url,
      );
      if (meta?.success) {
        setCachedVideoInfo(meta.webpage_url || meta.original_url || url, meta);
      }
      const title = meta?.title?.trim();
      if (title && title.length >= 2) {
        urlInput.value = title;
        urlInput.setAttribute("data-title-mode", "1");
        try {
          urlInput.dispatchEvent(new Event("input", { bubbles: true }));
        } catch {}
      }
    } catch (_) {}

    progressBarContainer.style.opacity = 1;
    progressBarContainer.classList.remove("is-complete");
    progressBarContainer.classList.add("is-active");
    progressBarContainer.style.setProperty("--progress-ratio", "0");

    const shortUrl = new URL(url).hostname.replace("www.", "");
    buttonText.textContent = `\u23F3 ${shortUrl} (${getQualityLabel(quality)})...`;

    downloadButton.setAttribute("data-bs-toggle", "tooltip");
    downloadButton.setAttribute("title", url);
    downloadButton.setAttribute("data-bs-original-title", url);
    initTooltips();

    const {
      fileName,
      filePath,
      quality: selectedQuality,
      actualQuality,
      sourceUrl,
      cancelled,
    } = await window.electron.invoke("download-video", url, quality);

    if (cancelled) {
      console.log("Загрузка отменена.");
      // Вернём исходное содержимое поля, если меняли его на title
      try {
        if (urlInput.getAttribute("data-title-mode") === "1") {
          urlInput.value = lastInputBeforeDownload || "";
          urlInput.removeAttribute("data-title-mode");
          urlInput.dispatchEvent(new Event("input", { bubbles: true }));
        }
      } catch {}
      return;
    }

    console.log("Файл загружен:", {
      fileName,
      filePath,
      selectedQuality,
      actualQuality,
      sourceUrl,
    });

    const currentDateTime = new Date().toLocaleString("ru-RU", {
      hour12: false,
    });
    const iconUrl = await window.electron.invoke("get-icon-path", url);
    const entryId = Date.now();
    // Try to fetch a preview thumbnail for history entry
    let thumbnail = "";
    let thumbnailCacheFile = "";
    try {
      const info = await window.electron.ipcRenderer.invoke(
        "get-video-info",
        url,
      );
      if (info && info.success && info.thumbnail) thumbnail = info.thumbnail;
    } catch (_) {}
    if (thumbnail) {
      try {
        const cacheResult = await window.electron.invoke(
          "cache-history-preview",
          {
            url: thumbnail,
            entryId,
            fileName,
          },
        );
        if (cacheResult?.success && cacheResult.filePath) {
          thumbnailCacheFile = cacheResult.filePath;
        }
      } catch (err) {
        console.warn("Failed to cache preview thumbnail:", err);
      }
    }

    const newLogEntry = {
      id: entryId,
      fileName,
      filePath,
      quality: actualQuality,
      downloadKind: requestedDownloadKind,
      dateTime: currentDateTime,
      iconUrl,
      thumbnail,
      thumbnailCacheFile,
      sourceUrl,
    };

    await addNewEntryToHistory(newLogEntry);
    markAsDownloaded(sourceUrl || url, requestedDownloadKind);
    await updateDownloadCount();

    urlInput.value = "";
    try {
      urlInput.dispatchEvent(new Event("input", { bubbles: true }));
    } catch {}
    updateIcon("");
    updateButtonState();

    if (historyContainer) historyContainer.scrollTop = 0;

    window.localStorage.setItem("lastDownloadedFile", filePath);
    openLastVideoButton.disabled = false;
  } catch (error) {
    if (error.message === "Download cancelled") {
      showToast(t("download.cancelled"), "warning");
    } else if (error.message === "Загрузка уже выполняется") {
      const result = enqueueMany([url], quality);
      const summary =
        summarizeEnqueueResult(result) || t("queue.summary.fallback");
      showToast(t("download.inProgress", { summary }), "info");
    } else {
      console.error("Ошибка при загрузке видео:", error);
      showToast(t("download.error.retry"), "error");
    }
    // На ошибке — вернём исходный URL в поле (если меняли)
    try {
      if (urlInput.getAttribute("data-title-mode") === "1") {
        urlInput.value = lastInputBeforeDownload || "";
        urlInput.removeAttribute("data-title-mode");
        urlInput.dispatchEvent(new Event("input", { bubbles: true }));
      }
    } catch {}
  } finally {
    currentDownloadSignature = null;
    state.currentUrl = "";
    state.isDownloading = false;
    urlInput.disabled = false;
    updateButtonState();
    updateQueueDisplay();
    try {
      window.dispatchEvent(
        new CustomEvent("download:state", { detail: { isDownloading: false } }),
      );
    } catch {}
    updateDownloaderTabLabel();

    buttonText.textContent = t("actions.download");
    downloadButton.removeAttribute("title");
    downloadButton.removeAttribute("data-bs-original-title");
    initTooltips();

    downloadButton.classList.remove("disabled");
    downloadCancelButton.disabled = true;
    clearProgressResetTimer();
    const shouldDelayProgressReset =
      progressBarContainer.classList.contains("is-complete");
    if (shouldDelayProgressReset) {
      progressResetTimer = setTimeout(() => {
        resetProgressIndicator();
        progressResetTimer = null;
      }, 900);
    } else {
      resetProgressIndicator();
    }

    if (state.downloadQueue.length > 0) {
      const next = state.downloadQueue.shift();
      persistQueue();
      updateQueueDisplay();
      if (queueIndicator) {
        queueIndicator.classList.add("show");
        queueIndicator.classList.remove("hidden");
        setTimeout(() => {
          queueIndicator.classList.remove("show");
          queueIndicator.classList.add("hidden");
        }, 3000);
      }
      console.log(QUEUE_LOG_TAG, "auto-start-next", { url: next.url });
      setTimeout(() => {
        initiateDownload(next.url, next.quality);
      }, 300);
    }
  }
};

const initiateDownload = async (url, quality) => {
  clearProgressResetTimer();
  downloadButton.classList.add("loading");
  progressBarContainer.style.opacity = 1;
  progressBarContainer.classList.remove("is-complete");
  progressBarContainer.classList.add("is-active");
  progressBarContainer.style.setProperty("--progress-ratio", "0");
  state.isDownloading = true;
  updateButtonState();
  await downloadVideo(url, quality);
  downloadButton.classList.remove("loading");
};

const handleDownloadButtonClick = async (options = {}) => {
  const raw = urlInput.value.trim();

  // Извлекаем URL из произвольного текста
  const validUrls = extractUrls(raw).filter(
    (u) => isValidUrl(u) && isSupportedUrl(u),
  );
  if (validUrls.length === 0) {
    showToast(t("download.url.invalid"), "warning");
    return;
  }
  const downloadedMap = await getDownloadedUrlMap();

  // Если несколько: стартуем первый/добавляем остальные в очередь
  if (validUrls.length > 1) {
    const first = validUrls[0];
    const rest = validUrls.slice(1);
    const selectionRaw = await openDownloadQualityModal(first, {
      presetQuality: resolvePresetQuality(),
      preferredLabel: lastChosenQualityLabel || readLastQuality(),
      forceAudioOnly: options.forceAudioOnly,
    });
    if (!selectionRaw) return;
    const selection = normalizeSelection(selectionRaw);
    const payload = selection.payload;
    const enqueueFromModal = selection.enqueue;
    lastChosenQuality = payload;
    lastChosenQualityLabel =
      typeof payload === "string" ? payload : payload.label || null;
    persistLastQuality(lastChosenQualityLabel);

    if (state.isDownloading || options.enqueueOnly || enqueueFromModal) {
      const res = enqueueMany(validUrls, payload, {
        ...options,
        downloadedMap,
      });
      if (res.added === 0 && res.alreadyDownloaded > 0) {
        showToast(t("download.url.downloaded"), "info");
        return;
      }
      showToast(
        t("queue.summary.toast", { summary: summarizeEnqueueResult(res) }),
        "info",
      );
    } else {
      const pendingByMode = validUrls.filter(
        (u) => !isAlreadyDownloaded(u, downloadedMap, payload),
      );
      if (pendingByMode.length === 0) {
        showToast(t("download.url.downloaded"), "info");
        return;
      }
      const firstPending = pendingByMode[0];
      const restPending = pendingByMode.slice(1);
      await initiateDownload(firstPending, payload);
      const res = enqueueMany(restPending, payload, {
        ...options,
        downloadedMap,
      });
      if (
        res.added ||
        res.duplicates ||
        res.invalid ||
        res.alreadyDownloaded
      ) {
        showToast(
          t("queue.summary.toast", { summary: summarizeEnqueueResult(res) }),
          "info",
        );
      }
    }
    urlInput.value = "";
    try {
      urlInput.dispatchEvent(new Event("input", { bubbles: true }));
    } catch {}
    return;
  }

  // Один URL
  const url = validUrls[0];
  const selectionRaw = await openDownloadQualityModal(url, {
    presetQuality: resolvePresetQuality(),
    preferredLabel: lastChosenQualityLabel || readLastQuality(),
    forceAudioOnly: options.forceAudioOnly,
  });
  if (!selectionRaw) return;
  const selection = normalizeSelection(selectionRaw);
  const payload = selection.payload;
  const enqueueFromModal = selection.enqueue;
  lastChosenQuality = payload;
  lastChosenQualityLabel =
    typeof payload === "string" ? payload : payload.label || null;
  persistLastQuality(lastChosenQualityLabel);
  if (isAlreadyDownloaded(url, downloadedMap, payload)) {
    showToast(t("download.url.downloaded"), "info");
    return;
  }
  if (state.isDownloading || options.enqueueOnly || enqueueFromModal) {
    const candidateTask = { url, quality: payload };
    const candidateSignature = getQueueSignature(url, payload);
    const activeSignature = getCurrentDownloadSignature();
    if (activeSignature && candidateSignature === activeSignature) {
      showToast(t("download.url.active"), "warning");
      return;
    }
    if (
      state.downloadQueue.some((item) => isSameQueueTask(item, candidateTask))
    ) {
      showToast(t("download.url.queued"), "info");
      return;
    }
    if (state.downloadQueue.length >= QUEUE_MAX) {
      showToast(
        t("queue.summary.toast", {
          summary: summarizeEnqueueResult({
            added: 0,
            duplicates: 0,
            activeDup: 0,
            invalid: 0,
            capped: 1,
            alreadyDownloaded: 0,
          }),
        }),
        "warning",
      );
      return;
    }
    state.downloadQueue.push({ url, quality: payload });
    persistQueue();
    console.log(QUEUE_LOG_TAG, "enqueueOne", { url, from: "modal/button" });
    showToast(t("queue.added"), "info");
    urlInput.value = "";
    try {
      urlInput.dispatchEvent(new Event("input", { bubbles: true }));
    } catch {}
    updateQueueDisplay();
  } else {
    await initiateDownload(url, payload);
  }
};

function initDownloadButton() {
  downloadButton.addEventListener("click", async () => {
    hideUrlActionButtons();
    const opts = {
      enqueueOnly: downloadButton.dataset.enqueueOnly === "1",
      forceAudioOnly: downloadButton.dataset.forceAudioOnly === "1",
    };
    delete downloadButton.dataset.enqueueOnly;
    delete downloadButton.dataset.forceAudioOnly;
    await handleDownloadButtonClick(opts);
  });

  if (enqueueButton) {
    enqueueButton.addEventListener("click", async () => {
      hideUrlActionButtons();
      console.log(QUEUE_LOG_TAG, "enqueue-button-click");
      await handleDownloadButtonClick({ enqueueOnly: true });
    });
  }

  if (queueClearButton) {
    queueClearButton.addEventListener("click", () => {
      if (!state.downloadQueue.length) return;
      state.downloadQueue = [];
      persistQueue();
      updateQueueDisplay();
      console.log(QUEUE_LOG_TAG, "clear");
      showToast(t("queue.cleared"), "info");
    });
  }

  if (queueList && !queueList.dataset.bound) {
    queueList.addEventListener("click", (e) => {
      const moveBtn = e.target.closest("[data-queue-move]");
      if (moveBtn) {
        const idx = Number(moveBtn.dataset.index);
        const direction = moveBtn.dataset.queueMove;
        if (!Number.isFinite(idx)) return;
        if (direction === "up" && idx > 0) {
          const [item] = state.downloadQueue.splice(idx, 1);
          state.downloadQueue.splice(idx - 1, 0, item);
          persistQueue();
          updateQueueDisplay();
          console.log(QUEUE_LOG_TAG, "move-item", { from: idx, to: idx - 1 });
          showToast(t("queue.item.movedUp"), "info");
        } else if (
          direction === "down" &&
          idx >= 0 &&
          idx < state.downloadQueue.length - 1
        ) {
          const [item] = state.downloadQueue.splice(idx, 1);
          state.downloadQueue.splice(idx + 1, 0, item);
          persistQueue();
          updateQueueDisplay();
          console.log(QUEUE_LOG_TAG, "move-item", { from: idx, to: idx + 1 });
          showToast(t("queue.item.movedDown"), "info");
        }
        return;
      }

      const btn = e.target.closest("[data-queue-remove]");
      if (!btn) return;
      const idx = Number(btn.dataset.index);
      if (!Number.isFinite(idx)) return;
      const removed = state.downloadQueue[idx];
      state.downloadQueue.splice(idx, 1);
      persistQueue();
      updateQueueDisplay();
      console.log(QUEUE_LOG_TAG, "remove-item", {
        index: idx,
        url: removed?.url || "",
      });
      showToast(t("queue.item.removed"), "info");
    });
    queueList.dataset.bound = "1";
  }

  if (queueStartButton) {
    queueStartButton.addEventListener("click", () => {
      if (state.isDownloading || state.downloadQueue.length === 0) return;
      const next = state.downloadQueue.shift();
      persistQueue();
      updateQueueDisplay();
      if (queueIndicator) {
        queueIndicator.classList.add("show");
        queueIndicator.classList.remove("hidden");
        setTimeout(() => {
          queueIndicator.classList.remove("show");
          queueIndicator.classList.add("hidden");
        }, 3000);
      }
      console.log(QUEUE_LOG_TAG, "manual-start", { url: next?.url || "" });
      if (next) initiateDownload(next.url, next.quality);
    });
  }

  if (state.downloadQueue.length === 0) {
    state.downloadQueue = loadQueueFromStorage();
    updateQueueDisplay();
    if (!state.isDownloading && state.downloadQueue.length > 0) {
      console.log(QUEUE_LOG_TAG, "restore-wait", {
        count: state.downloadQueue.length,
      });
    }
  }

  // Пакетное добавление ссылок в очередь (из предпросмотра плейлиста)
  window.addEventListener("queue:addMany", (e) => {
    const urls = Array.isArray(e.detail?.urls) ? e.detail.urls : [];
    const q = e.detail?.quality || lastChosenQuality || t("quality.source");
    const res = enqueueMany(urls, q, {});
    console.log(QUEUE_LOG_TAG, "enqueueMany-event", { count: urls.length });
    if (res.added || res.duplicates || res.invalid) {
      showToast(
        t("queue.summary.toast", { summary: summarizeEnqueueResult(res) }),
        "info",
      );
    }
  });

  window.addEventListener("i18n:changed", () => {
    updateQueueDisplay();
  });
}

export {
  downloadVideo,
  initiateDownload,
  handleDownloadButtonClick,
  initDownloadButton,
  updateQueueDisplay,
  resolvePresetQuality,
  loadQueueFromStorage,
  persistQueue,
};
