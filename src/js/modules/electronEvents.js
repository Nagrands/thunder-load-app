// src/js/modules/electronEvents.js

import {
  downloadCancelButton,
  versionElement,
  settingsTrigger,
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
      const chromeVersion = runtimeInfo?.chrome;
      const nodeVersion = runtimeInfo?.node;
      const el3 = document.getElementById("settings-tabs-electron-version");
      if (el3 && electronVersion) {
        el3.textContent = `v${electronVersion}`;
      }
      const el4 = document.getElementById("settings-about-electron-version");
      if (el4 && electronVersion) {
        el4.textContent = `v${electronVersion}`;
      }
      const el5 = document.getElementById("settings-about-chrome-version");
      if (el5 && chromeVersion) {
        el5.textContent = `v${chromeVersion}`;
      }
      const el6 = document.getElementById("settings-about-node-version");
      if (el6 && nodeVersion) {
        el6.textContent = `v${nodeVersion}`;
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

  window.electron.onToast((message, type, options) => {
    showToast(message, type || "info", undefined, null, null, false, options);
  });

  // Обработчик события 'open-settings'
  if (!window.openSettingsHandlerRegistered) {
    window.electron.on("open-settings", () => {
      if (settingsTrigger) {
        settingsTrigger.click(); // Открытие окна настроек
      }
    });
    window.openSettingsHandlerRegistered = true;
  }
}

export { initElectronEvents };
