const PLAYABLE_CONTAINERS = new Set(["mp4", "webm"]);
const UNSUPPORTED_PROTOCOLS = new Set([
  "m3u8",
  "m3u8_native",
  "http_dash_segments",
  "http_dash_segments_generator",
  "dash",
  "dash_frag_urls",
  "ism",
  "f4m",
]);

function hasValidHttpUrl(url) {
  try {
    const parsed = new URL(String(url || "").trim());
    return ["http:", "https:"].includes(parsed.protocol) && !!parsed.hostname;
  } catch {
    return false;
  }
}

function isYouTubeUrl(url) {
  try {
    const host = new URL(String(url || "").trim()).hostname.toLowerCase();
    return (
      host === "youtu.be" ||
      host === "youtube.com" ||
      host.endsWith(".youtube.com")
    );
  } catch {
    return false;
  }
}

function pickPoster(info = {}) {
  if (Array.isArray(info?.thumbnails) && info.thumbnails.length) {
    const sorted = info.thumbnails
      .filter((entry) => hasValidHttpUrl(entry?.url))
      .slice()
      .sort((left, right) => (right?.width || 0) - (left?.width || 0));
    if (sorted[0]?.url) return sorted[0].url;
  }

  return hasValidHttpUrl(info?.thumbnail) ? info.thumbnail : null;
}

function normalizeContainer(format = {}) {
  const ext = String(format?.ext || "").trim().toLowerCase();
  if (PLAYABLE_CONTAINERS.has(ext)) return ext;

  const container = String(format?.container || "").trim().toLowerCase();
  if (PLAYABLE_CONTAINERS.has(container)) return container;

  const mimeType = String(format?.mime_type || "").trim().toLowerCase();
  if (mimeType.startsWith("video/mp4")) return "mp4";
  if (mimeType.startsWith("video/webm")) return "webm";

  return null;
}

function getMimeType(format = {}, container = "") {
  const mimeType = String(format?.mime_type || "").trim().toLowerCase();
  if (mimeType.startsWith("video/")) return mimeType;
  if (container === "mp4") return "video/mp4";
  if (container === "webm") return "video/webm";
  return null;
}

function getDimensionScore(value, target, maxDistance) {
  if (!Number.isFinite(value) || value <= 0) return -8;
  const distance = Math.min(Math.abs(value - target), maxDistance);
  return 26 - distance / maxDistance;
}

function scorePreviewFormat(format = {}, container = "") {
  const height = Number(format?.height || 0);
  const width = Number(format?.width || 0);
  const fps = Number(format?.fps || 0);
  const bitrate =
    Number(format?.tbr || format?.vbr || format?.abr || format?.filesize_approx) ||
    0;
  const hasAudio = String(format?.acodec || "").toLowerCase() !== "none";

  let score = 0;
  score += container === "mp4" ? 48 : 44;
  score += getDimensionScore(height, 480, 1080);
  score += getDimensionScore(width, 854, 1920);

  if (height > 0 && height <= 1080) score += 8;
  if (height > 1080) score -= 18;
  if (height > 1440) score -= 30;

  if (fps > 0 && fps <= 30) score += 4;
  if (fps > 30 && fps <= 60) score += 1;
  if (fps > 60) score -= 6;

  if (bitrate > 0 && bitrate < 500) score -= 5;
  if (bitrate >= 500 && bitrate <= 2500) score += 8;
  if (bitrate > 2500 && bitrate <= 5000) score += 3;
  if (bitrate > 5000) score -= 8;

  if (!hasAudio) score += 1;

  return score;
}

function isPlayablePreviewFormat(format = {}) {
  const src = String(format?.url || "").trim();
  if (!hasValidHttpUrl(src)) return false;

  const protocol = String(format?.protocol || "").trim().toLowerCase();
  if (UNSUPPORTED_PROTOCOLS.has(protocol)) return false;

  const container = normalizeContainer(format);
  if (!container) return false;

  const vcodec = String(format?.vcodec || "").trim().toLowerCase();
  if (!vcodec || vcodec === "none") return false;

  if (String(format?.video_ext || "").trim().toLowerCase() === "none") {
    return false;
  }

  if (format?.manifest_url || format?.fragment_base_url) return false;

  return true;
}

function selectYouTubeBackgroundPreview(info = {}, sourceUrl = "") {
  if (!isYouTubeUrl(sourceUrl)) return null;
  if (info?.is_live || info?.was_live) return null;

  const formats = Array.isArray(info?.formats) ? info.formats : [];
  const poster = pickPoster(info);

  const candidate = formats
    .filter((format) => isPlayablePreviewFormat(format))
    .map((format) => {
      const container = normalizeContainer(format);
      return {
        src: String(format.url).trim(),
        poster,
        mime: getMimeType(format, container),
        container,
        width: Number(format?.width || 0) || null,
        height: Number(format?.height || 0) || null,
        score: scorePreviewFormat(format, container),
      };
    })
    .sort((left, right) => right.score - left.score)[0];

  if (!candidate) return null;

  return {
    src: candidate.src,
    poster: candidate.poster,
    mime: candidate.mime,
    container: candidate.container,
    width: candidate.width,
    height: candidate.height,
  };
}

module.exports = {
  isYouTubeUrl,
  selectYouTubeBackgroundPreview,
};
