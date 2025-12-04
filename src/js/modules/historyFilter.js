// src/js/modules/historyFilter.js

import { filterInput } from "./domElements.js";
import { state } from "./state.js";
import { filterAndSortHistory as filterAndSortHistoryCore } from "./filterAndSortHistory.js";

/**
 * Функция для инициализации фильтрации истории
 */
let filterTimeout;
let lastQuery = "";
let isProgrammaticUpdate = false;

function initHistoryFilter() {
  filterInput.addEventListener("input", () => {
    if (isProgrammaticUpdate) return;

    clearTimeout(filterTimeout);
    filterTimeout = setTimeout(() => {
      const value = filterInput.value.trim();
      if (value === lastQuery && value !== "") return;
      lastQuery = value;

      state.currentSearchQuery = value;
      state.historyPage = 1;
      localStorage.setItem("lastSearch", value);
      filterAndSortHistoryCore(value, state.currentSortOrder, true);
    }, 300);
  });
}

// Программно установить значение фильтра без вызова фильтрации
function setFilterInputValue(value) {
  isProgrammaticUpdate = true;
  filterInput.value = value;

  // задержка, чтобы event 'input' не сработал
  setTimeout(() => {
    isProgrammaticUpdate = false;
  }, 0);
}

export {
  initHistoryFilter,
  setFilterInputValue,
  filterAndSortHistoryCore as filterAndSortHistory,
};
