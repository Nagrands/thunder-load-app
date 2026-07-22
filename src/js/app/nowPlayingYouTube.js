const { classifyDownloadError } = require("./notifications");
const { selectYouTubeLivePreview } = require("./downloaderBackgroundPreview");
const { canonicalizeYouTubeUrl } = require("./nowPlayingState");

const MAX_YOUTUBE_URL_LENGTH = 2048;
const PLAYBACK_LEASE_TTL_MS = 90 * 1000;
const INFO_CACHE_TTL_MS = 5 * 60 * 1000;
const INFO_CACHE_LIMIT = 32;
const PLAYBACK_CACHE_LIMIT = 32;
const QUALITY_MODES = new Set(["auto", "best", "audio", "format"]);

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
        "YouTube playlists are not supported in Player",
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

function sanitizeQualitySelection(value) {
  const source = value && typeof value === "object" ? value : {};
  const mode = QUALITY_MODES.has(source.mode) ? source.mode : "auto";
  const cleanId = (id) => String(id || "").slice(0, 128);
  return {
    mode,
    formatId: cleanId(source.formatId),
    videoFormatId: cleanId(source.videoFormatId),
    audioFormatId: cleanId(source.audioFormatId),
  };
}

function createYouTubeTrack(info, canonical, qualitySelection = null) {
  const resolved =
    canonicalizeYouTubeUrl(info?.webpage_url || info?.original_url) || canonical;
  const duration = Number(info?.duration);
  const selection = sanitizeQualitySelection(qualitySelection);
  const selectedFormats = findSelectedFormats(info, selection);
  const sizeBytes = selectedFormats.reduce(
    (total, format) =>
      total + Number(format?.filesize || format?.filesize_approx || 0),
    0,
  );
  return {
    id: `youtube:${resolved.videoId}`,
    providerId: "youtube",
    sourceRef: resolved.url,
    title: String(info?.title || "YouTube video").slice(0, 1024),
    displayTitle: String(info?.title || "YouTube video").slice(0, 1024),
    artist: String(info?.channel || info?.uploader || "").slice(0, 1024),
    album: "",
    duration: Number.isFinite(duration) && duration >= 0 ? duration : 0,
    artworkUrl: selectThumbnail(info),
    kind: selection.mode === "audio" ? "audio" : "video",
    availability: "available",
    mimeType: selection.mode === "audio" ? "audio/mp4" : "video/mp4",
    qualitySelection: selection,
    sizeBytes: Number.isFinite(sizeBytes) && sizeBytes >= 0 ? sizeBytes : 0,
  };
}

function classifyFailure(error) {
  if (error?.code?.startsWith("YOUTUBE_") || error?.code?.startsWith("HLS_") || error?.code === "FFMPEG_UNAVAILABLE") {
    return failure(error.code, error.message);
  }
  const classified = classifyDownloadError(error?.message || error);
  return failure(
    classified.code && classified.code !== "UNKNOWN"
      ? classified.code
      : "YOUTUBE_ERROR",
    classified.message || error?.message || String(error),
  );
}

function hasVideo(format) {
  return format?.vcodec && format.vcodec !== "none";
}

function hasAudio(format) {
  return format?.acodec && format.acodec !== "none";
}

function formatScore(format) {
  return (
    (Number(format?.height) || 0) * 1_000_000 +
    (Number(format?.fps) || 0) * 10_000 +
    (Number(format?.tbr) || Number(format?.abr) || 0)
  );
}

function selectBest(formats, predicate) {
  return formats.filter(predicate).sort((a, b) => formatScore(b) - formatScore(a))[0];
}

function getFormats(info) {
  const formats = Array.isArray(info?.formats)
    ? info.formats
    : Array.isArray(info?.previewFormats)
      ? info.previewFormats
      : [];
  return formats.filter(
    (format) =>
      format &&
      typeof format.url === "string" &&
      /^https?:\/\//i.test(format.url),
  );
}

function findSelectedFormats(info, qualitySelection) {
  const selection = sanitizeQualitySelection(qualitySelection);
  const formats = getFormats(info);
  if (selection.mode === "audio") {
    const audio = selectBest(formats, (format) => hasAudio(format) && !hasVideo(format)) ||
      selectBest(formats, hasAudio);
    return audio ? [audio] : [];
  }
  if (selection.mode === "format") {
    if (selection.formatId) {
      const muxed = formats.find(
        (format) => String(format.format_id) === selection.formatId && hasAudio(format),
      );
      return muxed ? [muxed] : [];
    }
    const video = formats.find(
      (format) => String(format.format_id) === selection.videoFormatId && hasVideo(format),
    );
    const audio = formats.find(
      (format) => String(format.format_id) === selection.audioFormatId && hasAudio(format),
    );
    return video && audio ? [video, audio] : [];
  }
  if (selection.mode === "best") {
    const muxed = selectBest(formats, (format) => hasVideo(format) && hasAudio(format));
    const video = selectBest(formats, (format) => hasVideo(format) && !hasAudio(format));
    const audio = selectBest(formats, (format) => hasAudio(format) && !hasVideo(format));
    return video && audio && formatScore(video) > formatScore(muxed) ? [video, audio] : muxed ? [muxed] : [];
  }
  const playback = selectYouTubeLivePreview({ ...info, formats }, info?.webpage_url || "");
  const selected = formats.find((format) => format.url === playback?.src);
  if (selected) return [selected];
  const muxed = selectBest(formats, (format) => hasVideo(format) && hasAudio(format));
  return muxed ? [muxed] : [];
}

function toQualityOption(format, formats) {
  const video = hasVideo(format);
  const audio = hasAudio(format);
  const audioPartner = video && !audio
    ? selectBest(formats, (item) => hasAudio(item) && !hasVideo(item))
    : null;
  const sizeBytes = Number(format.filesize || format.filesize_approx);
  return {
    id: `format:${format.format_id}`,
    label: video ? `${Number(format.height) || "?"}p` : "Audio",
    selector: audio
      ? { mode: "format", formatId: String(format.format_id), videoFormatId: "", audioFormatId: "" }
      : {
          mode: "format",
          formatId: "",
          videoFormatId: String(format.format_id),
          audioFormatId: String(audioPartner?.format_id || ""),
        },
    width: Number(format.width) || 0,
    height: Number(format.height) || 0,
    fps: Number(format.fps) || 0,
    container: String(format.ext || ""),
    videoCodec: video ? String(format.vcodec || "") : "",
    audioCodec: audio ? String(format.acodec || "") : String(audioPartner?.acodec || ""),
    bitrateKbps: Number(format.tbr || format.abr) || 0,
    sizeBytes: Number.isFinite(sizeBytes) && sizeBytes >= 0 ? sizeBytes : 0,
  };
}

function buildQualityOptions(info) {
  const formats = getFormats(info);
  const defaults = [
    { id: "auto", label: "Auto", selector: sanitizeQualitySelection({ mode: "auto" }) },
    { id: "best", label: "Best", selector: sanitizeQualitySelection({ mode: "best" }) },
    { id: "audio", label: "Audio", selector: sanitizeQualitySelection({ mode: "audio" }) },
  ];
  const concrete = formats
    .filter((format) => hasVideo(format) || (hasAudio(format) && !hasVideo(format)))
    .map((format) => toQualityOption(format, formats))
    .filter((option) => option.selector.formatId || (option.selector.videoFormatId && option.selector.audioFormatId))
    .sort((a, b) => b.height - a.height || b.bitrateKbps - a.bitrateKbps);
  return [...defaults, ...concrete];
}

function canStreamCopy(formats) {
  return formats.every((format) => {
    const videoOk = !hasVideo(format) || /^(?:avc1|h264)/i.test(format.vcodec);
    const audioOk = !hasAudio(format) || /^(?:mp4a|aac)/i.test(format.acodec);
    return videoOk && audioOk;
  });
}

function createYouTubeHandlers({
  getVideoInfo,
  getVideoPreview,
  hlsService = null,
  now = Date.now,
}) {
  const infoCache = new Map();
  const inflight = new Map();
  const playbackCache = new Map();
  const playbackInflight = new Map();

  const cachePlayback = (key, value) => {
    playbackCache.delete(key);
    playbackCache.set(key, {
      expiresAt: now() + PLAYBACK_LEASE_TTL_MS,
      ...value,
    });
    while (playbackCache.size > PLAYBACK_CACHE_LIMIT) {
      playbackCache.delete(playbackCache.keys().next().value);
    }
    return value;
  };

  const cacheInfo = (key, info) => {
    infoCache.delete(key);
    infoCache.set(key, { expiresAt: now() + INFO_CACHE_TTL_MS, info });
    while (infoCache.size > INFO_CACHE_LIMIT) infoCache.delete(infoCache.keys().next().value);
    return info;
  };
  const loadInfo = async (url, forceRefresh = false, preview = false) => {
    const key = `${url}:${preview ? "preview" : "full"}`;
    if (forceRefresh) infoCache.delete(key);
    const cached = infoCache.get(key);
    if (cached?.expiresAt > now()) {
      infoCache.delete(key);
      infoCache.set(key, cached);
      return cached.info;
    }
    infoCache.delete(key);
    if (inflight.has(key)) return inflight.get(key);
    const loader = preview && typeof getVideoPreview === "function" ? getVideoPreview : getVideoInfo;
    if (typeof loader !== "function") {
      throw Object.assign(new Error("yt-dlp is unavailable"), { code: "EXEC_FAILED" });
    }
    const pending = loader(url, null, preview ? undefined : { forceRefresh })
      .then((info) => cacheInfo(key, info))
      .finally(() => inflight.delete(key));
    inflight.set(key, pending);
    return pending;
  };

  const analyzeVideo = async (url, { forceRefresh = false } = {}) => {
    const validation = validateYouTubeUrl(url);
    if (!validation.success) return validation;
    try {
      const info = await loadInfo(validation.data.url, forceRefresh, false);
      if (Array.isArray(info?.entries) || Number(info?.playlist_count) > 0) {
        return failure("YOUTUBE_PLAYLIST_UNSUPPORTED", "YouTube playlists are not supported in Player");
      }
      return {
        success: true,
        data: {
          track: createYouTubeTrack(info, validation.data),
          qualities: buildQualityOptions(info),
          defaultSelection: sanitizeQualitySelection({ mode: "auto" }),
        },
        error: null,
      };
    } catch (error) {
      return classifyFailure(error);
    }
  };

  const importVideo = async (url, qualitySelection = null) => {
    const validation = validateYouTubeUrl(url);
    if (!validation.success) return validation;
    let info;
    try {
      info = await loadInfo(
        validation.data.url,
        false,
        qualitySelection === null,
      );
    } catch (error) {
      return classifyFailure(error);
    }
    if (Array.isArray(info?.entries) || Number(info?.playlist_count) > 0) {
      return failure("YOUTUBE_PLAYLIST_UNSUPPORTED", "YouTube playlists are not supported in Player");
    }
    const selection = sanitizeQualitySelection(qualitySelection);
    if (selection.mode === "format") {
      const selected = buildQualityOptions(info).some(
        (option) => JSON.stringify(option.selector) === JSON.stringify(selection),
      );
      if (!selected) return failure("YOUTUBE_QUALITY_UNAVAILABLE", "The selected YouTube quality is no longer available");
    }
    return {
      success: true,
      data: createYouTubeTrack(info, validation.data, selection),
      error: null,
    };
  };

  const resolveTrack = async (sourceRef, { forceRefresh = false, qualitySelection = null } = {}) => {
    const validation = validateYouTubeUrl(sourceRef);
    if (!validation.success) return validation;
    try {
      const selection = sanitizeQualitySelection(qualitySelection);
      const playbackKey = `${validation.data.url}:${JSON.stringify(selection)}`;
      if (forceRefresh) playbackCache.delete(playbackKey);
      const cachedPlayback = playbackCache.get(playbackKey);
      if (cachedPlayback?.expiresAt > now()) {
        playbackCache.delete(playbackKey);
        playbackCache.set(playbackKey, cachedPlayback);
      } else {
        playbackCache.delete(playbackKey);
      }
      if (playbackInflight.has(playbackKey)) {
        return await playbackInflight.get(playbackKey);
      }
      const resolvePlayback = async () => {
      const previewKey = `${validation.data.url}:preview`;
      const preview = !forceRefresh ? infoCache.get(previewKey) : null;
      const info = cachedPlayback?.info ||
        (selection.mode === "auto" && preview?.expiresAt > now()
          ? preview.info
          : await loadInfo(validation.data.url, forceRefresh, false));
      const formats = cachedPlayback?.formats || findSelectedFormats(info, selection);
      if (!formats.length) {
        return failure(
          selection.mode === "format" ? "YOUTUBE_QUALITY_UNAVAILABLE" : "NO_PLAYABLE_FORMAT",
          selection.mode === "format"
            ? "The selected YouTube quality is no longer available"
            : "No playable YouTube format was found",
        );
      }
      const posterUrl = selectThumbnail(info);
      if (!hlsService) {
        return {
          success: true,
          data: { kind: "direct", src: formats[0].url, mimeType: formats[0].ext === "webm" ? "video/webm" : "video/mp4", posterUrl },
          error: null,
        };
      }
      const playback = await hlsService.createSession({
        inputs: formats.map((format) => format.url),
        copyCodecs: canStreamCopy(formats),
      });
      cachePlayback(playbackKey, { formats, info });
      return { success: true, data: { ...playback, posterUrl }, error: null };
      };
      const pending = resolvePlayback().finally(() =>
        playbackInflight.delete(playbackKey),
      );
      playbackInflight.set(playbackKey, pending);
      return await pending;
    } catch (error) {
      return classifyFailure(error);
    }
  };

  return { analyzeVideo, importVideo, resolveTrack };
}

module.exports = {
  INFO_CACHE_LIMIT,
  INFO_CACHE_TTL_MS,
  PLAYBACK_CACHE_LIMIT,
  MAX_YOUTUBE_URL_LENGTH,
  PLAYBACK_LEASE_TTL_MS,
  buildQualityOptions,
  createYouTubeHandlers,
  createYouTubeTrack,
  findSelectedFormats,
  sanitizeQualitySelection,
  validateYouTubeUrl,
};
