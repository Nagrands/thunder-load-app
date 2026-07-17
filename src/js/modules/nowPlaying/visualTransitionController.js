import { t } from "../i18n.js";

function escapeCssUrl(value) {
  return String(value).replaceAll('"', "%22");
}

export function createVisualTransitionController({
  root,
  mediaLayers,
  visualLayers,
  ambientLayers,
  artworkLayers,
  metadataSlots,
  trackStage,
  playlistSection,
}) {
  const artworkImages = artworkLayers.map((layer) =>
    layer.querySelector(".now-playing__artwork"),
  );
  const reducedMotionQuery = window.matchMedia?.(
    "(prefers-reduced-motion: reduce)",
  );
  let visualTrackId = null;
  let lastPreparedArtworkIndex = -1;
  let activeMetadataIndex = -1;
  let pendingMetadataIndex = -1;

  function isReducedMotion() {
    return (
      document.body?.classList.contains("low-effects") ||
      document.documentElement?.classList.contains("low-effects") ||
      reducedMotionQuery?.matches === true
    );
  }

  function syncMotionPreference() {
    const reduced = isReducedMotion();
    root.classList.toggle("is-reduced-motion", reduced);
    root.dataset.motion = reduced ? "reduced" : "full";
  }

  function commitTransition(index, trackId, { fallback = false } = {}) {
    if (visualTrackId !== trackId) return;
    const metadataIndex = Number(artworkLayers[index].dataset.metadataIndex);
    artworkLayers.forEach((layer, layerIndex) => {
      layer.classList.toggle("is-active", layerIndex === index);
    });
    metadataSlots.forEach((slot, slotIndex) => {
      slot.classList.toggle("is-active", slotIndex === metadataIndex);
    });
    const layer = artworkLayers[index];
    const image = artworkImages[index];
    layer.classList.toggle("is-fallback", fallback);
    image.classList.toggle("is-loaded", !fallback);
    activeMetadataIndex = metadataIndex;
    pendingMetadataIndex = -1;
  }

  function onArtworkLoad(event) {
    const image = event.currentTarget;
    if (image.dataset.visualTrackId !== visualTrackId) return;
    commitTransition(Number(image.dataset.layerIndex), visualTrackId);
  }

  function onArtworkError(event) {
    const image = event.currentTarget;
    if (image.dataset.visualTrackId !== visualTrackId) return;
    commitTransition(Number(image.dataset.layerIndex), visualTrackId, {
      fallback: true,
    });
  }

  artworkImages.forEach((image, index) => {
    image.dataset.layerIndex = String(index);
    image.addEventListener("load", onArtworkLoad);
    image.addEventListener("error", onArtworkError);
  });
  reducedMotionQuery?.addEventListener?.("change", syncMotionPreference);
  syncMotionPreference();

  function prepareMetadata(track) {
    pendingMetadataIndex =
      activeMetadataIndex < 0 ? 0 : 1 - activeMetadataIndex;
    const slot = metadataSlots[pendingMetadataIndex];
    slot.querySelector(".now-playing__track-title").textContent = track.title;
    slot.querySelector(".now-playing__track-artist").textContent =
      track.artist || track.album || t("nowPlaying.unknownArtist");
    slot.querySelector(".now-playing__album").textContent = track.album || "";
  }

  function prepareArtwork(track) {
    const nextIndex =
      lastPreparedArtworkIndex < 0 ? 0 : 1 - lastPreparedArtworkIndex;
    lastPreparedArtworkIndex = nextIndex;
    const layer = artworkLayers[nextIndex];
    const image = artworkImages[nextIndex];
    layer.dataset.visualTrackId = track.id;
    layer.dataset.metadataIndex = String(pendingMetadataIndex);
    image.dataset.visualTrackId = track.id;
    image.classList.remove("is-loaded");
    if (!track.artworkUrl) {
      image.removeAttribute("src");
      commitTransition(nextIndex, track.id, { fallback: true });
      return;
    }
    layer.classList.add("is-fallback");
    image.src = track.artworkUrl;
    if (isReducedMotion()) {
      commitTransition(nextIndex, track.id, { fallback: true });
      return;
    }
    if (image.complete && image.naturalWidth > 0) {
      commitTransition(nextIndex, track.id);
    }
  }

  function updateTrack(track) {
    if (!track) {
      visualTrackId = null;
      root.classList.remove("has-track");
      trackStage.hidden = true;
      playlistSection.hidden = true;
      return;
    }
    root.classList.add("has-track");
    trackStage.hidden = false;
    playlistSection.hidden = false;
    if (track.id === visualTrackId) return;
    visualTrackId = track.id;
    prepareMetadata(track);
    prepareArtwork(track);
  }

  function updateMedia(snapshot) {
    const track = snapshot.currentTrack;
    const hasAudioTrack = track?.kind === "audio";
    visualLayers.forEach((layer, index) => {
      const active = index === snapshot.activeLayerIndex;
      layer.classList.toggle("is-visible", active);
      layer.classList.toggle("is-active", active);
      mediaLayers[index].classList.toggle(
        "is-visible",
        active && track?.kind === "video",
      );
      ambientLayers[index].classList.toggle(
        "is-visible",
        active && hasAudioTrack,
      );
    });
    if (!hasAudioTrack) return;
    ambientLayers[snapshot.activeLayerIndex].style.setProperty(
      "--ambient-artwork",
      track.artworkUrl ? `url("${escapeCssUrl(track.artworkUrl)}")` : "none",
    );
  }

  return {
    update(snapshot) {
      updateMedia(snapshot);
      updateTrack(snapshot.currentTrack);
    },
    onShow() {
      syncMotionPreference();
    },
    dispose() {
      artworkImages.forEach((image) => {
        image.removeEventListener("load", onArtworkLoad);
        image.removeEventListener("error", onArtworkError);
      });
      reducedMotionQuery?.removeEventListener?.("change", syncMotionPreference);
    },
  };
}

export default createVisualTransitionController;
