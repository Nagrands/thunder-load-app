import { applyI18n, t } from "../i18n.js";
import { readDeveloperModeEnabled } from "../developerMode.js";
import { showConfirmationDialog } from "../modals.js";
import { initTooltips } from "../tooltipInitializer.js";
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
import createPlayerPresentationView from "./playerPresentationView.js";
import createPlayerContextMenu from "./playerContextMenu.js";
import createPlaylistRenderer from "./playlistRenderer.js";
import PlaybackController from "./playbackController.js";
import createNowPlayingPreferences from "./preferencesController.js";
import MusicProviderRegistry from "./providerRegistry.js";
import NetworkMediaProvider from "./networkMediaProvider.js";
import createVisualTransitionController from "./visualTransitionController.js";
import buildNowPlayingMarkup from "./viewMarkup.js";
import { unwrapNowPlayingState } from "./viewUtils.js";
import createTransientQueue from "./transientQueue.js";
import createTimelinePreviewController from "./timelinePreviewController.js";
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
  const networkProvider = new NetworkMediaProvider();
  const providers = new MusicProviderRegistry();
  providers.register(provider);
  providers.register(youtubeProvider);
  providers.register(networkProvider);
  const controller = new PlaybackController({
    providers,
    mediaLayers,
    lifecycleLog: (...args) => {
      if (readDeveloperModeEnabled()) console.debug(...args);
    },
  });
  const mediaSession = createMediaSessionManager({ controller });
  const playlist = root.querySelector(".now-playing__playlist");
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
  const playerMenu = root.querySelector('[data-ui="player-menu"]');
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
  let controlTooltipKey = "";
  let systemMediaStateKey = "";
  let persistenceTimer = null;
  let persistenceInFlight = null;
  let persistenceRequested = false;
  let volumeFeedbackTimer = null;
  let draggedTrackId = "";
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
  const presentation = createPlayerPresentationView({ root });
  const timelinePreview = createTimelinePreviewController({
    api,
    controller,
    onPreviewImage: (trackId, dataUrl) =>
      presentation.useGeneratedPoster(trackId, dataUrl),
    progress,
    root,
  });
  const libraryView = createMediaLibraryView({
    root,
    onDialogSubmit: handleLibraryDialogSubmit,
  });
  const transientQueue = createTransientQueue({
    onChange: renderTransientQueue,
  });
  const contextMenu = createPlayerContextMenu({
    root,
    onAction: handleContextAction,
  });

  function renderTransientQueue(items = transientQueue.getItems()) {
    const queue = root.querySelector('[data-ui="transient-queue"]');
    const clearButton = root.querySelector('[data-action="clear-transient-queue"]');
    if (!queue) return;
    clearButton.disabled = items.length === 0;
    if (!items.length) {
      const emptyMessage = document.createElement("p");
      emptyMessage.className = "player-library__up-next-empty";
      emptyMessage.textContent = t("nowPlaying.queue.empty");
      queue.replaceChildren(emptyMessage);
      return;
    }
    queue.replaceChildren(
      ...items.map((track, index) => {
        const row = document.createElement("div");
        row.className = "player-library__queued-track";
        row.dataset.trackId = track.id;
        const title = document.createElement("span");
        title.textContent = track.displayTitle || track.title;
        const actions = document.createElement("span");
        actions.className = "player-library__queued-actions";
        [
          ["move-transient-up", "arrow-up", "nowPlaying.playlists.moveUp"],
          ["move-transient-down", "arrow-down", "nowPlaying.playlists.moveDown"],
          ["remove-transient", "x", "nowPlaying.queue.remove"],
        ].forEach(([action, icon, labelKey]) => {
          const button = document.createElement("button");
          button.type = "button";
          button.dataset.action = action;
          button.dataset.trackId = track.id;
          button.dataset.trackIndex = String(index);
          button.setAttribute("aria-label", t(labelKey));
          button.setAttribute("title", t(labelKey));
          button.setAttribute("data-bs-toggle", "tooltip");
          button.innerHTML = `<i data-lucide="${icon}" aria-hidden="true"></i>`;
          actions.appendChild(button);
        });
        row.append(title, actions);
        return row;
      }),
    );
    initTooltips(queue);
  }

  function showVolumeFeedback() {
    root.classList.add("is-volume-feedback-visible");
    if (volumeFeedbackTimer !== null) clearTimeout(volumeFeedbackTimer);
    volumeFeedbackTimer = setTimeout(() => {
      volumeFeedbackTimer = null;
      root.classList.remove("is-volume-feedback-visible");
    }, 1500);
  }

  function queuePersistence({ immediate = false } = {}) {
    if (!initialized || disposed) return;
    const nextState = getPersistentState();
    const signature = JSON.stringify(nextState);
    if (signature === persistentSignature) return;
    if (persistenceTimer !== null) clearTimeout(persistenceTimer);
    persistenceTimer = setTimeout(
      () => {
        persistenceTimer = null;
        void persistLatestState();
      },
      immediate ? 0 : 250,
    );
  }

  async function persistLatestState() {
    if (disposed) return;
    if (persistenceInFlight) {
      persistenceRequested = true;
      return persistenceInFlight;
    }
    const state = getPersistentState();
    const signature = JSON.stringify(state);
    if (signature === persistentSignature) return;
    persistenceInFlight = (async () => {
      try {
        const result = await api.setState(state);
        if (result?.success === false) {
          throw new Error(
            result.error?.message || "Unable to save player state",
          );
        }
        persistentSignature = signature;
      } catch (error) {
        status.textContent = error?.message || t("nowPlaying.error");
      }
    })();
    try {
      await persistenceInFlight;
    } finally {
      persistenceInFlight = null;
      if (persistenceRequested && !disposed) {
        persistenceRequested = false;
        await persistLatestState();
      }
    }
  }

  function flushPersistence() {
    if (persistenceTimer !== null) {
      clearTimeout(persistenceTimer);
      persistenceTimer = null;
    }
    return persistLatestState();
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
    const playlistIconsChanged = renderPlaylist(snapshot);
    visualTransitions.update(snapshot);
    updateControls(snapshot);
    presentation.update(snapshot);
    if (playlistIconsChanged) presentation.refreshIcons();
    const nextControlTooltipKey = `${snapshot.isPlaying}:${snapshot.isLoading}:${snapshot.muted}:${snapshot.repeat}`;
    if (nextControlTooltipKey !== controlTooltipKey) {
      controlTooltipKey = nextControlTooltipKey;
      initTooltips(dock);
    }
    count.textContent = String(snapshot.queue.length);
    root.classList.toggle("is-empty", snapshot.queue.length === 0);
    playlist.hidden = snapshot.queue.length === 0;
    errorPanel.hidden = !snapshot.error;
    errorPanel.classList.toggle("is-visible", !!snapshot.error);
    root.querySelector('[data-ui="error-message"]').textContent =
      snapshot.error?.message || "";
    if (libraryModel) libraryView.renderPlayback(snapshot);
    const systemState = snapshot.currentTrack && !snapshot.isStopped
      ? {
          track: {
            title:
              snapshot.currentTrack.displayTitle || snapshot.currentTrack.title,
          },
          isPlaying: snapshot.isPlaying === true,
          canNext:
            transientQueue.getItems().length > 0 ||
            snapshot.currentIndex < snapshot.queue.length - 1,
          canPrevious: snapshot.currentIndex > 0 || snapshot.currentTime > 3,
        }
      : { track: null, isPlaying: false, canNext: false, canPrevious: false };
    const nextSystemMediaStateKey = JSON.stringify(systemState);
    if (nextSystemMediaStateKey !== systemMediaStateKey) {
      systemMediaStateKey = nextSystemMediaStateKey;
      api?.publishMediaState?.(systemState);
    }
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
    if (latestSnapshot) {
      updateControls(latestSnapshot);
      presentation.update(latestSnapshot);
    }
    if (libraryModel && latestSnapshot) {
      libraryView.render(libraryModel.getState(), latestSnapshot);
    }
    fullscreen.refresh();
    renderTransientQueue();
    initTooltips(root);
    presentation.refreshIcons();
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
      (imported.playlistImports || []).forEach((playlistImport) => {
        libraryModel.createPlaylist(playlistImport.title, {
          trackIds: playlistImport.trackIds,
        });
      });
      syncLibraryQueue();
      const firstNewTrack = libraryModel
        .getState()
        .catalog.tracks.find((track) => addedIds.includes(track.id));
      if (firstNewTrack) await controller.selectTrack(firstNewTrack.id);
      status.textContent = imported.warnings?.length
        ? t("nowPlaying.playlists.youtubeSkipped")
        : "";
    } catch (error) {
      status.textContent = error?.message || t("nowPlaying.error");
    }
  }

  async function importPaths(paths, { autoplay = true } = {}) {
    if (!Array.isArray(paths) || !paths.length || !api?.importPaths) return false;
    const payload = unwrapNowPlayingState(await api.importPaths(paths));
    const tracks = Array.isArray(payload?.tracks) ? payload.tracks : [];
    provider.mergeTracks(
      tracks.filter((track) => track.providerId === "local"),
    );
    libraryModel.addTracks(tracks);
    (payload?.playlistImports || []).forEach((playlistImport) => {
      libraryModel.createPlaylist(playlistImport.title, {
        trackIds: playlistImport.trackIds,
      });
    });
    syncLibraryQueue();
    const importedIds = Array.isArray(payload?.importedTrackIds)
      ? payload.importedTrackIds
      : tracks.map((track) => track.id);
    const catalog = libraryModel.getState().catalog.tracks;
    const importedTracks = importedIds
      .map((id) => catalog.find((track) => track.id === id))
      .filter(Boolean);
    if (payload?.warnings?.length) {
      status.textContent = t("nowPlaying.playlists.youtubeSkipped");
    }
    if (!importedTracks.length) return false;
    importedTracks.slice(1).forEach((track) => transientQueue.add(track));
    await controller.selectTrack(importedTracks[0].id, { autoplay });
    libraryView.hide();
    return true;
  }

  async function importYouTube(url, qualitySelection) {
    const loadingMessage = t("nowPlaying.youtube.fetching");
    status.textContent = loadingMessage;
    libraryView.setOperationStatus(loadingMessage, { loading: true });
    try {
      const track = await youtubeProvider.importSource(url, {
        qualitySelection,
      });
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
    initTooltips(root);
    presentation.refreshIcons();
    if (libraryModel.getState().catalog.tracks.length === 0) libraryView.show();
    queuePersistence();
  }

  async function handleLibraryDialogSubmit(mode, value, context = {}) {
    if (mode === "youtube") {
      const analysis = await youtubeProvider.analyzeSource(value);
      return { step: "quality", analysis, url: value };
    }
    if (mode === "youtubeQuality") {
      const quality = context.qualities?.find((item) => item.id === value);
      if (!quality) return false;
      return importYouTube(context.url, quality.selector);
    }
    if (mode === "create") {
      libraryModel.createPlaylist(value);
      libraryView.render(libraryModel.getState(), latestSnapshot);
      initTooltips(root);
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
      initTooltips(root);
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
      initTooltips(root);
      queuePersistence();
      return true;
    }
    if (mode === "renameTrack") {
      if (typeof libraryModel.renameTrack !== "function") return false;
      const renamed = libraryModel.renameTrack(context.trackId, value);
      if (!renamed) return false;
      syncLibraryQueue({ selectedTrackId: controller.currentTrack?.id });
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
  }

  async function handleAction(action, target) {
    if (action?.startsWith("placeholder-")) return false;
    if (action === "toggle-player-menu") {
      playerMenu.hidden = !playerMenu.hidden;
      target.setAttribute("aria-expanded", String(!playerMenu.hidden));
      if (!playerMenu.hidden) {
        playerMenu.querySelector("button")?.focus();
      }
      return true;
    }
    if (action === "current-track-info") {
      const track = controller.currentTrack;
      if (!track) return false;
      playerMenu.hidden = true;
      return libraryView.openDialog("trackInfo", {
        track,
        posterUrl: presentation.getPosterUrl(track),
      });
    }
    if (preferences.handleAction(action)) return true;
    if (action === "add-files") return importSource("files");
    if (action === "add-folder") return importSource("folder");
    if (action === "clear") return clearQueue();
    if (action === "play-pause") return controller.togglePlayback();
    if (action === "previous") return controller.previous();
    if (action === "next") return playNextTrack();
    if (action === "shuffle") return controller.toggleShuffle();
    if (action === "repeat") return controller.cycleRepeat();
    if (action === "mute") {
      showVolumeFeedback();
      return controller.toggleMute();
    }
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
    if (action === "clear-transient-queue") return transientQueue.clear();
    if (action === "remove-transient") {
      return transientQueue.remove(target.dataset.trackId);
    }
    if (action === "move-transient-up" || action === "move-transient-down") {
      return transientQueue.move(
        target.dataset.trackId,
        action.endsWith("up") ? -1 : 1,
      );
    }
    if (action === "open-track-context-menu") {
      const context = libraryView.getTrackContext(target.dataset.trackId);
      if (!context) return false;
      const bounds = target.getBoundingClientRect();
      contextMenu.open(context, target, { x: bounds.right, y: bounds.bottom });
      return true;
    }
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

  async function playNextTrack(options = {}) {
    const queuedTrack = transientQueue.takeNext();
    if (queuedTrack) {
      if (!controller.queue.some((track) => track.id === queuedTrack.id)) {
        const merged = controller.queue.filter(
          (track) => track.id !== queuedTrack.id,
        );
        merged.splice(Math.max(0, controller.currentIndex + 1), 0, queuedTrack);
        controller.setQueue(merged, {
          selectedTrackId: controller.currentTrack?.id,
        });
      }
      return controller.selectTrack(queuedTrack.id);
    }
    return controller.next(options);
  }

  async function handleContextAction(action, context) {
    const track = context?.track;
    if (!track) return false;
    if (action === "play") return controller.selectTrack(track.id);
    if (action === "queue") return transientQueue.add(track);
    if (action === "playlist") {
      return libraryView.openDialog("addTrack", { trackId: track.id });
    }
    if (action === "move-up" || action === "move-down") {
      libraryModel.reorderTrack(
        context.playlist.id,
        track.id,
        context.index + (action === "move-up" ? -1 : 1),
      );
      syncLibraryQueue({ selectedTrackId: controller.currentTrack?.id });
      return true;
    }
    if (action === "delete") return removeFromActivePlaylist(track.id);
    if (action === "rename") {
      return libraryView.openDialog("renameTrack", { trackId: track.id, track });
    }
    if (action === "info") {
      return libraryView.openDialog("trackInfo", { track });
    }
    if (action === "reveal" || action === "open-location") {
      const method = action === "reveal" ? "revealTrack" : "openTrackLocation";
      if (typeof api?.[method] !== "function") {
        libraryView.setOperationStatus(t("nowPlaying.context.unavailable"), {
          error: true,
        });
        return false;
      }
      try {
        const result = await api[method](track.sourceRef);
        if (result?.success === false) {
          throw new Error(
            result.error?.message || t("nowPlaying.context.unavailable"),
          );
        }
        return true;
      } catch (error) {
        libraryView.setOperationStatus(error?.message || t("nowPlaying.error"), {
          error: true,
        });
        return false;
      }
    }
    return false;
  }

  function onClick(event) {
    const actionTarget = event.target.closest("[data-action]");
    if (
      !playerMenu.hidden &&
      !event.target.closest('[data-ui="player-menu"]') &&
      actionTarget?.dataset.action !== "toggle-player-menu"
    ) {
      playerMenu.hidden = true;
    }
    if (!actionTarget || !root.contains(actionTarget)) return;
    void handleAction(actionTarget.dataset.action, actionTarget);
  }

  function onKeydown(event) {
    const libraryRow = event.target.closest(".player-library__track");
    if (libraryRow && (event.key === "ContextMenu" || (event.shiftKey && event.key === "F10"))) {
      event.preventDefault();
      const context = libraryView.getTrackContext(libraryRow.dataset.trackId);
      const bounds = libraryRow.getBoundingClientRect();
      if (context) contextMenu.open(context, libraryRow, { x: bounds.left + 24, y: bounds.top + 24 });
      return;
    }
    if (libraryRow && ["Enter", " "].includes(event.key)) {
      event.preventDefault();
      void controller.selectTrack(libraryRow.dataset.trackId);
      return;
    }
    const row = event.target.closest(".now-playing__track");
    if (
      row &&
      event.altKey &&
      ["ArrowUp", "ArrowDown"].includes(event.key)
    ) {
      event.preventDefault();
      const activePlaylist = libraryView.getActivePlaylist();
      const sourceIndex = controller.queue.findIndex(
        (track) => track.id === row.dataset.trackId,
      );
      const targetIndex =
        sourceIndex + (event.key === "ArrowUp" ? -1 : 1);
      if (
        activePlaylist &&
        libraryModel.reorderTrack(
          activePlaylist.id,
          row.dataset.trackId,
          targetIndex,
        )
      ) {
        syncLibraryQueue({ selectedTrackId: controller.currentTrack?.id });
        [...playlist.querySelectorAll(".now-playing__track")]
          .find((item) => item.dataset.trackId === row.dataset.trackId)
          ?.focus();
      }
      return;
    }
    if (event.key === "Escape" && !playerMenu.hidden) {
      playerMenu.hidden = true;
      return;
    }
    if (!row || !["Enter", " "].includes(event.key)) return;
    event.preventDefault();
    void controller.selectTrack(row.dataset.trackId);
  }

  function onInput(event) {
    if (event.target.matches('[data-action="seek"]')) {
      controller.seek(event.target.value);
    }
    if (event.target.matches('[data-action="volume"]')) {
      showVolumeFeedback();
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
    showVolumeFeedback();
    const currentPercent = Math.round(
      (latestSnapshot?.muted ? 0 : latestSnapshot?.volume || 0) * 100,
    );
    const nextPercent = Math.min(
      100,
      Math.max(0, currentPercent + (event.deltaY < 0 ? 5 : -5)),
    );
    controller.setVolume(nextPercent / 100);
  }

  function onContextMenu(event) {
    const row = event.target.closest(".player-library__track");
    if (!row || !root.contains(row)) return;
    event.preventDefault();
    const context = libraryView.getTrackContext(row.dataset.trackId);
    if (context) contextMenu.open(context, row, { x: event.clientX, y: event.clientY });
  }

  function onDoubleClick(event) {
    const row = event.target.closest(".now-playing__track");
    if (
      event.target.closest("button") ||
      !row ||
      !root.contains(row) ||
      row.classList.contains("is-unavailable")
    ) {
      return;
    }
    void controller.selectTrack(row.dataset.trackId);
  }

  function onDragStart(event) {
    const row = event.target.closest(".now-playing__track");
    if (!row || row.classList.contains("is-unavailable")) return;
    draggedTrackId = row.dataset.trackId;
    row.classList.add("is-dragging");
    event.dataTransfer.effectAllowed = "move";
    event.dataTransfer.setData("text/plain", draggedTrackId);
  }

  function onDragOver(event) {
    const row = event.target.closest(".now-playing__track");
    if (!row || !draggedTrackId || row.dataset.trackId === draggedTrackId) {
      return;
    }
    event.preventDefault();
    event.dataTransfer.dropEffect = "move";
    playlist
      .querySelectorAll(".is-drag-target")
      .forEach((item) => item.classList.remove("is-drag-target"));
    row.classList.add("is-drag-target");
  }

  function onDrop(event) {
    const row = event.target.closest(".now-playing__track");
    if (!row || !draggedTrackId) return;
    event.preventDefault();
    const activePlaylist = libraryView.getActivePlaylist();
    const targetIndex = controller.queue.findIndex(
      (track) => track.id === row.dataset.trackId,
    );
    if (
      activePlaylist &&
      targetIndex >= 0 &&
      libraryModel.reorderTrack(
        activePlaylist.id,
        draggedTrackId,
        targetIndex,
      )
    ) {
      syncLibraryQueue({ selectedTrackId: controller.currentTrack?.id });
    }
    onDragEnd();
  }

  function onDragEnd() {
    draggedTrackId = "";
    playlist
      .querySelectorAll(".is-dragging, .is-drag-target")
      .forEach((row) =>
        row.classList.remove("is-dragging", "is-drag-target"),
      );
  }

  function onMediaEnded(event) {
    if (event.target !== controller.activeMedia) return;
    if (!transientQueue.getItems().length) return;
    event.stopImmediatePropagation();
    void playNextTrack({ fromEnded: true });
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

  function onSystemMediaCommand(payload = {}) {
    const action = {
      play: () => controller.play(),
      pause: () => controller.pause(),
      next: () => playNextTrack(),
      previous: () => controller.previous(),
    }[payload.command];
    if (action) void action();
  }

  root.addEventListener("click", onClick);
  root.addEventListener("keydown", onKeydown);
  root.addEventListener("input", onInput);
  root.addEventListener("wheel", onWheel, { passive: false });
  root.addEventListener("change", onChange);
  root.addEventListener("contextmenu", onContextMenu);
  root.addEventListener("dblclick", onDoubleClick);
  root.addEventListener("dragstart", onDragStart);
  root.addEventListener("dragover", onDragOver);
  root.addEventListener("drop", onDrop);
  root.addEventListener("dragend", onDragEnd);
  mediaLayers.forEach((media) => media.addEventListener("ended", onMediaEnded, true));
  window.addEventListener("blur", onWindowBlur);
  window.addEventListener("focus", onWindowFocus);
  window.addEventListener("i18n:changed", onI18nChanged);
  document.addEventListener("visibilitychange", onVisibilityChange);
  const unsubscribe = controller.subscribe(render);
  const unsubscribeMediaCommand = api?.onMediaCommand?.(onSystemMediaCommand);

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
      networkProvider.restore(
        libraryState.catalog.tracks.filter(
          (track) => track.providerId === "network",
        ),
      );
      controller.restoreState(libraryState);
      applyI18n(root);
      libraryView.render(libraryState, latestSnapshot);
      renderTransientQueue();
      initTooltips(root);
      presentation.refreshIcons();
      if (libraryState.catalog.tracks.length === 0) libraryView.show();
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
    importPaths,
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
      void flushPersistence();
      if (preferences.shouldSuspendInBackground()) controller.suspend();
    },
    dispose() {
      if (disposed) return;
      void flushPersistence();
      disposed = true;
      unsubscribe();
      unsubscribeMediaCommand?.();
      api?.publishMediaState?.({
        track: null,
        isPlaying: false,
        canNext: false,
        canPrevious: false,
      });
      mediaSession.dispose();
      controller.dispose();
      providers.dispose();
      controlsVisibility.dispose();
      overlayVisibility.dispose();
      fullscreen.dispose();
      visualTransitions.dispose();
      timelinePreview.dispose();
      libraryView.dispose();
      contextMenu.dispose();
      if (volumeFeedbackTimer !== null) clearTimeout(volumeFeedbackTimer);
      if (persistenceTimer !== null) clearTimeout(persistenceTimer);
      root.removeEventListener("click", onClick);
      root.removeEventListener("keydown", onKeydown);
      root.removeEventListener("input", onInput);
      root.removeEventListener("wheel", onWheel);
      root.removeEventListener("change", onChange);
      root.removeEventListener("contextmenu", onContextMenu);
      root.removeEventListener("dblclick", onDoubleClick);
      root.removeEventListener("dragstart", onDragStart);
      root.removeEventListener("dragover", onDragOver);
      root.removeEventListener("drop", onDrop);
      root.removeEventListener("dragend", onDragEnd);
      mediaLayers.forEach((media) => media.removeEventListener("ended", onMediaEnded, true));
      window.removeEventListener("blur", onWindowBlur);
      window.removeEventListener("focus", onWindowFocus);
      window.removeEventListener("i18n:changed", onI18nChanged);
      document.removeEventListener("visibilitychange", onVisibilityChange);
    },
  };
}

export default createNowPlayingView;
