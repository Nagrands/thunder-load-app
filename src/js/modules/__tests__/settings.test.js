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
        <span id="settings-wg-status-badge"></span>
        <p id="settings-wg-status-text"></p>
        <span id="settings-backup-status-badge"></span>
        <p id="settings-backup-status-text"></p>
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
    expect(
      document.getElementById("settings-wg-status-badge")?.textContent,
    ).toBe("Выкл");
    expect(
      document
        .getElementById("settings-wg-status-badge")
        ?.classList.contains("is-disabled"),
    ).toBe(true);
    expect(document.getElementById("settings-wg-status-text")?.innerHTML).toBe(
      "Вкладка <strong>Инструменты</strong> отключена",
    );
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
    expect(
      document.getElementById("settings-wg-status-badge")?.textContent,
    ).toBe("Вкл");
    expect(
      document
        .getElementById("settings-wg-status-badge")
        ?.classList.contains("is-disabled"),
    ).toBe(false);
    expect(document.getElementById("settings-wg-status-text")?.innerHTML).toBe(
      "Вкладка <strong>Инструменты</strong> включена",
    );
  });

  it("sets accessibility attrs for wg sidebar badge", () => {
    settingsModule.__test_updateModuleBadge("wg", true);
    const btn = document.getElementById("btn-wg");
    const badge = document.getElementById("tab-badge-wg");
    expect(btn?.dataset.disabled).toBe("1");
    expect(badge?.getAttribute("aria-label")).toBe("Вкладка отключена");
    expect(badge?.getAttribute("aria-hidden")).toBe("false");
    expect(
      document.getElementById("settings-wg-status-badge")?.textContent,
    ).toBe("Выкл");
    expect(
      document
        .getElementById("settings-wg-status-badge")
        ?.classList.contains("is-disabled"),
    ).toBe(true);

    settingsModule.__test_updateModuleBadge("wg", false);
    expect(btn?.dataset.disabled).toBe("0");
    expect(badge?.getAttribute("aria-label")).toBe("Вкладка включена");
    expect(badge?.getAttribute("aria-hidden")).toBe("true");
    expect(badge?.style.display).toBe("none");
    expect(
      document.getElementById("settings-wg-status-badge")?.textContent,
    ).toBe("Вкл");
    expect(
      document
        .getElementById("settings-wg-status-badge")
        ?.classList.contains("is-disabled"),
    ).toBe(false);
    expect(document.getElementById("settings-wg-status-text")?.innerHTML).toBe(
      "Вкладка <strong>Инструменты</strong> включена",
    );
  });

  it("updates backup status card without requiring a sidebar tab", () => {
    settingsModule.__test_updateModuleBadge("backup", true);
    expect(
      document.getElementById("settings-backup-status-badge")?.textContent,
    ).toBe("Выкл");
    expect(
      document
        .getElementById("settings-backup-status-badge")
        ?.classList.contains("is-disabled"),
    ).toBe(true);
    expect(
      document.getElementById("settings-backup-status-text")?.innerHTML,
    ).toContain("Backup");
    expect(
      document.getElementById("settings-backup-status-text")?.innerHTML,
    ).not.toContain("Вкладка");

    settingsModule.__test_updateModuleBadge("backup", false);
    expect(
      document.getElementById("settings-backup-status-badge")?.textContent,
    ).toBe("Вкл");
    expect(
      document
        .getElementById("settings-backup-status-badge")
        ?.classList.contains("is-disabled"),
    ).toBe(false);
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
        <span id="settings-wg-status-badge"></span>
        <p id="settings-wg-status-text"></p>
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
    expect(
      document.getElementById("settings-wg-status-badge")?.textContent,
    ).toBe("Выкл");
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

describe("backup settings inside tools section", () => {
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

  it("reads and applies backup toggles inside wgunlock-settings", async () => {
    localStorage.setItem("backupDisabled", "true");
    localStorage.setItem("bk_view_mode", JSON.stringify("compact"));
    localStorage.setItem("bk_log_visible", "false");
    document.body.innerHTML = `
      <div id="settings-modal">
        <button class="tab-link" data-tab="wgunlock-settings" id="btn-wg">
          <span class="tab-badge" id="tab-badge-wg" hidden>Вкл</span>
        </button>
        <div id="wgunlock-settings">
          <input id="wg-disable-toggle" type="checkbox" />
          <input id="backup-compact-toggle" type="checkbox" />
          <input id="backup-log-toggle" type="checkbox" />
        </div>
        <span id="settings-wg-status-badge"></span>
        <p id="settings-wg-status-text"></p>
        <span id="settings-backup-status-badge"></span>
        <p id="settings-backup-status-text"></p>
      </div>`;
    const mod = require("../settings");
    await mod.initSettings?.();

    expect(document.getElementById("backup-compact-toggle")?.checked).toBe(
      true,
    );
    expect(document.getElementById("backup-log-toggle")?.checked).toBe(false);
    expect(
      document.getElementById("settings-backup-status-badge")?.textContent,
    ).toBe("Выкл");
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

describe("download quality profile segment", () => {
  beforeEach(() => {
    jest.resetModules();
    localStorage.clear();
    global.window = global.window || {};
    delete window.__thunder_dev_tools_unlocked__;
    window.electron = {
      invoke: jest.fn().mockResolvedValue({ success: true }),
      on: jest.fn(),
      send: jest.fn(),
    };
  });

  const renderQualityDom = () => {
    document.body.innerHTML = `
      <div id="window-settings">
        <div
          id="quality-profile-segment"
          role="radiogroup"
          aria-label="quality profile"
        >
          <button
            id="quality-profile-segment-remember"
            data-value="remember"
            role="radio"
            aria-checked="false"
            tabindex="-1"
          ></button>
          <button
            id="quality-profile-segment-audio"
            data-value="audio"
            role="radio"
            aria-checked="false"
            tabindex="-1"
          ></button>
        </div>
        <span id="quality-profile-summary-icon"></span>
        <strong id="quality-profile-summary-title"></strong>
        <small id="quality-profile-summary-hint"></small>
      </div>`;
  };

  it("initializes remember mode from storage and updates summary", async () => {
    localStorage.setItem("downloadQualityProfile", "remember");
    renderQualityDom();
    const mod = require("../settings");
    await mod.initSettings?.();

    const remember = document.getElementById(
      "quality-profile-segment-remember",
    );
    const audio = document.getElementById("quality-profile-segment-audio");
    const title = document.getElementById("quality-profile-summary-title");

    expect(remember?.classList.contains("is-active")).toBe(true);
    expect(remember?.getAttribute("aria-checked")).toBe("true");
    expect(audio?.classList.contains("is-active")).toBe(false);
    expect(audio?.getAttribute("aria-checked")).toBe("false");
    expect(title?.textContent).toBe(
      "settings.downloader.profile.summary.remember.title",
    );
  });

  it("switches to audio on click and persists value", async () => {
    localStorage.setItem("downloadQualityProfile", "remember");
    renderQualityDom();
    const mod = require("../settings");
    await mod.initSettings?.();

    const audio = document.getElementById("quality-profile-segment-audio");
    audio?.dispatchEvent(new MouseEvent("click", { bubbles: true }));

    expect(localStorage.getItem("downloadQualityProfile")).toBe("audio");
    expect(window.electron.invoke).toHaveBeenCalledWith(
      "toast",
      "settings.qualityProfile.saved",
      "success",
    );
  });

  it("supports keyboard selection and restores state on open-settings", async () => {
    localStorage.setItem("downloadQualityProfile", "remember");
    renderQualityDom();
    const mod = require("../settings");
    await mod.initSettings?.();

    const segment = document.getElementById("quality-profile-segment");
    segment?.dispatchEvent(
      new KeyboardEvent("keydown", { key: "ArrowRight", bubbles: true }),
    );
    segment?.dispatchEvent(
      new KeyboardEvent("keydown", { key: "Enter", bubbles: true }),
    );
    expect(localStorage.getItem("downloadQualityProfile")).toBe("audio");

    localStorage.setItem("downloadQualityProfile", "remember");
    window.__thunder_open_settings_handlers__?.get(
      "download-quality-profile",
    )?.();

    const remember = document.getElementById(
      "quality-profile-segment-remember",
    );
    const audio = document.getElementById("quality-profile-segment-audio");
    expect(remember?.classList.contains("is-active")).toBe(true);
    expect(audio?.classList.contains("is-active")).toBe(false);
  });
});

describe("developer tools gate", () => {
  beforeEach(() => {
    jest.resetModules();
    localStorage.clear();
    global.window = global.window || {};
    delete window.__thunder_dev_tools_unlocked__;
    window.electron = {
      invoke: jest.fn().mockResolvedValue({ success: true }),
      on: jest.fn(),
      send: jest.fn(),
    };
  });

  const renderDevGateDom = () => {
    document.body.innerHTML = `
      <div id="other-settings">
        <input id="settings-developer-secret-input" />
        <button id="settings-developer-activate-button" type="button"></button>
        <small id="settings-developer-status"></small>
      </div>`;
  };

  it("activates developer tools with correct secret word", async () => {
    renderDevGateDom();
    const events = [];
    window.addEventListener("tools:developer-unlock-changed", (event) => {
      events.push(event.detail);
    });

    const mod = require("../settings");
    await mod.initSettings?.();

    const input = document.getElementById("settings-developer-secret-input");
    const button = document.getElementById(
      "settings-developer-activate-button",
    );
    const status = document.getElementById("settings-developer-status");
    input.value = "thunder-dev";
    button?.click();

    expect(window.__thunder_dev_tools_unlocked__).toBe(true);
    expect(button?.textContent).toBe("settings.developer.deactivate");
    expect(status?.textContent).toBe("settings.developer.status.enabled");
    expect(events).toEqual(expect.arrayContaining([{ enabled: true }]));
    expect(
      window.electron.invoke.mock.calls.some(
        (args) =>
          args[0] === "toast" &&
          args[1] === "settings.developer.unlock.success" &&
          args[2] === "success",
      ),
    ).toBe(true);
  });

  it("does not activate developer tools with invalid secret", async () => {
    renderDevGateDom();
    const mod = require("../settings");
    await mod.initSettings?.();

    const input = document.getElementById("settings-developer-secret-input");
    const button = document.getElementById(
      "settings-developer-activate-button",
    );
    const status = document.getElementById("settings-developer-status");
    input.value = "wrong";
    button?.click();

    expect(window.__thunder_dev_tools_unlocked__).not.toBe(true);
    expect(button?.textContent).toBe("settings.developer.activate");
    expect(status?.textContent).toBe("settings.developer.status.disabled");
    expect(
      window.electron.invoke.mock.calls.some(
        (args) =>
          args[0] === "toast" &&
          args[1] === "settings.developer.unlock.error" &&
          args[2] === "error",
      ),
    ).toBe(true);
  });

  it("disables developer tools on second click when already enabled", async () => {
    renderDevGateDom();
    const mod = require("../settings");
    await mod.initSettings?.();

    const input = document.getElementById("settings-developer-secret-input");
    const button = document.getElementById(
      "settings-developer-activate-button",
    );
    const status = document.getElementById("settings-developer-status");
    input.value = "thunder-dev";
    button?.click();
    button?.click();

    expect(window.__thunder_dev_tools_unlocked__).toBe(false);
    expect(button?.textContent).toBe("settings.developer.activate");
    expect(status?.textContent).toBe("settings.developer.status.disabled");
    expect(
      window.electron.invoke.mock.calls.some(
        (args) =>
          args[0] === "toast" &&
          args[1] === "settings.developer.lock.success" &&
          args[2] === "success",
      ),
    ).toBe(true);
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

describe("downloader tools status visibility toggle", () => {
  beforeEach(() => {
    jest.resetModules();
    localStorage.clear();
    global.window = global.window || {};
    window.electron = {
      invoke: jest.fn().mockResolvedValue({ success: true }),
      on: jest.fn(),
      send: jest.fn(),
    };
  });

  it("syncs checkbox with storage and dispatches tools:visibility", async () => {
    localStorage.setItem("downloaderToolsStatusHidden", "1");
    document.body.innerHTML = `
      <div id="window-settings">
        <div class="settings-control-group">
          <ul class="module settings-control-list">
            <li class="settings-control">
              <input type="checkbox" id="settings-show-tools-status" />
            </li>
          </ul>
        </div>
      </div>`;

    const mod = require("../settings");
    await mod.initSettings?.();

    const checkbox = document.getElementById("settings-show-tools-status");
    expect(checkbox?.checked).toBe(false);

    let eventDetail = null;
    window.addEventListener("tools:visibility", (event) => {
      eventDetail = event?.detail || null;
    });

    checkbox.checked = true;
    checkbox.dispatchEvent(new Event("change"));

    expect(localStorage.getItem("downloaderToolsStatusHidden")).toBeNull();
    expect(eventDetail).toEqual({ hidden: false });
  });
});

describe("downloader behavior toggles", () => {
  beforeEach(() => {
    jest.resetModules();
    localStorage.clear();
    global.window = global.window || {};
    window.electron = {
      invoke: jest.fn((channel, payload) => {
        switch (channel) {
          case "get-open-on-copy-url-status":
            return Promise.resolve(true);
          case "get-open-on-download-complete-status":
            return Promise.resolve(false);
          case "get-disable-complete-modal-status":
            return Promise.resolve(true);
          case "set-open-on-copy-url-status":
          case "set-open-on-download-complete-status":
          case "set-disable-complete-modal-status":
          case "toast":
            return Promise.resolve({ success: true, channel, payload });
          default:
            return Promise.resolve(false);
        }
      }),
      on: jest.fn(),
      send: jest.fn(),
    };
  });

  it("applies initial states and persists changes for downloader behavior switches", async () => {
    const mod = require("../settings");
    const dom = require("../domElements");
    await mod.initSettings?.();

    const copyToggle = dom.settingsOpenOnCopyUrlToggle;
    const afterLoadToggle = dom.settingsOpenOnDownloadCompleteToggle;
    const disableModalToggle = dom.settingsDisableCompleteModalToggle;

    expect(copyToggle?.checked).toBe(true);
    expect(afterLoadToggle?.checked).toBe(false);
    expect(disableModalToggle?.checked).toBe(true);

    copyToggle.checked = false;
    const onCopyChange = copyToggle.addEventListener.mock.calls.find(
      ([event]) => event === "change",
    )?.[1];
    onCopyChange?.();
    expect(window.electron.invoke).toHaveBeenCalledWith(
      "set-open-on-copy-url-status",
      false,
    );

    afterLoadToggle.checked = true;
    const onAfterLoadChange = afterLoadToggle.addEventListener.mock.calls.find(
      ([event]) => event === "change",
    )?.[1];
    onAfterLoadChange?.();
    expect(window.electron.invoke).toHaveBeenCalledWith(
      "set-open-on-download-complete-status",
      true,
    );

    disableModalToggle.checked = false;
    const onDisableModalChange =
      disableModalToggle.addEventListener.mock.calls.find(
        ([event]) => event === "change",
      )?.[1];
    onDisableModalChange?.();
    await Promise.resolve();
    await Promise.resolve();
    expect(window.electron.invoke).toHaveBeenCalledWith(
      "set-disable-complete-modal-status",
      false,
    );
    expect(window.electron.invoke).toHaveBeenCalledWith(
      "toast",
      expect.any(String),
      "success",
      { allowHtml: true },
    );
  });
});

describe("tools settings modal", () => {
  beforeEach(() => {
    jest.resetModules();
    localStorage.clear();
    global.window = global.window || {};
    window.electron = {
      invoke: jest.fn().mockResolvedValue({ success: true }),
      on: jest.fn(),
      send: jest.fn(),
      tools: {
        getLocation: jest.fn().mockResolvedValue(null),
      },
    };
  });

  it("renders embedded tools info when downloader settings tab is active", async () => {
    document.body.innerHTML = `
      <div id="settings-modal">
        <button class="tab-link active" data-tab="window-settings" type="button">
          <span>Downloader</span>
        </button>
        <div id="window-settings" class="tab-pane active">
          <section id="tools-info"></section>
        </div>
      </div>`;

    let mod;
    let toolsInfoController;
    jest.isolateModules(() => {
      jest.doMock("../features/settings/toolsInfoController.js", () => ({
        ensureToolsInfo: jest.fn().mockResolvedValue(undefined),
      }));
      mod = require("../settings");
      toolsInfoController = require("../features/settings/toolsInfoController.js");
    });

    await mod.initSettings?.();
    window.dispatchEvent(new Event("settings:opened"));
    await Promise.resolve();

    expect(toolsInfoController.ensureToolsInfo).toHaveBeenCalledWith(false);
  });
});

describe("network status setting removal", () => {
  beforeEach(() => {
    jest.resetModules();
    localStorage.clear();
    global.window = global.window || {};
    window.electron = {
      invoke: jest.fn().mockResolvedValue(false),
      on: jest.fn(),
      send: jest.fn(),
      ipcRenderer: {
        send: jest.fn(),
        invoke: jest.fn().mockResolvedValue({ autosend: false }),
      },
      tools: {
        getLocation: jest.fn().mockResolvedValue(null),
      },
    };
  });

  it("collectCurrentConfig does not expose appearance.showNetworkStatus", async () => {
    const mod = require("../settings");
    const config = await mod.__test_collectCurrentConfig();
    expect(config?.appearance).toBeDefined();
    expect("showNetworkStatus" in config.appearance).toBe(false);
  });

  it("applyConfig clears legacy topbarNetworkStatusVisible key", async () => {
    localStorage.setItem("topbarNetworkStatusVisible", "true");
    const mod = require("../settings");
    await mod.__test_applyConfig({
      appearance: {
        theme: "system",
        fontSize: "16",
        lowEffects: false,
      },
    });
    expect(localStorage.getItem("topbarNetworkStatusVisible")).toBeNull();
  });
});
