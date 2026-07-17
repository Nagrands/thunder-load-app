import { applyI18n, t } from "../i18n.js";
import createControlsVisibility from "./controlsVisibility.js";
import createFullscreenController from "./fullscreenController.js";
import createImmersiveOverlayVisibility from "./immersiveOverlayVisibility.js";
import LocalMusicProvider from "./localMusicProvider.js";
import createPlaybackControlsView from "./playbackControlsView.js";
import createPlaylistRenderer from "./playlistRenderer.js";
import PlaybackController from "./playbackController.js";
import createNowPlayingPreferences from "./preferencesController.js";
import MusicProviderRegistry from "./providerRegistry.js";
import createVisualTransitionController from "./visualTransitionController.js";
import buildNowPlayingMarkup from "./viewMarkup.js";
import { unwrapNowPlayingState } from "./viewUtils.js";
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
  const dock = root.querySelector(".now-playing__dock");
  const sidebar = root.querySelector(".now-playing__sidebar");
  const sidebarZone = root.querySelector(".now-playing__sidebar-reveal-zone");
  const topbarZone = root.querySelector(".now-playing__topbar-reveal-zone");
  const trackStage = root.querySelector(".now-playing__track-stage");
  const playlistSection = root.querySelector(".now-playing__playlist-section");
  const artworkLayers = Array.from(
    root.querySelectorAll(".now-playing__artwork-layer"),
  );
  const metadataSlots = Array.from(
    root.querySelectorAll(".now-playing__metadata-slot"),
  );
  const progress = root.querySelector('[data-action="seek"]');
  const volume = root.querySelector('[data-action="volume"]');
  const status = root.querySelector(".now-playing__status");
  const brandLabel = root.querySelector('[data-ui="brand-label"]');
  const fullscreenButton = root.querySelector('[data-action="fullscreen"]');
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
  let latestSnapshot = null;
  let persistentSignature = "";
  let saveQueued = false;
  const renderPlaylist = createPlaylistRenderer(playlist);
  const controlsVisibility = createControlsVisibility({ root, dock });
  const visualTransitions = createVisualTransitionController({
    root,
    mediaLayers,
    visualLayers,
    ambientLayers,
    artworkLayers,
    metadataSlots,
    trackStage,
    playlistSection,
  });
  const overlayVisibility = createImmersiveOverlayVisibility({
    root,
    sidebar,
    sidebarZone,
    topbarZone,
  });
  const fullscreen = createFullscreenController({
    root,
    button: fullscreenButton,
    onError: (error) => {
      status.textContent = error?.message || t("nowPlaying.error");
    },
  });
  const preferences = createNowPlayingPreferences({
    backgroundButton: root.querySelector('[data-action="background-playback"]'),
    pinButton: root.querySelector('[data-action="pin-sidebar"]'),
    overlayVisibility,
    onChange: queuePersistence,
  });
  const updateControls = createPlaybackControlsView({
    root,
    controlsVisibility,
    brandLabel,
    playButton,
    muteButton,
    shuffleButton,
    repeatButton,
    progress,
    volume,
    currentTime,
    duration,
  });

  function queuePersistence() {
    if (!initialized || disposed) return;
    const nextState = getPersistentState();
    const signature = JSON.stringify(nextState);
    if (signature === persistentSignature || saveQueued) return;
    saveQueued = true;
    queueMicrotask(async () => {
      saveQueued = false;
      const state = getPersistentState();
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

  function getPersistentState() {
    return {
      ...controller.getPersistentState(),
      ...preferences.getState(),
    };
  }

  function render(snapshot) {
    latestSnapshot = snapshot;
    renderPlaylist(snapshot);
    visualTransitions.update(snapshot);
    updateControls(snapshot);
    count.textContent = String(snapshot.queue.length);
    root.classList.toggle("is-empty", snapshot.queue.length === 0);
    empty.hidden = snapshot.queue.length > 0;
    empty.classList.toggle("is-visible", snapshot.queue.length === 0);
    playlist.hidden = snapshot.queue.length === 0;
    errorPanel.hidden = !snapshot.error;
    errorPanel.classList.toggle("is-visible", !!snapshot.error);
    root.querySelector('[data-ui="error-message"]').textContent =
      snapshot.error?.message || "";
    queuePersistence();
  }

  function onI18nChanged() {
    applyI18n(root);
    if (latestSnapshot) updateControls(latestSnapshot);
    fullscreen.refresh();
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
    if (preferences.handleAction(action)) return true;
    if (action === "add-files") return importSource("files");
    if (action === "add-folder") return importSource("folder");
    if (action === "clear") return clearQueue();
    if (action === "play-pause") return controller.togglePlayback();
    if (action === "previous") return controller.previous();
    if (action === "next") return controller.next();
    if (action === "shuffle") return controller.toggleShuffle();
    if (action === "repeat") return controller.cycleRepeat();
    if (action === "mute") return controller.toggleMute();
    if (action === "fullscreen") return fullscreen.toggle();
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
    if (active && preferences.shouldSuspendInBackground()) {
      controller.suspend();
    }
  }

  function onWindowFocus() {
    if (active && !document.hidden) void controller.resume();
  }

  function onVisibilityChange() {
    if (document.hidden) {
      if (preferences.shouldSuspendInBackground()) controller.suspend();
      return;
    }
    if (active) void controller.resume();
  }

  root.addEventListener("click", onClick);
  root.addEventListener("keydown", onKeydown);
  root.addEventListener("input", onInput);
  window.addEventListener("blur", onWindowBlur);
  window.addEventListener("focus", onWindowFocus);
  window.addEventListener("i18n:changed", onI18nChanged);
  document.addEventListener("visibilitychange", onVisibilityChange);
  const unsubscribe = controller.subscribe(render);

  const ready = (async () => {
    try {
      const state = unwrapNowPlayingState(await api.getState());
      preferences.restore(state);
      const restored = provider.restore(state.playlist || state);
      controller.restoreState({ ...state, playlist: restored });
      applyI18n(root);
      if (controller.currentTrack) {
        await controller.selectTrack(controller.currentTrack.id, {
          autoplay: false,
        });
      }
      persistentSignature = JSON.stringify(getPersistentState());
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
    await fullscreen.ready;
    return root;
  })();

  return {
    element: root,
    ready,
    onShow() {
      active = true;
      root.classList.add("is-active", "is-visible");
      visualTransitions.onShow();
      controlsVisibility.onShow();
      overlayVisibility.onShow();
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
      root.classList.remove("is-active", "is-visible");
      controlsVisibility.onHide();
      overlayVisibility.onHide();
      fullscreen.onHide();
      controller.suspend();
    },
    dispose() {
      if (disposed) return;
      disposed = true;
      unsubscribe();
      controller.dispose();
      providers.dispose();
      controlsVisibility.dispose();
      overlayVisibility.dispose();
      fullscreen.dispose();
      visualTransitions.dispose();
      root.removeEventListener("click", onClick);
      root.removeEventListener("keydown", onKeydown);
      root.removeEventListener("input", onInput);
      window.removeEventListener("blur", onWindowBlur);
      window.removeEventListener("focus", onWindowFocus);
      window.removeEventListener("i18n:changed", onI18nChanged);
      document.removeEventListener("visibilitychange", onVisibilityChange);
    },
  };
}

export default createNowPlayingView;
