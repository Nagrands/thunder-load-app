import { t } from "./i18n.js";

function getFocusableItems(menu) {
  return Array.from(
    menu.querySelectorAll('[role="menuitem"]:not([hidden]):not([disabled])'),
  );
}

function positionMenu(menu, root, point = {}) {
  const bounds = root.getBoundingClientRect();
  const menuBounds = menu.getBoundingClientRect();
  const left = Math.max(
    8,
    Math.min(
      (point.x ?? bounds.left) - bounds.left,
      bounds.width - menuBounds.width - 8,
    ),
  );
  const top = Math.max(
    8,
    Math.min(
      (point.y ?? bounds.top) - bounds.top,
      bounds.height - menuBounds.height - 8,
    ),
  );
  menu.style.left = `${left}px`;
  menu.style.top = `${top}px`;
}

function createActionMenu({
  root,
  items = [],
  className = "action-menu",
  dataUi = "action-menu",
  onAction,
  resolveItemState,
  renderIcon,
} = {}) {
  if (!(root instanceof HTMLElement)) {
    throw new TypeError("createActionMenu requires an HTMLElement root");
  }
  const menu = document.createElement("div");
  menu.className = className;
  menu.dataset.ui = dataUi;
  menu.setAttribute("role", "menu");
  menu.hidden = true;
  items.forEach((item) => {
    const button = document.createElement("button");
    button.type = "button";
    button.dataset.action = item.id;
    if (item.dataAttribute) button.setAttribute(item.dataAttribute, item.id);
    button.setAttribute("role", "menuitem");
    if (item.danger) button.classList.add("is-danger");
    const iconMarkup = renderIcon?.(item) || "";
    button.innerHTML = `${iconMarkup}<span data-i18n="${item.labelKey || ""}">${
      item.labelKey ? t(item.labelKey) : item.label || item.id
    }</span>`;
    menu.appendChild(button);
  });
  root.appendChild(menu);

  let context = null;
  let trigger = null;

  function close({ restoreFocus = false } = {}) {
    if (menu.hidden) return;
    menu.hidden = true;
    menu.removeAttribute("style");
    if (restoreFocus) trigger?.focus?.();
    trigger = null;
    context = null;
  }

  function open(nextContext, nextTrigger, point = {}) {
    close();
    context = nextContext;
    trigger = nextTrigger;
    items.forEach((item) => {
      const button = menu.querySelector(`[data-action="${item.id}"]`);
      const state = resolveItemState?.(item, context) || {};
      button.hidden = Boolean(state.hidden);
      button.disabled = Boolean(state.disabled);
      button.setAttribute("aria-disabled", String(Boolean(state.disabled)));
      const labelKey = state.labelKey || item.labelKey;
      const label = labelKey ? t(labelKey) : state.label || item.label || item.id;
      const labelElement = button.querySelector("span");
      if (labelElement) {
        labelElement.textContent = label;
        if (labelKey) labelElement.dataset.i18n = labelKey;
      }
      button.setAttribute("aria-label", label);
    });
    menu.hidden = false;
    positionMenu(menu, root, point);
    getFocusableItems(menu)[0]?.focus();
  }

  function handleDocumentClick(event) {
    const item = event.target.closest?.("[data-action]");
    if (item && menu.contains(item)) {
      const action = item.dataset.action;
      const actionContext = context;
      close();
      void onAction?.(action, actionContext);
      return;
    }
    if (!menu.hidden && !menu.contains(event.target) && event.target !== trigger) {
      close();
    }
  }

  function handleKeydown(event) {
    if (menu.hidden) return;
    if (event.key === "Escape") {
      event.preventDefault();
      close({ restoreFocus: true });
      return;
    }
    if (!["ArrowDown", "ArrowUp", "Home", "End"].includes(event.key)) return;
    event.preventDefault();
    const available = getFocusableItems(menu);
    if (!available.length) return;
    const current = available.indexOf(document.activeElement);
    const index =
      event.key === "Home"
        ? 0
        : event.key === "End"
          ? available.length - 1
          : (current + (event.key === "ArrowDown" ? 1 : -1) + available.length) %
            available.length;
    available[index]?.focus();
  }

  document.addEventListener("click", handleDocumentClick);
  menu.addEventListener("keydown", handleKeydown);

  return {
    element: menu,
    open,
    close,
    dispose() {
      document.removeEventListener("click", handleDocumentClick);
      menu.removeEventListener("keydown", handleKeydown);
      menu.remove();
    },
  };
}

export { createActionMenu, getFocusableItems, positionMenu };
