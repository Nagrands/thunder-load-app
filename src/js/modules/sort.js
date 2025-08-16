import { initTooltips } from "./tooltipInitializer.js";
// src/js/modules/sort.js

import { state } from "./state.js";
import { sortButton } from "./domElements.js";
import { filterAndSortHistory } from "./filterAndSortHistory.js"; // или ./filterAndSortHistory.js
import { updateDeleteSelectedButton } from "./history.js";

/**
 * Обработчик клика на кнопку сортировки
 */
function handleSortButtonClick() {
  // ✅ Сброс выбранных записей при сортировке
  state.selectedEntries = [];
  updateDeleteSelectedButton();
  document
    .querySelectorAll(".log-entry.selected")
    .forEach((el) => el.classList.remove("selected"));

  state.currentSortOrder = state.currentSortOrder === "asc" ? "desc" : "asc";
  localStorage.setItem("currentSortOrder", state.currentSortOrder);

  filterAndSortHistory(state.currentSearchQuery, state.currentSortOrder);
  updateSortIcon();
}

/**
 * Функция для обновления иконки сортировки
 */
function updateSortIcon() {
  const sortIcon = sortButton.querySelector("i");
  sortIcon.classList.remove(
    "fa-arrow-up-short-wide",
    "fa-arrow-down-wide-short",
  );

  const isAscending = state.currentSortOrder === "asc";
  const iconClass = isAscending
    ? "fa-arrow-up-short-wide"
    : "fa-arrow-down-wide-short";

  sortIcon.classList.add(iconClass);

  const tooltipText = isAscending ? "Старые сверху" : "Новые сверху";

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
