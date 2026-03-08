// src/js/modules/state.js

import {
  downloadButton,
  enqueueButton,
  downloadCancelButton,
  urlInput,
} from "./domElements.js";
import { getActiveDownloadJobs } from "./downloadJobs.js";
import { isValidUrl, isSupportedUrl } from "./validation.js";

const readParallelLimit = () => {
  try {
    const raw = Number(window.localStorage.getItem("downloadParallelLimit"));
    if (!Number.isFinite(raw)) return 1;
    return Math.max(1, Math.min(2, Math.trunc(raw)));
  } catch {
    return 1;
  }
};

/**
 * Объект состояния приложения.
 */
const state = {
  isDownloading: false,
  downloadJobs: [],
  activeDownloads: [],
  failedDownloads: [],
  completedDownloads: [],
  maxParallelDownloads: readParallelLimit(),
  queuePaused: false,
  queueCollapsed: false,
  suppressAutoPump: false,
  currentUrl: "",
  historyVisible: window.localStorage.getItem("historyVisible") === "true",
  theme: window.localStorage.getItem("theme") || "dark",
  currentSortOrder: window.localStorage.getItem("currentSortOrder") || "desc",
  currentSortKey: window.localStorage.getItem("currentSortKey") || "date",
  currentSortMode: window.localStorage.getItem("currentSortMode") || "mixed",
  currentSearchQuery: window.localStorage.getItem("lastSearch") || "",
  lastPastedUrl: "",
  downloadQueue: [],
  selectedEntries: [], // выбранные ID
  historyPage: 1,
  historySourceFilter: (() => {
    try {
      return window.localStorage.getItem("historySourceFilter") || "";
    } catch {
      return "";
    }
  })(),
  deletedHistoryBuffer: [],
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
  historyDensity: (() => {
    try {
      const value = window.localStorage.getItem("historyDensity");
      return value === "compact" ? "compact" : "comfort";
    } catch {
      return "comfort";
    }
  })(),
  historyDetailsExpanded: (() => {
    try {
      return window.localStorage.getItem("historyDetailsExpanded") === "true";
    } catch {
      return false;
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
  if (enqueueButton) {
    enqueueButton.disabled = !isValid;
    enqueueButton.setAttribute("aria-disabled", !isValid);
  }

  const isBusy =
    getActiveDownloadJobs(state).length > 0 || state.isDownloading;
  state.isDownloading = isBusy;

  // Кнопка "Отмена загрузки" активна только когда есть активные задачи
  downloadCancelButton.disabled = !isBusy;
  downloadCancelButton.style.display = isBusy ? "inline-block" : "none";
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
