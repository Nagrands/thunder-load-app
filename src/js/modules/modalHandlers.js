// src/js/modules/modalHandlers.js

import {
  whatsNewModal,
  confirmationModal,
  settingsModal,
} from "./domElements.js";
import { closeAllModals } from "./modalManager.js";

function initModalHandlers() {
  const firstRunModal = document.getElementById("first-run-modal");
  // Список всех модальных окон
  const modals = [
    whatsNewModal,
    confirmationModal,
    settingsModal,
    firstRunModal,
    // Добавьте другие модальные окна здесь
  ];

  // Закрытие модальных окон при клике вне их области
  window.addEventListener("click", (event) => {
    if (modals.includes(event.target)) {
      closeAllModals([event.target]);
    }
  });
}

export { initModalHandlers };
