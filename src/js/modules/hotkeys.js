// src/js/modules/hotkeys.js

import {
  clearHistoryButton,
  confirmationModal,
  downloadButton,
  openFolderButton,
  openHistoryButton,
  openLastVideoButton,
  settingsModal,
  whatsNewModal,
} from "./domElements.js";
import {
  closeSettings,
  openSettings,
  openSettingsWithTab,
  updateThemeDropdownUI,
} from "./settingsModal.js";
import { setTheme } from "./settingsStore.js";
import { showToast } from "./toast.js";
import { t } from "./i18n.js";
import { requestToolsView } from "./toolsNavigation.js";
import { closeAllModals } from "./modalManager.js";

const THEME_ORDER = ["dark", "midnight", "emerald", "sunset", "violet"];
const MODIFIER_KEYS = new Set([
  "Alt",
  "AltGraph",
  "Control",
  "Meta",
  "Shift",
]);
const modals = [whatsNewModal, confirmationModal, settingsModal];

let assignments = {};
let catalog = [];
let hotkeysEnabled = false;
let tabSystemReference = null;
let shortcutsChangedBound = false;
let isMacPlatform = /Mac|iPhone|iPad/i.test(navigator.platform || "");

const normalizeTheme = (value) =>
  value === "system" || !value || !THEME_ORDER.includes(value) ? "dark" : value;

const getThemeLabel = (theme) => {
  const key = `settings.appearance.theme.${normalizeTheme(theme)}`;
  return t(key);
};

const updateThemeToggleTooltip = (theme) => {
  const button = document.getElementById("theme-toggle");
  if (!button) return;
  const title = `${t("topbar.theme")}: ${getThemeLabel(theme)}`;
  button.setAttribute("title", title);
  button.setAttribute("data-bs-original-title", title);
};

const toggleSettings = () => {
  if (settingsModal?.style.display === "flex") {
    closeSettings();
    return;
  }
  closeAllModals(modals);
  openSettings();
};

const toggleTheme = async () => {
  closeAllModals(modals);
  const currentAttribute =
    document.documentElement.getAttribute("data-theme") ||
    localStorage.getItem("theme");
  const current = normalizeTheme(currentAttribute);
  const index = Math.max(0, THEME_ORDER.indexOf(current));
  const next = THEME_ORDER[(index + 1) % THEME_ORDER.length];
  document.documentElement.classList.add("theme-transition");
  try {
    await setTheme(next);
    updateThemeDropdownUI(next);
    updateThemeToggleTooltip(next);
  } finally {
    window.setTimeout(
      () => document.documentElement.classList.remove("theme-transition"),
      260,
    );
  }
};

const activateDownload = () => tabSystemReference?.activateTab("download");
const activateTools = () => tabSystemReference?.activateTab("wireguard");
const activateBackup = () => {
  requestToolsView("backup");
  tabSystemReference?.activateTab("wireguard");
};

const clickAfterClosingModals = (element) => {
  closeAllModals(modals);
  element?.click();
};

const createLocalAction = (handler, allowRepeat = false) => ({
  handler,
  allowRepeat,
});

const LOCAL_ACTIONS = new Map([
  [
    "settings.shortcuts.open",
    createLocalAction(() => openSettingsWithTab("shortcuts-settings")),
  ],
  ["settings.open", createLocalAction(toggleSettings)],
  ["theme.toggle", createLocalAction(toggleTheme)],
  ["navigation.downloader", createLocalAction(activateDownload)],
  ["navigation.tools", createLocalAction(activateTools)],
  ["navigation.backup", createLocalAction(activateBackup)],
  [
    "downloads.start",
    createLocalAction(() => clickAfterClosingModals(downloadButton)),
  ],
  [
    "downloads.folder.open",
    createLocalAction(() => {
      clickAfterClosingModals(openFolderButton);
      showToast(t("hotkeys.openLastFolder"), "info");
    }),
  ],
  [
    "history.open",
    createLocalAction(() => clickAfterClosingModals(openHistoryButton)),
  ],
  [
    "downloads.last.open",
    createLocalAction(() => {
      clickAfterClosingModals(openLastVideoButton);
      showToast(t("hotkeys.openLastVideo"), "info");
    }),
  ],
  [
    "history.clear",
    createLocalAction(() => clickAfterClosingModals(clearHistoryButton)),
  ],
]);

function normalizeKeyName(key) {
  const aliases = {
    " ": "Space",
    ArrowDown: "Down",
    ArrowLeft: "Left",
    ArrowRight: "Right",
    ArrowUp: "Up",
    ",": ",",
    ".": ".",
  };
  if (aliases[key]) return aliases[key];
  if (/^F([1-9]|1[0-2])$/i.test(key)) return key.toUpperCase();
  return key.length === 1 ? key.toUpperCase() : key;
}

export function acceleratorFromKeyboardEvent(
  event,
  { isMac = isMacPlatform } = {},
) {
  if (!event?.key || MODIFIER_KEYS.has(event.key)) return "";
  const parts = [];
  if ((isMac && event.metaKey) || (!isMac && event.ctrlKey)) {
    parts.push("CommandOrControl");
  }
  if (isMac && event.ctrlKey) parts.push("Control");
  if (!isMac && event.metaKey) parts.push("Command");
  if (event.altKey) parts.push("Alt");
  if (event.shiftKey) parts.push("Shift");
  parts.push(normalizeKeyName(event.key));
  return parts.join("+");
}

function normalizeAccelerator(accelerator) {
  let value = String(accelerator || "");
  value = isMacPlatform
    ? value
        .replace(/\b(Cmd|Command|Meta)\b/gi, "CommandOrControl")
        .replace(/\bCtrl\b/gi, "Control")
    : value
        .replace(/\b(Ctrl|Control)\b/gi, "CommandOrControl")
        .replace(/\b(Cmd|Meta)\b/gi, "Command");
  return value
    .replace(/\s*\+\s*/g, "+")
    .toLowerCase();
}

function resolveGetPayload(payload) {
  const value = payload?.data || payload || {};
  return {
    assignments: value.assignments || value.shortcutAssignments || {},
    catalog: value.catalog || value.actions || [],
  };
}

export function refreshShortcutLabels(root = document) {
  const context =
    root && typeof root.querySelectorAll === "function" ? root : document;
  context
    .querySelectorAll("[data-shortcut-action], [data-shortcut-actions]")
    .forEach((element) => {
      const actionIds = element.dataset.shortcutActions
        ? element.dataset.shortcutActions.split(",")
        : [element.dataset.shortcutAction];
      const accelerators = actionIds
        .map((actionId) => assignments[actionId])
        .filter(Boolean);
      if (accelerators.length) {
        element.dataset.hotkey = accelerators.join(" / ");
      } else {
        delete element.dataset.hotkey;
      }
      element.dispatchEvent(
        new CustomEvent("hotkey:changed", {
          detail: { accelerators },
          bubbles: true,
        }),
      );
    });
}

function applyShortcutsState(payload) {
  const next = resolveGetPayload(payload);
  if (Object.keys(next.assignments).length) assignments = next.assignments;
  if (next.catalog.length) catalog = next.catalog;
  refreshShortcutLabels();
  window.dispatchEvent(
    new CustomEvent("shortcuts:updated", {
      detail: { assignments: { ...assignments }, catalog: [...catalog] },
    }),
  );
}

async function loadShortcuts() {
  try {
    const result = await window.electron?.invoke?.("shortcuts:get");
    if (result?.success === false) {
      throw new Error(result.error || "Failed to load shortcuts");
    }
    applyShortcutsState(result);
  } catch (error) {
    console.error("[Hotkeys] Failed to load shortcuts:", error);
  }
}

function bindShortcutsChanged() {
  if (shortcutsChangedBound || !window.electron?.on) return;
  window.electron.on("shortcuts:changed", (payload) => {
    applyShortcutsState(payload);
  });
  shortcutsChangedBound = true;
}

function findActionId(accelerator) {
  const normalized = normalizeAccelerator(accelerator);
  return Object.entries(assignments).find(
    ([, value]) => normalizeAccelerator(value) === normalized,
  )?.[0];
}

function isEditableTarget(target) {
  return (
    target instanceof HTMLElement &&
    (["INPUT", "TEXTAREA", "SELECT"].includes(target.tagName) ||
      target.isContentEditable ||
      Boolean(target.closest(".settings-shortcuts")))
  );
}

async function handleKeyDown(event) {
  try {
    if (event.defaultPrevented || isEditableTarget(event.target)) {
      return;
    }
    const accelerator = acceleratorFromKeyboardEvent(event);
    const actionId = findActionId(accelerator);
    const action = LOCAL_ACTIONS.get(actionId);
    if (!action) return;
    if (event.repeat && !action.allowRepeat) return;

    event.preventDefault();
    await action.handler();
  } catch (error) {
    console.error("[Hotkeys] Failed to execute shortcut:", error);
  }
}

export function registerLocalShortcutAction(
  actionId,
  handler,
  { allowRepeat = false } = {},
) {
  if (!actionId || typeof handler !== "function") return false;
  const action = createLocalAction(handler, allowRepeat === true);
  LOCAL_ACTIONS.set(actionId, action);
  return () => {
    if (LOCAL_ACTIONS.get(actionId) === action) {
      LOCAL_ACTIONS.delete(actionId);
    }
  };
}

export async function initHotkeys(tabsInstance) {
  tabSystemReference = tabsInstance;
  bindShortcutsChanged();
  enableHotkeys();
  void loadShortcuts();
  try {
    const info = await window.electron?.getPlatformInfo?.();
    isMacPlatform = Boolean(info?.isMac || info?.platform === "darwin");
  } catch {}
}

export function enableHotkeys() {
  if (hotkeysEnabled) return;
  document.addEventListener("keydown", handleKeyDown);
  hotkeysEnabled = true;
}

export function disableHotkeys() {
  if (!hotkeysEnabled) return;
  document.removeEventListener("keydown", handleKeyDown);
  hotkeysEnabled = false;
}
