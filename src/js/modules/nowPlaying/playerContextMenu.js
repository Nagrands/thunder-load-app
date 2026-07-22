import { t } from "../i18n.js";

const MENU_ITEMS = [
  ["play", "fa-solid fa-play", "nowPlaying.context.play"],
  ["queue", "fa-solid fa-list-ol", "nowPlaying.context.queue"],
  ["playlist", "fa-solid fa-plus", "nowPlaying.playlists.addItem"],
  ["move-up", "fa-solid fa-arrow-up", "nowPlaying.playlists.moveUp"],
  ["move-down", "fa-solid fa-arrow-down", "nowPlaying.playlists.moveDown"],
  ["reveal", "fa-regular fa-folder-open", "nowPlaying.context.reveal"],
  ["open-location", "fa-solid fa-folder-open", "nowPlaying.context.openLocation"],
  ["info", "fa-solid fa-circle-info", "nowPlaying.context.info"],
  ["rename", "fa-solid fa-pen", "nowPlaying.context.rename"],
  ["delete", "fa-solid fa-trash", "nowPlaying.library.deleteItem"],
];

function createMenu() {
  const menu = document.createElement("div");
  menu.className = "player-context-menu";
  menu.dataset.ui = "player-context-menu";
  menu.setAttribute("role", "menu");
  menu.hidden = true;
  MENU_ITEMS.forEach(([action, icon, labelKey]) => {
    const button = document.createElement("button");
    button.type = "button";
    button.dataset.contextAction = action;
    button.dataset.i18n = labelKey;
    button.setAttribute("role", "menuitem");
    button.innerHTML = `<i class="${icon}" aria-hidden="true"></i><span>${t(labelKey)}</span>`;
    menu.appendChild(button);
  });
  return menu;
}

export function createPlayerContextMenu({ root, onAction }) {
  const menu = createMenu();
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
    const local = context?.track?.providerId === "local";
    const available = context?.track?.availability !== "missing";
    const customPlaylist = context?.isSystemPlaylist === false;
    menu.querySelectorAll("[data-context-action]").forEach((item) => {
      const action = item.dataset.contextAction;
      item.hidden =
        (["reveal", "open-location"].includes(action) && !local) ||
        (["move-up", "move-down"].includes(action) && !customPlaylist);
      const disabled =
        !available && ["play", "reveal", "open-location"].includes(action);
      item.disabled = disabled;
      item.setAttribute("aria-disabled", String(disabled));
    });
    menu.hidden = false;
    const bounds = root.getBoundingClientRect();
    const menuBounds = menu.getBoundingClientRect();
    const left = Math.max(
      8,
      Math.min((point.x ?? bounds.left) - bounds.left, bounds.width - menuBounds.width - 8),
    );
    const top = Math.max(
      8,
      Math.min((point.y ?? bounds.top) - bounds.top, bounds.height - menuBounds.height - 8),
    );
    menu.style.left = `${left}px`;
    menu.style.top = `${top}px`;
    menu
      .querySelector('[role="menuitem"]:not([hidden]):not([disabled])')
      ?.focus();
  }

  function onClick(event) {
    const item = event.target.closest("[data-context-action]");
    if (!item || !menu.contains(item)) {
      if (event.target.closest?.('[data-action="open-track-context-menu"]')) {
        return;
      }
      if (!menu.hidden) close();
      return;
    }
    const action = item.dataset.contextAction;
    const actionContext = context;
    close();
    void onAction?.(action, actionContext);
  }

  function onKeydown(event) {
    if (menu.hidden) return;
    if (event.key === "Escape") {
      event.preventDefault();
      close({ restoreFocus: true });
      return;
    }
    if (!["ArrowDown", "ArrowUp", "Home", "End"].includes(event.key)) return;
    event.preventDefault();
    const items = Array.from(
      menu.querySelectorAll(
        '[role="menuitem"]:not([hidden]):not([disabled])',
      ),
    );
    const current = items.indexOf(document.activeElement);
    const index = event.key === "Home"
      ? 0
      : event.key === "End"
        ? items.length - 1
        : (current + (event.key === "ArrowDown" ? 1 : -1) + items.length) % items.length;
    items[index]?.focus();
  }

  document.addEventListener("click", onClick);
  menu.addEventListener("keydown", onKeydown);

  return {
    close,
    open,
    dispose() {
      document.removeEventListener("click", onClick);
      menu.removeEventListener("keydown", onKeydown);
      menu.remove();
    },
  };
}

export default createPlayerContextMenu;
