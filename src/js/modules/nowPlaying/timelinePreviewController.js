import { formatPlaybackTime } from "./viewUtils.js";

const HOVER_DEBOUNCE_MS = 120;

function unwrapResult(result) {
  if (result?.success === false) {
    const error = new Error(result.error?.message || "Preview unavailable");
    error.code = result.error?.code;
    throw error;
  }
  return result?.data ?? result ?? {};
}

export function createTimelinePreviewController({
  api,
  controller,
  onPreviewImage = () => {},
  progress,
  root,
}) {
  const preview = root.querySelector('[data-ui="timeline-preview"]');
  const image = root.querySelector('[data-ui="timeline-preview-image"]');
  const time = root.querySelector('[data-ui="timeline-preview-time"]');
  let requestSequence = 0;
  let activeRequestId = "";
  let timer = null;
  let visibleTrackId = "";
  let eagerTrackId = "";
  let disposed = false;

  function cancelPending() {
    if (timer !== null) clearTimeout(timer);
    timer = null;
    if (activeRequestId) api?.cancelTimelinePreview?.(activeRequestId);
    activeRequestId = "";
  }

  function hide() {
    cancelPending();
    if (preview) preview.hidden = true;
  }

  async function requestPreview(track, timestamp) {
    if (!api?.getTimelinePreview || track?.kind !== "video") return;
    const requestId = `timeline-${Date.now().toString(36)}-${(++requestSequence).toString(36)}`;
    activeRequestId = requestId;
    const context = controller.getPreviewContext();
    try {
      const result = unwrapResult(
        await api.getTimelinePreview({
          requestId,
          sessionId: context.sessionId || undefined,
          timestamp,
          trackId: track.id,
        }),
      );
      if (
        disposed ||
        activeRequestId !== requestId ||
        visibleTrackId !== track.id
      ) {
        return;
      }
      activeRequestId = "";
      const source = result.dataUrl || track.artworkUrl || "";
      if (image) {
        image.hidden = !source;
        if (source) image.src = source;
        else image.removeAttribute("src");
      }
      if (result.dataUrl) onPreviewImage(track.id, result.dataUrl);
    } catch {
      if (activeRequestId === requestId) activeRequestId = "";
      if (image) {
        image.hidden = !track.artworkUrl;
        if (track.artworkUrl) image.src = track.artworkUrl;
      }
    }
  }

  function showAt(clientX) {
    const snapshot = controller.getSnapshot();
    const track = snapshot.currentTrack;
    const duration = Math.max(0, Number(snapshot.duration) || 0);
    if (!preview || !progress || !track || !duration) {
      hide();
      return;
    }
    const hasVideoPreview = track.kind === "video";
    const bounds = progress.getBoundingClientRect();
    const ratio = Math.min(
      1,
      Math.max(0, (clientX - bounds.left) / Math.max(1, bounds.width)),
    );
    const timestamp = duration * ratio;
    visibleTrackId = track.id;
    preview.classList.toggle("is-time-only", !hasVideoPreview);
    preview.hidden = false;
    preview.style.setProperty("--preview-position", `${ratio * 100}%`);
    if (time) time.textContent = formatPlaybackTime(timestamp);
    if (!hasVideoPreview) {
      cancelPending();
      if (image) {
        image.hidden = true;
        image.removeAttribute("src");
      }
      return;
    }
    if (timer !== null) clearTimeout(timer);
    timer = setTimeout(() => {
      timer = null;
      void requestPreview(track, timestamp);
    }, HOVER_DEBOUNCE_MS);
  }

  function onPointerMove(event) {
    showAt(event.clientX);
  }

  function onInput() {
    const bounds = progress.getBoundingClientRect();
    const max = Math.max(0, Number(progress.max) || 0);
    const value = Math.max(0, Number(progress.value) || 0);
    showAt(bounds.left + (max ? value / max : 0) * bounds.width);
  }

  function update(snapshot = {}) {
    const track = snapshot.currentTrack;
    const nextTrackId = String(track?.id || "");
    if (nextTrackId === eagerTrackId) return;
    eagerTrackId = nextTrackId;
    cancelPending();
    visibleTrackId = nextTrackId;
    if (image) {
      image.hidden = true;
      image.removeAttribute("src");
    }
    preview?.classList.toggle("is-time-only", track?.kind !== "video");
    if (track?.kind !== "video" || !nextTrackId) return;
    const duration = Math.max(
      0,
      Number(snapshot.duration) || Number(track.duration) || 0,
    );
    void requestPreview(track, Math.min(2, duration));
  }

  progress?.addEventListener("pointermove", onPointerMove);
  progress?.addEventListener("pointerleave", hide);
  progress?.addEventListener("blur", hide);
  progress?.addEventListener("input", onInput);

  return {
    dispose() {
      disposed = true;
      hide();
      progress?.removeEventListener("pointermove", onPointerMove);
      progress?.removeEventListener("pointerleave", hide);
      progress?.removeEventListener("blur", hide);
      progress?.removeEventListener("input", onInput);
    },
    update,
  };
}

export default createTimelinePreviewController;
