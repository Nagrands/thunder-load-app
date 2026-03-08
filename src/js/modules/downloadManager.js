// src/js/modules/downloadManager.js

import { historyContainer } from "./domElements.js";
import { state, updateButtonState } from "./state.js";
import { showToast } from "./toast.js";
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
  queuePauseButton,
  queueToggleButton,
  queueClearButton,
  queueRetryFailedButton,
} from "./domElements.js";
import { openDownloadQualityModal } from "./downloadQualityModal.js";
import { initTooltips } from "./tooltipInitializer.js";
import { showConfirmationDialog } from "./modals.js";
import { t } from "./i18n.js";
import { getCachedVideoInfo } from "./videoInfoCache.js";
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
  getCompletedDownloadJobs,
  getFailedDownloadJobs,
  getPendingDownloadJobs,
  patchDownloadJob,
  removeDownloadJob,
  replaceDownloadJobsByStatus,
  syncLegacyDownloadCollections,
  upsertDownloadJob,
} from "./downloadJobs.js";

const queueInfo = document.getElementById("download-queue-info");
const queueCount = document.getElementById("queue-count");
const queueActiveCount = document.getElementById("queue-active-count");
const queueDoneCount = document.getElementById("queue-done-count");
const queueIndicator = document.getElementById("queue-start-indicator");
const queueList = document.getElementById("queue-list");
const cancelCountBadge = document.getElementById("download-cancel-count");
const jobSummary = document.getElementById("downloader-job-summary");
const jobSummaryTitle = document.getElementById("downloader-job-summary-title");
const jobSummaryMeta = document.getElementById("downloader-job-summary-meta");
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
    const activeCount = getActiveDownloadJobs(state).length;
    const failedCount = getFailedDownloadJobs(state).length;
    const doneCount = getCompletedDownloadJobs(state).length;
    const count = activeCount + getPendingDownloadJobs(state).length + failedCount + doneCount;
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
const QUEUE_FAILED_STORAGE_KEY = "downloadFailedQueue";
const QUEUE_COLLAPSED_STORAGE_KEY = "downloadQueueCollapsed";
const PARALLEL_DOWNLOAD_LIMIT = 2;
const PROGRESS_RENDER_THROTTLE_MS = 220;
const QUEUE_MAX_LABEL_LEN = 64;
let lastProgressRenderTs = 0;
let lastQueueMarkup = "";
let queueItemIdCounter = 1;
const queueTitleRequestsInFlight = new Map();

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
  const invokeResult = window?.electron?.ipcRenderer?.invoke?.(
    "get-video-info",
    url,
  );
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

function refreshPendingQueueTitles() {
  if (!Array.isArray(state.downloadQueue) || state.downloadQueue.length === 0) {
    return;
  }
  for (const item of state.downloadQueue) {
    if (!item?.url || item?.title) continue;
    const signature = getQueueSignature(item.url, item.quality);
    void ensureQueueTitle(item.url, {
      signature,
      onResolved: (title) => {
        const pendingJob = findDownloadJob(state, signature);
        if (!title || pendingJob?.title === title || item.title === title) return;
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
  const title = String(item?.title || makeQueueTitle(url) || "");
  const downloadType =
    item?.type === "audio" || resolveDownloadKind(quality) === "audio"
      ? "audio"
      : "video";
  const status = item?.status || "pending";
  return {
    id: item?.id || nextQueueItemId(),
    jobId: item?.jobId || item?.id || "",
    title,
    url,
    quality,
    type: downloadType,
    status,
    progress: Number(item?.progress) || 0,
    size: item?.size ? String(item.size) : "",
    stage: item?.stage ? String(item.stage) : "",
    signature: item?.signature || getQueueSignature(url, quality),
    reason: item?.reason ? String(item.reason) : "",
    errorCode: item?.errorCode ? String(item.errorCode) : "",
    retryable:
      typeof item?.retryable === "boolean" ? item.retryable : undefined,
    failedAt: Number(item?.failedAt) || 0,
  };
}

function syncDownloadState() {
  const activeCount = getActiveDownloadJobs(state).length;
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
        detail: { isDownloading: state.isDownloading, activeCount },
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
    jobSummaryTitle.textContent = failedTitle || t("downloader.jobSummary.idle");
    jobSummaryMeta.textContent = [
      getQueueReasonLabel(latestFailed),
      getQueueRetryStateLabel(latestFailed),
    ].join(" · ");
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
    metaParts.push(`${Math.max(0, Math.min(100, Number(current.progress))).toFixed(0)}%`);
  }
  metaParts.push(t("queue.pill.active", { count: activeCount }));
  const badge = document.getElementById("downloader-job-summary-badge");
  if (badge) badge.textContent = t("downloader.jobSummary.badge");
  jobSummary.classList.remove("hidden");
  jobSummaryTitle.textContent = title || t("downloader.jobSummary.idle");
  jobSummaryMeta.textContent = metaParts.join(" · ");
}

function findActiveDownload(jobId) {
  return getActiveDownloadJobs(state).find((item) => item.jobId === jobId) || null;
}

function addActiveDownload(entry) {
  upsertDownloadJob(state, {
    ...entry,
    status: JOB_STATUS.running,
    stage: entry?.stage || "prepare",
  });
  syncDownloadState();
}

function getCurrentDownloadSignatures() {
  return new Set(
    getActiveDownloadJobs(state).map((item) => item.signature).filter(Boolean),
  );
}

function getFailedSignatures() {
  return new Set(
    getFailedDownloadJobs(state).map((item) =>
      getQueueSignature(item.url, item.quality),
    ),
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
  try {
    if (
      !Array.isArray(state.downloadQueue) ||
      state.downloadQueue.length === 0
    ) {
      window.localStorage.removeItem(QUEUE_STORAGE_KEY);
      return;
    }
    window.localStorage.setItem(
      QUEUE_STORAGE_KEY,
      JSON.stringify(state.downloadQueue),
    );
    console.log(QUEUE_LOG_TAG, "persist", {
      count: state.downloadQueue.length,
    });
  } catch {}
}

function persistFailedQueue() {
  try {
    if (
      !Array.isArray(state.failedDownloads) ||
      state.failedDownloads.length === 0
    ) {
      window.localStorage.removeItem(QUEUE_FAILED_STORAGE_KEY);
      return;
    }
    window.localStorage.setItem(
      QUEUE_FAILED_STORAGE_KEY,
      JSON.stringify(state.failedDownloads || []),
    );
  } catch {}
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
  let raw = null;
  try {
    raw = window.localStorage.getItem(QUEUE_FAILED_STORAGE_KEY);
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

function updateQueueDisplay() {
  ensureDownloadJobsState(state);
  syncLegacyDownloadCollections(state);
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
      stage: item.stage || "prepare",
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
  const doneItems = getCompletedDownloadJobs(state).map((item) =>
    normalizeQueueItem({ ...item, status: "done" }),
  );

  const activeCount = activeItems.length;
  const pendingCount = pendingItems.length;
  const doneCount = doneItems.length;
  const totalVisible =
    activeCount + pendingCount + errorItems.length + doneCount;
  const hasQueueItems = totalVisible > 0;

  state.queuePaused = Boolean(state.suppressAutoPump);

  if (queueInfo && queueCount) {
    queueInfo.classList.toggle("hidden", !hasQueueItems);
    queueCount.textContent = t("queue.pill.pending", { count: pendingCount });
    if (queueActiveCount) {
      queueActiveCount.textContent = t("queue.pill.active", {
        count: activeCount,
      });
      queueActiveCount.classList.toggle("hidden", activeCount <= 0);
    }
    if (queueDoneCount) {
      queueDoneCount.textContent = t("queue.pill.done", { count: doneCount });
      queueDoneCount.classList.toggle("hidden", doneCount <= 0);
    }
    if (queueStartButton) {
      queueStartButton.disabled = pendingCount <= 0 || activeCount > 0;
    }
    if (queuePauseButton) {
      queuePauseButton.disabled = activeCount <= 0 && pendingCount <= 0;
      queuePauseButton.classList.toggle("is-active", state.suppressAutoPump);
    }
    if (queueClearButton) {
      queueClearButton.disabled = totalVisible <= 0;
    }
    if (queueRetryFailedButton) {
      queueRetryFailedButton.classList.add("hidden");
      queueRetryFailedButton.disabled = true;
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

  const statusMeta = (status, progress) => {
    const statusMap = {
      downloading: {
        label: t("queue.status.downloading"),
        icon: "loader-circle",
      },
      pending: { label: t("queue.status.pending"), icon: "clock-3" },
      paused: { label: t("queue.status.paused"), icon: "pause" },
      done: { label: t("queue.status.done"), icon: "check-circle-2" },
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

  const rowMarkup = (
    item,
    displayIndex,
    group,
    pendingIndex = -1,
    actionIndex = displayIndex,
  ) => {
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
    const reasonLabel = item.status === "error" ? getQueueReasonLabel(item) : "";
    const retryStateLabel =
      item.status === "error" ? getQueueRetryStateLabel(item) : "";
    const qualityLabel = getQueueQualityLabel(item.quality);
    const source = detectSource(fullUrl);
    const meta = statusMeta(item.status, item.progress);
    const isDownloading = item.status === "downloading";
    const isPendingGroup = group === "pending";
    const isFirst = pendingIndex === 0;
    const isLast = pendingIndex === pendingItems.length - 1;
    return `
      <li class="queue-item group ${isDownloading ? "is-downloading" : ""}" role="listitem" style="background:${isDownloading ? "linear-gradient(180deg, rgba(74,158,255,0.07), rgba(255,255,255,0.03))" : QUEUE_COLORS.cardBg};border:1px solid ${QUEUE_COLORS.cardBorder};">
        <div class="queue-item-index-wrap">
          <span class="queue-item-index">${String(displayIndex + 1).padStart(2, "0")}</span>
          <span class="queue-item-grip" aria-hidden="true"><i data-lucide="grip-vertical"></i></span>
        </div>
        <span class="queue-source-pill" style="background:${source.bg};color:${source.color};border:1px solid ${source.color}33;">${escapeQueueHtml(source.label)}</span>
        <div class="queue-item-meta" title="${escapeQueueHtml(fullUrl)}">
          <div class="queue-item-title">${escapeQueueHtml(titleLabel)}</div>
          <div class="queue-item-subtitle">${escapeQueueHtml(urlLabel)}${item.size ? ` · ${escapeQueueHtml(item.size)}` : ""}${stageLabel ? ` · ${escapeQueueHtml(stageLabel)}` : ""}${reasonLabel ? ` · ${escapeQueueHtml(reasonLabel)}` : ""}${retryStateLabel ? ` · ${escapeQueueHtml(retryStateLabel)}` : ""}</div>
        </div>
        <div class="queue-item-right">
          <span class="queue-status-chip ${isDownloading ? "is-spinning" : ""}" style="${meta.style}">
            <i data-lucide="${meta.icon}"></i><span>${escapeQueueHtml(meta.label)}</span>
          </span>
          <span class="queue-quality-chip">${escapeQueueHtml(qualityLabel)}</span>
          <div class="queue-item-actions queue-hover-controls">
            ${
              isPendingGroup
                ? `<button type="button" class="queue-item-move" data-queue-move="up" data-index="${pendingIndex}" title="${t("queue.item.moveUp.title")}" aria-label="${t("queue.item.moveUp.title")}" ${isFirst ? "disabled" : ""}><i data-lucide="chevron-up"></i></button>
                   <button type="button" class="queue-item-move" data-queue-move="down" data-index="${pendingIndex}" title="${t("queue.item.moveDown.title")}" aria-label="${t("queue.item.moveDown.title")}" ${isLast ? "disabled" : ""}><i data-lucide="chevron-down"></i></button>`
                : ""
            }
            ${
              group === "error"
                ? `<button type="button" class="queue-item-retry" data-queue-retry-failed="1" data-index="${actionIndex}" title="${t(item.retryable ? "queue.item.retry.title" : "queue.item.retry.disabled.title")}" aria-label="${t(item.retryable ? "queue.item.retry.title" : "queue.item.retry.disabled.title")}" ${item.retryable ? "" : "disabled"}><i data-lucide="rotate-cw"></i></button>`
                : ""
            }
            <button type="button" class="queue-item-remove" data-${group === "error" ? "queue-remove-failed" : group === "done" ? "queue-remove-done" : "queue-remove"}="1" data-index="${group === "pending" ? pendingIndex : actionIndex}" title="${t("queue.item.remove.title")}" aria-label="${t("queue.item.remove.title")}"><i data-lucide="x"></i></button>
          </div>
        </div>
        ${
          isDownloading
            ? `<span class="queue-progress-line" style="width:${Math.max(0, Math.min(100, Number(item.progress) || 0))}%;"></span>`
            : ""
        }
      </li>
    `;
  };

  if (queueList) {
    queueList.setAttribute("role", "list");
    if (!hasQueueItems) {
      const emptyMarkup = `
        <div class="queue-empty">
          <span class="queue-empty-icon" aria-hidden="true"><i data-lucide="inbox"></i></span>
          <p class="queue-empty-title">${escapeQueueHtml(t("queue.empty.title"))}</p>
          <p class="queue-empty-hint">${escapeQueueHtml(t("queue.empty.hint"))}</p>
        </div>
      `;
      if (lastQueueMarkup !== emptyMarkup) {
        queueList.innerHTML = emptyMarkup;
        lastQueueMarkup = emptyMarkup;
      }
    } else {
      const rows = [
        ...activeItems.map((item, idx) => rowMarkup(item, idx, "active")),
        ...pendingItems.map((item, idx) =>
          rowMarkup(item, activeItems.length + idx, "pending", idx, idx),
        ),
        ...errorItems.map((item, idx) =>
          rowMarkup(
            item,
            activeItems.length + pendingItems.length + idx,
            "error",
            -1,
            idx,
          ),
        ),
        ...doneItems.map((item, idx) =>
          rowMarkup(
            item,
            activeItems.length + pendingItems.length + errorItems.length + idx,
            "done",
            -1,
            idx,
          ),
        ),
      ];
      const nextMarkup = `<ul role="list" class="queue-items">${rows.join("")}</ul>`;
      if (nextMarkup !== lastQueueMarkup) {
        queueList.innerHTML = nextMarkup;
        lastQueueMarkup = nextMarkup;
      }
    }
  }
  applyLucideIcons();
  updateDownloaderTabLabel();
}

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
    downloadCancelButton.setAttribute("aria-label", t("actions.cancelDownload"));
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

const requeueActiveDownloads = () => {
  const activeJobs = getActiveDownloadJobs(state);
  if (activeJobs.length === 0) return 0;
  const existingSignatures = new Set(
    getPendingDownloadJobs(state).map((item) =>
      getQueueSignature(item.url, item.quality),
    ),
  );
  let requeuedCount = 0;
  for (const item of activeJobs) {
    if (!item?.url || !item?.quality) continue;
    const signature = getQueueSignature(item.url, item.quality);
    if (existingSignatures.has(signature)) continue;
    existingSignatures.add(signature);
    upsertDownloadJob(state, {
      ...normalizeQueueItem({
        id: item.id,
        jobId: item.jobId,
        url: item.url,
        quality: item.quality,
        title: item.title || makeQueueTitle(item.url),
        status: "pending",
        progress: 0,
        signature,
      }),
      status: JOB_STATUS.pending,
      stage: "",
      progress: 0,
    });
    requeuedCount += 1;
  }
  return requeuedCount;
};

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
    const iconUrl = await window.electron.invoke("get-icon-path", url);
    const entryId = Date.now();
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

    await addNewEntryToHistory(newLogEntry);
    markAsDownloaded(sourceUrl || url, requestedDownloadKind);
    await updateDownloadCount();

    if (historyContainer) historyContainer.scrollTop = 0;
    window.localStorage.setItem("lastDownloadedFile", filePath);
    openLastVideoButton.disabled = false;
    return { ok: true };
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
  while (
    getActiveDownloadJobs(state).length < maxActive &&
    getPendingDownloadJobs(state).length > 0
  ) {
    const next = getPendingDownloadJobs(state)[0];
    if (!next) break;
    removeDownloadJob(
      state,
      (item) =>
        item.status !== JOB_STATUS.running &&
        getQueueSignature(item.url, item.quality) ===
          getQueueSignature(next.url, next.quality),
    );
    started += 1;
    initiateDownload(next.url, next.quality, {
      fromQueue: true,
      initialTitle: next.title || "",
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
          fileName: resolvedTitle || makeQueueTitle(url) || makeQueueUrlLabel(url),
          filePath: "",
          quality:
            typeof quality === "string" ? quality : quality?.label || t("quality.custom"),
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
    } else if (result?.ok) {
      upsertDownloadJob(state, {
        id: jobId,
        jobId,
        title: resolvedTitle,
        url,
        quality,
        status: JOB_STATUS.done,
        stage: "finalize",
        progress: 100,
        signature,
      });
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
  }
};

const handleDownloadButtonClick = async (options = {}) => {
  state.suppressAutoPump = false;
  state.queuePaused = false;
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

  // Если несколько: стартуем первый/добавляем остальные в очередь
  if (validUrls.length > 1) {
    const first = validUrls[0];
    const qualityProfile = readQualityProfile();
    const selectionRaw = await openDownloadQualityModal(first, {
      presetQuality: resolvePresetQuality(qualityProfile),
      defaultQualityProfile: qualityProfile,
      preferredLabel:
        qualityProfile === "remember"
          ? lastChosenQualityLabel || readLastQuality()
          : null,
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
  const qualityProfile = readQualityProfile();
  const selectionRaw = await openDownloadQualityModal(url, {
    presetQuality: resolvePresetQuality(qualityProfile),
    defaultQualityProfile: qualityProfile,
    preferredLabel:
      qualityProfile === "remember"
        ? lastChosenQualityLabel || readLastQuality()
        : null,
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
      getPendingDownloadJobs(state).some((item) => isSameQueueTask(item, candidateTask))
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

function initDownloadButton() {
  downloadButton.addEventListener("click", async () => {
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
      console.log(QUEUE_LOG_TAG, "enqueue-button-click");
      await handleDownloadButtonClick({ enqueueOnly: true });
    });
  }

  if (queueClearButton) {
    queueClearButton.addEventListener("click", async () => {
      if (
        !getPendingDownloadJobs(state).length &&
        !getFailedDownloadJobs(state).length &&
        !getCompletedDownloadJobs(state).length
      )
        return;
      const confirmed = await showConfirmationDialog({
        title: t("queue.clear.confirm.title"),
        subtitle: t("queue.clear.confirm.subtitle"),
        message: t("queue.clear.confirm.message"),
        confirmText: t("queue.clear.confirm.confirm"),
        cancelText: t("queue.clear.confirm.cancel"),
        tone: "danger",
      });
      if (!confirmed) return;
      replaceDownloadJobsByStatus(state, [
        JOB_STATUS.pending,
        JOB_STATUS.paused,
        JOB_STATUS.failed,
        JOB_STATUS.done,
      ], []);
      persistQueue();
      persistFailedQueue();
      updateQueueDisplay();
      console.log(QUEUE_LOG_TAG, "clear");
      showToast(t("queue.cleared"), "info");
    });
  }

  if (queuePauseButton) {
    queuePauseButton.addEventListener("click", async () => {
      const activeCount = getActiveDownloadJobs(state).length;
      const pendingCount = getPendingDownloadJobs(state).length;
      if (activeCount <= 0 && pendingCount <= 0) return;
      if (state.suppressAutoPump) return;
      state.suppressAutoPump = true;
      state.queuePaused = true;
      const requeuedCount = activeCount > 0 ? requeueActiveDownloads() : 0;
      if (requeuedCount > 0) {
        persistQueue();
      }
      updateQueueDisplay();
      if (activeCount > 0) {
        try {
          const result = await window.electron.invoke("stop-download");
          if (result?.success) {
            showToast(t("queue.pause.stoppedAndQueued"), "info");
          } else {
            showToast(t("download.cancel.failed"), "error");
          }
        } catch (error) {
          console.error("Error stopping download from queue pause:", error);
          showToast(t("download.cancel.error"), "error");
        } finally {
          resetDownloadUiState({ suppressAutoPump: true });
        }
      } else {
        showToast(t("queue.status.paused"), "info");
      }
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
    queueList.addEventListener("click", (e) => {
      const retryFailedBtn = e.target.closest("[data-queue-retry-failed]");
      if (retryFailedBtn) {
        const idx = Number(retryFailedBtn.dataset.index);
        if (!Number.isFinite(idx)) return;
        const task = getFailedDownloadJobs(state)[idx];
        if (!task) return;
        const signature = getQueueSignature(task.url, task.quality);
        if (task.retryable === false) {
          showToast(t("queue.item.retry.disabled"), "warning");
          return;
        }
        if (getCurrentDownloadSignatures().has(signature)) {
          showToast(t("download.url.active"), "warning");
          return;
        }
        removeDownloadJob(
          state,
          (item) =>
            item.status === JOB_STATUS.failed &&
            getQueueSignature(item.url, item.quality) === signature,
        );
        persistFailedQueue();
        initiateDownload(task.url, task.quality, { fromQueue: false });
        pumpDownloadPool("auto");
        updateQueueDisplay();
        showToast(t("queue.item.retrying"), "info");
        return;
      }

      const moveBtn = e.target.closest("[data-queue-move]");
      if (moveBtn) {
        const idx = Number(moveBtn.dataset.index);
        const direction = moveBtn.dataset.queueMove;
        if (!Number.isFinite(idx)) return;
        const pendingJobs = [...getPendingDownloadJobs(state)];
        if (direction === "up" && idx > 0) {
          const [item] = pendingJobs.splice(idx, 1);
          pendingJobs.splice(idx - 1, 0, item);
          replaceDownloadJobsByStatus(
            state,
            [JOB_STATUS.pending, JOB_STATUS.paused],
            pendingJobs,
          );
          persistQueue();
          updateQueueDisplay();
          console.log(QUEUE_LOG_TAG, "move-item", { from: idx, to: idx - 1 });
          showToast(t("queue.item.movedUp"), "info");
        } else if (
          direction === "down" &&
          idx >= 0 &&
          idx < pendingJobs.length - 1
        ) {
          const [item] = pendingJobs.splice(idx, 1);
          pendingJobs.splice(idx + 1, 0, item);
          replaceDownloadJobsByStatus(
            state,
            [JOB_STATUS.pending, JOB_STATUS.paused],
            pendingJobs,
          );
          persistQueue();
          updateQueueDisplay();
          console.log(QUEUE_LOG_TAG, "move-item", { from: idx, to: idx + 1 });
          showToast(t("queue.item.movedDown"), "info");
        }
        return;
      }

      const btn = e.target.closest("[data-queue-remove]");
      const failedRemoveBtn = e.target.closest("[data-queue-remove-failed]");
      const doneRemoveBtn = e.target.closest("[data-queue-remove-done]");
      if (doneRemoveBtn) {
        const idx = Number(doneRemoveBtn.dataset.index);
        if (!Number.isFinite(idx)) return;
        const task = getCompletedDownloadJobs(state)[idx];
        if (!task) return;
        removeDownloadJob(state, task.signature || task.jobId || task.id);
        updateQueueDisplay();
        showToast(t("queue.item.removed"), "info");
        return;
      }
      if (failedRemoveBtn) {
        const idx = Number(failedRemoveBtn.dataset.index);
        if (!Number.isFinite(idx)) return;
        const task = getFailedDownloadJobs(state)[idx];
        if (!task) return;
        removeDownloadJob(
          state,
          (item) =>
            item.status === JOB_STATUS.failed &&
            getQueueSignature(item.url, item.quality) ===
              getQueueSignature(task.url, task.quality),
        );
        persistFailedQueue();
        updateQueueDisplay();
        showToast(t("queue.item.removed"), "info");
        return;
      }
      if (!btn) return;
      const idx = Number(btn.dataset.index);
      if (!Number.isFinite(idx)) return;
      const removed = getPendingDownloadJobs(state)[idx];
      if (!removed) return;
      removeDownloadJob(
        state,
        removed.signature || getQueueSignature(removed.url, removed.quality),
      );
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
      if (
        getPendingDownloadJobs(state).length === 0 ||
        getActiveDownloadJobs(state).length > 0
      )
        return;
      state.suppressAutoPump = false;
      state.queuePaused = false;
      console.log(QUEUE_LOG_TAG, "manual-start");
      pumpDownloadPool("manual");
      updateQueueDisplay();
    });
  }

  if (queueRetryFailedButton) {
    queueRetryFailedButton.addEventListener("click", () => {
      const tasks = [...getFailedDownloadJobs(state)];
      if (!tasks.length) return;
      clearDownloadJobsByStatus(state, JOB_STATUS.failed);
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

  if (getPendingDownloadJobs(state).length === 0) {
    replaceDownloadJobsByStatus(
      state,
      [JOB_STATUS.pending, JOB_STATUS.paused],
      loadQueueFromStorage().map((item) => ({
        ...item,
        status: JOB_STATUS.pending,
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
    const phase = String(event?.detail?.phase || "").trim().toLowerCase();
    if (!jobId || !Number.isFinite(progress)) return;
    const active = findActiveDownload(jobId);
    if (!active) return;
    active.progress = Math.max(0, Math.min(100, progress));
    if (phase === "download") active.stage = "download";
    if (phase === "merge" || phase === "finalize") active.stage = "finalize";
    const now = Date.now();
    if (now - lastProgressRenderTs < PROGRESS_RENDER_THROTTLE_MS) return;
    lastProgressRenderTs = now;
    updateQueueDisplay();
  });
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
};
