import { t } from "./i18n.js";

function getDownloadTabButton() {
  return document.querySelector('.group-menu [data-menu="download"]');
}

function normalizeCount(value, fallback = 0) {
  const parsed = Number.parseInt(String(value ?? ""), 10);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback;
}

function normalizeProgress(value) {
  if (value === null || value === undefined || value === "") return null;
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) return null;
  return Math.max(0, Math.min(100, parsed));
}

function buildDownloadTabLabel({ count, progress }) {
  const base = t("tabs.download");
  const hasCount = Number.isFinite(count) && count > 0;
  const hasProgress = Number.isFinite(progress);

  if (hasCount && hasProgress) {
    return t("tabs.download.progressWithCount", {
      base,
      progress: progress.toFixed(1),
      count,
    });
  }

  if (hasProgress) {
    return t("tabs.download.progressOnly", {
      base,
      progress: progress.toFixed(1),
    });
  }

  if (hasCount) {
    return t("tabs.download.countOnly", {
      base,
      count,
    });
  }

  return base;
}

function syncDownloadTabAccessibility(tab, options = {}) {
  if (!tab) return;

  if (Object.prototype.hasOwnProperty.call(options, "count")) {
    const count =
      options.count === null ? 0 : normalizeCount(options.count, 0);
    if (count > 0) {
      tab.dataset.downloadCount = String(count);
    } else {
      delete tab.dataset.downloadCount;
    }
  }

  if (Object.prototype.hasOwnProperty.call(options, "progress")) {
    const progress =
      options.progress === null ? null : normalizeProgress(options.progress);
    if (progress === null) {
      delete tab.dataset.downloadProgress;
    } else {
      tab.dataset.downloadProgress = progress.toFixed(1);
    }
  }

  const count = normalizeCount(tab.dataset.downloadCount, 0);
  const progress = normalizeProgress(tab.dataset.downloadProgress);
  const label = buildDownloadTabLabel({ count, progress });

  tab.setAttribute("aria-label", label);
  tab.setAttribute("title", label);
  tab.setAttribute("data-bs-original-title", label);
}

function updateDownloadTabProgress(progress, options = {}) {
  const tab = options.tab || getDownloadTabButton();
  if (!tab) return;

  const normalizedProgress = normalizeProgress(progress);
  const ratio =
    normalizedProgress === null ? 0 : Math.max(0, normalizedProgress / 100);

  tab.style.setProperty("--download-tab-progress", ratio.toString());
  tab.classList.toggle(
    "is-progress-active",
    options.active === true && normalizedProgress !== null,
  );
  tab.classList.toggle(
    "is-progress-complete",
    options.complete === true && normalizedProgress !== null,
  );

  syncDownloadTabAccessibility(tab, {
    progress: normalizedProgress,
  });
}

export {
  getDownloadTabButton,
  syncDownloadTabAccessibility,
  updateDownloadTabProgress,
};
