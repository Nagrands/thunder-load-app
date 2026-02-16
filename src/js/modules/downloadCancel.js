// src/js/modules/downloadCancel.js

import {
  downloadCancelButton,
  downloadButton,
  progressBarContainer,
  progressBar,
  buttonText,
  urlInput,
} from "./domElements.js";
import { state, updateButtonState } from "./state.js";
import { initTooltips } from "./tooltipInitializer.js";
import { showToast } from "./toast.js";
import { showUrlActionButtons } from "./urlInputHandler.js";
import { t } from "./i18n.js";

function initDownloadCancel() {
  // Обработчик отмены загрузки
  downloadCancelButton.addEventListener("click", async () => {
    try {
      const result = await window.electron.invoke("stop-download");
      if (result.success) {
        showToast(t("download.cancelled"), "warning");
      } else {
        showToast(t("download.cancel.failed"), "error");
      }

      urlInput.value = "";

      state.isDownloading = false;
      updateButtonState();
      showUrlActionButtons();

      downloadButton.disabled = true;
      downloadButton.setAttribute("aria-disabled", "true");

      initTooltips();
    } catch (error) {
      console.error("Error stopping download:", error);
      showToast(t("download.cancel.error"), "error");
    } finally {
      state.isDownloading = false;
      urlInput.disabled = false;
      updateButtonState();
      downloadButton.classList.remove("disabled");
      downloadCancelButton.disabled = true;
      progressBarContainer.style.opacity = 0;
      progressBarContainer.classList.remove("is-active", "is-complete");
      progressBarContainer.setAttribute("aria-valuenow", "0");
      progressBar.style.width = "0%";
      buttonText.textContent = t("actions.download");
    }
  });
}

export { initDownloadCancel };
