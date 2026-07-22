const ACTIONS = [
  "play",
  "pause",
  "nexttrack",
  "previoustrack",
  "seekto",
  "seekbackward",
  "seekforward",
  "stop",
];
const DEFAULT_SEEK_OFFSET = 10;
const POSITION_UPDATE_INTERVAL = 1000;
const FALLBACK_ARTWORK_PATH = "../assets/icons/app/app-icon-512.png";

function runSafely(operation) {
  try {
    operation();
    return true;
  } catch {
    return false;
  }
}

function invokeController(operation) {
  try {
    const result = operation();
    if (result && typeof result.catch === "function") {
      void result.catch(() => {});
    }
  } catch {
    // System controls must not break playback when a command is unavailable.
  }
}

function clamp(value, min, max) {
  return Math.min(max, Math.max(min, Number(value) || 0));
}

function getDefaultMediaSession() {
  try {
    return globalThis.navigator?.mediaSession || null;
  } catch {
    return null;
  }
}

function getDefaultMetadataConstructor() {
  try {
    return globalThis.MediaMetadata || null;
  } catch {
    return null;
  }
}

function getFallbackArtworkUrl() {
  try {
    return new URL(FALLBACK_ARTWORK_PATH, globalThis.document?.baseURI).href;
  } catch {
    return FALLBACK_ARTWORK_PATH;
  }
}

function createArtwork(track, fallbackArtworkUrl) {
  const src = String(track?.artworkUrl || "").trim();
  if (src) return [{ src }];
  return [
    {
      src: fallbackArtworkUrl,
      sizes: "512x512",
      type: "image/png",
    },
  ];
}

function getMetadataSignature(track) {
  return JSON.stringify([
    track?.id || "",
    track?.displayTitle || track?.title || "",
    track?.artist || "",
    track?.album || "",
    track?.artworkUrl || "",
  ]);
}

export class MediaSessionManager {
  constructor({
    controller,
    mediaSession = getDefaultMediaSession(),
    Metadata = getDefaultMetadataConstructor(),
    now = () => Date.now(),
    fallbackArtworkUrl = getFallbackArtworkUrl(),
  } = {}) {
    if (!controller) {
      throw new TypeError("MediaSessionManager requires a controller");
    }
    this.controller = controller;
    this.mediaSession = mediaSession;
    this.Metadata = Metadata;
    this.now = now;
    this.fallbackArtworkUrl = fallbackArtworkUrl;
    this.disposed = false;
    this.metadataSignature = null;
    this.trackId = null;
    this.playbackState = "none";
    this.lastDuration = null;
    this.lastPosition = null;
    this.lastPositionUpdate = -Infinity;
    this.forcePositionUpdate = false;
    this.positionRevision = null;
    this.registerActionHandlers();
  }

  registerActionHandlers() {
    if (!this.mediaSession?.setActionHandler) return;
    const handlers = {
      play: () => invokeController(() => this.controller.play()),
      pause: () => invokeController(() => this.controller.pause()),
      nexttrack: () => invokeController(() => this.controller.next()),
      previoustrack: () => invokeController(() => this.controller.previous()),
      seekto: (details) => this.seekTo(details?.seekTime),
      seekbackward: (details) =>
        this.seekBy(-this.getSeekOffset(details?.seekOffset)),
      seekforward: (details) =>
        this.seekBy(this.getSeekOffset(details?.seekOffset)),
      stop: () => invokeController(() => this.controller.stop()),
    };
    ACTIONS.forEach((action) => {
      runSafely(() =>
        this.mediaSession.setActionHandler(action, handlers[action]),
      );
    });
  }

  getSeekOffset(value) {
    const offset = Number(value);
    return Number.isFinite(offset) && offset > 0 ? offset : DEFAULT_SEEK_OFFSET;
  }

  seekBy(offset) {
    const snapshot = this.controller.getSnapshot?.() || {};
    this.seekTo((Number(snapshot.currentTime) || 0) + offset);
  }

  seekTo(value) {
    const seekTime = Number(value);
    if (!Number.isFinite(seekTime)) return;
    const snapshot = this.controller.getSnapshot?.() || {};
    const duration = Number(snapshot.duration);
    const position =
      Number.isFinite(duration) && duration > 0
        ? clamp(seekTime, 0, duration)
        : Math.max(0, seekTime);
    this.forcePositionUpdate = true;
    invokeController(() => this.controller.seek(position));
    const nextSnapshot = this.controller.getSnapshot?.();
    if (nextSnapshot) this.sync(nextSnapshot);
  }

  sync(snapshot = {}) {
    if (this.disposed || !this.mediaSession) return;
    const track = snapshot.currentTrack;
    if (!track || snapshot.isStopped === true) {
      this.clearSession();
      return;
    }

    const signature = getMetadataSignature(track);
    const trackId = String(track.id || signature);
    const trackChanged = trackId !== this.trackId;
    if (signature !== this.metadataSignature) {
      this.updateMetadata(track);
      this.metadataSignature = signature;
    }

    const playbackState = snapshot.isPlaying ? "playing" : "paused";
    const playbackChanged = playbackState !== this.playbackState;
    const positionChangedByCommand =
      snapshot.positionRevision !== undefined &&
      snapshot.positionRevision !== this.positionRevision;
    if (playbackChanged) {
      runSafely(() => {
        this.mediaSession.playbackState = playbackState;
      });
      this.playbackState = playbackState;
    }

    this.updatePosition(snapshot, {
      immediate:
        trackChanged ||
        playbackChanged ||
        positionChangedByCommand ||
        this.forcePositionUpdate,
    });
    this.forcePositionUpdate = false;
    this.trackId = trackId;
    this.positionRevision = snapshot.positionRevision;
  }

  updateMetadata(track) {
    if (typeof this.Metadata !== "function") return;
    runSafely(() => {
      this.mediaSession.metadata = new this.Metadata({
        title: String(track.displayTitle || track.title || ""),
        artist: String(track.artist || ""),
        album: String(track.album || ""),
        artwork: createArtwork(track, this.fallbackArtworkUrl),
      });
    });
  }

  updatePosition(snapshot, { immediate = false } = {}) {
    const duration = Number(snapshot.duration);
    if (!Number.isFinite(duration) || duration <= 0) {
      this.lastDuration = null;
      this.lastPosition = null;
      return;
    }

    const position = clamp(snapshot.currentTime, 0, duration);
    const currentTime = this.now();
    const durationChanged = duration !== this.lastDuration;
    const positionChanged = position !== this.lastPosition;
    const intervalElapsed =
      currentTime - this.lastPositionUpdate >= POSITION_UPDATE_INTERVAL;
    const shouldUpdate =
      immediate ||
      durationChanged ||
      (positionChanged && (snapshot.isPlaying !== true || intervalElapsed));

    this.lastDuration = duration;
    this.lastPosition = position;
    if (!shouldUpdate || !this.mediaSession.setPositionState) return;
    if (
      runSafely(() =>
        this.mediaSession.setPositionState({
          duration,
          position,
          playbackRate: 1,
        }),
      )
    ) {
      this.lastPositionUpdate = currentTime;
    }
  }

  clearSession() {
    runSafely(() => {
      this.mediaSession.metadata = null;
    });
    runSafely(() => {
      this.mediaSession.playbackState = "none";
    });
    if (this.mediaSession?.setPositionState) {
      runSafely(() => this.mediaSession.setPositionState());
    }
    this.metadataSignature = null;
    this.trackId = null;
    this.playbackState = "none";
    this.lastDuration = null;
    this.lastPosition = null;
    this.lastPositionUpdate = -Infinity;
    this.forcePositionUpdate = false;
    this.positionRevision = null;
  }

  dispose() {
    if (this.disposed) return;
    this.clearSession();
    if (this.mediaSession?.setActionHandler) {
      ACTIONS.forEach((action) => {
        runSafely(() => this.mediaSession.setActionHandler(action, null));
      });
    }
    this.disposed = true;
  }
}

export function createMediaSessionManager(options) {
  return new MediaSessionManager(options);
}

export default createMediaSessionManager;
