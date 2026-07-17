const REPEAT_MODES = new Set(["off", "all", "one"]);

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
    this.isSuspended = false;
    this.resumeOnShow = false;
    this.shuffle = false;
    this.repeat = "off";
    this.volume = 1;
    this.muted = false;
    this.error = null;
    this.selectionVersion = 0;
    this.animationFrame = null;
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
      queue: this.queue.map((track) => ({ ...track })),
      currentTrack: this.currentTrack ? { ...this.currentTrack } : null,
      currentIndex: this.currentIndex,
      activeLayerIndex: this.activeLayerIndex,
      isPlaying: this.isPlaying,
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
    const previousId = selectedTrackId || this.currentTrack?.id;
    this.queue = Array.isArray(tracks) ? [...tracks] : [];
    this.currentIndex = previousId
      ? this.queue.findIndex((track) => track.id === previousId)
      : -1;
    if (this.currentIndex < 0 && this.queue.length) this.currentIndex = 0;
    if (!this.queue.length) {
      safeMediaCall(this.activeMedia, "pause");
      this.isPlaying = false;
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
    this.setQueue(state.playlist?.tracks || state.tracks || [], {
      selectedTrackId: state.selectedTrackId,
    });
  }

  getPersistentState() {
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

  async selectTrack(trackId, { autoplay = true } = {}) {
    const index = this.queue.findIndex((track) => track.id === trackId);
    if (index === -1) return false;
    const track = this.queue[index];
    if (track.availability === "missing") {
      this.currentIndex = index;
      this.error = { code: "TRACK_UNAVAILABLE", message: "Track unavailable" };
      this.isPlaying = false;
      this.emit();
      return false;
    }

    const version = ++this.selectionVersion;
    this.currentIndex = index;
    this.error = null;
    this.emit();
    try {
      const playback = await this.providers.resolveTrack(track);
      if (version !== this.selectionVersion) return false;
      this.loadPlayback(track, playback);
      if (autoplay && !this.isSuspended) await this.play();
      else this.emit();
      return true;
    } catch (error) {
      if (version !== this.selectionVersion) return false;
      this.error = {
        code: error?.code || "MEDIA_LOAD_FAILED",
        message: error?.message || "Unable to load track",
      };
      this.isPlaying = false;
      this.emit();
      return false;
    }
  }

  loadPlayback(track, playback) {
    const previousMedia = this.activeMedia;
    const nextLayerIndex = this.activeLayerIndex === 0 ? 1 : 0;
    const nextMedia = this.mediaLayers[nextLayerIndex];
    safeMediaCall(previousMedia, "pause");
    previousMedia.volume = 0;
    nextMedia.src = playback.src;
    nextMedia.dataset.trackId = track.id;
    nextMedia.dataset.kind = track.kind;
    nextMedia.poster = playback.posterUrl || track.artworkUrl || "";
    nextMedia.currentTime = 0;
    safeMediaCall(nextMedia, "load");
    this.activeLayerIndex = nextLayerIndex;
    this.applyVolume();
    this.emit();
  }

  async play() {
    if (!this.currentTrack) return false;
    if (!this.activeMedia?.src) {
      return this.selectTrack(this.currentTrack.id, { autoplay: true });
    }
    try {
      const result = safeMediaCall(this.activeMedia, "play");
      if (result && typeof result.catch === "function") await result;
      this.isPlaying = true;
      this.error = null;
      this.startProgressFrames();
      this.emit();
      return true;
    } catch (error) {
      this.isPlaying = false;
      this.error = {
        code: "PLAYBACK_BLOCKED",
        message: error?.message || "Playback was blocked",
      };
      this.emit();
      return false;
    }
  }

  pause() {
    safeMediaCall(this.activeMedia, "pause");
    this.isPlaying = false;
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
      this.repeat === "off" ? "all" : this.repeat === "all" ? "one" : "off";
    this.emit();
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
    this.pause();
    this.seek(0);
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
    this.pause();
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
      ? this.selectTrack(this.currentTrack.id, { autoplay: true })
      : false;
  }

  bindMediaEvents() {
    this.mediaLayers.forEach((media) => {
      media.addEventListener("timeupdate", () => {
        if (media === this.activeMedia) this.emit();
      });
      media.addEventListener("durationchange", () => {
        if (media === this.activeMedia) this.emit();
      });
      media.addEventListener("ended", () => {
        if (media === this.activeMedia) void this.next({ fromEnded: true });
      });
      media.addEventListener("error", () => {
        if (media !== this.activeMedia) return;
        this.isPlaying = false;
        this.stopProgressFrames();
        this.error = {
          code: "MEDIA_LOAD_FAILED",
          message: "Unable to play this media file",
        };
        this.emit();
      });
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
    const tick = () => {
      if (!this.isPlaying || this.isSuspended) {
        this.animationFrame = null;
        return;
      }
      this.emit();
      this.animationFrame = requestAnimationFrame(tick);
    };
    this.animationFrame = requestAnimationFrame(tick);
  }

  stopProgressFrames() {
    if (this.animationFrame === null) return;
    cancelAnimationFrame(this.animationFrame);
    this.animationFrame = null;
  }

  dispose() {
    this.selectionVersion += 1;
    this.stopProgressFrames();
    this.mediaLayers.forEach((media) => {
      safeMediaCall(media, "pause");
      media.removeAttribute("src");
      safeMediaCall(media, "load");
    });
    this.listeners.clear();
  }
}

export default PlaybackController;
