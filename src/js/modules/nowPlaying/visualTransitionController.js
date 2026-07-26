function escapeCssUrl(value) {
  return String(value).replaceAll('"', "%22");
}

export function createVisualTransitionController({
  root,
  mediaLayers,
  visualLayers,
  ambientLayers,
  artworkLayers,
  artworkStack,
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

  function commitTransition(index, trackId, { artworkReady = false } = {}) {
    if (visualTrackId !== trackId) return;
    const metadataIndex = Number(artworkLayers[index].dataset.metadataIndex);
    artworkLayers.forEach((layer, layerIndex) => {
      layer.classList.toggle("is-active", layerIndex === index);
    });
    metadataSlots.forEach((slot, slotIndex) => {
      slot.classList.toggle("is-active", slotIndex === metadataIndex);
    });
    const image = artworkImages[index];
    image.classList.toggle("is-loaded", artworkReady);
    const activeSlot = metadataSlots[metadataIndex];
    root.classList.toggle(
      "has-sidebar-artist",
      !activeSlot.querySelector(".now-playing__track-artist").hidden,
    );
    root.classList.toggle(
      "has-sidebar-album",
      !activeSlot.querySelector(".now-playing__album").hidden,
    );
    activeMetadataIndex = metadataIndex;
    pendingMetadataIndex = -1;
  }

  function onArtworkLoad(event) {
    const image = event.currentTarget;
    if (image.dataset.visualTrackId !== visualTrackId) return;
    setArtworkVisibility(true);
    commitTransition(Number(image.dataset.layerIndex), visualTrackId, {
      artworkReady: true,
    });
  }

  function onArtworkError(event) {
    const image = event.currentTarget;
    if (image.dataset.visualTrackId !== visualTrackId) return;
    setArtworkVisibility(false);
    commitTransition(Number(image.dataset.layerIndex), visualTrackId);
  }

  artworkImages.forEach((image, index) => {
    image.dataset.layerIndex = String(index);
    image.addEventListener("load", onArtworkLoad);
    image.addEventListener("error", onArtworkError);
  });
  reducedMotionQuery?.addEventListener?.("change", syncMotionPreference);
  syncMotionPreference();

  function setArtworkVisibility(visible) {
    artworkStack.hidden = false;
    root.classList.toggle("has-artwork", visible);
  }

  function prepareMetadata(track) {
    pendingMetadataIndex =
      activeMetadataIndex < 0 ? 0 : 1 - activeMetadataIndex;
    const slot = metadataSlots[pendingMetadataIndex];
    slot.querySelector(".now-playing__track-title").textContent =
      track.displayTitle || track.title;
    const artist = slot.querySelector(".now-playing__track-artist");
    const artistText = String(track.artist || "").trim();
    artist.textContent = artistText;
    artist.hidden = !artistText;
    const album = slot.querySelector(".now-playing__album");
    const albumText = String(track.album || "").trim();
    album.textContent = albumText;
    album.hidden = !albumText;
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
      setArtworkVisibility(false);
      commitTransition(nextIndex, track.id);
      return;
    }
    image.src = track.artworkUrl;
    if (isReducedMotion()) {
      setArtworkVisibility(false);
      commitTransition(nextIndex, track.id);
      return;
    }
    if (image.complete && image.naturalWidth > 0) {
      setArtworkVisibility(true);
      commitTransition(nextIndex, track.id, { artworkReady: true });
    }
  }

  function updateTrack(track) {
    if (!track) {
      visualTrackId = null;
      root.classList.remove(
        "has-track",
        "has-artwork",
        "has-sidebar-artist",
        "has-sidebar-album",
      );
      artworkStack.hidden = true;
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
