/**
 * @file preload.js
 * @description
 * Preload script for the Electron application.
 * Provides a secure contextBridge API (`window.electron`) with safe wrappers
 * around IPC communication between renderer and main process.
 *
 * Responsibilities:
 *  - Restricts IPC channel access using whitelist (or allows all in dev mode)
 *  - Defines safe wrappers for `invoke`, `send`, `on`, `once`
 *  - Provides compatibility for legacy channel names
 *  - Exposes tools management API (versions, updates, location handling)
 *  - Supplies platform info (OS, architecture)
 *  - Handles special subscriptions: version updates, window focus, downloads,
 *    notifications, toasts, "What's New" modal
 *  - Ensures preload errors do not crash the renderer
 *
 * Exports:
 *  - `window.electron` — global object with the defined API
 *  - Typings via JSDoc (`ElectronBridge`, `PlatformInfo`, `WindowWithElectron`)
 */

// src/js/preload.js

"use strict";

try {
  const { contextBridge, ipcRenderer } = require("electron");

  /**
   * Аварийный режим: разрешить любые каналы только при явном флаге.
   * @type {boolean}
   */
  const ALWAYS_ALLOW = process.env.THUNDER_LOAD_ALLOW_UNSAFE_IPC === "1";

  /**
   * Статический список разрешённых IPC-каналов.
   * Не загружается через require, чтобы работать в sandboxed preload.
   * @type {string[]}
   */
  const VALID_CHANNELS = Object.freeze([
    "check-file-exists",
    "clear-history",
    "delete-file",
    "download-update",
    "download-video",
    "get-auto-launch-status",
    "get-auto-shutdown-deadline",
    "get-auto-shutdown-seconds",
    "get-auto-shutdown-status",
    "get-close-notification-status",
    "get-default-tab",
    "get-disable-complete-modal-status",
    "get-disable-global-shortcuts-status",
    "get-download-count",
    "get-download-parallel-limit",
    "get-download-path",
    "get-file-size",
    "get-font-size",
    "get-icon-path",
    "cache-history-preview",
    "delete-history-preview",
    "get-video-info",
    "get-minimize-instead-of-close-status",
    "get-minimize-on-launch-status",
    "get-minimize-to-tray-status",
    "get-open-on-copy-url-status",
    "get-open-on-download-complete-status",
    "get-platform-info",
    "get-theme",
    "get-version",
    "get-whats-new",
    "whats-new:ready",
    "whats-new:ack",
    "load-history",
    "open-config-folder",
    "open-download-folder",
    "open-external-link",
    "open-last-video",
    "open-terminal",
    "restart-app",
    "save-history",
    "select-download-folder",
    "set-auto-shutdown-seconds",
    "set-auto-shutdown-status",
    "set-close-notification-status",
    "set-default-tab",
    "set-disable-complete-modal-status",
    "set-disable-global-shortcuts-status",
    "set-download-path",
    "set-download-parallel-limit",
    "set-font-size",
    "set-minimize-instead-of-close",
    "set-minimize-on-launch-status",
    "set-minimize-to-tray-status",
    "set-open-on-copy-url-status",
    "set-open-on-download-complete-status",
    "set-theme",
    "show-system-notification",
    "stop-download",
    "toast",
    "toggle-auto-launch",
    "tools:checkUpdates",
    "tools:getVersions",
    "tools:installAll",
    "tools:showInFolder",
    "tools:updateFfmpeg",
    "tools:updateYtDlp",
    "tools:getLocation",
    "tools:setLocation",
    "tools:openLocation",
    "tools:migrateOld",
    "tools:detectLegacy",
    "tools:resetLocation",
    "tools:hashPickFile",
    "tools:hashCalculate",
    "tools:sorterPickFolder",
    "tools:sorterOpenFolder",
    "tools:sorterRun",
    "tools:createWindowsRestartShortcut",
    "tools:createWindowsShutdownShortcut",
    "tools:createWindowsUefiRebootShortcut",
    "tools:createWindowsAdvancedBootShortcut",
    "tools:createWindowsDeviceManagerShortcut",
    "tools:createWindowsNetworkSettingsShortcut",
    "dialog:choose-tools-dir",
    "wg-open-config-folder",
    "open-network-settings",
    "wg-export-log",
    "wg-get-config",
    "wg-set-config",
    "wg-reset-config-defaults",
    "wg-send-udp",
    "update:state",
    "update:progress",
    "update:error",
    "update-available",
    "update-available-info",
    "update-progress",
    "update-downloaded",
    "update-error",
    "update-message",
    "update:dev-open",
    "update:dev-progress",
    "update:dev-downloaded",
    "update:dev-error",
    "backup:getPrograms",
    "backup:savePrograms",
    "backup:run",
    "backup:preflight",
    "backup:chooseDir",
    "backup:openPath",
    "backup:getLastTimes",
    "backup:toggleReloadBlock",
  ]);

  /**
   * Legacy-каналы, которые используются в совместимых обёртках preload.
   * Они не входят в CHANNELS enum, но нужны для обратной совместимости.
   * @type {string[]}
   */
  const LEGACY_ALLOWED_CHANNELS = Object.freeze([
    "open-external",
    "window-minimize",
    "minimize",
    "app:minimize",
    "window-close",
    "close",
    "app:close",
    "show-whats-new",
    "window-focused",
    "download-progress",
    "download-notification",
    "paste-notification",
    "toast",
  ]);

  /**
   * Проверка доступа к каналу.
   * @param {string} channel
   * @returns {boolean}
   */
  const isAllowed = (channel) =>
    ALWAYS_ALLOW ||
    VALID_CHANNELS.includes(channel) ||
    LEGACY_ALLOWED_CHANNELS.includes(channel);

  // ────────────────────────────────────────────────────────────────────────────
  // Безопасные обёртки IPC

  /**
   * Надёжный invoke: отклоняет промис, если канал не разрешён.
   * @param {string} channel
   * @param {...any} args
   * @returns {Promise<any>}
   */
  function safeInvoke(channel, ...args) {
    if (isAllowed(channel)) return ipcRenderer.invoke(channel, ...args);
    return Promise.reject(new Error(`[IPC blocked] ${channel}`));
  }

  /**
   * Безопасная отправка сообщения без ожидания ответа.
   * @param {string} channel
   * @param {...any} args
   * @returns {void}
   */
  function safeSend(channel, ...args) {
    if (isAllowed(channel)) ipcRenderer.send(channel, ...args);
  }

  /**
   * Подписка на события IPC (listener получает только payload без event).
   * Возвращает функцию отписки.
   * @param {string} channel
   * @param {(…args: any[]) => void} listener
   * @returns {(() => void) | undefined}
   */
  function safeOn(channel, listener) {
    if (!isAllowed(channel)) return undefined;
    const wrapped = (_event, ...payload) => listener(...payload);
    ipcRenderer.on(channel, wrapped);
    return () => ipcRenderer.removeListener(channel, wrapped);
  }

  /**
   * Одноразовая подписка на событие IPC.
   * @param {string} channel
   * @param {(…args: any[]) => void} listener
   * @returns {void}
   */
  function safeOnce(channel, listener) {
    if (!isAllowed(channel)) return;
    const wrapped = (_event, ...payload) => listener(...payload);
    ipcRenderer.once(channel, wrapped);
  }

  /**
   * Отправить в первый разрешённый канал из списка вариантов (для совместимости
   * со старыми именами каналов: `window-minimize`/`minimize`/`app:minimize`).
   * @param {string[]} variants
   * @param {...any} args
   * @returns {boolean} true — если удалось отправить
   */
  function sendFirstAllowed(variants, ...args) {
    for (const ch of variants) {
      if (isAllowed(ch)) {
        ipcRenderer.send(ch, ...args);
        return true;
      }
    }
    return false;
  }

  /**
   * Информация о платформе (без IPC).
   * @typedef {Object} PlatformInfo
   * @property {boolean} isMac
   * @property {boolean} isWindows
   * @property {NodeJS.Platform} platform
   * @property {string} arch
   */

  /**
   * Получить информацию о платформе.
   * @returns {Promise<PlatformInfo>}
   */
  async function getPlatformInfo() {
    return {
      isMac: process.platform === "darwin",
      isWindows: process.platform === "win32",
      platform: process.platform,
      arch: process.arch,
    };
  }

  /**
   * Информация о версиях среды выполнения.
   * @typedef {Object} RuntimeInfo
   * @property {string} electron
   * @property {string} chrome
   * @property {string} node
   */

  /**
   * Получить версии Electron/Chromium/Node без IPC.
   * @returns {Promise<RuntimeInfo>}
   */
  async function getRuntimeInfo() {
    const versions = process?.versions || {};
    return {
      electron: versions.electron || "unknown",
      chrome: versions.chrome || "unknown",
      node: versions.node || "unknown",
    };
  }

  /**
   * API для окна (доступно как `window.electron`).
   * @typedef {Object} ElectronBridge
   * @property {(channel: string, ...args: any[]) => Promise<any>} invoke
   * @property {(channel: string, listener: (...args: any[]) => void) => (() => void)|undefined} on
   * @property {(channel: string, ...args: any[]) => void} send
   * @property {(listener: (...args: any[]) => void) => (() => void)|undefined} onShowWhatsNew
   * @property {{
   *   getVersions: () => Promise<any>,
   *   showInFolder: (p: string) => Promise<any>,
   *   installAll: () => Promise<any>,
   *   checkUpdates: (opts?: any) => Promise<any>,
   *   updateYtDlp: () => Promise<any>,
   *   updateFfmpeg: () => Promise<any>,
   *   // Tools location management
   *   getLocation: () => Promise<{ success: boolean, path?: string, isDefault?: boolean, error?: string }>,
   *   setLocation: (dir: string) => Promise<{ success: boolean, path?: string, error?: string }>,
   *   openLocation: () => Promise<{ success: boolean, path?: string, error?: string }>,
   *   migrateOld: (opts?: { overwrite?: boolean }) => Promise<{ success: boolean, copied?: string[], skipped?: string[], error?: string }>,
   *   detectLegacy: () => Promise<{ success: boolean, found?: any[], error?: string }>,
   *   resetLocation: () => Promise<{ success: boolean, path?: string, error?: string }>,
   * }} tools
   * @property {(cb: (v:any)=>void) => void} onVersion
   * @property {(cb: (...args:any[])=>void) => (()=>void)|undefined} onWindowFocused
   * @property {(cb: (...args:any[])=>void) => (()=>void)|undefined} onProgress
   * @property {(cb: (...args:any[])=>void) => (()=>void)|undefined} onNotification
   * @property {(cb: (...args:any[])=>void) => (()=>void)|undefined} onPasteNotification
   * @property {(cb: (...args:any[])=>void) => (()=>void)|undefined} onToast
   * @property {{
   *   invoke: (channel: string, ...args:any[]) => Promise<any>,
   *   send: (channel: string, ...args:any[]) => void,
   *   on: (channel: string, cb: (...args:any[])=>void) => (()=>void)|undefined,
   *   once: (channel: string, cb: (...args:any[])=>void) => void,
   *   removeAllListeners: (channel: string) => void,
   * }} ipcRenderer
   * @property {() => Promise<PlatformInfo>} getPlatformInfo
   * @property {() => Promise<RuntimeInfo>} getRuntimeInfo
   * @property {() => void} minimize
   * @property {() => void} close
   */

  /** @type {ElectronBridge} */
  const electronAPI = {
    // Совместимость со старым API
    invoke: safeInvoke,
    on: safeOn,
    send: safeSend,
    receive: safeOn,

    // Специальные подписки
    onShowWhatsNew: (callback) => safeOn("show-whats-new", callback),

    // Инструменты
    tools: {
      getVersions: () => safeInvoke("tools:getVersions"),
      showInFolder: (p) => safeInvoke("tools:showInFolder", p),
      installAll: () => safeInvoke("tools:installAll"),
      checkUpdates: (opts) => safeInvoke("tools:checkUpdates", opts),
      updateYtDlp: () => safeInvoke("tools:updateYtDlp"),
      updateFfmpeg: () => safeInvoke("tools:updateFfmpeg"),
      // Location management
      getLocation: () => safeInvoke("tools:getLocation"),
      setLocation: (dir) => safeInvoke("tools:setLocation", dir),
      openLocation: () => safeInvoke("tools:openLocation"),
      migrateOld: (opts) => safeInvoke("tools:migrateOld", opts),
      detectLegacy: () => safeInvoke("tools:detectLegacy"),
      resetLocation: () => safeInvoke("tools:resetLocation"),
      pickFileForHash: () => safeInvoke("tools:hashPickFile"),
      calculateHash: (payload) => safeInvoke("tools:hashCalculate", payload),
      pickSorterFolder: () => safeInvoke("tools:sorterPickFolder"),
      openSorterFolder: (folderPath) =>
        safeInvoke("tools:sorterOpenFolder", folderPath),
      sortFilesByCategory: (payload) => safeInvoke("tools:sorterRun", payload),
      createWindowsRestartShortcut: () =>
        safeInvoke("tools:createWindowsRestartShortcut"),
      createWindowsShutdownShortcut: () =>
        safeInvoke("tools:createWindowsShutdownShortcut"),
      createWindowsUefiRebootShortcut: () =>
        safeInvoke("tools:createWindowsUefiRebootShortcut"),
      createWindowsAdvancedBootShortcut: () =>
        safeInvoke("tools:createWindowsAdvancedBootShortcut"),
      createWindowsDeviceManagerShortcut: () =>
        safeInvoke("tools:createWindowsDeviceManagerShortcut"),
      createWindowsNetworkSettingsShortcut: () =>
        safeInvoke("tools:createWindowsNetworkSettingsShortcut"),
    },

    // Совместимые подписки/вызовы, которые ждёт старый код
    onVersion: (callback) => {
      if (typeof callback === "function") {
        safeInvoke("get-version")
          .then(callback)
          .catch(() => {});
      }
    },
    onWindowFocused: (cb) => safeOn("window-focused", cb),
    onProgress: (cb) => safeOn("download-progress", cb),
    onNotification: (cb) => safeOn("download-notification", cb),
    onPasteNotification: (cb) => safeOn("paste-notification", cb),
    onToast: (cb) => safeOn("toast", cb),
    openExternal: (url) => safeInvoke("open-external", url),

    // Прямой прокси IPC
    ipcRenderer: {
      invoke: safeInvoke,
      send: safeSend,
      on: safeOn,
      once: safeOnce,
      removeAllListeners: (channel) => ipcRenderer.removeAllListeners(channel),
    },

    // Утилиты и совместимость с разными именами каналов
    getPlatformInfo,
    getRuntimeInfo,
    minimize: () => {
      sendFirstAllowed(["window-minimize", "minimize", "app:minimize"]);
    },
    close: () => {
      sendFirstAllowed(["window-close", "close", "app:close"]);
    },
  };

  // Экспортируем в глобальный контекст окна
  contextBridge.exposeInMainWorld("electron", electronAPI);

  /**
   * Расширение Window для автодополнения в редакторах.
   * @typedef {Window & { electron: ElectronBridge }} WindowWithElectron
   */
} catch (error) {
  // Не валим рендерер из‑за ошибок в preload — просто логируем.
  console.error("[preload] failed to initialize contextBridge:", error);
}
