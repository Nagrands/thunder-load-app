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

  const videoExt = String(format?.video_ext || "").trim().toLowerCase();
  if (PLAYABLE_CONTAINERS.has(videoExt)) return videoExt;

  const containerText = String(format?.container || "")
    .trim()
    .toLowerCase();
  if (PLAYABLE_CONTAINERS.has(containerText)) return containerText;
  const containerTokens = containerText
    .split(/[,/ ]+/)
    .map((part) => part.trim())
    .filter(Boolean);
  const tokenMatch = containerTokens.find((part) => PLAYABLE_CONTAINERS.has(part));
  if (tokenMatch) return tokenMatch;

  const mimeType = String(format?.mime_type || "").trim().toLowerCase();
  if (mimeType.startsWith("video/mp4")) return "mp4";
  if (mimeType.startsWith("video/webm")) return "webm";

  try {
    const parsed = new URL(String(format?.url || "").trim());
    const mimeFromQuery = [
      parsed.searchParams.get("mime"),
      parsed.searchParams.get("mime_type"),
    ]
      .map((value) => String(value || "").trim().toLowerCase())
      .find(Boolean);
    if (mimeFromQuery?.startsWith("video/mp4")) return "mp4";
    if (mimeFromQuery?.startsWith("video/webm")) return "webm";

    const pathExt = (parsed.pathname.match(/\.([a-z0-9]+)$/i) || [])[1]
      ?.trim()
      .toLowerCase();
    if (PLAYABLE_CONTAINERS.has(pathExt)) return pathExt;
  } catch {}

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

function scoreLivePreviewFormat(format = {}, container = "") {
  const height = Number(format?.height || 0);
  const width = Number(format?.width || 0);
  const fps = Number(format?.fps || 0);
  const bitrate =
    Number(format?.tbr || format?.vbr || format?.abr || format?.filesize_approx) ||
    0;
  const hasAudio = String(format?.acodec || "").toLowerCase() !== "none";
  const audioBitrate = Number(format?.abr || 0) || 0;

  let score = 0;
  score += container === "mp4" ? 50 : 45;

  if (height > 0 && height <= 480) score += 26;
  else if (height > 0 && height <= 720) score += 18;
  else if (height > 720 && height <= 1080) score += 6;
  else if (height > 1080) score -= 12;

  if (width > 0 && width <= 854) score += 12;
  else if (width > 854 && width <= 1280) score += 6;
  else if (width > 1600) score -= 8;

  if (fps > 0 && fps <= 30) score += 6;
  if (fps > 30 && fps <= 60) score += 2;
  if (fps > 60) score -= 6;

  if (bitrate > 0 && bitrate <= 1800) score += 16;
  else if (bitrate > 1800 && bitrate <= 3200) score += 9;
  else if (bitrate > 3200 && bitrate <= 5000) score += 2;
  else if (bitrate > 5000) score -= 10;

  if (audioBitrate > 0 && audioBitrate <= 160) score += 5;
  if (audioBitrate > 320) score -= 4;

  if (!hasAudio) score -= 100;

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
  const videoExt = String(format?.video_ext || "").trim().toLowerCase();
  const width = Number(format?.width || 0);
  const height = Number(format?.height || 0);
  const resolution = String(format?.resolution || "").trim().toLowerCase();
  const hasVideoTrack =
    (vcodec && vcodec !== "none") ||
    (videoExt && videoExt !== "none") ||
    width > 0 ||
    height > 0 ||
    (resolution && !resolution.includes("audio only"));
  if (!hasVideoTrack) return false;

  if (videoExt === "none") {
    return false;
  }

  if (format?.manifest_url || format?.fragment_base_url) return false;

  return true;
}

function isPlayableLivePreviewFormat(format = {}) {
  if (!isPlayablePreviewFormat(format)) return false;

  const vcodec = String(format?.vcodec || "").trim().toLowerCase();
  const acodec = String(format?.acodec || "").trim().toLowerCase();
  if (!vcodec || vcodec === "none") return false;
  if (!acodec || acodec === "none") return false;

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

function selectYouTubeLivePreview(info = {}, sourceUrl = "") {
  if (!isYouTubeUrl(sourceUrl)) return null;
  if (info?.is_live || info?.was_live || info?.live_status === "is_live") {
    return null;
  }

  const formats = Array.isArray(info?.formats) ? info.formats : [];
  const poster = pickPoster(info);

  const candidate = formats
    .filter((format) => isPlayableLivePreviewFormat(format))
    .map((format) => {
      const container = normalizeContainer(format);
      return {
        src: String(format.url).trim(),
        poster,
        mime: getMimeType(format, container),
        container,
        width: Number(format?.width || 0) || null,
        height: Number(format?.height || 0) || null,
        score: scoreLivePreviewFormat(format, container),
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
  selectYouTubeLivePreview,
};
