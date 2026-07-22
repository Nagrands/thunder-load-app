const fs = require("fs");
const log = require("electron-log");
const { nativeImage } = require("electron");
const { resolveTrayIconPath } = require("./iconPaths");

const TRAY_STATES = Object.freeze([
  "idle",
  "downloading",
  "paused",
  "error",
  "offline",
]);

function createTrayIconController({
  fileSystem = fs,
  imageApi = nativeImage,
  logger = log,
} = {}) {
  let tray = null;
  let appBasePath = "";
  let platform = process.platform;
  let currentState = null;

  function configure(app, nextPlatform = process.platform) {
    appBasePath = app?.getAppPath?.() || "";
    platform = nextPlatform;
  }

  function loadImage(state) {
    try {
      const iconPath = resolveTrayIconPath(appBasePath, platform, state);
      if (!fileSystem.existsSync(iconPath)) {
        logger.warn(`Tray icon not found: ${iconPath}`);
        return null;
      }
      const image = imageApi.createFromPath(iconPath);
      if (!image || image.isEmpty()) {
        logger.warn(`Tray icon failed to load: ${iconPath}`);
        return null;
      }
      if (platform === "darwin" && image.setTemplateImage) {
        image.setTemplateImage(true);
      }
      return image;
    } catch (error) {
      logger.error("Failed to load tray icon", error);
      return null;
    }
  }

  function init(nextTray) {
    tray = nextTray;
    currentState = "idle";
  }

  function updateTrayIcon(state) {
    if (!TRAY_STATES.includes(state)) {
      logger.warn(`Unsupported tray state: ${state}`);
      return false;
    }
    if (!tray || state === currentState) return false;
    const image = loadImage(state);
    if (!image) return false;
    try {
      tray.setImage(image);
      currentState = state;
      return true;
    } catch (error) {
      logger.error(`Failed to update tray icon to ${state}`, error);
      return false;
    }
  }

  function reset() {
    tray = null;
    appBasePath = "";
    platform = process.platform;
    currentState = null;
  }

  return { configure, init, loadImage, reset, updateTrayIcon };
}

const trayIconController = createTrayIconController();

module.exports = {
  TRAY_STATES,
  createTrayIconController,
  trayIconController,
};
