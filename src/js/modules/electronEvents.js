// src/js/modules/electronEvents.js

import {
  downloadCancelButton,
  versionElement,
  settingsButton,
} from "./domElements.js";
import { showToast } from "./toast.js";

function initElectronEvents() {
  // Обработчик события 'download-started'
  window.electron.on("download-started", () => {
    downloadCancelButton.disabled = false;
  });

  // Обработчик события 'onVersion'
  window.electron.onVersion(async (version) => {
    console.log("Версия приложения:", version);
    if (versionElement) {
      versionElement.textContent = `v${version}`;
    }
    try {
      const el1 = document.getElementById("settings-app-version");
      if (el1) el1.textContent = `v${version}`;
      const el2 = document.getElementById("settings-tabs-version");
      if (el2) el2.textContent = `v${version}`;

      const runtimeInfo =
        (await window.electron?.getRuntimeInfo?.()) || undefined;
      const electronVersion = runtimeInfo?.electron;
      const el3 = document.getElementById("settings-tabs-electron-version");
      if (el3 && electronVersion) {
        el3.textContent = `v${electronVersion}`;
      }
    } catch {}
  });

  // Обработчики уведомлений
  if (!window.notificationHandlerRegistered) {
    window.electron.onNotification((message) => {
      showToast(message);
    });
    window.electron.onPasteNotification((message) => {
      showToast(message);
    });
    window.notificationHandlerRegistered = true;
  }

  window.electron.onToast((message) => {
    showToast(message, "System");
  });

  // Обработчик события 'open-settings'
  window.electron.on("open-settings", () => {
    if (settingsButton) {
      settingsButton.click(); // Открытие окна настроек
    }
  });
}

export { initElectronEvents };
