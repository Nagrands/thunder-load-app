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

describe("tools remember last tool setting", () => {
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

  it("is disabled by default and persists checkbox changes", async () => {
    document.body.innerHTML = `
      <div id="settings-modal">
        <div id="wgunlock-settings">
          <input id="wg-disable-toggle" type="checkbox" />
          <input id="wg-remember-last-tool" type="checkbox" />
        </div>
      </div>`;
    const mod = require("../settings");
    await mod.initSettings?.();

    const rememberInput = document.getElementById("wg-remember-last-tool");
    expect(rememberInput?.checked).toBe(false);
    expect(localStorage.getItem("toolsRememberLastView")).toBeNull();

    rememberInput.checked = true;
    rememberInput.dispatchEvent(new Event("change"));
    expect(localStorage.getItem("toolsRememberLastView")).toBe("true");
  });
});

describe("language dropdown initializes and updates language", () => {
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

  it("syncs label and calls setLanguage on click", async () => {
    document.body.innerHTML = `
      <div id="appearance-settings">
        <button id="language-dropdown-btn"></button>
        <span id="language-selected-label"></span>
        <ul id="language-dropdown-menu">
          <li data-value="ru">Русский</li>
          <li data-value="en">English</li>
        </ul>
      </div>`;

    const setLanguage = jest.fn();

    let initPromise;
    jest.isolateModules(() => {
      jest.doMock("../i18n", () => ({
        applyI18n: jest.fn(),
        getLanguage: () => "ru",
        setLanguage,
        t: (key) => key,
      }));
      const mod = require("../settings");
      initPromise = mod.initSettings?.();
    });
    if (initPromise) await initPromise;

    const label = document.getElementById("language-selected-label");
    const menu = document.getElementById("language-dropdown-menu");
    const items = menu?.querySelectorAll("li");
    expect(label?.textContent).toBe("language.ru");
    expect(items?.[0]?.classList.contains("active")).toBe(true);

    items?.[1]?.dispatchEvent(new Event("click"));
    expect(setLanguage).toHaveBeenCalledWith("en");
  });
});

describe("download parallel limit toggle", () => {
  beforeEach(() => {
    jest.resetModules();
    localStorage.clear();
    global.window = global.window || {};
    window.electron = {
      invoke: jest.fn().mockResolvedValue({ success: true, limit: 2 }),
      on: jest.fn(),
      send: jest.fn(),
    };
  });

  it("migrates legacy value 3 to 2 and reflects segment state", async () => {
    localStorage.setItem("downloadParallelLimit", "3");
    document.body.innerHTML = `
      <div id="window-settings">
        <div id="settings-download-parallel-segment">
          <button id="settings-download-parallel-1" data-limit="1"></button>
          <button id="settings-download-parallel-2" data-limit="2"></button>
        </div>
        <strong id="settings-download-parallel-value"></strong>
      </div>`;

    const mod = require("../settings");
    await mod.initSettings?.();

    const option1 = document.getElementById("settings-download-parallel-1");
    const option2 = document.getElementById("settings-download-parallel-2");
    const value = document.getElementById("settings-download-parallel-value");
    expect(localStorage.getItem("downloadParallelLimit")).toBe("2");
    expect(option1?.classList.contains("is-active")).toBe(false);
    expect(option2?.classList.contains("is-active")).toBe(true);
    expect(value?.textContent).toBe("2");
    expect(window.electron.invoke).toHaveBeenCalledWith(
      "set-download-parallel-limit",
      2,
    );
  });

  it("writes 1/2 and dispatches download:parallel-limit-changed on segment click", async () => {
    localStorage.setItem("downloadParallelLimit", "2");
    document.body.innerHTML = `
      <div id="window-settings">
        <div id="settings-download-parallel-segment">
          <button id="settings-download-parallel-1" data-limit="1"></button>
          <button id="settings-download-parallel-2" data-limit="2"></button>
        </div>
        <strong id="settings-download-parallel-value"></strong>
      </div>`;

    const mod = require("../settings");
    await mod.initSettings?.();

    let eventDetail = null;
    window.addEventListener("download:parallel-limit-changed", (event) => {
      eventDetail = event?.detail || null;
    });

    const option1 = document.getElementById("settings-download-parallel-1");
    const value = document.getElementById("settings-download-parallel-value");
    option1.dispatchEvent(new Event("click"));

    expect(localStorage.getItem("downloadParallelLimit")).toBe("1");
    expect(eventDetail).toEqual({ limit: 1 });
    expect(value?.textContent).toBe("1");
    expect(window.electron.invoke).toHaveBeenCalledWith(
      "set-download-parallel-limit",
      1,
    );
  });
});
