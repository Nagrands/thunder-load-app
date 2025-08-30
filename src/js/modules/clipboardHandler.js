// src/js/modules/clipboardHandler.js

import { state, updateButtonState } from "./state.js";
import { isValidUrl, isSupportedUrl } from "./validation.js";
import { urlInput, qualityButton, qualityDropdown } from "./domElements.js";
import { updateIcon } from "./iconUpdater.js";
import { showToast } from "./toast.js";

function initClipboardHandler() {
  window.electron.onWindowFocused((clipboardContent) => {
    if (
      !state.isDownloading &&
      isValidUrl(clipboardContent) &&
      isSupportedUrl(clipboardContent) &&
      clipboardContent !== state.lastPastedUrl
    ) {
      // Активируем вкладку Downloader, чтобы пользователь сразу видел карточку
      try {
        const tabBtn = document.querySelector('.group-menu [data-menu="download"]');
        if (tabBtn) tabBtn.click();
        else document.querySelector('#sidebar .sidebar-item[data-tab="download"]')?.click();
      } catch {}

      urlInput.value = clipboardContent;
      // Обновляем иконку источника и состояние кнопки
      updateIcon(clipboardContent);
      updateButtonState();

      // Инициируем стандартные реакции, как при ручной вставке
      try {
        urlInput.dispatchEvent(new Event("input", { bubbles: true }));
        // Немедленный предпросмотр без ожидания debounce
        urlInput.dispatchEvent(new Event("force-preview"));
      } catch {}

      // Откроем выбор качества, чтобы пользователь сразу выбрал пресет
      try {
        if (qualityButton && qualityDropdown) {
          qualityButton.setAttribute("aria-expanded", "true");
          qualityDropdown.hidden = false;
        }
      } catch {}

      showToast("Ссылка из буфера обмена вставлена автоматически.", "info");
      state.lastPastedUrl = clipboardContent;
    }
  });
}

export { initClipboardHandler };
