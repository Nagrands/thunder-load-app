// @ts-check

const crypto = require("crypto");
const fs = require("fs");
const fsPromises = fs.promises;
const http = require("http");
const path = require("path");
const { spawn } = require("child_process");
const {
  buildFfmpegArgs,
  buildMultiAudioFfmpegArgs,
  getMultiAudioVideoProfiles,
  validateInputs,
} = require("./nowPlayingHlsFfmpeg");
const { parseByteRange } = require("./nowPlayingHlsHttp");

const START_TIMEOUT_MS = 12_000;
const SESSION_TTL_MS = 6 * 60 * 60 * 1000;
const MAX_SESSIONS = 1;
const MAX_CACHE_BYTES = 10 * 1024 * 1024 * 1024;
const CLEANUP_INTERVAL_MS = 30_000;
const FORCE_KILL_TIMEOUT_MS = 1_500;
const SESSION_DIRECTORY_PATTERN =
  /^[a-f0-9]{8}-[a-f0-9]{4}-[1-5][a-f0-9]{3}-[89ab][a-f0-9]{3}-[a-f0-9]{12}$/i;
const HLS_CONTENT_TYPES = Object.freeze({
  ".m3u8": "application/vnd.apple.mpegurl",
  ".ts": "video/mp2t",
  ".m4s": "video/iso.segment",
});

function createError(code, message) {
  return Object.assign(new Error(message), { code });
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
    platform = process.platform,
  }) {
    this.cacheRoot = cacheRoot;
    this.ffmpegPathResolver = ffmpegPathResolver;
    this.spawnProcess = spawnProcess;
    this.serverFactory = serverFactory;
    this.now = now;
    this.platform = platform;
    this.debugLog = typeof debugLog === "function" ? debugLog : null;
    this.server = null;
    this.serverPromise = null;
    this.port = 0;
    this.sessions = new Map();
    this.cleanupTimer = null;
    this.creationGeneration = 0;
    this.activeCreation = null;
    this.orphansPurged = false;
  }

  trace(event, details = {}) {
    this.debugLog?.(`[now-playing:hls] ${event}`, details);
  }

  async ensureServer() {
    if (this.server) return;
    if (!this.serverPromise) {
      this.serverPromise = (async () => {
        await fsPromises.mkdir(this.cacheRoot, { recursive: true });
        await this.purgeOrphanedSessions();
        if (this.server) return;
        this.server = this.serverFactory((request, response) => {
          void this.serve(request, response);
        });
        await new Promise((resolve, reject) => {
          this.server.once("error", reject);
          this.server.listen(0, "127.0.0.1", () => {
            this.server.off("error", reject);
            const address = this.server.address();
            this.port =
              typeof address === "object" && address ? address.port : 0;
            this.cleanupTimer = setInterval(() => {
              void this.cleanupExpired();
            }, CLEANUP_INTERVAL_MS);
            this.cleanupTimer.unref?.();
            resolve();
          });
        });
      })();
    }
    try {
      await this.serverPromise;
    } catch (error) {
      this.server = null;
      throw error;
    } finally {
      this.serverPromise = null;
    }
  }

  async purgeOrphanedSessions() {
    if (this.orphansPurged) return;
    this.orphansPurged = true;
    let entries = [];
    try {
      entries = await fsPromises.readdir(this.cacheRoot, {
        withFileTypes: true,
      });
    } catch {
      return;
    }
    const activeIds = new Set(this.sessions.keys());
    await Promise.all(
      entries
        .filter(
          (entry) =>
            entry.isDirectory() &&
            SESSION_DIRECTORY_PATTERN.test(entry.name) &&
            !activeIds.has(entry.name),
        )
        .map((entry) =>
          fsPromises.rm(path.join(this.cacheRoot, entry.name), {
            recursive: true,
            force: true,
          }),
        ),
    );
  }

  async serve(request, response) {
    const match = /^\/([a-f0-9]{48})\/([a-f0-9-]{36})\/([^/]+)$/.exec(
      new URL(request.url || "/", "http://127.0.0.1").pathname,
    );
    const session = match ? this.sessions.get(match[2]) : null;
    const fileName = match?.[3] || "";
    if (
      !["GET", "HEAD"].includes(request.method) ||
      !session ||
      session.token !== match[1] ||
      !/^(?:index\.(?:m3u8|ts)|stream-[a-z0-9-]+\.(?:m3u8|ts))$/.test(fileName)
    ) {
      response.writeHead(404).end();
      return;
    }
    try {
      const filePath = path.join(session.directory, fileName);
      const stat = await fsPromises.stat(filePath);
      const range = parseByteRange(request.headers?.range, stat.size);
      if (range === false) {
        response
          .writeHead(416, {
            "Access-Control-Allow-Origin": "*",
            "Content-Range": `bytes */${stat.size}`,
          })
          .end();
        return;
      }
      session.lastAccessedAt = this.now();
      const headers = {
        "Accept-Ranges": "bytes",
        "Access-Control-Allow-Origin": "*",
        "Cache-Control": fileName.endsWith(".m3u8")
          ? "no-store"
          : "private, max-age=60",
        "Content-Length": range ? range.end - range.start + 1 : stat.size,
        "Content-Type":
          HLS_CONTENT_TYPES[path.extname(fileName)] ||
          "application/octet-stream",
      };
      if (range) {
        headers["Content-Range"] =
          `bytes ${range.start}-${range.end}/${stat.size}`;
      }
      response.writeHead(range ? 206 : 200, headers);
      if (request.method === "HEAD") {
        response.end();
        return;
      }
      fs.createReadStream(
        filePath,
        range ? { start: range.start, end: range.end } : undefined,
      ).pipe(response);
    } catch {
      response.writeHead(404).end();
    }
  }

  async createSession({
    inputs,
    copyCodecs = false,
    allowLocal = false,
    multiAudioTracks = [],
    includeVideo = true,
    copyVideo = false,
    startTime = 0,
  }) {
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
    if (generation !== this.creationGeneration || creation.signal.aborted) {
      throw createError(
        "PLAYBACK_SESSION_CANCELLED",
        "Playback session was superseded",
      );
    }
    const id = crypto.randomUUID();
    const token = crypto.randomBytes(24).toString("hex");
    const directory = path.join(this.cacheRoot, id);
    const manifestPath = path.join(directory, "index.m3u8");
    await fsPromises.mkdir(directory, { recursive: true });
    const hasMultipleAudioTracks =
      Array.isArray(multiAudioTracks) && multiAudioTracks.length > 1;
    const profiles = hasMultipleAudioTracks
      ? getMultiAudioVideoProfiles({
          copyVideo,
          includeVideo,
          platform: this.platform,
        })
      : copyCodecs
        ? [{ id: "copy", hardwareAcceleration: true }]
        : [
            { id: "hardware-decode", hardwareAcceleration: true },
            { id: "software", hardwareAcceleration: false },
          ];
    const spawnFfmpeg = (profile) =>
      this.spawnProcess(
        ffmpegPath,
        hasMultipleAudioTracks
          ? buildMultiAudioFfmpegArgs({
              audioTracks: multiAudioTracks,
              copyVideo,
              includeVideo,
              input: safeInputs[0],
              outputPath: manifestPath,
              startTime,
              videoEncoderArgs: profile.args,
            })
          : buildFfmpegArgs({
              inputs: safeInputs,
              copyCodecs,
              outputPath: manifestPath,
              hardwareAcceleration: profile.hardwareAcceleration,
            }),
        { stdio: ["ignore", "ignore", "pipe"], windowsHide: true },
      );
    const session = {
      child: null,
      createdAt: this.now(),
      directory,
      id,
      inputs: [...safeInputs],
      lastAccessedAt: this.now(),
      token,
    };
    this.sessions.set(id, session);
    this.trace("instance-created", { generation, sessionId: id });
    let lastError = null;
    for (const [index, profile] of profiles.entries()) {
      if (index > 0) {
        await fsPromises.rm(directory, { recursive: true, force: true });
        await fsPromises.mkdir(directory, { recursive: true });
      }
      const child = spawnFfmpeg(profile);
      session.child = child;
      this.trace("encoder-attempt-started", {
        encoder: profile.id,
        generation,
        sessionId: id,
      });
      try {
        await waitForManifest(manifestPath, child, { signal: creation.signal });
        if (generation !== this.creationGeneration || creation.signal.aborted) {
          throw createError(
            "PLAYBACK_SESSION_CANCELLED",
            "Playback session was superseded",
          );
        }
        lastError = null;
        break;
      } catch (error) {
        lastError = error;
        await terminateChild(child);
        if (
          creation.signal.aborted ||
          generation !== this.creationGeneration ||
          error?.code === "PLAYBACK_SESSION_CANCELLED"
        ) {
          break;
        }
        this.trace("encoder-attempt-failed", {
          code: error?.code || "HLS_TRANSCODE_FAILED",
          encoder: profile.id,
          generation,
          sessionId: id,
        });
      }
    }
    if (lastError) {
      await this.closeSession(id);
      if (
        creation.signal.aborted ||
        generation !== this.creationGeneration ||
        lastError?.code === "PLAYBACK_SESSION_CANCELLED"
      ) {
        throw createError(
          "PLAYBACK_SESSION_CANCELLED",
          "Playback session was superseded",
        );
      }
      throw lastError;
    }
    if (this.activeCreation === creation) this.activeCreation = null;
    this.trace("loading-completed", { generation, sessionId: id });
    return {
      kind: "hls",
      sessionId: id,
      src: `http://127.0.0.1:${this.port}/${token}/${id}/index.m3u8`,
      mimeType: HLS_CONTENT_TYPES[".m3u8"],
      timelineOffset: Math.max(0, Number(startTime) || 0),
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
          this.now() - session.lastAccessedAt > SESSION_TTL_MS ||
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
    if (this.serverPromise) {
      try {
        await this.serverPromise;
      } catch {
        // A failed server startup has no resources left to close.
      }
      this.serverPromise = null;
    }
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
  buildMultiAudioFfmpegArgs,
  getMultiAudioVideoProfiles,
  parseByteRange,
  validateInputs,
};
