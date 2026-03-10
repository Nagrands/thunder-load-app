// src/js/modules/downloadCancel.js

import { downloadCancelButton } from "./domElements.js";
import { updateButtonState } from "./state.js";
import { initTooltips } from "./tooltipInitializer.js";
import { showToast } from "./toast.js";
import { showUrlActionButtons } from "./urlInputHandler.js";
import { t } from "./i18n.js";
import { resetDownloadUiState } from "./downloadManager.js";

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
      resetDownloadUiState({ suppressAutoPump: true });
      updateButtonState();
      showUrlActionButtons();

      initTooltips();
    } catch (error) {
      console.error("Error stopping download:", error);
      showToast(t("download.cancel.error"), "error");
    } finally {
      resetDownloadUiState({ suppressAutoPump: true });
      updateButtonState();
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
