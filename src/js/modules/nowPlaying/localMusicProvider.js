const LOCAL_PROVIDER_ID = "local";
const VIDEO_EXTENSIONS = new Set(["mp4", "m4v", "webm", "mov", "ogv", "mkv"]);

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

export function normalizeLocalTrack(track = {}, index = 0) {
  const sourceRef = String(
    track.sourceRef || track.filePath || track.path || "",
  );
  const extension = getExtension(sourceRef);
  const duration = Number(track.duration);
  return {
    id: String(track.id || `${LOCAL_PROVIDER_ID}:${sourceRef || index}`),
    providerId: LOCAL_PROVIDER_ID,
    sourceRef,
    title: String(track.title || getFallbackTitle(sourceRef)),
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
    return this.mergeTracks(extractTracks(payload));
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

  async resolveTrack(track) {
    const normalized = normalizeLocalTrack(track);
    if (normalized.availability !== "available") {
      const error = new Error("Track file is unavailable");
      error.code = "TRACK_UNAVAILABLE";
      throw error;
    }
    const playback = track?.playback || {};
    return {
      src: String(
        playback.src || track?.src || pathToFileUrl(track?.sourceRef),
      ),
      mimeType: String(playback.mimeType || track?.mimeType || ""),
      posterUrl: String(playback.posterUrl || track?.artworkUrl || ""),
    };
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
