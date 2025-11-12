// src/js/ipc/channels.js

"use strict";

/**
 * This file defines all IPC (Inter-Process Communication) channel names used throughout the application.
 * These channels facilitate communication between the main and renderer processes.
 */

/**
 * Enum-like object mapping uppercase keys to IPC channel string names.
 * Each key represents a specific IPC channel used in the application.
 */
const CHANNELS = Object.freeze({
  CHECK_FILE_EXISTS: "check-file-exists",
  CLEAR_HISTORY: "clear-history",
  DELETE_FILE: "delete-file",
  DOWNLOAD_UPDATE: "download-update",
  DOWNLOAD_VIDEO: "download-video",
  GET_AUTO_LAUNCH_STATUS: "get-auto-launch-status",
  GET_AUTO_SHUTDOWN_DEADLINE: "get-auto-shutdown-deadline",
  GET_AUTO_SHUTDOWN_SECONDS: "get-auto-shutdown-seconds",
  GET_AUTO_SHUTDOWN_STATUS: "get-auto-shutdown-status",
  GET_CLOSE_NOTIFICATION_STATUS: "get-close-notification-status",
  GET_DEFAULT_TAB: "get-default-tab",
  GET_DISABLE_COMPLETE_MODAL_STATUS: "get-disable-complete-modal-status",
  GET_DISABLE_GLOBAL_SHORTCUTS_STATUS: "get-disable-global-shortcuts-status",
  GET_DOWNLOAD_COUNT: "get-download-count",
  GET_DOWNLOAD_PATH: "get-download-path",
  GET_FILE_SIZE: "get-file-size",
  GET_FONT_SIZE: "get-font-size",
  GET_ICON_PATH: "get-icon-path",
  GET_VIDEO_INFO: "get-video-info",
  GET_MINIMIZE_INSTEAD_OF_CLOSE_STATUS: "get-minimize-instead-of-close-status",
  GET_MINIMIZE_ON_LAUNCH_STATUS: "get-minimize-on-launch-status",
  GET_MINIMIZE_TO_TRAY_STATUS: "get-minimize-to-tray-status",
  GET_OPEN_ON_COPY_URL_STATUS: "get-open-on-copy-url-status",
  GET_OPEN_ON_DOWNLOAD_COMPLETE_STATUS: "get-open-on-download-complete-status",
  GET_PLATFORM_INFO: "get-platform-info",
  GET_THEME: "get-theme",
  GET_VERSION: "get-version",
  GET_WHATS_NEW: "get-whats-new",
  WHATS_NEW_READY: "whats-new:ready",
  WHATS_NEW_ACK: "whats-new:ack",
  LOAD_HISTORY: "load-history",
  OPEN_CONFIG_FOLDER: "open-config-folder",
  OPEN_DOWNLOAD_FOLDER: "open-download-folder",
  OPEN_EXTERNAL_LINK: "open-external-link",
  OPEN_LAST_VIDEO: "open-last-video",
  OPEN_TERMINAL: "open-terminal",
  RESTART_APP: "restart-app",
  SAVE_HISTORY: "save-history",
  SELECT_DOWNLOAD_FOLDER: "select-download-folder",
  SET_AUTO_SHUTDOWN_SECONDS: "set-auto-shutdown-seconds",
  SET_AUTO_SHUTDOWN_STATUS: "set-auto-shutdown-status",
  SET_CLOSE_NOTIFICATION_STATUS: "set-close-notification-status",
  SET_DEFAULT_TAB: "set-default-tab",
  SET_DISABLE_COMPLETE_MODAL_STATUS: "set-disable-complete-modal-status",
  SET_DISABLE_GLOBAL_SHORTCUTS_STATUS: "set-disable-global-shortcuts-status",
  SET_DOWNLOAD_PATH: "set-download-path",
  SET_FONT_SIZE: "set-font-size",
  SET_MINIMIZE_INSTEAD_OF_CLOSE: "set-minimize-instead-of-close",
  SET_MINIMIZE_ON_LAUNCH_STATUS: "set-minimize-on-launch-status",
  SET_MINIMIZE_TO_TRAY_STATUS: "set-minimize-to-tray-status",
  SET_OPEN_ON_COPY_URL_STATUS: "set-open-on-copy-url-status",
  SET_OPEN_ON_DOWNLOAD_COMPLETE_STATUS: "set-open-on-download-complete-status",
  SET_THEME: "set-theme",
  SHOW_SYSTEM_NOTIFICATION: "show-system-notification",
  STOP_DOWNLOAD: "stop-download",
  TOAST: "toast",
  TOGGLE_AUTO_LAUNCH: "toggle-auto-launch",
  TOOLS_CHECKUPDATES: "tools:checkUpdates",
  TOOLS_GETVERSIONS: "tools:getVersions",
  TOOLS_INSTALLALL: "tools:installAll",
  TOOLS_SHOWINFOLDER: "tools:showInFolder",
  TOOLS_UPDATEFFMPEG: "tools:updateFfmpeg",
  TOOLS_UPDATEYTDLP: "tools:updateYtDlp",
  TOOLS_GET_LOCATION: "tools:getLocation",
  TOOLS_SET_LOCATION: "tools:setLocation",
  TOOLS_OPEN_LOCATION: "tools:openLocation",
  TOOLS_MIGRATE_OLD: "tools:migrateOld",
  TOOLS_DETECT_LEGACY: "tools:detectLegacy",
  TOOLS_RESET_LOCATION: "tools:resetLocation",
  DIALOG_CHOOSE_TOOLS_DIR: "dialog:choose-tools-dir",
  WG_OPEN_CONFIG_FOLDER: "wg-open-config-folder",
  WG_OPEN_NETWORK_SETTINGS: "open-network-settings",
  WG_EXPORT_LOG: "wg-export-log",

  // Update window events
  UPDATE_STATE_EVENT: "update:state",
  UPDATE_PROGRESS_EVENT: "update:progress",
  UPDATE_ERROR_EVENT: "update:error",
  // App update events (main → renderer)
  UPDATE_AVAILABLE: "update-available",
  UPDATE_AVAILABLE_INFO: "update-available-info",
  UPDATE_PROGRESS: "update-progress",
  UPDATE_DOWNLOADED: "update-downloaded",
  UPDATE_ERROR: "update-error",
  UPDATE_MESSAGE: "update-message",

  // Dev helpers (debug only)
  UPDATE_DEV_OPEN: "update:dev-open",
  UPDATE_DEV_PROGRESS: "update:dev-progress",
  UPDATE_DEV_DOWNLOADED: "update:dev-downloaded",
  UPDATE_DEV_ERROR: "update:dev-error",

  // Backup tab
  BACKUP_GET_PROGRAMS: "backup:getPrograms",
  BACKUP_SAVE_PROGRAMS: "backup:savePrograms",
  BACKUP_RUN: "backup:run",
  BACKUP_CHOOSE_DIR: "backup:chooseDir",
  BACKUP_OPEN_PATH: "backup:openPath",
  BACKUP_GET_LAST_TIMES: "backup:getLastTimes",
  BACKUP_TOGGLE_RELOAD_BLOCK: "backup:toggleReloadBlock",
});

/**
 * A frozen array containing all IPC channel string values defined in CHANNELS.
 * Useful for validation or iteration over all available channels.
 */
const CHANNELS_LIST = Object.freeze(Object.values(CHANNELS));

/**
 * Exports the CHANNELS enum-like object and the CHANNELS_LIST array for use in other modules.
 */
module.exports = { CHANNELS, CHANNELS_LIST };
