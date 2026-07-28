const {
  ShortcutService,
  createShortcutCatalog,
  normalizeAccelerator,
  validateAccelerator,
} = require("../shortcutService");

jest.mock("electron-log", () => ({
  info: jest.fn(),
  warn: jest.fn(),
  error: jest.fn(),
}));

function createStore(initial = {}) {
  const values = { ...initial };
  return {
    get: jest.fn((key, fallback) =>
      Object.prototype.hasOwnProperty.call(values, key)
        ? values[key]
        : fallback,
    ),
    set: jest.fn((key, value) => {
      values[key] = value;
    }),
    values,
  };
}

function createGlobalShortcut() {
  const callbacks = new Map();
  const rejected = new Set();
  return {
    callbacks,
    rejected,
    register: jest.fn((accelerator, callback) => {
      if (rejected.has(accelerator)) return false;
      callbacks.set(accelerator, callback);
      return true;
    }),
    unregister: jest.fn((accelerator) => callbacks.delete(accelerator)),
  };
}

function createService(options = {}) {
  const store = options.store || createStore();
  const globalShortcut = options.globalShortcut || createGlobalShortcut();
  const mainWindow = options.mainWindow || {
    isDestroyed: jest.fn(() => false),
    isMinimized: jest.fn(() => false),
    focus: jest.fn(),
    webContents: { send: jest.fn() },
  };
  return {
    service: new ShortcutService({
      store,
      globalShortcut,
      mainWindow,
      platform: options.platform || "win32",
    }),
    store,
    globalShortcut,
    mainWindow,
  };
}

describe("shortcutService", () => {
  test("exposes 30 unique actions with platform defaults", () => {
    const mac = createShortcutCatalog("darwin");
    const windows = createShortcutCatalog("win32");

    expect(mac).toHaveLength(30);
    expect(new Set(mac.map(({ id }) => id)).size).toBe(30);
    expect(mac.some(({ id }) => id === "app.reload")).toBe(false);
    expect(
      mac.find(({ id }) => id === "site.youtube.open").defaultAccelerator,
    ).toBe("Alt+1");
    expect(
      windows.find(({ id }) => id === "site.youtube.open")
        .defaultAccelerator,
    ).toBe("CommandOrControl+Shift+1");
    expect(mac.find(({ id }) => id === "settings.open").defaultAccelerator).toBe(
      "CommandOrControl+,",
    );
    expect(
      windows.find(({ id }) => id === "player.togglePlayback")
        .defaultAccelerator,
    ).toBe("Alt+P");
    expect(windows.filter(({ categoryKey }) =>
      categoryKey === "shortcuts.categories.player")).toHaveLength(15);
  });

  test("normalizes aliases and rejects unsafe combinations", () => {
    expect(normalizeAccelerator("ctrl+shift+a", "darwin")).toBe(
      "Control+Shift+A",
    );
    expect(normalizeAccelerator("ctrl+shift+a", "win32")).toBe(
      "CommandOrControl+Shift+A",
    );
    expect(normalizeAccelerator("option+2")).toBe("Alt+2");
    expect(validateAccelerator("F12")).toEqual({
      valid: true,
      accelerator: "F12",
    });
    expect(validateAccelerator("A")).toEqual({
      valid: false,
      error: "unsafeAccelerator",
    });
    expect(validateAccelerator("Control+Q")).toEqual({
      valid: false,
      error: "systemAccelerator",
    });
  });

  test("fills new actions and migrates legacy site shortcuts once", () => {
    const store = createStore({
      userShortcuts: [
        { combo: "Control+Alt+8", url: "https://www.youtube.com" },
      ],
    });
    const { service } = createService({ store });

    expect(service.getState().assignments["site.youtube.open"]).toBe(
      "CommandOrControl+Alt+8",
    );
    expect(service.getState().assignments["settings.shortcuts.open"]).toBe(
      "CommandOrControl+P",
    );
    expect(store.set).toHaveBeenCalledWith(
      "shortcutAssignments",
      expect.objectContaining({
        "site.youtube.open": "CommandOrControl+Alt+8",
      }),
    );
  });

  test("preserves existing assignments and leaves conflicting new defaults unassigned", () => {
    const store = createStore({
      shortcutAssignments: {
        "settings.shortcuts.open": "CommandOrControl+P",
        "settings.open": "CommandOrControl+,",
        "theme.toggle": "Alt+P",
      },
    });
    const { service } = createService({ store });

    expect(service.getState().assignments["theme.toggle"]).toBe("Alt+P");
    expect(service.getState().assignments["player.togglePlayback"]).toBeNull();
    expect(store.set).toHaveBeenCalledWith(
      "shortcutAssignments",
      expect.objectContaining({
        "theme.toggle": "Alt+P",
        "player.togglePlayback": null,
      }),
    );
  });

  test("round-trips explicitly unassigned shortcuts on import", () => {
    const { service } = createService();
    const replaced = service.replaceAssignments({
      ...service.getState().assignments,
      "player.togglePlayback": null,
    });

    expect(replaced.success).toBe(true);
    expect(replaced.assignments["player.togglePlayback"]).toBeNull();
  });

  test("reports conflicts and swaps assignments atomically", () => {
    const { service } = createService();
    const conflict = service.setShortcut(
      "theme.toggle",
      "CommandOrControl+P",
    );

    expect(conflict).toEqual(
      expect.objectContaining({
        success: false,
        error: "conflict",
        conflictingActionId: "settings.shortcuts.open",
      }),
    );

    const swapped = service.setShortcut(
      "theme.toggle",
      "CommandOrControl+P",
      { strategy: "swap" },
    );
    expect(swapped.success).toBe(true);
    expect(swapped.assignments["theme.toggle"]).toBe("CommandOrControl+P");
    expect(swapped.assignments["settings.shortcuts.open"]).toBe(
      "CommandOrControl+T",
    );
  });

  test("replace ignores unknown ids, fills missing ids and reset restores defaults", () => {
    const { service } = createService();
    const replaced = service.replaceAssignments({
      "theme.toggle": "Alt+T",
      "future.action": "Alt+F8",
    });

    expect(replaced.success).toBe(true);
    expect(replaced.assignments["theme.toggle"]).toBe("Alt+T");
    expect(replaced.assignments["settings.open"]).toBe("CommandOrControl+,");
    expect(replaced.assignments["future.action"]).toBeUndefined();

    const reset = service.reset();
    expect(reset.assignments["theme.toggle"]).toBe("CommandOrControl+T");
  });

  test("rolls global registrations back if the OS rejects a new accelerator", () => {
    const { service, globalShortcut, store } = createService();
    expect(service.registerGlobals().success).toBe(true);
    globalShortcut.rejected.add("Alt+9");

    const result = service.setShortcut("site.youtube.open", "Alt+9");

    expect(result).toEqual(
      expect.objectContaining({
        success: false,
        error: "registrationFailed",
        actionId: "site.youtube.open",
      }),
    );
    expect(service.getState().assignments["site.youtube.open"]).toBe(
      "CommandOrControl+Shift+1",
    );
    expect(globalShortcut.callbacks.has("CommandOrControl+Shift+1")).toBe(true);
    expect(store.set).not.toHaveBeenLastCalledWith(
      "shortcutAssignments",
      expect.objectContaining({ "site.youtube.open": "Alt+9" }),
    );
  });

  test("registers owned site callbacks", () => {
    const { service, globalShortcut, mainWindow } = createService();
    service.registerGlobals();

    globalShortcut.callbacks.get("CommandOrControl+Shift+1")();
    expect(mainWindow.webContents.send).toHaveBeenCalledWith(
      "open-site",
      "https://www.youtube.com",
    );
    expect(globalShortcut.callbacks.has("CommandOrControl+Shift+1")).toBe(true);
  });

  test("disable flag removes only service-owned shortcuts", () => {
    const { service, globalShortcut, store } = createService();
    service.registerGlobals();
    globalShortcut.callbacks.set("ThirdParty+1", jest.fn());

    service.setGlobalShortcutsDisabled(true);

    expect(store.values.disableGlobalShortcuts).toBe(true);
    expect(globalShortcut.callbacks.has("ThirdParty+1")).toBe(true);
    expect(service.ownedAccelerators.size).toBe(0);
  });

  test("restores the disable flag when re-enabling registrations fails", () => {
    const { service, globalShortcut, store } = createService();
    service.registerGlobals();
    service.setGlobalShortcutsDisabled(true);
    globalShortcut.rejected.add("CommandOrControl+Shift+1");

    const result = service.setGlobalShortcutsDisabled(false);

    expect(result.success).toBe(false);
    expect(result.error).toBe("registrationFailed");
    expect(store.values.disableGlobalShortcuts).toBe(true);
  });
});
