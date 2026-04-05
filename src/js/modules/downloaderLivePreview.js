const PLAY_EVENT = "downloader:live-preview-open";
const RETRY_EVENT = "downloader:live-preview-retry";
const STATE_EVENT = "downloader:live-preview-state";

let panelEl = null;
let videoEl = null;
let sourceEl = null;
let closeButtonEl = null;
let hasInitialized = false;
let currentPageUrl = "";
let retryTriggered = false;
let pendingResumeTime = null;

function syncRefs() {
  panelEl = document.getElementById("preview-live-player");
  videoEl = document.getElementById("preview-live-video");
  sourceEl = document.getElementById("preview-live-video-source");
  closeButtonEl = document.getElementById("preview-live-close");
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
  sourceEl.removeAttribute("src");
  sourceEl.removeAttribute("type");
  videoEl.load();
}

function hideDownloaderLivePreview() {
  syncRefs();
  panelEl?.classList.add("hidden");
  panelEl?.classList.remove("is-open");
  panelEl?.setAttribute("aria-hidden", "true");
  currentPageUrl = "";
  retryTriggered = false;
  pendingResumeTime = null;
  resetPlayerState();
  emitState(false);
}

async function openDownloaderLivePreview(preview = null, options = {}) {
  syncRefs();
  if (!panelEl || !videoEl || !sourceEl || !preview?.src) {
    hideDownloaderLivePreview();
    return false;
  }

  resetPlayerState();

  currentPageUrl =
    typeof options?.pageUrl === "string" ? options.pageUrl.trim() : "";
  retryTriggered = false;
  pendingResumeTime = Number.isFinite(Number(options?.resumeTime))
    ? Number(options.resumeTime)
    : null;

  if (preview.poster) {
    videoEl.setAttribute("poster", preview.poster);
  }
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
  emitState(true);

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
    hideDownloaderLivePreview();
    return;
  }

  retryTriggered = true;
  pauseLivePreview();
  panelEl?.classList.add("hidden");
  panelEl?.classList.remove("is-open");
  panelEl?.setAttribute("aria-hidden", "true");
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

function initDownloaderLivePreview() {
  syncRefs();
  if (!panelEl || !videoEl || hasInitialized) return;
  hasInitialized = true;

  closeButtonEl?.addEventListener("click", () => {
    hideDownloaderLivePreview();
  });

  videoEl.addEventListener("error", handlePlaybackError);
  document.addEventListener("visibilitychange", handleVisibilityPause);
  window.addEventListener("blur", handleVisibilityPause);

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
