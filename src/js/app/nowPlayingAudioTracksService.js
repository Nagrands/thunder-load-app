const fs = require("fs");
const { processSupervisor } = require("./processSupervisor");
const execFileAsync = (command, args = [], options = {}) =>
  processSupervisor.execFile(command, args, options, {
    owner: "Player",
    tool: "ffprobe",
  });
const MAX_AUDIO_TRACKS = 32;
const MAX_CACHE_ENTRIES = 128;
const PROBE_TIMEOUT_MS = 15_000;

function createError(code, message) {
  return Object.assign(new Error(message), { code });
}

function cleanText(value, maxLength) {
  return String(value || "")
    .replace(/[\u0000-\u001f\u007f]/g, "")
    .trim()
    .slice(0, maxLength);
}

function normalizeAudioTracks(probe = {}) {
  const streams = Array.isArray(probe?.streams) ? probe.streams : [];
  return streams
    .filter((stream) => String(stream?.codec_type || "") === "audio")
    .slice(0, MAX_AUDIO_TRACKS)
    .map((stream, order) => {
      const index = Number(stream?.index);
      if (!Number.isInteger(index) || index < 0 || index > 255) return null;
      return {
        id: `audio-${index}`,
        index,
        order,
        title: cleanText(stream?.tags?.title, 128),
        language: cleanText(stream?.tags?.language, 32).toLowerCase(),
        codec: cleanText(stream?.codec_name, 64).toLowerCase(),
        channels: Math.min(
          32,
          Math.max(0, Math.trunc(Number(stream?.channels) || 0)),
        ),
        channelLayout: cleanText(stream?.channel_layout, 64).toLowerCase(),
        isDefault: Number(stream?.disposition?.default) === 1,
      };
    })
    .filter(Boolean);
}

class NowPlayingAudioTracksService {
  constructor({
    ffprobePathResolver,
    execFileProcess = execFileAsync,
    statFile = fs.promises.stat,
  }) {
    this.ffprobePathResolver = ffprobePathResolver;
    this.execFileProcess = execFileProcess;
    this.statFile = statFile;
    this.cache = new Map();
  }

  async getTracks(track) {
    if (track?.providerId !== "local" || !track.sourceRef) {
      throw createError(
        "AUDIO_TRACKS_UNSUPPORTED",
        "Audio track selection is available for local media only",
      );
    }
    let stat;
    try {
      stat = await this.statFile(track.sourceRef);
    } catch {
      throw createError("TRACK_UNAVAILABLE", "Track file is unavailable");
    }
    if (!stat?.isFile?.()) {
      throw createError("TRACK_UNAVAILABLE", "Track file is unavailable");
    }
    const key = `${track.sourceRef}:${stat.size}:${stat.mtimeMs}`;
    const cached = this.cache.get(key);
    if (cached) {
      this.cache.delete(key);
      this.cache.set(key, cached);
      return cached.map((item) => ({ ...item }));
    }
    const ffprobePath = String(this.ffprobePathResolver?.() || "");
    if (!ffprobePath || ffprobePath.includes("\u0000")) {
      throw createError(
        "FFPROBE_UNAVAILABLE",
        "FFprobe is required to inspect audio tracks",
      );
    }
    let probe;
    try {
      const { stdout } = await this.execFileProcess(
        ffprobePath,
        [
          "-v",
          "error",
          "-show_entries",
          "stream=index,codec_type,codec_name,channels,channel_layout,disposition:stream_tags=language,title",
          "-of",
          "json",
          track.sourceRef,
        ],
        {
          maxBuffer: 2 * 1024 * 1024,
          timeout: PROBE_TIMEOUT_MS,
          windowsHide: true,
        },
      );
      probe = JSON.parse(stdout);
    } catch (error) {
      throw createError(
        error?.killed ? "AUDIO_TRACKS_TIMEOUT" : "AUDIO_TRACKS_PROBE_FAILED",
        error?.killed
          ? "Timed out inspecting audio tracks"
          : "Unable to inspect audio tracks",
      );
    }
    const tracks = normalizeAudioTracks(probe);
    this.cache.set(key, tracks);
    while (this.cache.size > MAX_CACHE_ENTRIES) {
      this.cache.delete(this.cache.keys().next().value);
    }
    return tracks.map((item) => ({ ...item }));
  }

  dispose() {
    this.cache.clear();
  }
}

module.exports = {
  MAX_AUDIO_TRACKS,
  MAX_CACHE_ENTRIES,
  NowPlayingAudioTracksService,
  PROBE_TIMEOUT_MS,
  normalizeAudioTracks,
};
