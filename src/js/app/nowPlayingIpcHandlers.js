const path = require("path");
const log = require("electron-log");
const { CHANNELS } = require("../ipc/channels");
const {
  createTrackId,
  importMediaPaths,
  isSupportedMediaPath,
  normalizeSourcePath,
  refreshAvailability,
  scanMediaDirectory,
} = require("./nowPlayingLibrary");

const STATE_KEY = "nowPlaying.state";
const STATE_VERSION = 1;
const MAX_STATE_BYTES = 2 * 1024 * 1024;
const MAX_TRACKS = 5000;
const REPEAT_MODES = new Set(["off", "all", "one"]);

function success(data) {
  return { success: true, data, error: null };
}

function failure(code, message) {
  return { success: false, data: null, error: { code, message } };
}

function defaultState() {
  return {
    version: STATE_VERSION,
    playlist: {
      id: "local-library",
      providerId: "local",
      title: "Local library",
      sourceDescriptor: { type: "local" },
      tracks: [],
    },
    selectedTrackId: null,
    volume: 1,
    muted: false,
    shuffle: false,
    repeat: "off",
  };
}

function sanitizeText(value, maxLength = 512) {
  return typeof value === "string" ? value.slice(0, maxLength) : "";
}

function sanitizeTrack(track) {
  if (!track || typeof track !== "object") return null;
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
    artworkUrl:
      typeof track.artworkUrl === "string"
        ? track.artworkUrl.slice(0, 32768)
        : null,
    kind: track.kind === "video" ? "video" : "audio",
    availability: track.availability === "missing" ? "missing" : "available",
    mimeType: sanitizeText(track.mimeType, 128),
  };
}

function sanitizeState(value) {
  const source = value && typeof value === "object" ? value : {};
  const sourceTracks = Array.isArray(source.playlist?.tracks)
    ? source.playlist.tracks
    : [];
  const tracks = [];
  const seen = new Set();
  for (const sourceTrack of sourceTracks.slice(0, MAX_TRACKS)) {
    const track = sanitizeTrack(sourceTrack);
    if (!track) continue;
    const normalized = normalizeSourcePath(track.sourceRef);
    if (seen.has(normalized)) continue;
    seen.add(normalized);
    tracks.push(track);
  }
  const volume = Number(source.volume);
  const selectedTrackId =
    sanitizeText(source.selectedTrackId, 128) ||
    sanitizeText(source.currentTrackId, 128) ||
    null;
  return {
    version: STATE_VERSION,
    playlist: {
      id: sanitizeText(source.playlist?.id, 128) || "local-library",
      providerId: "local",
      title: sanitizeText(source.playlist?.title, 256) || "Local library",
      sourceDescriptor: { type: "local" },
      tracks,
    },
    selectedTrackId: tracks.some((track) => track.id === selectedTrackId)
      ? selectedTrackId
      : tracks[0]?.id || null,
    volume: Number.isFinite(volume) ? Math.min(1, Math.max(0, volume)) : 1,
    muted: Boolean(source.muted),
    shuffle: Boolean(source.shuffle),
    repeat: REPEAT_MODES.has(source.repeat) ? source.repeat : "off",
  };
}

function readState(store) {
  try {
    return sanitizeState(store.get(STATE_KEY, defaultState()));
  } catch (error) {
    log.warn("[now-playing] Failed to read state:", error);
    return defaultState();
  }
}

function writeState(store, state) {
  const sanitized = sanitizeState(state);
  const serialized = JSON.stringify(sanitized);
  if (Buffer.byteLength(serialized, "utf8") > MAX_STATE_BYTES) {
    throw Object.assign(new Error("Now Playing state is too large"), {
      code: "PAYLOAD_TOO_LARGE",
    });
  }
  store.set(STATE_KEY, sanitized);
  return sanitized;
}

async function hydrateState(state) {
  const tracks = await Promise.all(
    state.playlist.tracks.map((track) => refreshAvailability(track)),
  );
  return {
    ...state,
    playlist: { ...state.playlist, tracks },
  };
}

function resolveToolPath(resolver, store) {
  try {
    return resolver(store) || "";
  } catch {
    return "";
  }
}

function registerNowPlayingIpcHandlers({
  app,
  dialog,
  ffmpegPathResolver,
  ffprobePathResolver,
  ipcMain,
  mainWindow,
  store,
}) {
  const importOptions = () => ({
    artworkDir: path.join(app.getPath("userData"), "now-playing-artwork"),
    ffmpegPath: resolveToolPath(ffmpegPathResolver, store),
    ffprobePath: resolveToolPath(ffprobePathResolver, store),
  });

  const importFiles = async (filePaths) => {
    const imported = await importMediaPaths(filePaths, importOptions());
    const state = readState(store);
    const existingPaths = new Set(
      state.playlist.tracks.map((track) =>
        normalizeSourcePath(track.sourceRef),
      ),
    );
    const availableSlots = Math.max(
      0,
      MAX_TRACKS - state.playlist.tracks.length,
    );
    const added = imported
      .filter(
        (track) => !existingPaths.has(normalizeSourcePath(track.sourceRef)),
      )
      .slice(0, availableSlots);
    const nextState = writeState(store, {
      ...state,
      playlist: {
        ...state.playlist,
        tracks: [...state.playlist.tracks, ...added],
      },
      selectedTrackId: state.selectedTrackId || added[0]?.id || null,
    });
    return success({
      canceled: false,
      added,
      tracks: added,
      state: await hydrateState(nextState),
    });
  };

  ipcMain.handle(CHANNELS.NOW_PLAYING_IMPORT_FILES, async () => {
    try {
      const result = await dialog.showOpenDialog(mainWindow, {
        properties: ["openFile", "multiSelections"],
        filters: [
          {
            name: "Audio and video",
            extensions: [
              "aac",
              "flac",
              "m4a",
              "mp3",
              "oga",
              "ogg",
              "opus",
              "wav",
              "weba",
              "m4v",
              "mkv",
              "mov",
              "mp4",
              "webm",
            ],
          },
        ],
      });
      if (result.canceled || !result.filePaths?.length) {
        return success({
          canceled: true,
          added: [],
          tracks: [],
          state: null,
        });
      }
      return await importFiles(result.filePaths);
    } catch (error) {
      log.error("[now-playing] File import failed:", error);
      return failure(error.code || "IMPORT_FAILED", error.message);
    }
  });

  ipcMain.handle(CHANNELS.NOW_PLAYING_IMPORT_FOLDER, async () => {
    try {
      const result = await dialog.showOpenDialog(mainWindow, {
        properties: ["openDirectory"],
      });
      if (result.canceled || !result.filePaths?.[0]) {
        return success({
          canceled: true,
          added: [],
          tracks: [],
          state: null,
        });
      }
      const folderPath = result.filePaths[0];
      if (
        typeof folderPath !== "string" ||
        folderPath.includes("\u0000") ||
        !path.isAbsolute(folderPath)
      ) {
        return failure("INVALID_PATH", "Invalid music folder path");
      }
      const filePaths = await scanMediaDirectory(folderPath);
      return await importFiles(filePaths);
    } catch (error) {
      log.error("[now-playing] Folder import failed:", error);
      return failure(error.code || "IMPORT_FAILED", error.message);
    }
  });

  ipcMain.handle(CHANNELS.NOW_PLAYING_GET_STATE, async () => {
    try {
      return success(await hydrateState(readState(store)));
    } catch (error) {
      log.error("[now-playing] Failed to restore state:", error);
      return failure("STATE_READ_FAILED", error.message);
    }
  });

  ipcMain.handle(CHANNELS.NOW_PLAYING_SET_STATE, async (_event, state) => {
    try {
      const inputSize = Buffer.byteLength(
        JSON.stringify(state ?? null),
        "utf8",
      );
      if (inputSize > MAX_STATE_BYTES) {
        return failure("PAYLOAD_TOO_LARGE", "Now Playing state is too large");
      }
      return success(await hydrateState(writeState(store, state)));
    } catch (error) {
      log.error("[now-playing] Failed to persist state:", error);
      return failure(error.code || "INVALID_STATE", error.message);
    }
  });
}

module.exports = {
  MAX_STATE_BYTES,
  STATE_KEY,
  STATE_VERSION,
  defaultState,
  registerNowPlayingIpcHandlers,
  sanitizeState,
};
