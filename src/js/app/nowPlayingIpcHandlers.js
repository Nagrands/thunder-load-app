const path = require("path");
const log = require("electron-log");
const { CHANNELS } = require("../ipc/channels");
const {
  importMediaPaths,
  isSupportedPlaylistPath,
  normalizeSourcePath,
  parseMediaPlaylist,
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
const { NowPlayingHlsService } = require("./nowPlayingHlsService");
const {
  NowPlayingTimelinePreviewService,
} = require("./nowPlayingTimelinePreviewService");

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
  shell,
  hlsService: providedHlsService = null,
  timelinePreviewService: providedTimelinePreviewService = null,
}) {
  const hlsService =
    providedHlsService ||
    new NowPlayingHlsService({
      cacheRoot: path.join(app.getPath("userData"), "now-playing-hls"),
      ffmpegPathResolver: () => resolveToolPath(ffmpegPathResolver, store),
      debugLog: app.isPackaged ? null : (...args) => log.debug(...args),
    });
  const youtube = createYouTubeHandlers({
    getVideoInfo,
    getVideoPreview,
    hlsService,
  });
  const getTrackById = (trackId) =>
    readState(store).catalog.tracks.find(
      (track) => track.id === String(trackId || ""),
    ) || null;
  const timelinePreviewService =
    providedTimelinePreviewService ||
    new NowPlayingTimelinePreviewService({
      ffmpegPathResolver: () => resolveToolPath(ffmpegPathResolver, store),
      getSessionInputs: (sessionId) =>
        hlsService.getPreviewInputs?.(sessionId) || [],
      getTrackById,
    });
  if (typeof app.once === "function") {
    app.once("before-quit", () => {
      timelinePreviewService.dispose();
      void hlsService.dispose();
    });
  }
  const importOptions = () => ({
    artworkDir: path.join(app.getPath("userData"), "now-playing-artwork"),
    ffmpegPath: resolveToolPath(ffmpegPathResolver, store),
    ffprobePath: resolveToolPath(ffprobePathResolver, store),
  });

  const importFiles = async (filePaths) => {
    const warnings = [];
    const imported = await importMediaPaths(filePaths, {
      ...importOptions(),
      onWarning: (warning) => warnings.push(warning),
    });
    const result = appendImportedTracks(readState(store), imported);
    const playlistImports = [];
    for (const [index, playlistPath] of filePaths.entries()) {
      if (!isSupportedPlaylistPath(playlistPath)) continue;
      const entries = await parseMediaPlaylist(playlistPath);
      const entryKeys = new Set(
        entries.map((entry) =>
          /^https?:/i.test(entry) ? entry : normalizeSourcePath(entry),
        ),
      );
      const trackIds = result.state.catalog.tracks
        .filter((track) =>
          entryKeys.has(
            track.providerId === "network"
              ? track.sourceRef
              : normalizeSourcePath(track.sourceRef),
          ),
        )
        .map((track) => track.id);
      if (!trackIds.length) continue;
      const playlist = {
        id: `playlist-import-${Date.now().toString(36)}-${index.toString(36)}`,
        title: path.basename(playlistPath, path.extname(playlistPath)),
        trackIds,
        createdAt: String(Date.now()),
        updatedAt: String(Date.now()),
      };
      result.state.playlists.push(playlist);
      result.state.activePlaylistId = playlist.id;
      playlistImports.push(playlist);
    }
    const nextState = writeState(store, result.state);
    return success({
      canceled: false,
      added: result.added,
      tracks: result.added,
      importedTrackIds: result.importedIds,
      playlistImports,
      warnings,
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
              "avi",
              "m4v",
              "mkv",
              "mov",
              "mp4",
              "mpeg",
              "mpg",
              "webm",
              "m3u",
              "m3u8",
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

  ipcMain.handle(CHANNELS.NOW_PLAYING_IMPORT_PATHS, async (_event, paths) => {
    if (!Array.isArray(paths) || paths.length < 1 || paths.length > 256) {
      return failure("INVALID_PATHS", "One to 256 media paths are required");
    }
    const candidates = paths.filter(
      (item) =>
        typeof item === "string" &&
        !item.includes("\u0000") &&
        path.isAbsolute(item),
    );
    if (candidates.length !== paths.length) {
      return failure("INVALID_PATHS", "Invalid media path payload");
    }
    try {
      return await importFiles(candidates);
    } catch (error) {
      return failure(error.code || "IMPORT_FAILED", error.message);
    }
  });

  const getStoredLocalPath = (sourceRef) => {
    if (typeof sourceRef !== "string" || !path.isAbsolute(sourceRef)) return "";
    const resolved = path.resolve(sourceRef);
    return readState(store).catalog.tracks.some(
      (track) =>
        track.providerId === "local" && path.resolve(track.sourceRef) === resolved,
    )
      ? resolved
      : "";
  };

  ipcMain.handle(CHANNELS.NOW_PLAYING_REVEAL_TRACK, async (_event, sourceRef) => {
    const filePath = getStoredLocalPath(sourceRef);
    if (!filePath) return failure("INVALID_PATH", "Unknown media file");
    shell.showItemInFolder(filePath);
    return success({ revealed: true });
  });

  ipcMain.handle(
    CHANNELS.NOW_PLAYING_OPEN_TRACK_LOCATION,
    async (_event, sourceRef) => {
      const filePath = getStoredLocalPath(sourceRef);
      if (!filePath) return failure("INVALID_PATH", "Unknown media file");
      const result = await shell.openPath(path.dirname(filePath));
      return result
        ? failure("OPEN_FAILED", result)
        : success({ opened: true });
    },
  );

  ipcMain.handle(
    CHANNELS.NOW_PLAYING_ANALYZE_YOUTUBE_VIDEO,
    async (_event, url, options = {}) =>
      youtube.analyzeVideo(url, {
        forceRefresh: options?.forceRefresh === true,
      }),
  );

  ipcMain.handle(
    CHANNELS.NOW_PLAYING_IMPORT_YOUTUBE_VIDEO,
    async (_event, url, qualitySelection = null) => {
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
        let updatedTrack = existingTrack;
        if (qualitySelection) {
          const refreshed = await youtube.importVideo(url, qualitySelection);
          if (!refreshed.success) return refreshed;
          updatedTrack = {
            ...refreshed.data,
            id: existingTrack.id,
            displayTitle: existingTrack.displayTitle,
          };
        }
        const updatedState = {
          ...currentState,
          catalog: {
            tracks: currentState.catalog.tracks.map((track) =>
              track.id === existingTrack.id ? updatedTrack : track,
            ),
          },
        };
        const appended = appendImportedTracks(updatedState, [updatedTrack]);
        const state = await hydrateState(writeState(store, appended.state));
        return success({
          track: updatedTrack,
          added: [],
          importedTrackIds: appended.importedIds,
          state,
        });
      }
      const result = await youtube.importVideo(url, qualitySelection);
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
        qualitySelection: options?.qualitySelection,
      }),
  );

  ipcMain.handle(
    CHANNELS.NOW_PLAYING_CLOSE_PLAYBACK_SESSION,
    async (_event, sessionId) => {
      if (typeof sessionId !== "string" || !/^[a-f0-9-]{36}$/.test(sessionId)) {
        return failure("INVALID_SESSION_ID", "Invalid playback session ID");
      }
      try {
        return success({ closed: await hlsService.closeSession(sessionId) });
      } catch (error) {
        return failure(error.code || "SESSION_CLOSE_FAILED", error.message);
      }
    },
  );

  ipcMain.handle(
    CHANNELS.NOW_PLAYING_GET_TIMELINE_PREVIEW,
    async (_event, request) => {
      try {
        return success(await timelinePreviewService.getPreview(request));
      } catch (error) {
        return failure(error.code || "PREVIEW_FAILED", error.message);
      }
    },
  );

  ipcMain.on?.(
    CHANNELS.NOW_PLAYING_CANCEL_TIMELINE_PREVIEW,
    (_event, requestId) => {
      timelinePreviewService.cancel(requestId);
    },
  );

  ipcMain.handle(
    CHANNELS.NOW_PLAYING_CREATE_LOCAL_PLAYBACK_SESSION,
    async (_event, sourceRef) => {
      const filePath = getStoredLocalPath(sourceRef);
      if (!filePath) return failure("INVALID_PATH", "Unknown media file");
      try {
        return success(
          await hlsService.createSession({
            inputs: [filePath],
            copyCodecs: false,
            allowLocal: true,
          }),
        );
      } catch (error) {
        return failure(error.code || "HLS_TRANSCODE_FAILED", error.message);
      }
    },
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
      return success(writeState(store, state));
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
