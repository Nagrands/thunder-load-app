const path = require("path");

const ICON_PATH_SEGMENTS = Object.freeze({
  APP_ICON_PNG: ["assets", "icons", "app", "app-icon.png"],
  APP_ICON_ICO: ["assets", "icons", "app", "app-icon.ico"],
  APP_ICON_256: ["assets", "icons", "app", "app-icon-256.png"],
  APP_ICON_ICNS: ["assets", "icons", "platform", "macos", "app-icon.icns"],
  TRAY_ICON_WINDOWS: ["assets", "icons", "tray", "tray.ico"],
  TRAY_ICON_MACOS_TEMPLATE: ["assets", "icons", "tray", "trayTemplate.png"],
  MENU_VIDEO: ["assets", "icons", "menu", "video.png"],
  MENU_OPEN_FOLDER: ["assets", "icons", "menu", "open-folder.png"],
  MENU_SETTINGS: ["assets", "icons", "menu", "settings.png"],
  MENU_LOGOUT: ["assets", "icons", "menu", "logout.png"],
  NOTIFICATION_SUCCESS: ["assets", "icons", "notifications", "info-done.png"],
  NOTIFICATION_ERROR: ["assets", "icons", "notifications", "info-error.png"],
});

const TRAY_ICON_PATH_SEGMENTS = Object.freeze({
  darwin: Object.freeze({
    idle: ["assets", "icons", "tray", "trayTemplate.png"],
    downloading: ["assets", "icons", "tray", "trayActiveTemplate.png"],
    paused: ["assets", "icons", "tray", "trayPausedTemplate.png"],
    error: ["assets", "icons", "tray", "trayErrorTemplate.png"],
    offline: ["assets", "icons", "tray", "trayOfflineTemplate.png"],
  }),
  win32: Object.freeze({
    idle: ["assets", "icons", "tray", "tray.ico"],
    downloading: ["assets", "icons", "tray", "tray-active.ico"],
    paused: ["assets", "icons", "tray", "tray-paused.ico"],
    error: ["assets", "icons", "tray", "tray-error.ico"],
    offline: ["assets", "icons", "tray", "tray-offline.ico"],
  }),
});

function resolveIconPathFrom(basePath, key) {
  const segments = ICON_PATH_SEGMENTS[key];
  if (!segments) {
    throw new Error(`Unknown icon path key: ${key}`);
  }
  return path.join(basePath, ...segments);
}

function resolveIconPathFromAppDir(key) {
  return resolveIconPathFrom(path.resolve(__dirname, "../../../"), key);
}

function resolveTrayIconPath(basePath, platform, state) {
  const platformPaths = TRAY_ICON_PATH_SEGMENTS[platform];
  const segments = platformPaths?.[state];
  if (!segments) {
    throw new Error(`Unknown tray icon: ${platform}/${state}`);
  }
  return path.join(basePath, ...segments);
}

module.exports = {
  ICON_PATH_SEGMENTS,
  TRAY_ICON_PATH_SEGMENTS,
  resolveIconPathFrom,
  resolveIconPathFromAppDir,
  resolveTrayIconPath,
};
