const crypto = require("crypto");
const fs = require("fs");
const path = require("path");
const { execFile } = require("child_process");
const { promisify } = require("util");
const { pathToFileURL } = require("url");

const execFileAsync = promisify(execFile);

const AUDIO_EXTENSIONS = new Set([
  ".aac",
  ".flac",
  ".m4a",
  ".mp3",
  ".oga",
  ".ogg",
  ".opus",
  ".wav",
  ".weba",
]);
const PLAYLIST_EXTENSIONS = new Set([".m3u", ".m3u8"]);
const MAX_PLAYLIST_BYTES = 1024 * 1024;
const MAX_PLAYLIST_ENTRIES = 1000;
const VIDEO_EXTENSIONS = new Set([
  ".avi",
  ".m4v",
  ".mkv",
  ".mov",
  ".mp4",
  ".mpeg",
  ".mpg",
  ".webm",
]);
const MEDIA_EXTENSIONS = new Set([...AUDIO_EXTENSIONS, ...VIDEO_EXTENSIONS]);
const MIME_TYPES = Object.freeze({
  ".aac": "audio/aac",
  ".flac": "audio/flac",
  ".m4a": "audio/mp4",
  ".mp3": "audio/mpeg",
  ".oga": "audio/ogg",
  ".ogg": "audio/ogg",
  ".opus": "audio/ogg",
  ".wav": "audio/wav",
  ".weba": "audio/webm",
  ".m4v": "video/mp4",
  ".avi": "video/x-msvideo",
  ".mkv": "video/x-matroska",
  ".mov": "video/quicktime",
  ".mp4": "video/mp4",
  ".mpeg": "video/mpeg",
  ".mpg": "video/mpeg",
  ".webm": "video/webm",
});

function normalizeSourcePath(filePath) {
  const normalized = path.normalize(path.resolve(filePath));
  return process.platform === "win32" ? normalized.toLowerCase() : normalized;
}

function isHiddenName(name) {
  return typeof name === "string" && name.startsWith(".");
}

function isSupportedMediaPath(filePath) {
  return MEDIA_EXTENSIONS.has(path.extname(filePath).toLowerCase());
}

function isSupportedPlaylistPath(filePath) {
  return PLAYLIST_EXTENSIONS.has(path.extname(filePath).toLowerCase());
}

function isYouTubeUrl(url) {
  const hostname = url.hostname.toLowerCase();
  return (
    hostname === "youtu.be" ||
    hostname === "youtube.com" ||
    hostname.endsWith(".youtube.com")
  );
}

function parseNetworkMediaUrl(value) {
  try {
    const url = new URL(value);
    if (!["http:", "https:"].includes(url.protocol) || isYouTubeUrl(url)) {
      return null;
    }
    return isSupportedMediaPath(url.pathname) ||
      path.extname(url.pathname).toLowerCase() === ".m3u8"
      ? url.toString()
      : null;
  } catch {
    return null;
  }
}

function sanitizePlaylistLine(value) {
  const line = value.trim();
  if (!line || line.startsWith("#") || line.includes("\u0000")) return null;
  return line;
}

async function parseMediaPlaylist(playlistPath, options = {}) {
  if (
    typeof playlistPath !== "string" ||
    playlistPath.includes("\u0000") ||
    !path.isAbsolute(playlistPath) ||
    !isSupportedPlaylistPath(playlistPath)
  ) {
    return [];
  }
  const maxBytes = Math.min(
    MAX_PLAYLIST_BYTES,
    Math.max(1, Number(options.maxPlaylistBytes) || MAX_PLAYLIST_BYTES),
  );
  const handle = await fs.promises.open(playlistPath, "r");
  let content;
  try {
    const stat = await handle.stat();
    if (!stat.isFile() || stat.size > maxBytes) return [];
    const buffer = Buffer.alloc(maxBytes + 1);
    const { bytesRead } = await handle.read(buffer, 0, buffer.length, 0);
    if (bytesRead > maxBytes) return [];
    content = buffer.subarray(0, bytesRead).toString("utf8");
  } finally {
    await handle.close();
  }
  const maxEntries = Math.min(
    MAX_PLAYLIST_ENTRIES,
    Math.max(1, Number(options.maxPlaylistEntries) || MAX_PLAYLIST_ENTRIES),
  );
  const entries = [];
  const seen = new Set();
  for (const rawLine of content.replace(/^\uFEFF/, "").split(/\r\n?|\n/u)) {
    const line = sanitizePlaylistLine(rawLine);
    if (!line || entries.length >= maxEntries) continue;
    try {
      const url = new URL(line);
      if (isYouTubeUrl(url)) {
        options.onWarning?.({
          code: "YOUTUBE_REQUIRES_QUALITY",
          source: line,
        });
        continue;
      }
    } catch {
      // Relative and absolute filesystem paths are handled below.
    }
    const networkUrl = parseNetworkMediaUrl(line);
    let entry = networkUrl;
    if (!entry && !/^\w+:\/\//u.test(line)) {
      const localPath = path.isAbsolute(line)
        ? path.normalize(line)
        : path.resolve(path.dirname(playlistPath), line);
      if (isSupportedMediaPath(localPath)) entry = localPath;
    }
    if (!entry) continue;
    const key = /^https?:/iu.test(entry) ? entry : normalizeSourcePath(entry);
    if (seen.has(key)) continue;
    seen.add(key);
    entries.push(entry);
  }
  return entries;
}

function fallbackTitle(filePath) {
  return path.basename(filePath, path.extname(filePath)).trim() || "Unknown";
}

function cleanTag(value) {
  const text = String(value ?? "").trim();
  return text || null;
}

function createTrackId(filePath) {
  return crypto
    .createHash("sha256")
    .update(normalizeSourcePath(filePath))
    .digest("hex")
    .slice(0, 24);
}

async function scanMediaDirectory(rootPath) {
  const files = [];
  const rootStat = await fs.promises.lstat(rootPath);
  if (!rootStat.isDirectory() || rootStat.isSymbolicLink()) return files;
  const visit = async (directoryPath) => {
    const entries = await fs.promises.readdir(directoryPath, {
      withFileTypes: true,
    });
    entries.sort((a, b) => a.name.localeCompare(b.name));
    for (const entry of entries) {
      if (isHiddenName(entry.name) || entry.isSymbolicLink()) continue;
      const entryPath = path.join(directoryPath, entry.name);
      if (entry.isDirectory()) {
        await visit(entryPath);
      } else if (
        entry.isFile() &&
        (isSupportedMediaPath(entryPath) || isSupportedPlaylistPath(entryPath))
      ) {
        files.push(entryPath);
      }
    }
  };
  await visit(rootPath);
  return files;
}

function getProbeTags(probe = {}) {
  const safeProbe = probe && typeof probe === "object" ? probe : {};
  const streams = Array.isArray(safeProbe.streams) ? safeProbe.streams : [];
  const audio = streams.find((stream) => stream.codec_type === "audio");
  return {
    ...(audio?.tags || {}),
    ...(safeProbe.format?.tags || {}),
  };
}

function getDuration(probe = {}) {
  const safeProbe = probe && typeof probe === "object" ? probe : {};
  const streams = Array.isArray(safeProbe.streams) ? safeProbe.streams : [];
  const candidates = [
    safeProbe.format?.duration,
    ...streams.map((stream) => stream.duration),
  ];
  const duration = candidates.map(Number).find(Number.isFinite);
  return duration && duration > 0 ? duration : 0;
}

async function readMetadata(filePath, ffprobePath) {
  if (!ffprobePath) return null;
  try {
    const { stdout } = await execFileAsync(
      ffprobePath,
      [
        "-v",
        "error",
        "-show_entries",
        "format=duration:format_tags=title,artist,album:stream=index,codec_type,disposition,duration:stream_tags=title,artist,album",
        "-of",
        "json",
        filePath,
      ],
      { maxBuffer: 4 * 1024 * 1024, timeout: 15000, windowsHide: true },
    );
    return JSON.parse(stdout);
  } catch {
    return null;
  }
}

function findArtworkStream(probe = {}) {
  const safeProbe = probe && typeof probe === "object" ? probe : {};
  const streams = Array.isArray(safeProbe.streams) ? safeProbe.streams : [];
  return streams.find(
    (stream) =>
      stream.codec_type === "video" &&
      Number(stream.disposition?.attached_pic) === 1,
  );
}

async function extractArtwork({
  artworkDir,
  ffmpegPath,
  filePath,
  probe,
  stat,
}) {
  const artworkStream = findArtworkStream(probe);
  if (!artworkDir || !ffmpegPath || !artworkStream) return null;
  const cacheKey = crypto
    .createHash("sha256")
    .update(`${normalizeSourcePath(filePath)}:${stat.size}:${stat.mtimeMs}`)
    .digest("hex");
  const artworkPath = path.join(artworkDir, `${cacheKey}.jpg`);
  try {
    await fs.promises.mkdir(artworkDir, { recursive: true });
    if (!fs.existsSync(artworkPath)) {
      await execFileAsync(
        ffmpegPath,
        [
          "-v",
          "error",
          "-y",
          "-i",
          filePath,
          "-map",
          `0:${artworkStream.index}`,
          "-frames:v",
          "1",
          artworkPath,
        ],
        { maxBuffer: 1024 * 1024, timeout: 20000, windowsHide: true },
      );
    }
    return pathToFileURL(artworkPath).href;
  } catch {
    return null;
  }
}

async function createTrack(filePath, options = {}) {
  const stat = await fs.promises.stat(filePath);
  if (!stat.isFile() || !isSupportedMediaPath(filePath)) return null;
  const probe = await readMetadata(filePath, options.ffprobePath);
  const tags = getProbeTags(probe);
  const extension = path.extname(filePath).toLowerCase();
  const artworkUrl = await extractArtwork({
    artworkDir: options.artworkDir,
    ffmpegPath: options.ffmpegPath,
    filePath,
    probe,
    stat,
  });
  return {
    id: createTrackId(filePath),
    providerId: "local",
    sourceRef: path.resolve(filePath),
    title: cleanTag(tags.title) || fallbackTitle(filePath),
    displayTitle: cleanTag(tags.title) || fallbackTitle(filePath),
    artist: cleanTag(tags.artist) || "",
    album: cleanTag(tags.album) || "",
    duration: getDuration(probe),
    artworkUrl,
    kind: VIDEO_EXTENSIONS.has(extension) ? "video" : "audio",
    availability: "available",
    mimeType: MIME_TYPES[extension] || "",
    sizeBytes: stat.size,
    qualitySelection: null,
    playbackUrl: pathToFileURL(path.resolve(filePath)).href,
  };
}

function createNetworkTrack(sourceRef) {
  const url = new URL(sourceRef);
  const extension = path.extname(url.pathname).toLowerCase();
  const decodedPath = (() => {
    try {
      return decodeURIComponent(url.pathname);
    } catch {
      return url.pathname;
    }
  })();
  const title = fallbackTitle(decodedPath);
  return {
    id: `network:${crypto
      .createHash("sha256")
      .update(sourceRef)
      .digest("hex")
      .slice(0, 24)}`,
    providerId: "network",
    sourceRef,
    title,
    displayTitle: title,
    artist: "",
    album: "",
    duration: 0,
    artworkUrl: null,
    kind:
      VIDEO_EXTENSIONS.has(extension) || extension === ".m3u8"
        ? "video"
        : "audio",
    availability: "available",
    mimeType:
      extension === ".m3u8"
        ? "application/vnd.apple.mpegurl"
        : MIME_TYPES[extension] || "",
    sizeBytes: 0,
    qualitySelection: null,
    playbackUrl: sourceRef,
  };
}

async function importMediaPaths(filePaths, options = {}) {
  const tracks = [];
  const seen = new Set();
  const candidates = [];
  for (const filePath of Array.isArray(filePaths) ? filePaths : []) {
    if (typeof filePath !== "string" || filePath.includes("\u0000")) continue;
    if (path.isAbsolute(filePath) && isSupportedPlaylistPath(filePath)) {
      try {
        candidates.push(...(await parseMediaPlaylist(filePath, options)));
      } catch {}
    } else {
      candidates.push(filePath);
    }
  }
  for (const filePath of candidates) {
    const networkUrl = parseNetworkMediaUrl(filePath);
    if (networkUrl) {
      if (seen.has(networkUrl)) continue;
      seen.add(networkUrl);
      tracks.push(createNetworkTrack(networkUrl));
      continue;
    }
    if (
      typeof filePath !== "string" ||
      filePath.includes("\u0000") ||
      !path.isAbsolute(filePath) ||
      !isSupportedMediaPath(filePath)
    ) {
      continue;
    }
    const normalized = normalizeSourcePath(filePath);
    if (seen.has(normalized)) continue;
    seen.add(normalized);
    try {
      const track = await createTrack(filePath, options);
      if (track) tracks.push(track);
    } catch {}
  }
  return tracks;
}

async function refreshAvailability(track) {
  const sourceRef = track?.sourceRef;
  if (typeof sourceRef !== "string" || !path.isAbsolute(sourceRef)) {
    return { ...track, availability: "missing", playbackUrl: null };
  }
  try {
    const stat = await fs.promises.stat(sourceRef);
    if (!stat.isFile() || !isSupportedMediaPath(sourceRef)) throw new Error();
    return {
      ...track,
      availability: "available",
      playbackUrl: pathToFileURL(sourceRef).href,
    };
  } catch {
    return { ...track, availability: "missing", playbackUrl: null };
  }
}

module.exports = {
  AUDIO_EXTENSIONS,
  MAX_PLAYLIST_BYTES,
  MAX_PLAYLIST_ENTRIES,
  MEDIA_EXTENSIONS,
  PLAYLIST_EXTENSIONS,
  VIDEO_EXTENSIONS,
  createTrackId,
  createTrack,
  importMediaPaths,
  isSupportedMediaPath,
  isSupportedPlaylistPath,
  normalizeSourcePath,
  parseMediaPlaylist,
  refreshAvailability,
  scanMediaDirectory,
};
