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
      urlInput.value = clipboardContent;
      updateIcon(clipboardContent);
      updateButtonState();
      showToast("Ссылка из буфера обмена вставлена автоматически.", "info");
      state.lastPastedUrl = clipboardContent;
    }
  });
}

export { initClipboardHandler };
