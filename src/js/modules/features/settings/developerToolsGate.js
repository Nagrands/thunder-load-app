import { onOpenSettings } from "./openSettingsBus.js";
import { t } from "../../i18n.js";

const DEVELOPER_TOOLS_UNLOCK_GLOBAL_KEY = "__thunder_dev_tools_unlocked__";
const DEVELOPER_SECRET_WORD = "thunder-dev";
const BOUND_KEY = "settingsDeveloperGateBound";

function readUnlocked() {
  try {
    return window[DEVELOPER_TOOLS_UNLOCK_GLOBAL_KEY] === true;
  } catch {
    return false;
  }
}

function writeUnlocked(enabled) {
  try {
    window[DEVELOPER_TOOLS_UNLOCK_GLOBAL_KEY] = !!enabled;
  } catch {}

  window.dispatchEvent(
    new CustomEvent("tools:developer-unlock-changed", {
      detail: { enabled: !!enabled },
    }),
  );
}

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
    try {
      localStorage.removeItem("developerToolsUnlocked");
    } catch {}
    applyStatus(status, button, readUnlocked());
    input.value = "";
  };

  const tryUnlock = () => {
    if (readUnlocked()) {
      writeUnlocked(false);
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
      writeUnlocked(true);
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
