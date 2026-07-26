// @ts-check

const crypto = require("crypto");
const fs = require("fs");
const fsPromises = fs.promises;
const http = require("http");
const path = require("path");
const { spawn } = require("child_process");

const START_TIMEOUT_MS = 12_000;
const SESSION_TTL_MS = 30 * 60 * 1000;
const MAX_SESSIONS = 1;
const MAX_CACHE_BYTES = 2 * 1024 * 1024 * 1024;
const CLEANUP_INTERVAL_MS = 30_000;
const FORCE_KILL_TIMEOUT_MS = 1_500;
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
    "independent_segments+temp_file",
    "-hls_segment_filename",
    path.join(path.dirname(outputPath), "segment-%06d.ts"),
    outputPath,
  );
  return args;
}

function waitForManifest(
  manifestPath,
  child,
  { signal = null, timeoutMs = START_TIMEOUT_MS } = {},
) {
  return new Promise((resolve, reject) => {
    const startedAt = Date.now();
    let stderr = "";
    let timer = null;
    let settled = false;
    const onStderr = (chunk) => {
      stderr = `${stderr}${chunk}`.slice(-4096);
    };
    const cleanupListeners = () => {
      if (timer) clearTimeout(timer);
      timer = null;
      child.stderr?.off("data", onStderr);
      child.off?.("error", onError);
      signal?.removeEventListener("abort", onAbort);
    };
    const settle = (callback, value) => {
      if (settled) return;
      settled = true;
      cleanupListeners();
      callback(value);
    };
    const onError = (error) => {
      settle(
        reject,
        createError(
          "HLS_TRANSCODE_FAILED",
          error?.message || "Unable to start FFmpeg",
        ),
      );
    };
    const onAbort = () =>
      settle(
        reject,
        createError(
          "PLAYBACK_SESSION_CANCELLED",
          "Playback session was superseded",
        ),
      );
    child.stderr?.on("data", onStderr);
    child.once?.("error", onError);
    signal?.addEventListener("abort", onAbort, { once: true });
    const check = async () => {
      if (signal?.aborted) {
        onAbort();
        return;
      }
      try {
        const stat = await fsPromises.stat(manifestPath);
        if (stat.size > 0) {
          settle(resolve);
          return;
        }
      } catch {
        // FFmpeg has not produced the manifest yet.
      }
      if (child.exitCode !== null) {
        settle(
          reject,
          createError(
            "HLS_TRANSCODE_FAILED",
            stderr.trim() || "FFmpeg exited before HLS playback was ready",
          ),
        );
        return;
      }
      if (Date.now() - startedAt >= timeoutMs) {
        settle(
          reject,
          createError("HLS_START_TIMEOUT", "Timed out preparing HLS playback"),
        );
        return;
      }
      timer = setTimeout(check, 80);
    };
    void check();
  });
}

async function terminateChild(child) {
  if (!child || child.exitCode !== null) return;
  await new Promise((resolve) => {
    let settled = false;
    let forceTimer = null;
    let finishTimer = null;
    const finish = () => {
      if (settled) return;
      settled = true;
      if (forceTimer) clearTimeout(forceTimer);
      if (finishTimer) clearTimeout(finishTimer);
      child.off?.("exit", finish);
      resolve();
    };
    child.once?.("exit", finish);
    child.kill("SIGTERM");
    if (child.exitCode !== null) {
      finish();
      return;
    }
    forceTimer = setTimeout(() => {
      if (child.exitCode === null) child.kill("SIGKILL");
      if (child.exitCode !== null) finish();
    }, FORCE_KILL_TIMEOUT_MS);
    forceTimer.unref?.();
    finishTimer = setTimeout(finish, FORCE_KILL_TIMEOUT_MS + 500);
    finishTimer.unref?.();
  });
}

class NowPlayingHlsService {
  constructor({
    cacheRoot,
    ffmpegPathResolver,
    spawnProcess = spawn,
    serverFactory = http.createServer,
    now = Date.now,
    debugLog = null,
  }) {
    this.cacheRoot = cacheRoot;
    this.ffmpegPathResolver = ffmpegPathResolver;
    this.spawnProcess = spawnProcess;
    this.serverFactory = serverFactory;
    this.now = now;
    this.debugLog = typeof debugLog === "function" ? debugLog : null;
    this.server = null;
    this.port = 0;
    this.sessions = new Map();
    this.cleanupTimer = null;
    this.creationGeneration = 0;
    this.activeCreation = null;
  }

  trace(event, details = {}) {
    this.debugLog?.(`[now-playing:hls] ${event}`, details);
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
        "Cache-Control": fileName.endsWith(".m3u8")
          ? "no-store"
          : "private, max-age=60",
        "Content-Length": stat.size,
        "Content-Type":
          HLS_CONTENT_TYPES[path.extname(fileName)] ||
          "application/octet-stream",
      });
      fs.createReadStream(filePath).pipe(response);
    } catch {
      response.writeHead(404).end();
    }
  }

  async createSession({ inputs, copyCodecs = false, allowLocal = false }) {
    const generation = ++this.creationGeneration;
    this.activeCreation?.abort();
    const creation = new AbortController();
    this.activeCreation = creation;
    this.trace("initialization-started", { generation });
    await Promise.all(
      [...this.sessions.keys()].map((id) => this.closeSession(id)),
    );
    if (generation !== this.creationGeneration || creation.signal.aborted) {
      throw createError(
        "PLAYBACK_SESSION_CANCELLED",
        "Playback session was superseded",
      );
    }
    const safeInputs = validateInputs(inputs, { allowLocal });
    const ffmpegPath = String(this.ffmpegPathResolver?.() || "");
    if (!ffmpegPath || ffmpegPath.includes("\u0000")) {
      throw createError(
        "FFMPEG_UNAVAILABLE",
        "FFmpeg is required for this playback format",
      );
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
    const session = {
      child,
      createdAt: this.now(),
      directory,
      id,
      inputs: [...safeInputs],
      token,
    };
    this.sessions.set(id, session);
    this.trace("instance-created", { generation, sessionId: id });
    try {
      await waitForManifest(manifestPath, child, { signal: creation.signal });
      if (generation !== this.creationGeneration || creation.signal.aborted) {
        throw createError(
          "PLAYBACK_SESSION_CANCELLED",
          "Playback session was superseded",
        );
      }
    } catch (error) {
      if (
        creation.signal.aborted ||
        generation !== this.creationGeneration ||
        error?.code === "PLAYBACK_SESSION_CANCELLED"
      ) {
        await this.closeSession(id);
        throw createError(
          "PLAYBACK_SESSION_CANCELLED",
          "Playback session was superseded",
        );
      }
      if (copyCodecs) {
        await this.closeSession(id);
        throw error;
      }
      if (child.exitCode === null) child.kill("SIGTERM");
      await fsPromises.rm(manifestPath, { force: true });
      child = spawnFfmpeg(false);
      session.child = child;
      try {
        await waitForManifest(manifestPath, child, { signal: creation.signal });
        if (generation !== this.creationGeneration || creation.signal.aborted) {
          throw createError(
            "PLAYBACK_SESSION_CANCELLED",
            "Playback session was superseded",
          );
        }
      } catch (fallbackError) {
        await this.closeSession(id);
        throw fallbackError;
      }
    }
    if (this.activeCreation === creation) this.activeCreation = null;
    this.trace("loading-completed", { generation, sessionId: id });
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
    this.trace("stopping", { sessionId: session.id });
    await terminateChild(session.child);
    await fsPromises.rm(session.directory, { recursive: true, force: true });
    this.trace("resources-released", { sessionId: session.id });
    return true;
  }

  getPreviewInputs(sessionId) {
    const session = this.sessions.get(String(sessionId || ""));
    return session ? [...session.inputs] : [];
  }

  async cleanupExpired() {
    const ordered = [...this.sessions.values()].sort(
      (a, b) => a.createdAt - b.createdAt,
    );
    const expired = new Set(
      ordered.filter(
        (session, index) =>
          this.now() - session.createdAt > SESSION_TTL_MS ||
          index < Math.max(0, ordered.length - MAX_SESSIONS),
      ),
    );
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
    await Promise.all(
      [...expired].map((session) => this.closeSession(session.id)),
    );
  }

  async getDirectorySize(directory) {
    try {
      const entries = await fsPromises.readdir(directory, {
        withFileTypes: true,
      });
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
    this.creationGeneration += 1;
    this.activeCreation?.abort();
    this.activeCreation = null;
    if (this.cleanupTimer) clearInterval(this.cleanupTimer);
    this.cleanupTimer = null;
    await Promise.all(
      [...this.sessions.keys()].map((id) => this.closeSession(id)),
    );
    if (!this.server) return;
    await new Promise((resolve) => this.server.close(resolve));
    this.server = null;
    this.port = 0;
    this.trace("service-destroyed");
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
