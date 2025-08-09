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

function initDownloadCancel() {
  // Обработчик отмены загрузки
  downloadCancelButton.addEventListener("click", async () => {
    try {
      const result = await window.electron.invoke("stop-download");
      if (result.success) {
        showToast("Загрузка отменена.", "warning");
      } else {
        showToast("Ошибка при отмене загрузки: " + result.error, "error");
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
      showToast("Ошибка при отмене загрузки.", "error");
    } finally {
      state.isDownloading = false;
      urlInput.disabled = false;
      updateButtonState();
      downloadButton.classList.remove("disabled");
      downloadCancelButton.disabled = true;
      progressBarContainer.style.opacity = 0;
      progressBar.style.width = "0%";
      buttonText.textContent = "Скачать";
    }
  });
}

export { initDownloadCancel };
