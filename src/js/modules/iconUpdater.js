// src/js/modules/iconUpdater.js

import { urlInput, iconPlaceholder } from "./domElements.js";
import { updateButtonState } from "./state.js";
import { showToast } from "./toast.js";

let iconUpdateTimeout;

const mountSelector = '.downloader-view .history-search-wrapper .search-icon, #icon-url-globe';

/**
 * Ensure we have a valid mount element for the icon (either <i> or <img>),
 * preferring an element with id `icon-url-globe`.
 * @returns {HTMLElement|null}
 */
function getIconMount() {
  return document.getElementById('icon-url-globe') || document.querySelector(mountSelector);
}

/**
 * Swap current icon element with a new element (img or i) while keeping classes/position.
 * @param {HTMLElement} current
 * @param {HTMLElement} next
 */
function swapIcon(current, next) {
  if (!current) return;
  // Preserve positioning classes
  next.className = current.className || 'search-icon';
  next.id = 'icon-url-globe';
  current.replaceWith(next);
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
        'get-icon-path',
        url && url.trim() ? url : 'default'
      );

      if (iconUrl) {
        // show favicon as <img>
        const img = document.createElement('img');
        img.setAttribute('alt', 'Icon');
        img.setAttribute('draggable', 'false');
        img.src = `file://${iconUrl}`;
        swapIcon(mount, img);
      } else {
        // fallback to globe font icon
        const i = document.createElement('i');
        i.setAttribute('aria-hidden', 'true');
        i.classList.add('fa-solid', 'fa-globe');
        swapIcon(mount, i);
      }
    } catch (error) {
      console.error('Error updating icon:', error);
      showToast('Ошибка обновления иконки.', 'error');
    }
  }, 500);
};

function initIconUpdater() {
  if (!urlInput) return;
  urlInput.addEventListener('input', () => {
    updateIcon(urlInput.value);
    updateButtonState();
  });
}

export { updateIcon, initIconUpdater };
