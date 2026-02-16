// src/js/modules/downloadManager.js

import { historyContainer } from "./domElements.js";
import { state, updateButtonState } from "./state.js";
import { showToast } from "./toast.js";
import { updateIcon } from "./iconUpdater.js";
import { addNewEntryToHistory, updateDownloadCount } from "./history.js";
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
const QUEUE_LOG_TAG = "[queue]";

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
  const currentN = state.currentUrl ? normalizeUrl(state.currentUrl) : null;
  for (const item of parsed) {
    const url = item?.url;
    const quality = item?.quality;
    if (!isValidUrl(url) || !isSupportedUrl(url)) continue;
    const n = normalizeUrl(url);
    if (!n || n === currentN || unique.has(n)) continue;
    if (restored.length >= QUEUE_MAX) break;
    unique.add(n);
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
  const summary = parts.join(", ");
  return summary || t("queue.summary.fallback");
}

function enqueueMany(urls, quality, _options = {}) {
  const currentN = state.currentUrl ? normalizeUrl(state.currentUrl) : null;
  const existing = new Set(
    state.downloadQueue.map((it) => normalizeUrl(it.url)),
  );
  let added = 0,
    duplicates = 0,
    activeDup = 0,
    invalid = 0,
    capped = 0;
  for (const raw of urls) {
    if (!isValidUrl(raw) || !isSupportedUrl(raw)) {
      invalid++;
      continue;
    }
    const n = normalizeUrl(raw);
    if (n === currentN) {
      activeDup++;
      continue;
    }
    if (existing.has(n)) {
      duplicates++;
      continue;
    }
    if (state.downloadQueue.length >= QUEUE_MAX) {
      capped++;
      continue;
    }
    state.downloadQueue.push({ url: raw, quality });
    existing.add(n);
    added++;
  }
  persistQueue();
  console.log(QUEUE_LOG_TAG, "enqueueMany", {
    added,
    duplicates,
    activeDup,
    invalid,
    capped,
  });
  updateQueueDisplay();
  return { added, duplicates, activeDup, invalid, capped };
}

function updateQueueDisplay() {
  const count = state.downloadQueue.length;
  if (queueInfo && queueCount) {
    if (count > 0) {
      queueInfo.classList.remove("hidden");
      queueCount.textContent = String(count);
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
    } else {
      queueInfo.classList.add("hidden");
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
              const titleHtml = titleLabel
                ? `<div class="queue-item-title">${escapeHtml(titleLabel)}</div>`
                : "";
              const urlHtml = `<div class="queue-item-url">${escapeHtml(
                urlLabel,
              )}</div>`;
              return `
                <li>
                  <div class="queue-item-meta" title="${escapeHtml(
                    String(item.url || ""),
                  )}">
                    ${titleHtml}
                    ${urlHtml}
                  </div>
                  <button
                    type="button"
                    class="queue-item-remove"
                    data-queue-remove="1"
                    data-index="${idx}"
                    title="${t("queue.item.remove.title")}"
                    data-i18n-title="queue.item.remove.title"
                  >
                    <i class="fa-solid fa-xmark"></i>
                  </button>
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
      dateTime: currentDateTime,
      iconUrl,
      thumbnail,
      thumbnailCacheFile,
      sourceUrl,
    };

    await addNewEntryToHistory(newLogEntry);
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
      const res = enqueueMany(validUrls, payload, options);
      showToast(
        t("queue.summary.toast", { summary: summarizeEnqueueResult(res) }),
        "info",
      );
    } else {
      await initiateDownload(first, payload);
      const res = enqueueMany(rest, payload, options);
      if (res.added || res.duplicates || res.invalid) {
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
  if (state.isDownloading || options.enqueueOnly || enqueueFromModal) {
    const nCurr = state.currentUrl ? normalizeUrl(state.currentUrl) : null;
    if (nCurr === normalizeUrl(url)) {
      showToast(t("download.url.active"), "warning");
      return;
    }
    if (
      state.downloadQueue.some(
        (item) => normalizeUrl(item.url) === normalizeUrl(url),
      )
    ) {
      showToast(t("download.url.queued"), "info");
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
