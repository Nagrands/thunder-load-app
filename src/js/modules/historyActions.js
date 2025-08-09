// src/js/modules/historyActions.js

import {
  clearHistoryButton,
  history,
  iconFilterSearch,
  refreshButton,
  filterInput,
  clearFilterInputButton,
  sortButton,
} from "./domElements.js";
import {
  loadHistory,
  getHistoryData,
  renderHistory,
  updateDownloadCount,
  updateDeleteSelectedButton,
} from "./history.js";
import { showConfirmationDialog } from "./modals.js";
import { showToast } from "./toast.js";
import { filterAndSortHistory } from "./filterAndSortHistory.js";
import { state } from "./state.js";

/**
 * Обработчик очистки истории
 */
async function handleClearHistory() {
  showConfirmationDialog(
    "Вы уверены, что хотите удалить всю историю загрузок?",
    async () => {
      try {
        await window.electron.invoke("clear-history");
        state.downloadHistory = [];

        // ✅ очищаем интерфейс и локальное состояние
        state.currentSearchQuery = "";
        localStorage.removeItem("lastSearch");
        renderHistory([]);
        await updateDownloadCount();
        localStorage.setItem("historyVisible", "false");

        showToast("История загрузок успешно очищена.", "success");
        console.log("История успешно очищена.");
      } catch (error) {
        console.error("Error clearing history:", error);
        showToast("Ошибка очистки истории загрузок.", "error");
      }
    },
  );
}

/**
 * Функция для инициализации действий над историей
 */
function initHistoryActions() {
  clearHistoryButton.addEventListener("click", handleClearHistory);

  if (refreshButton) {
    refreshButton.addEventListener("click", async () => {
      try {
        // ✅ сброс выбранных записей
        state.selectedEntries = [];
        updateDeleteSelectedButton();

        // на всякий случай — убрать визуальное выделение
        document
          .querySelectorAll(".log-entry.selected")
          .forEach((el) => el.classList.remove("selected"));

        state.currentSearchQuery = filterInput.value.trim();
        localStorage.setItem("lastSearch", state.currentSearchQuery);

        await loadHistory(true);
        const rawHistory = JSON.parse(localStorage.getItem("history")) || [];
        state.downloadHistory = rawHistory;

        showToast("История загрузок обновлена.", "info");
      } catch (error) {
        console.error("Error updating history:", error);
        showToast("Ошибка обновления истории загрузок.", "error");
      }
    });
  }

  // 🔧 Очистка фильтра
  if (clearFilterInputButton) {
    clearFilterInputButton.addEventListener("click", () => {
      filterInput.value = "";
      state.currentSearchQuery = "";
      localStorage.removeItem("lastSearch");
      filterAndSortHistory("", state.currentSortOrder);
    });
  }
}

export { initHistoryActions };
