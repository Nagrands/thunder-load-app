// src/js/modules/downloadCancel.js

import {
  downloadCancelButton,
  downloadButton,
  progressBarContainer,
  buttonText,
  urlInput,
} from "./domElements.js";
import { state, updateButtonState } from "./state.js";
import { initTooltips } from "./tooltipInitializer.js";
import { showToast } from "./toast.js";
import { showUrlActionButtons } from "./urlInputHandler.js";
import { t } from "./i18n.js";
const cancelCountBadge = document.getElementById("download-cancel-count");

function initDownloadCancel() {
  // Обработчик отмены загрузки
  downloadCancelButton.addEventListener("click", async () => {
    try {
      const result = await window.electron.invoke("stop-download");
      if (result.success) {
        const cancelledCount = Number(result.cancelled || 0);
        showToast(
          t("download.cancelledMany", { count: cancelledCount || 0 }),
          "warning",
        );
      } else {
        showToast(t("download.cancel.failed"), "error");
      }
      state.activeDownloads = [];
      state.isDownloading = false;
      state.suppressAutoPump = true;
      updateButtonState();
      showUrlActionButtons();

      initTooltips();
    } catch (error) {
      console.error("Error stopping download:", error);
      showToast(t("download.cancel.error"), "error");
    } finally {
      state.activeDownloads = [];
      state.isDownloading = false;
      state.suppressAutoPump = true;
      urlInput.disabled = false;
      updateButtonState();
      downloadButton.classList.remove("disabled");
      downloadButton.classList.remove("loading");
      downloadCancelButton.disabled = true;
      if (cancelCountBadge) {
        cancelCountBadge.textContent = "0";
        cancelCountBadge.classList.add("hidden");
      }
      downloadCancelButton.setAttribute("title", t("actions.cancelDownload"));
      downloadCancelButton.setAttribute(
        "aria-label",
        t("actions.cancelDownload"),
      );
      downloadCancelButton.setAttribute(
        "data-bs-original-title",
        t("actions.cancelDownload"),
      );
      progressBarContainer.style.opacity = 0;
      progressBarContainer.classList.remove("is-active", "is-complete");
      progressBarContainer.setAttribute("aria-valuenow", "0");
      progressBarContainer.style.setProperty("--progress-ratio", "0");
      buttonText.textContent = t("actions.download");
      try {
        window.dispatchEvent(
          new CustomEvent("download:state", {
            detail: { isDownloading: false, activeCount: 0 },
          }),
        );
      } catch {}
    }
  });
}

export { initDownloadCancel };
