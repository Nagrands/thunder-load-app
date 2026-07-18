import { applyI18n, t } from "../i18n.js";
import { showConfirmationDialog } from "../modals.js";
import createControlsVisibility from "./controlsVisibility.js";
import createFullscreenController from "./fullscreenController.js";
import createImmersiveOverlayVisibility from "./immersiveOverlayVisibility.js";
import LocalMusicProvider from "./localMusicProvider.js";
import {
  createMediaLibraryModel,
  MEDIA_LIBRARY_ID,
} from "./mediaLibraryModel.js";
import createMediaLibraryView from "./mediaLibraryView.js";
import createMediaSessionManager from "./mediaSessionManager.js";
import createPlaybackControlsView from "./playbackControlsView.js";
import createPlaylistRenderer from "./playlistRenderer.js";
import PlaybackController from "./playbackController.js";
import createNowPlayingPreferences from "./preferencesController.js";
import MusicProviderRegistry from "./providerRegistry.js";
import createVisualTransitionController from "./visualTransitionController.js";
import buildNowPlayingMarkup from "./viewMarkup.js";
import { unwrapNowPlayingState } from "./viewUtils.js";
import YouTubeProvider from "./youtubeProvider.js";
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
  const youtubeProvider = new YouTubeProvider(api);
  const providers = new MusicProviderRegistry();
  providers.register(provider);
  providers.register(youtubeProvider);
  const controller = new PlaybackController({ providers, mediaLayers });
  const mediaSession = createMediaSessionManager({ controller });
  const playlist = root.querySelector(".now-playing__playlist");
  const empty = root.querySelector(".now-playing__empty");
  const errorPanel = root.querySelector(".now-playing__error");
  const dock = root.querySelector(".now-playing__dock");
  const sidebar = root.querySelector(".now-playing__sidebar");
  const sidebarZone = root.querySelector(".now-playing__sidebar-reveal-zone");
  const topbarZone = root.querySelector(".now-playing__topbar-reveal-zone");
  const trackStage = root.querySelector(".now-playing__track-stage");
  const artworkStack = root.querySelector(".now-playing__artwork-stack");
  const playlistSection = root.querySelector(".now-playing__playlist-section");
  const artworkLayers = Array.from(
    root.querySelectorAll(".now-playing__artwork-layer"),
  );
  const metadataSlots = Array.from(
    root.querySelectorAll(".now-playing__metadata-slot"),
  );
  const progress = root.querySelector('[data-action="seek"]');
  const volume = root.querySelector('[data-action="volume"]');
  const volumePercent = root.querySelector('[data-ui="volume-percent"]');
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
  let playbackPersistenceKey = "";
  let saveQueued = false;
  let libraryModel = null;
  const renderPlaylist = createPlaylistRenderer(playlist);
  const controlsVisibility = createControlsVisibility({ root, dock });
  const visualTransitions = createVisualTransitionController({
    root,
    mediaLayers,
    visualLayers,
    ambientLayers,
    artworkLayers,
    artworkStack,
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
    volumePercent,
    currentTime,
    duration,
  });
  const libraryView = createMediaLibraryView({
    root,
    onDialogSubmit: handleLibraryDialogSubmit,
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
    const playbackState = controller.getPersistentState();
    if (libraryModel) {
      return {
        ...libraryModel.getState(),
        selectedTrackId: playbackState.selectedTrackId,
        volume: playbackState.volume,
        muted: playbackState.muted,
        shuffle: playbackState.shuffle,
        repeat: playbackState.repeat,
        ...preferences.getState(),
      };
    }
    return {
      ...playbackState,
      ...preferences.getState(),
    };
  }

  function render(snapshot) {
    latestSnapshot = snapshot;
    mediaSession.sync(snapshot);
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
    if (libraryModel) libraryView.renderPlayback(snapshot);
    const nextPlaybackPersistenceKey = JSON.stringify({
      selectedTrackId: snapshot.currentTrack?.id || null,
      volume: snapshot.volume,
      muted: snapshot.muted,
      shuffle: snapshot.shuffle,
      repeat: snapshot.repeat,
    });
    if (nextPlaybackPersistenceKey !== playbackPersistenceKey) {
      playbackPersistenceKey = nextPlaybackPersistenceKey;
      queuePersistence();
    }
  }

  function onI18nChanged() {
    applyI18n(root);
    if (latestSnapshot) updateControls(latestSnapshot);
    if (libraryModel && latestSnapshot) {
      libraryView.render(libraryModel.getState(), latestSnapshot);
    }
    fullscreen.refresh();
  }

  async function importSource(source) {
    status.textContent = t("nowPlaying.importing");
    try {
      const previousIds = new Set(provider.tracks.map((track) => track.id));
      const imported = await provider.importSource(source);
      const importedIds = new Set(imported.importedTrackIds || []);
      const incomingTracks = imported.tracks.filter(
        (track) => importedIds.has(track.id) || !previousIds.has(track.id),
      );
      const addedIds = libraryModel.addTracks(incomingTracks);
      syncLibraryQueue();
      const firstNewTrack = libraryModel
        .getState()
        .catalog.tracks.find((track) => addedIds.includes(track.id));
      if (firstNewTrack) await controller.selectTrack(firstNewTrack.id);
      status.textContent = "";
    } catch (error) {
      status.textContent = error?.message || t("nowPlaying.error");
    }
  }

  async function importYouTube(url) {
    const loadingMessage = t("nowPlaying.youtube.fetching");
    status.textContent = loadingMessage;
    libraryView.setOperationStatus(loadingMessage, { loading: true });
    try {
      const track = await youtubeProvider.importSource(url);
      libraryModel.addTracks([track]);
      syncLibraryQueue();
      const addedMessage = t("nowPlaying.youtube.added");
      status.textContent = addedMessage;
      libraryView.setOperationStatus(addedMessage);
      return true;
    } catch (error) {
      const message = error?.message || t("nowPlaying.error");
      libraryView.showDialogError(message);
      libraryView.setOperationStatus(message, { error: true });
      status.textContent = message;
      return false;
    }
  }

  function syncLibraryQueue({ selectedTrackId = null } = {}) {
    if (!libraryModel) return;
    controller.setLibraryState(libraryModel.getState(), {
      selectedTrackId:
        selectedTrackId || controller.currentTrack?.id || undefined,
    });
    libraryView.render(libraryModel.getState(), latestSnapshot);
    queuePersistence();
  }

  async function handleLibraryDialogSubmit(mode, value, context = {}) {
    if (mode === "youtube") return importYouTube(value);
    if (mode === "create") {
      libraryModel.createPlaylist(value);
      libraryView.render(libraryModel.getState(), latestSnapshot);
      queuePersistence();
      return true;
    }
    if (mode === "rename") {
      const activePlaylist = libraryView.getActivePlaylist();
      if (!activePlaylist || activePlaylist.id === MEDIA_LIBRARY_ID) {
        return false;
      }
      libraryModel.renamePlaylist(activePlaylist.id, value);
      libraryView.render(libraryModel.getState(), latestSnapshot);
      queuePersistence();
      return true;
    }
    if (mode === "addTrack") {
      const added = libraryModel.addTrackToPlaylist(context.trackId, value);
      if (!added) {
        libraryView.showDialogError(t("nowPlaying.playlists.alreadyAdded"));
        return false;
      }
      libraryView.render(libraryModel.getState(), latestSnapshot);
      queuePersistence();
      return true;
    }
    return false;
  }

  async function removeFromActivePlaylist(trackId) {
    const activePlaylist = libraryView.getActivePlaylist();
    if (!activePlaylist || activePlaylist.id === MEDIA_LIBRARY_ID) {
      return deleteCatalogTrack(trackId);
    }
    const wasCurrent = controller.currentTrack?.id === trackId;
    const wasPlaying = controller.isPlaying;
    libraryModel.removeTrackFromPlaylist(trackId, activePlaylist.id);
    syncLibraryQueue();
    if (wasCurrent && controller.currentTrack) {
      void controller.selectTrack(controller.currentTrack.id, {
        autoplay: wasPlaying,
      });
    }
    return true;
  }

  async function deleteCatalogTrack(trackId) {
    const track = libraryModel
      .getState()
      .catalog.tracks.find((item) => item.id === trackId);
    const confirmed = await showConfirmationDialog({
      title: t("nowPlaying.library.deleteTitle"),
      message: t("nowPlaying.library.deleteConfirm", {
        title: track?.title || t("nowPlaying.library.unknownItem"),
      }),
      confirmText: t("nowPlaying.library.deleteAction"),
    });
    if (!confirmed) return false;
    const wasCurrent = controller.currentTrack?.id === trackId;
    const wasPlaying = controller.isPlaying;
    libraryModel.deleteFromCatalog(trackId);
    if (wasCurrent) controller.pause();
    syncLibraryQueue();
    if (wasCurrent && controller.currentTrack) {
      void controller.selectTrack(controller.currentTrack.id, {
        autoplay: wasPlaying,
      });
    }
    return true;
  }

  function removeTrack(trackId) {
    return removeFromActivePlaylist(trackId);
  }

  function clearQueue() {
    controller.pause();
    const state = libraryModel.getState();
    const activePlaylist = libraryView.getActivePlaylist();
    if (activePlaylist?.id === MEDIA_LIBRARY_ID) {
      state.catalog.tracks.forEach((track) =>
        libraryModel.deleteFromCatalog(track.id),
      );
      provider.clear();
      youtubeProvider.restore([]);
    } else if (activePlaylist) {
      [...(activePlaylist.trackIds || [])].forEach((trackId) =>
        libraryModel.removeTrackFromPlaylist(trackId, activePlaylist.id),
      );
    }
    syncLibraryQueue();
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
    if (action === "show-library") return libraryView.show();
    if (action === "show-player") return libraryView.hide();
    if (action === "open-create-playlist-dialog")
      return libraryView.openDialog("create");
    if (action === "open-rename-playlist-dialog")
      return libraryView.openDialog("rename");
    if (action === "open-youtube-dialog")
      return libraryView.openDialog("youtube");
    if (action === "open-add-to-playlist-dialog") {
      return libraryView.openDialog("addTrack", {
        trackId: target.dataset.trackId,
      });
    }
    if (action === "close-library-dialog") return libraryView.closeDialog();
    if (action === "select-playlist") {
      return selectPlaylist(target.dataset.playlistId);
    }
    if (action === "select-library-track") {
      return controller.selectTrack(target.dataset.trackId);
    }
    if (action === "remove-from-playlist") {
      return removeFromActivePlaylist(target.dataset.trackId);
    }
    if (action === "delete-from-catalog") {
      return deleteCatalogTrack(target.dataset.trackId);
    }
    if (
      action === "move-library-track-up" ||
      action === "move-library-track-down"
    ) {
      const activePlaylist = libraryView.getActivePlaylist();
      const offset = action.endsWith("-up") ? -1 : 1;
      libraryModel.reorderTrack(
        activePlaylist.id,
        target.dataset.trackId,
        Number(target.dataset.trackIndex) + offset,
      );
      syncLibraryQueue({ selectedTrackId: controller.currentTrack?.id });
      return true;
    }
    if (action === "delete-playlist") {
      const activePlaylist = libraryView.getActivePlaylist();
      if (!activePlaylist || activePlaylist.id === MEDIA_LIBRARY_ID) {
        return false;
      }
      const confirmed = await showConfirmationDialog({
        title: t("nowPlaying.playlists.delete"),
        message: t("nowPlaying.playlists.deleteConfirm", {
          title: activePlaylist.title,
        }),
        confirmText: t("nowPlaying.playlists.delete"),
      });
      if (!confirmed) return false;
      libraryModel.deletePlaylist(activePlaylist.id);
      syncLibraryQueue();
      return true;
    }
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

  function onWheel(event) {
    const volumeTarget = event.target.closest(
      '[data-action="volume"], [data-action="mute"], [data-ui="volume-percent"]',
    );
    if (
      !volumeTarget ||
      !root.contains(volumeTarget) ||
      event.ctrlKey ||
      event.deltaY === 0 ||
      Math.abs(event.deltaX) > Math.abs(event.deltaY)
    ) {
      return;
    }
    event.preventDefault();
    controlsVisibility.show();
    const currentPercent = Math.round(
      (latestSnapshot?.muted ? 0 : latestSnapshot?.volume || 0) * 100,
    );
    const nextPercent = Math.min(
      100,
      Math.max(0, currentPercent + (event.deltaY < 0 ? 5 : -5)),
    );
    controller.setVolume(nextPercent / 100);
  }

  function onChange(event) {
    if (event.target.matches('[data-ui="sidebar-playlist-switcher"]')) {
      void selectPlaylist(event.target.value);
    }
  }

  async function selectPlaylist(playlistId) {
    const previousTrack = controller.currentTrack;
    if (!libraryModel.setActivePlaylist(playlistId)) return false;
    const nextTracks = libraryModel.getActiveTracks();
    const selectedTrackId = nextTracks.some(
      (track) => track.id === previousTrack?.id,
    )
      ? previousTrack.id
      : nextTracks[0]?.id;
    if (previousTrack && previousTrack.id !== selectedTrackId) {
      controller.pause();
    }
    syncLibraryQueue({ selectedTrackId });
    if (selectedTrackId && previousTrack?.id !== selectedTrackId) {
      await controller.selectTrack(selectedTrackId, { autoplay: false });
    }
    return true;
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
  root.addEventListener("wheel", onWheel, { passive: false });
  root.addEventListener("change", onChange);
  window.addEventListener("blur", onWindowBlur);
  window.addEventListener("focus", onWindowFocus);
  window.addEventListener("i18n:changed", onI18nChanged);
  document.addEventListener("visibilitychange", onVisibilityChange);
  const unsubscribe = controller.subscribe(render);

  const ready = (async () => {
    try {
      const state = unwrapNowPlayingState(await api.getState());
      preferences.restore(state);
      libraryModel = createMediaLibraryModel(state);
      const libraryState = libraryModel.getState();
      provider.restore({
        tracks: libraryState.catalog.tracks.filter(
          (track) => track.providerId === "local",
        ),
      });
      youtubeProvider.restore(
        libraryState.catalog.tracks.filter(
          (track) => track.providerId === "youtube",
        ),
      );
      controller.restoreState(libraryState);
      applyI18n(root);
      libraryView.render(libraryState, latestSnapshot);
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
      libraryView.closeDialog();
      if (preferences.shouldSuspendInBackground()) controller.suspend();
    },
    dispose() {
      if (disposed) return;
      disposed = true;
      unsubscribe();
      mediaSession.dispose();
      controller.dispose();
      providers.dispose();
      controlsVisibility.dispose();
      overlayVisibility.dispose();
      fullscreen.dispose();
      visualTransitions.dispose();
      libraryView.dispose();
      root.removeEventListener("click", onClick);
      root.removeEventListener("keydown", onKeydown);
      root.removeEventListener("input", onInput);
      root.removeEventListener("wheel", onWheel);
      root.removeEventListener("change", onChange);
      window.removeEventListener("blur", onWindowBlur);
      window.removeEventListener("focus", onWindowFocus);
      window.removeEventListener("i18n:changed", onI18nChanged);
      document.removeEventListener("visibilitychange", onVisibilityChange);
    },
  };
}

export default createNowPlayingView;
