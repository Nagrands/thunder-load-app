// src/js/modules/state.js

import {
  downloadButton,
  downloadCancelButton,
  urlInput,
} from "./domElements.js";
import { isValidUrl, isSupportedUrl } from "./validation.js";

/**
 * Объект состояния приложения.
 */
const state = {
  isDownloading: false,
  currentUrl: "",
  historyVisible: window.localStorage.getItem("historyVisible") === "true",
  theme: window.localStorage.getItem("theme") || "dark",
  currentSortOrder: window.localStorage.getItem("currentSortOrder") || "desc",
  currentSearchQuery: window.localStorage.getItem("lastSearch") || "",
  lastPastedUrl: "",
  downloadQueue: [],
  selectedEntries: [], // выбранные ID
  historyPage: 1,
  historyPageSize: (() => {
    try {
      const raw = window.localStorage.getItem("historyPageSize");
      const n = Number(raw);
      if (!Number.isFinite(n) || n <= 0) return 20;
      return Math.max(4, Math.min(200, n));
    } catch {
      return 20;
    }
  })(),
};

// Временное хранилище истории (без привязки к DOM)
let historyData = [];

/**
 * Установить историю загрузок.
 * @param {Array} entries - Массив объектов истории.
 */
function setHistoryData(entries) {
  historyData = entries;
}

/**
 * Получить текущие записи истории.
 * @returns {Array} - Массив объектов истории.
 */
function getHistoryData() {
  return historyData;
}

/**
 * Функция для обновления состояния кнопок загрузки.
 */
const updateButtonState = () => {
  if (!downloadButton || !downloadCancelButton || !urlInput) {
    console.error("One or more required DOM elements are missing.");
    return;
  }

  const url = urlInput.value.trim();
  const isValid = isValidUrl(url) && isSupportedUrl(url);

  // Кнопка "Скачать" активна, если URL валидный
  downloadButton.disabled = !isValid;
  downloadButton.setAttribute("aria-disabled", !isValid);

  // Кнопка "Отмена загрузки" активна только когда что-то скачивается
  downloadCancelButton.disabled = !state.isDownloading;
  downloadCancelButton.style.display = state.isDownloading
    ? "inline-block"
    : "none";
};

/**
 * Функция для переключения темы приложения.
 */
const toggleTheme = (newTheme) => {
  state.theme = newTheme;
  window.localStorage.setItem("theme", newTheme);
};

/**
 * Функция для переключения видимости истории.
 */
const toggleHistoryVisibility = (isVisible) => {
  state.historyVisible = isVisible;
  window.localStorage.setItem("historyVisible", isVisible);
};

// Экспорт состояния и утилит
export {
  state,
  updateButtonState,
  toggleTheme,
  toggleHistoryVisibility,
  setHistoryData,
  getHistoryData,
};
