import {
  getActiveTracksFromState,
  normalizeMediaLibraryState,
} from "./mediaLibraryModel.js";

const REPEAT_MODES = new Set(["off", "all", "one"]);
let hlsModulePromise = null;

async function loadHlsConstructor() {
  hlsModulePromise ||= import(
    "../../../../node_modules/hls.js/dist/hls.mjs"
  );
  const hlsModule = await hlsModulePromise;
  return hlsModule.default;
}

function clamp(value, min, max) {
  return Math.min(max, Math.max(min, Number(value) || 0));
}

function safeMediaCall(media, method) {
  try {
    return media?.[method]?.();
  } catch {
    return undefined;
  }
}

export class PlaybackController {
  constructor({ providers, mediaLayers, random = Math.random }) {
    if (!providers || !Array.isArray(mediaLayers) || mediaLayers.length !== 2) {
      throw new TypeError(
        "PlaybackController requires providers and two media layers",
      );
    }
    this.providers = providers;
    this.mediaLayers = mediaLayers;
    this.random = random;
    this.listeners = new Set();
    this.queue = [];
    this.currentIndex = -1;
    this.activeLayerIndex = 0;
    this.isPlaying = false;
    this.isStopped = true;
    this.positionRevision = 0;
    this.isLoading = false;
    this.loadingTrackId = null;
    this.isSuspended = false;
    this.resumeOnShow = false;
    this.shuffle = false;
    this.repeat = "off";
    this.volume = 1;
    this.muted = false;
    this.error = null;
    this.libraryState = null;
    this.selectionVersion = 0;
    this.animationFrame = null;
    this.lastProgressEmitAt = 0;
    this.queueSnapshot = [];
    this.mediaEventHandlers = new Map();
    this.layerPlaybacks = [null, null];
    this.hlsInstances = [null, null];
    this.bindMediaEvents();
    this.applyVolume();
  }

  get currentTrack() {
    return this.queue[this.currentIndex] || null;
  }

  get activeMedia() {
    return this.mediaLayers[this.activeLayerIndex];
  }

  subscribe(listener) {
    this.listeners.add(listener);
    listener(this.getSnapshot());
    return () => this.listeners.delete(listener);
  }

  getSnapshot() {
    const media = this.activeMedia;
    return {
      queue: this.queueSnapshot,
      currentTrack: this.currentTrack ? { ...this.currentTrack } : null,
      currentIndex: this.currentIndex,
      activeLayerIndex: this.activeLayerIndex,
      isPlaying: this.isPlaying,
      isStopped: this.isStopped,
      positionRevision: this.positionRevision,
      isLoading: this.isLoading,
      loadingTrackId: this.loadingTrackId,
      isSuspended: this.isSuspended,
      shuffle: this.shuffle,
      repeat: this.repeat,
      volume: this.volume,
      muted: this.muted,
      currentTime: Number(media?.currentTime) || 0,
      duration:
        Number(media?.duration) || Number(this.currentTrack?.duration) || 0,
      error: this.error,
    };
  }

  emit() {
    const snapshot = this.getSnapshot();
    this.listeners.forEach((listener) => listener(snapshot));
  }

  setQueue(tracks = [], { selectedTrackId = null } = {}) {
    this.selectionVersion += 1;
    this.isLoading = false;
    this.loadingTrackId = null;
    const previousId = selectedTrackId || this.currentTrack?.id;
    this.queue = Array.isArray(tracks) ? [...tracks] : [];
    this.queueSnapshot = this.queue.map((track) => ({ ...track }));
    this.currentIndex = previousId
      ? this.queue.findIndex((track) => track.id === previousId)
      : -1;
    if (this.currentIndex < 0 && this.queue.length) this.currentIndex = 0;
    if (!this.queue.length) {
      safeMediaCall(this.activeMedia, "pause");
      if (this.activeMedia) this.activeMedia.currentTime = 0;
      this.isPlaying = false;
      this.isStopped = true;
      this.resumeOnShow = false;
      this.stopProgressFrames();
    }
    this.error = null;
    this.emit();
  }

  restoreState(state = {}) {
    this.shuffle = state.shuffle === true;
    this.repeat = REPEAT_MODES.has(state.repeat) ? state.repeat : "off";
    this.volume = clamp(state.volume ?? 1, 0, 1);
    this.muted = state.muted === true;
    this.applyVolume();
    if (state.version === 2 || state.catalog || state.playlists) {
      this.libraryState = normalizeMediaLibraryState(state);
      this.setQueue(getActiveTracksFromState(this.libraryState), {
        selectedTrackId: state.selectedTrackId,
      });
      return;
    }
    this.libraryState = null;
    this.setQueue(state.playlist?.tracks || state.tracks || [], {
      selectedTrackId: state.selectedTrackId,
    });
  }

  getPersistentState() {
    if (this.libraryState) {
      return {
        ...normalizeMediaLibraryState(this.libraryState),
        selectedTrackId: this.currentTrack?.id || null,
        volume: this.volume,
        muted: this.muted,
        shuffle: this.shuffle,
        repeat: this.repeat,
      };
    }
    return {
      version: 1,
      playlist: {
        id: "local-library",
        providerId: "local",
        title: "Local library",
        tracks: this.queue.map((track) => ({ ...track, playback: undefined })),
      },
      selectedTrackId: this.currentTrack?.id || null,
      volume: this.volume,
      muted: this.muted,
      shuffle: this.shuffle,
      repeat: this.repeat,
    };
  }

  setLibraryState(state, { selectedTrackId = null } = {}) {
    this.libraryState = normalizeMediaLibraryState(state);
    this.setQueue(getActiveTracksFromState(this.libraryState), {
      selectedTrackId:
        selectedTrackId ||
        this.currentTrack?.id ||
        this.libraryState.selectedTrackId,
    });
  }

  async selectTrack(trackId, { autoplay = true, forceRefresh = false } = {}) {
    const index = this.queue.findIndex((track) => track.id === trackId);
    if (index === -1) return false;
    const track = this.queue[index];
    if (track.availability === "missing") {
      this.currentIndex = index;
      this.error = { code: "TRACK_UNAVAILABLE", message: "Track unavailable" };
      this.isPlaying = false;
      this.isStopped = true;
      this.isLoading = false;
      this.loadingTrackId = null;
      this.emit();
      return false;
    }

    const version = ++this.selectionVersion;
    safeMediaCall(this.activeMedia, "pause");
    this.stopProgressFrames();
    this.currentIndex = index;
    this.isPlaying = false;
    this.isLoading = true;
    this.loadingTrackId = track.id;
    this.error = null;
    this.emit();
    try {
      const reusableLayer = forceRefresh ? -1 : this.findReusableLayer(track);
      if (reusableLayer !== -1) {
        this.activateLayer(reusableLayer);
        if (autoplay && !this.isSuspended) {
          await this.play({ selectionVersion: version });
        } else {
          this.isLoading = false;
          this.loadingTrackId = null;
          this.emit();
        }
        return true;
      }
      const playback = await this.providers.resolveTrack(track, {
        forceRefresh,
      });
      if (version !== this.selectionVersion) return false;
      await this.loadPlayback(track, playback);
      if (autoplay && !this.isSuspended) {
        await this.play({ selectionVersion: version });
      } else {
        this.isLoading = false;
        this.loadingTrackId = null;
        this.emit();
      }
      return true;
    } catch (error) {
      if (version !== this.selectionVersion) return false;
      this.error = {
        code: error?.code || "MEDIA_LOAD_FAILED",
        message: error?.message || "Unable to load track",
      };
      this.isPlaying = false;
      this.isStopped = true;
      this.isLoading = false;
      this.loadingTrackId = null;
      this.emit();
      return false;
    }
  }

  async loadPlayback(track, playback) {
    const previousMedia = this.activeMedia;
    const nextLayerIndex = this.activeLayerIndex === 0 ? 1 : 0;
    const nextMedia = this.mediaLayers[nextLayerIndex];
    this.releaseLayer(nextLayerIndex);
    safeMediaCall(previousMedia, "pause");
    previousMedia.volume = 0;
    const playbackKey = this.getPlaybackKey(track);
    nextMedia.dataset.playbackKey = playbackKey;
    nextMedia.dataset.trackId = track.id;
    nextMedia.dataset.kind = track.kind;
    nextMedia.poster = playback.posterUrl || track.artworkUrl || "";
    nextMedia.currentTime = 0;
    this.layerPlaybacks[nextLayerIndex] = { playback, track };
    const Hls =
      playback.kind === "hls" ? await loadHlsConstructor() : null;
    if (Hls?.isSupported()) {
      const hls = new Hls({
        backBufferLength: 30,
        maxBufferLength: 45,
        maxMaxBufferLength: 90,
      });
      this.hlsInstances[nextLayerIndex] = hls;
      hls.attachMedia(nextMedia);
      hls.on(Hls.Events.MEDIA_ATTACHED, () => hls.loadSource(playback.src));
    } else {
      nextMedia.src = playback.src;
      safeMediaCall(nextMedia, "load");
    }
    this.activeLayerIndex = nextLayerIndex;
    this.applyVolume();
    this.emit();
  }

  async play({ selectionVersion = null } = {}) {
    if (!this.currentTrack) return false;
    if (
      !this.activeMedia?.src ||
      this.activeMedia.dataset.trackId !== this.currentTrack.id
    ) {
      return this.selectTrack(this.currentTrack.id, { autoplay: true });
    }
    try {
      const media = this.activeMedia;
      const result = safeMediaCall(media, "play");
      if (result && typeof result.catch === "function") await result;
      if (
        (selectionVersion !== null &&
          selectionVersion !== this.selectionVersion) ||
        media !== this.activeMedia
      ) {
        safeMediaCall(media, "pause");
        return false;
      }
      this.isPlaying = true;
      this.isStopped = false;
      this.isLoading = false;
      this.loadingTrackId = null;
      this.error = null;
      this.startProgressFrames();
      this.emit();
      return true;
    } catch (error) {
      this.isPlaying = false;
      this.isStopped = true;
      this.isLoading = false;
      this.loadingTrackId = null;
      this.error = {
        code: "PLAYBACK_BLOCKED",
        message: error?.message || "Playback was blocked",
      };
      this.emit();
      return false;
    }
  }

  pause({ preserveResumeOnShow = false } = {}) {
    if (this.isLoading) this.selectionVersion += 1;
    safeMediaCall(this.activeMedia, "pause");
    this.isPlaying = false;
    this.isLoading = false;
    this.loadingTrackId = null;
    if (!preserveResumeOnShow) this.resumeOnShow = false;
    this.stopProgressFrames();
    this.emit();
  }

  stop() {
    this.selectionVersion += 1;
    safeMediaCall(this.activeMedia, "pause");
    if (this.activeMedia) this.activeMedia.currentTime = 0;
    this.isPlaying = false;
    this.isStopped = true;
    this.isLoading = false;
    this.loadingTrackId = null;
    this.resumeOnShow = false;
    this.stopProgressFrames();
    this.emit();
  }

  async togglePlayback() {
    return this.isPlaying ? (this.pause(), false) : this.play();
  }

  seek(value) {
    if (!this.activeMedia) return;
    const duration =
      Number(this.activeMedia.duration) || Number(this.currentTrack?.duration);
    this.activeMedia.currentTime = clamp(value, 0, duration || 0);
    this.positionRevision += 1;
    this.emit();
  }

  setVolume(value) {
    this.volume = clamp(value, 0, 1);
    this.muted = this.volume === 0;
    this.applyVolume();
    this.emit();
  }

  toggleMute() {
    this.muted = !this.muted;
    this.applyVolume();
    this.emit();
  }

  toggleShuffle() {
    this.shuffle = !this.shuffle;
    this.emit();
  }

  cycleRepeat() {
    this.repeat =
      this.repeat === "off" ? "one" : this.repeat === "one" ? "all" : "off";
    this.emit();
  }

  getPlaybackKey(track) {
    return `${track.id}:${JSON.stringify(track.qualitySelection || null)}`;
  }

  findReusableLayer(track) {
    const playbackKey = this.getPlaybackKey(track);
    return this.mediaLayers.findIndex(
      (media, index) =>
        media.dataset.playbackKey === playbackKey &&
        this.layerPlaybacks[index]?.playback?.src,
    );
  }

  activateLayer(index) {
    if (index === this.activeLayerIndex) return;
    safeMediaCall(this.activeMedia, "pause");
    this.activeLayerIndex = index;
    this.applyVolume();
    this.emit();
  }

  releaseLayer(index) {
    const record = this.layerPlaybacks[index];
    this.hlsInstances[index]?.destroy();
    this.hlsInstances[index] = null;
    this.layerPlaybacks[index] = null;
    const media = this.mediaLayers[index];
    media.removeAttribute("src");
    delete media.dataset.playbackKey;
    if (record) void this.providers.releasePlayback?.(record.track, record.playback);
  }

  async next({ fromEnded = false } = {}) {
    if (!this.queue.length) return false;
    if (fromEnded && this.repeat === "one") {
      this.seek(0);
      return this.play();
    }
    if (this.shuffle && this.queue.length > 1) {
      const offset = 1 + Math.floor(this.random() * (this.queue.length - 1));
      const index = (this.currentIndex + offset) % this.queue.length;
      return this.selectTrack(this.queue[index].id);
    }
    const nextIndex = this.currentIndex + 1;
    if (nextIndex < this.queue.length) {
      return this.selectTrack(this.queue[nextIndex].id);
    }
    if (this.repeat === "all") return this.selectTrack(this.queue[0].id);
    this.stop();
    return false;
  }

  async previous() {
    if (!this.queue.length) return false;
    if ((Number(this.activeMedia?.currentTime) || 0) > 3) {
      this.seek(0);
      return true;
    }
    const index = this.currentIndex > 0 ? this.currentIndex - 1 : 0;
    return this.selectTrack(this.queue[index].id);
  }

  suspend() {
    if (this.isSuspended) return;
    this.resumeOnShow = this.isPlaying;
    this.isSuspended = true;
    this.pause({ preserveResumeOnShow: true });
  }

  async resume() {
    if (!this.isSuspended) return;
    const shouldResume = this.resumeOnShow;
    this.isSuspended = false;
    this.resumeOnShow = false;
    if (shouldResume) await this.play();
    else this.emit();
  }

  retry() {
    return this.currentTrack
      ? this.selectTrack(this.currentTrack.id, {
          autoplay: true,
          forceRefresh: true,
        })
      : false;
  }

  bindMediaEvents() {
    this.mediaLayers.forEach((media) => {
      const handlers = {
        timeupdate: () => {
          if (media === this.activeMedia) this.emitProgress();
        },
        durationchange: () => {
          if (media === this.activeMedia) this.emit();
        },
        ended: () => {
          if (media === this.activeMedia) void this.next({ fromEnded: true });
        },
        error: () => {
        if (media !== this.activeMedia) return;
        this.isPlaying = false;
        this.isStopped = true;
        this.isLoading = false;
        this.loadingTrackId = null;
        this.stopProgressFrames();
        this.error = {
          code: "MEDIA_LOAD_FAILED",
          message: "Unable to play this media file",
        };
        this.emit();
        },
      };
      Object.entries(handlers).forEach(([eventName, handler]) =>
        media.addEventListener(eventName, handler),
      );
      this.mediaEventHandlers.set(media, handlers);
    });
  }

  applyVolume() {
    this.mediaLayers.forEach((media, index) => {
      media.muted = this.muted || index !== this.activeLayerIndex;
      media.volume = index === this.activeLayerIndex ? this.volume : 0;
    });
  }

  startProgressFrames() {
    if (this.animationFrame !== null) return;
    const tick = (timestamp = performance.now()) => {
      if (!this.isPlaying || this.isSuspended) {
        this.animationFrame = null;
        return;
      }
      this.emitProgress(timestamp);
      this.animationFrame = requestAnimationFrame(tick);
    };
    this.animationFrame = requestAnimationFrame(tick);
  }

  emitProgress(timestamp = performance.now()) {
    if (timestamp - this.lastProgressEmitAt < 125) return;
    this.lastProgressEmitAt = timestamp;
    this.emit();
  }

  stopProgressFrames() {
    if (this.animationFrame === null) return;
    cancelAnimationFrame(this.animationFrame);
    this.animationFrame = null;
  }

  dispose() {
    this.selectionVersion += 1;
    this.isPlaying = false;
    this.isStopped = true;
    this.isLoading = false;
    this.loadingTrackId = null;
    this.resumeOnShow = false;
    this.stopProgressFrames();
    this.mediaLayers.forEach((media) => {
      const handlers = this.mediaEventHandlers.get(media) || {};
      Object.entries(handlers).forEach(([eventName, handler]) =>
        media.removeEventListener(eventName, handler),
      );
      safeMediaCall(media, "pause");
      this.releaseLayer(this.mediaLayers.indexOf(media));
      safeMediaCall(media, "load");
    });
    this.mediaEventHandlers.clear();
    this.listeners.clear();
  }
}

export default PlaybackController;
