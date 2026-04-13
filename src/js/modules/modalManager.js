// src/js/modules/modalManager.js

import {
  releaseBodyScrollLock,
  repairScrollLocks,
} from "./scrollLockManager.js";

const SETTINGS_MODAL_SCROLL_LOCK_OWNER = "settings-modal";

/**
 * Закрывает все модальные окна.
 * @param {HTMLElement[]} modals - Массив модальных окон.
 */
function closeAllModals(modals) {
  modals.forEach((modal) => {
    if (modal && modal.style.display === "flex") {
      modal.style.display = "none";
      if (modal.id === "settings-modal") {
        modal.setAttribute("aria-hidden", "true");
        releaseBodyScrollLock(SETTINGS_MODAL_SCROLL_LOCK_OWNER);
      }
    }
  });
  repairScrollLocks();
}

export { closeAllModals };
