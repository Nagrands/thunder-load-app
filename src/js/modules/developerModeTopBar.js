import { readDeveloperModeEnabled } from "./developerMode.js";

const HIDDEN_TOPBAR_ACTION_IDS = Object.freeze([
  "open-history",
  "shortcuts-button",
  "settings-button",
  "theme-toggle",
  "open-github",
]);

function applyDeveloperModeTopBarVisibility() {
  const hidden = readDeveloperModeEnabled();
  HIDDEN_TOPBAR_ACTION_IDS.forEach((id) => {
    const button = document.getElementById(id);
    if (button) {
      button.hidden = hidden;
      button.style.display = hidden ? "none" : "";
      button.dataset.topbarSuppressed = hidden ? "1" : "0";
    }
    const proxy = document.querySelector(`[data-proxy-target="#${id}"]`);
    if (proxy) {
      proxy.hidden = hidden;
      proxy.disabled = hidden;
      proxy.style.display = hidden ? "none" : "";
    }
  });
  window.dispatchEvent(new Event("topbar:actions-visibility-changed"));
}

function initDeveloperModeTopBarVisibility() {
  applyDeveloperModeTopBarVisibility();
  window.addEventListener(
    "tools:developer-unlock-changed",
    applyDeveloperModeTopBarVisibility,
  );
  window.addEventListener("tabs:activated", applyDeveloperModeTopBarVisibility);
  window.addEventListener(
    "i18n:changed",
    applyDeveloperModeTopBarVisibility,
  );
}

export {
  HIDDEN_TOPBAR_ACTION_IDS,
  applyDeveloperModeTopBarVisibility,
  initDeveloperModeTopBarVisibility,
};
