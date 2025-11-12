// src/js/modules/downloadProgress.js

import { state } from "./state.js";
import {
  buttonText,
  progressBar,
  progressBarContainer,
} from "./domElements.js";

function initDownloadProgress() {
  let startedAt = null;
  let lastProgress = 0;
  const topProgress = document.getElementById("top-download-progress");
  const topProgressFill = document.getElementById("top-download-progress-fill");
  let topProgressHideTimer = null;

  const resetTopIndicator = () => {
    if (!topProgress || !topProgressFill) return;
    topProgress.classList.remove("is-visible");
    topProgressFill.style.width = "0%";
  };

  const hideTopIndicator = (delay = 600) => {
    if (!topProgress) return;
    clearTimeout(topProgressHideTimer);
    topProgressHideTimer = setTimeout(resetTopIndicator, delay);
  };

  const showTopIndicator = (progress) => {
    if (!topProgress || !topProgressFill) return;
    const normalized = Math.max(0, Math.min(100, progress));
    topProgressFill.style.width = `${normalized}%`;
    topProgress.classList.add("is-visible");
    clearTimeout(topProgressHideTimer);
    if (normalized >= 99.5) {
      hideTopIndicator(900);
    }
  };
  window.electron.onProgress((progressValue) => {
    if (!state.isDownloading) return;
    const progress = Number(progressValue);
    const progressStr = progress.toFixed(1);
    if (startedAt === null || progress < lastProgress) {
      startedAt = Date.now();
    }
    lastProgress = progress;
    // ETA на основе скорости изменения процента
    let suffix = "";
    if (progress > 0 && startedAt) {
      const elapsed = (Date.now() - startedAt) / 1000; // sec
      const rate = progress / Math.max(0.5, elapsed); // %/s
      const remaining = (100 - progress) / Math.max(0.1, rate);
      const mm = Math.floor(remaining / 60);
      const ss = Math.floor(remaining % 60);
      suffix = ` • ~${mm}:${String(ss).padStart(2, "0")}`;
    }
    buttonText.textContent = `Скачивание... ${progressStr}%${suffix}`;
    progressBar.style.width = `${progress}%`;
    if (progressBarContainer) {
      progressBarContainer.setAttribute("aria-valuenow", progressStr);
      try {
        // Отрисуем проценты и ETA прямо на оверлее прогресса
        progressBarContainer.dataset.progress = `${progressStr}%`;
        if (startedAt) {
          const elapsed = (Date.now() - startedAt) / 1000;
          const rate = progress / Math.max(0.5, elapsed); // %/s
          const remaining = (100 - progress) / Math.max(0.1, rate);
          const mm = Math.floor(remaining / 60);
          const ss = Math.floor(remaining % 60);
          progressBarContainer.dataset.eta = `~${mm}:${String(ss).padStart(2, "0")}`;
        } else {
          progressBarContainer.dataset.eta = "";
        }
      } catch {}
    }
    showTopIndicator(progress);
  });

  window.addEventListener("download:state", (event) => {
    if (event?.detail?.isDownloading === false) {
      hideTopIndicator();
    }
  });
}

export { initDownloadProgress };
