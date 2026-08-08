"use strict";

const fs = require("fs");
const path = require("path");
const { buildDiagnosticArchive } = require("./diagnosticArchive");
const { LOG_SCOPES, normalizeLevel, sanitizeValue } = require("./diagnosticsLogger");
const { failure, success } = require("./appError");

function registerDiagnosticsIpcHandlers({ app, dialog, ipcMain, logger, mainWindow }) {
  ipcMain.handle("diagnostics:get-level", () => success(logger.getLevel()));
  ipcMain.handle("diagnostics:set-level", (_event, level) =>
    success(logger.setLevel(normalizeLevel(level))),
  );
  ipcMain.on("diagnostics:log", (_event, payload = {}) => {
    const scope = LOG_SCOPES.includes(payload.scope) ? payload.scope : "Main";
    logger.write(scope, normalizeLevel(payload.level), payload.event, sanitizeValue(payload.context));
  });
  ipcMain.handle("diagnostics:export", async () => {
    try {
      const result = await dialog.showSaveDialog(mainWindow, {
        title: "Export Thunder diagnostics",
        defaultPath: path.join(app.getPath("downloads"), `Thunder-diagnostics-${Date.now()}.zip`),
        filters: [{ name: "ZIP archive", extensions: ["zip"] }],
      });
      if (result.canceled || !result.filePath) {
        return failure(new Error("Export cancelled"), {
          code: "CANCELLED",
          category: "user",
          retryable: true,
        });
      }
      const archive = await buildDiagnosticArchive({ app, logger });
      await fs.promises.writeFile(result.filePath, archive, { flag: "wx" });
      logger.write("Settings", "info", "diagnostics-exported", { fileName: path.basename(result.filePath) });
      return success({ filePath: result.filePath });
    } catch (error) {
      const correlationId = `diagnostics-${Date.now().toString(36)}`;
      logger.write("Settings", "error", "diagnostics-export-failed", { correlationId, error });
      return failure(error, {
        code: "EXPORT_FAILED",
        category: "filesystem",
        message: "Unable to export diagnostics",
        retryable: true,
        correlationId,
      });
    }
  });
}

module.exports = { registerDiagnosticsIpcHandlers };
