// src/js/modules/downloadProgress.js

import { state } from "./state.js";
import { buttonText, progressBarContainer } from "./domElements.js";
import { getActiveDownloadJobs } from "./downloadJobs.js";
import { t } from "./i18n.js";

function initDownloadProgress() {
  let startedAt = null;
  let displayedProgress = 0;
  const progressByJob = new Map();
  const phaseByJob = new Map();
  let activeCount =
    getActiveDownloadJobs(state).length || (state.isDownloading ? 1 : 0);
  let prevActiveCount = activeCount;
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
    progressByJob.clear();
    phaseByJob.clear();
    if (progressBarContainer) {
      progressBarContainer.style.setProperty("--progress-ratio", "0");
    }
  };

  window.electron.onProgress((progressValue) => {
    const isBusy =
      getActiveDownloadJobs(state).length > 0 || state.isDownloading;
    if (!isBusy && activeCount <= 0) return;

    let normalizedProgress = 0;
    if (typeof progressValue === "number") {
      const progress = Number.isFinite(progressValue) ? progressValue : 0;
      normalizedProgress = Math.max(0, Math.min(100, progress));
      const shouldTreatAsNewSequence =
        displayedProgress >= 99 &&
        normalizedProgress <= 20 &&
        normalizedProgress < displayedProgress;
      if (shouldTreatAsNewSequence) {
        displayedProgress = normalizedProgress;
        startedAt = Date.now();
      }
      displayedProgress = Math.max(displayedProgress, normalizedProgress);
    } else if (progressValue && typeof progressValue === "object") {
      const parsedProgress = Number(progressValue.progress);
      normalizedProgress = Number.isFinite(parsedProgress)
        ? Math.max(0, Math.min(100, parsedProgress))
        : 0;
      const jobId = progressValue.jobId || "__unknown";
      const phase = String(progressValue.phase || "").trim().toLowerCase();
      progressByJob.set(jobId, normalizedProgress);
      if (phase) phaseByJob.set(jobId, phase);
      try {
        window.dispatchEvent(
          new CustomEvent("download:progress-item", {
            detail: {
              jobId,
              progress: normalizedProgress,
              phase,
            },
          }),
        );
      } catch {}
      const activeIds = getActiveDownloadJobs(state)
        .map((item) => item.jobId)
        .filter(Boolean);
      const sourceValues =
        activeIds.length > 0
          ? activeIds.map((id) => progressByJob.get(id) || 0)
          : Array.from(progressByJob.values());
      const total = sourceValues.reduce((acc, value) => acc + value, 0);
      displayedProgress =
        sourceValues.length > 0
          ? total / sourceValues.length
          : normalizedProgress;
    } else {
      return;
    }

    if (startedAt === null) startedAt = Date.now();

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
    const activeIds = getActiveDownloadJobs(state)
      .map((item) => item.jobId)
      .filter(Boolean);
    const primaryPhase =
      activeIds.map((id) => phaseByJob.get(id)).find(Boolean) ||
      Array.from(phaseByJob.values()).find(Boolean) ||
      phaseByJob.get("__unknown") ||
      "";
    const stageKey = primaryPhase ? `queue.stage.${primaryPhase}` : "";
    const stageLabel = stageKey ? t(stageKey) : "";
    if (activeCount > 1) {
      buttonText.textContent = t("download.progress.multi", {
        progress: progressStr,
        count: activeCount,
      });
    } else {
      buttonText.textContent = t(
        stageLabel ? "download.progress.stage" : "download.progress",
        {
          stage: stageLabel,
          progress: progressStr,
          eta: etaSuffix,
        },
      );
    }
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
    const detail = event?.detail || {};
    if (typeof detail.activeCount === "number") {
      activeCount = Math.max(0, detail.activeCount);
    } else if (detail.isDownloading === true) {
      activeCount = Math.max(activeCount, 1);
    } else if (detail.isDownloading === false) {
      activeCount = 0;
    }

    if (prevActiveCount === 0 && activeCount > 0) {
      resetProgressTracking();
      prevActiveCount = activeCount;
      return;
    }
    if (activeCount === 0 && prevActiveCount > 0) {
      hideTopIndicator();
      resetProgressTracking();
      if (progressBarContainer) {
        progressBarContainer.classList.remove("is-complete");
      }
    }
    prevActiveCount = activeCount;
  });
}

export { initDownloadProgress };
