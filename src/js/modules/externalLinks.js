// src/js/modules/externalLinks.js

import { isValidUrl } from "./validation.js";
import { showToast } from "./toast.js";

function initExternalLinksHandler() {
  window.electron.on("open-site", async (url) => {
    try {
      if (!url || !isValidUrl(url)) {
        showToast("Не предоставлен URL для открытия внешней ссылки.", "error");
        return;
      }
      await window.electron.invoke("open-external-link", url);
    } catch (error) {
      console.error("Error opening external link:", error);
      showToast("Ошибка открытия внешней ссылки.", "error");
    }
  });
}

export { initExternalLinksHandler };
