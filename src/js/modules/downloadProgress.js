// src/js/modules/downloadProgress.js

import { state } from "./state.js";
import {
  buttonText,
  progressBar,
  progressBarContainer,
} from "./domElements.js";
import { t } from "./i18n.js";

function initDownloadProgress() {
  let startedAt = null;
  let displayedProgress = 0;
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

  const resetProgressTracking = () => {
    startedAt = null;
    displayedProgress = 0;
    if (progressBarContainer) {
      progressBarContainer.style.setProperty("--progress-ratio", "0");
    }
  };

  window.electron.onProgress((progressValue) => {
    if (!state.isDownloading) return;
    const parsedProgress = Number(progressValue);
    const progress = Number.isFinite(parsedProgress) ? parsedProgress : 0;
    const normalizedProgress = Math.max(0, Math.min(100, progress));
    const shouldTreatAsNewSequence =
      displayedProgress >= 99 &&
      normalizedProgress <= 20 &&
      normalizedProgress < displayedProgress;
    if (shouldTreatAsNewSequence) {
      displayedProgress = normalizedProgress;
      startedAt = Date.now();
    }
    if (startedAt === null) {
      startedAt = Date.now();
    }
    displayedProgress = Math.max(displayedProgress, normalizedProgress);
    const progressStr = displayedProgress.toFixed(1);
    // ETA на основе скорости изменения процента
    let etaLabel = "";
    if (displayedProgress > 0 && startedAt) {
      const elapsed = (Date.now() - startedAt) / 1000; // sec
      const rate = displayedProgress / Math.max(0.5, elapsed); // %/s
      const remaining = (100 - displayedProgress) / Math.max(0.1, rate);
      const mm = Math.floor(remaining / 60);
      const ss = Math.floor(remaining % 60);
      const time = `${mm}:${String(ss).padStart(2, "0")}`;
      etaLabel = t("download.eta", { time });
    }
    const etaSuffix = etaLabel ? ` ${etaLabel}` : "";
    buttonText.textContent = t("download.progress", {
      progress: progressStr,
      eta: etaSuffix,
    });
    if (progressBarContainer) {
      progressBarContainer.style.setProperty(
        "--progress-ratio",
        (displayedProgress / 100).toString(),
      );
    }
    if (progressBarContainer) {
      progressBarContainer.setAttribute("aria-valuenow", progressStr);
      progressBarContainer.classList.toggle(
        "is-complete",
        displayedProgress >= 99.5,
      );
    }
    showTopIndicator(displayedProgress);
  });

  window.addEventListener("download:state", (event) => {
    if (event?.detail?.isDownloading === true) {
      resetProgressTracking();
      return;
    }
    if (event?.detail?.isDownloading === false) {
      hideTopIndicator();
      resetProgressTracking();
      if (progressBarContainer) {
        progressBarContainer.classList.remove("is-complete");
      }
    }
  });
}

export { initDownloadProgress };
