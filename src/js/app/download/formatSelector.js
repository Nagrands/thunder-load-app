const log = require("electron-log");

const QUALITY_AUDIO_ONLY = "Audio Only";
const QUALITY_SOURCE = "Source";
const QUALITY_HEIGHTS = Object.freeze({
  "FHD 1080p": 1080,
  "HD 720p": 720,
  "SD 360p": 360,
});
const PREFERRED_AUDIO_LANGS = [
  "ru",
  "ru-ru",
  "rus",
  "russian",
  "рус",
  "русский",
];

function isSubtitleOnly(quality) {
  return quality?.type === "subtitle-only" || quality?.downloadKind === "subtitle";
}

function inferQuality(quality) {
  const marker = `${quality?.quality || ""} ${quality?.label || ""}`
    .toLowerCase()
    .trim();
  if (
    quality?.type === "audio-only" ||
    quality?.downloadKind === "audio" ||
    /audio|аудио/.test(marker)
  ) return QUALITY_AUDIO_ONLY;
  if (/1080|fhd/.test(marker)) return "FHD 1080p";
  if (/720|hd/.test(marker)) return "HD 720p";
  if (/360|sd/.test(marker)) return "SD 360p";
  if (/source|исход|original|best/.test(marker)) return QUALITY_SOURCE;
  return null;
}

function pickBest(items, compare) {
  return items.length ? [...items].sort(compare)[0] : null;
}

function audioLanguageScore(format) {
  const values = [
    format?.language,
    format?.language_preference,
    format?.languagePreference,
    format?.lang,
    format?.format_note,
  ];
  return values.some((value) => {
    const normalized = String(value || "").toLowerCase();
    return PREFERRED_AUDIO_LANGS.some((code) => normalized.includes(code));
  }) ? 0 : 1;
}

function compareAudio(a, b) {
  const language = audioLanguageScore(a) - audioLanguageScore(b);
  if (language) return language;
  const bitrate = (b?.abr || b?.tbr || 0) - (a?.abr || a?.tbr || 0);
  return bitrate || (b?.filesize || 0) - (a?.filesize || 0);
}

function describe(video, audio, { muxed = false } = {}) {
  return {
    videoFormat: video?.format_id || null,
    audioFormat: audio?.format_id || null,
    resolution: video
      ? video.width && video.height
        ? `${video.width}x${video.height}`
        : video.resolution || "unknown"
      : "audio only",
    fps: video?.fps || null,
    videoExt: video?.ext || null,
    audioExt: audio?.ext || null,
    isMuxed: muxed,
  };
}

function selectExact(formats, quality) {
  const find = (id) => (id ? formats.find((format) => format?.format_id === id) : null);
  const requestedVideoId = quality.videoFormatId || null;
  const requestedAudioId = quality.audioFormatId || null;
  const video = find(requestedVideoId);
  const audio = find(requestedAudioId);
  if ((requestedVideoId && !video) || (requestedAudioId && !audio)) return null;
  return {
    videoFormat: requestedVideoId,
    audioFormat: requestedAudioId,
    resolution:
      quality.resolution ||
      video?.resolution ||
      (video?.height ? `${video.height}p` : "custom"),
    fps: quality.fps || video?.fps || null,
    videoExt: quality.videoExt || video?.ext || null,
    audioExt: quality.audioExt || audio?.ext || null,
  };
}

function selectFormatsByQuality(formats = [], desiredQuality) {
  if (desiredQuality && typeof desiredQuality === "object") {
    if (isSubtitleOnly(desiredQuality)) {
      return {
        videoFormat: null,
        audioFormat: null,
        resolution: desiredQuality.subtitleLang || "subtitle",
        fps: null,
        videoExt: null,
        audioExt: null,
      };
    }
    const exact = selectExact(formats, desiredQuality);
    if (exact) return exact;
    const fallback = inferQuality(desiredQuality);
    log.warn("[download] Requested format IDs are unavailable, fallback", {
      requestedVideoId: desiredQuality.videoFormatId || null,
      requestedAudioId: desiredQuality.audioFormatId || null,
      fallbackQuality: fallback || "(auto)",
    });
    if (fallback) return selectFormatsByQuality(formats, fallback);
    return selectFormatsByQuality(
      formats,
      desiredQuality.audioFormatId && !desiredQuality.videoFormatId
        ? QUALITY_AUDIO_ONLY
        : QUALITY_SOURCE,
    );
  }

  const audioOnly = formats.filter((format) =>
    format.acodec !== "none" && format.vcodec === "none");
  const videoOnly = formats.filter((format) =>
    format.vcodec !== "none" && format.acodec === "none");
  const muxed = formats.filter((format) =>
    format.vcodec !== "none" && format.acodec !== "none");
  const bestAudio = () => pickBest(audioOnly, compareAudio);
  const compareVideo = (a, b) =>
    (b.height || 0) - (a.height || 0) || (b.tbr || 0) - (a.tbr || 0);

  if (desiredQuality === QUALITY_AUDIO_ONLY) {
    const audio = bestAudio();
    if (audio) return describe(null, audio);
    const combined = pickBest(muxed, (a, b) =>
      (b.abr || 0) - (a.abr || 0) || (b.tbr || 0) - (a.tbr || 0));
    if (!combined) throw new Error("No audio or muxed formats found");
    return {
      ...describe(combined, null, { muxed: true }),
      resolution: "audio (muxed)",
    };
  }

  if (desiredQuality === QUALITY_SOURCE) {
    if (videoOnly.length && audioOnly.length) {
      return describe(pickBest(videoOnly, compareVideo), bestAudio());
    }
    const combined = pickBest(muxed, compareVideo);
    if (!combined) throw new Error("No suitable muxed format found for source quality.");
    return describe(combined, null, { muxed: true });
  }

  const target = QUALITY_HEIGHTS[desiredQuality];
  if (!target) throw new Error(`Invalid quality: ${desiredQuality}`);
  const exact = videoOnly.filter((format) => format.height === target);
  const lower = videoOnly.filter((format) => (format.height || 0) <= target);
  const higher = videoOnly.filter((format) => (format.height || 0) > target);
  const video = pickBest(exact, compareVideo) ||
    pickBest(lower, compareVideo) ||
    pickBest(higher, (a, b) =>
      (a.height || 0) - (b.height || 0) || (a.tbr || 0) - (b.tbr || 0));
  if (video && bestAudio()) return describe(video, bestAudio());
  const combined = pickBest(
    muxed.filter((format) => (format.height || 0) <= (video?.height || target)),
    compareVideo,
  );
  if (combined) return describe(combined, null, { muxed: true });
  if (video) throw new Error(`No available audio format for ${desiredQuality}`);
  throw new Error(`No available video formats for quality ${desiredQuality} or lower`);
}

module.exports = { selectFormatsByQuality };
