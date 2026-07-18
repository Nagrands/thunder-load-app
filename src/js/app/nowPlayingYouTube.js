const { classifyDownloadError } = require("./notifications");
const { selectYouTubeLivePreview } = require("./downloaderBackgroundPreview");
const { canonicalizeYouTubeUrl } = require("./nowPlayingState");

const MAX_YOUTUBE_URL_LENGTH = 2048;
const PLAYBACK_LEASE_TTL_MS = 90 * 1000;

function failure(code, message) {
  return { success: false, data: null, error: { code, message } };
}

function validateYouTubeUrl(value) {
  if (typeof value !== "string" || value.length > MAX_YOUTUBE_URL_LENGTH) {
    return failure("INVALID_URL", "Invalid YouTube URL");
  }
  try {
    const parsed = new URL(value.trim());
    if (parsed.pathname === "/playlist" || parsed.searchParams.has("list")) {
      return failure(
        "YOUTUBE_PLAYLIST_UNSUPPORTED",
        "YouTube playlists are not supported in Player V2",
      );
    }
  } catch {
    return failure("INVALID_URL", "Invalid YouTube URL");
  }
  const canonical = canonicalizeYouTubeUrl(value);
  return canonical
    ? { success: true, data: canonical, error: null }
    : failure("INVALID_URL", "Invalid YouTube video URL");
}

function selectThumbnail(info = {}) {
  if (Array.isArray(info.thumbnails)) {
    const thumbnail = info.thumbnails
      .filter((item) => typeof item?.url === "string")
      .slice()
      .sort((left, right) => (right.width || 0) - (left.width || 0))[0];
    if (thumbnail?.url) return thumbnail.url;
  }
  return typeof info.thumbnail === "string" ? info.thumbnail : null;
}

function createYouTubeTrack(info, canonical) {
  const resolved =
    canonicalizeYouTubeUrl(info?.webpage_url || info?.original_url) ||
    canonical;
  const duration = Number(info?.duration);
  return {
    id: `youtube:${resolved.videoId}`,
    providerId: "youtube",
    sourceRef: resolved.url,
    title: String(info?.title || "YouTube video").slice(0, 1024),
    artist: String(info?.channel || info?.uploader || "").slice(0, 1024),
    album: "",
    duration: Number.isFinite(duration) && duration >= 0 ? duration : 0,
    artworkUrl: selectThumbnail(info),
    kind: "video",
    availability: "available",
    mimeType: "video/mp4",
  };
}

function classifyFailure(error) {
  const classified = classifyDownloadError(error?.message || error);
  return failure(
    classified.code && classified.code !== "UNKNOWN"
      ? classified.code
      : "YOUTUBE_ERROR",
    classified.message || error?.message || String(error),
  );
}

function createYouTubeHandlers({
  getVideoInfo,
  getVideoPreview,
  now = Date.now,
}) {
  const playbackLeases = new Map();
  const loadInfo = async (url, forceRefresh) => {
    if (typeof getVideoInfo !== "function") {
      throw Object.assign(new Error("yt-dlp is unavailable"), {
        code: "EXEC_FAILED",
      });
    }
    return getVideoInfo(url, null, { forceRefresh });
  };
  const loadPreview = async (url) => {
    const loader =
      typeof getVideoPreview === "function" ? getVideoPreview : getVideoInfo;
    if (typeof loader !== "function") {
      throw Object.assign(new Error("yt-dlp is unavailable"), {
        code: "EXEC_FAILED",
      });
    }
    return loader(url, null);
  };

  const selectPlayback = (info, sourceUrl) =>
    selectYouTubeLivePreview(
      Array.isArray(info?.previewFormats)
        ? { ...info, formats: info.previewFormats }
        : info,
      sourceUrl,
    );

  const storePlaybackLease = (sourceUrl, info) => {
    const playback = selectPlayback(info, sourceUrl);
    if (!playback?.src) return;
    playbackLeases.set(sourceUrl, {
      expiresAt: now() + PLAYBACK_LEASE_TTL_MS,
      playback,
    });
  };

  const importVideo = async (url) => {
    const validation = validateYouTubeUrl(url);
    if (!validation.success) return validation;
    try {
      const info = await loadPreview(validation.data.url);
      if (Array.isArray(info?.entries) || Number(info?.playlist_count) > 0) {
        return failure(
          "YOUTUBE_PLAYLIST_UNSUPPORTED",
          "YouTube playlists are not supported in Player V2",
        );
      }
      storePlaybackLease(validation.data.url, info);
      return {
        success: true,
        data: createYouTubeTrack(info, validation.data),
        error: null,
      };
    } catch (error) {
      return classifyFailure(error);
    }
  };

  const resolveTrack = async (sourceRef, { forceRefresh = false } = {}) => {
    const validation = validateYouTubeUrl(sourceRef);
    if (!validation.success) return validation;
    try {
      const lease = playbackLeases.get(validation.data.url);
      if (!forceRefresh && lease?.expiresAt > now()) {
        playbackLeases.delete(validation.data.url);
        return {
          success: true,
          data: {
            src: lease.playback.src,
            mimeType: lease.playback.mime || "video/mp4",
            posterUrl: lease.playback.poster || null,
          },
          error: null,
        };
      }
      playbackLeases.delete(validation.data.url);
      const info = await loadInfo(validation.data.url, forceRefresh);
      const playback = selectPlayback(info, validation.data.url);
      if (!playback?.src) {
        return failure(
          "NO_PLAYABLE_FORMAT",
          "No Chromium-compatible YouTube format with audio was found",
        );
      }
      return {
        success: true,
        data: {
          src: playback.src,
          mimeType: playback.mime || "video/mp4",
          posterUrl: playback.poster || selectThumbnail(info),
        },
        error: null,
      };
    } catch (error) {
      return classifyFailure(error);
    }
  };

  return { importVideo, resolveTrack };
}

module.exports = {
  MAX_YOUTUBE_URL_LENGTH,
  PLAYBACK_LEASE_TTL_MS,
  createYouTubeHandlers,
  createYouTubeTrack,
  validateYouTubeUrl,
};
