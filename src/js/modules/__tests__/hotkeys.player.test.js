jest.mock("../settingsModal.js", () => ({
  closeSettings: jest.fn(),
  openSettings: jest.fn(),
  openSettingsWithTab: jest.fn(),
  updateThemeDropdownUI: jest.fn(),
}));
jest.mock("../settingsStore.js", () => ({ setTheme: jest.fn() }));
jest.mock("../toast.js", () => ({ showToast: jest.fn() }));
jest.mock("../i18n.js", () => ({ t: (key) => key }));
jest.mock("../modalManager.js", () => ({ closeAllModals: jest.fn() }));

function buildDom() {
  document.body.innerHTML = `
    <button id="download-button"></button>
    <button id="open-folder"></button>
    <button id="open-history"></button>
    <button id="open-last-video"></button>
    <button id="clear-history"></button>
    <div id="whats-new-modal"></div>
    <div id="confirmation-modal"></div>
    <div id="settings-modal"></div>
    <input id="text-input" />
    <div class="settings-shortcuts"><button id="shortcut-field"></button></div>
  `;
}

describe("Player local hotkeys", () => {
  beforeEach(() => {
    jest.resetModules();
    buildDom();
  });

  test("allows repeats only for continuous commands and blocks editable targets", async () => {
    window.electron = {
      getPlatformInfo: jest.fn(async () => ({ platform: "win32" })),
      on: jest.fn(),
      invoke: jest.fn(async () => ({
        assignments: {
          "player.toggleMute": "Alt+M",
          "player.volumeUp": "Alt+Up",
        },
      })),
    };
    const hotkeys = require("../hotkeys.js");
    const mute = jest.fn();
    const volume = jest.fn();
    hotkeys.registerLocalShortcutAction("player.toggleMute", mute);
    hotkeys.registerLocalShortcutAction("player.volumeUp", volume, {
      allowRepeat: true,
    });
    await hotkeys.initHotkeys({ activateTab: jest.fn() });
    await Promise.resolve();

    document.dispatchEvent(
      new KeyboardEvent("keydown", {
        key: "m",
        altKey: true,
        repeat: true,
        bubbles: true,
      }),
    );
    document.dispatchEvent(
      new KeyboardEvent("keydown", {
        key: "ArrowUp",
        altKey: true,
        repeat: true,
        bubbles: true,
      }),
    );
    document.getElementById("text-input").dispatchEvent(
      new KeyboardEvent("keydown", {
        key: "m",
        altKey: true,
        bubbles: true,
      }),
    );
    document.getElementById("shortcut-field").dispatchEvent(
      new KeyboardEvent("keydown", {
        key: "m",
        altKey: true,
        bubbles: true,
      }),
    );

    expect(mute).not.toHaveBeenCalled();
    expect(volume).toHaveBeenCalledTimes(1);
    hotkeys.disableHotkeys();
  });

  test("distinguishes Command from Control on macOS", async () => {
    window.electron = {
      getPlatformInfo: jest.fn(async () => ({ platform: "darwin", isMac: true })),
      on: jest.fn(),
      invoke: jest.fn(async () => ({
        assignments: { "player.open": "CommandOrControl+4" },
      })),
    };
    const hotkeys = require("../hotkeys.js");
    const open = jest.fn();
    hotkeys.registerLocalShortcutAction("player.open", open);
    await hotkeys.initHotkeys({ activateTab: jest.fn() });
    await Promise.resolve();

    document.dispatchEvent(
      new KeyboardEvent("keydown", { key: "4", ctrlKey: true }),
    );
    document.dispatchEvent(
      new KeyboardEvent("keydown", { key: "4", metaKey: true }),
    );

    expect(open).toHaveBeenCalledTimes(1);
    hotkeys.disableHotkeys();
  });
});
