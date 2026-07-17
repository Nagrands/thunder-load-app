const log = require("electron-log");

const ASSIGNMENTS_KEY = "shortcutAssignments";
const LEGACY_SHORTCUTS_KEY = "userShortcuts";

const SITE_ACTIONS = Object.freeze([
  ["site.youtube.open", "openYoutube", "https://www.youtube.com", "1"],
  ["site.twitch.open", "openTwitch", "https://www.twitch.tv", "2"],
  ["site.vk.open", "openVkVideo", "https://vkvideo.ru", "3"],
  ["site.coub.open", "openCoub", "https://www.coub.com", "4"],
]);

function createAction({
  id,
  scope = "local",
  category,
  key,
  defaultAccelerator,
}) {
  return Object.freeze({
    id,
    scope,
    categoryKey: `shortcuts.categories.${category}`,
    titleKey: `shortcuts.actions.${key}.title`,
    descriptionKey: `shortcuts.actions.${key}.description`,
    defaultAccelerator,
  });
}

function createShortcutCatalog(platform = process.platform) {
  const siteModifier =
    platform === "darwin" ? "Alt" : "CommandOrControl+Shift";
  return Object.freeze([
    createAction({
      id: "settings.shortcuts.open",
      category: "settings",
      key: "openShortcutSettings",
      defaultAccelerator: "CommandOrControl+P",
    }),
    createAction({
      id: "settings.open",
      category: "settings",
      key: "openSettings",
      defaultAccelerator: "CommandOrControl+,",
    }),
    createAction({
      id: "theme.toggle",
      category: "settings",
      key: "toggleTheme",
      defaultAccelerator: "CommandOrControl+T",
    }),
    createAction({
      id: "navigation.downloader",
      category: "navigation",
      key: "openDownloader",
      defaultAccelerator: "CommandOrControl+1",
    }),
    createAction({
      id: "navigation.tools",
      category: "navigation",
      key: "openTools",
      defaultAccelerator: "CommandOrControl+2",
    }),
    createAction({
      id: "navigation.backup",
      category: "navigation",
      key: "openBackup",
      defaultAccelerator: "CommandOrControl+3",
    }),
    createAction({
      id: "downloads.start",
      category: "downloads",
      key: "startDownload",
      defaultAccelerator: "CommandOrControl+D",
    }),
    createAction({
      id: "downloads.folder.open",
      category: "downloads",
      key: "openDownloadsFolder",
      defaultAccelerator: "CommandOrControl+K",
    }),
    createAction({
      id: "history.open",
      category: "downloads",
      key: "openHistory",
      defaultAccelerator: "CommandOrControl+H",
    }),
    createAction({
      id: "downloads.last.open",
      category: "downloads",
      key: "openLastVideo",
      defaultAccelerator: "CommandOrControl+L",
    }),
    createAction({
      id: "history.clear",
      category: "downloads",
      key: "clearHistory",
      defaultAccelerator: "CommandOrControl+M",
    }),
    createAction({
      id: "app.reload",
      scope: "global",
      category: "system",
      key: "reload",
      defaultAccelerator: "CommandOrControl+R",
    }),
    ...SITE_ACTIONS.map(([id, key, , number]) =>
      createAction({
        id,
        scope: "global",
        category: "sites",
        key,
        defaultAccelerator: `${siteModifier}+${number}`,
      }),
    ),
  ]);
}

const KEY_ALIASES = Object.freeze({
  CMD: "Command",
  COMMAND: "Command",
  COMMANDORCONTROL: "CommandOrControl",
  COMMANDORCTRL: "CommandOrControl",
  CTRL: "Control",
  CONTROL: "Control",
  ALT: "Alt",
  OPTION: "Alt",
  SHIFT: "Shift",
  META: "Command",
  ESC: "Escape",
  ESCAPE: "Escape",
  RETURN: "Enter",
  ENTER: "Enter",
  SPACE: "Space",
});

const MODIFIER_ORDER = Object.freeze([
  "CommandOrControl",
  "Command",
  "Control",
  "Alt",
  "Shift",
]);
const MODIFIERS = new Set(MODIFIER_ORDER);
const FORBIDDEN_KEYS = new Set(["Escape", "Tab"]);

function normalizeAccelerator(value, platform = process.platform) {
  if (typeof value !== "string") return null;
  const parts = value
    .split("+")
    .map((part) => part.trim())
    .filter(Boolean);
  if (parts.length === 0) return null;

  const normalized = parts.map((part) => {
    const upper = part.toUpperCase();
    if (KEY_ALIASES[upper]) return KEY_ALIASES[upper];
    if (/^F([1-9]|1[0-2])$/i.test(part)) return upper;
    if (part === ",") return ",";
    if (/^[A-Z0-9]$/i.test(part)) return upper;
    return null;
  });
  if (normalized.some((part) => !part)) return null;

  const keys = normalized.filter((part) => !MODIFIERS.has(part));
  const modifiers = [
    ...new Set(
      normalized
        .filter((part) => MODIFIERS.has(part))
        .map((modifier) => {
          if (platform === "darwin" && modifier === "Command") {
            return "CommandOrControl";
          }
          if (platform !== "darwin" && modifier === "Control") {
            return "CommandOrControl";
          }
          return modifier;
        }),
    ),
  ];
  if (keys.length !== 1) return null;
  modifiers.sort(
    (left, right) =>
      MODIFIER_ORDER.indexOf(left) - MODIFIER_ORDER.indexOf(right),
  );
  return [...modifiers, keys[0]].join("+");
}

function validateAccelerator(value, platform = process.platform) {
  const accelerator = normalizeAccelerator(value, platform);
  if (!accelerator) {
    return { valid: false, error: "invalidAccelerator" };
  }
  const parts = accelerator.split("+");
  const key = parts.at(-1);
  const modifiers = parts.slice(0, -1);
  const isFunctionKey = /^F([1-9]|1[0-2])$/.test(key);
  const hasRequiredModifier = modifiers.some((modifier) =>
    ["CommandOrControl", "Command", "Control", "Alt"].includes(modifier),
  );
  if (FORBIDDEN_KEYS.has(key) || (!isFunctionKey && !hasRequiredModifier)) {
    return { valid: false, error: "unsafeAccelerator" };
  }
  const forbidden =
    (key === "Q" &&
      modifiers.some((modifier) =>
        ["CommandOrControl", "Command", "Control"].includes(modifier),
      )) ||
    (key === "W" &&
      modifiers.some((modifier) =>
        ["CommandOrControl", "Command", "Control"].includes(modifier),
      )) ||
    (key === "F4" && modifiers.includes("Alt"));
  if (forbidden) return { valid: false, error: "systemAccelerator" };
  return { valid: true, accelerator };
}

function getDefaults(catalog) {
  return Object.fromEntries(
    catalog.map((action) => [action.id, action.defaultAccelerator]),
  );
}

function migrateLegacyAssignments(store, defaults, platform) {
  const legacy = store.get(LEGACY_SHORTCUTS_KEY, null);
  if (!Array.isArray(legacy)) return defaults;
  const migrated = { ...defaults };
  const byUrl = new Map(
    SITE_ACTIONS.map(([id, , url]) => [url.replace(/\/$/, ""), id]),
  );
  legacy.forEach((entry, index) => {
    const url = String(entry?.url || "").replace(/\/$/, "");
    const actionId = byUrl.get(url) || SITE_ACTIONS[index]?.[0];
    const validation = validateAccelerator(entry?.combo, platform);
    if (actionId && validation.valid) {
      migrated[actionId] = validation.accelerator;
    }
  });
  return migrated;
}

class ShortcutService {
  constructor({
    store,
    globalShortcut,
    mainWindow = null,
    platform = process.platform,
  }) {
    this.store = store;
    this.globalShortcut = globalShortcut;
    this.mainWindow = mainWindow;
    this.platform = platform;
    this.catalog = createShortcutCatalog(platform);
    this.ownedAccelerators = new Set();
    this.reloadSuppressed = false;
    this.assignments = this.loadAssignments();
  }

  loadAssignments() {
    const defaults = getDefaults(this.catalog);
    const stored = this.store.get(ASSIGNMENTS_KEY, null);
    const source =
      stored && typeof stored === "object" && !Array.isArray(stored)
        ? stored
        : migrateLegacyAssignments(this.store, defaults, this.platform);
    const normalized = { ...defaults };
    for (const action of this.catalog) {
      const validation = validateAccelerator(source[action.id], this.platform);
      if (validation.valid) normalized[action.id] = validation.accelerator;
    }
    if (!this.findDuplicate(normalized)) {
      this.store.set(ASSIGNMENTS_KEY, normalized);
      return normalized;
    }
    this.store.set(ASSIGNMENTS_KEY, defaults);
    return defaults;
  }

  getState() {
    return {
      success: true,
      actions: this.catalog.map((action) => ({ ...action })),
      assignments: { ...this.assignments },
      disableGlobalShortcuts: this.store.get(
        "disableGlobalShortcuts",
        false,
      ),
    };
  }

  findDuplicate(assignments) {
    const ownerByAccelerator = new Map();
    for (const action of this.catalog) {
      const accelerator = assignments[action.id];
      if (ownerByAccelerator.has(accelerator)) {
        return {
          actionId: action.id,
          conflictingActionId: ownerByAccelerator.get(accelerator),
          accelerator,
        };
      }
      ownerByAccelerator.set(accelerator, action.id);
    }
    return null;
  }

  validateAssignments(input, { fillDefaults = true } = {}) {
    if (!input || typeof input !== "object" || Array.isArray(input)) {
      return { success: false, error: "invalidAssignments" };
    }
    const next = fillDefaults ? getDefaults(this.catalog) : { ...this.assignments };
    for (const action of this.catalog) {
      if (!Object.prototype.hasOwnProperty.call(input, action.id)) continue;
      const validation = validateAccelerator(
        input[action.id],
        this.platform,
      );
      if (!validation.valid) {
        return {
          success: false,
          error: validation.error,
          actionId: action.id,
        };
      }
      next[action.id] = validation.accelerator;
    }
    const conflict = this.findDuplicate(next);
    if (conflict) return { success: false, error: "conflict", ...conflict };
    return { success: true, assignments: next };
  }

  setShortcut(actionId, accelerator, { strategy } = {}) {
    const action = this.catalog.find((item) => item.id === actionId);
    if (!action) return { success: false, error: "unknownAction" };
    const validation = validateAccelerator(accelerator, this.platform);
    if (!validation.valid) {
      return { success: false, error: validation.error, actionId };
    }
    const conflictingActionId = this.catalog.find(
      (item) =>
        item.id !== actionId &&
        this.assignments[item.id] === validation.accelerator,
    )?.id;
    if (conflictingActionId && strategy !== "swap") {
      return {
        success: false,
        error: "conflict",
        actionId,
        conflictingActionId,
        accelerator: validation.accelerator,
      };
    }
    const next = { ...this.assignments };
    if (conflictingActionId) {
      next[conflictingActionId] = next[actionId];
    }
    next[actionId] = validation.accelerator;
    return this.applyAssignments(next);
  }

  replaceAssignments(assignments) {
    const validated = this.validateAssignments(assignments);
    if (!validated.success) return validated;
    return this.applyAssignments(validated.assignments);
  }

  reset() {
    return this.applyAssignments(getDefaults(this.catalog));
  }

  applyAssignments(next) {
    const previous = this.assignments;
    this.assignments = next;
    const registration = this.registerGlobals();
    if (!registration.success) {
      this.assignments = previous;
      return registration;
    }
    this.store.set(ASSIGNMENTS_KEY, next);
    return { success: true, assignments: { ...next } };
  }

  setMainWindow(mainWindow) {
    this.mainWindow = mainWindow;
  }

  setReloadSuppressed(suppressed) {
    const next = Boolean(suppressed);
    if (this.reloadSuppressed === next) return { success: true };
    const previous = this.reloadSuppressed;
    this.reloadSuppressed = next;
    const result = this.registerGlobals();
    if (!result.success) this.reloadSuppressed = previous;
    return result;
  }

  setGlobalShortcutsDisabled(disabled) {
    const previous = this.store.get("disableGlobalShortcuts", false);
    const next = Boolean(disabled);
    this.store.set("disableGlobalShortcuts", next);
    const result = this.registerGlobals();
    if (!result.success) this.store.set("disableGlobalShortcuts", previous);
    return result;
  }

  unregisterOwned() {
    for (const accelerator of this.ownedAccelerators) {
      try {
        this.globalShortcut.unregister(accelerator);
      } catch (error) {
        log.warn("Failed to unregister shortcut:", accelerator, error.message);
      }
    }
    this.ownedAccelerators.clear();
  }

  getGlobalActions() {
    if (this.store.get("disableGlobalShortcuts", false)) return [];
    return this.catalog.filter(
      (action) => action.scope === "global" &&
        !(action.id === "app.reload" && this.reloadSuppressed),
    );
  }

  registerGlobals() {
    const previousOwned = new Set(this.ownedAccelerators);
    const previousAssignments = this._registeredAssignments || this.assignments;
    this.unregisterOwned();
    const registered = new Set();
    for (const action of this.getGlobalActions()) {
      const accelerator = this.assignments[action.id];
      try {
        const success = this.globalShortcut.register(
          accelerator,
          this.createGlobalCallback(action.id),
        );
        if (!success) throw new Error("registrationRejected");
        registered.add(accelerator);
      } catch (_error) {
        for (const item of registered) {
          try {
            this.globalShortcut.unregister(item);
          } catch (_) {}
        }
        this.assignments = previousAssignments;
        this.ownedAccelerators.clear();
        for (const oldAccelerator of previousOwned) {
          const oldAction = this.catalog.find(
            (item) =>
              item.scope === "global" &&
              previousAssignments[item.id] === oldAccelerator,
          );
          if (!oldAction) continue;
          try {
            if (
              this.globalShortcut.register(
                oldAccelerator,
                this.createGlobalCallback(oldAction.id),
              )
            ) {
              this.ownedAccelerators.add(oldAccelerator);
            }
          } catch (_) {}
        }
        return {
          success: false,
          error: "registrationFailed",
          actionId: action.id,
          accelerator,
        };
      }
    }
    this.ownedAccelerators = registered;
    this._registeredAssignments = { ...this.assignments };
    return { success: true };
  }

  createGlobalCallback(actionId) {
    return () => {
      const targetWindow = this.mainWindow;
      if (!targetWindow || targetWindow.isDestroyed?.()) return;
      if (actionId === "app.reload") {
        targetWindow.reload();
        return;
      }
      const site = SITE_ACTIONS.find(([id]) => id === actionId);
      if (!site) return;
      targetWindow.webContents?.send?.("open-site", site[2]);
      if (targetWindow.isMinimized?.()) targetWindow.restore?.();
      targetWindow.focus?.();
    };
  }
}

module.exports = {
  ShortcutService,
  createShortcutCatalog,
  normalizeAccelerator,
  validateAccelerator,
  getDefaults,
};
