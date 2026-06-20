import {
  acquireBodyScrollLock,
  releaseBodyScrollLock,
} from "./scrollLockManager.js";

const PLAY_EVENT = "downloader:live-preview-open";
const RETRY_EVENT = "downloader:live-preview-retry";
const STATE_EVENT = "downloader:live-preview-state";

let panelEl = null;
let dialogEl = null;
let videoEl = null;
let sourceEl = null;
let closeButtonEl = null;
let titleEl = null;
let metaEl = null;
let sourceBadgeEl = null;
let durationBadgeEl = null;
let hasInitialized = false;
let currentPageUrl = "";
let retryTriggered = false;
let pendingResumeTime = null;
let lastFocusedElement = null;
const DOWNLOADER_LIVE_PREVIEW_SCROLL_LOCK_OWNER = "downloader-live-preview";
const DEFAULT_TITLE = "Live preview";
const FOCUSABLE_SELECTOR = [
  "button:not([disabled])",
  "video[controls]",
  "a[href]",
  "input:not([disabled])",
  "select:not([disabled])",
  "textarea:not([disabled])",
  '[tabindex]:not([tabindex="-1"])',
].join(",");

function syncRefs() {
  panelEl = document.getElementById("preview-live-player");
  dialogEl =
    panelEl?.querySelector(".preview-live-player-modal__dialog") || null;
  videoEl = document.getElementById("preview-live-video");
  sourceEl = document.getElementById("preview-live-video-source");
  closeButtonEl = document.getElementById("preview-live-close");
  titleEl = document.getElementById("preview-live-title");
  metaEl = document.getElementById("preview-live-meta");
  sourceBadgeEl = document.getElementById("preview-live-source");
  durationBadgeEl = document.getElementById("preview-live-duration");
}

function emitState(isOpen) {
  window.dispatchEvent(
    new CustomEvent(STATE_EVENT, {
      detail: { isOpen: !!isOpen, pageUrl: currentPageUrl || "" },
    }),
  );
}

function pauseLivePreview() {
  if (!videoEl) return;
  try {
    videoEl.pause();
  } catch {}
}

function getCurrentPlaybackTime() {
  if (!videoEl) return null;
  const value = Number(videoEl.currentTime);
  return Number.isFinite(value) && value > 0 ? value : null;
}

function resetPlayerState() {
  if (!videoEl || !sourceEl) return;
  pauseLivePreview();
  videoEl.removeAttribute("poster");
  videoEl.removeAttribute("aria-label");
  sourceEl.removeAttribute("src");
  sourceEl.removeAttribute("type");
  videoEl.load();
}

function setTextBadge(element, value = "") {
  if (!element) return;
  const text = String(value || "").trim();
  element.textContent = text;
  element.classList.toggle("hidden", !text);
}

function syncPlayerMeta(preview = {}, options = {}) {
  const title = String(options?.title || preview?.title || "").trim();
  const source = String(options?.source || preview?.source || "").trim();
  const duration = String(options?.duration || preview?.duration || "").trim();
  const displayTitle = title || DEFAULT_TITLE;

  if (titleEl) {
    titleEl.textContent = displayTitle;
  }
  panelEl?.setAttribute("aria-label", displayTitle);
  videoEl?.setAttribute("aria-label", displayTitle);
  setTextBadge(sourceBadgeEl, source);
  setTextBadge(durationBadgeEl, duration);
  metaEl?.classList.toggle("hidden", !(source || duration));
}

function focusFirstDialogControl() {
  const target =
    closeButtonEl || dialogEl?.querySelector(FOCUSABLE_SELECTOR) || dialogEl;
  try {
    target?.focus?.();
  } catch {}
}

function handleFocusTrap(event) {
  if (event.key !== "Tab" || !panelEl?.classList.contains("is-open")) return;
  if (!dialogEl) return;

  const focusable = Array.from(dialogEl.querySelectorAll(FOCUSABLE_SELECTOR))
    .filter((element) => {
      if (!(element instanceof HTMLElement)) return false;
      return !element.hidden && element.getAttribute("aria-hidden") !== "true";
    });

  if (!focusable.length) {
    event.preventDefault();
    focusFirstDialogControl();
    return;
  }

  const first = focusable[0];
  const last = focusable[focusable.length - 1];
  const active = document.activeElement;
  if (event.shiftKey && active === first) {
    event.preventDefault();
    last.focus();
    return;
  }
  if (!event.shiftKey && active === last) {
    event.preventDefault();
    first.focus();
  }
}

function syncBodyScrollLock() {
  if (panelEl?.classList.contains("is-open")) {
    acquireBodyScrollLock(DOWNLOADER_LIVE_PREVIEW_SCROLL_LOCK_OWNER);
    return;
  }
  releaseBodyScrollLock(DOWNLOADER_LIVE_PREVIEW_SCROLL_LOCK_OWNER);
}

function restoreFocus() {
  if (
    lastFocusedElement &&
    typeof lastFocusedElement.focus === "function" &&
    lastFocusedElement.isConnected
  ) {
    try {
      lastFocusedElement.focus();
    } catch {}
  }
  lastFocusedElement = null;
}

function hideDownloaderLivePreview(options = {}) {
  syncRefs();
  panelEl?.classList.add("hidden");
  panelEl?.classList.remove("is-open");
  panelEl?.setAttribute("aria-hidden", "true");
  syncBodyScrollLock();
  currentPageUrl = "";
  retryTriggered = false;
  pendingResumeTime = null;
  resetPlayerState();
  syncPlayerMeta();
  emitState(false);
  if (options?.restoreFocus === true) {
    restoreFocus();
  } else {
    lastFocusedElement = null;
  }
}

async function openDownloaderLivePreview(preview = null, options = {}) {
  syncRefs();
  if (!panelEl || !dialogEl || !videoEl || !sourceEl || !preview?.src) {
    hideDownloaderLivePreview();
    return false;
  }

  resetPlayerState();
  lastFocusedElement =
    document.activeElement instanceof HTMLElement
      ? document.activeElement
      : null;

  currentPageUrl =
    typeof options?.pageUrl === "string" ? options.pageUrl.trim() : "";
  retryTriggered = false;
  pendingResumeTime = Number.isFinite(Number(options?.resumeTime))
    ? Number(options.resumeTime)
    : null;

  if (preview.poster) {
    videoEl.setAttribute("poster", preview.poster);
  }
  syncPlayerMeta(preview, options);
  sourceEl.src = preview.src;
  if (preview.mime) {
    sourceEl.type = preview.mime;
  }
  videoEl.muted = false;
  videoEl.defaultMuted = false;
  videoEl.volume = 0.5;
  videoEl.load();
  if (pendingResumeTime && pendingResumeTime > 0) {
    try {
      videoEl.currentTime = pendingResumeTime;
    } catch {}
  }
  pendingResumeTime = null;

  panelEl.classList.remove("hidden");
  panelEl.classList.add("is-open");
  panelEl.setAttribute("aria-hidden", "false");
  syncBodyScrollLock();
  emitState(true);
  focusFirstDialogControl();

  try {
    const playAttempt = videoEl.play();
    if (playAttempt && typeof playAttempt.catch === "function") {
      await playAttempt.catch(() => {});
    }
  } catch {}

  return true;
}

function handlePlaybackError() {
  if (!currentPageUrl || retryTriggered) {
    hideDownloaderLivePreview({ restoreFocus: false });
    return;
  }

  retryTriggered = true;
  pauseLivePreview();
  panelEl?.classList.add("hidden");
  panelEl?.classList.remove("is-open");
  panelEl?.setAttribute("aria-hidden", "true");
  syncBodyScrollLock();
  emitState(false);
  window.dispatchEvent(
    new CustomEvent(RETRY_EVENT, {
      detail: {
        url: currentPageUrl,
        resumeTime: getCurrentPlaybackTime(),
      },
    }),
  );
}

function handleVisibilityPause() {
  if (
    document.visibilityState === "hidden" ||
    (typeof document.hasFocus === "function" && !document.hasFocus())
  ) {
    pauseLivePreview();
  }
}

function handleEscapeClose(event) {
  if (!panelEl?.classList.contains("is-open")) return;
  if (event.key === "Tab") {
    handleFocusTrap(event);
    return;
  }
  if (event.key !== "Escape") return;
  event.preventDefault();
  hideDownloaderLivePreview({ restoreFocus: true });
}

function handleOverlayPointerDown(event) {
  if (!panelEl?.classList.contains("is-open")) return;
  if (event.target !== panelEl) return;
  hideDownloaderLivePreview({ restoreFocus: true });
}

function initDownloaderLivePreview() {
  syncRefs();
  if (!panelEl || !videoEl || hasInitialized) return;
  hasInitialized = true;

  closeButtonEl?.addEventListener("click", () => {
    hideDownloaderLivePreview({ restoreFocus: true });
  });

  videoEl.addEventListener("error", handlePlaybackError);
  document.addEventListener("visibilitychange", handleVisibilityPause);
  document.addEventListener("keydown", handleEscapeClose);
  window.addEventListener("blur", handleVisibilityPause);
  panelEl.addEventListener("mousedown", handleOverlayPointerDown);

  window.addEventListener(PLAY_EVENT, async (event) => {
    await openDownloaderLivePreview(
      event?.detail?.preview || null,
      event?.detail?.options || {},
    );
  });
}

export {
  PLAY_EVENT,
  RETRY_EVENT,
  STATE_EVENT,
  hideDownloaderLivePreview,
  initDownloaderLivePreview,
  openDownloaderLivePreview,
};
