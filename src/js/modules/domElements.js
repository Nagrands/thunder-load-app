// src/js/modules/domElements.js

/**
 * Объект для хранения всех необходимых элементов DOM.
 */
const elements = {
  urlInput: document.getElementById("url"),
  downloadButton: document.getElementById("download-button"),
  enqueueButton: document.getElementById("enqueue-button"),
  downloadCancelButton: document.getElementById("download-cancel"),
  buttonText: document
    .getElementById("download-button")
    ?.querySelector(".button-text"),
  history: document.getElementById("history"),
  historyContainer: document.getElementById("history-container"),
  historyCards: document.getElementById("history-cards"),
  historyCardsEmpty: document.getElementById("history-cards-empty"),
  historyEmpty: document.getElementById("history-empty"),
  historyBulkBar: document.getElementById("history-bulk-bar"),
  historySelectedCount: document.getElementById("history-selected-count"),
  historyClearSelection: document.getElementById("history-clear-selection"),
  clearHistoryButton: document.getElementById("clear-history"),
  restoreHistoryButton: document.getElementById("restore-history"),
  historyExportJsonButton: document.getElementById("history-export-json"),
  historyExportCsvButton: document.getElementById("history-export-csv"),
  historySourceFilter: document.getElementById("history-source-filter"),
  openFolderButton: document.getElementById("open-folder"),
  iconPlaceholder:
    document.getElementById("icon-url-globe") ||
    document.querySelector(
      ".downloader-view .history-search-wrapper .search-icon",
    ),
  iconFilterSearch: document.getElementById("icon-filter-search"),
  refreshButton: document.getElementById("refresh-button"),
  versionElement: document.querySelector(".version"),
  filterInput: document.getElementById("filter-input"),
  clearFilterInputButton: document.getElementById("clear-filter-input"),
  selectFolderButton: document.getElementById("select-folder"),
  totalDownloads: document.getElementById("total-downloads"),
  openLastVideoButton: document.getElementById("open-last-video"),
  queueStartButton: document.getElementById("queue-start-button"),
  queuePauseButton: document.getElementById("queue-pause-button"),
  queueToggleButton: document.getElementById("queue-toggle-button"),
  queueClearButton: document.getElementById("queue-clear-button"),
  queueRetryTransientButton: document.getElementById(
    "queue-retry-transient-button",
  ),
  queueClearFailedButton: document.getElementById("queue-clear-failed-button"),
  queueClearDoneButton: document.getElementById("queue-clear-done-button"),
  queueRetryFailedButton: document.getElementById("queue-retry-failed-button"),
  openHistoryButton: document.getElementById("open-history"),
  progressBarContainer: document.getElementById("progress-bar-container"),
  progressBar: document.getElementById("progress-bar"),
  toastContainer: document.getElementById("toast-container"),
  shortcutsButton: document.getElementById("shortcuts-button"),
  shortcutsModal: document.getElementById("shortcuts-modal"),
  confirmationModal: document.getElementById("confirmation-modal"),
  closeSpan: document
    .getElementById("shortcuts-modal")
    ?.querySelector(".close"),
  sortButton: document.getElementById("sort-button"),
  historySortKey: document.getElementById("history-sort-key"),
  historySortMode: document.getElementById("history-sort-mode"),
  toggleAllDetailsButton: document.getElementById("toggle-all-details"),
  historyDensityCompact: document.getElementById("history-density-compact"),
  historyDensityComfort: document.getElementById("history-density-comfort"),
  contextMenu: document.getElementById("context-menu"),
  versionContainer: document.querySelector(".version-container"),
  whatsNewModal: document.getElementById("whats-new-modal"),
  whatsNewContent: document.getElementById("whats-new-content"),
  closeWhatsNewBtn: document.querySelector(".close-whats-new"),
  settingsAutoLaunchToggle: document.getElementById(
    "settings-auto-launch-toggle",
  ),
  settingsMinimizeOnLaunchToggle: document.getElementById(
    "settings-minimize-on-launch-toggle",
  ),
  settingsCloseNotificationToggle: document.getElementById(
    "settings-close-notification-toggle",
  ),
  settingsOpenOnDownloadCompleteToggle: document.getElementById(
    "settings-expand-window-after-load",
  ),
  settingsOpenOnCopyUrlToggle: document.getElementById(
    "settings-expand-window-copy",
  ),
  settingsDisableGlobalShortcutsToggle: document.getElementById(
    "settings-disable-global-shortcuts-toggle",
  ),
  settingsLowEffectsToggle: document.getElementById(
    "settings-low-effects-toggle",
  ),
  settingsCloseToTrayRadio: document.getElementById("settings-close-to-tray"),
  settingsCloseAppRadio: document.getElementById("settings-close-app-radio"),
  settingsButton: document.getElementById("settings-button"),
  githubButton: document.getElementById("open-github"),
  settingsModal: document.getElementById("settings-modal"),
  closeSettingsButton: document.querySelector(".close-settings"),
  settingsDisableCompleteModalToggle: document.getElementById(
    "settings-disable-complete-modal-toggle",
  ),
};

const OPTIONAL_KEYS = new Set([
  "historyCards",
  "historyCardsEmpty",
  "historyEmpty",
  "historyBulkBar",
  "historySelectedCount",
  "historyClearSelection",
  "historyDensityCompact",
  "historyDensityComfort",
  "historySortKey",
  "historySortMode",
  "enqueueButton",
  "queueStartButton",
  "queuePauseButton",
  "queueToggleButton",
  "queueClearButton",
  "queueRetryTransientButton",
  "queueClearFailedButton",
  "queueClearDoneButton",
  "queueRetryFailedButton",
  "progressBarContainer",
  "progressBar",
]);

// Проверка наличия всех элементов и вывод ошибок
for (const [key, element] of Object.entries(elements)) {
  if (!element && !OPTIONAL_KEYS.has(key)) {
    console.error(`Element with key '${key}' is missing in the DOM.`);
  }
}

if (
  Object.entries(elements).some(([key, el]) => !el && !OPTIONAL_KEYS.has(key))
) {
  console.error("One or more elements are missing in the DOM.");
}

// Экспорт объекта elements по умолчанию
export default elements;

// Также экспорт отдельных элементов, если это необходимо
export const {
  urlInput,
  downloadButton,
  enqueueButton,
  downloadCancelButton,
  buttonText,
  history,
  historyContainer,
  historyCards,
  historyCardsEmpty,
  historyEmpty,
  historyBulkBar,
  historySelectedCount,
  historyClearSelection,
  clearHistoryButton,
  restoreHistoryButton,
  historyExportJsonButton,
  historyExportCsvButton,
  historySourceFilter,
  openFolderButton,
  iconPlaceholder,
  iconFilterSearch,
  refreshButton,
  versionElement,
  filterInput,
  clearFilterInputButton,
  selectFolderButton,
  totalDownloads,
  openLastVideoButton,
  queueStartButton,
  queuePauseButton,
  queueToggleButton,
  queueClearButton,
  queueRetryTransientButton,
  queueClearFailedButton,
  queueClearDoneButton,
  queueRetryFailedButton,
  openHistoryButton,
  progressBarContainer,
  progressBar,
  toastContainer,
  shortcutsButton,
  shortcutsModal,
  confirmationModal,
  closeSpan,
  sortButton,
  historySortKey,
  historySortMode,
  toggleAllDetailsButton,
  historyDensityCompact,
  historyDensityComfort,
  contextMenu,
  versionContainer,
  whatsNewModal,
  whatsNewContent,
  closeWhatsNewBtn,
  settingsAutoLaunchToggle,
  settingsMinimizeOnLaunchToggle,
  settingsCloseNotificationToggle,
  settingsOpenOnDownloadCompleteToggle,
  settingsOpenOnCopyUrlToggle,
  settingsCloseToTrayRadio,
  settingsCloseAppRadio,
  settingsDisableGlobalShortcutsToggle,
  settingsLowEffectsToggle,
  settingsButton,
  githubButton,
  settingsModal,
  closeSettingsButton,
  settingsDisableCompleteModalToggle,
} = elements;
