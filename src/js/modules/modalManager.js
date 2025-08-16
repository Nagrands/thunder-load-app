// src/js/modules/modalManager.js

/**
 * Закрывает все модальные окна.
 * @param {HTMLElement[]} modals - Массив модальных окон.
 */
function closeAllModals(modals) {
  modals.forEach((modal) => {
    if (modal && modal.style.display === "flex") {
      modal.style.display = "none";
    }
  });
}

export { closeAllModals };
