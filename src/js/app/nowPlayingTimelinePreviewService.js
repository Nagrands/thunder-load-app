"use strict";

const path = require("path");
const { spawn } = require("child_process");

const MAX_CACHE_ITEMS = 96;
const MAX_CACHE_BYTES = 32 * 1024 * 1024;
const MAX_IMAGE_BYTES = 2 * 1024 * 1024;
const PREVIEW_TIMEOUT_MS = 8_000;
const TIMESTAMP_BUCKET_SECONDS = 2;

function createError(code, message) {
  return Object.assign(new Error(message), { code });
}

function isHttpUrl(value) {
  try {
    const url = new URL(String(value || ""));
    return (
      ["http:", "https:"].includes(url.protocol) &&
      !url.username &&
      !url.password
    );
  } catch {
    return false;
  }
}

function validateRequest(payload) {
  const source = payload && typeof payload === "object" ? payload : {};
  const requestId = String(source.requestId || "");
  const trackId = String(source.trackId || "");
  const sessionId = String(source.sessionId || "");
  const timestamp = Number(source.timestamp);
  if (!/^[\w-]{1,128}$/.test(requestId)) {
    throw createError("INVALID_PREVIEW_REQUEST", "Invalid preview request ID");
  }
  if (!trackId || trackId.length > 128) {
    throw createError("INVALID_PREVIEW_REQUEST", "Invalid preview track ID");
  }
  if (
    sessionId &&
    !/^[a-f0-9-]{36}$/.test(sessionId)
  ) {
    throw createError("INVALID_PREVIEW_REQUEST", "Invalid preview session ID");
  }
  if (!Number.isFinite(timestamp) || timestamp < 0 || timestamp > 86_400) {
    throw createError("INVALID_PREVIEW_REQUEST", "Invalid preview timestamp");
  }
  return {
    requestId,
    sessionId,
    timestamp:
      Math.floor(timestamp / TIMESTAMP_BUCKET_SECONDS) *
      TIMESTAMP_BUCKET_SECONDS,
    trackId,
  };
}

function buildPreviewArgs(input, timestamp) {
  return [
    "-hide_banner",
    "-loglevel",
    "error",
    "-nostdin",
    "-ss",
    String(timestamp),
    "-i",
    input,
    "-map",
    "0:v:0",
    "-frames:v",
    "1",
    "-vf",
    "scale=320:180:force_original_aspect_ratio=decrease,pad=320:180:(ow-iw)/2:(oh-ih)/2:black",
    "-f",
    "image2pipe",
    "-vcodec",
    "mjpeg",
    "pipe:1",
  ];
}

class NowPlayingTimelinePreviewService {
  constructor({
    ffmpegPathResolver,
    getSessionInputs = () => [],
    getTrackById,
    spawnProcess = spawn,
  }) {
    this.ffmpegPathResolver = ffmpegPathResolver;
    this.getSessionInputs = getSessionInputs;
    this.getTrackById = getTrackById;
    this.spawnProcess = spawnProcess;
    this.cache = new Map();
    this.cacheBytes = 0;
    this.active = null;
    this.disposed = false;
  }

  resolveInput(track, sessionId) {
    const sessionInputs = sessionId
      ? this.getSessionInputs(sessionId)
      : [];
    const sessionInput = Array.isArray(sessionInputs)
      ? sessionInputs.find((input) => isHttpUrl(input) || path.isAbsolute(input))
      : "";
    if (sessionInput) return String(sessionInput);
    const sourceRef = String(track?.sourceRef || "");
    if (track?.providerId === "local" && path.isAbsolute(sourceRef)) {
      return sourceRef;
    }
    if (track?.providerId === "network" && isHttpUrl(sourceRef)) {
      return sourceRef;
    }
    return "";
  }

  readCache(key) {
    const entry = this.cache.get(key);
    if (!entry) return null;
    this.cache.delete(key);
    this.cache.set(key, entry);
    return entry.dataUrl;
  }

  writeCache(key, dataUrl, bytes) {
    const previous = this.cache.get(key);
    if (previous) this.cacheBytes -= previous.bytes;
    this.cache.delete(key);
    this.cache.set(key, { bytes, dataUrl });
    this.cacheBytes += bytes;
    while (
      this.cache.size > MAX_CACHE_ITEMS ||
      this.cacheBytes > MAX_CACHE_BYTES
    ) {
      const oldestKey = this.cache.keys().next().value;
      const oldest = this.cache.get(oldestKey);
      this.cache.delete(oldestKey);
      this.cacheBytes -= oldest?.bytes || 0;
    }
  }

  cancel(requestId) {
    if (this.active?.requestId !== String(requestId || "")) return false;
    this.active.cancelled = true;
    if (this.active.child?.exitCode === null) {
      this.active.child.kill("SIGTERM");
    }
    return true;
  }

  async extract(input, timestamp, requestId) {
    this.cancel(this.active?.requestId);
    const ffmpegPath = String(this.ffmpegPathResolver?.() || "");
    if (!ffmpegPath || ffmpegPath.includes("\u0000")) {
      throw createError("FFMPEG_UNAVAILABLE", "FFmpeg is unavailable");
    }
    return new Promise((resolve, reject) => {
      const child = this.spawnProcess(
        ffmpegPath,
        buildPreviewArgs(input, timestamp),
        { stdio: ["ignore", "pipe", "pipe"], windowsHide: true },
      );
      const active = { cancelled: false, child, requestId };
      this.active = active;
      const chunks = [];
      let bytes = 0;
      let stderr = "";
      let settled = false;
      const timer = setTimeout(() => {
        active.cancelled = true;
        if (child.exitCode === null) child.kill("SIGTERM");
        settle(
          reject,
          createError("PREVIEW_TIMEOUT", "Timeline preview timed out"),
        );
      }, PREVIEW_TIMEOUT_MS);
      timer.unref?.();
      const settle = (callback, value) => {
        if (settled) return;
        settled = true;
        clearTimeout(timer);
        if (this.active === active) this.active = null;
        callback(value);
      };
      child.stdout?.on("data", (chunk) => {
        bytes += chunk.length;
        if (bytes > MAX_IMAGE_BYTES) {
          active.cancelled = true;
          if (child.exitCode === null) child.kill("SIGTERM");
          settle(
            reject,
            createError("PREVIEW_TOO_LARGE", "Timeline preview is too large"),
          );
          return;
        }
        chunks.push(chunk);
      });
      child.stderr?.on("data", (chunk) => {
        stderr = `${stderr}${chunk}`.slice(-2048);
      });
      child.once("error", (error) =>
        settle(
          reject,
          createError(
            "PREVIEW_FAILED",
            error?.message || "Unable to start FFmpeg",
          ),
        ),
      );
      child.once("close", (code) => {
        if (active.cancelled) {
          settle(
            reject,
            createError("PREVIEW_CANCELLED", "Timeline preview was cancelled"),
          );
          return;
        }
        if (code !== 0 || !chunks.length) {
          settle(
            reject,
            createError(
              "PREVIEW_UNAVAILABLE",
              stderr.trim() || "Timeline preview is unavailable",
            ),
          );
          return;
        }
        settle(resolve, Buffer.concat(chunks));
      });
    });
  }

  async getPreview(payload) {
    if (this.disposed) {
      throw createError("PREVIEW_UNAVAILABLE", "Preview service is disposed");
    }
    const request = validateRequest(payload);
    const track = this.getTrackById(request.trackId);
    if (!track) {
      throw createError("TRACK_UNAVAILABLE", "Unknown media track");
    }
    if (track.kind !== "video") {
      return {
        dataUrl: null,
        fallbackReason: "audio",
        requestId: request.requestId,
        timestamp: request.timestamp,
      };
    }
    const input = this.resolveInput(track, request.sessionId);
    if (!input) {
      return {
        dataUrl: null,
        fallbackReason: "source-unavailable",
        requestId: request.requestId,
        timestamp: request.timestamp,
      };
    }
    const key = `${track.id}:${request.sessionId || input}:${request.timestamp}`;
    const cached = this.readCache(key);
    if (cached) {
      return {
        dataUrl: cached,
        fallbackReason: null,
        requestId: request.requestId,
        timestamp: request.timestamp,
      };
    }
    try {
      const image = await this.extract(
        input,
        request.timestamp,
        request.requestId,
      );
      const dataUrl = `data:image/jpeg;base64,${image.toString("base64")}`;
      this.writeCache(key, dataUrl, image.length);
      return {
        dataUrl,
        fallbackReason: null,
        requestId: request.requestId,
        timestamp: request.timestamp,
      };
    } catch (error) {
      if (error?.code === "PREVIEW_CANCELLED") throw error;
      return {
        dataUrl: null,
        fallbackReason: error?.code || "preview-unavailable",
        requestId: request.requestId,
        timestamp: request.timestamp,
      };
    }
  }

  dispose() {
    this.disposed = true;
    this.cancel(this.active?.requestId);
    this.cache.clear();
    this.cacheBytes = 0;
  }
}

module.exports = {
  MAX_CACHE_BYTES,
  MAX_CACHE_ITEMS,
  NowPlayingTimelinePreviewService,
  PREVIEW_TIMEOUT_MS,
  TIMESTAMP_BUCKET_SECONDS,
  buildPreviewArgs,
  validateRequest,
};
