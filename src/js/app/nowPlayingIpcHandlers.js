const path = require("path");
const log = require("electron-log");
const { CHANNELS } = require("../ipc/channels");
const {
  importMediaPaths,
  refreshAvailability,
  scanMediaDirectory,
} = require("./nowPlayingLibrary");
const {
  MAX_TRACKS,
  STATE_VERSION,
  canonicalizeYouTubeUrl,
  defaultState,
  getTrackKey,
  sanitizeState,
} = require("./nowPlayingState");
const { createYouTubeHandlers } = require("./nowPlayingYouTube");

const STATE_KEY = "nowPlaying.state";
const MAX_STATE_BYTES = 2 * 1024 * 1024;

function success(data) {
  return { success: true, data, error: null };
}

function failure(code, message) {
  return { success: false, data: null, error: { code, message } };
}

function readState(store) {
  try {
    const stored = store.get(STATE_KEY, defaultState());
    const state = sanitizeState(stored);
    if (stored?.version !== STATE_VERSION) {
      store.set(STATE_KEY, state);
    }
    return state;
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
    state.catalog.tracks.map((track) =>
      track.providerId === "local" ? refreshAvailability(track) : track,
    ),
  );
  return { ...state, catalog: { tracks } };
}

function resolveToolPath(resolver, store) {
  try {
    return resolver(store) || "";
  } catch {
    return "";
  }
}

function appendImportedTracks(state, imported) {
  const existingByKey = new Map(
    state.catalog.tracks.map((track) => [
      `${track.providerId}:${getTrackKey(track)}`,
      track,
    ]),
  );
  const availableSlots = Math.max(0, MAX_TRACKS - state.catalog.tracks.length);
  const added = imported
    .filter(
      (track) =>
        !existingByKey.has(`${track.providerId}:${getTrackKey(track)}`),
    )
    .slice(0, availableSlots);
  const addedByKey = new Map(
    added.map((track) => [`${track.providerId}:${getTrackKey(track)}`, track]),
  );
  const importedIds = imported
    .map((track) => {
      const key = `${track.providerId}:${getTrackKey(track)}`;
      return existingByKey.get(key)?.id || addedByKey.get(key)?.id;
    })
    .filter(Boolean);
  const playlists = state.playlists.map((playlist) => {
    const shouldAppend = playlist.id === state.activePlaylistId;
    if (!shouldAppend) return playlist;
    return {
      ...playlist,
      trackIds: [...new Set([...playlist.trackIds, ...importedIds])],
    };
  });
  return {
    added,
    importedIds,
    state: {
      ...state,
      catalog: { tracks: [...state.catalog.tracks, ...added] },
      playlists,
      selectedTrackId: state.selectedTrackId || importedIds[0] || null,
    },
  };
}

function registerNowPlayingIpcHandlers({
  app,
  dialog,
  ffmpegPathResolver,
  ffprobePathResolver,
  getVideoInfo,
  getVideoPreview,
  ipcMain,
  mainWindow,
  store,
}) {
  const youtube = createYouTubeHandlers({ getVideoInfo, getVideoPreview });
  const importOptions = () => ({
    artworkDir: path.join(app.getPath("userData"), "now-playing-artwork"),
    ffmpegPath: resolveToolPath(ffmpegPathResolver, store),
    ffprobePath: resolveToolPath(ffprobePathResolver, store),
  });

  const importFiles = async (filePaths) => {
    const imported = await importMediaPaths(filePaths, importOptions());
    const result = appendImportedTracks(readState(store), imported);
    const nextState = writeState(store, result.state);
    return success({
      canceled: false,
      added: result.added,
      tracks: result.added,
      importedTrackIds: result.importedIds,
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
        return failure("INVALID_PATH", "Invalid media folder path");
      }
      return await importFiles(await scanMediaDirectory(folderPath));
    } catch (error) {
      log.error("[now-playing] Folder import failed:", error);
      return failure(error.code || "IMPORT_FAILED", error.message);
    }
  });

  ipcMain.handle(
    CHANNELS.NOW_PLAYING_IMPORT_YOUTUBE_VIDEO,
    async (_event, url) => {
      const canonical = canonicalizeYouTubeUrl(url);
      const currentState = readState(store);
      const existingTrack = canonical
        ? currentState.catalog.tracks.find(
            (track) =>
              track.providerId === "youtube" &&
              getTrackKey(track) === canonical.videoId,
          )
        : null;
      if (existingTrack) {
        const appended = appendImportedTracks(currentState, [existingTrack]);
        const state = await hydrateState(writeState(store, appended.state));
        return success({
          track: existingTrack,
          added: [],
          importedTrackIds: appended.importedIds,
          state,
        });
      }
      const result = await youtube.importVideo(url);
      if (!result.success) return result;
      try {
        const appended = appendImportedTracks(currentState, [result.data]);
        const state = await hydrateState(writeState(store, appended.state));
        return success({
          track: result.data,
          added: appended.added,
          importedTrackIds: appended.importedIds,
          state,
        });
      } catch (error) {
        log.error("[now-playing] YouTube import failed:", error);
        return failure(error.code || "IMPORT_FAILED", error.message);
      }
    },
  );

  ipcMain.handle(
    CHANNELS.NOW_PLAYING_RESOLVE_YOUTUBE_TRACK,
    async (_event, sourceRef, options = {}) =>
      youtube.resolveTrack(sourceRef, {
        forceRefresh: options?.forceRefresh === true,
      }),
  );

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
  appendImportedTracks,
  defaultState,
  registerNowPlayingIpcHandlers,
  sanitizeState,
};
