// src/js/modules/downloadCompleteHandler.js

import { showConfirmationDialog } from "./modals.js";
import { showToast } from "./toast.js";
import { showUrlActionButtons } from "./urlInputHandler.js";

function initDownloadCompleteHandler() {
  window.electron.on("download-complete", async ({ title, filePath }) => {
    const isDisabled = await window.electron.invoke(
      "get-disable-complete-modal-status",
    );

    // Показываем кнопки выбора папки и вставки обратно
    showUrlActionButtons();

    if (!isDisabled) {
      showConfirmationDialog(
        `
        <h4 class="toast-success">Загрузка завершена!</h4>
        <br>
        <div class="info-entry">
            <p class="info-complete">
                <i class="fa-solid fa-film"></i>
                ${title}
            </p>
        </div>
        <hr>
        <h4 class="toast-info">Файл сохранен по пути:</h4>
        <br>
        <div class="info-entry">
            <span class="quality">
                <i class="fa-solid fa-folder-tree"></i>
                ${filePath}
            </span>
        </div>
        <hr>
        <h4 class="toast-warning">Открыть файл?</h4>`,
        async () => {
          try {
            await window.electron.invoke("open-last-video", filePath);
          } catch (error) {
            console.error("Error opening last video:", error);
            showToast("Не удалось открыть последнее видео.", "error");
          }
        },
      );
    }
  });
}

export { initDownloadCompleteHandler };
