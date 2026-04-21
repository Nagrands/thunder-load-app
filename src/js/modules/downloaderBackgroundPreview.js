const RECOVERY_EVENT = "downloader:background-preview-recover";
const LIVE_PREVIEW_STATE_EVENT = "downloader:live-preview-state";
const DOWNLOADER_TAB_ID = "download";
const CROSSFADE_DELAY_MS = 40;
const CROSSFADE_SETTLE_MS = 320;

let layerEl = null;
let videoEls = [];
let sourceEls = [];
let activePreview = null;
let activeTabId = DOWNLOADER_TAB_ID;
let recoveryKey = "";
let recoveryTriggered = false;
let fadeInTimer = null;
let cleanupTimer = null;
let hasInitialized = false;
let currentSlotIndex = -1;
let pendingSlotIndex = -1;
let pendingResumeTime = null;
let livePreviewOpen = false;

function syncRefs() {
  layerEl = document.getElementById("downloader-background-preview");
  videoEls = [
    document.getElementById("downloader-background-video-a"),
    document.getElementById("downloader-background-video-b"),
  ].filter(Boolean);
  sourceEls = [
    document.getElementById("downloader-background-video-source-a"),
    document.getElementById("downloader-background-video-source-b"),
  ].filter(Boolean);
}

function clearTimer(timerId) {
  if (!timerId) return null;
  window.clearTimeout(timerId);
  return null;
}

function clearFadeInTimer() {
  fadeInTimer = clearTimer(fadeInTimer);
}

function clearCleanupTimer() {
  cleanupTimer = clearTimer(cleanupTimer);
}

function getVideo(slotIndex) {
  return videoEls[slotIndex] || null;
}

function getSource(slotIndex) {
  return sourceEls[slotIndex] || null;
}

function setLayerActive(isActive) {
  layerEl?.classList.toggle("is-active", isActive);
}

function isLayerAllowedToPlay() {
  return (
    activeTabId === DOWNLOADER_TAB_ID &&
    !livePreviewOpen &&
    document.visibilityState !== "hidden" &&
    document.hasFocus()
  );
}

function pauseVideo(slotIndex) {
  const videoEl = getVideo(slotIndex);
  if (!videoEl) return;
  try {
    videoEl.pause();
  } catch {}
}

async function playVideo(slotIndex) {
  const videoEl = getVideo(slotIndex);
  if (!videoEl || !isLayerAllowedToPlay()) return false;
  const sourceEl = getSource(slotIndex);
  if (!sourceEl?.getAttribute("src")) return false;
  try {
    const playAttempt = videoEl.play();
    if (playAttempt && typeof playAttempt.catch === "function") {
      await playAttempt.catch(() => {});
    }
    return true;
  } catch {
    return false;
  }
}

function syncPlaybackState() {
  videoEls.forEach((videoEl, index) => {
    if (!videoEl) return;
    if (isLayerAllowedToPlay() && getSource(index)?.getAttribute("src")) {
      void playVideo(index);
      return;
    }
    pauseVideo(index);
  });
}

function dispatchRecoveryRequest() {
  if (!activePreview?.src || recoveryTriggered) return;
  recoveryTriggered = true;
  window.dispatchEvent(
    new CustomEvent(RECOVERY_EVENT, {
      detail: {
        url: activePreview?.pageUrl || "",
      },
    }),
  );
}

function resetSlot(slotIndex) {
  const videoEl = getVideo(slotIndex);
  const sourceEl = getSource(slotIndex);
  if (!videoEl || !sourceEl) return;

  pauseVideo(slotIndex);
  videoEl.classList.remove("is-loading", "is-ready", "is-visible");
  videoEl.removeAttribute("poster");
  sourceEl.removeAttribute("src");
  sourceEl.removeAttribute("type");
  videoEl.load();
}

function applyPreviewSource(slotIndex, preview = null) {
  const videoEl = getVideo(slotIndex);
  const sourceEl = getSource(slotIndex);
  if (!videoEl || !sourceEl || !preview?.src) return false;

  videoEl.muted = true;
  videoEl.loop = true;
  videoEl.playsInline = true;
  videoEl.autoplay = false;
  videoEl.preload = "metadata";
  videoEl.classList.remove("is-ready");
  videoEl.classList.add("is-loading");

  if (preview.poster) {
    videoEl.setAttribute("poster", preview.poster);
  } else {
    videoEl.removeAttribute("poster");
  }

  sourceEl.src = preview.src;
  if (preview.mime) {
    sourceEl.type = preview.mime;
  } else {
    sourceEl.removeAttribute("type");
  }
  videoEl.load();
  return true;
}

function chooseTargetSlot() {
  if (currentSlotIndex < 0) return 0;
  return currentSlotIndex === 0 ? 1 : 0;
}

function cleanupInactiveSlot(slotIndex) {
  if (slotIndex < 0 || slotIndex === currentSlotIndex) return;
  resetSlot(slotIndex);
}

function getSlotCurrentTime(slotIndex) {
  const videoEl = getVideo(slotIndex);
  if (!videoEl) return null;
  const time = Number(videoEl.currentTime);
  return Number.isFinite(time) && time > 0 ? time : null;
}

function shouldCarryPlaybackPosition(pageUrl = "") {
  if (!pageUrl || !activePreview?.pageUrl) return false;
  return pageUrl === activePreview.pageUrl;
}

function applyResumeTime(slotIndex) {
  if (!Number.isFinite(pendingResumeTime) || pendingResumeTime <= 0) return;
  const videoEl = getVideo(slotIndex);
  if (!videoEl) {
    pendingResumeTime = null;
    return;
  }

  try {
    videoEl.currentTime = pendingResumeTime;
  } catch {}
  pendingResumeTime = null;
}

function clearDownloaderBackgroundPreview() {
  syncRefs();
  clearFadeInTimer();
  clearCleanupTimer();
  activePreview = null;
  recoveryKey = "";
  recoveryTriggered = false;
  pendingSlotIndex = -1;
  currentSlotIndex = -1;
  pendingResumeTime = null;

  if (!videoEls.length || !sourceEls.length) {
    setLayerActive(false);
    return;
  }

  videoEls.forEach((_, index) => resetSlot(index));
  setLayerActive(false);
}

function activatePendingSlot(slotIndex) {
  const pendingVideo = getVideo(slotIndex);
  if (!pendingVideo || pendingSlotIndex !== slotIndex || !activePreview?.src) {
    return;
  }

  const previousSlotIndex = currentSlotIndex;
  clearFadeInTimer();
  clearCleanupTimer();

  pendingVideo.classList.remove("is-loading");
  pendingVideo.classList.add("is-ready");
  applyResumeTime(slotIndex);

  fadeInTimer = window.setTimeout(() => {
    pendingVideo.classList.add("is-visible");
    if (previousSlotIndex >= 0 && previousSlotIndex !== slotIndex) {
      getVideo(previousSlotIndex)?.classList.remove("is-visible");
    }
    currentSlotIndex = slotIndex;
    pendingSlotIndex = -1;
    setLayerActive(true);
    syncPlaybackState();

    cleanupTimer = window.setTimeout(() => {
      cleanupInactiveSlot(previousSlotIndex);
    }, CROSSFADE_SETTLE_MS);
  }, CROSSFADE_DELAY_MS);
}

async function applyDownloaderBackgroundPreview(preview = null, options = {}) {
  syncRefs();
  if (videoEls.length < 2 || sourceEls.length < 2 || !preview?.src) {
    clearDownloaderBackgroundPreview();
    return false;
  }

  const pageUrl =
    typeof options?.pageUrl === "string" && options.pageUrl.trim()
      ? options.pageUrl.trim()
      : "";
  const nextRecoveryKey = [pageUrl, preview.src].filter(Boolean).join("::");
  const shouldResetRecovery = nextRecoveryKey !== recoveryKey;
  const resumeTime = shouldCarryPlaybackPosition(pageUrl)
    ? getSlotCurrentTime(currentSlotIndex)
    : null;

  activePreview = {
    ...preview,
    pageUrl,
  };
  recoveryKey = nextRecoveryKey;
  if (shouldResetRecovery) {
    recoveryTriggered = false;
  }

  const currentSource = getSource(currentSlotIndex)?.getAttribute("src") || "";
  if (currentSource && currentSource === preview.src && currentSlotIndex >= 0) {
    syncPlaybackState();
    setLayerActive(true);
    return true;
  }

  try {
    const targetSlotIndex = chooseTargetSlot();
    pendingResumeTime = resumeTime;
    const applied = applyPreviewSource(targetSlotIndex, activePreview);
    if (!applied) {
      clearDownloaderBackgroundPreview();
      return false;
    }

    pendingSlotIndex = targetSlotIndex;
    if (
      getVideo(targetSlotIndex)?.readyState >=
      HTMLMediaElement.HAVE_CURRENT_DATA
    ) {
      activatePendingSlot(targetSlotIndex);
    }

    syncPlaybackState();
    return true;
  } catch {
    clearDownloaderBackgroundPreview();
    return false;
  }
}

function handleLoadedData(slotIndex) {
  activatePendingSlot(slotIndex);
}

function handlePlaybackError(slotIndex) {
  const isRelevantSlot =
    slotIndex === currentSlotIndex || slotIndex === pendingSlotIndex;
  if (!isRelevantSlot) return;

  pauseVideo(slotIndex);
  getVideo(slotIndex)?.classList.remove("is-ready", "is-visible");
  if (slotIndex === currentSlotIndex) {
    setLayerActive(false);
  }
  dispatchRecoveryRequest();
}

function handleTabsActivated(event) {
  activeTabId = event?.detail?.id || "";
  syncPlaybackState();
}

function handleLivePreviewState(event) {
  livePreviewOpen = !!event?.detail?.isOpen;
  syncPlaybackState();
}

function initDownloaderBackgroundPreview() {
  syncRefs();
  if (videoEls.length < 2 || hasInitialized) return;
  hasInitialized = true;

  videoEls.forEach((videoEl, index) => {
    videoEl.addEventListener("loadeddata", () => handleLoadedData(index));
    videoEl.addEventListener("error", () => handlePlaybackError(index));
  });
  document.addEventListener("visibilitychange", syncPlaybackState);
  window.addEventListener("focus", syncPlaybackState);
  window.addEventListener("blur", syncPlaybackState);
  window.addEventListener("tabs:activated", handleTabsActivated);
  window.addEventListener(LIVE_PREVIEW_STATE_EVENT, handleLivePreviewState);

  syncPlaybackState();
}

export {
  RECOVERY_EVENT,
  applyDownloaderBackgroundPreview,
  clearDownloaderBackgroundPreview,
  initDownloaderBackgroundPreview,
};
