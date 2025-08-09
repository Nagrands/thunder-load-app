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
