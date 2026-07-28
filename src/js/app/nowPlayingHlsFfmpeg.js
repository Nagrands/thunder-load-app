// @ts-check

const path = require("path");

const MULTI_AUDIO_READ_RATE = 2;
const MULTI_AUDIO_INITIAL_BURST_SECONDS = 12;
const MULTI_AUDIO_CATCHUP_RATE = 3;
const SOFTWARE_VIDEO_THREADS = 2;

function createError(code, message) {
  return Object.assign(new Error(message), { code });
}

function isHttpUrl(value) {
  try {
    return ["http:", "https:"].includes(new URL(String(value)).protocol);
  } catch {
    return false;
  }
}

function validateInputs(inputs, { allowLocal = false } = {}) {
  if (!Array.isArray(inputs) || inputs.length < 1 || inputs.length > 2) {
    throw createError(
      "INVALID_HLS_INPUT",
      "One or two media inputs are required",
    );
  }
  const sanitized = inputs.map((input) => String(input || ""));
  const isAllowed = (input) =>
    isHttpUrl(input) ||
    (allowLocal && !input.includes("\u0000") && path.isAbsolute(input));
  if (sanitized.some((input) => !isAllowed(input))) {
    throw createError(
      "INVALID_HLS_INPUT",
      allowLocal
        ? "Only validated local paths or resolved HTTP media inputs are accepted"
        : "Only resolved HTTP media inputs are accepted",
    );
  }
  return sanitized;
}

function buildFfmpegArgs({
  inputs,
  copyCodecs,
  outputPath,
  hardwareAcceleration = true,
}) {
  const args = ["-hide_banner", "-loglevel", "warning", "-nostdin", "-y"];
  inputs.forEach((input) => {
    if (!copyCodecs && hardwareAcceleration) args.push("-hwaccel", "auto");
    args.push("-i", input);
  });
  if (inputs.length === 2) {
    args.push("-map", "0:v:0", "-map", "1:a:0");
  }
  if (copyCodecs) {
    args.push("-c", "copy");
  } else {
    args.push(
      "-c:v",
      "libx264",
      "-preset",
      "veryfast",
      "-c:a",
      "aac",
      "-b:a",
      "192k",
    );
  }
  args.push(
    "-f",
    "hls",
    "-hls_time",
    "4",
    "-hls_list_size",
    "0",
    "-hls_playlist_type",
    "event",
    "-hls_flags",
    "single_file+independent_segments",
    outputPath,
  );
  return args;
}

function getHardwareVideoEncoders(platform = process.platform) {
  if (platform === "darwin") {
    return [
      {
        id: "videotoolbox",
        args: ["-c:v", "h264_videotoolbox", "-q:v", "65"],
      },
    ];
  }
  if (platform === "win32") {
    return [
      {
        id: "nvenc",
        args: [
          "-c:v",
          "h264_nvenc",
          "-preset",
          "p4",
          "-cq",
          "23",
          "-b:v",
          "0",
        ],
      },
      {
        id: "qsv",
        args: [
          "-c:v",
          "h264_qsv",
          "-preset",
          "veryfast",
          "-global_quality",
          "23",
        ],
      },
      {
        id: "amf",
        args: [
          "-c:v",
          "h264_amf",
          "-quality",
          "speed",
          "-rc",
          "cqp",
          "-qp_i",
          "23",
          "-qp_p",
          "23",
        ],
      },
    ];
  }
  return [];
}

function getMultiAudioVideoProfiles({
  copyVideo = false,
  includeVideo = true,
  platform = process.platform,
} = {}) {
  if (!includeVideo) return [{ id: "audio-only", args: [] }];
  if (copyVideo) return [{ id: "copy", args: ["-c:v", "copy"] }];
  return [
    ...getHardwareVideoEncoders(platform),
    {
      id: "software",
      args: [
        "-c:v",
        "libx264",
        "-preset",
        "veryfast",
        "-threads",
        String(SOFTWARE_VIDEO_THREADS),
      ],
    },
  ];
}

function buildMultiAudioFfmpegArgs({
  audioTracks,
  copyVideo = false,
  includeVideo = true,
  input,
  outputPath,
  startTime = 0,
  videoEncoderArgs = null,
}) {
  const normalizedTracks = Array.isArray(audioTracks)
    ? audioTracks.filter(
        (track, order) =>
          /^audio-(?:0|[1-9]\d{0,2})$/.test(String(track?.id || "")) &&
          track?.order === order,
      )
    : [];
  if (normalizedTracks.length < 2) {
    throw createError(
      "INVALID_HLS_AUDIO_TRACKS",
      "At least two ordered audio tracks are required",
    );
  }
  const args = [
    "-hide_banner",
    "-loglevel",
    "warning",
    "-nostdin",
    "-y",
  ];
  const normalizedStartTime = Math.max(0, Number(startTime) || 0);
  if (normalizedStartTime > 0) {
    args.push("-ss", String(normalizedStartTime));
  }
  args.push(
    "-readrate",
    String(MULTI_AUDIO_READ_RATE),
    "-readrate_initial_burst",
    String(MULTI_AUDIO_INITIAL_BURST_SECONDS),
    "-readrate_catchup",
    String(MULTI_AUDIO_CATCHUP_RATE),
    "-i",
    input,
  );
  if (includeVideo) args.push("-map", "0:v:0");
  normalizedTracks.forEach((_track, order) => {
    args.push("-map", `0:a:${order}`);
  });
  if (includeVideo) {
    const encoderArgs =
      Array.isArray(videoEncoderArgs) && videoEncoderArgs.length
        ? videoEncoderArgs
        : getMultiAudioVideoProfiles({ copyVideo, includeVideo }).at(-1).args;
    args.push(...encoderArgs);
  }
  normalizedTracks.forEach((track, order) => {
    if (String(track.codec || "").toLowerCase() === "aac") {
      args.push(`-c:a:${order}`, "copy");
    } else {
      args.push(`-c:a:${order}`, "aac", `-b:a:${order}`, "192k");
    }
  });
  const audioGroup = "audio";
  const variants = [];
  if (includeVideo) variants.push(`v:0,agroup:${audioGroup}`);
  const defaultOrder = Math.max(
    0,
    normalizedTracks.findIndex((track) => track.isDefault === true),
  );
  normalizedTracks.forEach((track, order) => {
    variants.push(
      [
        `a:${order}`,
        `agroup:${audioGroup}`,
        `name:${track.id}`,
        order === defaultOrder ? "default:yes" : "",
      ]
        .filter(Boolean)
        .join(","),
    );
  });
  args.push(
    "-f",
    "hls",
    "-hls_time",
    "4",
    "-hls_list_size",
    "0",
    "-hls_playlist_type",
    "event",
    "-hls_flags",
    "single_file+independent_segments",
    "-master_pl_name",
    path.basename(outputPath),
    "-var_stream_map",
    variants.join(" "),
    path.join(path.dirname(outputPath), "stream-%v.m3u8"),
  );
  return args;
}

module.exports = {
  buildFfmpegArgs,
  buildMultiAudioFfmpegArgs,
  getMultiAudioVideoProfiles,
  validateInputs,
};
