// src/js/modules/modals.js

import { hideSidebar } from "./sidebar.js";
import { closeAllModals } from "./modalManager.js";
import {
  shortcutsModal,
  whatsNewModal,
  confirmationModal,
  settingsModal,
} from "./domElements.js";

/**
 * Закрывает все модальные окна.
 */
function closeAllModalsFunction() {
  const modals = [
    shortcutsModal,
    whatsNewModal,
    confirmationModal,
    settingsModal,
    // Добавьте другие модальные окна здесь
  ];

  closeAllModals(modals);
}

/**
 * Функция для отображения кастомного модального окна подтверждения
 * @param {string} message - Сообщение для отображения
 * @param {Function} onConfirm - Callback при подтверждении
 */
function showConfirmationDialog(message, onConfirm) {
  // Получаем элементы модального окна
  const confirmationMessage = confirmationModal.querySelector(
    ".confirmation-message",
  );
  const confirmButton = confirmationModal.querySelector(".confirm-button");
  const cancelButton = confirmationModal.querySelector(".cancel-button");
  const closeModalIcon = confirmationModal.querySelector(".close-modal");

  if (
    !confirmationModal ||
    !confirmationMessage ||
    !confirmButton ||
    !cancelButton ||
    !closeModalIcon
  ) {
    console.error("Элементы модального окна подтверждения отсутствуют.");
    return;
  }

  confirmationMessage.innerHTML = message;

  // Обработчики событий
  const onConfirmClick = () => {
    onConfirm();
    closeModal();
  };

  const onCancelClick = () => {
    closeModal();
  };

  const closeModal = () => {
    confirmationModal.style.display = "none";
    confirmButton.removeEventListener("click", onConfirmClick);
    cancelButton.removeEventListener("click", onCancelClick);
    closeModalIcon.removeEventListener("click", onCancelClick);
    window.removeEventListener("keydown", onKeyDown);
  };

  const onKeyDown = (event) => {
    if (event.key === "Escape") {
      closeModal();
    } else if (event.key === "Enter") {
      onConfirmClick();
    }
  };

  closeAllModalsFunction(); // Закрываем все модальные окна перед открытием нового
  hideSidebar();

  // Добавляем слушатели событий
  confirmButton.addEventListener("click", onConfirmClick);
  cancelButton.addEventListener("click", onCancelClick);
  closeModalIcon.addEventListener("click", onCancelClick);
  window.addEventListener("keydown", onKeyDown);

  // Показываем модальное окно
  confirmationModal.style.display = "flex";
  confirmationModal.style.justifyContent = "center";
  confirmationModal.style.alignItems = "center";
}

export { showConfirmationDialog };

// Глобальное закрытие модальных окон по клавише Escape
window.addEventListener("keydown", (event) => {
  if (event.key === "Escape") {
    closeAllModalsFunction();
  }
});
