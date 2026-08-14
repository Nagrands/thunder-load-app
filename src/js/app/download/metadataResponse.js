const {
  selectYouTubeBackgroundPreview,
  selectYouTubeLivePreview,
} = require("../downloaderBackgroundPreview");

function normalizeSubtitleTracks(tracks, { source = "manual" } = {}) {
  if (!tracks || typeof tracks !== "object" || Array.isArray(tracks)) return [];
  return Object.entries(tracks)
    .map(([lang, entries]) => {
      const normalizedLang = String(lang || "").trim();
      if (!/^[a-z0-9._-]{1,24}$/i.test(normalizedLang)) return null;
      const formats = (Array.isArray(entries) ? entries : [])
        .map((entry) => ({
          ext: String(entry?.ext || "").trim().toLowerCase(),
          name: String(entry?.name || entry?.format || "").trim(),
        }))
        .filter((entry) => entry.ext);
      return { lang: normalizedLang, source, formats };
    })
    .filter(Boolean);
}

function selectThumbnail(info) {
  if (Array.isArray(info?.thumbnails) && info.thumbnails.length) {
    return (
      info.thumbnails
        .slice()
        .sort((a, b) => (b.width || 0) - (a.width || 0))[0]?.url || null
    );
  }
  return info?.thumbnail || null;
}

function getPlaylistMetadata(info) {
  if (Array.isArray(info?.entries) && info.entries.length) {
    return {
      playlistCount: info.entries.length,
      playlistDuration: info.entries.reduce(
        (total, entry) => total + Math.max(0, Number(entry?.duration) || 0),
        0,
      ),
      entries: info.entries
        .map((entry) => entry?.webpage_url || entry?.url)
        .filter((url) => typeof url === "string" && url.length > 0),
    };
  }
  return {
    playlistCount:
      typeof info?.playlist_count === "number" ? info.playlist_count : 0,
    playlistDuration: 0,
    entries: [],
  };
}

function formatVideoInfoResponse(
  info,
  normalizedUrl,
  { includeFormats = true } = {},
) {
  const previewInfo = Array.isArray(info?.previewFormats)
    ? { ...info, formats: info.previewFormats }
    : info;
  const sourceUrl = info?.webpage_url || info?.original_url || normalizedUrl;
  return {
    success: true,
    title: info?.title || "",
    duration: Number(info?.duration || 0),
    thumbnail: selectThumbnail(info),
    backgroundPreview: selectYouTubeBackgroundPreview(previewInfo, sourceUrl),
    livePreview: selectYouTubeLivePreview(previewInfo, sourceUrl),
    ...getPlaylistMetadata(info),
    uploader: info?.uploader || info?.channel || "",
    channel: info?.channel || "",
    webpage_url: sourceUrl,
    original_url: info?.original_url || normalizedUrl,
    formats: includeFormats ? info?.formats || [] : [],
    is_live: info?.is_live || false,
    extractor: info?.extractor || "",
    subtitles: includeFormats ? normalizeSubtitleTracks(info?.subtitles) : [],
    automatic_captions: includeFormats
      ? normalizeSubtitleTracks(info?.automatic_captions, {
          source: "automatic",
        })
      : [],
  };
}

module.exports = { formatVideoInfoResponse, normalizeSubtitleTracks };
