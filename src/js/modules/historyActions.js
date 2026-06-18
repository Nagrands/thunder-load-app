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
const CLEAR_HISTORY_MODE_ALL = "all";
const CLEAR_HISTORY_MODE_PROBLEM = "problem";

function isFailedHistoryEntry(entry) {
  return entry?.downloadStatus === "failed" || entry?.error === true;
}

function isProblemHistoryEntry(entry) {
  return Boolean(entry?.isMissing) || isFailedHistoryEntry(entry);
}

function collectPreviewPaths(entries) {
  return entries.map((entry) => entry?.thumbnailCacheFile).filter(Boolean);
}

function schedulePreviewCleanup(previewPaths) {
  if (!previewPaths.length) return null;

  return setTimeout(() => {
    window.electron
      .invoke("delete-history-preview", previewPaths)
      .catch((error) =>
        console.warn("Не удалось очистить превью после очистки истории:", error),
      );
  }, CLEAR_HISTORY_PREVIEW_CLEANUP_MS);
}

function resetHistoryViewAfterClear(remainingHistory) {
  clearHistorySelection();
  state.currentSearchQuery = "";
  state.historyPage = 1;
  localStorage.removeItem("lastSearch");
  setFilterInputValue("");
  renderHistory(remainingHistory);
  localStorage.setItem(
    "historyVisible",
    remainingHistory.length > 0 ? "true" : "false",
  );
}

/**
 * Обработчик очистки истории
 */
async function handleClearHistory() {
  if (isClearingHistory) return;
  isClearingHistory = true;

  try {
    const previousHistory = [
      ...(getHistoryData() || state.downloadHistory || []),
    ];
    const hasProblemEntries = previousHistory.some(isProblemHistoryEntry);
    const clearMode = await showConfirmationDialog({
      title: t("history.clear.title"),
      subtitle: t("history.clear.subtitle"),
      message: t("history.clear.message"),
      confirmText: t("history.clear.confirm"),
      cancelText: t("history.clear.cancel"),
      tone: "danger",
      choices: [
        {
          value: CLEAR_HISTORY_MODE_ALL,
          label: t("history.clear.choice.all"),
          description: t("history.clear.choice.allDescription"),
        },
        {
          value: CLEAR_HISTORY_MODE_PROBLEM,
          label: t("history.clear.choice.problem"),
          description: t("history.clear.choice.problemDescription"),
        },
      ],
      defaultChoice: hasProblemEntries
        ? CLEAR_HISTORY_MODE_PROBLEM
        : CLEAR_HISTORY_MODE_ALL,
    });
    if (!clearMode) return;

    const removedEntries =
      clearMode === CLEAR_HISTORY_MODE_PROBLEM
        ? previousHistory.filter(isProblemHistoryEntry)
        : previousHistory;
    const remainingHistory =
      clearMode === CLEAR_HISTORY_MODE_PROBLEM
        ? previousHistory.filter((entry) => !isProblemHistoryEntry(entry))
        : [];

    if (!removedEntries.length) {
      if (clearMode === CLEAR_HISTORY_MODE_PROBLEM) {
        showToast(t("history.clear.noProblemEntries"), "info");
      }
      return;
    }

    const previewPaths = collectPreviewPaths(removedEntries);

    state.downloadHistory = [...remainingHistory];
    setHistoryData(remainingHistory);

    resetHistoryViewAfterClear(remainingHistory);
    await window.electron.invoke("save-history", remainingHistory);
    await updateDownloadCount();

    let cleanupTimer = schedulePreviewCleanup(previewPaths);

    showToast(
      t("history.toast.deletedEntries", { count: removedEntries.length }),
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
