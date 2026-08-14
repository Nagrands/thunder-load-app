const MP3_AUDIO_EXT = "mp3";
const SUBTITLE_OUTPUT_EXT = "srt";

const toFiniteNumber = (value) => {
  const number = Number(value);
  return Number.isFinite(number) && number > 0 ? number : 0;
};

const getFormatSize = (fmt = {}, duration = 0) => {
  const exact = toFiniteNumber(fmt.filesize);
  if (exact) return { bytes: exact, approximate: false };
  const approximate = toFiniteNumber(fmt.filesize_approx);
  if (approximate) return { bytes: approximate, approximate: true };
  const bitrate = toFiniteNumber(fmt.tbr || fmt.vbr || fmt.abr);
  const seconds = toFiniteNumber(duration);
  return bitrate && seconds
    ? { bytes: (bitrate * 1000 * seconds) / 8, approximate: true }
    : { bytes: 0, approximate: false };
};

const normalizeCodec = (value = "") => {
  const codec = String(value || "").trim();
  if (!codec || codec === "none") return "";
  if (/^avc1/i.test(codec)) return "H.264";
  if (/^(hev1|hvc1|hevc)/i.test(codec)) return "H.265";
  if (/^vp09|^vp9/i.test(codec)) return "VP9";
  if (/^av01|^av1/i.test(codec)) return "AV1";
  if (/^mp4a/i.test(codec)) return "AAC";
  if (/^opus/i.test(codec)) return "Opus";
  return codec.split(".")[0].toUpperCase();
};

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
}) {
  return {
    type,
    label,
    videoFormatId: videoFormat || null,
    audioFormatId: audioFormat || null,
    videoExt: videoExt || null,
    audioExt: audioExt || null,
    resolution: resolution || "",
    fps: fps || null,
    isMuxed: !!isMuxed,
  };
}

function buildCompactQualityOptions(info, t) {
  const { muxed, videoOnly, audioOnly } = collectFormats(info);
  const bestAudio = audioOnly[0] || null;
  const videoOptions = [];
  const audioOptions = [];

  videoOnly.forEach((fmt) => {
    const { resolution, fps, videoExt } = formatOptionData(fmt);
    videoOptions.push({
      id: `video-${fmt.format_id}`,
      kind: "video",
      source: "video-only",
      title: resolution || fmt.format_note || fmt.format_id,
      meta: describeFormat(fmt, t),
      fmt,
      size: getFormatSize(fmt, info?.duration),
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
        size: getFormatSize(fmt, info?.duration),
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
      size: getFormatSize(fmt, info?.duration),
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
      size: getFormatSize(bestAudio, info?.duration),
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

  if (videoOptions.some((option) => option.source === "muxed")) {
    const muxedFormat = videoOptions[0]?.fmt || null;
    audioOptions.unshift({
      id: "audio-included",
      kind: "included",
      source: "muxed",
      title: t("quality.quick.audioIncluded"),
      meta: muxedFormat ? describeFormat(muxedFormat, t) : "",
      fmt: muxedFormat,
      size: muxedFormat ? getFormatSize(muxedFormat, info?.duration) : null,
      payload: null,
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
    canUseVideoOnly: videoOnly.length > 0,
    bestAudio,
  };
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
  ].sort((left, right) => {
    const score = (track) => {
      const lang = track.lang.toLowerCase();
      const languageScore = lang === "ru" ? 30 : lang === "en" ? 20 : 0;
      return languageScore + (track.source === "manual" ? 10 : 0);
    };
    return score(right) - score(left) || left.lang.localeCompare(right.lang);
  });
}

function buildSubtitleQualityOptions(info, t) {
  const off = {
    id: "subtitle-off",
    kind: "none",
    title: t("quality.quick.subtitlesOff"),
    meta: "",
    payload: null,
  };
  return [
    off,
    ...collectSubtitleTracks(info).map((track) => {
      const sourceLabel = t(
        track.source === "automatic"
          ? "quality.subtitle.sourceAutomatic"
          : "quality.subtitle.sourceManual",
      );
      const title = t("quality.subtitle.optionTitle", {
        lang: track.lang.toUpperCase(),
        source: sourceLabel,
      });
      return {
        id: `subtitle-${track.source}-${track.lang}`,
        kind: "subtitle",
        title,
        meta: sourceLabel,
        payload: {
          type: "subtitle-only",
          downloadKind: "subtitle",
          label: title,
          videoFormatId: null,
          audioFormatId: null,
          videoExt: null,
          audioExt: null,
          resolution: track.lang,
          fps: null,
          subtitleLang: track.lang,
          subtitleSource: track.source,
          subtitleFormat: SUBTITLE_OUTPUT_EXT,
        },
      };
    }),
  ];
}

function formatBytes(bytes) {
  const value = toFiniteNumber(bytes);
  if (!value) return "";
  const units = ["B", "KB", "MB", "GB", "TB"];
  const index = Math.min(
    Math.floor(Math.log(value) / Math.log(1024)),
    units.length - 1,
  );
  const amount = value / 1024 ** index;
  return `${amount >= 100 || index === 0 ? amount.toFixed(0) : amount.toFixed(1)} ${units[index]}`;
}

function buildOutputSummary({ videoOption, audioOption, t }) {
  const mediaPayload = buildCompactPayload({ videoOption, audioOption, t });
  if (!mediaPayload) {
    return {
      text: t("quality.quick.subtitleOnlySummary"),
      container: SUBTITLE_OUTPUT_EXT.toUpperCase(),
      codecs: [],
      sizeBytes: 0,
      approximate: false,
    };
  }
  const formats = [videoOption?.fmt, audioOption?.fmt].filter(Boolean);
  const uniqueFormats = Array.from(new Set(formats));
  const sizes = uniqueFormats.map((fmt) =>
    fmt === videoOption?.fmt ? videoOption?.size : audioOption?.size,
  );
  const sizeBytes = sizes.reduce((sum, size) => sum + (size?.bytes || 0), 0);
  const approximate = sizes.some((size) => size?.bytes && size.approximate);
  const codecs = Array.from(
    new Set(
      uniqueFormats
        .flatMap((fmt) => [
          normalizeCodec(fmt?.vcodec),
          normalizeCodec(fmt?.acodec),
        ])
        .filter(Boolean),
    ),
  );
  const container = String(
    mediaPayload.videoExt ||
      mediaPayload.audioExt ||
      uniqueFormats[0]?.ext ||
      "",
  ).toUpperCase();
  const size = formatBytes(sizeBytes);
  const parts = [container, codecs.join(" + ")].filter(Boolean);
  parts.push(
    size
      ? `${approximate ? "≈ " : ""}${size}`
      : t("quality.quick.sizeUnavailable"),
  );
  return { text: parts.join(" • "), container, codecs, sizeBytes, approximate };
}

function buildDownloaderSelection({
  videoOption,
  audioOption,
  subtitleOption,
  t,
}) {
  const mediaPayload = buildCompactPayload({ videoOption, audioOption, t });
  const subtitlePayloads = subtitleOption?.payload
    ? [subtitleOption.payload]
    : [];
  if (!mediaPayload && !subtitlePayloads.length) return null;
  return {
    mediaPayload,
    subtitlePayloads,
    summary: buildOutputSummary({ videoOption, audioOption, t }),
  };
}

function buildCompactPayload({ videoOption, audioOption, t }) {
  if (!videoOption || !audioOption) return null;
  if (videoOption.kind === "none" && audioOption.kind === "none") return null;
  if (videoOption.kind === "none") return audioOption.payload;
  if (videoOption.source === "muxed") return videoOption.payload;
  if (audioOption.kind === "none") {
    return videoOption.source === "video-only" ? videoOption.payload : null;
  }
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

function serializeCompactOption(option = {}) {
  return {
    id: option.id || "",
    kind: option.kind || "",
    source: option.source || "",
    title: option.title || "",
    meta: option.meta || "",
    disabled: Boolean(option.disabled),
    payload: option.payload || null,
  };
}

function buildWebCompactQualityOptions(info, t) {
  const groups = buildCompactQualityOptions(info, t);
  return {
    videoOptions: groups.videoOptions.map(serializeCompactOption),
    audioOptions: groups.audioOptions.map(serializeCompactOption),
  };
}

export {
  buildDownloaderSelection,
  buildCompactPayload,
  buildCompactQualityOptions,
  buildOutputSummary,
  buildSubtitleQualityOptions,
  buildWebCompactQualityOptions,
};
