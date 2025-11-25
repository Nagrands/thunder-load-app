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
import { setFilterInputValue } from "./historyFilter.js";
import { showConfirmationDialog } from "./modals.js";
import { showToast } from "./toast.js";
import { filterAndSortHistory } from "./filterAndSortHistory.js";
import { state, setHistoryData } from "./state.js";

let isClearingHistory = false;

/**
 * Обработчик очистки истории
 */
async function handleClearHistory() {
  if (isClearingHistory) return;
  isClearingHistory = true;

  try {
    const confirmed = await showConfirmationDialog({
      title: "Очистить историю?",
      subtitle: "История загрузок",
      message: "Вы уверены, что хотите удалить всю историю загрузок?",
      confirmText: "Очистить",
      cancelText: "Отмена",
      tone: "danger",
    });
    if (!confirmed) return;

    await window.electron.invoke("clear-history");
    state.downloadHistory = [];
    setHistoryData([]);

    // ✅ очищаем интерфейс и локальное состояние
    state.currentSearchQuery = "";
    localStorage.removeItem("lastSearch");
    setFilterInputValue("");
    renderHistory([]);
    await updateDownloadCount();
    await loadHistory(true);
    localStorage.setItem("historyVisible", "false");

    showToast("История загрузок успешно очищена.", "success");
    console.log("История успешно очищена.");
  } catch (error) {
    console.error("Error clearing history:", error);
    showToast("Ошибка очистки истории загрузок.", "error");
  } finally {
    isClearingHistory = false;
  }
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
