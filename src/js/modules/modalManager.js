// src/js/modules/modalManager.js

import {
  releaseOverlayActive,
  releaseBodyScrollLock,
  repairScrollLocks,
} from "./scrollLockManager.js";

const SETTINGS_MODAL_SCROLL_LOCK_OWNER = "settings-modal";
const registeredModals = new Set();

function isModalOpen(modal) {
  if (!modal) return false;
  if (modal.id === "settings-modal" && modal.dataset.state) {
    return ["opening", "open"].includes(modal.dataset.state);
  }
  return modal.style.display === "flex" || Boolean(modal.open);
}

function registerModal(modal) {
  if (!(modal instanceof HTMLElement)) return () => {};
  registeredModals.add(modal);
  return () => registeredModals.delete(modal);
}

function openRegisteredModal(modal, { blocking = true } = {}) {
  if (!registeredModals.has(modal)) registerModal(modal);
  modal.style.removeProperty("display");
  if (!blocking && typeof modal.show === "function") {
    if (!modal.open) modal.show();
  } else if (typeof modal.showModal === "function") {
    if (!modal.open) modal.showModal();
  } else {
    modal.style.display = "flex";
    modal.setAttribute("open", "");
  }
  modal.setAttribute("aria-hidden", "false");
}

function closeRegisteredModal(modal) {
  if (!modal) return;
  if (typeof modal.close === "function") {
    if (modal.open) {
      try {
        modal.close();
      } catch {
        modal.removeAttribute("open");
      }
    }
    modal.style.removeProperty("display");
  } else {
    modal.style.display = "none";
    modal.removeAttribute("open");
  }
  modal.setAttribute("aria-hidden", "true");
}

/**
 * Закрывает все модальные окна.
 * @param {HTMLElement[]} modals - Массив модальных окон.
 */
function closeAllModals(modals) {
  modals.forEach((modal) => {
    if (isModalOpen(modal)) {
      const closeRequest = new CustomEvent("modal:close-request", {
        cancelable: true,
      });
      modal.dispatchEvent(closeRequest);
      if (closeRequest.defaultPrevented) {
        return;
      }

      modal.style.display = "none";
      if (modal.id) {
        modal.setAttribute("aria-hidden", "true");
        releaseOverlayActive(modal.id);
      }
      if (modal.id === "settings-modal") {
        releaseBodyScrollLock(SETTINGS_MODAL_SCROLL_LOCK_OWNER);
      }
    }
  });
  repairScrollLocks();
}

export {
  closeAllModals,
  closeRegisteredModal,
  openRegisteredModal,
  registerModal,
};
