const path = require("path");
const {
  createTrackId,
  isSupportedMediaPath,
  normalizeSourcePath,
} = require("./nowPlayingLibrary");

const STATE_VERSION = 2;
const LIBRARY_PLAYLIST_ID = "media-library";
const MAX_TRACKS = 5000;
const MAX_PLAYLISTS = 500;
const REPEAT_MODES = new Set(["off", "all", "one"]);

function sanitizeText(value, maxLength = 512) {
  return typeof value === "string" ? value.slice(0, maxLength).trim() : "";
}

function canonicalizeYouTubeUrl(value) {
  try {
    const parsed = new URL(sanitizeText(value, 2048));
    if (!["http:", "https:"].includes(parsed.protocol)) return null;
    const host = parsed.hostname.toLowerCase();
    const isYouTubeHost =
      host === "youtube.com" || host.endsWith(".youtube.com");
    let videoId = "";
    if (host === "youtu.be") {
      videoId = parsed.pathname.split("/").filter(Boolean)[0] || "";
    } else if (isYouTubeHost) {
      if (parsed.pathname === "/playlist" || parsed.searchParams.has("list")) {
        return null;
      }
      if (parsed.pathname === "/watch") {
        videoId = parsed.searchParams.get("v") || "";
      } else {
        const match = parsed.pathname.match(
          /^\/(?:shorts|live|embed)\/([^/]+)/,
        );
        videoId = match?.[1] || "";
      }
    }
    if (!/^[A-Za-z0-9_-]{6,64}$/.test(videoId)) return null;
    return {
      videoId,
      url: `https://www.youtube.com/watch?v=${videoId}`,
    };
  } catch {
    return null;
  }
}

function sanitizeArtworkUrl(value, providerId) {
  const artworkUrl = sanitizeText(value, 32768);
  if (!artworkUrl) return null;
  if (providerId === "local") return artworkUrl;
  try {
    const parsed = new URL(artworkUrl);
    return ["http:", "https:"].includes(parsed.protocol)
      ? parsed.toString()
      : null;
  } catch {
    return null;
  }
}

function sanitizeLocalTrack(track) {
  const sourceRef = sanitizeText(track.sourceRef, 32768);
  if (
    !sourceRef ||
    sourceRef.includes("\u0000") ||
    !path.isAbsolute(sourceRef) ||
    !isSupportedMediaPath(sourceRef)
  ) {
    return null;
  }
  const duration = Number(track.duration);
  return {
    id: sanitizeText(track.id, 128) || createTrackId(sourceRef),
    providerId: "local",
    sourceRef: path.resolve(sourceRef),
    title: sanitizeText(track.title, 1024) || path.basename(sourceRef),
    artist: sanitizeText(track.artist, 1024),
    album: sanitizeText(track.album, 1024),
    duration: Number.isFinite(duration) && duration >= 0 ? duration : 0,
    artworkUrl: sanitizeArtworkUrl(track.artworkUrl, "local"),
    kind: track.kind === "video" ? "video" : "audio",
    availability: track.availability === "missing" ? "missing" : "available",
    mimeType: sanitizeText(track.mimeType, 128),
  };
}

function sanitizeYouTubeTrack(track) {
  const source = canonicalizeYouTubeUrl(track.sourceRef);
  if (!source) return null;
  const duration = Number(track.duration);
  return {
    id: sanitizeText(track.id, 128) || `youtube:${source.videoId}`,
    providerId: "youtube",
    sourceRef: source.url,
    title: sanitizeText(track.title, 1024) || "YouTube video",
    artist: sanitizeText(track.artist, 1024),
    album: sanitizeText(track.album, 1024),
    duration: Number.isFinite(duration) && duration >= 0 ? duration : 0,
    artworkUrl: sanitizeArtworkUrl(track.artworkUrl, "youtube"),
    kind: "video",
    availability:
      track.availability === "unavailable" ? "unavailable" : "available",
    mimeType: sanitizeText(track.mimeType, 128) || "video/mp4",
  };
}

function sanitizeTrack(track) {
  if (!track || typeof track !== "object") return null;
  return track.providerId === "youtube"
    ? sanitizeYouTubeTrack(track)
    : sanitizeLocalTrack(track);
}

function sanitizeTimestamp(value) {
  const timestamp = Number(value);
  return Number.isFinite(timestamp) && timestamp >= 0
    ? Math.trunc(timestamp)
    : 0;
}

function getTrackKey(track) {
  if (track.providerId === "youtube") {
    return canonicalizeYouTubeUrl(track.sourceRef)?.videoId || track.id;
  }
  return normalizeSourcePath(track.sourceRef);
}

function sanitizeTracks(sourceTracks) {
  const candidates = Array.isArray(sourceTracks) ? sourceTracks : [];
  const tracks = [];
  const seenKeys = new Set();
  const seenIds = new Set();
  for (const sourceTrack of candidates.slice(0, MAX_TRACKS)) {
    const track = sanitizeTrack(sourceTrack);
    if (!track) continue;
    const key = `${track.providerId}:${getTrackKey(track)}`;
    if (seenKeys.has(key) || seenIds.has(track.id)) continue;
    seenKeys.add(key);
    seenIds.add(track.id);
    tracks.push(track);
  }
  return tracks;
}

function sanitizePlaylists(source, tracks) {
  const validTrackIds = new Set(tracks.map((track) => track.id));
  const playlists = [];
  const seenPlaylistIds = new Set([LIBRARY_PLAYLIST_ID]);
  const sourcePlaylists = Array.isArray(source.playlists)
    ? source.playlists
    : [];
  for (const item of sourcePlaylists.slice(0, MAX_PLAYLISTS)) {
    if (!item || typeof item !== "object") continue;
    const id = sanitizeText(item.id, 128);
    if (!id || seenPlaylistIds.has(id)) continue;
    const trackIds = [];
    const seenTrackIds = new Set();
    for (const rawTrackId of Array.isArray(item.trackIds)
      ? item.trackIds
      : []) {
      const trackId = sanitizeText(rawTrackId, 128);
      if (
        !validTrackIds.has(trackId) ||
        seenTrackIds.has(trackId) ||
        trackIds.length >= MAX_TRACKS
      ) {
        continue;
      }
      seenTrackIds.add(trackId);
      trackIds.push(trackId);
    }
    seenPlaylistIds.add(id);
    playlists.push({
      id,
      title: sanitizeText(item.title, 256) || "Playlist",
      trackIds,
      createdAt: sanitizeTimestamp(item.createdAt),
      updatedAt: sanitizeTimestamp(item.updatedAt),
    });
  }
  return playlists;
}

function defaultState() {
  return {
    version: STATE_VERSION,
    catalog: { tracks: [] },
    playlists: sanitizePlaylists({}, []),
    activePlaylistId: LIBRARY_PLAYLIST_ID,
    selectedTrackId: null,
    volume: 1,
    muted: false,
    shuffle: false,
    repeat: "off",
    backgroundPlayback: true,
    sidebarPinned: false,
  };
}

function sanitizeState(value) {
  const source = value && typeof value === "object" ? value : {};
  const isLegacyState =
    !Array.isArray(source.catalog?.tracks) &&
    Array.isArray(source.playlist?.tracks);
  const tracks = sanitizeTracks(
    isLegacyState ? source.playlist.tracks : source.catalog?.tracks,
  );
  const playlists = sanitizePlaylists(isLegacyState ? {} : source, tracks);
  const requestedPlaylistId = sanitizeText(source.activePlaylistId, 128);
  const activePlaylistId =
    requestedPlaylistId === LIBRARY_PLAYLIST_ID ||
    playlists.some((playlist) => playlist.id === requestedPlaylistId)
      ? requestedPlaylistId
      : LIBRARY_PLAYLIST_ID;
  const activeTrackIds =
    activePlaylistId === LIBRARY_PLAYLIST_ID
      ? tracks.map((track) => track.id)
      : playlists.find((playlist) => playlist.id === activePlaylistId)
          ?.trackIds || [];
  const requestedTrackId =
    sanitizeText(source.selectedTrackId, 128) ||
    sanitizeText(source.currentTrackId, 128);
  const selectedTrackId = activeTrackIds.includes(requestedTrackId)
    ? requestedTrackId
    : activeTrackIds[0] || null;
  const volume = Number(source.volume);
  return {
    version: STATE_VERSION,
    catalog: { tracks },
    playlists,
    activePlaylistId,
    selectedTrackId,
    volume: Number.isFinite(volume) ? Math.min(1, Math.max(0, volume)) : 1,
    muted: Boolean(source.muted),
    shuffle: Boolean(source.shuffle),
    repeat: REPEAT_MODES.has(source.repeat) ? source.repeat : "off",
    backgroundPlayback:
      typeof source.backgroundPlayback === "boolean"
        ? source.backgroundPlayback
        : true,
    sidebarPinned:
      typeof source.sidebarPinned === "boolean" ? source.sidebarPinned : false,
  };
}

module.exports = {
  LIBRARY_PLAYLIST_ID,
  MAX_TRACKS,
  STATE_VERSION,
  canonicalizeYouTubeUrl,
  defaultState,
  getTrackKey,
  sanitizeState,
  sanitizeTrack,
};
