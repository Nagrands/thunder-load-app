// src/js/modules/toast.js

import { toastContainer } from "./domElements.js";

/**
 * Функция для отображения уведомлений (тостов)
 * @param {string} message - Сообщение для отображения
 * @param {string} type - Тип уведомления ('info', 'success', 'error', 'warning')
 * @param {number} duration - Продолжительность отображения в миллисекундах
 */
function showToast(
  message,
  type = "info",
  duration = 5500,
  onClickUndo = null,
) {
  const toast = document.createElement("div");
  toast.className = `toast toast-${type}`;
  toast.innerHTML = `
    <i class="toast-icon ${getIconClass(type)}"></i>
    <div class="toast-message">${message}</div>
    <button class="close-btn">&times;</button>
  `;

  toastContainer.appendChild(toast);

  setTimeout(() => {
    toast.classList.add("show");

    // Привязываем обработчик к ссылке Undo (если есть)
    if (onClickUndo) {
      const undoLink = toast.querySelector("#undo-delete");
      if (undoLink) {
        undoLink.addEventListener("click", (e) => {
          e.preventDefault();
          onClickUndo(); // вызываем переданный callback
          closeToast(toast);
        });
      }
    }
  }, 100);

  const closeButton = toast.querySelector(".close-btn");
  closeButton.addEventListener("click", () => closeToast(toast));

  const timer = setTimeout(() => closeToast(toast), duration);

  function closeToast(toast) {
    toast.classList.remove("show");
    setTimeout(() => {
      if (toastContainer.contains(toast)) {
        toastContainer.removeChild(toast);
      }
    }, 300);
    clearTimeout(timer);
  }

  if (toastContainer.childElementCount > 4) {
    toastContainer.removeChild(toastContainer.firstChild);
  }
}

/**
 * Функция для выбора иконки в зависимости от типа уведомления
 * @param {string} type - Тип уведомления
 * @returns {string} - Класс иконки для FontAwesome
 */
function getIconClass(type) {
  switch (type) {
    case "success":
      return "fas fa-check-circle";
    case "error":
      return "fas fa-times-circle";
    case "warning":
      return "fas fa-exclamation-circle";
    default:
      return "fas fa-info-circle";
  }
}

export { showToast };
