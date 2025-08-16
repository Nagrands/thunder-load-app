// src/js/modules/historyFilter.js

import { filterInput } from "./domElements.js";
import { state } from "./state.js";

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
      localStorage.setItem("lastSearch", value);
      filterAndSortHistory(value, state.currentSortOrder);
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

import { getHistoryData } from "./state.js";
import { renderHistory } from "./history.js";

function filterAndSortHistory(
  query = "",
  sortOrder = "desc",
  forceRender = false,
) {
  const entries = getHistoryData();

  const filtered = query
    ? entries.filter((entry) =>
        entry.title.toLowerCase().includes(query.toLowerCase()),
      )
    : entries;

  const sorted = [...filtered].sort((a, b) =>
    sortOrder === "asc" ? a.timestamp - b.timestamp : b.timestamp - a.timestamp,
  );

  if (forceRender) {
    renderHistory(sorted);
  }

  return sorted;
}

export { initHistoryFilter, setFilterInputValue, filterAndSortHistory };
