/**
 * @file updateHandler.js
 * @description
 * Manages application update notifications and progress UI for Thunder Load.
 * Handles communication with the Electron main process via contextBridge.
 */

import { t } from "./i18n.js";
import { createUpdateFlyoverView } from "./updateFlyoverView.js";

const { electron } = window;

const UP_TO_DATE_HIDE_DELAY_MS = 1800;

let updateFlyover = null;
let updateInfo = { current: null, next: null };
let resizeBound = false;
let upToDateHideTimer = null;
let updateReady = false;

function clearUpToDateTimer() {
  if (upToDateHideTimer) {
    clearTimeout(upToDateHideTimer);
    upToDateHideTimer = null;
  }
}

function getNumberSetting(key, fallback) {
  try {
    const raw = localStorage.getItem(key);
    if (raw === null || raw === undefined) return fallback;
    const value = Number(raw);
    return Number.isFinite(value) ? value : fallback;
  } catch {
    return fallback;
  }
}

function getTailShiftPx() {
  return getNumberSetting("updFlyoverTailShiftPx", 0);
}

function getFlyoverXOffset() {
  return getNumberSetting("updFlyoverXOffsetPx", -8);
}

function getVersionBadge() {
  return (
    document.querySelector(".version-container") ||
    document.getElementById("app-version-label")
  );
}

function removeUpdateIndicator() {
  try {
    getVersionBadge()?.querySelector(".update-indicator")?.remove();
  } catch {}
}

function ensureUpdateIndicator() {
  try {
    const badge = getVersionBadge();
    if (badge && !badge.querySelector(".update-indicator")) {
      const dot = document.createElement("span");
      dot.className = "update-indicator";
      badge.appendChild(dot);
    }
  } catch {}
}

function formatProgress(progress) {
  let percent = progress;
  let bytesPerSecond = 0;
  let transferred = 0;
  let total = 0;

  if (typeof progress === "object" && progress) {
    percent = progress.percent;
    bytesPerSecond = Number(progress.bytesPerSecond || 0);
    transferred = Number(progress.transferred || 0);
    total = Number(progress.total || 0);
  }

  const normalizedPercent = Math.max(0, Math.min(100, Number(percent) || 0));
  const parts = [`${Math.round(normalizedPercent)}%`];

  if (bytesPerSecond > 0) {
    const units = ["B/s", "KB/s", "MB/s", "GB/s"];
    let unitIndex = 0;
    let value = bytesPerSecond;
    while (value >= 1024 && unitIndex < units.length - 1) {
      value /= 1024;
      unitIndex += 1;
    }
    parts.push(
      `${value.toFixed(value >= 100 ? 0 : value >= 10 ? 1 : 2)} ${units[unitIndex]}`,
    );
  }

  if (
    bytesPerSecond > 0 &&
    total > 0 &&
    transferred >= 0 &&
    total > transferred
  ) {
    const eta = Math.max(0, Math.round((total - transferred) / bytesPerSecond));
    const mm = String(Math.floor(eta / 60)).padStart(2, "0");
    const ss = String(eta % 60).padStart(2, "0");
    parts.push(`~${mm}:${ss}`);
  }

  return {
    percent: normalizedPercent,
    label: parts.join(" • "),
  };
}

function classifyErrorType(rawError, forcedType = "") {
  if (forcedType) return forcedType;

  const text = String(rawError || "").toLowerCase();
  if (
    /restart|quitandinstall|quit and install|install|cannot quit|перезапуск|установ/i.test(
      text,
    )
  ) {
    return "install";
  }
  if (
    /network|offline|timeout|timed out|socket|econn|enotfound|fetch|dns|сеть|соединен|таймаут/i.test(
      text,
    )
  ) {
    return "network";
  }
  return "download";
}

function getErrorCopy(type, rawError) {
  const suffix =
    type === "install"
      ? "install"
      : type === "network"
        ? "network"
        : "download";

  const fallbackKey = `update.flyover.error.${suffix}.body`;
  const rawMessage = String(rawError || "").trim();
  const fallbackMessage = t(fallbackKey);

  return {
    title: t(`update.flyover.error.${suffix}.title`),
    message:
      rawMessage && rawMessage !== fallbackMessage
        ? `${fallbackMessage} ${rawMessage}`
        : fallbackMessage,
    canRetry: suffix !== "install",
  };
}

function positionFlyover() {
  const anchor = document.getElementById("app-version-label");
  const flyoverElement = updateFlyover?.getElement();
  if (!anchor || !flyoverElement) return;

  const rect = anchor.getBoundingClientRect();
  const viewportWidth =
    window.innerWidth || document.documentElement.clientWidth || 0;
  const viewportHeight =
    window.innerHeight || document.documentElement.clientHeight || 0;
  const gap = 8;
  const maxEdgePadding = 12;
  const estimatedWidth = flyoverElement.offsetWidth || 380;
  const estimatedHeight = flyoverElement.offsetHeight || 220;
  const unclampedLeft = rect.left + getFlyoverXOffset();
  const maxLeft = Math.max(maxEdgePadding, viewportWidth - estimatedWidth - maxEdgePadding);
  const left = Math.min(Math.max(maxEdgePadding, unclampedLeft), maxLeft);
  const availableBelow = viewportHeight - rect.bottom - gap;
  const availableAbove = rect.top - gap;
  const shouldOpenAbove =
    availableBelow < estimatedHeight && availableAbove > availableBelow;
  const top = shouldOpenAbove
    ? Math.max(maxEdgePadding, rect.top - estimatedHeight - gap)
    : Math.max(maxEdgePadding, rect.bottom + gap);

  flyoverElement.style.left = `${Math.round(left)}px`;
  flyoverElement.style.top = `${Math.round(top)}px`;
  flyoverElement.dataset.placement = shouldOpenAbove ? "top" : "bottom";

  try {
    const flyoverRect = flyoverElement.getBoundingClientRect();
    const tailLeft = Math.max(
      12,
      Math.min(
        rect.left + rect.width / 2 - left - 6 + getTailShiftPx(),
        flyoverRect.width - 24,
      ),
    );
    flyoverElement.style.setProperty("--tail-left", `${Math.round(tailLeft)}px`);
  } catch {}
}

function setReadyBadgeVisible(visible) {
  updateReady = visible;
  updateFlyover?.setReadyBadgeVisible(visible);
}

function ensureFlyover() {
  if (!updateFlyover) {
    updateFlyover = createUpdateFlyoverView({
      onStart: async () => {
        clearUpToDateTimer();
        setReadyBadgeVisible(false);
        const result = await window.electron?.invoke?.("download-update");
        if (result && result.success === false) {
          showErrorPanel(result.error, "download");
          return;
        }
        showProgressPanel(0);
      },
      onRestart: async () => {
        clearUpToDateTimer();
        const result = await window.electron?.invoke?.("restart-app");
        if (result && result.success === false) {
          setReadyBadgeVisible(true);
          showErrorPanel(result.error, "install");
          return;
        }
        setReadyBadgeVisible(false);
      },
      onRetry: async () => {
        clearUpToDateTimer();
        const result = await window.electron?.invoke?.("download-update");
        if (result && result.success === false) {
          showErrorPanel(result.error, "download");
          return;
        }
        showProgressPanel(0);
      },
      onReadyBadgeClick: () => {
        openFlyover();
        updateFlyover.switchState("done");
        updateFlyover.focusPrimaryAction("done");
      },
    });
  }

  updateFlyover.ensure();
  updateFlyover.setReadyBadgeVisible(updateReady);

  if (!resizeBound) {
    resizeBound = true;
    window.addEventListener("resize", positionFlyover);
  }

  return updateFlyover;
}

function openFlyover() {
  ensureFlyover();
  updateFlyover.open();
  positionFlyover();
}

function showAvailable() {
  clearUpToDateTimer();
  openFlyover();
  ensureUpdateIndicator();
  setReadyBadgeVisible(false);
  updateFlyover.switchState("available");
  updateFlyover.setVersions(updateInfo);
}

function showCheckingPanel() {
  clearUpToDateTimer();
  openFlyover();
  removeUpdateIndicator();
  updateFlyover.switchState("checking");
}

function showUpToDatePanel() {
  clearUpToDateTimer();
  openFlyover();
  removeUpdateIndicator();
  updateFlyover.switchState("up-to-date");
  upToDateHideTimer = window.setTimeout(() => {
    if (updateFlyover?.getElement()?.dataset.state === "up-to-date") {
      updateFlyover.close();
    }
    upToDateHideTimer = null;
  }, UP_TO_DATE_HIDE_DELAY_MS);
}

function showProgressPanel(progress) {
  clearUpToDateTimer();
  openFlyover();
  removeUpdateIndicator();
  setReadyBadgeVisible(false);
  updateFlyover.switchState("progress");
  updateFlyover.setVersions(updateInfo);
  const formatted = formatProgress(progress);
  updateFlyover.setProgressValue(formatted.percent);
  updateFlyover.setProgressLabel(formatted.label);
}

function showDownloadedPanel() {
  clearUpToDateTimer();
  openFlyover();
  removeUpdateIndicator();
  setReadyBadgeVisible(true);
  updateFlyover.switchState("done");
  updateFlyover.focusPrimaryAction("done");
}

function showErrorPanel(error, forcedType = "") {
  clearUpToDateTimer();
  openFlyover();
  removeUpdateIndicator();
  const copy = getErrorCopy(classifyErrorType(error, forcedType), error);
  updateFlyover.switchState("error");
  updateFlyover.setError(copy);
}

function handleUpdateMessage(message) {
  const text = String(message || "");
  if (/провер|checking/i.test(text)) {
    showCheckingPanel();
    return;
  }
  if (/не найдено|not available|no updates/i.test(text)) {
    if (updateFlyover?.getElement()?.dataset.state === "checking") {
      showUpToDatePanel();
    }
  }
}

function initUpdateHandler() {
  electron.on("update-available", () => {
    showAvailable();
  });
  electron.on("update-available-info", (payload) => {
    try {
      updateInfo = {
        current: payload?.current || null,
        next: payload?.next || null,
      };
      if (updateFlyover?.isOpen()) {
        updateFlyover.setVersions(updateInfo);
      }
    } catch {}
  });
  electron.on("update-message", (message) => {
    handleUpdateMessage(message);
  });
  electron.on("update-progress", (progress) => {
    showProgressPanel(progress);
  });
  electron.on("update-error", (error) => {
    showErrorPanel(error);
  });
  electron.on("update-downloaded", () => {
    showDownloadedPanel();
  });
}

function updateProgressBar(progress) {
  showProgressPanel(progress ?? 0);
}

export { initUpdateHandler, updateProgressBar };
