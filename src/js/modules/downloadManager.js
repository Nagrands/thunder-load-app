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
  downloadCancelButton,
  buttonText,
  progressBarContainer,
  progressBar,
  openLastVideoButton,
} from "./domElements.js";
import { getSelectedQuality } from "./qualitySelector.js";
import { hideUrlActionButtons } from "./urlInputHandler.js";
import { initTooltips } from "./tooltipInitializer.js";

const queueInfo = document.getElementById("download-queue-info");
const queueCount = document.getElementById("queue-count");
const queueIndicator = document.getElementById("queue-start-indicator");

function updateDownloaderTabLabel() {
  try {
    const label = document.querySelector(
      '.group-menu [data-menu="download"] .menu-text',
    );
    if (!label) return;
    const count = (state.isDownloading ? 1 : 0) + state.downloadQueue.length;
    label.textContent = count > 0 ? `Downloader (${count})` : "Downloader";
  } catch (e) {
    // no-op
  }
}

// === Queue helpers ===
const QUEUE_MAX = 200;

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
    // drop hash except time-like (#t=) to reduce dupes
    if (!/^t=/.test(url.hash?.slice(1) || "")) url.hash = "";
    url.username = "";
    url.password = "";
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
  if (res.added) parts.push(`добавлено: ${res.added}`);
  if (res.duplicates) parts.push(`дубликатов: ${res.duplicates}`);
  if (res.activeDup) parts.push(`совпадает с текущей: ${res.activeDup}`);
  if (res.invalid) parts.push(`некорректных: ${res.invalid}`);
  if (res.capped) parts.push(`превышение лимита: +${res.capped}`);
  return parts.join(", ");
}

function enqueueMany(urls, quality, options = {}) {
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
  updateQueueDisplay();
  return { added, duplicates, activeDup, invalid, capped };
}

function updateQueueDisplay() {
  const count = state.downloadQueue.length;
  if (queueInfo && queueCount) {
    if (count > 0) {
      queueInfo.classList.remove("hidden");
      let text = "ссылок";
      if (count % 10 === 1 && count % 100 !== 11) text = "ссылка";
      else if (
        [2, 3, 4].includes(count % 10) &&
        ![12, 13, 14].includes(count % 100)
      )
        text = "ссылки";
      queueInfo.innerHTML = `В очереди: <span id="queue-count">${count}</span> ${text}`;
    } else {
      queueInfo.classList.add("hidden");
    }
  }
  updateDownloaderTabLabel();
}

let lastInputBeforeDownload = null;

const downloadVideo = async (url, quality) => {
  console.log("Инициирование загрузки по URL:", url, "с качеством:", quality);
  state.isDownloading = true;
  state.currentUrl = url;
  urlInput.disabled = true;
  downloadCancelButton.disabled = true;
  updateButtonState();
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
    progressBar.style.width = "0%";

    const shortUrl = new URL(url).hostname.replace("www.", "");
    buttonText.textContent = `\u23F3 ${shortUrl} (${quality})...`;

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

    const newLogEntry = {
      id: Date.now(),
      fileName,
      filePath,
      quality: actualQuality,
      dateTime: currentDateTime,
      iconUrl,
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
      showToast("Загрузка отменена.", "warning");
    } else {
      console.error("Ошибка при загрузке видео:", error);
      showToast(
        "Не удалось загрузить видео. Пожалуйста, попробуйте еще раз.",
        "error",
      );
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
    try {
      window.dispatchEvent(
        new CustomEvent("download:state", { detail: { isDownloading: false } }),
      );
    } catch {}
    updateDownloaderTabLabel();

    buttonText.textContent = "Скачать";
    downloadButton.removeAttribute("title");
    downloadButton.removeAttribute("data-bs-original-title");
    initTooltips();

    downloadButton.classList.remove("disabled");
    downloadCancelButton.disabled = true;
    progressBarContainer.style.opacity = 0;
    progressBar.style.width = "0%";

    if (state.downloadQueue.length > 0) {
      const next = state.downloadQueue.shift();
      updateQueueDisplay();
      if (queueIndicator) {
        queueIndicator.classList.add("show");
        queueIndicator.classList.remove("hidden");
        setTimeout(() => {
          queueIndicator.classList.remove("show");
          queueIndicator.classList.add("hidden");
        }, 3000);
      }
      console.log("\u25B6 Старт следующей загрузки из очереди:", next.url);
      setTimeout(() => {
        initiateDownload(next.url, next.quality);
      }, 300);
    }
  }
};

const initiateDownload = async (url, quality) => {
  downloadButton.classList.add("loading");
  progressBarContainer.style.opacity = 1;
  state.isDownloading = true;
  updateButtonState();
  await downloadVideo(url, quality);
  downloadButton.classList.remove("loading");
};

const handleDownloadButtonClick = async (options = {}) => {
  const selectedQuality = getSelectedQuality();
  const raw = urlInput.value.trim();
  let quality = selectedQuality || "Source";
  if (options.forceAudioOnly) quality = "Audio Only";

  // Извлекаем URL из произвольного текста
  const validUrls = extractUrls(raw).filter(
    (u) => isValidUrl(u) && isSupportedUrl(u),
  );
  if (validUrls.length === 0) {
    showToast("Пожалуйста, введите корректный URL.", "warning");
    return;
  }

  // Если несколько: стартуем первый/добавляем остальные в очередь
  if (validUrls.length > 1) {
    const first = validUrls[0];
    const rest = validUrls.slice(1);
    if (state.isDownloading || options.enqueueOnly) {
      const res = enqueueMany(validUrls, quality, options);
      showToast(`Очередь: ${summarizeEnqueueResult(res)}`, "info");
    } else {
      await initiateDownload(first, quality);
      const res = enqueueMany(rest, quality, options);
      if (res.added || res.duplicates || res.invalid) {
        showToast(`Очередь: ${summarizeEnqueueResult(res)}`, "info");
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
  if (state.isDownloading || options.enqueueOnly) {
    const nCurr = state.currentUrl ? normalizeUrl(state.currentUrl) : null;
    if (nCurr === normalizeUrl(url)) {
      showToast("Этот URL уже загружается.", "warning");
      return;
    }
    if (
      state.downloadQueue.some(
        (item) => normalizeUrl(item.url) === normalizeUrl(url),
      )
    ) {
      showToast("Этот URL уже есть в очереди.", "info");
      return;
    }
    state.downloadQueue.push({ url, quality });
    showToast("Добавлено в очередь загрузки.", "info");
    urlInput.value = "";
    try {
      urlInput.dispatchEvent(new Event("input", { bubbles: true }));
    } catch {}
    updateQueueDisplay();
  } else {
    await initiateDownload(url, quality);
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

  // Пакетное добавление ссылок в очередь (из предпросмотра плейлиста)
  window.addEventListener("queue:addMany", (e) => {
    const urls = Array.isArray(e.detail?.urls) ? e.detail.urls : [];
    const q = e.detail?.quality || getSelectedQuality() || "Source";
    const res = enqueueMany(urls, q, {});
    if (res.added || res.duplicates || res.invalid) {
      showToast(`Очередь: ${summarizeEnqueueResult(res)}`, "info");
    }
  });
}

export {
  downloadVideo,
  initiateDownload,
  handleDownloadButtonClick,
  initDownloadButton,
  updateQueueDisplay,
};
