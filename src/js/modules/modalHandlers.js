// src/js/modules/modalHandlers.js

import {
  shortcutsButton,
  shortcutsModal,
  closeSpan,
  whatsNewModal,
  confirmationModal,
  settingsModal,
} from "./domElements.js";
import { closeAllModals } from "./modalManager.js";
import { acquireOverlayActive } from "./scrollLockManager.js";

function initModalHandlers() {
  const firstRunModal = document.getElementById("first-run-modal");
  // Список всех модальных окон
  const modals = [
    shortcutsModal,
    whatsNewModal,
    confirmationModal,
    settingsModal,
    firstRunModal,
    // Добавьте другие модальные окна здесь
  ];

  // Обработчик открытия модального окна с горячими клавишами
  shortcutsButton.addEventListener("click", () => {
    closeAllModals(modals); // Закрываем все модальные окна перед открытием нового
    shortcutsModal.style.display = "flex";
    shortcutsModal.style.flexWrap = "wrap";
    shortcutsModal.style.justifyContent = "center";
    shortcutsModal.style.alignItems = "center";
    shortcutsModal.setAttribute("aria-hidden", "false");
    acquireOverlayActive("shortcuts-modal");
  });

  // Обработчик закрытия модального окна
  closeSpan.addEventListener("click", () => {
    closeAllModals(modals);
  });

  // Закрытие модальных окон при клике вне их области
  window.addEventListener("click", (event) => {
    if (modals.includes(event.target)) {
      closeAllModals([event.target]);
    }
  });
}

export { initModalHandlers };
