import { state } from "./state.js";
import { t } from "./i18n.js";

const RELOAD_BLOCKED_ATTR = "data-reload-blocked";

function isDownloadActive(detail = {}) {
  const activeCount = Number(detail?.activeCount || 0);
  return Boolean(
    detail?.isDownloading ||
      activeCount > 0 ||
      state.isDownloading ||
      (Array.isArray(state.activeDownloads) && state.activeDownloads.length > 0),
  );
}

function setReloadButtonState(button, blocked) {
  if (!button) return;
  button.disabled = blocked;
  button.setAttribute("aria-disabled", blocked ? "true" : "false");
  if (blocked) {
    button.setAttribute(RELOAD_BLOCKED_ATTR, "1");
    button.setAttribute("title", t("topbar.reload.disabled"));
    button.setAttribute("data-bs-original-title", t("topbar.reload.disabled"));
    return;
  }
  button.removeAttribute(RELOAD_BLOCKED_ATTR);
  button.setAttribute("title", t("topbar.reload"));
  button.setAttribute("data-bs-original-title", t("topbar.reload"));
}

function reloadWindow() {
  if (typeof window.__thunderReload === "function") {
    window.__thunderReload();
    return;
  }
  window.location.reload();
}

function initTopBarReloadGuard() {
  const reloadButton = document.getElementById("reload-app");
  if (!reloadButton) return;

  const sync = (detail = {}) => {
    setReloadButtonState(reloadButton, isDownloadActive(detail));
  };

  reloadButton.addEventListener(
    "click",
    (event) => {
      if (
        reloadButton.disabled ||
        reloadButton.getAttribute(RELOAD_BLOCKED_ATTR) === "1"
      ) {
        event.preventDefault();
        event.stopImmediatePropagation();
        return;
      }
      reloadWindow();
    },
    true,
  );

  window.addEventListener("download:state", (event) => {
    sync(event.detail || {});
    window.dispatchEvent(new Event("topbar:actions-visibility-changed"));
  });
  window.addEventListener("i18n:changed", () => {
    sync();
  });

  sync();
}

export { initTopBarReloadGuard };
