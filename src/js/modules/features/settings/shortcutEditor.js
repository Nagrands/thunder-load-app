import { acceleratorFromKeyboardEvent } from "../../hotkeys.js";
import { t } from "../../i18n.js";
import { showToast } from "../../toast.js";

const SELECTORS = {
  search: "#shortcuts-search, #settings-shortcuts-search",
  list: "#shortcuts-list, #settings-shortcuts-list",
  empty: "#shortcuts-empty, #settings-shortcuts-empty",
  live: "#shortcuts-live, #settings-shortcuts-live",
  reset: "#shortcuts-reset, #settings-shortcuts-reset",
  resetConfirm: "#shortcuts-reset-confirm, #settings-shortcuts-reset-confirm",
};
const MODIFIER_KEYS = new Set([
  "Alt",
  "AltGraph",
  "Control",
  "Meta",
  "Shift",
]);
const CATEGORY_ICONS = Object.freeze({
  settings: "fa-sliders",
  navigation: "fa-compass",
  downloads: "fa-download",
  system: "fa-display",
  sites: "fa-globe",
  player: "fa-circle-play",
});

let catalog = [];
let assignments = {};
let isMac = false;
let recordingActionId = "";
let pendingConflict = null;
let initialized = false;

const getElement = (selector) => document.querySelector(selector);
const getRow = (actionId) =>
  Array.from(
    getElement(SELECTORS.list)?.querySelectorAll("[data-action-id]") || [],
  ).find((row) => row.dataset.actionId === actionId);

function getActionId(action) {
  return action?.id || action?.actionId || "";
}

function getActionText(action, kind) {
  const metadataKey = kind === "name" ? "titleKey" : `${kind}Key`;
  const key =
    action?.[metadataKey] ||
    action?.i18n?.[kind] ||
    action?.[kind] ||
    `settings.shortcuts.actions.${getActionId(action)}.${kind}`;
  return t(key);
}

function formatAccelerator(accelerator) {
  const parts = String(accelerator || "").split("+").filter(Boolean);
  const labels = parts.map((part) => {
    if (part === "CommandOrControl") return isMac ? "⌘" : "Ctrl";
    if (part === "Command") return isMac ? "⌘" : "Cmd";
    if (part === "Control") return isMac ? "⌃" : "Ctrl";
    if (part === "Alt") return isMac ? "⌥" : "Alt";
    if (part === "Shift") return isMac ? "⇧" : "Shift";
    return part;
  });
  return labels.join(isMac ? "" : " + ");
}

function isPlayerAction(action) {
  return action?.categoryKey === "shortcuts.categories.player";
}

function getCategoryKey(action) {
  return action?.categoryKey || "shortcuts.categories.system";
}

function getCategoryId(categoryKey) {
  return String(categoryKey || "other")
    .split(".")
    .at(-1)
    .replace(/[^a-z0-9_-]/gi, "-");
}

function announce(message) {
  const live = getElement(SELECTORS.live);
  if (!live) return;
  live.textContent = "";
  window.setTimeout(() => {
    live.textContent = message;
  }, 0);
}

function resolvePayload(payload) {
  const value = payload?.data || payload || {};
  return {
    catalog: value.catalog || value.actions || [],
    assignments: value.assignments || value.shortcutAssignments || {},
  };
}

function actionById(actionId) {
  return catalog.find((action) => getActionId(action) === actionId);
}

function createText(tagName, className, value) {
  const element = document.createElement(tagName);
  element.className = className;
  element.textContent = value;
  return element;
}

function createIconButton({
  className,
  icon,
  label,
  dataAttribute,
}) {
  const button = document.createElement("button");
  button.className = className;
  button.type = "button";
  button.title = label;
  button.setAttribute("aria-label", label);
  button.dataset[dataAttribute] = "";
  const iconNode = document.createElement("i");
  iconNode.className = `fa-solid ${icon}`;
  iconNode.setAttribute("aria-hidden", "true");
  const copy = createText("span", "visually-hidden", label);
  button.append(iconNode, copy);
  return button;
}

function createConflictBlock(actionId) {
  const block = document.createElement("div");
  block.className = "shortcut-editor__conflict";
  block.dataset.shortcutConflict = "";
  block.setAttribute("role", "alert");
  const owner = actionById(pendingConflict?.conflictingActionId);
  const ownerName = owner
    ? getActionText(owner, "name")
    : pendingConflict?.conflictingActionId || "";
  const message = createText(
    "span",
    "shortcut-editor__conflict-message",
    t("settings.shortcuts.conflict", { action: ownerName }),
  );
  const swap = createText(
    "button",
    "shortcut-editor__conflict-swap",
    t("settings.shortcuts.swap"),
  );
  swap.type = "button";
  swap.dataset.shortcutSwap = "";
  swap.addEventListener("click", () => void swapConflict(actionId));
  const cancel = createText(
    "button",
    "shortcut-editor__conflict-cancel",
    t("settings.shortcuts.cancel"),
  );
  cancel.type = "button";
  cancel.dataset.shortcutCancel = "";
  cancel.addEventListener("click", cancelConflict);
  block.append(message, swap, cancel);
  return block;
}

function createRow(action) {
  const actionId = getActionId(action);
  const row = document.createElement("div");
  row.className = "shortcut-editor__row";
  row.dataset.actionId = actionId;
  row.classList.toggle("is-recording", recordingActionId === actionId);
  row.classList.toggle(
    "has-conflict",
    pendingConflict?.actionId === actionId,
  );

  const copy = document.createElement("div");
  copy.className = "shortcut-editor__copy";
  const heading = document.createElement("div");
  heading.className = "shortcut-editor__heading";
  heading.append(
    createText(
      "strong",
      "shortcut-editor__name",
      getActionText(action, "name"),
    ),
    createText(
      "span",
      "shortcut-editor__scope",
      t(
        action.scope === "global"
          ? "settings.shortcuts.scopeGlobal"
          : "settings.shortcuts.scopeLocal",
      ),
    ),
  );
  copy.append(heading);
  const description = getActionText(action, "description");
  if (description && !description.endsWith(".description")) {
    copy.append(
      createText("span", "shortcut-editor__description", description),
    );
  }

  const controls = document.createElement("div");
  controls.className = "shortcut-editor__controls";
  const value = createText(
    "kbd",
    "shortcut-editor__value",
    recordingActionId === actionId
      ? t("settings.shortcuts.recording")
      : formatAccelerator(assignments[actionId]) ||
        t("settings.shortcuts.unassigned"),
  );
  value.dataset.shortcutValue = "";
  const editLabel =
    recordingActionId === actionId
      ? t("settings.shortcuts.cancel")
      : t("settings.shortcuts.edit");
  const edit = createIconButton({
    className: "shortcut-editor__edit",
    icon: recordingActionId === actionId ? "fa-xmark" : "fa-pen",
    label: editLabel,
    dataAttribute: "shortcutEdit",
  });
  edit.setAttribute(
    "aria-pressed",
    recordingActionId === actionId ? "true" : "false",
  );
  edit.setAttribute(
    "aria-label",
    `${t("settings.shortcuts.edit")}: ${getActionText(action, "name")}`,
  );
  edit.addEventListener("click", () => {
    if (recordingActionId === actionId) stopRecording({ restoreFocus: true });
    else startRecording(actionId);
  });
  const resetLabel = t("settings.shortcuts.reset.single");
  const reset = createIconButton({
    className: "shortcut-editor__reset",
    icon: "fa-rotate-left",
    label: resetLabel,
    dataAttribute: "shortcutReset",
  });
  reset.disabled = assignments[actionId] === action.defaultAccelerator;
  reset.setAttribute(
    "aria-label",
    `${t("settings.shortcuts.reset.single")}: ${getActionText(action, "name")}`,
  );
  reset.addEventListener("click", () => void resetShortcut(actionId));
  controls.append(value, edit, reset);
  row.append(copy, controls);
  if (pendingConflict?.actionId === actionId) {
    row.append(createConflictBlock(actionId));
  }
  return row;
}

function createGroup(categoryKey, actions) {
  const categoryId = getCategoryId(categoryKey);
  const section = document.createElement("section");
  section.className = `shortcut-editor__group shortcut-editor__group--${categoryId}`;
  section.dataset.shortcutCategory = categoryId;
  const headingId = `shortcut-editor-group-${categoryId}`;
  section.setAttribute("aria-labelledby", headingId);

  const header = document.createElement("header");
  header.className = "shortcut-editor__group-header";
  const identity = document.createElement("div");
  identity.className = "shortcut-editor__group-identity";
  const icon = document.createElement("i");
  icon.className = `fa-solid ${CATEGORY_ICONS[categoryId] || "fa-keyboard"}`;
  icon.setAttribute("aria-hidden", "true");
  const title = createText(
    "h3",
    "shortcut-editor__group-title",
    t(categoryKey),
  );
  title.id = headingId;
  const count = createText(
    "span",
    "shortcut-editor__group-count",
    String(actions.length),
  );
  identity.append(icon, title, count);
  header.append(identity);

  if (categoryId === "player") {
    const reset = createIconButton({
      className: "shortcut-editor__group-reset",
      icon: "fa-rotate-left",
      label: t("settings.shortcuts.reset.player"),
      dataAttribute: "shortcutPlayerReset",
    });
    reset.addEventListener("click", () => void resetPlayerShortcuts());
    header.append(reset);
  }

  const rows = document.createElement("div");
  rows.className = "shortcut-editor__group-rows";
  rows.append(...actions.map(createRow));
  section.append(header, rows);
  return section;
}

function matchesSearch(action, query) {
  if (!query) return true;
  const haystack = [
    getActionText(action, "name"),
    getActionText(action, "description"),
    getActionText(action, "category"),
  ]
    .join(" ")
    .toLocaleLowerCase();
  return haystack.includes(query);
}

function render() {
  const list = getElement(SELECTORS.list);
  if (!list) return;
  const query = String(getElement(SELECTORS.search)?.value || "")
    .trim()
    .toLocaleLowerCase();
  const visibleActions = catalog.filter((action) =>
    matchesSearch(action, query),
  );
  const groupedActions = new Map();
  visibleActions.forEach((action) => {
    const categoryKey = getCategoryKey(action);
    const group = groupedActions.get(categoryKey) || [];
    group.push(action);
    groupedActions.set(categoryKey, group);
  });
  const content = Array.from(groupedActions, ([categoryKey, actions]) =>
    createGroup(categoryKey, actions),
  );
  list.replaceChildren(...content);
  const empty = getElement(SELECTORS.empty);
  if (empty) empty.hidden = visibleActions.length > 0;
  window.dispatchEvent(new CustomEvent("settings:search-index-invalidated"));
}

function applyConflict(actionId, accelerator, conflictingActionId) {
  recordingActionId = "";
  pendingConflict = { actionId, accelerator, conflictingActionId };
  render();
  getRow(actionId)
    ?.querySelector("[data-shortcut-swap]")
    ?.focus();
  const owner = actionById(conflictingActionId);
  announce(
    t("settings.shortcuts.conflict", {
      action: owner ? getActionText(owner, "name") : conflictingActionId,
    }),
  );
}

function startRecording(actionId) {
  pendingConflict = null;
  recordingActionId = actionId;
  render();
  const row = getRow(actionId);
  row?.querySelector("[data-shortcut-edit]")?.focus();
  announce(t("settings.shortcuts.recording"));
}

function stopRecording({ restoreFocus = false } = {}) {
  const actionId = recordingActionId;
  recordingActionId = "";
  render();
  if (restoreFocus && actionId) {
    getRow(actionId)
      ?.querySelector("[data-shortcut-edit]")
      ?.focus();
  }
}

function isSafeAccelerator(event, accelerator) {
  if (!accelerator || MODIFIER_KEYS.has(event.key)) return false;
  const functionKey = /^F([1-9]|1[0-2])$/.test(event.key.toUpperCase());
  const hasAllowedModifier = event.ctrlKey || event.metaKey || event.altKey;
  if (!functionKey && !hasAllowedModifier) return false;
  if (["Escape", "Tab"].includes(event.key)) return false;
  if (
    (event.ctrlKey || event.metaKey) &&
    ["Q", "W"].includes(event.key.toUpperCase())
  ) {
    return false;
  }
  return !(event.altKey && event.key === "F4");
}

function normalizeSetResult(result) {
  if (result?.success !== false && !result?.conflictingActionId) {
    return { status: "ok", payload: result };
  }
  if (
    result?.conflictingActionId ||
    result?.error === "conflict" ||
    result?.code === "conflict" ||
    result?.status === "conflict"
  ) {
    return {
      status: "conflict",
      conflictingActionId:
        result.conflictingActionId || result.conflict?.actionId,
    };
  }
  return {
    status: [
      "invalidAccelerator",
      "unsafeAccelerator",
      "systemAccelerator",
    ].includes(result?.error)
      ? "invalid"
      : "error",
    error: result?.error,
  };
}

async function setShortcut(actionId, accelerator, swap = false) {
  try {
    return normalizeSetResult(
      await window.electron.invoke("shortcuts:set", {
        actionId,
        accelerator,
        ...(swap ? { strategy: "swap" } : {}),
      }),
    );
  } catch (error) {
    return { status: "error", error };
  }
}

async function captureShortcut(event) {
  if (!recordingActionId) return;
  event.preventDefault();
  event.stopPropagation();
  event.stopImmediatePropagation();
  if (event.key === "Escape") {
    stopRecording({ restoreFocus: true });
    return;
  }
  if (event.repeat || MODIFIER_KEYS.has(event.key)) return;

  const accelerator = acceleratorFromKeyboardEvent(event);
  if (!isSafeAccelerator(event, accelerator)) {
    announce(t("settings.shortcuts.invalid"));
    return;
  }
  const actionId = recordingActionId;
  const result = await setShortcut(actionId, accelerator);
  if (result.status === "conflict") {
    applyConflict(actionId, accelerator, result.conflictingActionId);
    return;
  }
  if (result.status !== "ok") {
    announce(
      t(
        result.status === "invalid"
          ? "settings.shortcuts.invalid"
          : "settings.shortcuts.error",
      ),
    );
    return;
  }
  assignments = {
    ...assignments,
    [actionId]: accelerator,
  };
  recordingActionId = "";
  pendingConflict = null;
  applyPayload(result.payload);
  render();
}

async function resetShortcut(actionId) {
  const action = actionById(actionId);
  if (!action?.defaultAccelerator) return;
  const result = await setShortcut(actionId, action.defaultAccelerator);
  if (result.status === "conflict") {
    applyConflict(
      actionId,
      action.defaultAccelerator,
      result.conflictingActionId,
    );
    return;
  }
  if (result.status !== "ok") {
    announce(t("settings.shortcuts.error"));
    return;
  }
  pendingConflict = null;
  applyPayload(result.payload);
  render();
  announce(t("settings.shortcuts.resetSingleSuccess"));
}

async function resetPlayerShortcuts() {
  const next = { ...assignments };
  catalog.filter(isPlayerAction).forEach((action) => {
    next[getActionId(action)] = action.defaultAccelerator;
  });
  try {
    const result = await window.electron.invoke("shortcuts:replace", {
      assignments: next,
    });
    const normalized = normalizeSetResult(result);
    if (normalized.status === "conflict") {
      const owner = actionById(normalized.conflictingActionId);
      announce(
        t("settings.shortcuts.conflict", {
          action: owner
            ? getActionText(owner, "name")
            : normalized.conflictingActionId,
        }),
      );
      return;
    }
    if (normalized.status !== "ok") throw new Error(normalized.error);
    pendingConflict = null;
    applyPayload(result);
    render();
    announce(t("settings.shortcuts.resetPlayerSuccess"));
    showToast(t("settings.shortcuts.resetPlayerSuccess"), "success");
  } catch (error) {
    console.error("[ShortcutEditor] Failed to reset player shortcuts:", error);
    announce(t("settings.shortcuts.error"));
  }
}

async function swapConflict(actionId) {
  if (!pendingConflict || pendingConflict.actionId !== actionId) return;
  const conflict = pendingConflict;
  const result = await setShortcut(actionId, conflict.accelerator, true);
  if (result.status !== "ok") {
    announce(t("settings.shortcuts.error"));
    return;
  }
  const previous = assignments[actionId];
  assignments = {
    ...assignments,
    [actionId]: conflict.accelerator,
    [conflict.conflictingActionId]: previous,
  };
  pendingConflict = null;
  applyPayload(result.payload);
  render();
  getRow(actionId)
    ?.querySelector("[data-shortcut-edit]")
    ?.focus();
}

function cancelConflict() {
  const actionId = pendingConflict?.actionId;
  pendingConflict = null;
  render();
  if (actionId) {
    getRow(actionId)
      ?.querySelector("[data-shortcut-edit]")
      ?.focus();
  }
}

function applyPayload(payload) {
  const next = resolvePayload(payload);
  if (next.catalog.length) catalog = next.catalog;
  if (Object.keys(next.assignments).length) assignments = next.assignments;
}

async function load() {
  try {
    const result = await window.electron.invoke("shortcuts:get");
    if (result?.success === false) throw new Error(result.error);
    applyPayload(result);
    render();
  } catch (error) {
    console.error("[ShortcutEditor] Failed to load shortcuts:", error);
    announce(t("settings.shortcuts.error"));
  }
}

async function resetShortcuts() {
  try {
    const result = await window.electron.invoke("shortcuts:reset");
    if (result?.success === false) throw new Error(result.error);
    applyPayload(result);
    pendingConflict = null;
    recordingActionId = "";
    hideResetConfirmation();
    render();
    announce(t("settings.shortcuts.resetSuccess"));
    showToast(t("settings.shortcuts.resetSuccess"), "success");
  } catch (error) {
    console.error("[ShortcutEditor] Failed to reset shortcuts:", error);
    announce(t("settings.shortcuts.error"));
  }
}

function showResetConfirmation() {
  const confirmation = getElement(SELECTORS.resetConfirm);
  if (!confirmation) return;
  confirmation.hidden = false;
  confirmation.querySelector('[data-action="confirm"]')?.focus();
}

function hideResetConfirmation() {
  const confirmation = getElement(SELECTORS.resetConfirm);
  if (confirmation) confirmation.hidden = true;
}

async function resolvePlatform() {
  try {
    const info = await window.electron?.getPlatformInfo?.();
    isMac = Boolean(info?.isMac || info?.platform === "darwin");
  } catch {
    isMac = navigator.platform?.toLowerCase().includes("mac") || false;
  }
}

export async function initShortcutEditor() {
  if (initialized) return;
  const list = getElement(SELECTORS.list);
  if (!list) return;
  initialized = true;

  getElement(SELECTORS.search)?.addEventListener("input", render);
  getElement(SELECTORS.reset)?.addEventListener("click", showResetConfirmation);
  getElement(SELECTORS.resetConfirm)
    ?.querySelector('[data-action="confirm"]')
    ?.addEventListener("click", () => void resetShortcuts());
  getElement(SELECTORS.resetConfirm)
    ?.querySelector('[data-action="cancel"]')
    ?.addEventListener("click", hideResetConfirmation);
  window.addEventListener("keydown", captureShortcut, true);
  window.addEventListener("i18n:changed", render);
  window.addEventListener("settings:closed", () => {
    if (recordingActionId) stopRecording();
    pendingConflict = null;
    hideResetConfirmation();
    render();
  });
  window.addEventListener("shortcuts:updated", (event) => {
    applyPayload(event.detail);
    render();
  });
  window.electron?.on?.("shortcuts:changed", (payload) => {
    applyPayload(payload);
    render();
  });
  await resolvePlatform();
  await load();
}

export const __test = {
  formatAccelerator,
  isSafeAccelerator,
  resolvePayload,
};
