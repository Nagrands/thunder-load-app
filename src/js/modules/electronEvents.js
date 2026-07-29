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

      const runtimeInfo =
        (await window.electron?.getRuntimeInfo?.()) || undefined;
      const electronVersion = runtimeInfo?.electron;
      const electronEl = document.getElementById(
        "settings-about-electron-version",
      );
      if (electronEl && electronVersion) {
        electronEl.textContent = String(electronVersion).split(".")[0];
        electronEl.title = `v${electronVersion}`;
      }
      const nodeVersion = runtimeInfo?.node;
      const nodeEl = document.getElementById("settings-about-node-version");
      if (nodeEl && nodeVersion) {
        nodeEl.textContent = String(nodeVersion).split(".")[0];
        nodeEl.title = `v${nodeVersion}`;
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
