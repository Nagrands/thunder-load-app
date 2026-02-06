// src/js/modules/historyActions.js

import {
  clearHistoryButton,
  refreshButton,
  filterInput,
  clearFilterInputButton,
} from "./domElements.js";
import {
  loadHistory,
  renderHistory,
  updateDownloadCount,
  clearHistorySelection,
} from "./history.js";
import { setFilterInputValue } from "./historyFilter.js";
import { showConfirmationDialog } from "./modals.js";
import { showToast } from "./toast.js";
import { filterAndSortHistory } from "./filterAndSortHistory.js";
import { state, setHistoryData } from "./state.js";
import { t } from "./i18n.js";

let isClearingHistory = false;

/**
 * Обработчик очистки истории
 */
async function handleClearHistory() {
  if (isClearingHistory) return;
  isClearingHistory = true;

  try {
    const confirmed = await showConfirmationDialog({
      title: t("history.clear.title"),
      subtitle: t("history.clear.subtitle"),
      message: t("history.clear.message"),
      confirmText: t("history.clear.confirm"),
      cancelText: t("history.clear.cancel"),
      tone: "danger",
    });
    if (!confirmed) return;

    await window.electron.invoke("clear-history");
    state.downloadHistory = [];
    setHistoryData([]);

    // ✅ очищаем интерфейс и локальное состояние
    state.currentSearchQuery = "";
    state.historyPage = 1;
    localStorage.removeItem("lastSearch");
    setFilterInputValue("");
    renderHistory([]);
    await updateDownloadCount();
    await loadHistory(true);
    localStorage.setItem("historyVisible", "false");

    showToast(t("history.clear.success"), "success");
    console.log("История успешно очищена.");
  } catch (error) {
    console.error("Error clearing history:", error);
    showToast(t("history.clear.error"), "error");
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
        clearHistorySelection();

        state.currentSearchQuery = filterInput.value.trim();
        localStorage.setItem("lastSearch", state.currentSearchQuery);

        await loadHistory(true);
        const rawHistory = JSON.parse(localStorage.getItem("history")) || [];
        state.downloadHistory = rawHistory;

        showToast(t("history.refresh.success"), "info");
      } catch (error) {
        console.error("Error updating history:", error);
        showToast(t("history.refresh.error"), "error");
      }
    });
  }

  // 🔧 Очистка фильтра
  if (clearFilterInputButton) {
    clearFilterInputButton.addEventListener("click", () => {
      filterInput.value = "";
      state.currentSearchQuery = "";
      state.historyPage = 1;
      localStorage.removeItem("lastSearch");
      filterAndSortHistory("", state.currentSortOrder, true);
    });
  }
}

export { initHistoryActions };
