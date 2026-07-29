import { applyI18n, t } from "../i18n.js";
import { refreshShortcutLabels } from "../hotkeys.js";
import { readDeveloperModeEnabled } from "../developerMode.js";
import { showConfirmationDialog } from "../modals.js";
import { showToast } from "../toast.js";
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
import { refreshPlayerIcons } from "./playerIcons.js";
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
import createAudioTracksController from "./audioTracksController.js";
import createAudioVisualizerController from "./audioVisualizerController.js";
import {
  DEFAULT_VISUALIZER_SETTINGS,
  normalizeVisualizerSettings,
} from "./visualizerSettings.js";
import {
  PLAYER_COMMANDS,
  PLAYER_UI_ACTIONS,
  SYSTEM_MEDIA_COMMANDS,
} from "./playerCommands.js";
import {
  onPlayerSettingsApply,
  publishPlayerSettings,
} from "./settingsEvents.js";
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
  refreshShortcutLabels(root);

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
  const visualizerLayer = root.querySelector('[data-ui="audio-visualizer"]');
  const visualizerCanvas = root.querySelector('[data-ui="visualizer-canvas"]');
  const visualizerPanel = root.querySelector('[data-ui="visualizer-panel"]');
  const visualizerDetails = root.querySelector(
    '[data-ui="visualizer-details"]',
  );
  const visualizerStatus = root.querySelector('[data-ui="visualizer-status"]');
  const visualizerToggle = root.querySelector(
    '[data-action="toggle-visualizer-settings"]',
  );
  visualizerToggle?.setAttribute("aria-expanded", "false");
  visualizerToggle?.setAttribute(
    "aria-controls",
    "now-playing-visualizer-panel",
  );
  visualizerPanel.id = "now-playing-visualizer-panel";
  const sidebar = root.querySelector(".now-playing__sidebar");
  const sidebarZone = root.querySelector(".now-playing__sidebar-reveal-zone");
  const playerTopbar = root.querySelector('[data-ui="player-topbar"]');
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
  const addMenu = root.querySelector('[data-ui="sidebar-add-menu"]');
  const addMenuTrigger = root.querySelector('[data-action="toggle-add-menu"]');
  addMenuTrigger?.setAttribute("aria-haspopup", "menu");
  addMenuTrigger?.setAttribute("aria-expanded", "false");
  addMenuTrigger?.setAttribute("aria-controls", "now-playing-add-menu");
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
  let playerSettingsStateKey = "";
  let persistenceTimer = null;
  let persistenceInFlight = null;
  let persistenceRequested = false;
  let volumeFeedbackTimer = null;
  let visualizerSaveVersion = 0;
  let visualizerConnectionVersion = 0;
  let visualizerConnectionFailed = false;
  let visualizerMedia = null;
  let visualizerAvailable = false;
  let visualizerSettingsExpanded = false;
  let visualizerSettings = { ...DEFAULT_VISUALIZER_SETTINGS };
  let draggedTrackId = "";
  let libraryModel = null;
  const renderPlaylist = createPlaylistRenderer(playlist);
  const controlsVisibility = createControlsVisibility({
    root,
    dock,
    lockRegions: [dock, visualizerPanel, playerTopbar],
  });
  const visualizer = createAudioVisualizerController({
    canvas: visualizerCanvas,
    root,
  });
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
    onChange: () => {
      queuePersistence();
      publishSettingsState();
    },
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
    onPreviewImage: (trackId, dataUrl) => {
      presentation.useGeneratedPoster(trackId, dataUrl);
      libraryView.useGeneratedPoster(trackId, dataUrl);
    },
    progress,
    root,
  });
  const libraryView = createMediaLibraryView({
    root,
    onDialogSubmit: handleLibraryDialogSubmit,
  });
  const audioTracks = createAudioTracksController({
    root,
    api,
    getCurrentTrack: () => controller.currentTrack,
    getNativeAudioTrackState: () => controller.getNativeAudioTrackState(),
    onOpenChange: (open) =>
      controlsVisibility.setLocked(
        open || dock.contains(document.activeElement),
      ),
    onSelect: switchAudioTrack,
  });
  const transientQueue = createTransientQueue({
    onChange: renderTransientQueue,
  });
  const contextMenu = createPlayerContextMenu({
    root,
    onAction: handleContextAction,
  });

  function showPlayerToast(messageKey, type = "success", params = {}) {
    return showToast(t(messageKey, params), type);
  }

  function showPlayerError(error) {
    const message = error?.message || t("nowPlaying.error");
    showToast(message, "error");
    return message;
  }

  function renderTransientQueue(items = transientQueue.getItems()) {
    const queue = root.querySelector('[data-ui="transient-queue"]');
    const clearButton = root.querySelector(
      '[data-action="clear-transient-queue"]',
    );
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
          [
            "move-transient-down",
            "arrow-down",
            "nowPlaying.playlists.moveDown",
          ],
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
          button.setAttribute("data-bs-placement", "top");
          button.innerHTML = `<i data-lucide="${icon}" aria-hidden="true"></i>`;
          actions.appendChild(button);
        });
        row.append(title, actions);
        return row;
      }),
    );
    refreshPlayerIcons(queue);
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
        visualizer: { ...visualizerSettings },
        ...preferences.getState(),
      };
    }
    return {
      ...playbackState,
      ...preferences.getState(),
      visualizer: { ...visualizerSettings },
    };
  }

  function renderVisualizerSettings() {
    root.querySelectorAll("[data-visualizer-setting]").forEach((control) => {
      const key = control.dataset.visualizerSetting;
      const value = visualizerSettings[key];
      if (control.type === "checkbox") {
        control.checked = value === true;
      } else if (key === "sensitivity" || key === "smoothing") {
        control.value = String(Math.round(Number(value) * 100));
      } else {
        control.value = String(value);
      }
    });
    root.querySelectorAll("[data-visualizer-output]").forEach((output) => {
      const key = output.dataset.visualizerOutput;
      const value = visualizerSettings[key];
      output.value =
        key === "barCount"
          ? String(value)
          : `${Math.round(Number(value) * 100)}%`;
      output.textContent = output.value;
    });
    visualizer.updateSettings(visualizerSettings);
  }

  async function saveVisualizerSettings(nextSettings) {
    const previous = visualizerSettings;
    const version = ++visualizerSaveVersion;
    visualizerSettings = normalizeVisualizerSettings(nextSettings);
    renderVisualizerSettings();
    queuePersistence();
    try {
      const result = await api?.updateSettings?.({
        visualizer: visualizerSettings,
      });
      if (result?.success === false) {
        throw new Error(
          result.error?.message || t("settings.player.saveError"),
        );
      }
      if (version !== visualizerSaveVersion) return true;
      const saved = result?.data?.visualizer;
      if (saved) {
        visualizerSettings = normalizeVisualizerSettings(saved);
        renderVisualizerSettings();
      }
      publishSettingsState();
      return true;
    } catch (error) {
      if (version === visualizerSaveVersion) {
        visualizerSettings = previous;
        renderVisualizerSettings();
        status.textContent = error?.message || t("settings.player.saveError");
      }
      return false;
    }
  }

  function syncVisualizer(snapshot) {
    const eligible =
      Boolean(snapshot.currentTrack) &&
      snapshot.mediaReady === true &&
      snapshot.hasVideoTrack === false &&
      snapshot.isLoading !== true &&
      !snapshot.error;
    visualizerAvailable = eligible;
    visualizerLayer.hidden = !eligible;
    visualizerToggle.hidden = !eligible;
    visualizerPanel.hidden = !eligible || !visualizerSettingsExpanded;
    root.classList.toggle("has-audio-visualizer", eligible);
    if (!eligible) {
      setVisualizerSettingsExpanded(false);
      visualizerConnectionVersion += 1;
      visualizerConnectionFailed = false;
      visualizerMedia = null;
      visualizerStatus.hidden = true;
      visualizer.clear();
      return;
    }
    const media = mediaLayers[snapshot.activeLayerIndex];
    if (media !== visualizerMedia) {
      visualizerMedia = media;
      visualizerConnectionFailed = false;
      const version = ++visualizerConnectionVersion;
      void visualizer
        .connect(media, {
          analysisAllowed: snapshot.visualizerAnalysisAllowed,
        })
        .then((connected) => {
          if (version !== visualizerConnectionVersion) return;
          visualizerConnectionFailed =
            !connected && snapshot.visualizerAnalysisAllowed !== false;
          visualizerStatus.textContent = t(
            visualizerConnectionFailed
              ? "nowPlaying.visualizer.unavailable"
              : "nowPlaying.visualizer.staticFallback",
          );
          visualizerStatus.hidden = connected;
        });
    }
    if (snapshot.visualizerAnalysisAllowed === false) {
      visualizerStatus.textContent = t("nowPlaying.visualizer.staticFallback");
      visualizerStatus.hidden = false;
    } else if (visualizerConnectionFailed) {
      visualizerStatus.textContent = t("nowPlaying.visualizer.unavailable");
      visualizerStatus.hidden = false;
    } else {
      visualizerStatus.hidden = true;
    }
    if (snapshot.isPlaying) visualizer.start();
    else visualizer.pause();
  }

  function getPlaybackErrorMessage(error) {
    if (error?.code === "PLAYBACK_RESTART_FAILED") {
      return t("nowPlaying.audioTracks.switchError");
    }
    return error?.message || "";
  }

  function setVisualizerSettingsExpanded(expanded) {
    const nextExpanded = Boolean(expanded && visualizerAvailable);
    const changed = visualizerSettingsExpanded !== nextExpanded;
    visualizerSettingsExpanded = nextExpanded;
    visualizerPanel.hidden = !nextExpanded;
    visualizerDetails.hidden = !nextExpanded;
    visualizerToggle?.setAttribute("aria-expanded", String(nextExpanded));
    root.classList.toggle("is-visualizer-settings-open", nextExpanded);
    if (changed) controlsVisibility.setLocked(nextExpanded);
    return nextExpanded;
  }

  function render(snapshot) {
    latestSnapshot = snapshot;
    mediaSession.sync(snapshot);
    const playlistIconsChanged = renderPlaylist(snapshot);
    visualTransitions.update(snapshot);
    syncVisualizer(snapshot);
    updateControls(snapshot);
    presentation.update(snapshot);
    audioTracks?.sync(snapshot);
    timelinePreview.update(snapshot);
    if (playlistIconsChanged) presentation.refreshIcons();
    const nextControlTooltipKey = `${snapshot.isPlaying}:${snapshot.isLoading}:${snapshot.muted}:${snapshot.repeat}`;
    if (nextControlTooltipKey !== controlTooltipKey) {
      controlTooltipKey = nextControlTooltipKey;
      initTooltips(dock);
    }
    count.textContent = String(snapshot.queue.length);
    root.classList.toggle("is-empty", snapshot.queue.length === 0);
    playlist.hidden = snapshot.queue.length === 0;
    errorPanel.hidden =
      !snapshot.error || root.classList.contains("is-library-view");
    errorPanel.classList.toggle("is-visible", !!snapshot.error);
    root.querySelector('[data-ui="error-message"]').textContent =
      getPlaybackErrorMessage(snapshot.error);
    if (libraryModel) libraryView.renderPlayback(snapshot);
    const systemState =
      snapshot.currentTrack && !snapshot.isStopped
        ? {
            track: {
              title:
                snapshot.currentTrack.displayTitle ||
                snapshot.currentTrack.title,
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
    publishSettingsState(snapshot);
  }

  function getPlayerSettings(
    snapshot = latestSnapshot || controller.getSnapshot(),
  ) {
    return {
      ...preferences.getState(),
      shuffle: snapshot.shuffle === true,
      repeat: snapshot.repeat,
      volume: snapshot.volume,
      muted: snapshot.muted === true,
      visualizer: { ...visualizerSettings },
    };
  }

  function publishSettingsState(snapshot) {
    const settings = getPlayerSettings(snapshot);
    const key = JSON.stringify(settings);
    if (key === playerSettingsStateKey) return;
    playerSettingsStateKey = key;
    publishPlayerSettings(settings);
  }

  function onSettingsApply(event) {
    const settings = event.detail || {};
    preferences.apply(settings, { notify: false });
    controller.applyPlaybackSettings(settings);
    if (settings.visualizer) {
      visualizerSettings = normalizeVisualizerSettings(settings.visualizer);
      renderVisualizerSettings();
    }
    queuePersistence();
    publishSettingsState();
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
    audioTracks?.refreshI18n();
    renderVisualizerSettings();
  }

  async function switchAudioTrack({ audioTrackId: nextAudioTrackId, tracks }) {
    const track = controller.currentTrack;
    if (!track || track.providerId !== "local" || !libraryModel) return false;
    const previousAudioTrackId = track.selectedAudioTrackId || null;
    if (previousAudioTrackId === nextAudioTrackId) return true;
    const switched = controller.selectNativeAudioTrack({
      audioTrackId: nextAudioTrackId,
      tracks,
    });
    if (!switched.success) {
      throw new Error(
        switched.code === "AUDIO_TRACKS_NATIVE_MISMATCH"
          ? t("nowPlaying.audioTracks.nativeMismatch")
          : t("nowPlaying.audioTracks.switchError"),
      );
    }
    if (libraryModel.setTrackAudioSelection(track.id, nextAudioTrackId)) {
      libraryView.render(libraryModel.getState(), controller.getSnapshot());
      queuePersistence({ immediate: true });
      return true;
    }
    const rollback = controller.selectNativeAudioTrack({
      audioTrackId: previousAudioTrackId,
      tracks,
    });
    if (!rollback.success) {
      status.textContent = t("nowPlaying.audioTracks.switchError");
    }
    if (!libraryModel.setTrackAudioSelection(track.id, previousAudioTrackId)) {
      return false;
    }
    throw new Error(t("nowPlaying.audioTracks.switchError"));
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
      const newlyAddedIds = addedIds.filter((id) => !previousIds.has(id));
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
      const warningCount = imported.warnings?.length || 0;
      if (warningCount) {
        showPlayerToast("nowPlaying.toast.importWarning", "warning", {
          count: newlyAddedIds.length,
          skipped: warningCount,
        });
        status.textContent = t("nowPlaying.playlists.youtubeSkipped");
      } else if (newlyAddedIds.length) {
        showPlayerToast(
          source === "folder"
            ? "nowPlaying.toast.folderAdded"
            : "nowPlaying.toast.filesAdded",
          "success",
          { count: newlyAddedIds.length },
        );
        status.textContent = "";
      }
      if (
        source === "folder" &&
        imported.folderName &&
        imported.folderTrackIds?.length
      ) {
        libraryView.openDialog("folder", {
          folderName: imported.folderName,
          trackIds: imported.folderTrackIds,
        });
      }
    } catch (error) {
      status.textContent = showPlayerError(error);
    }
  }

  async function importPaths(paths, { autoplay = true } = {}) {
    if (!Array.isArray(paths) || !paths.length || !api?.importPaths)
      return false;
    try {
      const payload = unwrapNowPlayingState(await api.importPaths(paths));
      const tracks = Array.isArray(payload?.tracks) ? payload.tracks : [];
      provider.mergeTracks(
        tracks.filter((track) => track.providerId === "local"),
      );
      const previousIds = new Set(
        libraryModel.getState().catalog.tracks.map((track) => track.id),
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
      const addedCount = importedTracks.filter(
        (track) => !previousIds.has(track.id),
      ).length;
      if (payload?.warnings?.length) {
        showPlayerToast("nowPlaying.toast.importWarning", "warning", {
          count: addedCount,
          skipped: payload.warnings.length,
        });
      } else if (addedCount) {
        showPlayerToast("nowPlaying.toast.filesAdded", "success", {
          count: addedCount,
        });
      }
      return true;
    } catch (error) {
      status.textContent = showPlayerError(error);
      return false;
    }
  }

  async function importYouTube(url, qualitySelection) {
    const loadingMessage = t("nowPlaying.youtube.fetching");
    status.textContent = loadingMessage;
    libraryView.setOperationStatus(loadingMessage, { loading: true });
    try {
      const track = await youtubeProvider.importSource(url, {
        qualitySelection,
      });
      const existingIds = new Set(
        libraryModel.getState().catalog.tracks.map((item) => item.id),
      );
      const addedIds = libraryModel.addTracks([track]);
      if (!addedIds.some((id) => !existingIds.has(id))) {
        const duplicateMessage = t("nowPlaying.playlists.alreadyAdded");
        libraryView.showDialogError(duplicateMessage);
        libraryView.setOperationStatus(duplicateMessage, { error: true });
        status.textContent = "";
        return false;
      }
      syncLibraryQueue();
      status.textContent = "";
      libraryView.setOperationStatus("");
      showPlayerToast("nowPlaying.toast.linkAdded");
      return true;
    } catch (error) {
      const message = showPlayerError(error);
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
      const playlist = libraryModel.createPlaylist(value);
      libraryView.render(libraryModel.getState(), latestSnapshot);
      initTooltips(root);
      queuePersistence();
      showPlayerToast("nowPlaying.toast.playlistCreated", "success", {
        title: playlist.title,
      });
      return true;
    }
    if (mode === "folderPlaylist") {
      const result = libraryModel.createOrUpdatePlaylist(context.folderName, {
        trackIds: context.trackIds,
      });
      if (!result.playlist) return false;
      libraryModel.setActivePlaylist(result.playlist.id);
      syncLibraryQueue();
      libraryView.show();
      showPlayerToast(
        result.created
          ? "nowPlaying.toast.folderPlaylistCreated"
          : "nowPlaying.toast.folderPlaylistUpdated",
        "success",
        {
          title: result.playlist.title,
          count: result.addedCount,
        },
      );
      return true;
    }
    if (mode === "rename") {
      const activePlaylist = libraryView.getActivePlaylist();
      if (!activePlaylist || activePlaylist.id === MEDIA_LIBRARY_ID) {
        return false;
      }
      if (!libraryModel.renamePlaylist(activePlaylist.id, value)) return false;
      libraryView.render(libraryModel.getState(), latestSnapshot);
      initTooltips(root);
      queuePersistence();
      showPlayerToast("nowPlaying.toast.playlistRenamed", "success", {
        title: value,
      });
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
      showPlayerToast("nowPlaying.toast.addedToPlaylist");
      return true;
    }
    if (mode === "renameTrack") {
      if (typeof libraryModel.renameTrack !== "function") return false;
      const renamed = libraryModel.renameTrack(context.trackId, value);
      if (!renamed) return false;
      syncLibraryQueue({ selectedTrackId: controller.currentTrack?.id });
      showPlayerToast("nowPlaying.toast.mediaRenamed", "success", {
        title: value,
      });
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
    if (!libraryModel.removeTrackFromPlaylist(trackId, activePlaylist.id)) {
      return false;
    }
    syncLibraryQueue();
    if (wasCurrent && controller.currentTrack) {
      void controller.selectTrack(controller.currentTrack.id, {
        autoplay: wasPlaying,
      });
    }
    showPlayerToast("nowPlaying.toast.removedFromPlaylist");
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
    if (!libraryModel.deleteFromCatalog(trackId)) return false;
    if (wasCurrent) controller.pause();
    syncLibraryQueue();
    if (wasCurrent && controller.currentTrack) {
      void controller.selectTrack(controller.currentTrack.id, {
        autoplay: wasPlaying,
      });
    }
    showPlayerToast("nowPlaying.toast.mediaDeleted", "success", {
      title: track?.displayTitle || track?.title || "",
    });
    return true;
  }

  function removeTrack(trackId) {
    return removeFromActivePlaylist(trackId);
  }

  function showLibrary() {
    libraryView.show();
    errorPanel.hidden = true;
    return true;
  }

  function showPlayer() {
    libraryView.hide();
    errorPanel.hidden = !latestSnapshot?.error;
    return true;
  }

  async function executeCommand(commandId) {
    const snapshot = latestSnapshot || controller.getSnapshot();
    const hasTrack = Boolean(snapshot.currentTrack);
    const hasQueue = snapshot.queue.length > 0;
    const duration = Number(snapshot.duration) || 0;

    if (commandId === PLAYER_COMMANDS.OPEN) {
      return hasTrack ? showPlayer() : false;
    }
    if (commandId === PLAYER_COMMANDS.OPEN_LIBRARY) return showLibrary();
    if (commandId === PLAYER_COMMANDS.SHOW_CURRENT_MEDIA_INFO) {
      if (!hasTrack) return false;
      return libraryView.openDialog("trackInfo", {
        track: controller.currentTrack,
        posterUrl: presentation.getPosterUrl(controller.currentTrack),
      });
    }
    if (commandId === PLAYER_COMMANDS.TOGGLE_FULLSCREEN) {
      return fullscreen.toggle();
    }
    if (commandId === PLAYER_COMMANDS.PLAY) {
      return hasTrack ? controller.play() : false;
    }
    if (commandId === PLAYER_COMMANDS.PAUSE) {
      if (!snapshot.isPlaying && !snapshot.isLoading) return false;
      controller.pause();
      return true;
    }
    if (commandId === PLAYER_COMMANDS.TOGGLE_PLAYBACK) {
      return hasTrack ? controller.togglePlayback() : false;
    }
    if (commandId === PLAYER_COMMANDS.STOP) {
      if (!hasTrack || snapshot.isStopped) return false;
      controller.stop();
      return true;
    }
    if (commandId === PLAYER_COMMANDS.PREVIOUS) {
      return hasQueue ? controller.previous() : false;
    }
    if (commandId === PLAYER_COMMANDS.NEXT) {
      return hasQueue || transientQueue.getItems().length
        ? playNextTrack()
        : false;
    }
    if (commandId === PLAYER_COMMANDS.SEEK_BACKWARD) {
      if (!hasTrack || duration <= 0) return false;
      controller.seek(snapshot.currentTime - 10);
      return true;
    }
    if (commandId === PLAYER_COMMANDS.SEEK_FORWARD) {
      if (!hasTrack || duration <= 0) return false;
      controller.seek(snapshot.currentTime + 10);
      return true;
    }
    if (commandId === PLAYER_COMMANDS.TOGGLE_MUTE) {
      if (!hasTrack) return false;
      showVolumeFeedback();
      return controller.toggleMute();
    }
    if (commandId === PLAYER_COMMANDS.VOLUME_DOWN) {
      if (!hasTrack) return false;
      showVolumeFeedback();
      return controller.setVolume(snapshot.volume - 0.05);
    }
    if (commandId === PLAYER_COMMANDS.VOLUME_UP) {
      if (!hasTrack) return false;
      showVolumeFeedback();
      return controller.setVolume(snapshot.volume + 0.05);
    }
    if (commandId === PLAYER_COMMANDS.TOGGLE_SHUFFLE) {
      return hasQueue ? controller.toggleShuffle() : false;
    }
    if (commandId === PLAYER_COMMANDS.CYCLE_REPEAT) {
      return hasQueue ? controller.cycleRepeat() : false;
    }
    return false;
  }

  async function clearQueue() {
    const activePlaylist = libraryView.getActivePlaylist();
    if (!activePlaylist) return false;
    const state = libraryModel.getState();
    if (activePlaylist.id === MEDIA_LIBRARY_ID) {
      if (!state.catalog.tracks.length) return false;
      const confirmed = await showConfirmationDialog({
        title: t("nowPlaying.library.clearQueueTitle"),
        message: t("nowPlaying.library.clearQueueConfirm", {
          count: state.catalog.tracks.length,
        }),
        confirmText: t("nowPlaying.library.clearQueueAction"),
      });
      if (!confirmed) return false;
    }
    const removedCount =
      activePlaylist.id === MEDIA_LIBRARY_ID
        ? state.catalog.tracks.length
        : activePlaylist.trackIds.length;
    if (!removedCount) return false;
    controller.pause();
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
    showPlayerToast(
      activePlaylist.id === MEDIA_LIBRARY_ID
        ? "nowPlaying.toast.libraryCleared"
        : "nowPlaying.toast.playlistCleared",
      "success",
      { count: removedCount },
    );
    return true;
  }

  function closeAddMenu({ restoreFocus = false } = {}) {
    if (!addMenu || addMenu.hidden) return false;
    addMenu.hidden = true;
    addMenuTrigger?.setAttribute("aria-expanded", "false");
    if (restoreFocus) addMenuTrigger?.focus();
    return true;
  }

  function toggleAddMenu() {
    if (!addMenu) return false;
    const expanded = addMenu.hidden;
    addMenu.hidden = !expanded;
    addMenuTrigger?.setAttribute("aria-expanded", String(expanded));
    if (expanded) {
      playerMenu.hidden = true;
      root
        .querySelector('[data-action="toggle-player-menu"]')
        ?.setAttribute("aria-expanded", "false");
      addMenu.querySelector('[role="menuitem"]')?.focus();
    }
    return true;
  }

  async function handleAction(action, target) {
    if (action?.startsWith("placeholder-")) return false;
    const audioAction = audioTracks?.handleAction(action, target);
    if (audioAction !== undefined) {
      if (action === "toggle-audio-tracks") {
        playerMenu.hidden = true;
        root
          .querySelector('[data-action="toggle-player-menu"]')
          ?.setAttribute("aria-expanded", "false");
      }
      return audioAction;
    }
    if (action === "toggle-player-menu") {
      closeAddMenu();
      playerMenu.hidden = !playerMenu.hidden;
      target.setAttribute("aria-expanded", String(!playerMenu.hidden));
      if (!playerMenu.hidden) {
        playerMenu.querySelector("button")?.focus();
      }
      return true;
    }
    if (action === "toggle-add-menu") return toggleAddMenu();
    if (target.closest('[data-ui="sidebar-add-menu"]')) closeAddMenu();
    const playerCommand = PLAYER_UI_ACTIONS[action];
    if (playerCommand) {
      playerMenu.hidden = true;
      return executeCommand(playerCommand);
    }
    if (preferences.handleAction(action)) return true;
    if (action === "toggle-visualizer-settings") {
      setVisualizerSettingsExpanded(!visualizerSettingsExpanded);
      return visualizerSettingsExpanded;
    }
    if (action === "reset-visualizer-settings") {
      return saveVisualizerSettings(DEFAULT_VISUALIZER_SETTINGS);
    }
    if (action === "add-files") return importSource("files");
    if (action === "add-folder") return importSource("folder");
    if (action === "clear") return clearQueue();
    if (action === "clear-media-library") return clearQueue();
    if (action === "close-playback") {
      playerMenu.hidden = true;
      const closed = controller.closeCurrent();
      if (closed) showLibrary();
      return closed;
    }
    if (action === "retry") return controller.retry();
    if (action === "clear-library-search") return libraryView.clearSearch();
    if (action === "set-library-filter") {
      return libraryView.setFilter(target.dataset.filter);
    }
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
    if (action === "clear-transient-queue") {
      const count = transientQueue.getItems().length;
      if (!count) return false;
      transientQueue.clear();
      showPlayerToast("nowPlaying.toast.queueCleared", "success", { count });
      return true;
    }
    if (action === "remove-transient") {
      const removed = transientQueue.remove(target.dataset.trackId);
      if (removed) showPlayerToast("nowPlaying.toast.removedFromQueue");
      return removed;
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
    if (action === "toggle-sidebar-playlist-menu") {
      return libraryView.toggleSidebarPlaylistMenu();
    }
    if (action === "select-sidebar-playlist") {
      libraryView.closeSidebarPlaylistMenu({ restoreFocus: true });
      return selectPlaylist(target.dataset.playlistId);
    }
    if (action === "select-library-track") {
      if (target.dataset.trackId === controller.currentTrack?.id) {
        return controller.togglePlayback();
      }
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
      const deleteMode = await showConfirmationDialog({
        title: t("nowPlaying.playlists.delete"),
        message: t("nowPlaying.playlists.deleteConfirm", {
          title: activePlaylist.title,
        }),
        confirmText: t("nowPlaying.playlists.delete"),
        choices: [
          {
            value: "playlist-only",
            label: t("nowPlaying.playlists.deleteOnly"),
            description: t("nowPlaying.playlists.deleteOnlyHint"),
          },
          {
            value: "playlist-and-library",
            label: t("nowPlaying.playlists.deleteWithMedia"),
            description: t("nowPlaying.playlists.deleteWithMediaHint"),
          },
        ],
        defaultChoice: "playlist-only",
      });
      if (!deleteMode) return false;
      const removedTrackIds = [...activePlaylist.trackIds];
      const removeFromLibrary = deleteMode === "playlist-and-library";
      const currentTrackRemoved =
        removeFromLibrary &&
        removedTrackIds.includes(controller.currentTrack?.id);
      const wasPlaying = controller.isPlaying;
      if (currentTrackRemoved) controller.pause();
      if (removeFromLibrary) {
        removedTrackIds.forEach((trackId) => {
          transientQueue.remove(trackId);
          libraryModel.deleteFromCatalog(trackId);
        });
      }
      if (!libraryModel.deletePlaylist(activePlaylist.id)) return false;
      syncLibraryQueue();
      if (removeFromLibrary) renderTransientQueue();
      if (currentTrackRemoved && controller.currentTrack) {
        void controller.selectTrack(controller.currentTrack.id, {
          autoplay: wasPlaying,
        });
      }
      showPlayerToast(
        removeFromLibrary
          ? "nowPlaying.toast.playlistAndMediaDeleted"
          : "nowPlaying.toast.playlistDeleted",
        "success",
        { title: activePlaylist.title, count: removedTrackIds.length },
      );
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
    if (action === "queue") {
      const added = transientQueue.add(track);
      if (added) {
        showPlayerToast("nowPlaying.toast.addedToQueue", "success", {
          title: track.displayTitle || track.title,
        });
      }
      return added;
    }
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
      return libraryView.openDialog("renameTrack", {
        trackId: track.id,
        track,
      });
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
        libraryView.setOperationStatus(
          error?.message || t("nowPlaying.error"),
          {
            error: true,
          },
        );
        return false;
      }
    }
    return false;
  }

  function onClick(event) {
    const actionTarget = event.target.closest("[data-action]");
    audioTracks?.handleOutsideClick(event.target);
    if (!event.target.closest(".now-playing__playlist-select-shell")) {
      libraryView.closeSidebarPlaylistMenu();
    }
    if (!event.target.closest(".now-playing__sidebar-add")) {
      closeAddMenu();
    }
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
    if (audioTracks?.handleKeydown(event)) return;
    const addMenuItem = event.target.closest(
      '[data-ui="sidebar-add-menu"] [role="menuitem"]',
    );
    if (addMenuItem && event.key === "Escape") {
      event.preventDefault();
      closeAddMenu({ restoreFocus: true });
      return;
    }
    if (
      addMenuItem &&
      ["ArrowDown", "ArrowUp", "Home", "End"].includes(event.key)
    ) {
      event.preventDefault();
      const items = [
        ...addMenu.querySelectorAll('[role="menuitem"]:not([disabled])'),
      ];
      const current = items.indexOf(addMenuItem);
      const index =
        event.key === "Home"
          ? 0
          : event.key === "End"
            ? items.length - 1
            : (current + (event.key === "ArrowDown" ? 1 : -1) + items.length) %
              items.length;
      items[index]?.focus();
      return;
    }
    const playlistTrigger = event.target.closest(
      '[data-action="toggle-sidebar-playlist-menu"]',
    );
    if (
      playlistTrigger &&
      ["ArrowDown", "ArrowUp", "Enter", " "].includes(event.key)
    ) {
      event.preventDefault();
      libraryView.toggleSidebarPlaylistMenu(true);
      return;
    }
    const playlistOption = event.target.closest(
      '[data-action="select-sidebar-playlist"]',
    );
    if (
      playlistOption &&
      ["ArrowDown", "ArrowUp", "Home", "End"].includes(event.key)
    ) {
      event.preventDefault();
      libraryView.moveSidebarPlaylistFocus(playlistOption, event.key);
      return;
    }
    if (playlistOption && ["Enter", " "].includes(event.key)) {
      event.preventDefault();
      playlistOption.click();
      return;
    }
    if (event.key === "Escape" && (playlistOption || playlistTrigger)) {
      event.preventDefault();
      event.stopPropagation();
      libraryView.closeSidebarPlaylistMenu({ restoreFocus: true });
      return;
    }
    const libraryRow = event.target.closest(".player-library__track");
    if (
      libraryRow &&
      (event.key === "ContextMenu" || (event.shiftKey && event.key === "F10"))
    ) {
      event.preventDefault();
      const context = libraryView.getTrackContext(libraryRow.dataset.trackId);
      const bounds = libraryRow.getBoundingClientRect();
      if (context)
        contextMenu.open(context, libraryRow, {
          x: bounds.left + 24,
          y: bounds.top + 24,
        });
      return;
    }
    if (libraryRow && ["Enter", " "].includes(event.key)) {
      event.preventDefault();
      void controller.selectTrack(libraryRow.dataset.trackId);
      return;
    }
    const row = event.target.closest(".now-playing__track");
    if (row && event.altKey && ["ArrowUp", "ArrowDown"].includes(event.key)) {
      event.preventDefault();
      const activePlaylist = libraryView.getActivePlaylist();
      const sourceIndex = controller.queue.findIndex(
        (track) => track.id === row.dataset.trackId,
      );
      const targetIndex = sourceIndex + (event.key === "ArrowUp" ? -1 : 1);
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
    const visualizerControl = event.target.closest("[data-visualizer-setting]");
    if (
      visualizerControl &&
      ["sensitivity", "smoothing", "barCount"].includes(
        visualizerControl.dataset.visualizerSetting,
      )
    ) {
      const key = visualizerControl.dataset.visualizerSetting;
      const raw = Number(visualizerControl.value);
      const value =
        key === "barCount" ? raw : Math.min(2, Math.max(0, raw / 100));
      void saveVisualizerSettings({
        ...visualizerSettings,
        [key]: value,
      });
      return;
    }
    if (event.target.matches('[data-action="filter-library"]')) {
      libraryView.setSearchQuery(event.target.value);
      return;
    }
    if (event.target.matches('[data-action="seek"]')) {
      controller.seek(event.target.value);
    }
    if (event.target.matches('[data-action="volume"]')) {
      showVolumeFeedback();
      controller.setVolume(event.target.value);
    }
  }

  function onChange(event) {
    const control = event.target.closest("[data-visualizer-setting]");
    if (!control || !root.contains(control)) return;
    const key = control.dataset.visualizerSetting;
    if (["sensitivity", "smoothing", "barCount"].includes(key)) return;
    void saveVisualizerSettings({
      ...visualizerSettings,
      [key]: control.type === "checkbox" ? control.checked : control.value,
    });
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
    if (context)
      contextMenu.open(context, row, { x: event.clientX, y: event.clientY });
  }

  function onDoubleClick(event) {
    const row = event.target.closest(".now-playing__track");
    if (row) {
      if (
        event.target.closest("button") ||
        !root.contains(row) ||
        row.classList.contains("is-unavailable")
      ) {
        return;
      }
      void controller.selectTrack(row.dataset.trackId);
      return;
    }

    const interactiveTarget = event.target.closest(
      "button, input, select, textarea, a, [role='button'], [contenteditable='true']",
    );
    const overlayTarget = event.target.closest(
      ".now-playing__sidebar, .now-playing__dock, .now-playing__visualizer-panel, .now-playing__player-topbar, .now-playing__player-menu",
    );
    const playerStage = event.target.closest('[data-ui="player-stage"]');
    if (
      interactiveTarget ||
      overlayTarget ||
      !playerStage ||
      !root.contains(playerStage) ||
      root.classList.contains("is-library-view") ||
      latestSnapshot?.isPlaying !== true ||
      !latestSnapshot.currentTrack
    ) {
      return;
    }
    void fullscreen.toggle();
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
      libraryModel.reorderTrack(activePlaylist.id, draggedTrackId, targetIndex)
    ) {
      syncLibraryQueue({ selectedTrackId: controller.currentTrack?.id });
    }
    onDragEnd();
  }

  function onDragEnd() {
    draggedTrackId = "";
    playlist
      .querySelectorAll(".is-dragging, .is-drag-target")
      .forEach((row) => row.classList.remove("is-dragging", "is-drag-target"));
  }

  function onMediaEnded(event) {
    if (event.target !== controller.activeMedia) return;
    if (transientQueue.getItems().length) {
      event.stopImmediatePropagation();
      void playNextTrack({ fromEnded: true });
      return;
    }
    const isLastTrack = controller.currentIndex === controller.queue.length - 1;
    const shuffleCanContinue =
      controller.shuffle && controller.queue.length > 1;
    if (isLastTrack && controller.repeat === "off" && !shuffleCanContinue) {
      showPlayerToast("nowPlaying.toast.playlistFinished", "info");
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
    const commandId = SYSTEM_MEDIA_COMMANDS[payload.command];
    if (commandId) void executeCommand(commandId);
  }

  root.addEventListener("click", onClick);
  root.addEventListener("keydown", onKeydown);
  root.addEventListener("input", onInput);
  root.addEventListener("change", onChange);
  root.addEventListener("wheel", onWheel, { passive: false });
  root.addEventListener("contextmenu", onContextMenu);
  root.addEventListener("dblclick", onDoubleClick);
  root.addEventListener("dragstart", onDragStart);
  root.addEventListener("dragover", onDragOver);
  root.addEventListener("drop", onDrop);
  root.addEventListener("dragend", onDragEnd);
  mediaLayers.forEach((media) =>
    media.addEventListener("ended", onMediaEnded, true),
  );
  window.addEventListener("blur", onWindowBlur);
  window.addEventListener("focus", onWindowFocus);
  window.addEventListener("i18n:changed", onI18nChanged);
  document.addEventListener("visibilitychange", onVisibilityChange);
  const unsubscribe = controller.subscribe(render);
  const unsubscribePlayerSettings = onPlayerSettingsApply(onSettingsApply);
  const unsubscribeMediaCommand = api?.onMediaCommand?.(onSystemMediaCommand);

  const ready = (async () => {
    try {
      const state = unwrapNowPlayingState(await api.getState());
      preferences.restore(state);
      visualizerSettings = normalizeVisualizerSettings(state.visualizer);
      renderVisualizerSettings();
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
    executeCommand,
    canUsePlayerShortcuts() {
      return active || latestSnapshot?.isPlaying === true;
    },
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
      closeAddMenu();
      libraryView.closeDialog();
      void flushPersistence();
      if (preferences.shouldSuspendInBackground()) controller.suspend();
    },
    dispose() {
      if (disposed) return;
      void flushPersistence();
      disposed = true;
      unsubscribe();
      unsubscribePlayerSettings();
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
      audioTracks?.dispose();
      controlsVisibility.dispose();
      overlayVisibility.dispose();
      fullscreen.dispose();
      visualTransitions.dispose();
      presentation.dispose();
      visualizer.destroy();
      timelinePreview.dispose();
      libraryView.dispose();
      contextMenu.dispose();
      if (volumeFeedbackTimer !== null) clearTimeout(volumeFeedbackTimer);
      if (persistenceTimer !== null) clearTimeout(persistenceTimer);
      root.removeEventListener("click", onClick);
      root.removeEventListener("keydown", onKeydown);
      root.removeEventListener("input", onInput);
      root.removeEventListener("change", onChange);
      root.removeEventListener("wheel", onWheel);
      root.removeEventListener("contextmenu", onContextMenu);
      root.removeEventListener("dblclick", onDoubleClick);
      root.removeEventListener("dragstart", onDragStart);
      root.removeEventListener("dragover", onDragOver);
      root.removeEventListener("drop", onDrop);
      root.removeEventListener("dragend", onDragEnd);
      mediaLayers.forEach((media) =>
        media.removeEventListener("ended", onMediaEnded, true),
      );
      window.removeEventListener("blur", onWindowBlur);
      window.removeEventListener("focus", onWindowFocus);
      window.removeEventListener("i18n:changed", onI18nChanged);
      document.removeEventListener("visibilitychange", onVisibilityChange);
    },
  };
}

export default createNowPlayingView;
