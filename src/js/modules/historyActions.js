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
import { state, setHistoryData, getHistoryData } from "./state.js";
import { t } from "./i18n.js";

let isClearingHistory = false;
const CLEAR_HISTORY_UNDO_MS = 5500;
const CLEAR_HISTORY_PREVIEW_CLEANUP_MS = 6000;

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

    const previousHistory = [
      ...(getHistoryData() || state.downloadHistory || []),
    ];
    const previewPaths = previousHistory
      .map((entry) => entry?.thumbnailCacheFile)
      .filter(Boolean);

    state.downloadHistory = [];
    setHistoryData([]);

    // ✅ очищаем интерфейс и локальное состояние
    clearHistorySelection();
    state.currentSearchQuery = "";
    state.historyPage = 1;
    localStorage.removeItem("lastSearch");
    setFilterInputValue("");
    await window.electron.invoke("save-history", []);
    renderHistory([]);
    await updateDownloadCount();
    localStorage.setItem("historyVisible", "false");

    let cleanupTimer = null;
    if (previewPaths.length) {
      cleanupTimer = setTimeout(() => {
        window.electron
          .invoke("delete-history-preview", previewPaths)
          .catch((error) =>
            console.warn(
              "Не удалось очистить превью после очистки истории:",
              error,
            ),
          );
      }, CLEAR_HISTORY_PREVIEW_CLEANUP_MS);
    }

    showToast(
      t("history.toast.deletedEntries", { count: previousHistory.length }),
      "info",
      CLEAR_HISTORY_UNDO_MS,
      null,
      async () => {
        if (cleanupTimer) {
          clearTimeout(cleanupTimer);
          cleanupTimer = null;
        }
        state.downloadHistory = [...previousHistory];
        setHistoryData(previousHistory);
        await window.electron.invoke("save-history", previousHistory);
        await loadHistory(true);
        await updateDownloadCount();
        showToast(t("history.toast.deleteCancelled"), "success");
      },
    );
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
      const historyArea = document.querySelector(".history-area");
      if (historyArea) {
        historyArea.classList.add("is-refreshing");
      }
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
      } finally {
        if (historyArea) {
          setTimeout(() => historyArea.classList.remove("is-refreshing"), 600);
        }
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
      clearFilterInputButton.classList.add("hidden");
      filterAndSortHistory("", state.currentSortOrder, true);
    });
  }

  if (filterInput && clearFilterInputButton) {
    const syncClearButton = () => {
      clearFilterInputButton.classList.toggle(
        "hidden",
        !filterInput.value?.trim(),
      );
    };
    filterInput.addEventListener("input", syncClearButton);
    syncClearButton();
  }
}

export { initHistoryActions };
