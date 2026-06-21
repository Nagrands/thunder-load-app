// src/js/app/fileShellIpcHandlers.js

const fs = require("fs");
const fsPromises = fs.promises;
const path = require("path");
const log = require("electron-log");
const { CHANNELS } = require("../ipc/channels");

function registerFileShellIpcHandlers({
  ipcMain,
  app,
  shell,
  downloadState,
  isPathInsideBaseDir,
  isValidFilePath,
  isValidUrl,
  normalizeUrl,
}) {
  ipcMain.handle("open-external", (_e, url) => {
    if (typeof url === "string" && url.startsWith("https://")) {
      shell.openExternal(url);
    }
  });

  ipcMain.handle(CHANNELS.OPEN_CONFIG_FOLDER, () => {
    const folderPath = app.getPath("userData");
    const filePath = path.join(folderPath, "wireguard.conf");
    try {
      if (!fs.existsSync(folderPath)) {
        fs.mkdirSync(folderPath, { recursive: true });
      }
      if (!fs.existsSync(filePath)) {
        fs.writeFileSync(filePath, "", "utf8");
      }
      shell.openPath(folderPath);
      return { success: true };
    } catch (e) {
      log.error("open-config-folder error:", e);
      shell.openPath(folderPath);
      return { success: false, error: e.message };
    }
  });

  ipcMain.handle(CHANNELS.CHECK_FILE_EXISTS, async (event, filePath) => {
    try {
      await fsPromises.access(filePath);
      return true;
    } catch (_error) {
      return false;
    }
  });

  ipcMain.handle(CHANNELS.DELETE_FILE, async (event, filePath) => {
    try {
      log.info(`Attempting to delete file: ${filePath}`);

      if (!isValidFilePath(filePath)) {
        log.warn(`Invalid file path for deletion: ${filePath}`);
        throw new Error("Invalid file path.");
      }

      const baseDir = downloadState.downloadPath;
      log.info(`Base directory: ${baseDir}`);
      log.info(`Resolved file path: ${path.resolve(filePath)}`);

      if (!isPathInsideBaseDir(filePath, baseDir)) {
        log.warn(
          `Attempt to delete file outside allowed directory: ${filePath}`,
        );
        throw new Error(
          "Deleting files outside the allowed directory is prohibited.",
        );
      }

      const trashSupported = typeof shell?.trashItem === "function";
      if (trashSupported) {
        try {
          await shell.trashItem(filePath);
        } catch (trashError) {
          log.warn(
            `Failed to move file to trash, fallback to unlink: ${filePath}`,
            trashError,
          );
          await fsPromises.unlink(filePath);
        }
      } else {
        await fsPromises.unlink(filePath);
      }
      log.info(`File successfully deleted: ${filePath}`);
      return true;
    } catch (error) {
      log.error(`Error deleting file ${filePath}:`, error);
      throw error;
    }
  });

  ipcMain.handle(CHANNELS.GET_FILE_SIZE, async (event, filePath) => {
    try {
      const stats = await fs.promises.stat(filePath);
      return stats.size;
    } catch (error) {
      log.error("Ошибка при получении размера файла:", error);
      return null;
    }
  });

  ipcMain.handle(CHANNELS.OPEN_DOWNLOAD_FOLDER, async (event, filePath) => {
    if (!filePath || typeof filePath !== "string")
      throw new TypeError('The "path" argument must be of type string.');

    log.info("Showing file in folder:", filePath);

    if (fs.existsSync(filePath)) {
      shell.showItemInFolder(filePath);
    } else {
      throw new Error("Файл не существует");
    }
  });

  ipcMain.handle(CHANNELS.OPEN_EXTERNAL_LINK, async (event, url) => {
    log.info("Opening external link:", url);
    try {
      const normalizedUrl = normalizeUrl(url);
      if (!isValidUrl(normalizedUrl)) throw new Error("Invalid URL");

      const parsedUrl = new URL(normalizedUrl);
      if (!["http:", "https:"].includes(parsedUrl.protocol)) {
        throw new Error("Invalid or unsupported URL protocol");
      }

      await shell.openExternal(normalizedUrl);
      return { success: true };
    } catch (error) {
      log.error("Error opening external link:", error);
      return { success: false, error: error.message };
    }
  });

  ipcMain.handle(CHANNELS.OPEN_LAST_VIDEO, async (event, filePath) => {
    try {
      log.info(`Trying to open file: ${filePath}`);
      if (!filePath) throw new Error("File path is empty");

      const exists = await fs.promises
        .access(filePath)
        .then(() => true)
        .catch(() => false);
      if (!exists) throw new Error("File does not exist");

      const result = await shell.openPath(filePath);
      if (result) throw new Error(result);

      log.info("File opened successfully");
      return { success: true };
    } catch (error) {
      log.error("Error opening file:", error);
      return { success: false, error: error.message };
    }
  });
}

module.exports = {
  registerFileShellIpcHandlers,
};
