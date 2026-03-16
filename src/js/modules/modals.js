// src/js/modules/modals.js

import { closeAllModals } from "./modalManager.js";
import {
  shortcutsModal,
  whatsNewModal,
  confirmationModal,
  settingsModal,
} from "./domElements.js";
import { t } from "./i18n.js";
import { hideAllTooltips } from "./tooltipInitializer.js";

const CONFIRMATION_HTML_ALLOWED_TAGS = [
  "strong",
  "em",
  "b",
  "i",
  "br",
  "code",
  "span",
  "div",
  "p",
  "h4",
  "hr",
];

function sanitizeConfirmationHtml(html) {
  const purifier = window?.DOMPurify;
  if (!purifier || typeof purifier.sanitize !== "function") {
    return null;
  }
  return purifier.sanitize(html, {
    ALLOWED_TAGS: CONFIRMATION_HTML_ALLOWED_TAGS,
    // DOMPurify expects a flat list of attributes, not per-tag maps.
    ALLOWED_ATTR: ["class"],
  });
}

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
  // Prevent tooltip/popover overlap above the confirmation modal.
  document.body.classList.add("confirmation-open");
  hideAllTooltips();
  if (document.activeElement instanceof HTMLElement) {
    document.activeElement.blur();
  }

  const opts =
    typeof options === "string" ? { message: options } : { ...(options || {}) };

  const {
    message = "",
    title = t("confirm.default.title"),
    subtitle = t("confirm.default.subtitle"),
    confirmText = t("confirm.default.confirm"),
    cancelText = t("confirm.default.cancel"),
    tone = "danger",
    singleButton = false,
    allowHtml = false,
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
    console.error(t("confirm.error.missing"));
    return Promise.resolve(false);
  }

  const msgText = String(message || "");
  if (!allowHtml) {
    confirmationMessage.textContent = msgText;
  } else {
    const safeHtml = sanitizeConfirmationHtml(msgText);
    if (typeof safeHtml === "string") {
      confirmationMessage.innerHTML = safeHtml;
    } else {
      // Fallback: avoid rendering raw HTML when DOMPurify is unavailable.
      confirmationMessage.textContent = msgText;
    }
  }
  titleEl.textContent = title;
  subtitleEl.textContent = subtitle;
  confirmButton.textContent = confirmText;
  cancelButton.textContent = cancelText;
  confirmationModal.dataset.tone = tone;
  cancelButton.style.display = singleButton ? "none" : "";

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
      document.body.classList.remove("confirmation-open");
      cancelButton.style.display = "";
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
