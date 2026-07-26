const YOUTUBE_PROVIDER_ID = "youtube";
const YOUTUBE_HOSTS = new Set([
  "youtube.com",
  "www.youtube.com",
  "m.youtube.com",
  "music.youtube.com",
  "youtu.be",
]);

function createProviderError(code, message) {
  const error = new Error(message);
  error.code = code;
  return error;
}

function unwrapResult(result) {
  if (result?.success === false) {
    throw createProviderError(
      result.error?.code || "YOUTUBE_ERROR",
      result.error?.message || "YouTube operation failed",
    );
  }
  return result?.data ?? result ?? {};
}

function getTrackPayload(payload) {
  return payload?.track || payload;
}

export function getYouTubeVideoId(value = "") {
  try {
    const url = new URL(String(value));
    if (!YOUTUBE_HOSTS.has(url.hostname.toLowerCase())) return "";
    if (url.searchParams.has("list")) {
      throw createProviderError(
        "YOUTUBE_PLAYLIST_UNSUPPORTED",
        "YouTube playlist links are not supported",
      );
    }
    const parts = url.pathname.split("/").filter(Boolean);
    const videoId =
      url.hostname.toLowerCase() === "youtu.be"
        ? parts[0]
        : url.searchParams.get("v") ||
          (["shorts", "embed", "live"].includes(parts[0]) ? parts[1] : "");
    return /^[\w-]{6,64}$/.test(videoId || "") ? videoId : "";
  } catch (error) {
    if (error?.code === "YOUTUBE_PLAYLIST_UNSUPPORTED") throw error;
    return "";
  }
}

export function canonicalizeYouTubeUrl(value = "") {
  const videoId = getYouTubeVideoId(value);
  if (!videoId) {
    throw createProviderError(
      "INVALID_YOUTUBE_URL",
      "A valid YouTube video URL is required",
    );
  }
  return `https://www.youtube.com/watch?v=${videoId}`;
}

export function normalizeYouTubeTrack(track = {}) {
  const rawSource = String(
    track.sourceRef || track.webpageUrl || track.webpage_url || track.url || "",
  );
  const explicitVideoId = String(track.videoId || track.video_id || "");
  const canonicalUrl = explicitVideoId
    ? canonicalizeYouTubeUrl(
        `https://www.youtube.com/watch?v=${explicitVideoId}`,
      )
    : canonicalizeYouTubeUrl(rawSource);
  const videoId = getYouTubeVideoId(canonicalUrl);
  const duration = Number(track.duration);
  const kind =
    track.qualitySelection?.mode === "audio" || track.kind === "audio"
      ? "audio"
      : "video";
  return {
    id: `youtube:${videoId}`,
    providerId: YOUTUBE_PROVIDER_ID,
    sourceRef: canonicalUrl,
    title: String(track.title || "YouTube video"),
    artist: String(track.artist || track.channel || track.uploader || ""),
    album: String(track.album || "YouTube"),
    duration: Number.isFinite(duration) && duration >= 0 ? duration : 0,
    artworkUrl: String(
      track.artworkUrl || track.thumbnail || track.posterUrl || "",
    ),
    kind,
    availability:
      track.availability === "unavailable" ? "unavailable" : "available",
    mimeType: String(
      track.mimeType || (kind === "audio" ? "audio/mp4" : "video/mp4"),
    ),
    qualitySelection:
      track.qualitySelection && typeof track.qualitySelection === "object"
        ? { ...track.qualitySelection }
        : null,
    sizeBytes: Math.max(0, Number(track.sizeBytes) || 0),
    mediaInfo: {
      width: Math.max(0, Math.trunc(Number(track.mediaInfo?.width) || 0)),
      height: Math.max(0, Math.trunc(Number(track.mediaInfo?.height) || 0)),
      container: String(track.mediaInfo?.container || ""),
      videoCodec: String(track.mediaInfo?.videoCodec || ""),
      audioCodec: String(track.mediaInfo?.audioCodec || ""),
    },
  };
}

export class YouTubeProvider {
  constructor(api = window.electron?.nowPlaying) {
    if (!api) throw new Error("Now Playing preload API is unavailable");
    this.id = YOUTUBE_PROVIDER_ID;
    this.api = api;
    this.tracks = [];
  }

  async analyzeSource(input, options = {}) {
    if (typeof this.api.analyzeYouTubeVideo !== "function") {
      throw new Error(
        "Now Playing preload API does not implement analyzeYouTubeVideo()",
      );
    }
    const url = canonicalizeYouTubeUrl(input);
    return unwrapResult(await this.api.analyzeYouTubeVideo(url, options));
  }

  async importSource(input, options = {}) {
    if (typeof this.api.importYouTubeVideo !== "function") {
      throw new Error(
        "Now Playing preload API does not implement importYouTubeVideo()",
      );
    }
    const url = canonicalizeYouTubeUrl(input);
    const payload = unwrapResult(
      options.qualitySelection
        ? await this.api.importYouTubeVideo(url, options.qualitySelection)
        : await this.api.importYouTubeVideo(url),
    );
    const track = normalizeYouTubeTrack(getTrackPayload(payload));
    const existingIndex = this.tracks.findIndex((item) => item.id === track.id);
    if (existingIndex === -1) this.tracks.push(track);
    else this.tracks[existingIndex] = track;
    return { ...track };
  }

  restore(descriptor = {}) {
    const sourceTracks = Array.isArray(descriptor)
      ? descriptor
      : descriptor.tracks || [];
    const seen = new Set();
    this.tracks = sourceTracks.reduce((tracks, track) => {
      try {
        const normalized = normalizeYouTubeTrack(track);
        if (seen.has(normalized.id)) return tracks;
        seen.add(normalized.id);
        tracks.push(normalized);
      } catch {
        return tracks;
      }
      return tracks;
    }, []);
    return this.tracks.map((track) => ({ ...track }));
  }

  async resolveTrack(track, options = {}) {
    if (typeof this.api.resolveYouTubeTrack !== "function") {
      throw new Error(
        "Now Playing preload API does not implement resolveYouTubeTrack()",
      );
    }
    const normalized = normalizeYouTubeTrack(track);
    const resolveOptions = { forceRefresh: options.forceRefresh === true };
    if (normalized.qualitySelection) {
      resolveOptions.qualitySelection = normalized.qualitySelection;
    }
    const payload = unwrapResult(
      await this.api.resolveYouTubeTrack(normalized.sourceRef, resolveOptions),
    );
    const playback = payload.playback || payload;
    const src = String(playback.src || playback.url || "");
    if (!src) {
      throw createProviderError(
        "YOUTUBE_FORMAT_UNAVAILABLE",
        "No compatible YouTube playback format is available",
      );
    }
    const result = {
      src,
      mimeType: String(playback.mimeType || playback.mime_type || ""),
      posterUrl: String(
        playback.posterUrl || playback.thumbnail || normalized.artworkUrl || "",
      ),
    };
    if (playback.kind) result.kind = String(playback.kind);
    if (playback.sessionId) result.sessionId = String(playback.sessionId);
    return result;
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

  dispose() {
    this.tracks = [];
  }
}

export default YouTubeProvider;
