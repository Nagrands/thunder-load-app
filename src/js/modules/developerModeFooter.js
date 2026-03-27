import { readDeveloperModeEnabled } from "./developerMode.js";

const APP_FOOTER_ID = "app-footer";

function applyDeveloperModeFooterVisibility() {
  const footer = document.getElementById(APP_FOOTER_ID);
  if (!footer) return;

  const hidden = readDeveloperModeEnabled();
  footer.hidden = hidden;
  footer.style.display = hidden ? "none" : "";
  footer.dataset.developerModeHidden = hidden ? "1" : "0";
}

function initDeveloperModeFooterVisibility() {
  applyDeveloperModeFooterVisibility();
  window.addEventListener(
    "tools:developer-unlock-changed",
    applyDeveloperModeFooterVisibility,
  );
  window.addEventListener("tabs:activated", applyDeveloperModeFooterVisibility);
  window.addEventListener("i18n:changed", applyDeveloperModeFooterVisibility);
}

export {
  APP_FOOTER_ID,
  applyDeveloperModeFooterVisibility,
  initDeveloperModeFooterVisibility,
};
