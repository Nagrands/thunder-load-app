import { onOpenSettings } from "./openSettingsBus.js";
import { t } from "../../i18n.js";
import {
  readDeveloperDisableDownloaderTab,
  readDeveloperModeEnabled,
  setDeveloperDisableDownloaderTab,
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
  const options = document.getElementById("settings-developer-options");
  const disableDownloaderTabToggle = document.getElementById(
    "settings-developer-disable-downloader-tab",
  );

  if (!input || !button || !status) return;

  const sync = () => {
    const enabled = readDeveloperModeEnabled();
    applyStatus(status, button, enabled);
    if (options) options.hidden = !enabled;
    if (disableDownloaderTabToggle) {
      disableDownloaderTabToggle.checked = readDeveloperDisableDownloaderTab();
    }
    input.value = "";
  };

  const tryUnlock = () => {
    if (readDeveloperModeEnabled()) {
      setDeveloperModeEnabled(false);
      applyStatus(status, button, false);
      if (options) options.hidden = true;
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
      if (options) options.hidden = false;
      if (disableDownloaderTabToggle) {
        disableDownloaderTabToggle.checked =
          readDeveloperDisableDownloaderTab();
      }
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
    disableDownloaderTabToggle?.addEventListener("change", () => {
      const disabled = setDeveloperDisableDownloaderTab(
        disableDownloaderTabToggle.checked,
      );
      window.electron
        ?.invoke?.(
          "toast",
          disabled
            ? t("settings.module.download.disabled")
            : t("settings.module.download.enabled"),
          disabled ? "info" : "success",
          { allowHtml: true },
        )
        .catch(() => {});
    });
  }

  sync();
  onOpenSettings("developer-gate", sync);
}
