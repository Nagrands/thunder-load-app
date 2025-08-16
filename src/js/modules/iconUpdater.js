// src/js/modules/iconUpdater.js

import { urlInput, iconPlaceholder } from "./domElements.js";
import { updateButtonState } from "./state.js";
import { showToast } from "./toast.js";

let iconUpdateTimeout;

/**
 * Функция для обновления иконки на основе URL
 * @param {string} url - URL для получения иконки
 */
const updateIcon = async (url) => {
  clearTimeout(iconUpdateTimeout);
  iconUpdateTimeout = setTimeout(async () => {
    try {
      let iconUrl;
      if (url) {
        iconUrl = await window.electron.invoke("get-icon-path", url);
      } else {
        iconUrl = await window.electron.invoke("get-icon-path", "default");
      }
      iconPlaceholder.innerHTML = iconUrl
        ? `<img src="file://${iconUrl}" alt="Icon">`
        : "";
    } catch (error) {
      console.error("Error updating icon:", error);
      showToast("Ошибка обновления иконки.", "error");
    }
  }, 500);
};

function initIconUpdater() {
  urlInput.addEventListener("input", () => {
    updateIcon(urlInput.value);
    updateButtonState();
  });
}

export { updateIcon, initIconUpdater };
