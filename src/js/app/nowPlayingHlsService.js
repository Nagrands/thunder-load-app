// @ts-check

const crypto = require("crypto");
const fs = require("fs");
const fsPromises = fs.promises;
const http = require("http");
const path = require("path");
const { spawn } = require("child_process");

const START_TIMEOUT_MS = 12_000;
const SESSION_TTL_MS = 30 * 60 * 1000;
const MAX_SESSIONS = 8;
const MAX_CACHE_BYTES = 2 * 1024 * 1024 * 1024;
const CLEANUP_INTERVAL_MS = 30_000;
const HLS_CONTENT_TYPES = Object.freeze({
  ".m3u8": "application/vnd.apple.mpegurl",
  ".ts": "video/mp2t",
  ".m4s": "video/iso.segment",
});

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
    throw createError("INVALID_HLS_INPUT", "One or two media inputs are required");
  }
  const sanitized = inputs.map((input) => String(input || ""));
  const isAllowed = (input) =>
    isHttpUrl(input) ||
    (allowLocal &&
      !input.includes("\u0000") &&
      path.isAbsolute(input));
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
  if (inputs.length === 2) args.push("-map", "0:v:0", "-map", "1:a:0");
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
    "independent_segments+temp_file",
    "-hls_segment_filename",
    path.join(path.dirname(outputPath), "segment-%06d.ts"),
    outputPath,
  );
  return args;
}

function waitForManifest(manifestPath, child, timeoutMs = START_TIMEOUT_MS) {
  return new Promise((resolve, reject) => {
    const startedAt = Date.now();
    let stderr = "";
    const onStderr = (chunk) => {
      stderr = `${stderr}${chunk}`.slice(-4096);
    };
    const cleanupListeners = () => {
      child.stderr?.off("data", onStderr);
      child.off?.("error", onError);
    };
    const onError = (error) => {
      cleanupListeners();
      reject(
        createError(
          "HLS_TRANSCODE_FAILED",
          error?.message || "Unable to start FFmpeg",
        ),
      );
    };
    child.stderr?.on("data", onStderr);
    child.once?.("error", onError);
    const check = async () => {
      try {
        const stat = await fsPromises.stat(manifestPath);
        if (stat.size > 0) {
          cleanupListeners();
          resolve();
          return;
        }
      } catch {
        // FFmpeg has not produced the manifest yet.
      }
      if (child.exitCode !== null) {
        cleanupListeners();
        reject(
          createError(
            "HLS_TRANSCODE_FAILED",
            stderr.trim() || "FFmpeg exited before HLS playback was ready",
          ),
        );
        return;
      }
      if (Date.now() - startedAt >= timeoutMs) {
        cleanupListeners();
        reject(createError("HLS_START_TIMEOUT", "Timed out preparing HLS playback"));
        return;
      }
      setTimeout(check, 80);
    };
    void check();
  });
}

class NowPlayingHlsService {
  constructor({
    cacheRoot,
    ffmpegPathResolver,
    spawnProcess = spawn,
    serverFactory = http.createServer,
    now = Date.now,
  }) {
    this.cacheRoot = cacheRoot;
    this.ffmpegPathResolver = ffmpegPathResolver;
    this.spawnProcess = spawnProcess;
    this.serverFactory = serverFactory;
    this.now = now;
    this.server = null;
    this.port = 0;
    this.sessions = new Map();
    this.cleanupTimer = null;
  }

  async ensureServer() {
    if (this.server) return;
    await fsPromises.mkdir(this.cacheRoot, { recursive: true });
    this.server = this.serverFactory((request, response) => {
      void this.serve(request, response);
    });
    await new Promise((resolve, reject) => {
      this.server.once("error", reject);
      this.server.listen(0, "127.0.0.1", () => {
        this.server.off("error", reject);
        const address = this.server.address();
        this.port = typeof address === "object" && address ? address.port : 0;
        this.cleanupTimer = setInterval(() => {
          void this.cleanupExpired();
        }, CLEANUP_INTERVAL_MS);
        this.cleanupTimer.unref?.();
        resolve();
      });
    });
  }

  async serve(request, response) {
    const match = /^\/([a-f0-9]{48})\/([a-f0-9-]{36})\/([^/]+)$/.exec(
      new URL(request.url || "/", "http://127.0.0.1").pathname,
    );
    const session = match ? this.sessions.get(match[2]) : null;
    const fileName = match?.[3] || "";
    if (
      request.method !== "GET" ||
      !session ||
      session.token !== match[1] ||
      !/^(?:index\.m3u8|segment-\d{6}\.ts)$/.test(fileName)
    ) {
      response.writeHead(404).end();
      return;
    }
    try {
      const filePath = path.join(session.directory, fileName);
      const stat = await fsPromises.stat(filePath);
      response.writeHead(200, {
        "Access-Control-Allow-Origin": "*",
        "Cache-Control": fileName.endsWith(".m3u8") ? "no-store" : "private, max-age=60",
        "Content-Length": stat.size,
        "Content-Type": HLS_CONTENT_TYPES[path.extname(fileName)] || "application/octet-stream",
      });
      fs.createReadStream(filePath).pipe(response);
    } catch {
      response.writeHead(404).end();
    }
  }

  async createSession({ inputs, copyCodecs = false, allowLocal = false }) {
    const safeInputs = validateInputs(inputs, { allowLocal });
    const ffmpegPath = String(this.ffmpegPathResolver?.() || "");
    if (!ffmpegPath || ffmpegPath.includes("\u0000")) {
      throw createError("FFMPEG_UNAVAILABLE", "FFmpeg is required for this playback format");
    }
    await this.ensureServer();
    await this.cleanupExpired();
    const id = crypto.randomUUID();
    const token = crypto.randomBytes(24).toString("hex");
    const directory = path.join(this.cacheRoot, id);
    const manifestPath = path.join(directory, "index.m3u8");
    await fsPromises.mkdir(directory, { recursive: true });
    const spawnFfmpeg = (hardwareAcceleration) =>
      this.spawnProcess(
        ffmpegPath,
        buildFfmpegArgs({
          inputs: safeInputs,
          copyCodecs,
          outputPath: manifestPath,
          hardwareAcceleration,
        }),
        { stdio: ["ignore", "ignore", "pipe"], windowsHide: true },
      );
    let child = spawnFfmpeg(true);
    const session = { child, createdAt: this.now(), directory, id, token };
    this.sessions.set(id, session);
    try {
      await waitForManifest(manifestPath, child);
    } catch (error) {
      if (copyCodecs) {
        await this.closeSession(id);
        throw error;
      }
      if (child.exitCode === null) child.kill("SIGTERM");
      await fsPromises.rm(manifestPath, { force: true });
      child = spawnFfmpeg(false);
      session.child = child;
      try {
        await waitForManifest(manifestPath, child);
      } catch (fallbackError) {
        await this.closeSession(id);
        throw fallbackError;
      }
    }
    return {
      kind: "hls",
      sessionId: id,
      src: `http://127.0.0.1:${this.port}/${token}/${id}/index.m3u8`,
      mimeType: HLS_CONTENT_TYPES[".m3u8"],
    };
  }

  async closeSession(sessionId) {
    const session = this.sessions.get(String(sessionId || ""));
    if (!session) return false;
    this.sessions.delete(session.id);
    if (session.child.exitCode === null) session.child.kill("SIGTERM");
    await fsPromises.rm(session.directory, { recursive: true, force: true });
    return true;
  }

  async cleanupExpired() {
    const ordered = [...this.sessions.values()].sort((a, b) => a.createdAt - b.createdAt);
    const expired = new Set(ordered.filter(
      (session, index) =>
        this.now() - session.createdAt > SESSION_TTL_MS ||
        index < Math.max(0, ordered.length - MAX_SESSIONS + 1),
    ));
    let totalBytes = 0;
    const sizes = [];
    for (const session of ordered) {
      const size = await this.getDirectorySize(session.directory);
      sizes.push([session, size]);
      totalBytes += size;
    }
    for (const [session, size] of sizes) {
      if (totalBytes <= MAX_CACHE_BYTES) break;
      expired.add(session);
      totalBytes -= size;
    }
    await Promise.all([...expired].map((session) => this.closeSession(session.id)));
  }

  async getDirectorySize(directory) {
    try {
      const entries = await fsPromises.readdir(directory, { withFileTypes: true });
      const sizes = await Promise.all(
        entries.map(async (entry) => {
          if (!entry.isFile()) return 0;
          return (await fsPromises.stat(path.join(directory, entry.name))).size;
        }),
      );
      return sizes.reduce((total, size) => total + size, 0);
    } catch {
      return 0;
    }
  }

  async dispose() {
    if (this.cleanupTimer) clearInterval(this.cleanupTimer);
    this.cleanupTimer = null;
    await Promise.all([...this.sessions.keys()].map((id) => this.closeSession(id)));
    if (!this.server) return;
    await new Promise((resolve) => this.server.close(resolve));
    this.server = null;
    this.port = 0;
  }
}

module.exports = {
  MAX_CACHE_BYTES,
  MAX_SESSIONS,
  NowPlayingHlsService,
  SESSION_TTL_MS,
  buildFfmpegArgs,
  validateInputs,
};
