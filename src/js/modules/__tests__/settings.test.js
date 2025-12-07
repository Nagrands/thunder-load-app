const stubToggle = () => ({
  checked: false,
  addEventListener: jest.fn(),
  setAttribute: jest.fn(),
  removeAttribute: jest.fn(),
});

jest.mock("../domElements", () => ({
  settingsAutoLaunchToggle: stubToggle(),
  settingsMinimizeOnLaunchToggle: stubToggle(),
  settingsCloseNotificationToggle: stubToggle(),
  settingsOpenOnDownloadCompleteToggle: stubToggle(),
  settingsOpenOnCopyUrlToggle: stubToggle(),
  settingsDisableGlobalShortcutsToggle: stubToggle(),
  settingsCloseToTrayRadio: stubToggle(),
  settingsCloseAppRadio: stubToggle(),
  settingsDisableCompleteModalToggle: stubToggle(),
  settingsLowEffectsToggle: stubToggle(),
}));

const { TextEncoder, TextDecoder } = require("util");
global.TextEncoder = global.TextEncoder || TextEncoder;
global.TextDecoder = global.TextDecoder || TextDecoder;

const { JSDOM } = require("jsdom");
let settingsModule;

describe("updateModuleBadge", () => {
  beforeEach(() => {
    jest.resetModules();
    localStorage.clear();
    document.body.innerHTML = `
      <div>
        <button class="tab-link" data-tab="wgunlock-settings" id="btn-wg">
          <span class="tab-badge tab-badge-off" id="tab-badge-wg">Выкл</span>
        </button>
        <button class="tab-link" data-tab="backup-settings" id="btn-backup">
          <span class="tab-badge" id="tab-badge-backup" hidden>Вкл</span>
        </button>
        <button class="tab-link" data-tab="randomizer-settings" id="btn-randomizer">
          <span class="tab-badge tab-badge-off" id="tab-badge-randomizer">Выкл</span>
        </button>
      </div>`;
    settingsModule = require("../settings");
  });

  it("shows badge and marks button disabled when disabled = true", () => {
    expect(typeof settingsModule.__test_updateModuleBadge).toBe("function");
    settingsModule.__test_updateModuleBadge("wg", true);
    const btn = document.querySelector(".tab-link");
    const badge = document.querySelector(".tab-badge");
    expect(btn).not.toBeNull();
    expect(badge).not.toBeNull();
    expect(btn?.classList.contains("tab-disabled")).toBe(true);
    expect(badge?.textContent).toBe("Выкл");
    expect(badge?.hasAttribute("hidden")).toBe(false);
  });

  it("hides badge and removes disabled class when disabled = false", () => {
    expect(typeof settingsModule.__test_updateModuleBadge).toBe("function");
    settingsModule.__test_updateModuleBadge("wg", false);
    const btn = document.querySelector(".tab-link");
    const badge = document.querySelector(".tab-badge");
    expect(btn).not.toBeNull();
    expect(badge).not.toBeNull();
    expect(btn?.classList.contains("tab-disabled")).toBe(false);
    expect(badge?.textContent).toBe("Вкл");
    expect(badge?.style.display).toBe("none");
  });

  it.each([
    ["wg", "btn-wg", "tab-badge-wg"],
    ["backup", "btn-backup", "tab-badge-backup"],
    ["randomizer", "btn-randomizer", "tab-badge-randomizer"],
  ])("sets accessibility attrs for %s badge", (moduleKey, btnId, badgeId) => {
    settingsModule.__test_updateModuleBadge(moduleKey, true);
    const btn = document.getElementById(btnId);
    const badge = document.getElementById(badgeId);
    expect(btn?.dataset.disabled).toBe("1");
    expect(badge?.getAttribute("aria-label")).toBe("Вкладка отключена");
    expect(badge?.getAttribute("aria-hidden")).toBe("false");

    settingsModule.__test_updateModuleBadge(moduleKey, false);
    expect(btn?.dataset.disabled).toBe("0");
    expect(badge?.getAttribute("aria-label")).toBe("Вкладка включена");
    expect(badge?.getAttribute("aria-hidden")).toBe("true");
    expect(badge?.style.display).toBe("none");
  });

  it("silently ignores unknown module keys", () => {
    expect(() =>
      settingsModule.__test_updateModuleBadge("unknown", true),
    ).not.toThrow();
  });
});

describe("wg disable toggle initializes badge state", () => {
  beforeEach(() => {
    jest.resetModules();
    localStorage.clear();
    global.window = global.window || {};
    window.electron = {
      invoke: jest.fn().mockResolvedValue(false),
      on: jest.fn(),
      send: jest.fn(),
    };
  });

  it("shows badge as off when stored flag is true", async () => {
    localStorage.setItem("wgUnlockDisabled", "true");
    document.body.innerHTML = `
      <div id="settings-modal">
        <button class="tab-link" data-tab="wgunlock-settings" id="btn-wg">
          <span class="tab-badge" id="tab-badge-wg" hidden>Вкл</span>
        </button>
        <div id="wgunlock-settings">
          <input id="wg-disable-toggle" type="checkbox" />
        </div>
      </div>`;
    const mod = require("../settings");
    await mod.initSettings?.();
    const badge = document.getElementById("tab-badge-wg");
    const btn = document.getElementById("btn-wg");
    expect(badge?.hidden).toBe(false);
    expect(badge?.style.display).toBe("");
    expect(badge?.textContent).toBe("Выкл");
    expect(btn?.classList.contains("tab-disabled")).toBe(true);
  });
});
