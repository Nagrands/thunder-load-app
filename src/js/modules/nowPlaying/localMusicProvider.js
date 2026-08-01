const LOCAL_PROVIDER_ID = "local";
const HLS_FALLBACK_EXTENSIONS = new Set(["avi", "mpeg", "mpg"]);
const NATIVE_MULTI_AUDIO_CODECS = new Set([
  "aac",
  "alac",
  "flac",
  "mp3",
  "opus",
  "pcm_f32le",
  "pcm_s16le",
  "pcm_s24le",
  "pcm_s32le",
  "vorbis",
]);
const VIDEO_EXTENSIONS = new Set([
  "avi",
  "m4v",
  "mkv",
  "mov",
  "mp4",
  "mpeg",
  "mpg",
  "ogv",
  "webm",
]);

function unwrapResult(result) {
  if (result?.success === false) {
    const error = new Error(
      result.error?.message || "Now Playing operation failed",
    );
    error.code = result.error?.code || "NOW_PLAYING_ERROR";
    throw error;
  }
  return result?.data ?? result ?? {};
}

function extractTracks(payload) {
  if (Array.isArray(payload)) return payload;
  if (Array.isArray(payload?.tracks)) return payload.tracks;
  if (Array.isArray(payload?.playlist?.tracks)) return payload.playlist.tracks;
  return [];
}

function getExtension(value = "") {
  const clean = String(value).split(/[?#]/, 1)[0];
  const index = clean.lastIndexOf(".");
  return index === -1 ? "" : clean.slice(index + 1).toLowerCase();
}

function getFallbackTitle(sourceRef = "") {
  const normalized = String(sourceRef).replaceAll("\\", "/");
  const filename = normalized.slice(normalized.lastIndexOf("/") + 1);
  return filename.replace(/\.[^.]+$/, "") || "Unknown track";
}

function normalizeSourceKey(value = "") {
  const normalized = String(value).replaceAll("\\", "/");
  return /^[A-Z]:/i.test(normalized) ? normalized.toLowerCase() : normalized;
}

function pathToFileUrl(sourceRef = "") {
  const value = String(sourceRef);
  if (/^(file|blob|data|https?):/i.test(value)) return value;
  const normalized = value.replaceAll("\\", "/");
  const prefixed = normalized.startsWith("/") ? normalized : `/${normalized}`;
  return encodeURI(`file://${prefixed}`).replaceAll("#", "%23");
}

function normalizeMediaInfo(value) {
  const source = value && typeof value === "object" ? value : {};
  return {
    width: Math.max(0, Math.trunc(Number(source.width) || 0)),
    height: Math.max(0, Math.trunc(Number(source.height) || 0)),
    container: String(source.container || ""),
    videoCodec: String(source.videoCodec || ""),
    audioCodec: String(source.audioCodec || ""),
  };
}

function requiresMultiAudioFallback(tracks = []) {
  return (
    tracks.length > 1 &&
    tracks.some((track) => {
      const codec = String(track?.codec || "").toLowerCase();
      return codec && !NATIVE_MULTI_AUDIO_CODECS.has(codec);
    })
  );
}

export function normalizeLocalTrack(track = {}, index = 0) {
  const sourceRef = String(
    track.sourceRef || track.filePath || track.path || "",
  );
  const extension = getExtension(sourceRef);
  const duration = Number(track.duration);
  const title = String(track.title || getFallbackTitle(sourceRef));
  const sizeBytes = Number(track.sizeBytes);
  return {
    id: String(track.id || `${LOCAL_PROVIDER_ID}:${sourceRef || index}`),
    providerId: LOCAL_PROVIDER_ID,
    sourceRef,
    title,
    displayTitle: String(track.displayTitle || title),
    artist: String(track.artist || ""),
    album: String(track.album || ""),
    duration: Number.isFinite(duration) && duration >= 0 ? duration : 0,
    artworkUrl: String(track.artworkUrl || track.posterUrl || ""),
    kind:
      track.kind === "video" || VIDEO_EXTENSIONS.has(extension)
        ? "video"
        : "audio",
    availability:
      track.availability === "missing" || track.available === false
        ? "missing"
        : "available",
    mimeType: String(track.mimeType || ""),
    sizeBytes:
      Number.isFinite(sizeBytes) && sizeBytes >= 0 ? Math.trunc(sizeBytes) : 0,
    mediaInfo: normalizeMediaInfo(track.mediaInfo),
    qualitySelection: null,
    selectedAudioTrackId: /^audio-(?:0|[1-9]\d{0,2})$/.test(
      track.selectedAudioTrackId,
    )
      ? track.selectedAudioTrackId
      : null,
    playback: track.playback || null,
  };
}

export class LocalMusicProvider {
  constructor(api = window.electron?.nowPlaying) {
    if (!api) throw new Error("Now Playing preload API is unavailable");
    this.id = LOCAL_PROVIDER_ID;
    this.api = api;
    this.tracks = [];
  }

  async importSource(input = "files") {
    const method = input === "folder" ? "importFolder" : "importFiles";
    if (typeof this.api[method] !== "function") {
      throw new Error(`Now Playing preload API does not implement ${method}()`);
    }
    const payload = unwrapResult(await this.api[method]());
    const importedTracks = extractTracks(payload);
    const playlist = this.mergeTracks(importedTracks);
    return {
      ...playlist,
      canceled: payload?.canceled === true,
      importedTrackIds: Array.isArray(payload?.importedTrackIds)
        ? payload.importedTrackIds.map(String)
        : importedTracks.map(
            (track, index) => normalizeLocalTrack(track, index).id,
          ),
      playlistImports: Array.isArray(payload?.playlistImports)
        ? payload.playlistImports.map((playlist) => ({ ...playlist }))
        : [],
      folderName:
        input === "folder" ? String(payload?.folderName || "").trim() : "",
      folderTrackIds:
        input === "folder" && Array.isArray(payload?.folderTrackIds)
          ? payload.folderTrackIds.map(String)
          : [],
      warnings: Array.isArray(payload?.warnings)
        ? payload.warnings.map((warning) => ({ ...warning }))
        : [],
    };
  }

  restore(descriptor = {}) {
    const tracks = extractTracks(descriptor);
    this.tracks = this.dedupeTracks(tracks);
    return this.createPlaylist();
  }

  mergeTracks(tracks = []) {
    this.tracks = this.dedupeTracks([...this.tracks, ...tracks]);
    return this.createPlaylist();
  }

  removeTrack(trackId) {
    this.tracks = this.tracks.filter((track) => track.id !== trackId);
    return this.createPlaylist();
  }

  clear() {
    this.tracks = [];
    return this.createPlaylist();
  }

  createPlaylist() {
    return {
      id: "local-library",
      providerId: this.id,
      title: "Local library",
      sourceDescriptor: { tracks: this.tracks.map((track) => ({ ...track })) },
      tracks: this.tracks.map((track) => ({ ...track })),
    };
  }

  async resolveTrack(track, options = {}) {
    const normalized = normalizeLocalTrack(track);
    if (normalized.availability !== "available") {
      const error = new Error("Track file is unavailable");
      error.code = "TRACK_UNAVAILABLE";
      throw error;
    }
    const playback = track?.playback || {};
    const extension = getExtension(normalized.sourceRef);
    const requestedStartTime = Math.max(0, Number(options.startTime) || 0);
    let audioTracks = [];
    if (typeof this.api.getAudioTracks === "function") {
      try {
        const payload = unwrapResult(
          await this.api.getAudioTracks({ trackId: normalized.id }),
        );
        audioTracks = Array.isArray(payload.tracks) ? payload.tracks : [];
      } catch {
        // Track probing is optional for ordinary direct playback.
      }
    }
    if (
      requiresMultiAudioFallback(audioTracks) &&
      typeof this.api.createLocalPlaybackSession === "function"
    ) {
      const request = {
        trackId: normalized.id,
        includeAudioTracks: true,
      };
      if (requestedStartTime > 0) request.startTime = requestedStartTime;
      const descriptor = unwrapResult(
        await this.api.createLocalPlaybackSession(request),
      );
      if (descriptor?.hlsAudioTrackSelection) {
        descriptor.hlsAudioTrackSelection.selectedAudioTrackId =
          audioTracks.some(
            (audioTrack) => audioTrack.id === normalized.selectedAudioTrackId,
          )
            ? normalized.selectedAudioTrackId
            : null;
      }
      return descriptor;
    }
    if (
      HLS_FALLBACK_EXTENSIONS.has(extension) &&
      typeof this.api.createLocalPlaybackSession === "function"
    ) {
      const request = { trackId: normalized.id };
      if (requestedStartTime > 0) request.startTime = requestedStartTime;
      return unwrapResult(await this.api.createLocalPlaybackSession(request));
    }
    const descriptor = {
      src: String(
        playback.src || track?.src || pathToFileUrl(track?.sourceRef),
      ),
      mimeType: String(playback.mimeType || track?.mimeType || ""),
      posterUrl: String(playback.posterUrl || track?.artworkUrl || ""),
    };
    if (
      normalized.selectedAudioTrackId &&
      audioTracks.some(
        (audioTrack) => audioTrack.id === normalized.selectedAudioTrackId,
      )
    ) {
      descriptor.nativeAudioTrackSelection = {
        selectedAudioTrackId: normalized.selectedAudioTrackId,
        tracks: audioTracks,
      };
    }
    return descriptor;
  }

  releasePlayback(playback = {}) {
    if (
      playback.sessionId &&
      typeof this.api.closePlaybackSession === "function"
    ) {
      return this.api.closePlaybackSession(playback.sessionId);
    }
    return undefined;
  }

  dedupeTracks(tracks) {
    const seen = new Set();
    return tracks.reduce((result, track, index) => {
      const normalized = normalizeLocalTrack(track, index);
      const key = normalizeSourceKey(normalized.sourceRef) || normalized.id;
      if (seen.has(key)) return result;
      seen.add(key);
      result.push(normalized);
      return result;
    }, []);
  }

  dispose() {
    this.tracks = [];
  }
}

export default LocalMusicProvider;
