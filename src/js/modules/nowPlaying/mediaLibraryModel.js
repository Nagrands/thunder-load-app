import { normalizeLocalTrack } from "./localMusicProvider.js";
import { getYouTubeVideoId, normalizeYouTubeTrack } from "./youtubeProvider.js";

export const MEDIA_LIBRARY_ID = "media-library";
export const MEDIA_LIBRARY_STATE_VERSION = 2;

const MAX_TITLE_LENGTH = 160;

function cleanTitle(value, fallback = "Playlist") {
  return (
    String(value || "")
      .trim()
      .slice(0, MAX_TITLE_LENGTH) || fallback
  );
}

function normalizeGenericTrack(track = {}, index = 0) {
  const duration = Number(track.duration);
  return {
    id: String(track.id || `${track.providerId || "unknown"}:${index}`),
    providerId: String(track.providerId || "unknown"),
    sourceRef: String(track.sourceRef || ""),
    title: String(track.title || "Unknown media"),
    artist: String(track.artist || ""),
    album: String(track.album || ""),
    duration: Number.isFinite(duration) && duration >= 0 ? duration : 0,
    artworkUrl: String(track.artworkUrl || ""),
    kind: track.kind === "video" ? "video" : "audio",
    availability: String(track.availability || "available"),
    mimeType: String(track.mimeType || ""),
  };
}

function normalizeTrack(track, index) {
  if (track?.providerId === "youtube") return normalizeYouTubeTrack(track);
  if (!track?.providerId || track.providerId === "local") {
    const { playback: _playback, ...normalized } = normalizeLocalTrack(
      track,
      index,
    );
    return normalized;
  }
  return normalizeGenericTrack(track, index);
}

function getTrackKey(track) {
  if (track.providerId === "youtube") {
    return `youtube:${getYouTubeVideoId(track.sourceRef) || track.id}`;
  }
  if (track.providerId === "local") {
    const path = String(track.sourceRef).replaceAll("\\", "/");
    return `local:${/^[A-Z]:/i.test(path) ? path.toLowerCase() : path}`;
  }
  return `${track.providerId}:${track.sourceRef || track.id}`;
}

function createIdFactory() {
  let sequence = 0;
  return () =>
    `playlist-${Date.now().toString(36)}-${(++sequence).toString(36)}`;
}

function cloneState(state) {
  return {
    ...state,
    catalog: {
      tracks: state.catalog.tracks.map((track) => ({ ...track })),
    },
    playlists: state.playlists.map((playlist) => ({
      ...playlist,
      trackIds: [...playlist.trackIds],
    })),
  };
}

function collectCatalog(sourceTracks) {
  const tracks = [];
  const seen = new Map();
  const idMap = new Map();
  sourceTracks.forEach((sourceTrack, index) => {
    try {
      const track = normalizeTrack(sourceTrack, index);
      const key = getTrackKey(track);
      const existing = seen.get(key);
      if (existing) {
        idMap.set(String(sourceTrack?.id || track.id), existing.id);
        return;
      }
      seen.set(key, track);
      idMap.set(String(sourceTrack?.id || track.id), track.id);
      idMap.set(track.id, track.id);
      tracks.push(track);
    } catch {
      // Invalid provider descriptors are ignored without breaking the library.
    }
  });
  return { tracks, idMap };
}

function normalizePlaylists(playlists, validIds, idMap, now) {
  const seenIds = new Set();
  return (Array.isArray(playlists) ? playlists : []).reduce(
    (result, playlist, index) => {
      const id = String(playlist?.id || `playlist-${index + 1}`);
      if (id === MEDIA_LIBRARY_ID || seenIds.has(id)) return result;
      seenIds.add(id);
      const trackIds = [];
      const seenTracks = new Set();
      (Array.isArray(playlist?.trackIds) ? playlist.trackIds : []).forEach(
        (sourceId) => {
          const trackId = idMap.get(String(sourceId)) || String(sourceId);
          if (!validIds.has(trackId) || seenTracks.has(trackId)) return;
          seenTracks.add(trackId);
          trackIds.push(trackId);
        },
      );
      result.push({
        id,
        title: cleanTitle(playlist?.title),
        trackIds,
        createdAt: String(playlist?.createdAt || now),
        updatedAt: String(playlist?.updatedAt || now),
      });
      return result;
    },
    [],
  );
}

export function normalizeMediaLibraryState(
  source = {},
  { now = Date.now() } = {},
) {
  const legacyTracks = Array.isArray(source.playlist?.tracks)
    ? source.playlist.tracks
    : [];
  const sourceTracks = Array.isArray(source.catalog?.tracks)
    ? source.catalog.tracks
    : legacyTracks;
  const { tracks, idMap } = collectCatalog(sourceTracks);
  const validIds = new Set(tracks.map((track) => track.id));
  const playlists = normalizePlaylists(source.playlists, validIds, idMap, now);
  const requestedActiveId =
    source.version === MEDIA_LIBRARY_STATE_VERSION
      ? String(source.activePlaylistId || MEDIA_LIBRARY_ID)
      : MEDIA_LIBRARY_ID;
  const activePlaylistId =
    requestedActiveId === MEDIA_LIBRARY_ID ||
    playlists.some((playlist) => playlist.id === requestedActiveId)
      ? requestedActiveId
      : MEDIA_LIBRARY_ID;
  const selectedTrackId =
    idMap.get(String(source.selectedTrackId || "")) ||
    String(source.selectedTrackId || "");
  return {
    version: MEDIA_LIBRARY_STATE_VERSION,
    catalog: { tracks },
    playlists,
    activePlaylistId,
    selectedTrackId: validIds.has(selectedTrackId) ? selectedTrackId : null,
    volume: Number.isFinite(Number(source.volume))
      ? Math.min(1, Math.max(0, Number(source.volume)))
      : 1,
    muted: source.muted === true,
    shuffle: source.shuffle === true,
    repeat: ["off", "all", "one"].includes(source.repeat)
      ? source.repeat
      : "off",
    backgroundPlayback:
      typeof source.backgroundPlayback === "boolean"
        ? source.backgroundPlayback
        : true,
    sidebarPinned: source.sidebarPinned === true,
  };
}

export function getActiveTracksFromState(source = {}) {
  const state = normalizeMediaLibraryState(source);
  if (state.activePlaylistId === MEDIA_LIBRARY_ID) {
    return state.catalog.tracks.map((track) => ({ ...track }));
  }
  const playlist = state.playlists.find(
    (item) => item.id === state.activePlaylistId,
  );
  const tracksById = new Map(
    state.catalog.tracks.map((track) => [track.id, track]),
  );
  return (playlist?.trackIds || [])
    .map((trackId) => tracksById.get(trackId))
    .filter(Boolean)
    .map((track) => ({ ...track }));
}

export class MediaLibraryModel {
  constructor(
    state = {},
    { idFactory = createIdFactory(), now = () => Date.now() } = {},
  ) {
    this.idFactory = idFactory;
    this.now = now;
    this.state = normalizeMediaLibraryState(state, { now: this.now() });
  }

  getState() {
    return cloneState(this.state);
  }

  getActiveTracks() {
    return getActiveTracksFromState(this.state);
  }

  getPlaylist(playlistId) {
    const playlist = this.state.playlists.find(
      (item) => item.id === playlistId,
    );
    return playlist ? { ...playlist, trackIds: [...playlist.trackIds] } : null;
  }

  addTracks(tracks = [], { playlistId = this.state.activePlaylistId } = {}) {
    const existingKeys = new Map(
      this.state.catalog.tracks.map((track) => [getTrackKey(track), track]),
    );
    const addedTrackIds = [];
    tracks.forEach((sourceTrack, index) => {
      try {
        const track = normalizeTrack(sourceTrack, index);
        const existing = existingKeys.get(getTrackKey(track));
        const trackId = existing?.id || track.id;
        if (!existing) {
          this.state.catalog.tracks.push(track);
          existingKeys.set(getTrackKey(track), track);
        }
        if (!addedTrackIds.includes(trackId)) addedTrackIds.push(trackId);
      } catch {
        // A malformed item must not prevent importing the remaining media.
      }
    });
    if (playlistId !== MEDIA_LIBRARY_ID) {
      addedTrackIds.forEach((trackId) =>
        this.addTrackToPlaylist(trackId, playlistId),
      );
    }
    return addedTrackIds;
  }

  createPlaylist(title, { trackIds = [] } = {}) {
    const baseId = String(this.idFactory());
    let id = baseId;
    let suffix = 2;
    while (
      id === MEDIA_LIBRARY_ID ||
      this.state.playlists.some((playlist) => playlist.id === id)
    ) {
      id = `${baseId}-${suffix}`;
      suffix += 1;
    }
    const timestamp = this.now();
    const validIds = new Set(
      this.state.catalog.tracks.map((track) => track.id),
    );
    const playlist = {
      id,
      title: cleanTitle(title),
      trackIds: [...new Set(trackIds)].filter((trackId) =>
        validIds.has(trackId),
      ),
      createdAt: String(timestamp),
      updatedAt: String(timestamp),
    };
    this.state.playlists.push(playlist);
    return { ...playlist, trackIds: [...playlist.trackIds] };
  }

  renamePlaylist(playlistId, title) {
    const playlist = this.state.playlists.find(
      (item) => item.id === playlistId,
    );
    if (!playlist) return false;
    playlist.title = cleanTitle(title);
    playlist.updatedAt = String(this.now());
    return true;
  }

  deletePlaylist(playlistId) {
    const index = this.state.playlists.findIndex(
      (item) => item.id === playlistId,
    );
    if (index === -1) return false;
    this.state.playlists.splice(index, 1);
    if (this.state.activePlaylistId === playlistId) {
      this.state.activePlaylistId = MEDIA_LIBRARY_ID;
    }
    return true;
  }

  setActivePlaylist(playlistId) {
    if (
      playlistId !== MEDIA_LIBRARY_ID &&
      !this.state.playlists.some((playlist) => playlist.id === playlistId)
    ) {
      return false;
    }
    this.state.activePlaylistId = playlistId;
    const activeIds = new Set(this.getActiveTracks().map((track) => track.id));
    if (!activeIds.has(this.state.selectedTrackId)) {
      this.state.selectedTrackId = null;
    }
    return true;
  }

  addTrackToPlaylist(trackId, playlistId) {
    const playlist = this.state.playlists.find(
      (item) => item.id === playlistId,
    );
    if (
      !playlist ||
      !this.state.catalog.tracks.some((track) => track.id === trackId) ||
      playlist.trackIds.includes(trackId)
    ) {
      return false;
    }
    playlist.trackIds.push(trackId);
    playlist.updatedAt = String(this.now());
    return true;
  }

  removeTrackFromPlaylist(trackId, playlistId) {
    const playlist = this.state.playlists.find(
      (item) => item.id === playlistId,
    );
    const index = playlist?.trackIds.indexOf(trackId) ?? -1;
    if (!playlist || index === -1) return false;
    playlist.trackIds.splice(index, 1);
    playlist.updatedAt = String(this.now());
    if (
      this.state.activePlaylistId === playlistId &&
      this.state.selectedTrackId === trackId
    ) {
      this.state.selectedTrackId = null;
    }
    return true;
  }

  reorderTrack(playlistId, trackId, targetIndex) {
    const playlist = this.state.playlists.find(
      (item) => item.id === playlistId,
    );
    const sourceIndex = playlist?.trackIds.indexOf(trackId) ?? -1;
    if (!playlist || sourceIndex === -1) return false;
    const boundedIndex = Math.max(
      0,
      Math.min(Number(targetIndex) || 0, playlist.trackIds.length - 1),
    );
    playlist.trackIds.splice(sourceIndex, 1);
    playlist.trackIds.splice(boundedIndex, 0, trackId);
    playlist.updatedAt = String(this.now());
    return true;
  }

  deleteFromCatalog(trackId) {
    const index = this.state.catalog.tracks.findIndex(
      (track) => track.id === trackId,
    );
    if (index === -1) return false;
    this.state.catalog.tracks.splice(index, 1);
    this.state.playlists.forEach((playlist) => {
      playlist.trackIds = playlist.trackIds.filter((id) => id !== trackId);
      playlist.updatedAt = String(this.now());
    });
    if (this.state.selectedTrackId === trackId) {
      this.state.selectedTrackId = null;
    }
    return true;
  }
}

export function createMediaLibraryModel(state, options) {
  return new MediaLibraryModel(state, options);
}

export default MediaLibraryModel;
