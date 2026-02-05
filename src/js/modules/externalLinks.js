// src/js/modules/externalLinks.js

import { isValidUrl } from "./validation.js";
import { showToast } from "./toast.js";
import { t } from "./i18n.js";

function initExternalLinksHandler() {
  window.electron.on("open-site", async (url) => {
    try {
      if (!url || !isValidUrl(url)) {
        showToast(t("external.open.missing"), "error");
        return;
      }
      await window.electron.invoke("open-external-link", url);
    } catch (error) {
      console.error("Error opening external link:", error);
      showToast(t("external.open.error"), "error");
    }
  });
}

export { initExternalLinksHandler };
