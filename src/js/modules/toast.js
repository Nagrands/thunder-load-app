// src/js/modules/toast.js

import { toastContainer } from "./domElements.js";
import { t } from "./i18n.js";

const TOAST_HTML_ALLOWED_TAGS = [
  "strong",
  "em",
  "b",
  "i",
  "br",
  "code",
  "span",
];
const TOAST_HTML_ALLOWED_ATTR = {
  span: ["class"],
  code: ["class"],
};
const DEFAULT_TOAST_DURATION = 5500;
const TOAST_HIDE_ANIMATION_MS = 220;
const MAX_VISIBLE_TOASTS = 5;
const VALID_TOAST_TYPES = new Set([
  "info",
  "success",
  "error",
  "warning",
  "loading",
]);

function normalizeToastType(type) {
  return VALID_TOAST_TYPES.has(type) ? type : "info";
}

function normalizeToastOptions(
  type = "info",
  duration = DEFAULT_TOAST_DURATION,
  title = null,
  onClickUndo = null,
  accent = false,
  options = {},
) {
  if (type && typeof type === "object" && !Array.isArray(type)) {
    const config = type;
    return {
      type: normalizeToastType(config.type || config.tone || "info"),
      duration: Number.isFinite(Number(config.duration))
        ? Number(config.duration)
        : DEFAULT_TOAST_DURATION,
      title: config.title ?? null,
      onClickUndo:
        typeof config.onClickUndo === "function"
          ? config.onClickUndo
          : typeof config.onUndo === "function"
            ? config.onUndo
            : null,
      accent: Boolean(config.accent),
      renderOptions: {
        allowHtml: Boolean(config.allowHtml),
        ...(config.options || {}),
      },
    };
  }

  return {
    type: normalizeToastType(type),
    duration: Number.isFinite(Number(duration))
      ? Number(duration)
      : DEFAULT_TOAST_DURATION,
    title,
    onClickUndo,
    accent: Boolean(accent),
    renderOptions: options || {},
  };
}

function sanitizeToastHtml(html) {
  const purifier = window?.DOMPurify;
  if (!purifier || typeof purifier.sanitize !== "function") {
    return null;
  }
  return purifier.sanitize(html, {
    ALLOWED_TAGS: TOAST_HTML_ALLOWED_TAGS,
    ALLOWED_ATTR: TOAST_HTML_ALLOWED_ATTR,
  });
}

function renderToastMessage(messageEl, message, options = {}) {
  const { allowHtml = false } = options;
  const text = String(message || "");
  if (!allowHtml) {
    messageEl.textContent = text;
    return;
  }
  const safeHtml = sanitizeToastHtml(text);
  if (typeof safeHtml === "string") {
    messageEl.innerHTML = safeHtml;
    return;
  }
  messageEl.textContent = text;
}

function buildToastElement({
  message,
  type,
  title,
  onClickUndo,
  accent,
  options,
}) {
  const toast = document.createElement("div");
  const toastClass = accent
    ? `toast toast-${type} toast-accent-${type}`
    : `toast toast-${type}`;
  toast.className = toastClass;
  toast.tabIndex = -1;
  toast.setAttribute("role", type === "error" ? "alert" : "status");
  toast.setAttribute("aria-live", type === "error" ? "assertive" : "polite");
  toast.dataset.ui = "toast";
  toast.dataset.type = type;

  const marker = document.createElement("span");
  marker.className = "toast-marker";
  marker.setAttribute("aria-hidden", "true");

  const icon = document.createElement("i");
  icon.className = `toast-icon ${getIconClass(type)}`;
  icon.setAttribute("aria-hidden", "true");

  const content = document.createElement("div");
  content.className = "toast-content";

  if (title) {
    const titleEl = document.createElement("div");
    titleEl.className = "toast-title";
    titleEl.textContent = String(title);
    content.appendChild(titleEl);
  }

  const messageEl = document.createElement("div");
  messageEl.className = "toast-message";
  renderToastMessage(messageEl, message, options);
  content.appendChild(messageEl);

  if (onClickUndo) {
    const undo = document.createElement("button");
    undo.type = "button";
    undo.className = "toast-undo";
    undo.id = "undo-action";
    undo.textContent = t("toast.undo");
    content.appendChild(undo);
  }

  const closeButton = document.createElement("button");
  closeButton.type = "button";
  closeButton.className = "toast-close";
  closeButton.setAttribute("aria-label", t("toast.close"));
  closeButton.dataset.ui = "toast-close";
  const closeIcon = document.createElement("i");
  closeIcon.className = "fas fa-times";
  closeIcon.setAttribute("aria-hidden", "true");
  closeButton.appendChild(closeIcon);

  const progress = document.createElement("div");
  progress.className = "toast-progress";
  progress.setAttribute("aria-hidden", "true");

  toast.append(marker, icon, content, closeButton, progress);

  return { toast, messageEl };
}

/**
 * Функция для отображения компактных уведомлений (тостов)
 * @param {string} message - Сообщение для отображения
 * @param {string} type - Тип уведомления ('info', 'success', 'error', 'warning')
 * @param {number} duration - Продолжительность отображения в миллисекундах
 * @param {string} title - Заголовок уведомления (опционально)
 * @param {function} onClickUndo - Callback функция для действия отмены
 * @param {boolean} accent - Использовать акцентный стиль
 * @param {{allowHtml?: boolean}} options - Дополнительные параметры рендера
 */
function showToast(
  message,
  type = "info",
  duration = 5500,
  title = null,
  onClickUndo = null,
  accent = false,
  options = {},
) {
  if (!toastContainer) return;
  const normalized = normalizeToastOptions(
    type,
    duration,
    title,
    onClickUndo,
    accent,
    options,
  );
  const { toast } = buildToastElement({
    message,
    type: normalized.type,
    title: normalized.title,
    onClickUndo: normalized.onClickUndo,
    accent: normalized.accent,
    options: normalized.renderOptions,
  });

  toastContainer.appendChild(toast);

  // Устанавливаем анимацию прогресс-бара
  const progressBar = toast.querySelector(".toast-progress");
  if (progressBar) {
    progressBar.style.animationDuration = `${normalized.duration}ms`;
  }

  // Показываем тост с небольшой задержкой
  setTimeout(() => {
    toast.classList.add("show");
  }, 100);

  // Обработчики событий
  setupToastEventHandlers(toast, normalized.duration, normalized.onClickUndo);

  // Ограничиваем количество одновременно отображаемых тостов
  manageToastLimit();

  return toast;
}

/**
 * Настраивает обработчики событий для тоста
 */
function setupToastEventHandlers(toast, duration, onClickUndo) {
  const closeButton = toast.querySelector(".toast-close");
  let closeTimer = setTimeout(() => closeToast(toast), duration);

  // Обработчик кнопки закрытия
  closeButton?.addEventListener("click", (e) => {
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
    const progressBar = toast.querySelector(".toast-progress");
    if (progressBar) {
      progressBar.style.animationPlayState = "paused";
    }
  });

  toast.addEventListener("mouseleave", () => {
    closeTimer = setTimeout(() => closeToast(toast), duration);
    const progressBar = toast.querySelector(".toast-progress");
    if (progressBar) {
      progressBar.style.animationPlayState = "running";
    }
  });

  // Поддержка клавиатуры
  toast.addEventListener("keydown", (e) => {
    if (e.key === "Escape") {
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
  }, TOAST_HIDE_ANIMATION_MS);
}

/**
 * Функция для выбора иконки в зависимости от типа уведомления
 */
function getIconClass(type) {
  const icons = {
    success: "fas fa-check-circle",
    error: "fas fa-times-circle",
    warning: "fas fa-exclamation-triangle",
    info: "fas fa-info-circle",
    loading: "fas fa-spinner fa-spin",
  };
  return icons[type] || icons.info;
}

/**
 * Ограничивает количество одновременно отображаемых тостов
 */
function manageToastLimit() {
  const activeToasts = Array.from(toastContainer.children).filter(
    (toast) => !toast.classList.contains("hide"),
  );

  while (activeToasts.length > MAX_VISIBLE_TOASTS) {
    const oldestToast = activeToasts.shift();
    closeToast(oldestToast);
  }
}

/**
 * Создает успешное уведомление
 */
function showSuccess(
  message,
  title = t("toast.title.success"),
  duration = 4000,
) {
  showToast(message, "success", duration, title);
}

/**
 * Создает уведомление об ошибке
 */
function showError(message, title = t("toast.title.error"), duration = 6000) {
  showToast(message, "error", duration, title, null, true);
}

/**
 * Создает предупреждающее уведомление
 */
function showWarning(
  message,
  title = t("toast.title.warning"),
  duration = 5000,
) {
  showToast(message, "warning", duration, title);
}

/**
 * Создает информационное уведомление
 */
function showInfo(message, title = t("toast.title.info"), duration = 4500) {
  showToast(message, "info", duration, title);
}

/**
 * Создает уведомление с действием отмены
 */
function showUndoable(message, undoCallback, title = t("toast.title.done")) {
  showToast(message, "info", 8000, title, undoCallback, true);
}

/**
 * Закрывает все активные тосты
 */
function closeAllToasts() {
  const toasts = toastContainer.querySelectorAll(".toast");
  toasts.forEach((toast) => closeToast(toast));
}

/**
 * Показывает уведомление о загрузке (без авто-закрытия)
 */
function showLoading(
  message = t("toast.loading.message"),
  title = t("toast.loading.title"),
  options = {},
) {
  if (!toastContainer) return null;
  const { toast, messageEl } = buildToastElement({
    message,
    type: "loading",
    title,
    onClickUndo: null,
    accent: false,
    options,
  });
  toast.classList.add("toast-info", "toast-loading");
  const titleEl = toast.querySelector(".toast-title");
  const progress = toast.querySelector(".toast-progress");
  if (progress) progress.remove();
  const closeButton = toast.querySelector(".toast-close");

  toastContainer.appendChild(toast);

  setTimeout(() => {
    toast.classList.add("show");
  }, 100);

  closeButton?.addEventListener("click", () => closeToast(toast));

  return {
    close: () => closeToast(toast),
    update: (newMessage, newTitle = null, updateOptions = {}) => {
      const nextOptions = {
        allowHtml: options?.allowHtml ?? false,
        ...updateOptions,
      };
      renderToastMessage(messageEl, newMessage, nextOptions);
      if (newTitle) titleEl.textContent = String(newTitle);
    },
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
  showLoading,
};
