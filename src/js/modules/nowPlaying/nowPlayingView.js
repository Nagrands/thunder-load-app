import { applyI18n, t } from "../i18n.js";
import LocalMusicProvider from "./localMusicProvider.js";
import createPlaylistRenderer from "./playlistRenderer.js";
import PlaybackController from "./playbackController.js";
import MusicProviderRegistry from "./providerRegistry.js";
import buildNowPlayingMarkup from "./viewMarkup.js";

function formatTime(value) {
  const seconds = Math.max(0, Math.floor(Number(value) || 0));
  const minutes = Math.floor(seconds / 60);
  return `${minutes}:${String(seconds % 60).padStart(2, "0")}`;
}

function getStateData(result) {
  if (result?.success === false) {
    throw new Error(result.error?.message || "Unable to restore music library");
  }
  return result?.data ?? result ?? {};
}

function setButtonPressed(button, pressed) {
  button?.classList.toggle("is-active", pressed);
  button?.setAttribute("aria-pressed", String(pressed));
}

export function createNowPlayingView({
  api = window.electron?.nowPlaying,
  element = null,
} = {}) {
  const root = element || document.createElement("section");
  root.classList.add("now-playing", "tab-content");
  root.setAttribute("role", "tabpanel");
  root.setAttribute("aria-label", t("tabs.nowPlaying"));
  root.innerHTML = buildNowPlayingMarkup();

  const mediaLayers = Array.from(root.querySelectorAll(".now-playing__video"));
  const provider = new LocalMusicProvider(api);
  const providers = new MusicProviderRegistry();
  providers.register(provider);
  const controller = new PlaybackController({ providers, mediaLayers });
  const playlist = root.querySelector(".now-playing__playlist");
  const empty = root.querySelector(".now-playing__empty");
  const errorPanel = root.querySelector(".now-playing__error");
  const title = root.querySelector(".now-playing__track-title");
  const artist = root.querySelector(".now-playing__track-artist");
  const artwork = root.querySelector(".now-playing__artwork");
  const artworkFallback = root.querySelector(".now-playing__artwork-fallback");
  const album = root.querySelector('[data-ui="album"]');
  const progress = root.querySelector('[data-action="seek"]');
  const volume = root.querySelector('[data-action="volume"]');
  const status = root.querySelector(".now-playing__status");
  const playButton = root.querySelector('[data-action="play-pause"]');
  const muteButton = root.querySelector('[data-action="mute"]');
  const shuffleButton = root.querySelector('[data-action="shuffle"]');
  const repeatButton = root.querySelector('[data-action="repeat"]');
  const count = root.querySelector('[data-ui="playlist-count"]');
  const currentTime = root.querySelector('[data-ui="current-time"]');
  const duration = root.querySelector('[data-ui="duration"]');
  const ambientLayers = Array.from(
    root.querySelectorAll(".now-playing__ambient"),
  );
  const visualLayers = Array.from(
    root.querySelectorAll(".now-playing__media-layer"),
  );
  let active = false;
  let initialized = false;
  let disposed = false;
  let initialPlaybackAttempted = false;
  let persistentSignature = "";
  let saveQueued = false;
  const renderPlaylist = createPlaylistRenderer(playlist);

  function updateVisuals(snapshot) {
    const track = snapshot.currentTrack;
    visualLayers.forEach((layer, index) => {
      layer.classList.toggle("is-visible", index === snapshot.activeLayerIndex);
      layer.classList.toggle("is-active", index === snapshot.activeLayerIndex);
      const video = mediaLayers[index];
      video.classList.toggle(
        "is-visible",
        index === snapshot.activeLayerIndex && track?.kind === "video",
      );
      ambientLayers[index].classList.toggle(
        "is-visible",
        index === snapshot.activeLayerIndex && track?.kind !== "video",
      );
    });
    if (!track) return;
    const ambient = ambientLayers[snapshot.activeLayerIndex];
    ambient.style.backgroundImage = track.artworkUrl
      ? `url("${String(track.artworkUrl).replaceAll('"', "%22")}")`
      : "";
  }

  function updateControls(snapshot) {
    playButton
      ?.querySelector("i")
      ?.classList.toggle("fa-play", !snapshot.isPlaying);
    playButton
      ?.querySelector("i")
      ?.classList.toggle("fa-pause", snapshot.isPlaying);
    playButton?.setAttribute(
      "aria-label",
      t(snapshot.isPlaying ? "nowPlaying.pause" : "nowPlaying.play"),
    );
    setButtonPressed(shuffleButton, snapshot.shuffle);
    setButtonPressed(repeatButton, snapshot.repeat !== "off");
    if (repeatButton) {
      repeatButton.dataset.mode = snapshot.repeat;
      repeatButton.setAttribute(
        "aria-label",
        t(`nowPlaying.repeat.${snapshot.repeat}`),
      );
    }
    if (progress) {
      progress.max = String(snapshot.duration || 0);
      progress.value = String(
        Math.min(snapshot.currentTime, snapshot.duration || 0),
      );
      const progressPercent = snapshot.duration
        ? (snapshot.currentTime / snapshot.duration) * 100
        : 0;
      progress.style.setProperty(
        "--range-progress",
        `${Math.min(100, progressPercent)}%`,
      );
      progress.setAttribute(
        "aria-valuetext",
        `${formatTime(snapshot.currentTime)} / ${formatTime(snapshot.duration)}`,
      );
    }
    if (volume) {
      const effectiveVolume = snapshot.muted ? 0 : snapshot.volume;
      volume.value = String(effectiveVolume);
      volume.style.setProperty("--range-progress", `${effectiveVolume * 100}%`);
      volume.setAttribute(
        "aria-valuetext",
        `${Math.round(effectiveVolume * 100)}%`,
      );
    }
    if (currentTime) currentTime.textContent = formatTime(snapshot.currentTime);
    if (duration) duration.textContent = formatTime(snapshot.duration);
    const muted = snapshot.muted || snapshot.volume === 0;
    setButtonPressed(muteButton, muted);
    muteButton?.querySelector("i")?.classList.toggle("fa-volume-high", !muted);
    muteButton?.querySelector("i")?.classList.toggle("fa-volume-xmark", muted);
    root.classList.toggle("is-playing", snapshot.isPlaying);
  }

  function queuePersistence() {
    if (!initialized || disposed) return;
    const nextState = controller.getPersistentState();
    const signature = JSON.stringify(nextState);
    if (signature === persistentSignature || saveQueued) return;
    saveQueued = true;
    queueMicrotask(async () => {
      saveQueued = false;
      const state = controller.getPersistentState();
      const currentSignature = JSON.stringify(state);
      if (currentSignature === persistentSignature || disposed) return;
      try {
        const result = await api.setState(state);
        if (result?.success === false) {
          throw new Error(
            result.error?.message || "Unable to save player state",
          );
        }
        persistentSignature = currentSignature;
      } catch (error) {
        status.textContent = error?.message || t("nowPlaying.error");
      }
    });
  }

  function render(snapshot) {
    renderPlaylist(snapshot);
    updateVisuals(snapshot);
    updateControls(snapshot);
    const track = snapshot.currentTrack;
    title.textContent = track?.title || t("nowPlaying.empty.title");
    artist.textContent =
      track?.artist ||
      track?.album ||
      (track ? t("nowPlaying.unknownArtist") : "");
    album.textContent = track?.album || "";
    artwork.hidden = !track?.artworkUrl;
    artwork.classList.toggle("is-loaded", !!track?.artworkUrl);
    artworkFallback.hidden = !!track?.artworkUrl;
    if (track?.artworkUrl) artwork.src = track.artworkUrl;
    count.textContent = String(snapshot.queue.length);
    empty.hidden = snapshot.queue.length > 0;
    empty.classList.toggle("is-visible", snapshot.queue.length === 0);
    playlist.hidden = snapshot.queue.length === 0;
    errorPanel.hidden = !snapshot.error;
    errorPanel.classList.toggle("is-visible", !!snapshot.error);
    root.querySelector('[data-ui="error-message"]').textContent =
      snapshot.error?.message || "";
    queuePersistence();
  }

  async function importSource(source) {
    status.textContent = t("nowPlaying.importing");
    try {
      const previousIds = new Set(provider.tracks.map((track) => track.id));
      const imported = await provider.importSource(source);
      controller.setQueue(imported.tracks);
      const firstNewTrack = imported.tracks.find(
        (track) => !previousIds.has(track.id),
      );
      if (firstNewTrack) await controller.selectTrack(firstNewTrack.id);
      status.textContent = "";
    } catch (error) {
      status.textContent = error?.message || t("nowPlaying.error");
    }
  }

  function removeTrack(trackId) {
    const wasCurrent = controller.currentTrack?.id === trackId;
    const playlistState = provider.removeTrack(trackId);
    if (!playlistState.tracks.length) {
      clearQueue();
      return;
    }
    controller.setQueue(playlistState.tracks);
    if (wasCurrent && controller.currentTrack) {
      void controller.selectTrack(controller.currentTrack.id, {
        autoplay: controller.isPlaying,
      });
    }
  }

  function clearQueue() {
    controller.pause();
    provider.clear();
    controller.setQueue([]);
    mediaLayers.forEach((media) => {
      media.removeAttribute("src");
      media.load();
    });
  }

  async function handleAction(action, target) {
    if (action === "add-files") return importSource("files");
    if (action === "add-folder") return importSource("folder");
    if (action === "clear") return clearQueue();
    if (action === "play-pause") return controller.togglePlayback();
    if (action === "previous") return controller.previous();
    if (action === "next") return controller.next();
    if (action === "shuffle") return controller.toggleShuffle();
    if (action === "repeat") return controller.cycleRepeat();
    if (action === "mute") return controller.toggleMute();
    if (action === "retry") return controller.retry();
    const row = target.closest(".now-playing__track");
    if (action === "select-track")
      return controller.selectTrack(row?.dataset.trackId);
    if (action === "remove-track") return removeTrack(row?.dataset.trackId);
    return undefined;
  }

  function onClick(event) {
    const actionTarget = event.target.closest("[data-action]");
    if (!actionTarget || !root.contains(actionTarget)) return;
    void handleAction(actionTarget.dataset.action, actionTarget);
  }

  function onKeydown(event) {
    const row = event.target.closest(".now-playing__track");
    if (!row || !["Enter", " "].includes(event.key)) return;
    event.preventDefault();
    void controller.selectTrack(row.dataset.trackId);
  }

  function onInput(event) {
    if (event.target.matches('[data-action="seek"]')) {
      controller.seek(event.target.value);
    }
    if (event.target.matches('[data-action="volume"]')) {
      controller.setVolume(event.target.value);
    }
  }

  function onWindowBlur() {
    if (active) controller.suspend();
  }

  function onWindowFocus() {
    if (active && !document.hidden) void controller.resume();
  }

  function onVisibilityChange() {
    if (document.hidden) controller.suspend();
    else if (active) void controller.resume();
  }

  root.addEventListener("click", onClick);
  root.addEventListener("keydown", onKeydown);
  root.addEventListener("input", onInput);
  window.addEventListener("blur", onWindowBlur);
  window.addEventListener("focus", onWindowFocus);
  document.addEventListener("visibilitychange", onVisibilityChange);
  const unsubscribe = controller.subscribe(render);

  const ready = (async () => {
    try {
      const state = getStateData(await api.getState());
      const restored = provider.restore(state.playlist || state);
      controller.restoreState({ ...state, playlist: restored });
      applyI18n(root);
      if (controller.currentTrack) {
        await controller.selectTrack(controller.currentTrack.id, {
          autoplay: false,
        });
      }
      persistentSignature = JSON.stringify(controller.getPersistentState());
      initialized = true;
      if (active && controller.currentTrack) {
        initialPlaybackAttempted = true;
        await controller.play();
      }
    } catch (error) {
      initialized = true;
      status.textContent = error?.message || t("nowPlaying.error");
    }
    root.classList.add("is-ready");
    return root;
  })();

  return {
    element: root,
    ready,
    onShow() {
      active = true;
      root.classList.add("is-active");
      if (document.hidden || !initialized) return;
      if (!initialPlaybackAttempted && controller.currentTrack) {
        initialPlaybackAttempted = true;
        void controller.play();
        return;
      }
      void controller.resume();
    },
    onHide() {
      active = false;
      root.classList.remove("is-active");
      controller.suspend();
    },
    dispose() {
      if (disposed) return;
      disposed = true;
      unsubscribe();
      controller.dispose();
      providers.dispose();
      root.removeEventListener("click", onClick);
      root.removeEventListener("keydown", onKeydown);
      root.removeEventListener("input", onInput);
      window.removeEventListener("blur", onWindowBlur);
      window.removeEventListener("focus", onWindowFocus);
      document.removeEventListener("visibilitychange", onVisibilityChange);
    },
  };
}

export default createNowPlayingView;
