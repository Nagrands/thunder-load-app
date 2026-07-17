jest.mock("../hotkeys.js", () => ({
  acceleratorFromKeyboardEvent: (event) => {
    const parts = [];
    if (event.ctrlKey || event.metaKey) parts.push("CommandOrControl");
    if (event.altKey) parts.push("Alt");
    if (event.shiftKey) parts.push("Shift");
    parts.push(event.key.toUpperCase());
    return parts.join("+");
  },
}));

jest.mock("../i18n.js", () => ({
  t: (key, vars = {}) =>
    Object.entries(vars).reduce(
      (text, [name, value]) => `${text} ${name}:${value}`,
      key,
    ),
}));

jest.mock("../toast.js", () => ({
  showToast: jest.fn(),
}));

const CATALOG = [
  {
    id: "downloads.start",
    scope: "local",
    titleKey: "action.download",
    descriptionKey: "action.download.description",
    categoryKey: "category.downloads",
  },
  {
    id: "history.open",
    scope: "local",
    titleKey: "action.history",
    descriptionKey: "action.history.description",
    categoryKey: "category.history",
  },
];
const flushAsyncEvents = () =>
  new Promise((resolve) => window.setTimeout(resolve, 0));

describe("shortcutEditor", () => {
  let listeners;

  beforeEach(() => {
    jest.resetModules();
    listeners = {};
    document.body.innerHTML = `
      <input id="shortcuts-search" />
      <div id="shortcuts-list"></div>
      <p id="shortcuts-empty" hidden></p>
      <p id="shortcuts-live" aria-live="polite"></p>
      <button id="shortcuts-reset" type="button">reset</button>
      <div id="shortcuts-reset-confirm" hidden>
        <button data-action="confirm" type="button">confirm</button>
        <button data-action="cancel" type="button">cancel</button>
      </div>
    `;
    window.electron = {
      getPlatformInfo: jest.fn(async () => ({
        isMac: false,
        platform: "win32",
      })),
      on: jest.fn((channel, callback) => {
        listeners[channel] = callback;
      }),
      invoke: jest.fn(async (channel, payload) => {
        if (channel === "shortcuts:get") {
          return {
            success: true,
            catalog: CATALOG,
            assignments: {
              "downloads.start": "CommandOrControl+D",
              "history.open": "CommandOrControl+H",
            },
          };
        }
        if (channel === "shortcuts:set") {
          return {
            success: true,
            assignments: {
              "downloads.start": payload.accelerator,
              "history.open": "CommandOrControl+H",
            },
          };
        }
        if (channel === "shortcuts:reset") {
          return {
            success: true,
            catalog: CATALOG,
            assignments: {
              "downloads.start": "CommandOrControl+D",
              "history.open": "CommandOrControl+H",
            },
          };
        }
        return null;
      }),
    };
  });

  test("renders catalog metadata and filters actions", async () => {
    const { initShortcutEditor } = require("../features/settings/shortcutEditor.js");
    await initShortcutEditor();

    expect(document.querySelectorAll("[data-action-id]")).toHaveLength(2);
    expect(document.querySelector(".shortcut-editor__name").textContent).toBe(
      "action.download",
    );
    expect(document.querySelector("[data-shortcut-value]").textContent).toBe(
      "Ctrl + D",
    );

    const search = document.getElementById("shortcuts-search");
    search.value = "history";
    search.dispatchEvent(new Event("input"));
    expect(document.querySelectorAll("[data-action-id]")).toHaveLength(1);
    expect(document.querySelector("[data-action-id]").dataset.actionId).toBe(
      "history.open",
    );
  });

  test("records a shortcut immediately and Escape cancels recording", async () => {
    const { initShortcutEditor } = require("../features/settings/shortcutEditor.js");
    await initShortcutEditor();

    document.querySelector("[data-shortcut-edit]").click();
    window.dispatchEvent(
      new KeyboardEvent("keydown", {
        key: "J",
        ctrlKey: true,
        bubbles: true,
        cancelable: true,
      }),
    );
    await flushAsyncEvents();
    expect(window.electron.invoke).toHaveBeenCalledWith("shortcuts:set", {
      actionId: "downloads.start",
      accelerator: "CommandOrControl+J",
    });
    expect(document.querySelector("[data-shortcut-value]").textContent).toBe(
      "Ctrl + J",
    );

    document.querySelector("[data-shortcut-edit]").click();
    window.dispatchEvent(
      new KeyboardEvent("keydown", {
        key: "Escape",
        bubbles: true,
        cancelable: true,
      }),
    );
    expect(document.querySelector(".is-recording")).toBeNull();
  });

  test("offers an atomic swap after a conflict", async () => {
    window.electron.invoke.mockImplementation(async (channel, payload) => {
      if (channel === "shortcuts:get") {
        return {
          success: true,
          catalog: CATALOG,
          assignments: {
            "downloads.start": "CommandOrControl+D",
            "history.open": "CommandOrControl+H",
          },
        };
      }
      if (channel === "shortcuts:set" && !payload.strategy) {
        return {
          success: false,
          error: "conflict",
          conflictingActionId: "history.open",
        };
      }
      return { success: true };
    });
    const { initShortcutEditor } = require("../features/settings/shortcutEditor.js");
    await initShortcutEditor();

    document.querySelector("[data-shortcut-edit]").click();
    window.dispatchEvent(
      new KeyboardEvent("keydown", {
        key: "H",
        ctrlKey: true,
        bubbles: true,
        cancelable: true,
      }),
    );
    await flushAsyncEvents();

    document.querySelector("[data-shortcut-swap]").click();
    await flushAsyncEvents();
    expect(window.electron.invoke).toHaveBeenLastCalledWith("shortcuts:set", {
      actionId: "downloads.start",
      accelerator: "CommandOrControl+H",
      strategy: "swap",
    });
  });

  test("requires inline confirmation before reset", async () => {
    const { initShortcutEditor } = require("../features/settings/shortcutEditor.js");
    await initShortcutEditor();
    const confirmation = document.getElementById("shortcuts-reset-confirm");

    document.getElementById("shortcuts-reset").click();
    expect(confirmation.hidden).toBe(false);
    confirmation.querySelector('[data-action="confirm"]').click();
    await flushAsyncEvents();
    expect(window.electron.invoke).toHaveBeenCalledWith("shortcuts:reset");
    expect(confirmation.hidden).toBe(true);
  });
});
