// src/js/preload.js
// Унифицированный preload‑мост с безопасными обёртками IPC и JSDoc типами
// Совместим с Windows и macOS. Не падает в dev при расхождениях каналов.

'use strict';

try {
  const { contextBridge, ipcRenderer } = require('electron');

  /**
   * Признак production‑сборки
   * @type {boolean}
   */
  const IS_PROD = process.env.NODE_ENV === 'production';

  /**
   * В dev разрешаем любые каналы, чтобы не ломать работу при несовпадении whitelist.
   * В prod — включайте общий список каналов в `./ipc/channels`.
   * @type {boolean}
   */
  const ALWAYS_ALLOW = !IS_PROD;

  /**
   * Список разрешённых каналов, если доступен общий enum каналов.
   * @type {string[]}
   */
  let VALID_CHANNELS = [];
  try {
    // Необязательный импорт: может отсутствовать в старых ветках
    const { CHANNELS_LIST } = require('./ipc/channels');
    if (Array.isArray(CHANNELS_LIST)) VALID_CHANNELS = CHANNELS_LIST;
  } catch (_) {
    // ignore
  }

  /**
   * Проверка доступа к каналу.
   * @param {string} channel
   * @returns {boolean}
   */
  const isAllowed = (channel) => (ALWAYS_ALLOW || VALID_CHANNELS.includes(channel));

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
      isMac: process.platform === 'darwin',
      isWindows: process.platform === 'win32',
      platform: process.platform,
      arch: process.arch,
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
    onShowWhatsNew: (callback) => safeOn('show-whats-new', callback),

    // Инструменты
    tools: {
      getVersions: () => safeInvoke('tools:getVersions'),
      showInFolder: (p) => safeInvoke('tools:showInFolder', p),
      installAll: () => safeInvoke('tools:installAll'),
      checkUpdates: (opts) => safeInvoke('tools:checkUpdates', opts),
      updateYtDlp: () => safeInvoke('tools:updateYtDlp'),
      updateFfmpeg: () => safeInvoke('tools:updateFfmpeg'),
      // Location management
      getLocation: () => safeInvoke('tools:getLocation'),
      setLocation: (dir) => safeInvoke('tools:setLocation', dir),
      openLocation: () => safeInvoke('tools:openLocation'),
      migrateOld: (opts) => safeInvoke('tools:migrateOld', opts),
      detectLegacy: () => safeInvoke('tools:detectLegacy'),
      resetLocation: () => safeInvoke('tools:resetLocation'),
    },

    // Совместимые подписки/вызовы, которые ждёт старый код
    onVersion: (callback) => {
      if (typeof callback === 'function') {
        safeInvoke('get-version').then(callback).catch(() => {});
      }
    },
    onWindowFocused: (cb) => safeOn('window-focused', cb),
    onProgress: (cb) => safeOn('download-progress', cb),
    onNotification: (cb) => safeOn('download-notification', cb),
    onPasteNotification: (cb) => safeOn('paste-notification', cb),
    onToast: (cb) => safeOn('toast', cb),

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
    minimize: () => { sendFirstAllowed(['window-minimize', 'minimize', 'app:minimize']); },
    close: () => { sendFirstAllowed(['window-close', 'close', 'app:close']); },
  };

  // Экспортируем в глобальный контекст окна
  contextBridge.exposeInMainWorld('electron', electronAPI);

  /**
   * Расширение Window для автодополнения в редакторах.
   * @typedef {Window & { electron: ElectronBridge }} WindowWithElectron
   */
} catch (error) {
  // Не валим рендерер из‑за ошибок в preload — просто логируем.
  console.error('[preload] failed to initialize contextBridge:', error);
}
