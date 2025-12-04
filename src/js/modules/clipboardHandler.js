/**
 * @file clipboardHandler.js
 * @description
 * Handles automatic detection of supported URLs from the clipboard when the
 * application window gains focus. If a valid and supported URL is found, it
 * pre-fills the Downloader tab with the link and updates the UI state.
 *
 * Responsibilities:
 *  - Listens for clipboard content when window is focused
 *  - Validates and checks if the URL is supported
 *  - Switches to Downloader tab automatically
 *  - Prefills input field with clipboard URL
 *  - Updates source icon and button state
 *  - Triggers preview generation (bypassing debounce)
 *  - Shows toast notification for automatic paste
 *  - Tracks last pasted URL to prevent duplicates
 *
 * Exports:
 *  - initClipboardHandler — initializes the clipboard monitoring logic
 */

// src/js/modules/clipboardHandler.js

import { state, updateButtonState } from "./state.js";
import { isValidUrl, isSupportedUrl } from "./validation.js";
import { urlInput } from "./domElements.js";
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
        const tabBtn = document.querySelector(
          '.group-menu [data-menu="download"]',
        );
        tabBtn?.click();
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

      showToast("Ссылка из буфера обмена вставлена автоматически.", "info");
      state.lastPastedUrl = clipboardContent;
    }
  });
}

export { initClipboardHandler };
