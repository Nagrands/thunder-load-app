import { initTooltips } from "./tooltipInitializer.js";
// src/js/modules/sort.js

import { state } from "./state.js";
import { sortButton } from "./domElements.js";
import { filterAndSortHistory } from "./filterAndSortHistory.js"; // или ./filterAndSortHistory.js
import { clearHistorySelection } from "./history.js";
import { t } from "./i18n.js";

/**
 * Обработчик клика на кнопку сортировки
 */
function handleSortButtonClick() {
  // ✅ Сброс выбранных записей при сортировке
  clearHistorySelection();

  state.currentSortOrder = state.currentSortOrder === "asc" ? "desc" : "asc";
  localStorage.setItem("currentSortOrder", state.currentSortOrder);

  filterAndSortHistory(state.currentSearchQuery, state.currentSortOrder);
  updateSortIcon();
}

/**
 * Функция для обновления иконки сортировки
 */
function updateSortIcon() {
  const isAscending = state.currentSortOrder === "asc";
  sortButton.innerHTML = `<i data-lucide="${isAscending ? "arrow-up-wide-narrow" : "arrow-down-wide-narrow"}"></i>`;

  const api = window?.lucide;
  if (api?.createIcons && api?.icons) {
    api.createIcons({ icons: api.icons });
  }

  const tooltipText = isAscending
    ? t("history.sort.asc")
    : t("history.sort.desc");

  const tooltipInstance = bootstrap.Tooltip.getInstance(sortButton);
  if (tooltipInstance) {
    tooltipInstance.setContent({ ".tooltip-inner": tooltipText });
  } else {
    sortButton.setAttribute("title", tooltipText);
    if (document.body.contains(sortButton)) {
      initTooltips();
    }
  }
}

/**
 * Функция для инициализации сортировки
 */
function initSort() {
  updateSortIcon();
  sortButton.addEventListener("click", handleSortButtonClick);
}

export { initSort };
