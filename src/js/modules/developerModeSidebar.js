import { readDeveloperModeEnabled } from "./developerMode.js";

const APP_SIDEBAR_ID = "app-sidebar";

function applyDeveloperModeSidebarVisibility() {
  const sidebar = document.getElementById(APP_SIDEBAR_ID);
  if (!sidebar) return;

  readDeveloperModeEnabled();
  sidebar.hidden = false;
  sidebar.style.display = "";
  sidebar.dataset.developerModeHidden = "0";
}

function initDeveloperModeSidebarVisibility() {
  applyDeveloperModeSidebarVisibility();
  window.addEventListener(
    "tools:developer-unlock-changed",
    applyDeveloperModeSidebarVisibility,
  );
  window.addEventListener("tabs:activated", applyDeveloperModeSidebarVisibility);
  window.addEventListener("i18n:changed", applyDeveloperModeSidebarVisibility);
}

export {
  APP_SIDEBAR_ID,
  applyDeveloperModeSidebarVisibility,
  initDeveloperModeSidebarVisibility,
};
