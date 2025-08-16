// src/js/modules/modalHandlers.js

import {
  shortcutsButton,
  shortcutsModal,
  closeSpan,
  versionContainer,
  whatsNewModal,
  confirmationModal,
  settingsModal,
} from "./domElements.js";
import { hideSidebar } from "./sidebar.js";
import { closeAllModals } from "./modalManager.js";

function initModalHandlers() {
  // Список всех модальных окон
  const modals = [
    shortcutsModal,
    whatsNewModal,
    confirmationModal,
    settingsModal,
    // Добавьте другие модальные окна здесь
  ];

  // Обработчик открытия модального окна с горячими клавишами
  shortcutsButton.addEventListener("click", () => {
    closeAllModals(modals); // Закрываем все модальные окна перед открытием нового
    hideSidebar();
    shortcutsModal.style.display = "flex";
    shortcutsModal.style.flexWrap = "wrap";
    shortcutsModal.style.justifyContent = "center";
    shortcutsModal.style.alignItems = "center";
  });

  // Обработчик закрытия модального окна
  closeSpan.addEventListener("click", () => {
    closeAllModals(modals);
  });

  // Обработчик открытия модального окна "Что нового"
  versionContainer.addEventListener("click", () => {
    closeAllModals(modals); // Закрываем все модальные окна перед открытием нового
    hideSidebar();
  });

  // Закрытие модальных окон при клике вне их области
  window.addEventListener("click", (event) => {
    if (modals.includes(event.target)) {
      event.target.style.display = "none";
    }
  });
}

export { initModalHandlers };
