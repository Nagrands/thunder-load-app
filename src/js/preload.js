// src/js/preload.js
try {
  const { contextBridge, ipcRenderer } = require("electron");

  // --- ВАЖНО: в dev режиме не блокируем по whitelist, чтобы не падать из‑за несостыковок каналов.
  // Для строгого режима поменяй alwaysAllow на false и подключи CHANNELS_LIST ниже.
  const alwaysAllow = process.env.NODE_ENV !== 'production' ? true : false;

  // Необязательный список каналов из общего enums (если есть)
  let validChannels = [];
  try {
    const { CHANNELS_LIST } = require("./ipc/channels");
    if (Array.isArray(CHANNELS_LIST)) validChannels = CHANNELS_LIST;
  } catch (_) {
    // channels.js может отсутствовать в ранних сборках — игнорируем
  }

  const isAllowed = (channel) => (alwaysAllow || validChannels.includes(channel));

  // ————————————————————————————————————————————————
  // Безопасные обёртки
  function safeInvoke(channel, ...args) {
    if (isAllowed(channel)) return ipcRenderer.invoke(channel, ...args);
    return Promise.reject(new Error(`[IPC blocked] ${channel}`));
  }
  function safeSend(channel, ...args) {
    if (isAllowed(channel)) ipcRenderer.send(channel, ...args);
  }
  function safeOn(channel, listener) {
    if (!isAllowed(channel)) return;
    const wrapped = (_event, ...payload) => listener(...payload);
    ipcRenderer.on(channel, wrapped);
    return () => ipcRenderer.removeListener(channel, wrapped);
  }
  function safeOnce(channel, listener) {
    if (!isAllowed(channel)) return;
    const wrapped = (_event, ...payload) => listener(...payload);
    ipcRenderer.once(channel, wrapped);
  }

  // Локальная платформа — без IPC, чтобы не требовать обработчик в main
  async function getPlatformInfo() {
    return {
      isMac: process.platform === "darwin",
      isWindows: process.platform === "win32",
      platform: process.platform,
      arch: process.arch,
    };
  }

  contextBridge.exposeInMainWorld("electron", {
    // ——— Совместимость со старым API ———
    invoke: safeInvoke,      // <-- добавлено для совместимости (window.electron.invoke)
    on: safeOn,              // <-- совместимость (window.electron.on)
    send: safeSend,          // уже было
    receive: safeOn,         // уже было

    // Специальные удобные подписки для совместимости со старым кодом
    onShowWhatsNew: (callback) => safeOn("show-whats-new", callback),

    // Совместимый API для инструментов
    tools: {
      getVersions: () => safeInvoke("tools:getVersions"),
      showInFolder: (p) => safeInvoke("tools:showInFolder", p),
      installAll: () => safeInvoke("tools:installAll"),
      checkUpdates: (opts) => safeInvoke("tools:checkUpdates", opts),
      updateYtDlp: () => safeInvoke("tools:updateYtDlp"),
      updateFfmpeg: () => safeInvoke("tools:updateFfmpeg"),
    },

    // Совместимые подписки/вызовы, которые ждёт старый код
    onVersion: (callback) => {
      if (typeof callback === "function") {
        safeInvoke("get-version").then(callback).catch(() => {});
      }
    },
    onWindowFocused: (callback) => safeOn("window-focused", callback),
    onProgress: (callback) => safeOn("download-progress", callback),
    onNotification: (callback) => safeOn("download-notification", callback),
    onPasteNotification: (callback) => safeOn("paste-notification", callback),
    onToast: (callback) => safeOn("toast", callback),

    // Новый API — явный proxy на ipcRenderer
      // ——— Новый API: явный proxy на ipcRenderer ———
    ipcRenderer: {
      invoke: safeInvoke,
      send: safeSend,
      on: safeOn,
      once: safeOnce,
      removeAllListeners: (channel) => ipcRenderer.removeAllListeners(channel),
    },

    // Утилиты
      // ——— Утилиты ———
  getPlatformInfo,
  minimize: () => {
    // Пытаемся отправить в один из известных каналов (поддержка старых/новых названий)
    const variants = ["window-minimize", "minimize", "app:minimize"];
    for (const ch of variants) { if (isAllowed(ch)) { ipcRenderer.send(ch); break; } }
  },
  close: () => {
    const variants = ["window-close", "close", "app:close"];
    for (const ch of variants) { if (isAllowed(ch)) { ipcRenderer.send(ch); break; } }
  },
  });
} catch (error) {
  // Никогда не валим рендерер из‑за ошибок в preload — просто логируем
  // и оставляем страницу работать без bridge (renderer должен это пережить).
  console.error("[preload] failed to initialize contextBridge:", error);
}
