// src/js/modules/toast.js

import { toastContainer } from "./domElements.js";

/**
 * Функция для отображения уведомлений (тостов) в стиле Liquid Glass
 * @param {string} message - Сообщение для отображения
 * @param {string} type - Тип уведомления ('info', 'success', 'error', 'warning')
 * @param {number} duration - Продолжительность отображения в миллисекундах
 * @param {string} title - Заголовок уведомления (опционально)
 * @param {function} onClickUndo - Callback функция для действия отмены
 * @param {boolean} accent - Использовать акцентный стиль
 */
function showToast(
  message,
  type = "info",
  duration = 5500,
  title = null,
  onClickUndo = null,
  accent = false
) {
  const toast = document.createElement("div");
  const toastClass = accent ? `toast toast-${type} toast-accent-${type}` : `toast toast-${type}`;
  toast.className = toastClass;

  // Создаем HTML структуру в стиле Liquid Glass
  toast.innerHTML = `
    <i class="toast-icon ${getIconClass(type)}"></i>
    <div class="toast-content">
      ${title ? `<div class="toast-title">${title}</div>` : ''}
      <div class="toast-message">${message}</div>
      ${onClickUndo ? '<a href="#" class="toast-undo" id="undo-action">Отменить</a>' : ''}
    </div>
    <button class="toast-close" aria-label="Закрыть уведомление">
      <i class="fas fa-times"></i>
    </button>
    <div class="toast-progress"></div>
  `;

  toastContainer.appendChild(toast);

  // Устанавливаем анимацию прогресс-бара
  const progressBar = toast.querySelector('.toast-progress');
  if (progressBar) {
    progressBar.style.animationDuration = `${duration}ms`;
  }

  // Показываем тост с небольшой задержкой
  setTimeout(() => {
    toast.classList.add("show");
  }, 100);

  // Обработчики событий
  setupToastEventHandlers(toast, duration, onClickUndo);

  // Ограничиваем количество одновременно отображаемых тостов
  manageToastLimit();
}

/**
 * Настраивает обработчики событий для тоста
 */
function setupToastEventHandlers(toast, duration, onClickUndo) {
  const closeButton = toast.querySelector(".toast-close");
  let closeTimer = setTimeout(() => closeToast(toast), duration);

  // Обработчик кнопки закрытия
  closeButton.addEventListener("click", (e) => {
    e.preventDefault();
    e.stopPropagation();
    closeToast(toast);
    clearTimeout(closeTimer);
  });

  // Обработчик для действия отмены
  if (onClickUndo) {
    const undoButton = toast.querySelector("#undo-action");
    if (undoButton) {
      undoButton.addEventListener("click", (e) => {
        e.preventDefault();
        e.stopPropagation();
        onClickUndo();
        closeToast(toast);
        clearTimeout(closeTimer);
      });
    }
  }

  // Пауза при наведении (улучшение UX)
  toast.addEventListener("mouseenter", () => {
    clearTimeout(closeTimer);
    const progressBar = toast.querySelector('.toast-progress');
    if (progressBar) {
      progressBar.style.animationPlayState = 'paused';
    }
  });

  toast.addEventListener("mouseleave", () => {
    closeTimer = setTimeout(() => closeToast(toast), duration);
    const progressBar = toast.querySelector('.toast-progress');
    if (progressBar) {
      progressBar.style.animationPlayState = 'running';
    }
  });

  // Поддержка клавиатуры
  toast.addEventListener("keydown", (e) => {
    if (e.key === 'Escape') {
      closeToast(toast);
      clearTimeout(closeTimer);
    }
  });
}

/**
 * Функция для закрытия тоста с анимацией
 */
function closeToast(toast) {
  if (!toast || !toast.parentNode) return;

  toast.classList.remove("show");
  toast.classList.add("hide");

  setTimeout(() => {
    if (toast.parentNode === toastContainer) {
      toastContainer.removeChild(toast);
    }
  }, 400);
}

/**
 * Функция для выбора иконки в зависимости от типа уведомления
 */
function getIconClass(type) {
  const icons = {
    success: "fas fa-check-circle",
    error: "fas fa-times-circle",
    warning: "fas fa-exclamation-triangle",
    info: "fas fa-info-circle"
  };
  return icons[type] || icons.info;
}

/**
 * Ограничивает количество одновременно отображаемых тостов
 */
function manageToastLimit() {
  const maxToasts = 5;
  const toasts = toastContainer.children;

  if (toasts.length > maxToasts) {
    const oldestToast = toasts[0];
    closeToast(oldestToast);
  }
}

/**
 * Создает успешное уведомление
 */
function showSuccess(message, title = "Успешно", duration = 4000) {
  showToast(message, "success", duration, title);
}

/**
 * Создает уведомление об ошибке
 */
function showError(message, title = "Ошибка", duration = 6000) {
  showToast(message, "error", duration, title, null, true);
}

/**
 * Создает предупреждающее уведомление
 */
function showWarning(message, title = "Предупреждение", duration = 5000) {
  showToast(message, "warning", duration, title);
}

/**
 * Создает информационное уведомление
 */
function showInfo(message, title = "Информация", duration = 4500) {
  showToast(message, "info", duration, title);
}

/**
 * Создает уведомление с действием отмены
 */
function showUndoable(message, undoCallback, title = "Действие выполнено") {
  showToast(message, "info", 8000, title, undoCallback, true);
}

/**
 * Закрывает все активные тосты
 */
function closeAllToasts() {
  const toasts = toastContainer.querySelectorAll('.toast');
  toasts.forEach(toast => closeToast(toast));
}

/**
 * Показывает уведомление о загрузке (без авто-закрытия)
 */
function showLoading(message = "Загрузка...", title = "Пожалуйста, подождите") {
  const toast = document.createElement("div");
  toast.className = "toast toast-info toast-loading";
  toast.innerHTML = `
    <i class="toast-icon fas fa-spinner fa-spin"></i>
    <div class="toast-content">
      <div class="toast-title">${title}</div>
      <div class="toast-message">${message}</div>
    </div>
    <button class="toast-close" aria-label="Закрыть уведомление">
      <i class="fas fa-times"></i>
    </button>
  `;

  toastContainer.appendChild(toast);
  
  setTimeout(() => {
    toast.classList.add("show");
  }, 100);

  const closeButton = toast.querySelector(".toast-close");
  closeButton.addEventListener("click", () => closeToast(toast));

  return {
    close: () => closeToast(toast),
    update: (newMessage, newTitle = null) => {
      const messageEl = toast.querySelector('.toast-message');
      const titleEl = toast.querySelector('.toast-title');
      if (messageEl) messageEl.textContent = newMessage;
      if (newTitle && titleEl) titleEl.textContent = newTitle;
    }
  };
}

export { 
  showToast, 
  showSuccess, 
  showError, 
  showWarning, 
  showInfo, 
  showUndoable, 
  closeAllToasts,
  showLoading 
};