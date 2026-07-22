import { applyI18n, t } from "./i18n.js";

const ACTION_SELECTOR = ".windows-tray-menu__item:not(:disabled)";

function getEnabledItems(root) {
  return Array.from(root.querySelectorAll(ACTION_SELECTOR));
}

function moveFocus(root, direction) {
  const items = getEnabledItems(root);
  if (!items.length) return;
  const currentIndex = items.indexOf(document.activeElement);
  const nextIndex =
    currentIndex < 0
      ? 0
      : (currentIndex + direction + items.length) % items.length;
  items[nextIndex].focus();
}

function applyState(root, state = {}) {
  const lastVideo = root.querySelector('[data-action="last-video"]');
  const downloads = root.querySelector('[data-action="downloads"]');
  const fileName = root.querySelector("[data-last-video-name]");
  const lastVideoEnabled = state.lastVideo?.enabled === true;
  const downloadsEnabled = state.downloads?.enabled === true;

  if (lastVideo) lastVideo.disabled = !lastVideoEnabled;
  if (downloads) downloads.disabled = !downloadsEnabled;
  if (fileName) {
    fileName.textContent = lastVideoEnabled
      ? state.lastVideo.fileName
      : t("trayMenu.noLastVideo");
    fileName.title = lastVideoEnabled ? state.lastVideo.fileName : "";
  }
}

async function refreshState(root, api) {
  try {
    const result = await api.getState();
    if (result?.success) applyState(root, result.data);
  } catch {
    applyState(root, {});
  }
}

function initWindowsTrayMenu({
  root = document.querySelector("[data-ui='windows-tray-menu']"),
  api = window.windowsTrayMenu,
} = {}) {
  if (!root || !api) return null;
  applyI18n(root);

  root.addEventListener("click", async (event) => {
    const item = event.target.closest("[data-action]");
    if (!item || item.disabled) return;
    await api.performAction(item.dataset.action);
  });

  root.addEventListener("keydown", (event) => {
    if (["ArrowDown", "ArrowUp", "Home", "End", "Escape"].includes(event.key)) {
      event.preventDefault();
    }
    if (event.key === "ArrowDown") moveFocus(root, 1);
    if (event.key === "ArrowUp") moveFocus(root, -1);
    if (event.key === "Home") getEnabledItems(root)[0]?.focus();
    if (event.key === "End") getEnabledItems(root).at(-1)?.focus();
    if (event.key === "Escape") api.close();
  });

  window.addEventListener("focus", () => {
    refreshState(root, api);
    requestAnimationFrame(() => getEnabledItems(root)[0]?.focus());
  });
  refreshState(root, api);
  requestAnimationFrame(() => getEnabledItems(root)[0]?.focus());
  return { applyState: (state) => applyState(root, state) };
}

if (typeof document !== "undefined") initWindowsTrayMenu();

export { applyState, getEnabledItems, initWindowsTrayMenu, moveFocus };
