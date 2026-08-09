// src/js/app/historyIpcHandlers.js

"use strict";

const fs = require("fs");
const fsPromises = fs.promises;
const log = require("electron-log");
const { CHANNELS } = require("../ipc/channels");
const { createHistoryRepository } = require("./historyRepository");

const HISTORY_FILE_INSPECTION_CONCURRENCY = 8;

function emitHistoryUpdated(mainWindow, { count, revision }) {
  try {
    mainWindow?.webContents?.send("history-updated", { count, revision });
  } catch (error) {
    log.warn("history-updated emit failed:", error);
  }
}

async function inspectHistoryFiles(
  filePaths,
  {
    concurrency = HISTORY_FILE_INSPECTION_CONCURRENCY,
    stat = (filePath) => fsPromises.stat(filePath),
  } = {},
) {
  const paths = Array.from(
    new Set(
      (Array.isArray(filePaths) ? filePaths : [])
        .filter((filePath) => typeof filePath === "string")
        .map((filePath) => filePath.trim())
        .filter(Boolean),
    ),
  );
  const results = [];
  const batchSize = Math.max(
    1,
    Math.min(Number(concurrency) || 1, paths.length || 1),
  );
  for (let offset = 0; offset < paths.length; offset += batchSize) {
    const batch = paths.slice(offset, offset + batchSize);
    const inspected = await Promise.all(
      batch.map(async (filePath) => {
        try {
          const stats = await stat(filePath);
          return {
            filePath,
            exists: true,
            sizeBytes: Number.isFinite(stats?.size) ? stats.size : null,
          };
        } catch (error) {
          return {
            filePath,
            exists: false,
            sizeBytes: null,
            ...(error?.code && error.code !== "ENOENT"
              ? { warning: error.code }
              : {}),
          };
        }
      }),
    );
    results.push(...inspected);
  }
  return results;
}

function registerHistoryIpcHandlers({
  ipcMain,
  ensurePreviewCacheDir,
  historyFilePath,
  mainWindow,
  previewDirPath,
  repository = createHistoryRepository({ historyFilePath }),
}) {
  ipcMain.handle(CHANNELS.LOAD_HISTORY, async () => {
    try {
      return await repository.read();
    } catch (error) {
      log.error("Error loading history:", error);
      return {
        success: false,
        entries: [],
        count: 0,
        revision: repository.revision || 0,
        error: error.message || String(error),
      };
    }
  });

  ipcMain.handle(CHANNELS.SAVE_HISTORY, async (_event, history) => {
    try {
      const entries = Array.isArray(history) ? history : history?.entries;
      const result = await repository.save(entries);
      emitHistoryUpdated(mainWindow, result);
      return result;
    } catch (error) {
      log.error("Error saving history:", error);
      return {
        success: false,
        count: 0,
        revision: repository.revision || 0,
        error: error.message || String(error),
      };
    }
  });

  ipcMain.handle(CHANNELS.CLEAR_HISTORY, async () => {
    try {
      const result = await repository.clear();
      try {
        await fsPromises.rm(previewDirPath, { recursive: true, force: true });
      } catch (error) {
        log.warn("Failed to clear preview cache directory:", error);
      }
      await ensurePreviewCacheDir();
      emitHistoryUpdated(mainWindow, result);
      return result;
    } catch (error) {
      log.error("Error clearing history:", error);
      return {
        success: false,
        count: 0,
        revision: repository.revision || 0,
        error: error.message || String(error),
      };
    }
  });

  ipcMain.handle(CHANNELS.GET_DOWNLOAD_COUNT, async () => {
    try {
      const result = await repository.read();
      return result.success ? result.count : 0;
    } catch (error) {
      log.error("Error getting download count:", error);
      return 0;
    }
  });

  ipcMain.handle(CHANNELS.INSPECT_HISTORY_FILES, async (_event, filePaths) => {
    try {
      const files = await inspectHistoryFiles(filePaths);
      return { success: true, files };
    } catch (error) {
      log.error("Error inspecting history files:", error);
      return {
        success: false,
        files: [],
        error: error.message || String(error),
      };
    }
  });

  return repository;
}

module.exports = {
  registerHistoryIpcHandlers,
  __test: {
    emitHistoryUpdated,
    inspectHistoryFiles,
  },
};
