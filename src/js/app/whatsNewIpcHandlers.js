// src/js/app/whatsNewIpcHandlers.js

const fs = require("fs");
const path = require("path");
const log = require("electron-log");
const { CHANNELS } = require("../ipc/channels");

function parseWhatsNewVersion(markdown = "") {
  const match = String(markdown).match(/version:\s*([0-9A-Za-z._-]+)/i);
  return match ? match[1] : null;
}

function renderMarkdown(markdown) {
  const { marked } = require("marked");
  return marked.parse(markdown, {
    mangle: false,
    headerIds: false,
  });
}

function resolveWhatsNewPath(app, lang) {
  const langSuffix = String(lang || "").toLowerCase() === "en" ? ".en" : "";
  return path.join(app.getAppPath(), `whats-new${langSuffix}.md`);
}

function registerWhatsNewIpcHandlers({
  ipcMain,
  app,
  getAppVersion,
  dispatchPendingWhatsNew,
  clearPendingWhatsNewVersion,
}) {
  ipcMain.handle(CHANNELS.GET_WHATS_NEW, async (_event, lang) => {
    try {
      const whatsNewPath = resolveWhatsNewPath(app, lang);
      let finalPath = whatsNewPath;
      try {
        await fs.promises.access(finalPath, fs.constants.F_OK);
      } catch {
        finalPath = path.join(app.getAppPath(), "whats-new.md");
      }
      log.info(`Reading the file: ${finalPath}`);
      const markdown = await fs.promises.readFile(finalPath, "utf-8");
      const version = parseWhatsNewVersion(markdown) || (await getAppVersion());
      const html = renderMarkdown(markdown);
      return { version, changes: [html], source: "markdown" };
    } catch (error) {
      log.error("Reading error: whatsNew.md:", error);
      return { version: "unknown", changes: [] };
    }
  });

  ipcMain.handle(CHANNELS.WHATS_NEW_READY, async () => {
    try {
      if (typeof dispatchPendingWhatsNew === "function") {
        dispatchPendingWhatsNew();
      }
      return { success: true };
    } catch (error) {
      log.error("whats-new:ready error:", error);
      return { success: false, error: error.message || String(error) };
    }
  });

  ipcMain.handle(CHANNELS.WHATS_NEW_ACK, async (_evt, version) => {
    try {
      let cleared = false;
      if (typeof clearPendingWhatsNewVersion === "function") {
        cleared = clearPendingWhatsNewVersion(version);
      }
      return { success: true, cleared };
    } catch (error) {
      log.error("whats-new:ack error:", error);
      return { success: false, error: error.message || String(error) };
    }
  });
}

module.exports = {
  registerWhatsNewIpcHandlers,
  __test: {
    parseWhatsNewVersion,
    resolveWhatsNewPath,
  },
};
