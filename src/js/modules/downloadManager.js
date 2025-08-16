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
}

const downloadVideo = async (url, quality) => {
  console.log("Инициирование загрузки по URL:", url, "с качеством:", quality);
  state.isDownloading = true;
  state.currentUrl = url;
  urlInput.disabled = true;
  downloadCancelButton.disabled = true;
  updateButtonState();

  try {
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
  } finally {
    state.currentUrl = "";
    state.isDownloading = false;
    urlInput.disabled = false;
    updateButtonState();

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

const handleDownloadButtonClick = async () => {
  const selectedQuality = getSelectedQuality();
  const url = urlInput.value.trim();
  if (!isValidUrl(url) || !isSupportedUrl(url)) {
    showToast("Пожалуйста, введите корректный URL.", "warning");
    return;
  }

  const quality = selectedQuality || "Source";

  if (state.isDownloading) {
    if (state.currentUrl === url) {
      showToast("Этот URL уже загружается.", "warning");
      return;
    }

    const alreadyQueued = state.downloadQueue.some((item) => item.url === url);
    if (alreadyQueued) {
      showToast("Этот URL уже есть в очереди.", "info");
      return;
    }

    state.downloadQueue.push({ url, quality });
    showToast("Добавлено в очередь загрузки.", "info");
    urlInput.value = "";
    updateQueueDisplay();
  } else {
    await initiateDownload(url, quality);
  }
};

function initDownloadButton() {
  downloadButton.addEventListener("click", async () => {
    hideUrlActionButtons();
    await handleDownloadButtonClick();
  });
}

export {
  downloadVideo,
  initiateDownload,
  handleDownloadButtonClick,
  initDownloadButton,
  updateQueueDisplay,
};
