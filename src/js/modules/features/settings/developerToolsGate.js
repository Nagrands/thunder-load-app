import { onOpenSettings } from "./openSettingsBus.js";
import { t } from "../../i18n.js";
import {
  readDeveloperModeEnabled,
  setDeveloperModeEnabled,
} from "../../developerMode.js";

const DEVELOPER_SECRET_WORD = "thunder-dev";
const BOUND_KEY = "settingsDeveloperGateBound";

function applyStatus(status, button, enabled) {
  const statusKey = enabled
    ? "settings.developer.status.enabled"
    : "settings.developer.status.disabled";
  const buttonKey = enabled
    ? "settings.developer.deactivate"
    : "settings.developer.activate";

  status.setAttribute("data-i18n", statusKey);
  status.textContent = t(statusKey);
  button.setAttribute("data-i18n", buttonKey);
  button.textContent = t(buttonKey);
  status.classList.toggle("success", !!enabled);
  status.classList.toggle("muted", !enabled);
}

export function initDeveloperToolsGate() {
  const input = document.getElementById("settings-developer-secret-input");
  const button = document.getElementById("settings-developer-activate-button");
  const status = document.getElementById("settings-developer-status");

  if (!input || !button || !status) return;

  const sync = () => {
    const enabled = readDeveloperModeEnabled();
    applyStatus(status, button, enabled);
    input.value = "";
  };

  const tryUnlock = () => {
    if (readDeveloperModeEnabled()) {
      setDeveloperModeEnabled(false);
      applyStatus(status, button, false);
      window.electron
        ?.invoke?.("toast", t("settings.developer.lock.success"), "success")
        .catch(() => {});
      input.value = "";
      return;
    }

    const value = String(input.value || "")
      .trim()
      .toLowerCase();
    if (value === DEVELOPER_SECRET_WORD) {
      setDeveloperModeEnabled(true);
      applyStatus(status, button, true);
      window.electron
        ?.invoke?.("toast", t("settings.developer.unlock.success"), "success")
        .catch(() => {});
    } else {
      window.electron
        ?.invoke?.("toast", t("settings.developer.unlock.error"), "error")
        .catch(() => {});
    }
    input.value = "";
  };

  if (button.dataset[BOUND_KEY] !== "1") {
    button.dataset[BOUND_KEY] = "1";
    button.addEventListener("click", tryUnlock);
    input.addEventListener("keydown", (event) => {
      if (event.key !== "Enter") return;
      event.preventDefault();
      tryUnlock();
    });
  }

  sync();
  onOpenSettings("developer-gate", sync);
}
