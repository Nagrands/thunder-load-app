// src/js/app/toolsHashIpcHandlers.js

const crypto = require("crypto");
const fs = require("fs");
const fsPromises = fs.promises;
const path = require("path");
const log = require("electron-log");
const { CHANNELS } = require("../ipc/channels");

function registerToolsHashIpcHandlers({ ipcMain, dialog, mainWindow }) {
  ipcMain.handle(CHANNELS.TOOLS_HASH_PICK_FILE, async () => {
    try {
      const result = await dialog.showOpenDialog(mainWindow, {
        properties: ["openFile"],
      });
      if (result.canceled || !result.filePaths?.length) {
        return { success: false, canceled: true };
      }
      return { success: true, filePath: result.filePaths[0] };
    } catch (error) {
      log.error("tools:hashPickFile error:", error);
      return { success: false, error: error.message || String(error) };
    }
  });

  ipcMain.handle(
    CHANNELS.TOOLS_HASH_INSPECT_FILE,
    async (_evt, payload = {}) => {
      try {
        const filePath = String(payload.filePath || "").trim();
        if (!filePath) {
          return { success: false, error: "File path is required" };
        }
        const stat = await fsPromises.stat(filePath);
        await fsPromises.access(filePath, fs.constants.R_OK);
        return {
          success: true,
          filePath,
          fileName: path.basename(filePath),
          size: stat.size,
          readable: true,
        };
      } catch (error) {
        return {
          success: false,
          filePath: String(payload.filePath || "").trim(),
          fileName: path.basename(String(payload.filePath || "").trim()),
          size: null,
          readable: false,
          error: error.message || String(error),
        };
      }
    },
  );

  ipcMain.handle(CHANNELS.TOOLS_HASH_CALCULATE, async (_evt, payload = {}) => {
    try {
      const filePath = String(payload.filePath || "").trim();
      if (!filePath) {
        return { success: false, error: "File path is required" };
      }
      const algoMap = {
        MD5: "md5",
        "SHA-1": "sha1",
        "SHA-256": "sha256",
        "SHA-512": "sha512",
      };
      const algorithm = String(payload.algorithm || "SHA-256").toUpperCase();
      const normalizedAlgorithm = algoMap[algorithm];
      if (!normalizedAlgorithm) {
        return { success: false, error: "Unsupported algorithm" };
      }
      const requestId = String(payload.requestId || "").trim();

      await fsPromises.access(filePath, fs.constants.R_OK);
      const fileStats = await fsPromises.stat(filePath);
      const totalBytes = Number(fileStats.size) || 0;
      let lastProgressPercent = -1;
      let lastProgressEmitTs = 0;
      const emitHashProgress = (stage, processedBytes) => {
        if (!requestId || typeof _evt?.sender?.send !== "function") return;
        const safeProcessed = Math.max(0, Number(processedBytes) || 0);
        const percent =
          totalBytes > 0
            ? Math.min(100, Math.round((safeProcessed / totalBytes) * 100))
            : stage === "done"
              ? 100
              : 0;
        const now = Date.now();
        const isRequiredStage = stage === "start" || stage === "done";
        if (
          !isRequiredStage &&
          percent === lastProgressPercent &&
          now - lastProgressEmitTs < 120
        ) {
          return;
        }
        lastProgressPercent = percent;
        lastProgressEmitTs = now;
        _evt.sender.send(CHANNELS.TOOLS_HASH_PROGRESS, {
          requestId,
          filePath,
          algorithm,
          stage,
          processedBytes: safeProcessed,
          totalBytes,
          percent,
        });
      };

      const actualHash = await new Promise((resolve, reject) => {
        const hash = crypto.createHash(normalizedAlgorithm);
        let processedBytes = 0;
        const stream = fs.createReadStream(filePath);
        stream.on("error", reject);
        stream.on("data", (chunk) => {
          processedBytes += chunk.length;
          hash.update(chunk);
          emitHashProgress("progress", processedBytes);
        });
        stream.on("end", () => {
          emitHashProgress("done", totalBytes);
          resolve(hash.digest("hex").toLowerCase());
        });
        emitHashProgress("start", 0);
      });

      const expectedHash = String(payload.expectedHash || "")
        .trim()
        .toLowerCase()
        .replace(/\s+/g, "");
      const matches = expectedHash ? expectedHash === actualHash : null;

      return {
        success: true,
        algorithm,
        actualHash,
        expectedHash,
        matches,
        filePath,
      };
    } catch (error) {
      log.error("tools:hashCalculate error:", error);
      return { success: false, error: error.message || String(error) };
    }
  });
}

module.exports = {
  registerToolsHashIpcHandlers,
};
