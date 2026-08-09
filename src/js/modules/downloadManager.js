// src/js/modules/downloadManager.js

import { historyContainer } from "./domElements.js";
import { state, updateButtonState } from "./state.js";
import { showLoading, showToast } from "./toast.js";
import { addNewEntryToHistory, getHistoryData } from "./history.js";
import {
  loadHistoryEntries,
  saveHistoryEntries,
} from "./features/history/repositoryClient.js";
import { isValidUrl, isSupportedUrl, normalizeUrlInput } from "./validation.js";
import {
  urlInput,
  downloadButton,
  enqueueButton,
  downloadCancelButton,
  buttonText,
  progressBarContainer,
  openLastVideoButton,
  queueStartButton,
  queuePauseButton,
  queueToggleButton,
  queueClearButton,
  queueRetryFailedButton,
} from "./domElements.js";
import { openDownloadQualityModal } from "./downloadQualityModal.js";
import {
  isCompactDownloaderMode,
  resolveCompactQualityPayload,
} from "./compactDownloaderQuality.js";
import { initTooltips } from "./tooltipInitializer.js";
import { showConfirmationDialog } from "./modals.js";
import { t } from "./i18n.js";
import { syncDownloadTabAccessibility } from "./downloadTabUi.js";
import { getCachedVideoInfo } from "./videoInfoCache.js";
import { getVideoInfo, getVideoPreview } from "./videoInfoBroker.js";
import {
  formatDownloadErrorToast,
  formatDownloadQueueReason,
  getDownloadErrorDetails,
} from "./downloadErrorUi.js";
import {
  clearDownloadJobsByStatus,
  JOB_STATUS,
  ensureDownloadJobsState,
  findDownloadJob,
  getActiveDownloadJobs,
  getFailedDownloadJobs,
  getPendingDownloadJobs,
  patchDownloadJob,
  removeDownloadJob,
  replaceDownloadJobsByStatus,
  setDownloadJobs,
  upsertDownloadJob,
} from "./downloadJobs.js";
import {
  loadCompletedJobs,
  persistCompletedJobs,
} from "./downloadQueuePersistence.js";
import {
  getDownloadQueueFilter,
  initDownloadQueueFilter,
  syncQueueFilterControls,
} from "./downloadQueueFilter.js";
import { normalizeWebQualitySelection } from "./webQualitySelection.js";
import { applyUiState } from "./uiStateController.js";
import { readQueueJobs, writeQueueJobs } from "./features/queue/persistence.js";
import { getQueueCounts } from "./features/queue/controller.js";
import {
  createWebControlQueueSnapshot,
  normalizeWebControlQuality as adaptWebControlQuality,
} from "./features/queue/webControlAdapter.js";
import { createIncrementalQueueRenderer } from "./features/queue/renderer.js";

const queueInfo = document.getElementById("download-queue-info");
const queueIndicator = document.getElementById("queue-start-indicator");
const queueList = document.getElementById("queue-list");
const cancelCountBadge = document.getElementById("download-cancel-count");
const jobSummary = document.getElementById("downloader-job-summary");
const jobSummaryTitle = document.getElementById("downloader-job-summary-title");
const jobSummaryMeta = document.getElementById("downloader-job-summary-meta");
const QUEUE_LOG_TAG = "[queue]";
const HISTORY_SAVE_ERROR_CODE = "HISTORY_SAVE_FAILED";

let downloadedUrlCache = { ts: 0, map: new Map() };
let lastDownloadIntentWarmup = { url: "", ts: 0 };
let webClearUndo = null;
const DOWNLOAD_INTENT_WARMUP_RETRY_MS = 30 * 1000;

function updateDownloaderTabLabel() {
  try {
    const tab = document.querySelector('.group-menu [data-menu="download"]');
    if (!tab) return;
    const label = tab.querySelector(".menu-text");
    const badge = tab.querySelector(".menu-badge");
    if (!label) return;
    const activeCount = getActiveDownloadJobs(state).length;
    const failedCount = getFailedDownloadJobs(state).length;
    const count =
      activeCount + getPendingDownloadJobs(state).length + failedCount;
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
    syncDownloadTabAccessibility(tab, { count });
  } catch (_e) {
    // no-op
  }
}

// === Queue helpers ===
const QUEUE_MAX = 200;
const QUEUE_STORAGE_KEY = "downloadQueue";
const QUEUE_FAILED_STORAGE_KEY = "downloadFailedQueue";
const QUEUE_COLLAPSED_STORAGE_KEY = "downloadQueueCollapsed";
const QUEUE_PAUSED_STORAGE_KEY = "downloadQueuePaused";
const PARALLEL_DOWNLOAD_LIMIT = 2;
const PROGRESS_RENDER_THROTTLE_MS = 220;
const QUEUE_MAX_LABEL_LEN = 64;
let lastProgressRenderTs = 0;
const queueRenderer = queueList
  ? createIncrementalQueueRenderer(queueList)
  : null;
let queueItemIdCounter = 1;
const queueTitleRequestsInFlight = new Map();
const queuePumpReservations = new Set();
const cancellingDownloadJobIds = new Set();
let downloadPoolLoadingToast = null;
let downloadPoolLoadingToastElement = null;
let downloadPoolToastDismissed = false;
let downloadPoolSessionActive = false;
let downloadPoolSessionSucceeded = 0;
let downloadPoolSessionBlocked = false;

function beginDownloadPoolSession() {
  downloadPoolSessionActive = true;
  downloadPoolToastDismissed = false;
  downloadPoolSessionSucceeded = 0;
  downloadPoolSessionBlocked = false;
}

function recordDownloadPoolResult(result) {
  if (!downloadPoolSessionActive) return;
  if (result?.ok) {
    downloadPoolSessionSucceeded += 1;
    return;
  }
  downloadPoolSessionBlocked = true;
}

function blockDownloadPoolSuccess() {
  if (downloadPoolSessionActive) downloadPoolSessionBlocked = true;
}

function getDownloadPoolToastContent() {
  const activeItems = getActiveDownloadJobs(state);
  if (activeItems.length <= 1) {
    const current = activeItems[0];
    const stage = current?.stage || "prepare";
    const progress = Math.round(
      Math.max(0, Math.min(100, Number(current?.progress) || 0)),
    );
    if (stage === "prepare" && progress === 0) {
      return {
        title: t("download.loading.title"),
        message: t("download.loading.message"),
      };
    }
    return {
      title: t(`download.loading.stage.${stage}.title`),
      message: t(`download.loading.stage.${stage}.message`, { progress }),
    };
  }

  const progressTotal = activeItems.reduce(
    (total, item) =>
      total + Math.max(0, Math.min(100, Number(item.progress) || 0)),
    0,
  );
  const stageCounts = activeItems.reduce(
    (counts, item) => {
      const stage =
        item.stage === "download" || item.stage === "finalize"
          ? item.stage
          : "prepare";
      counts[stage] += 1;
      return counts;
    },
    { prepare: 0, download: 0, finalize: 0 },
  );
  return {
    title: t("download.loading.parallel.title", {
      count: activeItems.length,
    }),
    message: t("download.loading.parallel.message", {
      progress: Math.round(progressTotal / activeItems.length),
      preparing: stageCounts.prepare,
      downloading: stageCounts.download,
      finalizing: stageCounts.finalize,
    }),
  };
}

function dismissDownloadPoolToast() {
  downloadPoolToastDismissed = true;
  downloadPoolLoadingToast = null;
  downloadPoolLoadingToastElement = null;
}

function attachDownloadPoolToastDismissHandlers(toastElement) {
  if (!toastElement) return;
  toastElement
    .querySelector(".toast-close")
    ?.addEventListener("click", dismissDownloadPoolToast);
  toastElement.addEventListener("keydown", (event) => {
    if (event.key === "Escape") dismissDownloadPoolToast();
  });
}

function openDownloadPoolToast() {
  if (typeof showLoading !== "function") return;
  const content = getDownloadPoolToastContent();
  const existingToasts = new Set(document.querySelectorAll(".toast-loading"));
  downloadPoolLoadingToast = showLoading(content.message, content.title);
  downloadPoolLoadingToastElement =
    Array.from(document.querySelectorAll(".toast-loading")).find(
      (toast) => !existingToasts.has(toast),
    ) || null;
  attachDownloadPoolToastDismissHandlers(downloadPoolLoadingToastElement);
}

function syncDownloadPoolToast() {
  const activeCount = getActiveDownloadJobs(state).length;
  if (activeCount === 0) {
    if (!downloadPoolSessionActive) return;
    const shouldShowSuccess =
      downloadPoolSessionSucceeded > 0 && !downloadPoolSessionBlocked;
    downloadPoolLoadingToast?.close?.();
    downloadPoolLoadingToast = null;
    downloadPoolLoadingToastElement = null;
    downloadPoolToastDismissed = false;
    downloadPoolSessionActive = false;
    downloadPoolSessionSucceeded = 0;
    downloadPoolSessionBlocked = false;
    if (shouldShowSuccess) {
      showToast(
        t("download.complete.sessionMessage"),
        "success",
        5500,
        t("download.complete.title"),
      );
    }
    return;
  }

  if (!downloadPoolSessionActive) {
    beginDownloadPoolSession();
  }
  if (downloadPoolToastDismissed) return;
  if (
    downloadPoolLoadingToastElement &&
    (!downloadPoolLoadingToastElement.isConnected ||
      downloadPoolLoadingToastElement.classList.contains("hide"))
  ) {
    dismissDownloadPoolToast();
    return;
  }
  if (!downloadPoolLoadingToast) {
    openDownloadPoolToast();
    return;
  }
  const content = getDownloadPoolToastContent();
  downloadPoolLoadingToast.update?.(content.message, content.title);
}

const escapeQueueHtml = (value) =>
  String(value || "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");

const makeQueueUrlLabel = (url) => {
  try {
    const parsed = new URL(url);
    const base = `${parsed.hostname}${parsed.pathname}`;
    return base.length > QUEUE_MAX_LABEL_LEN
      ? `${base.slice(0, QUEUE_MAX_LABEL_LEN - 1)}…`
      : base;
  } catch {
    const raw = String(url || "");
    return raw.length > QUEUE_MAX_LABEL_LEN
      ? `${raw.slice(0, QUEUE_MAX_LABEL_LEN - 1)}…`
      : raw;
  }
};

function getQueueReasonLabel(item) {
  if (item?.errorCode === HISTORY_SAVE_ERROR_CODE) {
    return t("queue.reason.historySaveFailed");
  }
  return formatDownloadQueueReason(
    item?.errorCode
      ? {
          errorCode: item.errorCode,
          message: item.reason || "",
          retryable: item.retryable,
        }
      : item?.reason || "",
  );
}

function getQueueRetryStateLabel(item) {
  return item?.retryable
    ? t("queue.retryState.retryable")
    : t("queue.retryState.needsAction");
}

const makeQueueTitle = (url) => {
  const cached = getCachedVideoInfo(url);
  const title = cached?.title ? String(cached.title) : "";
  return title.length > QUEUE_MAX_LABEL_LEN
    ? `${title.slice(0, QUEUE_MAX_LABEL_LEN - 1)}…`
    : title;
};

async function ensureQueueTitle(url, opts = {}) {
  const { jobId = "", signature = "", onResolved = null } = opts;
  const notifyResolved = (title) => {
    if (!title || typeof onResolved !== "function") return;
    try {
      onResolved(title);
    } catch {}
  };
  const cacheTitle = makeQueueTitle(url);
  if (cacheTitle) {
    notifyResolved(cacheTitle);
    return cacheTitle;
  }
  const key = signature || `${normalizeUrl(url)}::title`;
  if (queueTitleRequestsInFlight.has(key)) {
    return queueTitleRequestsInFlight.get(key).then((title) => {
      notifyResolved(title);
      return title;
    });
  }
  const invokeResult = getVideoPreview(url);
  if (!invokeResult || typeof invokeResult.then !== "function") {
    return "";
  }
  const request = invokeResult
    .then((info) => {
      if (!info?.success || !info?.title) return "";
      const title = String(info.title).trim();
      if (!title) return "";
      if (jobId) {
        const active = findActiveDownload(jobId);
        if (active && !active.title) {
          active.title = title;
          updateQueueDisplay();
        }
      }
      notifyResolved(title);
      return title;
    })
    .catch(() => "")
    .finally(() => {
      queueTitleRequestsInFlight.delete(key);
    });
  queueTitleRequestsInFlight.set(key, request);
  return request;
}

function warmupDownloadIntentInfo() {
  if (
    downloadButton?.disabled ||
    downloadButton?.classList?.contains("disabled")
  ) {
    return;
  }
  const candidate = normalizeUrlInput(urlInput?.value || "").trim();
  if (!candidate || !isValidUrl(candidate) || !isSupportedUrl(candidate))
    return;
  const url = normalizeUrl(candidate);
  const cached = getCachedVideoInfo(url);
  if (
    cached?.success &&
    Array.isArray(cached.formats) &&
    cached.formats.length
  ) {
    return;
  }
  const now = Date.now();
  if (
    lastDownloadIntentWarmup.url === url &&
    now - lastDownloadIntentWarmup.ts < DOWNLOAD_INTENT_WARMUP_RETRY_MS
  ) {
    return;
  }
  lastDownloadIntentWarmup = { url, ts: now };
  void getVideoInfo(url).catch(() => {});
}

function shouldWarmQueueFormats(quality) {
  if (!quality || typeof quality !== "object") return false;
  return Boolean(
    quality.formatId ||
    quality.videoFormatId ||
    quality.audioFormatId ||
    quality.video?.format_id ||
    quality.audio?.format_id,
  );
}

function ensureQueueFormatsReady(url, quality) {
  if (!url || !shouldWarmQueueFormats(quality)) return;
  void getVideoInfo(url).catch(() => {
    // download-video will surface the same source error in the normal flow.
  });
}

function refreshPendingQueueTitles() {
  const pendingJobs = getPendingDownloadJobs(state);
  if (pendingJobs.length === 0) {
    return;
  }
  for (const item of pendingJobs) {
    if (!item?.url || item?.title) continue;
    const signature = getQueueSignature(item.url, item.quality);
    void ensureQueueTitle(item.url, {
      signature,
      onResolved: (title) => {
        const pendingJob = findDownloadJob(state, signature);
        if (!title || pendingJob?.title === title || item.title === title)
          return;
        patchDownloadJob(state, signature, { title });
        item.title = title;
        persistQueue();
        updateQueueDisplay();
      },
    });
  }
}

const QUEUE_COLORS = {
  cardBg: "rgba(255,255,255,0.04)",
  cardBorder: "rgba(255,255,255,0.07)",
  start: "#4a9eff",
  pause: "rgba(255,255,255,0.22)",
  clear: "rgba(255,105,105,0.78)",
  status: {
    downloading: {
      bg: "rgba(74,158,255,0.18)",
      border: "rgba(74,158,255,0.35)",
      color: "#8fc1ff",
      icon: "loader-circle",
    },
    pending: {
      bg: "rgba(255,255,255,0.08)",
      border: "rgba(255,255,255,0.15)",
      color: "rgba(255,255,255,0.78)",
      icon: "clock-3",
    },
    paused: {
      bg: "rgba(245,196,66,0.15)",
      border: "rgba(245,196,66,0.35)",
      color: "#f5c442",
      icon: "pause",
    },
    done: {
      bg: "rgba(81,203,132,0.16)",
      border: "rgba(81,203,132,0.35)",
      color: "#88e3a3",
      icon: "check-circle-2",
    },
    error: {
      bg: "rgba(255,99,99,0.14)",
      border: "rgba(255,99,99,0.34)",
      color: "#ff8d8d",
      icon: "alert-circle",
    },
  },
};

function applyLucideIcons() {
  try {
    const api = window?.lucide;
    if (!api?.createIcons || !api?.icons) return;
    api.createIcons({ icons: api.icons });
  } catch {}
}

function nextQueueItemId() {
  const id = `q-${Date.now()}-${queueItemIdCounter++}`;
  return id;
}

function detectSource(url) {
  const raw = String(url || "").toLowerCase();
  if (raw.includes("youtube.com") || raw.includes("youtu.be")) {
    return {
      label: "YouTube",
      color: "#ff4f58",
      bg: "rgba(255,79,88,0.16)",
    };
  }
  if (raw.includes("vimeo.com")) {
    return { label: "Vimeo", color: "#59d2ff", bg: "rgba(89,210,255,0.16)" };
  }
  if (raw.includes("coub.com")) {
    return { label: "Coub", color: "#59d2ff", bg: "rgba(89,210,255,0.16)" };
  }
  try {
    const host = new URL(url).hostname.replace(/^www\./, "");
    return {
      label: host.split(".")[0]?.slice(0, 1).toUpperCase() || "S",
      color: "#a6c0ff",
      bg: "rgba(166,192,255,0.16)",
    };
  } catch {
    return { label: "S", color: "#a6c0ff", bg: "rgba(166,192,255,0.16)" };
  }
}

function normalizeQueueItem(item) {
  const url = String(item?.url || "").trim();
  const quality = item?.quality;
  const signature = item?.signature || getQueueSignature(url, quality);
  const identity = item?.jobId || item?.id || signature || nextQueueItemId();
  const title = String(item?.title || makeQueueTitle(url) || "");
  const downloadType =
    item?.type === "audio" || resolveDownloadKind(quality) === "audio"
      ? "audio"
      : "video";
  const status = item?.status || "pending";
  return {
    id: item?.id || identity,
    jobId: item?.jobId || item?.id || signature,
    title,
    url,
    quality,
    type: downloadType,
    status,
    progress: Number(item?.progress) || 0,
    size: item?.size ? String(item.size) : "",
    filePath: item?.filePath ? String(item.filePath) : "",
    stage: item?.stage ? String(item.stage) : "",
    signature,
    reason: item?.reason ? String(item.reason) : "",
    errorCode: item?.errorCode ? String(item.errorCode) : "",
    retryable:
      typeof item?.retryable === "boolean" ? item.retryable : undefined,
    failedAt: Number(item?.failedAt) || 0,
    createdAt: Number(item?.createdAt) || 0,
  };
}

const getQueueItemIdentity = (item = {}) =>
  String(item.jobId || item.id || item.signature || "").trim();

const findPendingQueueIndex = (identity) =>
  getPendingDownloadJobs(state).findIndex(
    (item) => getQueueItemIdentity(item) === identity,
  );

const findQueueRow = (identity) =>
  Array.from(
    queueList?.querySelectorAll(".queue-item[data-job-id]") || [],
  ).find((row) => row.dataset.jobId === identity) || null;

function formatEtaEstimate(createdAt, progress) {
  const pct = Number(progress);
  const started = Number(createdAt);
  if (!Number.isFinite(pct) || pct <= 0 || pct >= 100) return "";
  if (!Number.isFinite(started) || started <= 0) return "";
  const elapsed = Math.max(1, (Date.now() - started) / 1000);
  const rate = pct / elapsed;
  if (!Number.isFinite(rate) || rate <= 0) return "";
  const remaining = Math.max(0, (100 - pct) / rate);
  const hours = Math.floor(remaining / 3600);
  const minutes = Math.floor((remaining % 3600) / 60);
  const seconds = Math.floor(remaining % 60);
  const time =
    hours > 0
      ? `${hours}:${String(minutes).padStart(2, "0")}:${String(seconds).padStart(2, "0")}`
      : `${minutes}:${String(seconds).padStart(2, "0")}`;
  return t("queue.meta.eta", { time });
}

function syncDownloadState() {
  const activeCount = getActiveDownloadJobs(state).length;
  const failedCount = getFailedDownloadJobs(state).length;
  const maxActive =
    Number(state.maxParallelDownloads) || PARALLEL_DOWNLOAD_LIMIT;
  state.queuePaused = Boolean(state.suppressAutoPump);
  state.isDownloading = activeCount > 0;
  if (activeCount > 0 && buttonText) {
    buttonText.textContent = t("download.pool.status", {
      active: activeCount,
      max: maxActive,
    });
  }
  if (downloadCancelButton) {
    const title = t("actions.cancelDownloadAll", { count: activeCount });
    downloadCancelButton.setAttribute("title", title);
    downloadCancelButton.setAttribute("aria-label", title);
    downloadCancelButton.setAttribute("data-bs-original-title", title);
  }
  if (cancelCountBadge) {
    cancelCountBadge.textContent = String(activeCount);
    cancelCountBadge.classList.toggle("hidden", activeCount <= 0);
  }
  updateButtonState();
  updateQueueDisplay();
  try {
    window.dispatchEvent(
      new CustomEvent("download:state", {
        detail: {
          isDownloading: state.isDownloading,
          activeCount,
          failedCount,
          paused: Boolean(state.suppressAutoPump),
        },
      }),
    );
  } catch {}
  updateDownloaderTabLabel();
}

function updateDownloadJobSummary() {
  if (!jobSummary || !jobSummaryTitle || !jobSummaryMeta) return;
  const activeItems = getActiveDownloadJobs(state);
  const activeCount = activeItems.length;
  const current = activeItems[0];
  const latestFailed = getFailedDownloadJobs(state)[0];
  if (!current) {
    if (!latestFailed) {
      jobSummary.classList.add("hidden");
      jobSummaryTitle.textContent = t("downloader.jobSummary.idle");
      jobSummaryMeta.textContent = t("downloader.jobSummary.idleMeta");
      applyUiState(jobSummary, { kind: "empty" });
      const badge = document.getElementById("downloader-job-summary-badge");
      if (badge) badge.textContent = t("downloader.jobSummary.badge");
      return;
    }
    const failedTitle =
      String(latestFailed.title || "").trim() ||
      makeQueueTitle(latestFailed.url) ||
      makeQueueUrlLabel(latestFailed.url);
    const badge = document.getElementById("downloader-job-summary-badge");
    if (badge) badge.textContent = t("downloader.jobSummary.badgeError");
    jobSummary.classList.remove("hidden");
    jobSummaryTitle.textContent =
      failedTitle || t("downloader.jobSummary.idle");
    jobSummaryMeta.textContent = [
      getQueueReasonLabel(latestFailed),
      getQueueRetryStateLabel(latestFailed),
    ].join(" · ");
    applyUiState(jobSummary, {
      kind: "error",
      operationId: latestFailed.jobId || latestFailed.id,
    });
    return;
  }
  const title =
    String(current.title || "").trim() ||
    makeQueueTitle(current.url) ||
    makeQueueUrlLabel(current.url);
  const stageKey = current.stage
    ? `queue.stage.${String(current.stage).trim().toLowerCase()}`
    : "";
  const metaParts = [];
  if (stageKey) {
    metaParts.push(t(stageKey));
  }
  if (Number.isFinite(Number(current.progress))) {
    metaParts.push(
      `${Math.max(0, Math.min(100, Number(current.progress))).toFixed(0)}%`,
    );
  }
  const etaLabel = formatEtaEstimate(current.createdAt, current.progress);
  if (etaLabel) {
    metaParts.push(etaLabel);
  }
  metaParts.push(t("queue.pill.active", { count: activeCount }));
  const badge = document.getElementById("downloader-job-summary-badge");
  if (badge) badge.textContent = t("downloader.jobSummary.badge");
  jobSummary.classList.remove("hidden");
  jobSummaryTitle.textContent = title || t("downloader.jobSummary.idle");
  jobSummaryMeta.textContent = metaParts.join(" · ");
  applyUiState(jobSummary, {
    kind: "loading",
    operationId: current.jobId || current.id,
  });
}

function findActiveDownload(jobId) {
  return (
    getActiveDownloadJobs(state).find((item) => item.jobId === jobId) || null
  );
}

function addActiveDownload(entry) {
  upsertDownloadJob(state, {
    ...entry,
    status: JOB_STATUS.running,
    stage: entry?.stage || "prepare",
  });
  syncDownloadState();
  syncDownloadPoolToast();
}

function getCurrentDownloadSignatures() {
  return new Set(
    getActiveDownloadJobs(state)
      .map((item) => item.signature)
      .filter(Boolean),
  );
}

function getFailedSignatures() {
  return new Set(
    getFailedDownloadJobs(state).map((item) =>
      getQueueSignature(item.url, item.quality),
    ),
  );
}

function getRetryableFailedJobs() {
  return getFailedDownloadJobs(state).filter(
    (item) => item.retryable !== false,
  );
}

function removeFailedBySignature(signature) {
  if (!signature) return;
  removeDownloadJob(
    state,
    (item) =>
      item.status === JOB_STATUS.failed &&
      getQueueSignature(item.url, item.quality) === signature,
  );
  persistFailedQueue();
}

function persistQueue() {
  const pendingJobs = getPendingDownloadJobs(state);
  const count = writeQueueJobs(
    window.localStorage,
    QUEUE_STORAGE_KEY,
    pendingJobs,
  );
  if (count) console.log(QUEUE_LOG_TAG, "persist", { count });
}

function persistFailedQueue() {
  writeQueueJobs(
    window.localStorage,
    QUEUE_FAILED_STORAGE_KEY,
    getFailedDownloadJobs(state),
  );
}

function persistAllQueueCollections() {
  persistQueue();
  persistFailedQueue();
}

function showQueueRemovalUndo(removedJobs, messageKey, options = {}) {
  const snapshot = (removedJobs || []).map((job) => ({ ...job }));
  if (!snapshot.length) return;
  const pausedBeforeRemoval = Boolean(options.pausedBeforeRemoval);
  showToast(t(messageKey), "info", 8000, null, () => {
    const current = ensureDownloadJobsState(state).map((job) => ({ ...job }));
    const restoredIds = new Set(
      snapshot.map((job) => String(job.jobId || job.id || job.signature)),
    );
    setDownloadJobs(state, [
      ...snapshot,
      ...current.filter(
        (job) => !restoredIds.has(String(job.jobId || job.id || job.signature)),
      ),
    ]);
    if (options.restorePauseState) {
      state.suppressAutoPump = pausedBeforeRemoval;
      state.queuePaused = pausedBeforeRemoval;
      persistQueuePausedState();
    }
    persistAllQueueCollections();
    updateQueueDisplay();
    showToast(t("queue.undo.restored"), "success");
  });
}

function readQueueCollapsedState() {
  try {
    return window.localStorage.getItem(QUEUE_COLLAPSED_STORAGE_KEY) === "1";
  } catch {
    return false;
  }
}

function persistQueueCollapsedState() {
  try {
    if (state.queueCollapsed) {
      window.localStorage.setItem(QUEUE_COLLAPSED_STORAGE_KEY, "1");
      return;
    }
    window.localStorage.removeItem(QUEUE_COLLAPSED_STORAGE_KEY);
  } catch {}
}

function readQueuePausedState() {
  try {
    return window.localStorage.getItem(QUEUE_PAUSED_STORAGE_KEY) === "1";
  } catch {
    return false;
  }
}

function persistQueuePausedState() {
  try {
    if (state.suppressAutoPump) {
      window.localStorage.setItem(QUEUE_PAUSED_STORAGE_KEY, "1");
      return;
    }
    window.localStorage.removeItem(QUEUE_PAUSED_STORAGE_KEY);
  } catch {}
}

function loadQueueFromStorage() {
  const parsed = readQueueJobs(
    window.localStorage,
    QUEUE_STORAGE_KEY,
    (item) => item,
  );
  const unique = new Set();
  const restored = [];
  const activeSignatures = getCurrentDownloadSignatures();
  for (const item of parsed) {
    const normalized = normalizeQueueItem(item);
    const url = normalized.url;
    const quality = normalized.quality;
    if (!isValidUrl(url) || !isSupportedUrl(url)) continue;
    const signature = getQueueSignature(url, quality);
    if (!signature || activeSignatures.has(signature) || unique.has(signature))
      continue;
    if (restored.length >= QUEUE_MAX) break;
    unique.add(signature);
    restored.push({ ...normalized, status: "pending" });
  }
  console.log(QUEUE_LOG_TAG, "restore", {
    stored: parsed.length,
    restored: restored.length,
  });
  return restored;
}

function loadFailedQueueFromStorage() {
  const parsed = readQueueJobs(
    window.localStorage,
    QUEUE_FAILED_STORAGE_KEY,
    (item) => item,
  );
  return parsed
    .filter(
      (item) =>
        isValidUrl(item?.url) &&
        isSupportedUrl(item?.url) &&
        item?.quality !== undefined,
    )
    .slice(0, QUEUE_MAX)
    .map((item) => ({ ...normalizeQueueItem(item), status: "error" }));
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
  if (
    explicitKind === "audio" ||
    explicitKind === "video" ||
    explicitKind === "subtitle"
  ) {
    return explicitKind;
  }
  const payloadType =
    payloadOrEntry?.type || payloadOrEntry?.payload?.type || "";
  if (payloadType === "subtitle-only") return "subtitle";
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
  if (quality?.type === "subtitle-only") return t("quality.label.subtitles");
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

async function filterHistoryEntriesWithExistingFiles(entries = []) {
  const filePaths = Array.from(
    new Set(entries.map((entry) => entry?.filePath).filter(Boolean)),
  );
  if (!filePaths.length) return entries;
  try {
    const result = await window.electron.invoke(
      "history:inspect-files",
      filePaths,
    );
    if (result?.success === false) {
      throw new Error(result.error || "History file inspection failed");
    }
    const availability = new Map(
      (result?.files || []).map((item) => [item.filePath, item.exists]),
    );
    return entries.filter(
      (entry) => !entry?.filePath || availability.get(entry.filePath) !== false,
    );
  } catch (error) {
    console.warn("Failed to inspect history files:", error);
    return entries;
  }
}

function getDownloadedUrlMapSync() {
  try {
    const entries = getHistoryData();
    return buildDownloadedUrlMap(Array.isArray(entries) ? entries : []);
  } catch {
    return new Map();
  }
}

async function getDownloadedUrlMap() {
  const now = Date.now();

  let entries = [];
  try {
    const local = getHistoryData();
    if (Array.isArray(local) && local.length > 0) {
      entries = local;
    } else {
      entries = await loadHistoryEntries();
    }
  } catch (error) {
    console.warn("Failed to load history for duplicate detection:", error);
    entries = [];
  }
  const existingFileEntries =
    await filterHistoryEntriesWithExistingFiles(entries);
  downloadedUrlCache = {
    ts: now,
    map: buildDownloadedUrlMap(existingFileEntries),
  };
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
  ensureDownloadJobsState(state);
  const activeSignatures = getCurrentDownloadSignatures();
  const failedSignatures = getFailedSignatures();
  const existing = new Set(
    getPendingDownloadJobs(state).map((it) =>
      getQueueSignature(it.url, it.quality),
    ),
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
    if (activeSignatures.has(signature)) {
      activeDup++;
      continue;
    }
    if (failedSignatures.has(signature)) {
      duplicates++;
      continue;
    }
    if (existing.has(signature)) {
      duplicates++;
      continue;
    }
    if (getPendingDownloadJobs(state).length >= QUEUE_MAX) {
      capped++;
      continue;
    }
    const queueItem = normalizeQueueItem({
      url: raw,
      quality,
      status: "pending",
    });
    upsertDownloadJob(state, {
      ...queueItem,
      status: JOB_STATUS.pending,
    });
    void ensureQueueTitle(raw, {
      signature,
      onResolved: (title) => {
        const pendingJob = findDownloadJob(state, signature);
        if (!title || !pendingJob || pendingJob.title === title) return;
        patchDownloadJob(state, signature, { title });
        persistQueue();
        updateQueueDisplay();
      },
    });
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

const getQueueStatusMeta = (status, progress) => {
  const statusMap = {
    downloading: {
      label: t("queue.status.downloading"),
      icon: "loader-circle",
    },
    pending: { label: t("queue.status.pending"), icon: "clock-3" },
    paused: { label: t("queue.status.paused"), icon: "pause" },
    error: { label: t("queue.status.error"), icon: "alert-circle" },
  };
  const theme = QUEUE_COLORS.status[status] || QUEUE_COLORS.status.pending;
  return {
    label:
      status === "downloading"
        ? `${statusMap[status].label} ${Math.max(0, Math.min(100, Number(progress) || 0)).toFixed(0)}%`
        : statusMap[status].label,
    icon: statusMap[status]?.icon || "clock-3",
    style: `background:${theme.bg};border:1px solid ${theme.border};color:${theme.color};`,
  };
};

const getQueueProgressRenderData = (item) => {
  const stageChipLabel =
    item.status === "downloading" && item.stage
      ? t(`queue.stage.${item.stage}`)
      : "";
  const eta =
    item.status === "downloading"
      ? formatEtaEstimate(item.createdAt, item.progress)
      : "";
  return {
    progress: item.progress,
    progressLabel: getQueueStatusMeta(item.status, item.progress).label,
    stageLabel: stageChipLabel ? ` · ${stageChipLabel}` : "",
    stageChipLabel,
    etaLabel: eta ? ` · ${eta}` : "",
  };
};

function updateQueueDisplay() {
  ensureDownloadJobsState(state);
  const activeItems = getActiveDownloadJobs(state).map((item) =>
    normalizeQueueItem({
      id: item.jobId,
      title: item.title || makeQueueTitle(item.url),
      url: item.url,
      quality: item.quality,
      type: resolveDownloadKind(item.quality),
      status: "downloading",
      progress: Number(item.progress) || 0,
      size: item.size || "",
      filePath: item.filePath || "",
      stage: item.stage || "prepare",
      createdAt: item.createdAt || 0,
    }),
  );
  const pendingItems = getPendingDownloadJobs(state).map((item) =>
    normalizeQueueItem({
      ...item,
      status:
        item.status === JOB_STATUS.paused || state.suppressAutoPump
          ? "paused"
          : "pending",
    }),
  );
  const errorItems = getFailedDownloadJobs(state).map((item) =>
    normalizeQueueItem({ ...item, status: "error" }),
  );
  const counts = getQueueCounts(state);
  const activeCount = counts.active;
  const pendingCount = counts.pending;
  const totalVisible = activeCount + pendingCount + errorItems.length;
  const hasQueueItems = totalVisible > 0;
  const activeJobIds = new Set(
    activeItems.map((item) => item.jobId || item.id).filter(Boolean),
  );
  for (const jobId of cancellingDownloadJobIds) {
    if (!activeJobIds.has(jobId)) cancellingDownloadJobIds.delete(jobId);
  }

  state.queuePaused = Boolean(state.suppressAutoPump);
  syncQueueFilterControls(
    {
      total: totalVisible,
      active: activeCount,
      pending: pendingCount,
      error: errorItems.length,
    },
    { hidden: state.queueCollapsed },
  );
  const queueFilter = getDownloadQueueFilter();

  if (queueInfo) {
    queueInfo.classList.toggle("hidden", !hasQueueItems);
    if (queueStartButton) {
      queueStartButton.disabled = pendingCount <= 0;
      queueStartButton.classList.toggle("hidden", pendingCount <= 0);
    }
    if (queuePauseButton) {
      queuePauseButton.disabled = activeCount <= 0 && pendingCount <= 0;
      queuePauseButton.classList.toggle(
        "hidden",
        activeCount <= 0 && pendingCount <= 0,
      );
      queuePauseButton.classList.toggle("is-active", state.suppressAutoPump);
      const pauseKey = state.suppressAutoPump
        ? "queue.resume.title"
        : "queue.pause.title";
      const pauseLabel = t(pauseKey);
      const pauseIcon = queuePauseButton.querySelector("[data-lucide]");
      if (pauseIcon) {
        pauseIcon.setAttribute(
          "data-lucide",
          state.suppressAutoPump ? "play" : "pause",
        );
      }
      queuePauseButton.setAttribute("title", pauseLabel);
      queuePauseButton.setAttribute("aria-label", pauseLabel);
      queuePauseButton.setAttribute("data-bs-original-title", pauseLabel);
      queuePauseButton.setAttribute("data-i18n-title", pauseKey);
      queuePauseButton.setAttribute("data-i18n-aria", pauseKey);
    }
    if (queueClearButton) {
      const clearableCount =
        queueFilter === "active"
          ? 0
          : queueFilter === "pending"
            ? pendingCount
            : queueFilter === "error"
              ? errorItems.length
              : pendingCount + errorItems.length;
      queueClearButton.disabled = clearableCount <= 0;
      queueClearButton.classList.toggle("hidden", clearableCount <= 0);
    }
    if (queueRetryFailedButton) {
      const retryableFailedCount = getRetryableFailedJobs().length;
      queueRetryFailedButton.classList.toggle(
        "hidden",
        retryableFailedCount <= 0,
      );
      queueRetryFailedButton.disabled = retryableFailedCount <= 0;
    }
  }

  if (queueList) {
    queueList.classList.toggle(
      "hidden",
      !hasQueueItems || Boolean(state.queueCollapsed),
    );
  }
  if (queueToggleButton) {
    queueToggleButton.classList.toggle(
      "is-collapsed",
      Boolean(state.queueCollapsed),
    );
    const key = state.queueCollapsed
      ? "queue.toggle.expand.title"
      : "queue.toggle.collapse.title";
    const label = t(key);
    queueToggleButton.setAttribute("title", label);
    queueToggleButton.setAttribute("aria-label", label);
    queueToggleButton.setAttribute("data-bs-original-title", label);
    queueToggleButton.setAttribute("data-i18n-title", key);
    queueToggleButton.setAttribute("data-i18n-aria", key);
  }
  updateDownloadJobSummary();

  const rowMarkup = (item, displayIndex, group, pendingIndex = -1) => {
    const fullUrl = String(item.url || "");
    const urlLabel = makeQueueUrlLabel(fullUrl);
    const cachedTitle = makeQueueTitle(fullUrl);
    const titleLabel = String(
      item.title || cachedTitle || t("queue.title.loading"),
    );
    const stageLabel =
      item.status === "downloading" && item.stage
        ? t(`queue.stage.${item.stage}`)
        : "";
    const etaLabel =
      item.status === "downloading"
        ? formatEtaEstimate(item.createdAt, item.progress)
        : "";
    const reasonLabel =
      item.status === "error" ? getQueueReasonLabel(item) : "";
    const retryStateLabel =
      item.status === "error" ? getQueueRetryStateLabel(item) : "";
    const qualityLabel = getQueueQualityLabel(item.quality);
    const kindLabel =
      item.type === "audio"
        ? t("queue.kind.audio")
        : item.type === "subtitle"
          ? t("queue.kind.subtitle")
          : "";
    const source = detectSource(fullUrl);
    const meta = getQueueStatusMeta(item.status, item.progress);
    const isDownloading = item.status === "downloading";
    const isActiveGroup = group === "active";
    const isPendingGroup = group === "pending";
    const hasFilePath = Boolean(item.filePath);
    const isHistoryRecovery =
      item.errorCode === HISTORY_SAVE_ERROR_CODE && hasFilePath;
    const isFirst = pendingIndex === 0;
    const isLast = pendingIndex === pendingItems.length - 1;
    const itemIdentity = getQueueItemIdentity(item);
    const identityAttribute = itemIdentity
      ? `data-job-id="${escapeQueueHtml(itemIdentity)}"`
      : "";
    return `
      <li class="queue-item group ${isDownloading ? "is-downloading" : ""}" role="listitem" ${identityAttribute} ${isPendingGroup ? `data-queue-pending-index="${pendingIndex}" tabindex="0" aria-keyshortcuts="Alt+ArrowUp Alt+ArrowDown"` : ""} style="background:${isDownloading ? "linear-gradient(180deg, rgba(74,158,255,0.07), rgba(255,255,255,0.03))" : QUEUE_COLORS.cardBg};border:1px solid ${QUEUE_COLORS.cardBorder};">
        <div class="queue-item-index-wrap">
          <span class="queue-item-index">${String(displayIndex + 1).padStart(2, "0")}</span>
          <span class="queue-item-grip" ${isPendingGroup ? `draggable="true" data-queue-drag-handle="1" data-job-id="${escapeQueueHtml(itemIdentity)}" title="${t("queue.item.drag.title")}" aria-label="${t("queue.item.drag.title")}" aria-keyshortcuts="ArrowUp ArrowDown" role="button" tabindex="0"` : `aria-hidden="true"`}><i data-lucide="grip-vertical"></i></span>
        </div>
        <span class="queue-source-pill" style="background:${source.bg};color:${source.color};border:1px solid ${source.color}33;">${escapeQueueHtml(source.label)}</span>
        <div class="queue-item-meta" title="${escapeQueueHtml(fullUrl)}">
          <div class="queue-item-title">${escapeQueueHtml(titleLabel)}</div>
          <div class="queue-item-subtitle"><span>${escapeQueueHtml(urlLabel)}${item.size ? ` · ${escapeQueueHtml(item.size)}` : ""}</span><span data-queue-stage-label>${stageLabel ? ` · ${escapeQueueHtml(stageLabel)}` : ""}</span><span data-queue-eta-label>${etaLabel ? ` · ${escapeQueueHtml(etaLabel)}` : ""}</span></div>
        </div>
        <div class="queue-item-right">
          <span class="queue-status-chip ${isDownloading ? "is-spinning" : ""}" style="${meta.style}">
            <i data-lucide="${meta.icon}"></i><span data-queue-progress-label>${escapeQueueHtml(meta.label)}</span>
          </span>
          ${reasonLabel ? `<span class="queue-reason-chip">${escapeQueueHtml(reasonLabel)}</span>` : ""}
          ${retryStateLabel ? `<span class="queue-retry-chip ${item.retryable === false ? "is-manual" : "is-retryable"}">${escapeQueueHtml(retryStateLabel)}</span>` : ""}
          ${isDownloading ? `<span class="queue-stage-chip${stageLabel ? "" : " hidden"}" data-queue-stage-chip>${escapeQueueHtml(stageLabel)}</span>` : ""}
          ${kindLabel ? `<span class="queue-kind-chip">${escapeQueueHtml(kindLabel)}</span>` : ""}
          <span class="queue-quality-chip">${escapeQueueHtml(qualityLabel)}</span>
          <div class="queue-item-actions queue-hover-controls">
            ${
              isActiveGroup && item.jobId
                ? `<button type="button" class="queue-item-cancel" data-queue-cancel-job="1" data-job-id="${escapeQueueHtml(item.jobId)}" title="${t("queue.item.cancel.title")}" aria-label="${t("queue.item.cancel.title")}" ${cancellingDownloadJobIds.has(item.jobId) ? 'disabled aria-busy="true"' : ""}><i data-lucide="square-x"></i></button>`
                : ""
            }
            ${
              isPendingGroup
                ? `<button type="button" class="queue-item-start" data-queue-start-job="1" data-job-id="${escapeQueueHtml(itemIdentity)}" title="${t("queue.item.start.title")}" aria-label="${t("queue.item.start.title")}"><i data-lucide="play"></i></button>
                   <button type="button" class="queue-item-move" data-queue-move="up" data-job-id="${escapeQueueHtml(itemIdentity)}" title="${t("queue.item.moveUp.title")}" aria-label="${t("queue.item.moveUp.title")}" ${isFirst ? "disabled" : ""}><i data-lucide="chevron-up"></i></button>
                   <button type="button" class="queue-item-move" data-queue-move="down" data-job-id="${escapeQueueHtml(itemIdentity)}" title="${t("queue.item.moveDown.title")}" aria-label="${t("queue.item.moveDown.title")}" ${isLast ? "disabled" : ""}><i data-lucide="chevron-down"></i></button>`
                : ""
            }
            ${
              group === "error"
                ? `<button type="button" class="queue-item-retry" data-queue-retry-failed="1" data-job-id="${escapeQueueHtml(itemIdentity)}" title="${t(isHistoryRecovery ? "queue.item.archiveRetry.title" : item.retryable ? "queue.item.retry.title" : "queue.item.retry.disabled.title")}" aria-label="${t(isHistoryRecovery ? "queue.item.archiveRetry.title" : item.retryable ? "queue.item.retry.title" : "queue.item.retry.disabled.title")}" ${item.retryable || isHistoryRecovery ? "" : "disabled"}><i data-lucide="rotate-cw"></i></button>`
                : ""
            }
            ${
              isHistoryRecovery
                ? `<button type="button" class="queue-item-open" data-queue-open-recovery="1" data-job-id="${escapeQueueHtml(itemIdentity)}" title="${t("queue.item.open.title")}" aria-label="${t("queue.item.open.title")}"><i data-lucide="play"></i></button>
                   <button type="button" class="queue-item-reveal" data-queue-reveal-recovery="1" data-job-id="${escapeQueueHtml(itemIdentity)}" title="${t("queue.item.reveal.title")}" aria-label="${t("queue.item.reveal.title")}"><i data-lucide="folder-open"></i></button>`
                : ""
            }
            ${
              group !== "active"
                ? `<button type="button" class="queue-item-remove" data-${group === "error" ? "queue-remove-failed" : "queue-remove"}="1" data-job-id="${escapeQueueHtml(itemIdentity)}" title="${t("queue.item.remove.title")}" aria-label="${t("queue.item.remove.title")}"><i data-lucide="x"></i></button>`
                : ""
            }
          </div>
        </div>
        ${
          isDownloading
            ? `<span class="queue-progress-line" data-queue-progress-bar style="width:${Math.max(0, Math.min(100, Number(item.progress) || 0))}%;"></span>`
            : ""
        }
      </li>
    `;
  };

  if (queueList && queueRenderer) {
    queueList.setAttribute("role", "list");
    queueList.setAttribute("aria-live", "off");
    if (!hasQueueItems) {
      const emptyMarkup = `
        <div class="queue-empty">
          <span class="queue-empty-icon" aria-hidden="true"><i data-lucide="inbox"></i></span>
          <p class="queue-empty-title">${escapeQueueHtml(t("queue.empty.title"))}</p>
          <p class="queue-empty-hint">${escapeQueueHtml(t("queue.empty.hint"))}</p>
        </div>
      `;
      queueRenderer.render({ rows: [], emptyMarkup });
    } else {
      const groupedRows = {
        active: activeItems.map((item) => ({
          item,
          group: "active",
        })),
        pending: pendingItems.map((item, pendingIndex) => ({
          item,
          group: "pending",
          pendingIndex,
        })),
        error: errorItems.map((item) => ({
          item,
          group: "error",
        })),
      };
      const visibleGroups =
        queueFilter === "all" ? ["active", "pending", "error"] : [queueFilter];
      const visibleRows = visibleGroups.flatMap(
        (group) => groupedRows[group] || [],
      );
      const rows = visibleRows.map((row, displayIndex) => {
        const id = getQueueItemIdentity(row.item);
        const progressData = getQueueProgressRenderData(row.item);
        return {
          id,
          markup: rowMarkup(
            row.item,
            displayIndex,
            row.group,
            row.pendingIndex ?? -1,
          ),
          structureKey: JSON.stringify({
            id,
            displayIndex,
            group: row.group,
            pendingIndex: row.pendingIndex ?? -1,
            status: row.item.status,
            title: row.item.title,
            url: row.item.url,
            size: row.item.size,
            quality: row.item.quality,
            type: row.item.type,
            reason: row.item.reason,
            retryable: row.item.retryable,
            filePath: row.item.filePath,
            cancelling: cancellingDownloadJobIds.has(row.item.jobId),
            locale: t("queue.status.pending"),
          }),
          ...progressData,
        };
      });
      const filteredEmptyMarkup = `
          <div class="queue-empty">
            <span class="queue-empty-icon" aria-hidden="true"><i data-lucide="list-filter"></i></span>
            <p class="queue-empty-title">${escapeQueueHtml(t("queue.filter.empty.title"))}</p>
            <p class="queue-empty-hint">${escapeQueueHtml(t("queue.filter.empty.hint"))}</p>
          </div>
        `;
      queueRenderer.render({ rows, emptyMarkup: filteredEmptyMarkup });
    }
  }
  applyLucideIcons();
  updateDownloaderTabLabel();
}

let lastChosenQuality = null;
let lastChosenQualityLabel = null;
let progressResetTimer = null;
let queueDragState = null;

function movePendingQueueItem(fromIndex, toIndex) {
  const pendingJobs = [...getPendingDownloadJobs(state)];
  if (
    !Number.isInteger(fromIndex) ||
    !Number.isInteger(toIndex) ||
    fromIndex < 0 ||
    toIndex < 0 ||
    fromIndex >= pendingJobs.length ||
    toIndex >= pendingJobs.length ||
    fromIndex === toIndex
  ) {
    return false;
  }

  const [item] = pendingJobs.splice(fromIndex, 1);
  pendingJobs.splice(toIndex, 0, item);
  replaceDownloadJobsByStatus(
    state,
    [JOB_STATUS.pending, JOB_STATUS.paused],
    pendingJobs,
  );
  persistQueue();
  updateQueueDisplay();
  console.log(QUEUE_LOG_TAG, "move-item", { from: fromIndex, to: toIndex });
  return true;
}

const clearProgressResetTimer = () => {
  if (progressResetTimer) {
    clearTimeout(progressResetTimer);
    progressResetTimer = null;
  }
};

const resetProgressIndicator = () => {
  if (!progressBarContainer) return;
  progressBarContainer.style.opacity = 0;
  progressBarContainer.classList.remove("is-active", "is-complete");
  progressBarContainer.setAttribute("aria-valuenow", "0");
  progressBarContainer.style.setProperty("--progress-ratio", "0");
};

function resetDownloadUiState(options = {}) {
  const {
    suppressAutoPump = state.suppressAutoPump,
    resetActiveDownloads = true,
  } = options;
  clearProgressResetTimer();
  blockDownloadPoolSuccess();
  state.suppressAutoPump = suppressAutoPump;
  if (resetActiveDownloads) {
    clearDownloadJobsByStatus(state, JOB_STATUS.running);
  }
  state.isDownloading = false;
  if (downloadButton) {
    downloadButton.classList.remove("disabled", "loading");
  }
  if (buttonText) {
    buttonText.textContent = t("actions.download");
  }
  if (downloadCancelButton) {
    downloadCancelButton.disabled = true;
    downloadCancelButton.setAttribute("title", t("actions.cancelDownload"));
    downloadCancelButton.setAttribute(
      "aria-label",
      t("actions.cancelDownload"),
    );
    downloadCancelButton.setAttribute(
      "data-bs-original-title",
      t("actions.cancelDownload"),
    );
  }
  if (urlInput) {
    urlInput.disabled = false;
  }
  if (cancelCountBadge) {
    cancelCountBadge.textContent = "0";
    cancelCountBadge.classList.add("hidden");
  }
  resetProgressIndicator();
  syncDownloadState();
  syncDownloadPoolToast();
}

const QUALITY_PROFILE_KEY = "downloadQualityProfile";
const QUALITY_LAST_KEY = "downloadLastQuality";
const QUALITY_PROFILE_DEFAULT = "remember";

const readQualityProfile = () => {
  try {
    const raw =
      window.localStorage.getItem(QUALITY_PROFILE_KEY) ||
      QUALITY_PROFILE_DEFAULT;
    return raw === "audio" || raw === "remember" || raw === "best"
      ? raw
      : QUALITY_PROFILE_DEFAULT;
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

const resolvePresetQuality = (profile = readQualityProfile()) => {
  if (profile === "audio") return t("quality.audioOnly");
  if (profile === "best") return t("quality.source");
  const remembered = lastChosenQualityLabel || readLastQuality();
  return remembered || t("quality.source");
};

const clearUrlInputAfterSubmit = () => {
  if (!urlInput) return;
  urlInput.value = "";
  try {
    urlInput.dispatchEvent(new Event("input", { bubbles: true }));
  } catch {}
  try {
    urlInput.focus();
  } catch {}
  try {
    window.dispatchEvent(new CustomEvent("download:url-submitted"));
  } catch {}
};

async function openCompletedDownload(task) {
  try {
    const result = await window.electron.invoke(
      "open-last-video",
      task.filePath,
    );
    if (!result?.success) throw new Error(result?.error || "Open failed");
  } catch (error) {
    console.error("Error opening completed download:", error);
    showToast(t("queue.item.open.error"), "error");
  }
}

async function revealCompletedDownload(task) {
  try {
    await window.electron.invoke("open-download-folder", task.filePath);
  } catch (error) {
    console.error("Error revealing completed download:", error);
    showToast(t("queue.item.reveal.error"), "error");
  }
}

function buildHistoryEntryFromQueueJob(task) {
  const timestamp =
    Number(task?.completedAt) ||
    Number(task?.updatedAt) ||
    Number(task?.createdAt) ||
    Date.now();
  return {
    id:
      task?.historyEntryId || task?.jobId || task?.id || `history-${timestamp}`,
    fileName:
      task?.title || makeQueueTitle(task?.url) || makeQueueUrlLabel(task?.url),
    filePath: task?.filePath || "",
    quality: getQueueQualityLabel(task?.quality),
    downloadKind: resolveDownloadKind(task),
    sourceUrl: task?.url || "",
    dateTime: new Date(timestamp).toLocaleString("ru-RU", { hour12: false }),
    downloadStatus: "done",
  };
}

function createHistoryRecoveryJob(task) {
  return normalizeQueueItem({
    ...task,
    status: JOB_STATUS.failed,
    progress: 100,
    stage: "finalize",
    reason: t("queue.reason.historySaveFailed"),
    errorCode: HISTORY_SAVE_ERROR_CODE,
    retryable: false,
    failedAt: Date.now(),
  });
}

async function archiveRecoveredDownload(task) {
  if (!task?.filePath) return false;
  const saved = await addNewEntryToHistory(
    buildHistoryEntryFromQueueJob(task),
    {
      replaceExistingFilePath: false,
    },
  );
  if (!saved) return false;
  removeDownloadJob(state, task.jobId || task.id || task.signature);
  persistCompletedJobs(
    loadCompletedJobs().filter(
      (legacyJob) =>
        legacyJob.filePath !== task.filePath &&
        (legacyJob.jobId || legacyJob.id) !== (task.jobId || task.id),
    ),
  );
  persistFailedQueue();
  markAsDownloaded(task.url, resolveDownloadKind(task));
  updateQueueDisplay();
  showToast(t("queue.item.archiveRetry.success"), "success");
  return true;
}

async function migrateLegacyCompletedJobs() {
  const legacyJobs = loadCompletedJobs();
  if (!legacyJobs.length) return;
  try {
    const historyEntries = await loadHistoryEntries();
    const knownPaths = new Set(
      historyEntries
        .map((entry) => String(entry?.filePath || ""))
        .filter(Boolean),
    );
    const additions = legacyJobs
      .filter((job) => job.filePath && !knownPaths.has(String(job.filePath)))
      .map(buildHistoryEntryFromQueueJob);
    if (additions.length) {
      await saveHistoryEntries([...additions, ...historyEntries]);
    }
    persistCompletedJobs([]);
    additions.forEach((entry) =>
      markAsDownloaded(entry.sourceUrl, entry.downloadKind),
    );
  } catch (error) {
    console.error("Failed to migrate completed queue jobs:", error);
    legacyJobs.forEach((job) => {
      const identity = job.jobId || job.id || job.signature;
      if (!findDownloadJob(state, identity)) {
        upsertDownloadJob(state, createHistoryRecoveryJob(job));
      }
    });
    persistFailedQueue();
    updateQueueDisplay();
    showToast(t("queue.migration.historyFailed"), "error");
  }
}

function normalizeSelection(selection) {
  if (selection && typeof selection === "object" && selection.enqueue) {
    return { payload: selection.payload, enqueue: true };
  }
  return { payload: selection, enqueue: false };
}

const downloadVideo = async (url, quality, options = {}) => {
  const { jobId } = options;
  console.log("Инициирование загрузки по URL:", url, "с качеством:", quality, {
    jobId,
  });
  const requestedDownloadKind = resolveDownloadKind(quality);
  let historyRecorded = false;
  try {
    const response = await window.electron.invoke(
      "download-video",
      url,
      quality,
      jobId,
    );

    if (response?.cancelled) {
      console.log("Загрузка отменена.", { jobId });
      return { cancelled: true };
    }

    if (response?.success === false || response?.errorCode) {
      const errorDetails = getDownloadErrorDetails(
        response?.errorCode
          ? {
              message: `${response.errorCode}: ${response?.message || ""}`,
              errorCode: response.errorCode,
              retryable: response.retryable,
            }
          : response,
      );
      showToast(formatDownloadErrorToast(response), "error");
      return {
        error: true,
        message: response?.message || errorDetails.message || "",
        errorCode: response?.errorCode || errorDetails.code || "UNKNOWN",
        retryable:
          typeof response?.retryable === "boolean"
            ? response.retryable
            : errorDetails.retryable,
      };
    }

    const {
      fileName,
      filePath,
      quality: selectedQuality,
      actualQuality,
      sourceUrl,
      thumbnail: resolvedThumbnail = "",
      cancelled,
    } = response || {};

    if (cancelled) {
      console.log("Загрузка отменена.", { jobId });
      return { cancelled: true };
    }

    console.log("Файл загружен:", {
      fileName,
      filePath,
      selectedQuality,
      actualQuality,
      sourceUrl,
      jobId,
    });

    const currentDateTime = new Date().toLocaleString("ru-RU", {
      hour12: false,
    });
    const entryId = Date.now();
    try {
      const iconUrl = await window.electron.invoke("get-icon-path", url);
      let thumbnail = resolvedThumbnail;
      let thumbnailCacheFile = "";
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

      historyRecorded =
        (await addNewEntryToHistory(newLogEntry, {
          replaceExistingFilePath: false,
        })) !== false;
      if (historyRecorded) {
        markAsDownloaded(sourceUrl || url, requestedDownloadKind);
      }

      if (historyContainer) historyContainer.scrollTop = 0;
    } catch (postProcessError) {
      console.warn(
        "Post-download history bookkeeping failed, but file is already saved:",
        postProcessError,
      );
    }

    window.localStorage.setItem("lastDownloadedFile", filePath);
    openLastVideoButton.disabled = false;
    return { ok: true, filePath, historyRecorded };
  } catch (error) {
    if (error.message === "Download cancelled") {
      showToast(t("download.cancelled"), "warning");
      return { cancelled: true };
    } else if (
      error.message === "Пул загрузок заполнен" ||
      error.message === "Parallel download limit reached"
    ) {
      showToast(t("download.pool.full"), "warning");
      return { poolFull: true };
    } else {
      console.error("Ошибка при загрузке видео:", error);
      const errorDetails = getDownloadErrorDetails(error);
      showToast(formatDownloadErrorToast(error), "error");
      return {
        error: true,
        message: errorDetails.message,
        errorCode: errorDetails.code,
        retryable: errorDetails.retryable,
      };
    }
  }
};

function showQueueStartIndicator() {
  if (!queueIndicator) return;
  queueIndicator.classList.add("show");
  queueIndicator.classList.remove("hidden");
  setTimeout(() => {
    queueIndicator.classList.remove("show");
    queueIndicator.classList.add("hidden");
  }, 1500);
}

function pumpDownloadPool(reason = "auto") {
  if (reason === "auto" && state.suppressAutoPump) {
    return;
  }
  let started = 0;
  const activeCount = getActiveDownloadJobs(state).length;
  const maxActive =
    Number(state.maxParallelDownloads) || PARALLEL_DOWNLOAD_LIMIT;
  const reservedSignatures = new Set([
    ...getCurrentDownloadSignatures(),
    ...queuePumpReservations,
  ]);
  while (
    getActiveDownloadJobs(state).length < maxActive &&
    getPendingDownloadJobs(state).length > 0
  ) {
    const next = getPendingDownloadJobs(state).find((item) => {
      const signature = getQueueSignature(item.url, item.quality);
      return !reservedSignatures.has(signature);
    });
    if (!next) break;
    const signature = getQueueSignature(next.url, next.quality);
    reservedSignatures.add(signature);
    queuePumpReservations.add(signature);
    started += 1;
    Promise.resolve(
      initiateDownload(next.url, next.quality, {
        fromQueue: true,
        initialTitle: next.title || "",
      }),
    ).finally(() => {
      queuePumpReservations.delete(signature);
    });
  }
  if (started > 0) {
    persistQueue();
    updateQueueDisplay();
    if (reason !== "silent") showQueueStartIndicator();
    console.log(QUEUE_LOG_TAG, "pump", {
      reason,
      started,
      activeCountBefore: activeCount,
    });
  }
}

function startPendingQueueItem(identity) {
  const next = findDownloadJob(state, identity);
  if (
    next?.status !== JOB_STATUS.pending &&
    next?.status !== JOB_STATUS.paused
  ) {
    return false;
  }
  if (!next) return false;
  const signature = getQueueSignature(next.url, next.quality);
  if (getCurrentDownloadSignatures().has(signature)) return false;
  queuePumpReservations.add(signature);
  Promise.resolve(
    initiateDownload(next.url, next.quality, {
      fromQueue: true,
      initialTitle: next.title || "",
    }),
  ).finally(() => {
    queuePumpReservations.delete(signature);
  });
  persistQueue();
  updateQueueDisplay();
  showQueueStartIndicator();
  console.log(QUEUE_LOG_TAG, "manual-start-one", {
    url: next.url,
  });
  return true;
}

const initiateDownload = async (url, quality, options = {}) => {
  const { fromQueue = false, initialTitle = "" } = options;
  const signature = getQueueSignature(url, quality);
  removeFailedBySignature(signature);
  if (getCurrentDownloadSignatures().has(signature)) {
    return null;
  }

  const maxActive =
    Number(state.maxParallelDownloads) || PARALLEL_DOWNLOAD_LIMIT;
  if (getActiveDownloadJobs(state).length >= maxActive) {
    if (!fromQueue) {
      const queueItem = normalizeQueueItem({ url, quality, status: "pending" });
      upsertDownloadJob(state, {
        ...queueItem,
        status: JOB_STATUS.pending,
      });
      void ensureQueueTitle(url, {
        signature,
        onResolved: (title) => {
          const pendingJob = findDownloadJob(state, signature);
          if (!title || !pendingJob || pendingJob.title === title) return;
          patchDownloadJob(state, signature, { title });
          persistQueue();
          updateQueueDisplay();
        },
      });
      persistQueue();
      updateQueueDisplay();
      showToast(t("download.url.queued"), "info");
    }
    return null;
  }

  if (fromQueue) {
    ensureQueueFormatsReady(url, quality);
  }

  clearProgressResetTimer();
  downloadButton.classList.add("loading");
  if (progressBarContainer) {
    progressBarContainer.style.opacity = 1;
    progressBarContainer.classList.remove("is-complete");
    progressBarContainer.classList.add("is-active");
  }

  const jobId = `job-${Date.now()}-${Math.random().toString(16).slice(2, 8)}`;
  addActiveDownload(
    normalizeQueueItem({
      id: jobId,
      jobId,
      url,
      title: initialTitle || makeQueueTitle(url),
      quality,
      status: "downloading",
      progress: 0,
      signature,
    }),
  );
  // Если заголовка пока нет в кэше, подтянем его в фоне и перерисуем строку.
  void ensureQueueTitle(url, { jobId, signature });

  let result = null;
  try {
    result = await downloadVideo(url, quality, { jobId });
  } finally {
    const activeEntry = findActiveDownload(jobId);
    const resolvedTitle = String(
      activeEntry?.title || makeQueueTitle(url) || "",
    );
    if (result?.error) {
      const failedSignatures = getFailedSignatures();
      if (!failedSignatures.has(signature)) {
        const errorDetails = {
          code: result.errorCode || "UNKNOWN",
          retryable:
            typeof result.retryable === "boolean" ? result.retryable : true,
          message: result.message || "",
        };
        await addNewEntryToHistory({
          id: `${jobId}-failed`,
          fileName:
            resolvedTitle || makeQueueTitle(url) || makeQueueUrlLabel(url),
          filePath: "",
          quality:
            typeof quality === "string"
              ? quality
              : quality?.label || t("quality.custom"),
          sourceUrl: url,
          dateTime: new Date().toLocaleString("ru-RU", { hour12: false }),
          downloadStatus: "failed",
          errorCode: errorDetails.code,
          errorMessage: errorDetails.message,
          retryable: errorDetails.retryable,
        });
        upsertDownloadJob(state, {
          id: jobId,
          jobId,
          title: resolvedTitle,
          url,
          quality,
          status: JOB_STATUS.failed,
          stage: "",
          progress: 0,
          size: "",
          signature,
          reason: result.message || "",
          errorCode: errorDetails.code,
          retryable: errorDetails.retryable,
          failedAt: Date.now(),
        });
        persistFailedQueue();
      }
    } else if (result?.ok && !result.historyRecorded) {
      upsertDownloadJob(
        state,
        createHistoryRecoveryJob({
          id: jobId,
          jobId,
          title: resolvedTitle,
          url,
          quality,
          filePath: result.filePath || "",
          signature,
          createdAt: activeEntry?.createdAt,
        }),
      );
      persistFailedQueue();
    } else {
      removeDownloadJob(
        state,
        (item) => item.jobId === jobId && item.status === JOB_STATUS.running,
      );
    }
    if (result?.error || result?.ok) {
      removeDownloadJob(
        state,
        (item) => item.jobId === jobId && item.status === JOB_STATUS.running,
      );
    }

    recordDownloadPoolResult(result);
    syncDownloadState();

    if (getActiveDownloadJobs(state).length === 0) {
      buttonText.textContent = t("actions.download");
      downloadButton.removeAttribute("title");
      downloadButton.removeAttribute("data-bs-original-title");
      initTooltips();
      downloadButton.classList.remove("disabled");
      downloadButton.classList.remove("loading");
      clearProgressResetTimer();
      const shouldDelayProgressReset =
        progressBarContainer?.classList.contains("is-complete");
      if (shouldDelayProgressReset) {
        progressResetTimer = setTimeout(() => {
          resetProgressIndicator();
          progressResetTimer = null;
        }, 900);
      } else {
        resetProgressIndicator();
      }
    }

    pumpDownloadPool("auto");
    syncDownloadPoolToast();
  }
};

const handleDownloadButtonClick = async (options = {}) => {
  const raw = urlInput.value.trim();
  const maxActive =
    Number(state.maxParallelDownloads) || PARALLEL_DOWNLOAD_LIMIT;
  const isPoolFull = getActiveDownloadJobs(state).length >= maxActive;

  // Извлекаем URL из произвольного текста
  const validUrls = extractUrls(raw).filter(
    (u) => isValidUrl(u) && isSupportedUrl(u),
  );
  if (validUrls.length === 0) {
    showToast(t("download.url.invalid"), "warning");
    return;
  }
  const downloadedMap = await getDownloadedUrlMap();

  const resolveSelectionForUrl = async (url, qualityProfile) => {
    if (isCompactDownloaderMode() && !options.forceQualityModal) {
      const payload = await resolveCompactQualityPayload(url);
      if (!payload) {
        showToast(t("quality.compact.invalidSelection"), "warning");
        return null;
      }
      return payload;
    }
    return openDownloadQualityModal(url, {
      presetQuality: resolvePresetQuality(qualityProfile),
      defaultQualityProfile: qualityProfile,
      preferredLabel:
        qualityProfile === "remember"
          ? lastChosenQualityLabel || readLastQuality()
          : null,
      forceAudioOnly: options.forceAudioOnly,
      enqueueOnly: options.enqueueOnly,
      cachedInfo: getCachedVideoInfo(url),
    });
  };

  // Если несколько: стартуем первый/добавляем остальные в очередь
  if (validUrls.length > 1) {
    const first = validUrls[0];
    const qualityProfile = options.presetProfile || readQualityProfile();
    const selectionRaw = await resolveSelectionForUrl(first, qualityProfile);
    if (!selectionRaw) return;
    const selection = normalizeSelection(selectionRaw);
    const payload = selection.payload;
    const enqueueFromModal = selection.enqueue;
    lastChosenQuality = payload;
    lastChosenQualityLabel =
      typeof payload === "string" ? payload : payload.label || null;
    persistLastQuality(lastChosenQualityLabel);

    if (isPoolFull || options.enqueueOnly || enqueueFromModal) {
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
      initiateDownload(firstPending, payload, { fromQueue: false });
      const res = enqueueMany(restPending, payload, {
        ...options,
        downloadedMap,
      });
      if (res.added || res.duplicates || res.invalid || res.alreadyDownloaded) {
        showToast(
          t("queue.summary.toast", { summary: summarizeEnqueueResult(res) }),
          "info",
        );
      }
      pumpDownloadPool("auto");
    }
    clearUrlInputAfterSubmit();
    return;
  }

  // Один URL
  const url = validUrls[0];
  const qualityProfile = options.presetProfile || readQualityProfile();
  const selectionRaw = await resolveSelectionForUrl(url, qualityProfile);
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
  if (isPoolFull || options.enqueueOnly || enqueueFromModal) {
    const candidateTask = { url, quality: payload };
    const candidateSignature = getQueueSignature(url, payload);
    const activeSignatures = getCurrentDownloadSignatures();
    const failedSignatures = getFailedSignatures();
    if (activeSignatures.has(candidateSignature)) {
      showToast(t("download.url.active"), "warning");
      return;
    }
    if (failedSignatures.has(candidateSignature)) {
      showToast(t("download.url.queued"), "info");
      return;
    }
    if (
      getPendingDownloadJobs(state).some((item) =>
        isSameQueueTask(item, candidateTask),
      )
    ) {
      showToast(t("download.url.queued"), "info");
      return;
    }
    if (getPendingDownloadJobs(state).length >= QUEUE_MAX) {
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
    const queuedItem = normalizeQueueItem({
      url,
      quality: payload,
      status: "pending",
    });
    upsertDownloadJob(state, {
      ...queuedItem,
      status: JOB_STATUS.pending,
    });
    const queuedSignature = getQueueSignature(url, payload);
    void ensureQueueTitle(url, {
      signature: queuedSignature,
      onResolved: (title) => {
        const pendingJob = findDownloadJob(state, queuedSignature);
        if (!title || !pendingJob || pendingJob.title === title) return;
        patchDownloadJob(state, queuedSignature, { title });
        persistQueue();
        updateQueueDisplay();
      },
    });
    persistQueue();
    console.log(QUEUE_LOG_TAG, "enqueueOne", { url, from: "modal/button" });
    showToast(t("queue.added"), "info");
    clearUrlInputAfterSubmit();
    updateQueueDisplay();
  } else {
    initiateDownload(url, payload, { fromQueue: false });
    pumpDownloadPool("auto");
    clearUrlInputAfterSubmit();
  }
};

async function resolveQueueClearTarget() {
  const filter = getDownloadQueueFilter();
  if (filter === "pending" || filter === "error") return filter;
  if (filter === "active") return false;
  return showConfirmationDialog({
    title: t("queue.clear.confirm.title"),
    subtitle: t("queue.clear.confirm.subtitle"),
    message: t("queue.clear.confirm.message"),
    confirmText: t("queue.clear.confirm.confirm"),
    cancelText: t("queue.clear.confirm.cancel"),
    tone: "danger",
    choices: [
      {
        value: "pending",
        label: t("queue.clear.choice.pending"),
        description: t("queue.clear.choice.pending.description"),
      },
      {
        value: "error",
        label: t("queue.clear.choice.error"),
        description: t("queue.clear.choice.error.description"),
      },
      {
        value: "all",
        label: t("queue.clear.choice.all"),
        description: t("queue.clear.choice.all.description"),
      },
    ],
    defaultChoice: "all",
  });
}

function clearQueueJobs(target) {
  const statuses =
    target === "pending"
      ? [JOB_STATUS.pending, JOB_STATUS.paused]
      : target === "error"
        ? [JOB_STATUS.failed]
        : [JOB_STATUS.pending, JOB_STATUS.paused, JOB_STATUS.failed];
  const removedJobs = ensureDownloadJobsState(state).filter((job) =>
    statuses.includes(job.status),
  );
  if (!removedJobs.length) return false;
  const pausedBeforeRemoval = Boolean(state.suppressAutoPump);
  replaceDownloadJobsByStatus(state, statuses, []);
  persistQueue();
  persistFailedQueue();
  if (target === "all" || target === "pending") {
    state.suppressAutoPump = false;
    state.queuePaused = false;
    persistQueuePausedState();
  }
  updateQueueDisplay();
  showQueueRemovalUndo(removedJobs, "queue.cleared", {
    restorePauseState: target === "all" || target === "pending",
    pausedBeforeRemoval,
  });
  return true;
}

function initDownloadButton() {
  initDownloadQueueFilter(() => updateQueueDisplay());

  downloadButton.addEventListener("pointerenter", warmupDownloadIntentInfo);
  downloadButton.addEventListener("focus", warmupDownloadIntentInfo);

  downloadButton.addEventListener("click", async () => {
    const opts = {
      enqueueOnly: downloadButton.dataset.enqueueOnly === "1",
      forceAudioOnly: downloadButton.dataset.forceAudioOnly === "1",
      forceQualityModal: downloadButton.dataset.forceQualityModal === "1",
      presetProfile: downloadButton.dataset.presetProfile || "",
    };
    delete downloadButton.dataset.enqueueOnly;
    delete downloadButton.dataset.forceAudioOnly;
    delete downloadButton.dataset.forceQualityModal;
    delete downloadButton.dataset.presetProfile;
    await handleDownloadButtonClick(opts);
  });

  if (enqueueButton) {
    enqueueButton.addEventListener("click", async () => {
      console.log(QUEUE_LOG_TAG, "enqueue-button-click");
      await handleDownloadButtonClick({ enqueueOnly: true });
    });
  }

  if (queueClearButton) {
    queueClearButton.addEventListener("click", async () => {
      const target = await resolveQueueClearTarget();
      if (!target) return;
      if (clearQueueJobs(target)) {
        console.log(QUEUE_LOG_TAG, "clear", { target });
      }
    });
  }

  if (queuePauseButton) {
    queuePauseButton.addEventListener("click", () => {
      const activeCount = getActiveDownloadJobs(state).length;
      const pendingCount = getPendingDownloadJobs(state).length;
      if (activeCount <= 0 && pendingCount <= 0) return;
      const isResuming = state.suppressAutoPump;
      state.suppressAutoPump = !isResuming;
      state.queuePaused = !isResuming;
      persistQueuePausedState();
      updateQueueDisplay();
      if (isResuming) {
        showToast(t("queue.resume.toast"), "info");
        pumpDownloadPool("manual");
        return;
      }
      showToast(
        t(activeCount > 0 ? "queue.pause.afterActive" : "queue.pause.toast"),
        "info",
      );
    });
  }

  if (queueToggleButton) {
    queueToggleButton.addEventListener("click", () => {
      state.queueCollapsed = !state.queueCollapsed;
      persistQueueCollapsedState();
      updateQueueDisplay();
    });
  }

  if (queueList && !queueList.dataset.bound) {
    const clearQueueDragMarkers = () => {
      queueList.classList.remove("is-dragging");
      queueList
        .querySelectorAll(".queue-item.is-dragging, .queue-item.is-drag-over")
        .forEach((item) =>
          item.classList.remove("is-dragging", "is-drag-over"),
        );
    };

    queueList.addEventListener("dragstart", (e) => {
      const handle = e.target.closest("[data-queue-drag-handle]");
      if (!handle || !queueList.contains(handle)) return;
      const jobId = String(handle.dataset.jobId || "").trim();
      if (!jobId || findPendingQueueIndex(jobId) < 0) return;
      queueDragState = { jobId };
      if (e.dataTransfer) {
        e.dataTransfer.effectAllowed = "move";
        e.dataTransfer.setData("text/plain", jobId);
      }
      handle.closest(".queue-item")?.classList.add("is-dragging");
      queueList.classList.add("is-dragging");
    });

    queueList.addEventListener("dragover", (e) => {
      if (!queueDragState) return;
      const row = e.target.closest(".queue-item[data-queue-pending-index]");
      if (!row || !queueList.contains(row)) return;
      e.preventDefault();
      if (e.dataTransfer) e.dataTransfer.dropEffect = "move";
      queueList
        .querySelectorAll(".queue-item.is-drag-over")
        .forEach((item) => item.classList.remove("is-drag-over"));
      row.classList.add("is-drag-over");
    });

    queueList.addEventListener("dragleave", (e) => {
      const row = e.target.closest(".queue-item[data-queue-pending-index]");
      if (!row || row.contains(e.relatedTarget)) return;
      row.classList.remove("is-drag-over");
    });

    queueList.addEventListener("drop", (e) => {
      if (!queueDragState) return;
      const row = e.target.closest(".queue-item[data-queue-pending-index]");
      if (!row || !queueList.contains(row)) {
        clearQueueDragMarkers();
        queueDragState = null;
        return;
      }
      e.preventDefault();
      const fromIndex = findPendingQueueIndex(queueDragState.jobId);
      const targetJobId = String(row.dataset.jobId || "").trim();
      const targetIndex = findPendingQueueIndex(targetJobId);
      if (fromIndex < 0 || targetIndex < 0) {
        clearQueueDragMarkers();
        queueDragState = null;
        return;
      }
      const rect = row.getBoundingClientRect();
      const dropAfter = e.clientY > rect.top + rect.height / 2;
      let toIndex = targetIndex + (dropAfter ? 1 : 0);
      if (fromIndex < toIndex) toIndex -= 1;
      const lastIndex = getPendingDownloadJobs(state).length - 1;
      toIndex = Math.max(0, Math.min(lastIndex, toIndex));
      clearQueueDragMarkers();
      queueDragState = null;
      if (movePendingQueueItem(fromIndex, toIndex)) {
        showToast(t("queue.item.reordered"), "info");
      }
    });

    queueList.addEventListener("dragend", () => {
      clearQueueDragMarkers();
      queueDragState = null;
    });

    queueList.addEventListener("keydown", (e) => {
      if (e.key !== "ArrowUp" && e.key !== "ArrowDown") return;
      const handle = e.target.closest("[data-queue-drag-handle]");
      const row = e.target.closest(".queue-item[data-queue-pending-index]");
      if (!row || !queueList.contains(row)) return;
      const isRowShortcut = e.target === row && e.altKey;
      const isHandleShortcut =
        Boolean(handle) && !e.altKey && !e.ctrlKey && !e.metaKey && !e.shiftKey;
      if (!isHandleShortcut && !isRowShortcut) return;

      const jobId = String(row.dataset.jobId || "").trim();
      const fromIndex = findPendingQueueIndex(jobId);
      const direction = e.key === "ArrowUp" ? -1 : 1;
      const toIndex = fromIndex + direction;
      const pendingCount = getPendingDownloadJobs(state).length;
      e.preventDefault();
      if (
        !Number.isInteger(fromIndex) ||
        toIndex < 0 ||
        toIndex >= pendingCount
      ) {
        return;
      }

      if (!movePendingQueueItem(fromIndex, toIndex)) return;
      const movedRow = findQueueRow(jobId);
      const focusTarget = isHandleShortcut
        ? movedRow?.querySelector("[data-queue-drag-handle]")
        : movedRow;
      focusTarget?.focus();
      showToast(
        t(direction < 0 ? "queue.item.movedUp" : "queue.item.movedDown"),
        "info",
      );
    });

    queueList.addEventListener("click", (e) => {
      const cancelJobButton = e.target.closest("[data-queue-cancel-job]");
      if (cancelJobButton) {
        const jobId = String(cancelJobButton.dataset.jobId || "").trim();
        if (!jobId || cancellingDownloadJobIds.has(jobId)) return;
        cancellingDownloadJobIds.add(jobId);
        updateQueueDisplay();
        void window.electron
          .invoke("cancel-download-job", { jobId })
          .then((result) => {
            if (!result?.success) {
              throw new Error(result?.error || "Cancel failed");
            }
            if (result.cancelled) {
              showToast(t("queue.item.cancelled"), "info");
              return;
            }
            cancellingDownloadJobIds.delete(jobId);
            updateQueueDisplay();
          })
          .catch((error) => {
            console.error("Error cancelling queue download:", error);
            cancellingDownloadJobIds.delete(jobId);
            updateQueueDisplay();
            showToast(t("queue.item.cancel.failed"), "error");
          });
        return;
      }

      const recoveryActionButton = e.target.closest(
        "[data-queue-open-recovery], [data-queue-reveal-recovery]",
      );
      if (recoveryActionButton) {
        const jobId = String(recoveryActionButton.dataset.jobId || "").trim();
        const task = findDownloadJob(state, jobId);
        if (
          task?.status !== JOB_STATUS.failed ||
          task.errorCode !== HISTORY_SAVE_ERROR_CODE ||
          !task.filePath
        )
          return;
        if (recoveryActionButton.hasAttribute("data-queue-open-recovery")) {
          void openCompletedDownload(task);
        } else {
          void revealCompletedDownload(task);
        }
        return;
      }

      const retryFailedBtn = e.target.closest("[data-queue-retry-failed]");
      if (retryFailedBtn) {
        const jobId = String(retryFailedBtn.dataset.jobId || "").trim();
        const task = findDownloadJob(state, jobId);
        if (task?.status !== JOB_STATUS.failed) return;
        if (task.errorCode === HISTORY_SAVE_ERROR_CODE) {
          void archiveRecoveredDownload(task);
          return;
        }
        if (task.retryable === false) {
          showToast(t("queue.item.retry.disabled"), "warning");
          return;
        }
        const signature = getQueueSignature(task.url, task.quality);
        if (getCurrentDownloadSignatures().has(signature)) {
          showToast(t("download.url.active"), "warning");
          return;
        }
        removeDownloadJob(state, jobId);
        persistFailedQueue();
        initiateDownload(task.url, task.quality, { fromQueue: false });
        pumpDownloadPool("auto");
        updateQueueDisplay();
        showToast(t("queue.item.retrying"), "info");
        return;
      }

      const startJobButton = e.target.closest("[data-queue-start-job]");
      if (startJobButton) {
        const jobId = String(startJobButton.dataset.jobId || "").trim();
        state.suppressAutoPump = true;
        state.queuePaused = true;
        persistQueuePausedState();
        startPendingQueueItem(jobId);
        return;
      }

      const moveBtn = e.target.closest("[data-queue-move]");
      if (moveBtn) {
        const jobId = String(moveBtn.dataset.jobId || "").trim();
        const idx = findPendingQueueIndex(jobId);
        const direction = moveBtn.dataset.queueMove;
        if (idx < 0) return;
        if (direction === "up" && idx > 0) {
          if (movePendingQueueItem(idx, idx - 1)) {
            showToast(t("queue.item.movedUp"), "info");
          }
        } else if (
          direction === "down" &&
          idx >= 0 &&
          idx < getPendingDownloadJobs(state).length - 1
        ) {
          if (movePendingQueueItem(idx, idx + 1)) {
            showToast(t("queue.item.movedDown"), "info");
          }
        }
        return;
      }

      const btn = e.target.closest("[data-queue-remove]");
      const failedRemoveBtn = e.target.closest("[data-queue-remove-failed]");
      if (failedRemoveBtn) {
        const jobId = String(failedRemoveBtn.dataset.jobId || "").trim();
        const task = findDownloadJob(state, jobId);
        if (task?.status !== JOB_STATUS.failed) return;
        removeDownloadJob(state, jobId);
        persistFailedQueue();
        updateQueueDisplay();
        showQueueRemovalUndo([task], "queue.item.removed");
        return;
      }
      if (!btn) return;
      const jobId = String(btn.dataset.jobId || "").trim();
      const removed = findDownloadJob(state, jobId);
      if (
        removed?.status !== JOB_STATUS.pending &&
        removed?.status !== JOB_STATUS.paused
      )
        return;
      removeDownloadJob(state, jobId);
      persistQueue();
      updateQueueDisplay();
      console.log(QUEUE_LOG_TAG, "remove-item", {
        jobId,
        url: removed?.url || "",
      });
      showQueueRemovalUndo([removed], "queue.item.removed");
    });
    queueList.dataset.bound = "1";
  }

  if (queueStartButton) {
    queueStartButton.addEventListener("click", () => {
      const pendingCount = getPendingDownloadJobs(state).length;
      if (pendingCount === 0) return;
      state.suppressAutoPump = false;
      state.queuePaused = false;
      persistQueuePausedState();
      console.log(QUEUE_LOG_TAG, "manual-start-all");
      pumpDownloadPool("manual");
      updateQueueDisplay();
    });
  }

  if (queueRetryFailedButton) {
    queueRetryFailedButton.addEventListener("click", () => {
      const tasks = getFailedDownloadJobs(state).filter(
        (task) => task.retryable !== false,
      );
      if (!tasks.length) return;
      const retryableSignatures = new Set(
        tasks.map((task) => getQueueSignature(task.url, task.quality)),
      );
      removeDownloadJob(
        state,
        (item) =>
          item.status === JOB_STATUS.failed &&
          retryableSignatures.has(getQueueSignature(item.url, item.quality)),
      );
      persistFailedQueue();
      const existing = new Set(
        getPendingDownloadJobs(state).map((item) =>
          getQueueSignature(item.url, item.quality),
        ),
      );
      const active = getCurrentDownloadSignatures();
      let added = 0;
      for (const task of tasks) {
        const signature = getQueueSignature(task.url, task.quality);
        if (existing.has(signature) || active.has(signature)) continue;
        existing.add(signature);
        upsertDownloadJob(state, {
          ...normalizeQueueItem({
            id: task.id,
            jobId: task.jobId,
            title: task.title,
            url: task.url,
            quality: task.quality,
            type: task.type,
            status: "pending",
            signature,
          }),
          status: JOB_STATUS.pending,
          stage: "",
        });
        added += 1;
      }
      persistQueue();
      updateQueueDisplay();
      pumpDownloadPool("manual");
      showToast(t("queue.retryFailed.toast", { count: added }), "info");
    });
  }

  const queuePaused = readQueuePausedState();
  if (getPendingDownloadJobs(state).length === 0) {
    replaceDownloadJobsByStatus(
      state,
      [JOB_STATUS.pending, JOB_STATUS.paused],
      loadQueueFromStorage().map((item) => ({
        ...item,
        status: queuePaused ? JOB_STATUS.paused : JOB_STATUS.pending,
      })),
    );
  }
  if (getFailedDownloadJobs(state).length === 0) {
    replaceDownloadJobsByStatus(
      state,
      JOB_STATUS.failed,
      loadFailedQueueFromStorage().map((item) => ({
        ...item,
        status: JOB_STATUS.failed,
      })),
    );
  }
  void migrateLegacyCompletedJobs();
  state.suppressAutoPump =
    queuePaused || Boolean(state.suppressAutoPump || state.queuePaused);
  state.queuePaused = state.suppressAutoPump;
  state.queueCollapsed = readQueueCollapsedState();
  ensureDownloadJobsState(state);
  if (
    getActiveDownloadJobs(state).length === 0 &&
    getPendingDownloadJobs(state).length > 0
  ) {
    console.log(QUEUE_LOG_TAG, "restore-wait", {
      count: getPendingDownloadJobs(state).length,
    });
  }
  updateQueueDisplay();
  refreshPendingQueueTitles();

  // Пакетное добавление ссылок в очередь (из предпросмотра плейлиста)
  window.addEventListener("queue:addMany", async (e) => {
    const urls = Array.isArray(e.detail?.urls) ? e.detail.urls : [];
    const q = e.detail?.quality || lastChosenQuality || t("quality.source");
    const downloadedMap = await getDownloadedUrlMap();
    const res = enqueueMany(urls, q, { downloadedMap });
    console.log(QUEUE_LOG_TAG, "enqueueMany-event", { count: urls.length });
    if (res.added || res.duplicates || res.invalid || res.alreadyDownloaded) {
      showToast(
        t("queue.summary.toast", { summary: summarizeEnqueueResult(res) }),
        "info",
      );
    }
  });

  window.addEventListener("i18n:changed", () => {
    updateQueueDisplay();
    syncDownloadPoolToast();
  });

  window.addEventListener("download:parallel-limit-changed", (event) => {
    const nextLimit = Math.max(
      1,
      Math.min(2, Number(event?.detail?.limit) || PARALLEL_DOWNLOAD_LIMIT),
    );
    state.maxParallelDownloads = nextLimit;
    syncDownloadState();
    pumpDownloadPool("auto");
  });

  window.addEventListener("download:progress-item", (event) => {
    const jobId = event?.detail?.jobId;
    const progress = Number(event?.detail?.progress);
    const phase = String(event?.detail?.phase || "")
      .trim()
      .toLowerCase();
    if (!jobId || !Number.isFinite(progress)) return;
    const active = findActiveDownload(jobId);
    if (!active) return;
    active.progress = Math.max(0, Math.min(100, progress));
    if (phase === "prepare") active.stage = "prepare";
    if (phase === "download") active.stage = "download";
    if (phase === "merge" || phase === "finalize") active.stage = "finalize";
    syncDownloadPoolToast();
    const now = Date.now();
    if (now - lastProgressRenderTs < PROGRESS_RENDER_THROTTLE_MS) return;
    lastProgressRenderTs = now;
    const item = normalizeQueueItem({
      ...active,
      status: "downloading",
      stage: active.stage || "prepare",
    });
    if (
      !queueRenderer?.updateProgress(jobId, getQueueProgressRenderData(item))
    ) {
      updateQueueDisplay();
    }
  });
}

function normalizeWebControlQuality(value) {
  return adaptWebControlQuality(value, normalizeWebQualitySelection);
}

function getWebControlSnapshot() {
  ensureDownloadJobsState(state);
  return createWebControlQueueSnapshot(state, {
    undoClearAvailable: Boolean(
      webClearUndo && webClearUndo.expiresAt > Date.now(),
    ),
  });
}

async function addWebControlDownload(payload = {}) {
  const rawUrls = Array.isArray(payload.urls)
    ? payload.urls
    : extractUrls(payload.url || payload.text || "");
  const urls = rawUrls.filter((url) => isValidUrl(url) && isSupportedUrl(url));
  if (!urls.length) {
    return {
      ...getWebControlSnapshot(),
      added: 0,
      invalid: rawUrls.length || 1,
    };
  }
  const quality = normalizeWebControlQuality(payload.quality);
  if (payload.start === true && urls.length === 1) {
    initiateDownload(urls[0], quality, { fromQueue: false });
  } else {
    const downloadedMap = await getDownloadedUrlMap();
    enqueueMany(urls, quality, { downloadedMap });
  }
  pumpDownloadPool(payload.start === true ? "manual" : "auto");
  updateQueueDisplay();
  return { ...getWebControlSnapshot(), added: urls.length };
}

function setWebControlQueuePaused(paused) {
  state.suppressAutoPump = Boolean(paused);
  state.queuePaused = Boolean(paused);
  persistQueuePausedState();
  updateQueueDisplay();
  if (!paused) pumpDownloadPool("manual");
  return getWebControlSnapshot();
}

function startWebControlQueue() {
  state.suppressAutoPump = false;
  state.queuePaused = false;
  persistQueuePausedState();
  pumpDownloadPool("manual");
  updateQueueDisplay();
  return getWebControlSnapshot();
}

function startWebControlJob(payload = {}) {
  const jobId = String(payload.jobId || payload.id || "").trim();
  state.suppressAutoPump = true;
  state.queuePaused = true;
  persistQueuePausedState();
  startPendingQueueItem(jobId);
  return getWebControlSnapshot();
}

async function cancelWebControlJob(payload = {}) {
  const jobId = String(payload.jobId || payload.id || "").trim();
  const task = findDownloadJob(state, jobId);
  if (!task) return getWebControlSnapshot();
  if (task.status === JOB_STATUS.running && task.jobId) {
    await window.electron.invoke("cancel-download-job", { jobId: task.jobId });
    return getWebControlSnapshot();
  }
  if (task.status === JOB_STATUS.pending || task.status === JOB_STATUS.paused) {
    removeDownloadJob(state, jobId);
    persistQueue();
  }
  updateQueueDisplay();
  return getWebControlSnapshot();
}

async function retryWebControlJob(payload = {}) {
  const jobId = String(payload.jobId || payload.id || "").trim();
  const task = findDownloadJob(state, jobId);
  const tasks =
    jobId && task?.status === JOB_STATUS.failed
      ? [task]
      : getFailedDownloadJobs(state).filter(
          (entry) => entry.retryable !== false,
        );
  if (tasks.length === 1 && tasks[0]?.errorCode === HISTORY_SAVE_ERROR_CODE) {
    await archiveRecoveredDownload(tasks[0]);
    return getWebControlSnapshot();
  }
  for (const entry of tasks) {
    if (entry.retryable === false) continue;
    removeDownloadJob(state, entry.jobId || entry.id || entry.signature);
    upsertDownloadJob(state, {
      ...entry,
      status: JOB_STATUS.pending,
      stage: "",
      progress: 0,
      reason: "",
      errorCode: "",
    });
  }
  persistFailedQueue();
  persistQueue();
  pumpDownloadPool("manual");
  updateQueueDisplay();
  return getWebControlSnapshot();
}

function removeWebControlJob(payload = {}) {
  const jobId = String(payload.jobId || payload.id || "").trim();
  const task = findDownloadJob(state, jobId);
  if (!task || task.status === JOB_STATUS.running)
    return getWebControlSnapshot();
  removeDownloadJob(state, jobId);
  persistQueue();
  persistFailedQueue();
  updateQueueDisplay();
  return getWebControlSnapshot();
}

function clearWebControlJobs(payload = {}) {
  const target = String(payload.target || "all")
    .trim()
    .toLowerCase();
  const statuses =
    target === "failed"
      ? [JOB_STATUS.failed]
      : target === "pending"
        ? [JOB_STATUS.pending, JOB_STATUS.paused]
        : [JOB_STATUS.pending, JOB_STATUS.paused, JOB_STATUS.failed];
  const removedJobs = ensureDownloadJobsState(state)
    .filter((job) => statuses.includes(job.status))
    .map((job) => ({ ...job }));
  const pausedBeforeRemoval = Boolean(state.suppressAutoPump);
  clearDownloadJobsByStatus(state, statuses);
  persistQueue();
  persistFailedQueue();
  if (target === "all" || target === "pending") {
    state.suppressAutoPump = false;
    state.queuePaused = false;
    persistQueuePausedState();
  }
  webClearUndo = removedJobs.length
    ? {
        jobs: removedJobs,
        pausedBeforeRemoval,
        restorePauseState: target === "all" || target === "pending",
        expiresAt: Date.now() + 8000,
      }
    : null;
  updateQueueDisplay();
  return getWebControlSnapshot();
}

function undoWebControlClear() {
  if (!webClearUndo || webClearUndo.expiresAt <= Date.now()) {
    webClearUndo = null;
    return getWebControlSnapshot();
  }
  const current = ensureDownloadJobsState(state).map((job) => ({ ...job }));
  const restoredIds = new Set(
    webClearUndo.jobs.map((job) =>
      String(job.jobId || job.id || job.signature),
    ),
  );
  setDownloadJobs(state, [
    ...webClearUndo.jobs,
    ...current.filter(
      (job) => !restoredIds.has(String(job.jobId || job.id || job.signature)),
    ),
  ]);
  if (webClearUndo.restorePauseState) {
    state.suppressAutoPump = webClearUndo.pausedBeforeRemoval;
    state.queuePaused = webClearUndo.pausedBeforeRemoval;
    persistQueuePausedState();
  }
  webClearUndo = null;
  persistQueue();
  persistFailedQueue();
  updateQueueDisplay();
  return getWebControlSnapshot();
}

async function openWebControlRecovery(payload = {}, reveal = false) {
  const jobId = String(payload.jobId || payload.id || "").trim();
  const task = findDownloadJob(state, jobId);
  if (
    task?.status === JOB_STATUS.failed &&
    task.errorCode === HISTORY_SAVE_ERROR_CODE &&
    task.filePath
  ) {
    if (reveal) {
      await revealCompletedDownload(task);
    } else {
      await openCompletedDownload(task);
    }
  }
  return getWebControlSnapshot();
}

async function handleWebControlDownloaderAction(action, payload = {}) {
  switch (action) {
    case "downloader:add":
      return addWebControlDownload({ ...payload, start: false });
    case "downloader:start":
      return addWebControlDownload({ ...payload, start: true });
    case "downloader:start-pending":
      return startWebControlQueue();
    case "downloader:start-one":
      return startWebControlJob(payload);
    case "downloader:pause":
      return setWebControlQueuePaused(true);
    case "downloader:resume":
      return setWebControlQueuePaused(false);
    case "downloader:cancel":
      return cancelWebControlJob(payload);
    case "downloader:retry":
      return retryWebControlJob(payload);
    case "downloader:remove":
      return removeWebControlJob(payload);
    case "downloader:clear":
      return clearWebControlJobs(payload);
    case "downloader:undo-clear":
      return undoWebControlClear();
    case "downloader:open":
      return openWebControlRecovery(payload, false);
    case "downloader:reveal":
      return openWebControlRecovery(payload, true);
    default:
      throw new Error(`Unknown downloader action: ${action}`);
  }
}

export {
  downloadVideo,
  initiateDownload,
  handleDownloadButtonClick,
  initDownloadButton,
  updateQueueDisplay,
  resetDownloadUiState,
  resolvePresetQuality,
  loadQueueFromStorage,
  persistQueue,
  getWebControlSnapshot,
  handleWebControlDownloaderAction,
  resolveDownloadKind as _resolveDownloadKind,
  getQueueSignature as _getQueueSignature,
};
