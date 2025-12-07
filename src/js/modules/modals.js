// src/js/modules/modals.js

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
 * @param {string|Object} options - Сообщение или объект настроек
 * @param {Function} onConfirm - Callback при подтверждении (deprecated, оставлен для совместимости)
 * @param {Function} onCancel - Callback при отмене (deprecated, оставлен для совместимости)
 */
function showConfirmationDialog(options, onConfirm, onCancel) {
  const opts =
    typeof options === "string" ? { message: options } : { ...(options || {}) };

  const {
    message = "",
    title = "Подтверждение действия",
    subtitle = "Подтверждение",
    confirmText = "Да",
    cancelText = "Нет",
    tone = "danger",
    onConfirm: confirmCb,
    onCancel: cancelCb,
  } = opts;

  // Получаем элементы модального окна
  const confirmationMessage = confirmationModal?.querySelector(
    ".confirmation-message",
  );
  const confirmButton = confirmationModal?.querySelector(".confirm-button");
  const cancelButton = confirmationModal?.querySelector(".cancel-button");
  const closeModalIcon = confirmationModal?.querySelector(".close-modal");
  const titleEl = confirmationModal?.querySelector("#confirmation-title");
  const subtitleEl = confirmationModal?.querySelector("#confirmation-subtitle");

  if (
    !confirmationModal ||
    !confirmationMessage ||
    !confirmButton ||
    !cancelButton ||
    !closeModalIcon ||
    !titleEl ||
    !subtitleEl
  ) {
    console.error("Элементы модального окна подтверждения отсутствуют.");
    return Promise.resolve(false);
  }

  confirmationMessage.innerHTML = message;
  titleEl.textContent = title;
  subtitleEl.textContent = subtitle;
  confirmButton.textContent = confirmText;
  cancelButton.textContent = cancelText;
  confirmationModal.dataset.tone = tone;

  return new Promise((resolve) => {
    let resolved = false;

    const finalize = (result) => {
      if (resolved) return;
      resolved = true;
      resolve(result);
    };

    // Обработчики событий
    const disableControls = (state) => {
      confirmButton.disabled = state;
      cancelButton.disabled = state;
      confirmButton.setAttribute("aria-busy", String(!!state));
    };

    const onConfirmClick = async () => {
      if (confirmButton.disabled) return;
      disableControls(true);
      // Скрываем окно сразу, чтобы пользователь видел отклик
      closeModal(false);
      try {
        if (typeof confirmCb === "function") await confirmCb();
        if (typeof onConfirm === "function") await onConfirm();
        finalize(true);
      } catch (err) {
        console.error("Ошибка в обработчике подтверждения:", err);
      } finally {
        disableControls(false);
      }
    };

    const onCancelClick = () => {
      try {
        if (typeof cancelCb === "function") cancelCb();
        if (typeof onCancel === "function") onCancel();
      } catch (err) {
        console.error("Ошибка в обработчике отмены:", err);
      } finally {
        closeModal();
        finalize(false);
      }
    };

    const closeModal = (returnFocus = true) => {
      confirmationModal.style.display = "none";
      confirmationModal.removeAttribute("data-tone");
      confirmButton.removeEventListener("click", onConfirmClick);
      cancelButton.removeEventListener("click", onCancelClick);
      closeModalIcon.removeEventListener("click", onCancelClick);
      window.removeEventListener("keydown", onKeyDown);
      if (returnFocus) confirmButton.blur();
    };

    const onKeyDown = (event) => {
      if (event.key === "Escape") {
        onCancelClick();
      } else if (event.key === "Enter") {
        onConfirmClick();
      }
    };

    closeAllModalsFunction(); // Закрываем все модальные окна перед открытием нового

    // Добавляем слушатели событий
    confirmButton.addEventListener("click", onConfirmClick);
    cancelButton.addEventListener("click", onCancelClick);
    closeModalIcon.addEventListener("click", onCancelClick);
    window.addEventListener("keydown", onKeyDown);

    // Показываем модальное окно
    confirmationModal.style.display = "flex";
    confirmationModal.style.justifyContent = "center";
    confirmationModal.style.alignItems = "center";
    confirmButton.focus();
  });
}

export { showConfirmationDialog };

// Глобальное закрытие модальных окон по клавише Escape
window.addEventListener("keydown", (event) => {
  if (event.key === "Escape") {
    closeAllModalsFunction();
  }
});
