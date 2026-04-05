let videoEl = null;
let sourceEl = null;
let layerEl = null;

function syncRefs() {
  layerEl = document.getElementById("downloader-background-preview");
  videoEl = document.getElementById("downloader-background-video");
  sourceEl = document.getElementById("downloader-background-video-source");
}

function setLayerActive(isActive) {
  layerEl?.classList.toggle("is-active", isActive);
}

function clearDownloaderBackgroundPreview() {
  syncRefs();
  if (!videoEl || !sourceEl) {
    setLayerActive(false);
    return;
  }

  try {
    videoEl.pause();
  } catch {}

  videoEl.removeAttribute("poster");
  sourceEl.removeAttribute("src");
  sourceEl.removeAttribute("type");
  videoEl.load();
  setLayerActive(false);
}

async function applyDownloaderBackgroundPreview(preview = null) {
  syncRefs();
  if (!videoEl || !sourceEl || !preview?.src) {
    clearDownloaderBackgroundPreview();
    return false;
  }

  try {
    videoEl.muted = true;
    videoEl.loop = true;
    videoEl.playsInline = true;
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
    setLayerActive(true);

    const playAttempt = videoEl.play();
    if (playAttempt && typeof playAttempt.catch === "function") {
      await playAttempt.catch(() => {});
    }
    return true;
  } catch {
    clearDownloaderBackgroundPreview();
    return false;
  }
}

function initDownloaderBackgroundPreview() {
  syncRefs();
  if (!videoEl) return;

  videoEl.addEventListener("error", () => {
    clearDownloaderBackgroundPreview();
  });
}

export {
  applyDownloaderBackgroundPreview,
  clearDownloaderBackgroundPreview,
  initDownloaderBackgroundPreview,
};
