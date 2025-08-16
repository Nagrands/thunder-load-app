// src/js/modules/domElements.js

/**
 * Объект для хранения всех необходимых элементов DOM.
 */
const elements = {
  urlInput: document.getElementById("url"),
  downloadButton: document.getElementById("download-button"),
  qualityContainer: document.querySelector(".quality-container"),
  qualityButton: document.getElementById("quality-button"),
  qualityDropdown: document.getElementById("quality-dropdown"),
  downloadCancelButton: document.getElementById("download-cancel"),
  buttonText: document
    .getElementById("download-button")
    ?.querySelector(".button-text"),
  history: document.getElementById("history"),
  historyContainer: document.getElementById("history-container"),
  clearHistoryButton: document.getElementById("clear-history"),
  openFolderButton: document.getElementById("open-folder"),
  iconPlaceholder: document.getElementById("icon-placeholder"),
  iconFilterSearch: document.getElementById("icon-filter-search"),
  refreshButton: document.getElementById("refresh-button"),
  versionElement: document.querySelector(".version"),
  filterInput: document.getElementById("filter-input"),
  clearFilterInputButton: document.getElementById("clear-filter-input"),
  selectFolderButton: document.getElementById("select-folder"),
  totalDownloads: document.getElementById("total-downloads"),
  openLastVideoButton: document.getElementById("open-last-video"),
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
  settingsCloseToTrayRadio: document.getElementById("settings-close-to-tray"),
  settingsCloseAppRadio: document.getElementById("settings-close-app-radio"),
  sidebar: document.getElementById("sidebar"),
  overlay: document.getElementById("overlay"),
  toggleBtn: document.getElementById("toggle-btn"),
  closeBtn: document.getElementById("close-btn"),
  settingsButton: document.getElementById("settings-button"),
  settingsModal: document.getElementById("settings-modal"),
  closeSettingsButton: document.querySelector(".close-settings"),
  settingsDisableCompleteModalToggle: document.getElementById(
    "settings-disable-complete-modal-toggle",
  ),
};

// Проверка наличия всех элементов и вывод ошибок
for (const [key, element] of Object.entries(elements)) {
  if (!element) {
    console.error(`Element with key '${key}' is missing in the DOM.`);
  }
}

if (Object.values(elements).some((el) => !el)) {
  console.error("One or more elements are missing in the DOM.");
}

// Экспорт объекта elements по умолчанию
export default elements;

// Также экспорт отдельных элементов, если это необходимо
export const {
  urlInput,
  downloadButton,
  qualityContainer,
  qualityButton,
  qualityDropdown,
  downloadCancelButton,
  buttonText,
  history,
  historyContainer,
  clearHistoryButton,
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
  openHistoryButton,
  progressBarContainer,
  progressBar,
  toastContainer,
  shortcutsButton,
  shortcutsModal,
  confirmationModal,
  closeSpan,
  sortButton,
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
  sidebar,
  overlay,
  toggleBtn,
  closeBtn,
  settingsButton,
  settingsModal,
  closeSettingsButton,
  settingsDisableCompleteModalToggle,
} = elements;
