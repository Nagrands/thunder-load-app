const fs = require("fs");
const path = require("path");

const appRoot = path.join(__dirname, "..");
const sourceRoot = path.join(appRoot, "..");

describe("download main-process architecture", () => {
  test("removes the legacy script and global mutable download state", () => {
    expect(fs.existsSync(path.join(sourceRoot, "scripts", "download.js"))).toBe(false);
    const appSource = fs.readFileSync(path.join(sourceRoot, "app.js"), "utf8");
    const ipcSource = fs.readFileSync(path.join(appRoot, "ipcHandlers.js"), "utf8");

    expect(`${appSource}\n${ipcSource}`).not.toMatch(/sharedStore/);
    expect(`${appSource}\n${ipcSource}`).not.toMatch(/downloadInProgress/);
    expect(`${appSource}\n${ipcSource}`).not.toMatch(/downloadState\.activeDownloads/);
  });

  test("keeps downloader channel implementations in focused registrars", () => {
    const ipcSource = fs.readFileSync(path.join(appRoot, "ipcHandlers.js"), "utf8");
    const registrarSource = fs.readFileSync(
      path.join(appRoot, "download", "ipcHandlers.js"),
      "utf8",
    );
    const channels = [
      "GET_VIDEO_INFO",
      "GET_VIDEO_PREVIEW",
      "DOWNLOAD_VIDEO",
      "CANCEL_DOWNLOAD_JOB",
      "STOP_DOWNLOAD",
      "SET_DOWNLOAD_PATH",
      "GET_DOWNLOAD_PATH",
      "SET_DOWNLOAD_PARALLEL_LIMIT",
      "GET_YTDLP_COOKIES_SETTINGS",
    ];

    channels.forEach((channel) => {
      expect(ipcSource).not.toContain(`ipcMain.handle(CHANNELS.${channel}`);
      expect(registrarSource).toContain(`CHANNELS.${channel}`);
    });
  });
});
