// src/js/modules/modals.js

import { closeAllModals } from "./modalManager.js";
import {
  whatsNewModal,
  confirmationModal,
  settingsModal,
} from "./domElements.js";
import { t } from "./i18n.js";
import { hideAllTooltips } from "./tooltipInitializer.js";
import {
  acquireOverlayActive,
  releaseOverlayActive,
} from "./scrollLockManager.js";

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
const CONFIRMATION_MODAL_OVERLAY_OWNER = "confirmation-modal";

function normalizeConfirmationChoices(choices) {
  return Array.isArray(choices)
    ? choices
        .map((choice) => ({
          value: String(choice?.value || ""),
          label: String(choice?.label || ""),
          description: String(choice?.description || ""),
        }))
        .filter((choice) => choice.value && choice.label)
    : [];
}

function renderConfirmationMessage(messageEl, message, allowHtml) {
  const msgText = String(message || "");
  if (!allowHtml) {
    messageEl.textContent = msgText;
    return;
  }

  const safeHtml = sanitizeConfirmationHtml(msgText);
  if (typeof safeHtml === "string") {
    messageEl.innerHTML = safeHtml;
  } else {
    // Fallback: avoid rendering raw HTML when DOMPurify is unavailable.
    messageEl.textContent = msgText;
  }
}

function renderConfirmationChoices(
  messageEl,
  choices,
  selectedValue,
  onSelect,
) {
  if (!choices.length) return null;

  const list = document.createElement("div");
  list.className = "confirmation-choice-list";
  list.setAttribute("role", "radiogroup");

  choices.forEach((choice, index) => {
    const option = document.createElement("label");
    option.className = "confirmation-choice";
    option.dataset.value = choice.value;

    const input = document.createElement("input");
    input.type = "radio";
    input.name = "confirmation-choice";
    input.value = choice.value;
    input.checked = choice.value === selectedValue;

    const marker = document.createElement("span");
    marker.className = "confirmation-choice__marker";
    marker.setAttribute("aria-hidden", "true");

    const body = document.createElement("span");
    body.className = "confirmation-choice__body";

    const label = document.createElement("span");
    label.className = "confirmation-choice__label";
    label.textContent = choice.label;
    body.appendChild(label);

    if (choice.description) {
      const description = document.createElement("span");
      description.className = "confirmation-choice__description";
      description.textContent = choice.description;
      body.appendChild(description);
    }

    option.append(input, marker, body);
    option.classList.toggle("is-selected", input.checked);
    option.addEventListener("change", () => {
      onSelect(choice.value);
      list.querySelectorAll(".confirmation-choice").forEach((item) => {
        const radio = item.querySelector("input");
        item.classList.toggle("is-selected", Boolean(radio?.checked));
      });
    });

    if (index === 0 && !choices.some((item) => item.value === selectedValue)) {
      input.checked = true;
      option.classList.add("is-selected");
      onSelect(choice.value);
    }

    list.appendChild(option);
  });

  messageEl.appendChild(list);
  return list;
}

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
    confirmResult = true,
    cancelResult = false,
    closeResult = false,
    choices: rawChoices = [],
    defaultChoice = "",
    onConfirm: confirmCb,
    onCancel: cancelCb,
  } = opts;
  const choices = normalizeConfirmationChoices(rawChoices);
  let selectedChoiceValue =
    choices.find((choice) => choice.value === String(defaultChoice))?.value ||
    choices[0]?.value ||
    "";

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

  renderConfirmationMessage(confirmationMessage, message, allowHtml);
  renderConfirmationChoices(
    confirmationMessage,
    choices,
    selectedChoiceValue,
    (value) => {
      selectedChoiceValue = value;
    },
  );
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
        finalize(choices.length ? selectedChoiceValue : confirmResult);
      } catch (err) {
        console.error("Ошибка в обработчике подтверждения:", err);
      } finally {
        disableControls(false);
      }
    };

    const onCancelClick = (result = cancelResult) => {
      try {
        if (typeof cancelCb === "function") cancelCb();
        if (typeof onCancel === "function") onCancel();
      } catch (err) {
        console.error("Ошибка в обработчике отмены:", err);
      } finally {
        closeModal();
        finalize(result);
      }
    };

    const onCancelButtonClick = () => onCancelClick(cancelResult);
    const onCloseClick = () => onCancelClick(closeResult);

    const closeModal = (returnFocus = true) => {
      confirmationModal.style.display = "none";
      confirmationModal.setAttribute("aria-hidden", "true");
      confirmationModal.removeAttribute("data-tone");
      document.body.classList.remove("confirmation-open");
      releaseOverlayActive(CONFIRMATION_MODAL_OVERLAY_OWNER);
      cancelButton.style.display = "";
      confirmButton.removeEventListener("click", onConfirmClick);
      cancelButton.removeEventListener("click", onCancelButtonClick);
      closeModalIcon.removeEventListener("click", onCloseClick);
      window.removeEventListener("keydown", onKeyDown);
      if (returnFocus) confirmButton.blur();
    };

    const onKeyDown = (event) => {
      if (event.key === "Escape") {
        onCancelClick(closeResult);
      } else if (event.key === "Enter") {
        onConfirmClick();
      }
    };

    closeAllModalsFunction(); // Закрываем все модальные окна перед открытием нового

    // Добавляем слушатели событий
    confirmButton.addEventListener("click", onConfirmClick);
    cancelButton.addEventListener("click", onCancelButtonClick);
    closeModalIcon.addEventListener("click", onCloseClick);
    window.addEventListener("keydown", onKeyDown);

    // Показываем модальное окно
    confirmationModal.style.display = "flex";
    confirmationModal.style.justifyContent = "center";
    confirmationModal.style.alignItems = "center";
    confirmationModal.setAttribute("aria-hidden", "false");
    acquireOverlayActive(CONFIRMATION_MODAL_OVERLAY_OWNER);
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
