import { applyI18n, t } from "./i18n.js";
import { registerDismissibleOverlay } from "./overlayManager.js";

function createUpdateFlyoverView({
  onStart,
  onRestart,
  onRetry,
  onReadyBadgeClick,
} = {}) {
  let element = null;
  let readyBadge = null;
  let unregisterOverlay = null;

  function close() {
    if (!element) return;
    element.classList.remove("is-visible");
    element.style.display = "none";
  }

  function isOpen() {
    return !!element && element.style.display !== "none";
  }

  function getPrimaryAction(stateName) {
    if (!element) return null;
    if (stateName === "available") return element.querySelector("#upd-start");
    if (stateName === "done") return element.querySelector("#upd-restart");
    if (stateName === "error") {
      const retryButton = element.querySelector("#upd-retry");
      if (retryButton && retryButton.style.display !== "none") {
        return retryButton;
      }
      return element.querySelector("#upd-dismiss");
    }
    return null;
  }

  function focusPrimaryAction(stateName) {
    const button = getPrimaryAction(stateName);
    if (!button || typeof button.focus !== "function") return;
    requestAnimationFrame(() => button.focus());
  }

  function switchState(name) {
    if (!element) return;
    element.dataset.state = name;
    element
      .querySelectorAll(".state")
      .forEach((stateEl) => (stateEl.style.display = "none"));
    const active = element.querySelector(`.state-${name}`);
    if (active) active.style.display = "block";
    if (["available", "done"].includes(name)) {
      focusPrimaryAction(name);
    }
  }

  function ensureReadyBadge() {
    if (readyBadge) return readyBadge;
    const badge = document.createElement("button");
    badge.type = "button";
    badge.className = "upd-ready-badge";
    badge.dataset.ui = "update-ready-badge";
    badge.style.display = "none";
    badge.innerHTML = `
      <span class="upd-ready-badge__dot" aria-hidden="true"></span>
      <span
        class="upd-ready-badge__label"
        data-i18n="update.readyBadge.label"
      >${t("update.readyBadge.label")}</span>
    `;
    badge.setAttribute("data-i18n-aria", "update.readyBadge.aria");
    badge.setAttribute("aria-label", t("update.readyBadge.aria"));
    badge.addEventListener("click", () => {
      if (typeof onReadyBadgeClick === "function") onReadyBadgeClick();
    });
    getVersionBadgeHost()?.appendChild(badge);
    readyBadge = badge;
    applyI18n(readyBadge);

    window.addEventListener("i18n:changed", () => {
      if (readyBadge) applyI18n(readyBadge);
    });

    return readyBadge;
  }

  function getVersionBadgeHost() {
    return (
      document.querySelector(".version-container") ||
      document.getElementById("app-version-label")
    );
  }

  function ensure() {
    if (element) return element;

    element = document.createElement("div");
    element.className = "upd-flyover";
    element.dataset.ui = "update-flyover";
    element.style.display = "none";
    element.innerHTML = `
      <button id="upd-close" class="upd-close" data-ui="update-close" aria-label="${t("modal.close")}" data-i18n-aria="modal.close">&times;</button>
      <div class="state state-checking" data-ui="update-state-checking" role="status" aria-live="polite" style="display:none">
        <h3 class="hdr" data-i18n="update.flyover.checking.title">${t("update.flyover.checking.title")}</h3>
        <div class="muted" data-i18n="update.flyover.checking.body">${t("update.flyover.checking.body")}</div>
        <div class="upd-pulse" aria-hidden="true"></div>
      </div>
      <div class="state state-up-to-date" data-ui="update-state-up-to-date" role="status" aria-live="polite" style="display:none">
        <h3 class="hdr" data-i18n="update.flyover.upToDate.title">${t("update.flyover.upToDate.title")}</h3>
        <div class="muted" data-i18n="update.flyover.upToDate.body">${t("update.flyover.upToDate.body")}</div>
      </div>
      <div class="state state-available" data-ui="update-state-available">
        <h3 class="hdr" data-i18n="update.flyover.available.title">${t("update.flyover.available.title")}</h3>
        <div class="ver">
          <span data-i18n="update.flyover.available.current">${t("update.flyover.available.current")}</span>
          <span class="cur" id="upd-cur">—</span>
          <span class="dot"> · </span>
          <span data-i18n="update.flyover.available.next">${t("update.flyover.available.next")}</span>
          <span class="next" id="upd-next">—</span>
        </div>
        <div class="row">
          <button id="upd-start" class="btn btn-sm btn-primary" data-ui="update-start" data-i18n="update.flyover.available.action">${t("update.flyover.available.action")}</button>
        </div>
      </div>
      <div class="state state-progress" data-ui="update-state-progress" style="display:none">
        <h3 class="hdr" data-i18n="update.flyover.progress.title">${t("update.flyover.progress.title")}</h3>
        <div class="ver muted">
          <span data-i18n="update.flyover.progress.version">${t("update.flyover.progress.version")}</span>
          <span id="upd-next-p">—</span>
        </div>
        <progress id="upd-bar" value="0" max="100"></progress>
        <div class="muted" id="upd-label" aria-live="polite">0%</div>
      </div>
      <div class="state state-done" data-ui="update-state-done" role="status" aria-live="polite" style="display:none">
        <h3 class="hdr" data-i18n="update.flyover.done.title">${t("update.flyover.done.title")}</h3>
        <div class="muted" data-i18n="update.flyover.done.body">${t("update.flyover.done.body")}</div>
        <div class="row" style="margin-top:8px">
          <button id="upd-restart" class="btn btn-sm btn-primary" data-ui="update-restart" data-i18n="update.flyover.done.action">${t("update.flyover.done.action")}</button>
        </div>
      </div>
      <div class="state state-error" data-ui="update-state-error" role="alert" aria-live="assertive" style="display:none">
        <h3 class="hdr" id="upd-error-title">${t("update.flyover.error.title")}</h3>
        <div class="muted" id="upd-err">${t("update.flyover.error.body")}</div>
        <div class="row upd-actions" style="margin-top:8px">
          <button id="upd-retry" class="btn btn-sm btn-primary" data-ui="update-retry" data-i18n="update.flyover.error.retry">${t("update.flyover.error.retry")}</button>
          <button id="upd-dismiss" class="btn btn-sm btn-ghost" data-ui="update-dismiss" data-i18n="update.flyover.error.dismiss">${t("update.flyover.error.dismiss")}</button>
        </div>
      </div>`;

    document.body.appendChild(element);
    applyI18n(element);

    element.querySelector("#upd-close")?.addEventListener("click", close);
    element.querySelector("#upd-dismiss")?.addEventListener("click", close);
    element.querySelector("#upd-start")?.addEventListener("click", () => {
      if (typeof onStart === "function") onStart();
    });
    element.querySelector("#upd-restart")?.addEventListener("click", () => {
      if (typeof onRestart === "function") onRestart();
    });
    element.querySelector("#upd-retry")?.addEventListener("click", () => {
      if (typeof onRetry === "function") onRetry();
    });

    window.addEventListener("i18n:changed", () => {
      if (element) applyI18n(element);
    });

    unregisterOverlay = registerDismissibleOverlay({
      id: "update-flyover",
      panel: element,
      isOpen,
      close,
      closeOnOutside: false,
      closeOnEscape: true,
    });

    return element;
  }

  function open() {
    const node = ensure();
    node.style.display = "block";
    requestAnimationFrame(() => node.classList.add("is-visible"));
    return node;
  }

  function setVersions({ current, next } = {}) {
    ensure();
    const currentEl = element.querySelector("#upd-cur");
    const nextEl = element.querySelector("#upd-next");
    const nextProgressEl = element.querySelector("#upd-next-p");
    if (currentEl && current) currentEl.textContent = current;
    if (nextEl && next) nextEl.textContent = next;
    if (nextProgressEl && next) nextProgressEl.textContent = next;
  }

  function setProgressValue(value) {
    ensure();
    const bar = element.querySelector("#upd-bar");
    if (bar) bar.value = value;
  }

  function setProgressLabel(text) {
    ensure();
    const label = element.querySelector("#upd-label");
    if (label) label.textContent = text;
  }

  function setError({ title, message, canRetry }) {
    ensure();
    const titleEl = element.querySelector("#upd-error-title");
    const errorEl = element.querySelector("#upd-err");
    const retryButton = element.querySelector("#upd-retry");
    if (titleEl) titleEl.textContent = title || t("update.flyover.error.title");
    if (errorEl)
      errorEl.textContent = message || t("update.flyover.error.body");
    if (retryButton) retryButton.style.display = canRetry ? "" : "none";
    focusPrimaryAction("error");
  }

  function setReadyBadgeVisible(visible) {
    const badge = ensureReadyBadge();
    badge.style.display = visible ? "inline-flex" : "none";
  }

  return {
    ensure,
    open,
    close,
    isOpen,
    switchState,
    setVersions,
    setProgressValue,
    setProgressLabel,
    setError,
    setReadyBadgeVisible,
    focusPrimaryAction,
    getElement() {
      return element;
    },
    getReadyBadge() {
      return readyBadge;
    },
    destroy() {
      unregisterOverlay?.();
      unregisterOverlay = null;
      readyBadge?.remove();
      readyBadge = null;
      element?.remove();
      element = null;
    },
  };
}

export { createUpdateFlyoverView };
