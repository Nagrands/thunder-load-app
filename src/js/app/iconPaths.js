const path = require("path");

const ICON_PATH_SEGMENTS = Object.freeze({
  APP_ICON_PNG: ["assets", "icons", "app", "app-icon.png"],
  APP_ICON_ICO: ["assets", "icons", "app", "app-icon.ico"],
  APP_ICON_256: ["assets", "icons", "app", "app-icon-256.png"],
  APP_ICON_ICNS: ["assets", "icons", "platform", "macos", "app-icon.icns"],
  TRAY_ICON_WINDOWS: ["assets", "icons", "tray", "tray-icon-windows.png"],
  TRAY_ICON_MACOS_TEMPLATE: [
    "assets",
    "icons",
    "tray",
    "tray-icon-macos-template.png",
  ],
  TRAY_ICON_LOADING: ["assets", "icons", "tray", "tray-loading.png"],
  MENU_VIDEO: ["assets", "icons", "menu", "video.png"],
  MENU_OPEN_FOLDER: ["assets", "icons", "menu", "open-folder.png"],
  MENU_SETTINGS: ["assets", "icons", "menu", "settings.png"],
  MENU_LOGOUT: ["assets", "icons", "menu", "logout.png"],
  NOTIFICATION_SUCCESS: ["assets", "icons", "notifications", "info-done.png"],
  NOTIFICATION_ERROR: ["assets", "icons", "notifications", "info-error.png"],
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

module.exports = {
  ICON_PATH_SEGMENTS,
  resolveIconPathFrom,
  resolveIconPathFromAppDir,
};
