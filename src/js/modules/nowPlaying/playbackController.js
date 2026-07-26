import {
  getActiveTracksFromState,
  normalizeMediaLibraryState,
} from "./mediaLibraryModel.js";

const REPEAT_MODES = new Set(["off", "all", "one"]);
const HLS_START_TIMEOUT_MS = 15_000;
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

function isInterruptedPlayError(error) {
  return (
    error?.name === "AbortError" &&
    /interrupted by a new load request/i.test(String(error?.message || ""))
  );
}

export class PlaybackController {
  constructor({
    providers,
    mediaLayers,
    random = Math.random,
    lifecycleLog = null,
    hlsLoader = loadHlsConstructor,
  }) {
    if (!providers || !Array.isArray(mediaLayers) || mediaLayers.length !== 2) {
      throw new TypeError(
        "PlaybackController requires providers and two media layers",
      );
    }
    this.providers = providers;
    this.mediaLayers = mediaLayers;
    this.random = random;
    this.hlsLoader = hlsLoader;
    this.lifecycleLog =
      typeof lifecycleLog === "function" ? lifecycleLog : null;
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
    this.playbackSession = null;
    this.disposed = false;
    this.animationFrame = null;
    this.lastProgressEmitAt = 0;
    this.queueSnapshot = [];
    this.mediaEventHandlers = new Map();
    this.pendingStartTimes = new WeakMap();
    this.layerPlaybacks = [null, null];
    this.hlsInstances = [null, null];
    this.pendingReleases = new Set();
    this.bindMediaEvents();
    this.applyVolume();
    this.trace("controller-created");
  }

  trace(event, details = {}) {
    this.lifecycleLog?.(`[now-playing] ${event}`, details);
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
    let bufferedEnd = 0;
    try {
      if (media?.buffered?.length) {
        bufferedEnd = Number(media.buffered.end(media.buffered.length - 1)) || 0;
      }
    } catch {
      bufferedEnd = 0;
    }
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
      bufferedEnd,
      error: this.error,
    };
  }

  getPreviewContext() {
    const playback = this.layerPlaybacks[this.activeLayerIndex]?.playback;
    return {
      sessionId: String(playback?.sessionId || ""),
      trackId: String(this.currentTrack?.id || ""),
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
      this.cancelPlaybackSession();
      this.quiesceMediaLayers({ resetPosition: true });
      void this.releaseAllLayers();
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

  async selectTrack(
    trackId,
    { autoplay = true, forceRefresh = false, startTime = 0 } = {},
  ) {
    if (this.disposed) return false;
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
    if (
      !forceRefresh &&
      !this.isLoading &&
      this.currentTrack?.id === track.id &&
      this.activeMedia?.dataset.trackId === track.id &&
      this.layerPlaybacks[this.activeLayerIndex]?.playback
    ) {
      return autoplay && !this.isSuspended ? this.play() : true;
    }

    const session = this.createPlaybackSession();
    const version = session.id;
    this.trace("loading-started", { sessionId: version, trackId: track.id });
    this.quiesceMediaLayers();
    this.stopProgressFrames();
    this.currentIndex = index;
    this.isPlaying = false;
    this.isLoading = true;
    this.loadingTrackId = track.id;
    this.error = null;
    this.emit();
    try {
      const releasePending = this.releaseAllLayers();
      if (releasePending) await releasePending;
      if (!this.isCurrentSession(session)) return false;
      const playback = await this.providers.resolveTrack(track, {
        forceRefresh,
        signal: session.controller.signal,
      });
      if (!this.isCurrentSession(session)) {
        this.trace("stale-playback-released", {
          sessionId: version,
          trackId: track.id,
        });
        await this.providers.releasePlayback?.(track, playback);
        return false;
      }
      await this.loadPlayback(track, playback, session, { startTime });
      if (!this.isCurrentSession(session)) return false;
      this.trace("loading-completed", {
        sessionId: version,
        trackId: track.id,
      });
      if (autoplay && !this.isSuspended) {
        return this.play({ selectionVersion: version });
      } else {
        this.isLoading = false;
        this.loadingTrackId = null;
        this.emit();
      }
      return true;
    } catch (error) {
      if (!this.isCurrentSession(session)) return false;
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

  async loadPlayback(track, playback, session, { startTime = 0 } = {}) {
    const nextLayerIndex = this.activeLayerIndex === 0 ? 1 : 0;
    const nextMedia = this.mediaLayers[nextLayerIndex];
    const releasePending = this.releaseLayer(nextLayerIndex);
    if (releasePending) await releasePending;
    if (!this.isCurrentSession(session)) {
      await this.providers.releasePlayback?.(track, playback);
      return false;
    }
    const playbackKey = this.getPlaybackKey(track);
    nextMedia.dataset.playbackKey = playbackKey;
    nextMedia.dataset.trackId = track.id;
    nextMedia.dataset.kind = track.kind;
    nextMedia.poster = playback.posterUrl || track.artworkUrl || "";
    nextMedia.currentTime = 0;
    this.layerPlaybacks[nextLayerIndex] = { playback, track };
    const normalizedStartTime = Math.max(0, Number(startTime) || 0);
    if (normalizedStartTime > 0) {
      this.pendingStartTimes.set(nextMedia, {
        selectionVersion: session.id,
        time: normalizedStartTime,
      });
      this.applyPendingStartTime(nextMedia, { retain: true });
    }
    const Hls = playback.kind === "hls" ? await this.hlsLoader() : null;
    if (!this.isCurrentSession(session)) {
      await this.releaseLayer(nextLayerIndex);
      return false;
    }
    if (Hls?.isSupported()) {
      const hls = new Hls({
        backBufferLength: 30,
        maxBufferLength: 45,
        maxMaxBufferLength: 90,
      });
      this.hlsInstances[nextLayerIndex] = hls;
      await this.waitForHlsReady({
        Hls,
        hls,
        media: nextMedia,
        src: playback.src,
        session,
      });
      if (!this.isCurrentSession(session)) {
        await this.releaseLayer(nextLayerIndex);
        return false;
      }
      this.applyPendingStartTime(nextMedia);
    } else {
      nextMedia.src = playback.src;
      safeMediaCall(nextMedia, "load");
    }
    this.activeLayerIndex = nextLayerIndex;
    this.applyVolume();
    this.emit();
    return true;
  }

  waitForHlsReady({ Hls, hls, media, src, session }) {
    return new Promise((resolve, reject) => {
      let settled = false;
      let manifestReady = false;
      let metadataReady = Number(media.readyState) >= 1;
      const signal = session.controller.signal;
      const tryFinish = () => {
        if (manifestReady && metadataReady) finish();
      };
      const finish = (error = null) => {
        if (settled) return;
        settled = true;
        clearTimeout(timeout);
        signal.removeEventListener("abort", handleAbort);
        media.removeEventListener("loadedmetadata", handleLoadedMetadata);
        hls.off(Hls.Events.MEDIA_ATTACHED, handleMediaAttached);
        hls.off(Hls.Events.MANIFEST_PARSED, handleManifestParsed);
        hls.off(Hls.Events.ERROR, handleError);
        if (error) reject(error);
        else resolve();
      };
      const createError = (code, message) =>
        Object.assign(new Error(message), { code });
      const handleAbort = () =>
        finish(
          createError(
            "PLAYBACK_SESSION_CANCELLED",
            "Playback session was cancelled",
          ),
        );
      const handleMediaAttached = () => {
        if (!this.isCurrentSession(session)) {
          handleAbort();
          return;
        }
        hls.loadSource(src);
      };
      const handleManifestParsed = () => {
        manifestReady = true;
        tryFinish();
      };
      const handleLoadedMetadata = () => {
        metadataReady = true;
        tryFinish();
      };
      const handleError = (_event, data = {}) => {
        if (!data.fatal) return;
        finish(
          createError(
            "HLS_LOAD_FAILED",
            data.details || "Unable to prepare the media stream",
          ),
        );
      };
      const timeout = setTimeout(
        () =>
          finish(
            createError(
              "HLS_LOAD_TIMEOUT",
              "Timed out while preparing the media stream",
            ),
          ),
        HLS_START_TIMEOUT_MS,
      );

      hls.on(Hls.Events.MEDIA_ATTACHED, handleMediaAttached);
      hls.on(Hls.Events.MANIFEST_PARSED, handleManifestParsed);
      hls.on(Hls.Events.ERROR, handleError);
      media.addEventListener("loadedmetadata", handleLoadedMetadata);
      signal.addEventListener("abort", handleAbort, { once: true });
      hls.attachMedia(media);
    });
  }

  isActivePlaybackPrepared() {
    const index = this.activeLayerIndex;
    const media = this.mediaLayers[index];
    const record = this.layerPlaybacks[index];
    if (
      !record?.playback ||
      record.track?.id !== this.currentTrack?.id ||
      media?.dataset.trackId !== this.currentTrack?.id
    ) {
      return false;
    }
    return record.playback.kind === "hls"
      ? Boolean(this.hlsInstances[index])
      : Boolean(media.src);
  }

  waitForPlaybackReady(media, session) {
    if (Number(media.readyState) >= 3) return Promise.resolve();
    return new Promise((resolve, reject) => {
      let settled = false;
      const signal = session?.controller.signal;
      const finish = (error = null) => {
        if (settled) return;
        settled = true;
        clearTimeout(timeout);
        media.removeEventListener("canplay", handleCanPlay);
        media.removeEventListener("error", handleMediaError);
        signal?.removeEventListener("abort", handleAbort);
        if (error) reject(error);
        else resolve();
      };
      const handleCanPlay = () => finish();
      const handleMediaError = () =>
        finish(
          Object.assign(new Error("Unable to resume media playback"), {
            code: "PLAYBACK_RESTART_FAILED",
          }),
        );
      const handleAbort = () =>
        finish(
          Object.assign(new Error("Playback session was cancelled"), {
            code: "PLAYBACK_SESSION_CANCELLED",
          }),
        );
      const timeout = setTimeout(
        () =>
          finish(
            Object.assign(new Error("Timed out resuming media playback"), {
              code: "PLAYBACK_RESTART_FAILED",
            }),
          ),
        HLS_START_TIMEOUT_MS,
      );
      media.addEventListener("canplay", handleCanPlay, { once: true });
      media.addEventListener("error", handleMediaError, { once: true });
      signal?.addEventListener("abort", handleAbort, { once: true });
    });
  }

  async play({ selectionVersion = null } = {}) {
    if (
      this.disposed ||
      !this.currentTrack ||
      (selectionVersion !== null &&
        selectionVersion !== this.selectionVersion)
    ) {
      return false;
    }
    if (!this.isActivePlaybackPrepared()) {
      return this.selectTrack(this.currentTrack.id, { autoplay: true });
    }
    const media = this.activeMedia;
    const playVersion = this.selectionVersion;
    const playbackSession = this.playbackSession;
    try {
      this.applyVolume();
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
      this.trace("playback-started", {
        sessionId: this.selectionVersion,
        trackId: this.currentTrack.id,
      });
      this.emit();
      return true;
    } catch (error) {
      if (
        isInterruptedPlayError(error) &&
        !this.disposed &&
        playVersion === this.selectionVersion &&
        media === this.activeMedia &&
        playbackSession === this.playbackSession
      ) {
        try {
          this.trace("playback-retry-waiting", {
            sessionId: playVersion,
            trackId: this.currentTrack?.id,
          });
          await this.waitForPlaybackReady(media, playbackSession);
          if (
            this.disposed ||
            playVersion !== this.selectionVersion ||
            media !== this.activeMedia ||
            playbackSession !== this.playbackSession
          ) {
            return false;
          }
          this.applyVolume();
          const retryResult = safeMediaCall(media, "play");
          if (retryResult && typeof retryResult.catch === "function") {
            await retryResult;
          }
          this.isPlaying = true;
          this.isStopped = false;
          this.isLoading = false;
          this.loadingTrackId = null;
          this.error = null;
          this.startProgressFrames();
          this.trace("playback-retry-completed", {
            sessionId: playVersion,
            trackId: this.currentTrack?.id,
          });
          this.emit();
          return true;
        } catch (retryError) {
          if (
            this.disposed ||
            playVersion !== this.selectionVersion ||
            media !== this.activeMedia ||
            playbackSession !== this.playbackSession
          ) {
            safeMediaCall(media, "pause");
            return false;
          }
          this.trace("playback-retry-failed", {
            sessionId: playVersion,
            trackId: this.currentTrack?.id,
            code: retryError?.code || retryError?.name || "UNKNOWN",
          });
          error = Object.assign(
            new Error("Unable to resume playback after changing media source"),
            { code: "PLAYBACK_RESTART_FAILED" },
          );
        }
      }
      if (
        this.disposed ||
        playVersion !== this.selectionVersion ||
        media !== this.activeMedia
      ) {
        safeMediaCall(media, "pause");
        return false;
      }
      this.isPlaying = false;
      this.isStopped = true;
      this.isLoading = false;
      this.loadingTrackId = null;
      this.error = {
        code: error?.code || "PLAYBACK_BLOCKED",
        message: error?.message || "Playback was blocked",
      };
      this.emit();
      return false;
    }
  }

  pause({ preserveResumeOnShow = false } = {}) {
    if (this.isLoading) this.cancelPlaybackSession();
    this.quiesceMediaLayers();
    this.isPlaying = false;
    this.isLoading = false;
    this.loadingTrackId = null;
    if (!preserveResumeOnShow) this.resumeOnShow = false;
    this.stopProgressFrames();
    this.emit();
  }

  stop() {
    this.trace("playback-stopping", {
      sessionId: this.selectionVersion,
      trackId: this.currentTrack?.id || null,
    });
    this.cancelPlaybackSession();
    this.quiesceMediaLayers({ resetPosition: true });
    void this.releaseAllLayers();
    this.isPlaying = false;
    this.isStopped = true;
    this.isLoading = false;
    this.loadingTrackId = null;
    this.resumeOnShow = false;
    this.stopProgressFrames();
    this.emit();
  }

  closeCurrent() {
    if (!this.currentTrack && !this.isLoading) return false;
    this.trace("playback-closing", {
      sessionId: this.selectionVersion,
      trackId: this.currentTrack?.id || null,
    });
    this.cancelPlaybackSession();
    this.quiesceMediaLayers({ resetPosition: true });
    void this.releaseAllLayers();
    this.currentIndex = -1;
    if (this.libraryState) this.libraryState.selectedTrackId = null;
    this.isPlaying = false;
    this.isStopped = true;
    this.isLoading = false;
    this.loadingTrackId = null;
    this.resumeOnShow = false;
    this.error = null;
    this.stopProgressFrames();
    this.emit();
    return true;
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
    return this.applyPlaybackSettings({
      volume: clamp(value, 0, 1),
      muted: clamp(value, 0, 1) === 0,
    });
  }

  toggleMute() {
    return this.setMuted(!this.muted);
  }

  setMuted(value) {
    return this.applyPlaybackSettings({ muted: value === true });
  }

  toggleShuffle() {
    return this.setShuffle(!this.shuffle);
  }

  setShuffle(value) {
    return this.applyPlaybackSettings({ shuffle: value === true });
  }

  cycleRepeat() {
    return this.setRepeat(
      this.repeat === "off" ? "one" : this.repeat === "one" ? "all" : "off",
    );
  }

  setRepeat(value) {
    return this.applyPlaybackSettings({
      repeat: REPEAT_MODES.has(value) ? value : "off",
    });
  }

  applyPlaybackSettings(settings = {}) {
    let changed = false;
    let volumeChanged = false;
    if ("volume" in settings) {
      const volume = clamp(settings.volume, 0, 1);
      if (volume !== this.volume) {
        this.volume = volume;
        changed = true;
        volumeChanged = true;
      }
    }
    if ("muted" in settings) {
      const muted = settings.muted === true;
      if (muted !== this.muted) {
        this.muted = muted;
        changed = true;
        volumeChanged = true;
      }
    }
    if ("shuffle" in settings) {
      const shuffle = settings.shuffle === true;
      if (shuffle !== this.shuffle) {
        this.shuffle = shuffle;
        changed = true;
      }
    }
    if ("repeat" in settings) {
      const repeat = REPEAT_MODES.has(settings.repeat) ? settings.repeat : "off";
      if (repeat !== this.repeat) {
        this.repeat = repeat;
        changed = true;
      }
    }
    if (!changed) return false;
    if (volumeChanged) this.applyVolume();
    this.emit();
    return true;
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
    this.pendingStartTimes.delete(media);
    safeMediaCall(media, "pause");
    media.muted = true;
    media.volume = 0;
    media.removeAttribute("src");
    safeMediaCall(media, "load");
    delete media.dataset.playbackKey;
    delete media.dataset.trackId;
    delete media.dataset.kind;
    if (record) {
      const releaseResult = this.providers.releasePlayback?.(
        record.track,
        record.playback,
      );
      const onReleased = () => {
        this.trace("resources-released", {
          layerIndex: index,
          trackId: record.track.id,
        });
      };
      if (releaseResult && typeof releaseResult.then === "function") {
        const pendingRelease = Promise.resolve(releaseResult)
          .then(onReleased)
          .finally(() => this.pendingReleases.delete(pendingRelease));
        this.pendingReleases.add(pendingRelease);
        return pendingRelease;
      }
      onReleased();
    }
    return null;
  }

  releaseAllLayers() {
    const pending = this.mediaLayers
      .map((_media, index) => this.releaseLayer(index))
      .filter(Boolean);
    this.pendingReleases.forEach((release) => pending.push(release));
    const uniquePending = [...new Set(pending)];
    return uniquePending.length ? Promise.all(uniquePending) : null;
  }

  quiesceMediaLayers({ resetPosition = false } = {}) {
    this.mediaLayers.forEach((media) => {
      safeMediaCall(media, "pause");
      media.muted = true;
      media.volume = 0;
      if (resetPosition) media.currentTime = 0;
    });
  }

  createPlaybackSession() {
    this.playbackSession?.controller.abort();
    const session = {
      id: ++this.selectionVersion,
      controller: new AbortController(),
    };
    this.playbackSession = session;
    return session;
  }

  cancelPlaybackSession() {
    this.selectionVersion += 1;
    this.playbackSession?.controller.abort();
    this.playbackSession = null;
  }

  isCurrentSession(session) {
    return (
      !this.disposed &&
      this.playbackSession === session &&
      !session.controller.signal.aborted &&
      session.id === this.selectionVersion
    );
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
        loadedmetadata: () => {
          this.applyPendingStartTime(media);
          if (media === this.activeMedia) this.emit();
        },
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

  applyPendingStartTime(media, { retain = false } = {}) {
    const pending = this.pendingStartTimes.get(media);
    if (
      !pending ||
      pending.selectionVersion !== this.selectionVersion ||
      media.dataset.trackId !== this.currentTrack?.id
    ) {
      if (pending) this.pendingStartTimes.delete(media);
      return false;
    }
    try {
      const duration =
        Number(media.duration) || Number(this.currentTrack?.duration) || 0;
      media.currentTime = duration
        ? Math.min(pending.time, Math.max(0, duration - 0.1))
        : pending.time;
      this.positionRevision += 1;
      if (!retain) this.pendingStartTimes.delete(media);
      return true;
    } catch {
      return false;
    }
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
    if (this.disposed) return;
    this.cancelPlaybackSession();
    this.disposed = true;
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
    });
    void this.releaseAllLayers();
    this.mediaEventHandlers.clear();
    this.listeners.clear();
    this.trace("controller-destroyed");
  }
}

export default PlaybackController;
