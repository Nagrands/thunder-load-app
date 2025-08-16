// src/js/preload.js
try {
  const { contextBridge, ipcRenderer } = require("electron");

  /* -------------------------------------------------
     1. Разрешённые каналы (renderer ↔ main)
  ------------------------------------------------- */
  const validChannels = [
    // — существующие —
    "open-terminal",
    "open-config-folder",
    "select-download-folder",
    "download-video",
    "stop-download",
    "set-download-path",
    "get-download-path",
    "load-history",
    "save-history",
    "clear-history",
    "get-theme",
    "set-theme",
    "get-font-size",
    "set-font-size",
    "get-download-count",
    "open-download-folder",
    "get-icon-path",
    "open-history",
    "open-external-link",
    "open-last-video",
    "paste-notification",
    "toggle-auto-launch",
    "get-auto-launch-status",
    "get-minimize-on-launch-status",
    "set-minimize-on-launch-status",
    "set-minimize-to-tray-status",
    "get-minimize-to-tray-status",
    "set-close-notification-status",
    "get-close-notification-status",
    "set-open-on-download-complete-status",
    "get-open-on-download-complete-status",
    "set-open-on-copy-url-status",
    "get-open-on-copy-url-status",
    "set-disable-global-shortcuts-status",
    "get-disable-global-shortcuts-status",
    "set-auto-shutdown-status",
    "get-auto-shutdown-status",
    "set-auto-shutdown-seconds",
    "get-auto-shutdown-seconds",
    "get-auto-shutdown-deadline",
    "toast",
    "window-focused",
    "download-progress",
    "download-notification",
    "open-site",
    "download-started",
    "download-complete",
    "show-system-notification",
    "set-minimize-instead-of-close",
    "get-minimize-instead-of-close-status",
    "open-settings",
    "download-update",
    "restart-app",
    "check-file-exists",
    "delete-file",
    "update-available",
    "update-progress",
    "update-error",
    "update-downloaded",
    "update-message",
    "show-whats-new",
    "get-whats-new",
    "get-version",
    "preload-error",
    "get-file-size",
    "get-disable-complete-modal-status",
    "set-disable-complete-modal-status",

    // — каналы WireGuard / WG Unlock —
    "wg-get-config",
    "wg-set-config",
    "wg-reset-config-defaults",
    "wg-get-settings",
    "wg-set-setting",
    "wg-send-udp",
    "wg-toast",
    "get-default-tab",
    "set-default-tab",
    "get-platform-info",
    "status-message",
    "tools:getVersions",
    "tools:showInFolder",
    "tools:installAll",
    "tools:checkUpdates",
    "tools:updateYtDlp",
    "tools:updateFfmpeg",
    "wg-open-config-folder",
    "wg-auto-shutdown-updated",
    "download-path-changed",
  ];

  /* -------------------------------------------------
     2. Безопасные обёртки invoke / on
  ------------------------------------------------- */
  function safeInvoke(channel, ...args) {
    if (validChannels.includes(channel)) {
      return ipcRenderer.invoke(channel, ...args).catch((err) => {
        console.error(`invoke[${channel}]`, err);
        throw err;
      });
    }
    console.warn(`Invalid invoke "${channel}"`);
    return Promise.reject(new Error(`Канал "${channel}" не разрешён`));
  }

  function safeOn(channel, callback) {
    if (validChannels.includes(channel) && typeof callback === "function") {
      ipcRenderer.on(channel, (_evt, ...args) => callback(...args));
    } else {
      console.warn(`Invalid on "${channel}"`);
    }
  }

  /* -------------------------------------------------
     3. Экспорт в window
  ------------------------------------------------- */
  contextBridge.exposeInMainWorld("electron", {
    /** прямой доступ (с фильтрацией каналов) */
    ipcRenderer: {
      invoke: safeInvoke,
      on: safeOn,
      send: (ch, ...a) =>
        validChannels.includes(ch)
          ? ipcRenderer.send(ch, ...a)
          : console.warn(`Invalid send "${ch}"`),
    },

    /** шорт‑каты для старого кода */
    invoke: safeInvoke,
    on: safeOn,
    /** Новый метод для приема сообщений (ipcRenderer.on) */
    receive: (channel, func) => {
      if (validChannels.includes(channel) && typeof func === "function") {
        ipcRenderer.on(channel, (_event, ...args) => func(...args));
      } else {
        console.warn(`Invalid receive channel: "${channel}"`);
      }
    },

    /** системные действия окна */
    minimize: () => ipcRenderer.send("window-minimize"),
    close: () => ipcRenderer.send("window-close"),
    getPlatformInfo: () => safeInvoke("get-platform-info"),

    /** инструменты */
    tools: {
      getVersions: () => safeInvoke("tools:getVersions"),
      showInFolder: (p) => safeInvoke("tools:showInFolder", p),
      installAll: () => safeInvoke("tools:installAll"),
      checkUpdates: () => safeInvoke("tools:checkUpdates"),
      updateYtDlp: () => safeInvoke("tools:updateYtDlp"),
      updateFfmpeg: () => safeInvoke("tools:updateFfmpeg"),
    },

    /** удобные подписки (оставлены без изменений) */
    onShowWhatsNew(callback) {
      safeOn("show-whats-new", callback);
    },
    onWindowFocused(callback) {
      safeOn("window-focused", callback);
    },
    onProgress(callback) {
      safeOn("download-progress", callback);
    },
    onVersion(callback) {
      safeInvoke("get-version").then(callback);
    },
    onNotification(callback) {
      safeOn("download-notification", callback);
    },
    onPasteNotification(callback) {
      safeOn("paste-notification", callback);
    },
    onToast(callback) {
      safeOn("toast", callback);
    },
  });

  console.log("validChannels:", validChannels);
} catch (error) {
  // Если preload упал, сообщаем в main‑процесс
  try {
    require("electron").ipcRenderer.send("preload-error", error);
  } catch (_) {
    console.error("preload-error", error);
  }
}
