// src/js/modules/iconUpdater.js

import { urlInput, iconPlaceholder } from "./domElements.js";
import { updateButtonState } from "./state.js";
import { showToast } from "./toast.js";
import { t } from "./i18n.js";

let iconUpdateTimeout;

const mountSelector =
  ".downloader-view .history-search-wrapper .search-icon, #icon-url-globe";

/**
 * Ensure we have a valid mount element for the icon (either <i> or <img>),
 * preferring an element with id `icon-url-globe`.
 * @returns {HTMLElement|null}
 */
function getIconMount() {
  return (
    document.getElementById("icon-url-globe") ||
    document.querySelector(mountSelector)
  );
}

/**
 * Swap current icon element with a new element (img or i) while keeping classes/position.
 * @param {HTMLElement} current
 * @param {HTMLElement} next
 */
function swapIcon(current, next) {
  if (!current) return;
  // Preserve positioning classes
  next.className = current.className || "search-icon";
  next.id = "icon-url-globe";
  current.replaceWith(next);
}

function showFallbackGlobe(mount) {
  const i = document.createElement("i");
  i.setAttribute("aria-hidden", "true");
  i.classList.add("fa-solid", "fa-globe");
  swapIcon(mount, i);
}

/**
 * Функция для обновления иконки на основе URL
 * @param {string} url - URL для получения иконки
 */
const updateIcon = async (url) => {
  clearTimeout(iconUpdateTimeout);
  iconUpdateTimeout = setTimeout(async () => {
    try {
      const mount = getIconMount() || iconPlaceholder || null;
      if (!mount) return; // нет куда рисовать — тихо выходим

      const iconUrl = await window.electron.invoke(
        "get-icon-path",
        url && url.trim() ? url : "default",
      );

      if (iconUrl) {
        // Render image icon only after successful load to avoid broken-image marker.
        const img = document.createElement("img");
        img.setAttribute("alt", t("icon.alt"));
        img.setAttribute("draggable", "false");
        img.addEventListener(
          "load",
          () => {
            const liveMount = getIconMount() || mount;
            if (liveMount?.isConnected) swapIcon(liveMount, img);
          },
          { once: true },
        );
        img.addEventListener(
          "error",
          () => {
            const liveMount = getIconMount() || mount;
            if (liveMount?.isConnected) showFallbackGlobe(liveMount);
          },
          { once: true },
        );
        img.src = `file://${encodeURI(iconUrl).replace(/#/g, "%23")}`;
      } else {
        showFallbackGlobe(mount);
      }
    } catch (error) {
      console.error("Error updating icon:", error);
      showToast(t("icon.updateError"), "error");
    }
  }, 500);
};

function initIconUpdater() {
  if (!urlInput) return;
  urlInput.addEventListener("input", () => {
    updateIcon(urlInput.value);
    updateButtonState();
  });
}

export { updateIcon, initIconUpdater };
