// src/js/modules/downloadProgress.js

import { state } from "./state.js";
import { buttonText, progressBar, progressBarContainer } from "./domElements.js";

function initDownloadProgress() {
  window.electron.onProgress((progressValue) => {
    if (!state.isDownloading) return;
    const progress = progressValue.toFixed(1);
    // console.log(`Прогресс загрузки: ${progress}%`);
    buttonText.textContent = `Скачивание... ${progress}%`;
    progressBar.style.width = `${progress}%`;
    if (progressBarContainer) {
      progressBarContainer.setAttribute("aria-valuenow", progress);
    }
  });
}

export { initDownloadProgress };
