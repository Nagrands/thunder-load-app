const MP3_AUDIO_EXT = "mp3";
const SUBTITLE_FORMAT = "srt";

const extractHeight = (fmt) => {
  if (fmt?.height) return Number(fmt.height) || 0;
  const res =
    fmt?.resolution || fmt?.format_note || fmt?.quality || fmt?.format || "";
  const m1 = String(res).match(/(\d{3,4})[pP]/);
  if (m1) return Number(m1[1]) || 0;
  const m2 = String(res).match(/x(\d{3,4})/);
  if (m2) return Number(m2[1]) || 0;
  return 0;
};

const formatOptionData = (fmt, overrides = {}) => {
  const resolution =
    overrides.resolution ||
    fmt.resolution ||
    (fmt.height ? `${fmt.height}p` : "");
  const fps = overrides.fps || fmt.fps || null;
  const videoExt = overrides.videoExt || fmt.ext || null;
  return { resolution, fps, videoExt };
};

const codecLabel = (fmt) =>
  fmt?.vcodec && fmt.vcodec !== "none"
    ? fmt.vcodec
    : fmt?.acodec && fmt.acodec !== "none"
      ? fmt.acodec
      : "";

const sortScore = (fmt) => {
  const realHeight = extractHeight(fmt);
  const fps = Number(fmt?.fps || 0);
  const tbr = Number(fmt?.tbr || fmt?.vbr || 0);
  const abr = Number(fmt?.abr || 0);
  let score = realHeight * 2 + fps * 0.5 + (tbr + abr) / 50;
  if (fmt?.downloader_options?.http_chunk_size) score -= 0.5;
  return score;
};

const describeFormat = (fmt, t) => {
  const parts = [];
  if (fmt.ext) parts.push(String(fmt.ext).toUpperCase());
  if (fmt.vcodec && fmt.vcodec !== "none") parts.push(fmt.vcodec);
  if (fmt.acodec && fmt.acodec !== "none") parts.push(fmt.acodec);
  if (fmt.abr) parts.push(`${fmt.abr}kbps`);
  if (fmt.fps) parts.push(`${fmt.fps}fps`);
  return parts.join(" • ") || t("quality.custom");
};

function collectFormats(info) {
  const formats = Array.isArray(info?.formats) ? info.formats : [];
  const muxed = [];
  const videoOnly = [];
  const audioOnly = [];

  formats.forEach((fmt) => {
    if (!fmt?.format_id) return;
    if (fmt.vcodec !== "none" && fmt.acodec !== "none") muxed.push(fmt);
    else if (fmt.vcodec !== "none" && fmt.acodec === "none")
      videoOnly.push(fmt);
    else if (fmt.vcodec === "none" && fmt.acodec !== "none")
      audioOnly.push(fmt);
  });

  const sorted = (arr, getter) =>
    arr.slice().sort((a, b) => (getter(b) || 0) - (getter(a) || 0));

  return {
    muxed: muxed
      .map((fmt) => ({ fmt, score: sortScore(fmt) }))
      .sort((a, b) => b.score - a.score)
      .map((entry) => entry.fmt),
    videoOnly: sorted(videoOnly, (f) => f.height || f.tbr),
    audioOnly: sorted(audioOnly, (f) => f.abr || f.tbr),
  };
}

function buildOptionPayload({
  type,
  label,
  videoFormat,
  audioFormat,
  videoExt,
  audioExt,
  resolution,
  fps,
  isMuxed,
  downloadKind,
  subtitleLang,
  subtitleSource,
  subtitleFormat,
}) {
  return {
    type,
    label,
    downloadKind: downloadKind || undefined,
    videoFormatId: videoFormat || null,
    audioFormatId: audioFormat || null,
    videoExt: videoExt || null,
    audioExt: audioExt || null,
    resolution: resolution || "",
    fps: fps || null,
    isMuxed: !!isMuxed,
    subtitleLang: subtitleLang || undefined,
    subtitleSource: subtitleSource || undefined,
    subtitleFormat: subtitleFormat || undefined,
  };
}

function subtitlePriority(track) {
  const lang = String(track?.lang || "").toLowerCase();
  const source = track?.source === "automatic" ? "automatic" : "manual";
  if (source === "manual" && lang === "ru") return 400;
  if (source === "manual" && lang === "en") return 390;
  if (source === "automatic" && lang === "ru") return 380;
  if (source === "automatic" && lang === "en") return 370;
  return source === "manual" ? 200 : 100;
}

function collectSubtitleTracks(info) {
  const normalize = (items, source) =>
    (Array.isArray(items) ? items : [])
      .map((track) => ({
        lang: String(track?.lang || "").trim(),
        source,
      }))
      .filter((track) => track.lang);
  return [
    ...normalize(info?.subtitles, "manual"),
    ...normalize(info?.automatic_captions, "automatic"),
  ].sort((a, b) => {
    const priorityDiff = subtitlePriority(b) - subtitlePriority(a);
    if (priorityDiff) return priorityDiff;
    return a.lang.toLowerCase().localeCompare(b.lang.toLowerCase());
  });
}

function buildSubtitleOptions(info, t) {
  const subtitleOptions = [
    {
      id: "no-subtitles",
      kind: "none",
      title: t("quality.compact.noSubtitles"),
      meta: t("quality.compact.noSubtitlesHint"),
      payload: null,
    },
  ];
  collectSubtitleTracks(info).forEach((track) => {
    const langLabel = track.lang.toUpperCase();
    const sourceLabel =
      track.source === "automatic"
        ? t("quality.subtitle.sourceAutomatic")
        : t("quality.subtitle.sourceManual");
    const label = t("quality.subtitle.optionTitle", {
      lang: langLabel,
      source: sourceLabel,
    });
    subtitleOptions.push({
      id: `subtitle-${track.source}-${track.lang}`,
      kind: "subtitle",
      source: track.source,
      title: label,
      meta: SUBTITLE_FORMAT.toUpperCase(),
      payload: buildOptionPayload({
        type: "subtitle-only",
        downloadKind: "subtitle",
        label,
        videoFormat: null,
        audioFormat: null,
        videoExt: null,
        audioExt: null,
        resolution: track.lang,
        fps: null,
        subtitleLang: track.lang,
        subtitleSource: track.source,
        subtitleFormat: SUBTITLE_FORMAT,
      }),
    });
  });
  return subtitleOptions;
}

function buildCompactQualityOptions(info, t) {
  const { muxed, videoOnly, audioOnly } = collectFormats(info);
  const bestAudio = audioOnly[0] || null;
  const videoOptions = [];
  const audioOptions = [];
  const subtitleOptions = buildSubtitleOptions(info, t);

  videoOnly.forEach((fmt) => {
    const { resolution, fps, videoExt } = formatOptionData(fmt);
    videoOptions.push({
      id: `video-${fmt.format_id}`,
      kind: "video",
      source: "video-only",
      title: resolution || fmt.format_note || fmt.format_id,
      meta: describeFormat(fmt, t),
      fmt,
      payload: buildOptionPayload({
        type: "video-only",
        label: t("quality.label.videoNoAudio", {
          label: resolution || t("quality.label.video"),
        }),
        videoFormat: fmt.format_id,
        audioFormat: null,
        videoExt,
        audioExt: null,
        resolution,
        fps,
      }),
    });
  });

  if (!videoOptions.length) {
    muxed.forEach((fmt) => {
      const { resolution, fps, videoExt } = formatOptionData(fmt);
      videoOptions.push({
        id: `muxed-${fmt.format_id}`,
        kind: "video",
        source: "muxed",
        title: resolution || fmt.format_note || fmt.format_id,
        meta: describeFormat(fmt, t),
        fmt,
        payload: buildOptionPayload({
          type: "muxed",
          label: resolution || fmt.format_note || t("quality.label.video"),
          videoFormat: fmt.format_id,
          audioFormat: null,
          videoExt,
          audioExt: null,
          resolution,
          fps,
          isMuxed: true,
        }),
      });
    });
  }

  videoOptions.push({
    id: "no-video",
    kind: "none",
    title: t("quality.compact.noVideo"),
    meta: t("quality.compact.noVideoHint"),
    payload: null,
  });

  audioOnly.forEach((fmt) => {
    const bitrate = fmt.abr || fmt.tbr || "?";
    audioOptions.push({
      id: `audio-${fmt.format_id}`,
      kind: "audio",
      source: "audio-only",
      title: fmt.format_note || `${bitrate}kbps`,
      meta: `${(fmt.ext || "m4a").toUpperCase()} • ${codecLabel(fmt)} • ${bitrate} kbps`,
      fmt,
      payload: buildOptionPayload({
        type: "audio-only",
        label: fmt.format_note || t("quality.label.audio"),
        videoFormat: null,
        audioFormat: fmt.format_id,
        videoExt: null,
        audioExt: fmt.ext || "m4a",
        resolution: fmt.format_note || "audio",
        fps: null,
      }),
    });
  });

  if (bestAudio) {
    const bitrate = bestAudio.abr || bestAudio.tbr || "?";
    audioOptions.push({
      id: `audio-mp3-${bestAudio.format_id}`,
      kind: "audio",
      source: "mp3",
      title: t("quality.label.audioMp3"),
      meta: t("quality.desc.audioMp3", { bitrate }),
      fmt: bestAudio,
      payload: buildOptionPayload({
        type: "audio-only",
        label: t("quality.label.audioMp3"),
        videoFormat: null,
        audioFormat: bestAudio.format_id,
        videoExt: null,
        audioExt: MP3_AUDIO_EXT,
        resolution: t("quality.label.audioMp3"),
        fps: null,
      }),
    });
  }

  audioOptions.push({
    id: "no-audio",
    kind: "none",
    title: t("quality.compact.noAudio"),
    meta: t("quality.compact.noAudioHint"),
    payload: null,
    disabled: videoOnly.length === 0,
  });

  return {
    videoOptions,
    audioOptions,
    subtitleOptions,
    canUseVideoOnly: videoOnly.length > 0,
    bestAudio,
  };
}

function buildCompactPayload({ videoOption, audioOption, subtitleOption, t }) {
  if (subtitleOption?.kind === "subtitle") return subtitleOption.payload;
  if (!videoOption || !audioOption) return null;
  if (videoOption.kind === "none" && audioOption.kind === "none") return null;
  if (videoOption.kind === "none") return audioOption.payload;
  if (audioOption.kind === "none") {
    return videoOption.source === "video-only" ? videoOption.payload : null;
  }
  if (videoOption.source === "muxed") return videoOption.payload;
  if (!audioOption.fmt) return videoOption.payload;
  const { resolution, fps, videoExt } = formatOptionData(videoOption.fmt);
  return buildOptionPayload({
    type: "pair",
    label: t("quality.label.videoWithAudio", {
      label: resolution || t("quality.label.video"),
    }),
    videoFormat: videoOption.fmt.format_id,
    audioFormat: audioOption.fmt.format_id,
    videoExt,
    audioExt: audioOption.fmt.ext || "m4a",
    resolution,
    fps,
  });
}

export { buildCompactPayload, buildCompactQualityOptions };
