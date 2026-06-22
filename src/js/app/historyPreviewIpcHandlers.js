// src/js/app/historyPreviewIpcHandlers.js

const fs = require("fs");
const fsPromises = fs.promises;
const path = require("path");
const https = require("https");
const http = require("http");
const { promisify } = require("util");
const { pipeline } = require("stream");
const log = require("electron-log");
const { CHANNELS } = require("../ipc/channels");

const streamPipeline = promisify(pipeline);
const PREVIEW_REDIRECT_LIMIT = 5;
const PREVIEW_USER_AGENT = "Thunder/1.0 PreviewCache";

function createHistoryPreviewCache({ previewDirPath, isPathInsideBaseDir }) {
  async function ensurePreviewCacheDir() {
    try {
      await fsPromises.mkdir(previewDirPath, { recursive: true });
    } catch (error) {
      log.warn("Failed to create preview cache directory:", error);
    }
    return previewDirPath;
  }

  function sanitizePreviewName(name = "preview") {
    try {
      return (
        String(name || "preview")
          .normalize("NFKD")
          .replace(/[^\w.-]+/g, "_")
          .replace(/^_+|_+$/g, "")
          .slice(0, 48) || "preview"
      );
    } catch {
      return "preview";
    }
  }

  function getExtensionFromMime(mime = "") {
    if (mime.includes("png")) return ".png";
    if (mime.includes("gif")) return ".gif";
    if (mime.includes("webp")) return ".webp";
    if (mime.includes("svg")) return ".svg";
    if (mime.includes("bmp")) return ".bmp";
    return ".jpg";
  }

  function getMimeFromDataUrl(dataUrl = "") {
    const match = dataUrl.match(/^data:(.+?);/i);
    return match ? match[1] : "";
  }

  function getExtensionFromUrl(inputUrl = "") {
    try {
      const parsed = new URL(inputUrl);
      const ext = path.extname(parsed.pathname);
      if (ext && ext.length <= 5) return ext.toLowerCase();
    } catch {
      // ignore
    }
    return ".jpg";
  }

  async function saveDataUrlPreview(dataUrl, targetPath) {
    const match = dataUrl.match(/^data:(.+?);base64,(.+)$/i);
    if (!match) throw new Error("Unsupported data URL");
    const buffer = Buffer.from(match[2], "base64");
    await fsPromises.writeFile(targetPath, buffer);
    return targetPath;
  }

  async function downloadPreviewToFile(
    imageUrl,
    targetPath,
    redirectCount = 0,
  ) {
    if (redirectCount > PREVIEW_REDIRECT_LIMIT) {
      throw new Error("Too many redirects while downloading preview");
    }
    const parsed = new URL(imageUrl);
    const client = parsed.protocol === "http:" ? http : https;
    const requestOptions = {
      headers: { "User-Agent": PREVIEW_USER_AGENT },
    };
    await new Promise((resolve, reject) => {
      const req = client.get(parsed, requestOptions, (res) => {
        const { statusCode = 0, headers } = res;
        if (
          [301, 302, 303, 307, 308].includes(Number(statusCode)) &&
          headers.location
        ) {
          res.resume();
          const nextUrl = new URL(headers.location, parsed).toString();
          downloadPreviewToFile(nextUrl, targetPath, redirectCount + 1)
            .then(resolve)
            .catch(reject);
          return;
        }

        if (statusCode !== 200) {
          res.resume();
          reject(
            new Error(
              `Unexpected status ${statusCode} while downloading preview`,
            ),
          );
          return;
        }

        const fileStream = fs.createWriteStream(targetPath);
        streamPipeline(res, fileStream)
          .then(resolve)
          .catch((error) => {
            fsPromises.rm(targetPath, { force: true }).catch(() => {});
            reject(error);
          });
      });
      req.on("error", (error) => reject(error));
    });
    return targetPath;
  }

  async function deletePreviewFiles(targets) {
    if (!targets) return 0;
    const list = Array.isArray(targets) ? targets : [targets];
    if (!list.length) return 0;
    const baseDir = path.resolve(previewDirPath);
    let removed = 0;
    for (const filePath of list) {
      if (!filePath || typeof filePath !== "string") continue;
      try {
        const resolved = path.resolve(filePath);
        if (!isPathInsideBaseDir(resolved, baseDir)) {
          log.warn("Skip deleting preview outside cache dir:", resolved);
          continue;
        }
        await fsPromises.rm(resolved, { force: true });
        removed += 1;
      } catch (error) {
        log.warn("Failed to delete preview file:", error);
      }
    }
    return removed;
  }

  function registerHistoryPreviewIpcHandlers({ ipcMain }) {
    ipcMain.handle(CHANNELS.CACHE_HISTORY_PREVIEW, async (_event, payload) => {
      try {
        const { url, entryId, fileName } = payload || {};
        if (!url || typeof url !== "string" || !url.length) {
          return { success: false, error: "Invalid preview URL" };
        }
        await ensurePreviewCacheDir();
        const safeBase = sanitizePreviewName(fileName || "preview");
        const uniqueSuffix =
          (entryId ? String(entryId) : Date.now().toString()).replace(
            /[^\w.-]/g,
            "",
          ) || Date.now().toString();
        const ext = url.startsWith("data:")
          ? getExtensionFromMime(getMimeFromDataUrl(url))
          : getExtensionFromUrl(url);
        const targetPath = path.join(
          previewDirPath,
          `${safeBase}-${uniqueSuffix}${ext}`,
        );
        if (url.startsWith("data:")) {
          await saveDataUrlPreview(url, targetPath);
        } else {
          await downloadPreviewToFile(url, targetPath);
        }
        return { success: true, filePath: targetPath };
      } catch (error) {
        log.warn("cache-history-preview error:", error);
        return { success: false, error: error.message || String(error) };
      }
    });

    ipcMain.handle(CHANNELS.DELETE_HISTORY_PREVIEW, async (_event, payload) => {
      try {
        const removed = await deletePreviewFiles(payload);
        return { success: true, removed };
      } catch (error) {
        log.warn("delete-history-preview error:", error);
        return { success: false, error: error.message || String(error) };
      }
    });
  }

  return {
    deletePreviewFiles,
    ensurePreviewCacheDir,
    registerHistoryPreviewIpcHandlers,
  };
}

module.exports = {
  createHistoryPreviewCache,
  __test: {
    PREVIEW_REDIRECT_LIMIT,
    PREVIEW_USER_AGENT,
  },
};
