jest.mock("../settings.js", () => ({
  exportConfig: jest.fn(),
  importConfig: jest.fn(),
  getDefaultTab: jest.fn(async () => "download"),
  setDefaultTab: jest.fn(),
  resetConfigToDefaults: jest.fn(),
}));

jest.mock("../settingsStore.js", () => ({
  toggleFontSize: jest.fn(async () => "16"),
  getFontSize: jest.fn(async () => "16"),
}));

jest.mock("../i18n.js", () => ({
  t: (key) => key,
}));

jest.mock("../firstRunModal.js", () => ({
  initFirstRunModal: jest.fn(),
}));

jest.mock("../tooltipInitializer.js", () => ({
  hideAllTooltips: jest.fn(),
}));

jest.mock("../toast.js", () => ({
  showToast: jest.fn(),
}));

jest.mock("../domElements.js", () => ({
  get settingsModal() {
    return global.document.getElementById("settings-modal");
  },
  get settingsTrigger() {
    return global.document.getElementById("footer-open-settings");
  },
}));

describe("settingsModal mobile sections navigation", () => {
  const makeDom = () => {
    document.body.innerHTML = `
      <button id="footer-open-settings" type="button">open</button>
      <button class="version-container" type="button">version</button>
      <div id="settings-modal" style="display:none">
        <button id="settings-sections-toggle" aria-expanded="false" aria-controls="settings-tabs-panel"></button>
        <button id="first-run-reset-button" type="button"></button>
        <button id="settings-about-whats-new-button" type="button"></button>
        <button id="settings-about-copy-info-button" type="button"></button>
        <button id="settings-about-check-updates-button" type="button"></button>
        <strong id="settings-app-version">—</strong>
        <strong id="settings-about-electron-version">—</strong>
        <strong id="settings-about-chrome-version">—</strong>
        <strong id="settings-about-node-version">—</strong>
        <span id="settings-active-section-label"></span>
        <div id="settings-tabs-panel" class="settings-tabs-wrapper" data-open="false">
          <div class="settings-tabs">
            <button class="tab-link active" data-tab="general-settings">
              <i class="fa-solid fa-house"></i>
              <span>Общие</span>
            </button>
            <button class="tab-link" data-tab="window-settings">
              <i class="fa-solid fa-download"></i>
              <span>Downloader</span>
            </button>
            <button class="tab-link" data-tab="about-settings">
              <i class="fa-solid fa-circle-info"></i>
              <span>О приложении</span>
            </button>
          </div>
        </div>
        <div class="tab-content">
          <div id="general-settings" class="tab-pane active"></div>
          <div id="window-settings" class="tab-pane"></div>
          <div id="about-settings" class="tab-pane"></div>
        </div>
      </div>
    `;
  };

  beforeEach(() => {
    jest.resetModules();
    localStorage.clear();
    global.window = global.window || {};
    window.electron = {
      invoke: jest.fn(async (channel) => {
        if (channel === "get-version") return "1.4.4";
        if (channel === "check-app-updates") return { success: true };
        return null;
      }),
      getRuntimeInfo: jest.fn(async () => ({
        electron: "39.0.0",
        chrome: "140.0.0.0",
        node: "22.18.0",
      })),
      getPlatformInfo: jest.fn(async () => ({
        platform: "darwin",
        arch: "arm64",
      })),
    };
    Object.assign(navigator, {
      clipboard: {
        writeText: jest.fn().mockResolvedValue(undefined),
      },
    });
    makeDom();
  });

  test("opens and closes mobile sections panel via toggle", () => {
    jest.isolateModules(() => {
      const mod = require("../settingsModal.js");
      mod.initSettingsModal();
    });

    const toggle = document.getElementById("settings-sections-toggle");
    const wrapper = document.getElementById("settings-tabs-panel");

    toggle.click();
    expect(wrapper.classList.contains("settings-tabs--open")).toBe(true);
    expect(wrapper.dataset.open).toBe("true");
    expect(toggle.getAttribute("aria-expanded")).toBe("true");

    toggle.click();
    expect(wrapper.classList.contains("settings-tabs--open")).toBe(false);
    expect(wrapper.dataset.open).toBe("false");
    expect(toggle.getAttribute("aria-expanded")).toBe("false");
  });

  test("closes mobile panel and updates active label after tab click", () => {
    jest.isolateModules(() => {
      const mod = require("../settingsModal.js");
      mod.initSettingsModal();
    });

    const toggle = document.getElementById("settings-sections-toggle");
    const wrapper = document.getElementById("settings-tabs-panel");
    const nextTab = document.querySelector(
      '.tab-link[data-tab="window-settings"]',
    );
    const label = document.getElementById("settings-active-section-label");

    toggle.click();
    expect(wrapper.classList.contains("settings-tabs--open")).toBe(true);

    nextTab.click();
    expect(wrapper.classList.contains("settings-tabs--open")).toBe(false);
    expect(toggle.getAttribute("aria-expanded")).toBe("false");
    expect(label.textContent).toBe("Downloader");
    expect(localStorage.getItem("lastSettingsTab")).toBe("window-settings");
  });

  test("restores label from saved lastSettingsTab on init", () => {
    localStorage.setItem("lastSettingsTab", "window-settings");

    jest.isolateModules(() => {
      const mod = require("../settingsModal.js");
      mod.initSettingsModal();
    });

    const label = document.getElementById("settings-active-section-label");
    const windowTab = document.querySelector(
      '.tab-link[data-tab="window-settings"]',
    );
    const windowPane = document.getElementById("window-settings");

    expect(windowTab.classList.contains("active")).toBe(true);
    expect(windowPane.classList.contains("active")).toBe(true);
    expect(label.textContent).toBe("Downloader");
  });

  test("restores about label from saved lastSettingsTab on init", () => {
    localStorage.setItem("lastSettingsTab", "about-settings");

    jest.isolateModules(() => {
      const mod = require("../settingsModal.js");
      mod.initSettingsModal();
    });

    const label = document.getElementById("settings-active-section-label");
    const aboutTab = document.querySelector(
      '.tab-link[data-tab="about-settings"]',
    );
    const aboutPane = document.getElementById("about-settings");

    expect(aboutTab.classList.contains("active")).toBe(true);
    expect(aboutPane.classList.contains("active")).toBe(true);
    expect(label.textContent).toBe("О приложении");
  });

  test("openSettings resets mobile panel state and syncs label", () => {
    jest.isolateModules(() => {
      const mod = require("../settingsModal.js");
      const { hideAllTooltips } = require("../tooltipInitializer.js");
      mod.initSettingsModal();
      document.getElementById("settings-sections-toggle").click();
      mod.openSettings();
      expect(hideAllTooltips).toHaveBeenCalled();
    });

    const wrapper = document.getElementById("settings-tabs-panel");
    const toggle = document.getElementById("settings-sections-toggle");
    const label = document.getElementById("settings-active-section-label");
    const modal = document.getElementById("settings-modal");

    expect(modal.style.display).toBe("flex");
    expect(modal.style.justifyContent).toBe("center");
    expect(modal.style.alignItems).toBe("center");
    expect(modal.getAttribute("aria-hidden")).toBe("false");
    expect(document.body.classList.contains("modal-scroll-lock")).toBe(true);
    expect(wrapper.classList.contains("settings-tabs--open")).toBe(false);
    expect(toggle.getAttribute("aria-expanded")).toBe("false");
    expect(label.textContent).toBe("Общие");
  });

  test("closeSettings removes modal scroll lock", () => {
    const closedHandler = jest.fn();
    window.addEventListener("settings:closed", closedHandler);

    jest.isolateModules(() => {
      const mod = require("../settingsModal.js");
      const { hideAllTooltips } = require("../tooltipInitializer.js");
      mod.initSettingsModal();
      mod.openSettings();
      hideAllTooltips.mockClear();
      mod.closeSettings();
      expect(hideAllTooltips).toHaveBeenCalled();
    });

    const modal = document.getElementById("settings-modal");
    expect(modal.style.display).toBe("none");
    expect(modal.getAttribute("aria-hidden")).toBe("true");
    expect(document.body.classList.contains("modal-scroll-lock")).toBe(false);
    expect(closedHandler).toHaveBeenCalledTimes(1);
  });

  test("closeSettings suppresses settings trigger tooltip while focus is restored", async () => {
    jest.isolateModules(() => {
      const mod = require("../settingsModal.js");
      mod.initSettingsModal();
      mod.openSettings();
      mod.closeSettings();
    });

    const trigger = document.getElementById("footer-open-settings");

    expect(document.activeElement).toBe(trigger);
    expect(trigger.dataset.tooltipSuppressed).toBe("true");

    await Promise.resolve();

    expect(trigger.dataset.tooltipSuppressed).toBeUndefined();
  });

  test("opens first-run modal from settings without reload", () => {
    jest.isolateModules(() => {
      const mod = require("../settingsModal.js");
      const { initFirstRunModal } = require("../firstRunModal.js");
      mod.initSettingsModal();
      mod.openSettings();

      document.getElementById("first-run-reset-button").click();

      expect(localStorage.getItem("firstRunCompleted")).toBe("0");
      expect(document.getElementById("settings-modal").style.display).toBe(
        "none",
      );
      expect(initFirstRunModal).toHaveBeenCalled();
    });
  });

  test("populates about section details on init", async () => {
    jest.isolateModules(() => {
      const mod = require("../settingsModal.js");
      mod.initSettingsModal();
    });

    await Promise.resolve();
    await Promise.resolve();

    expect(document.getElementById("settings-app-version")?.textContent).toBe(
      "v1.4.4",
    );
    expect(
      document.getElementById("settings-about-electron-version")?.textContent,
    ).toBe("v39.0.0");
    expect(
      document.getElementById("settings-about-chrome-version")?.textContent,
    ).toBe("v140.0.0.0");
    expect(
      document.getElementById("settings-about-node-version")?.textContent,
    ).toBe("v22.18.0");
  });

  test("copies app info from about section", async () => {
    jest.isolateModules(() => {
      const mod = require("../settingsModal.js");
      mod.initSettingsModal();
    });

    document.getElementById("settings-about-copy-info-button").click();
    await Promise.resolve();
    await Promise.resolve();

    expect(navigator.clipboard.writeText).toHaveBeenCalledWith(
      expect.stringContaining("Thunder Load"),
    );
    expect(window.electron.getPlatformInfo).toHaveBeenCalled();
  });

  test("starts update check from about section and closes settings", async () => {
    jest.isolateModules(() => {
      const mod = require("../settingsModal.js");
      mod.initSettingsModal();
      mod.openSettings();
    });

    document.getElementById("settings-about-check-updates-button").click();
    await Promise.resolve();
    await Promise.resolve();

    expect(window.electron.invoke).toHaveBeenCalledWith("check-app-updates");
    expect(document.getElementById("settings-modal").style.display).toBe(
      "none",
    );
  });

  test("opens whats new from about section via existing version trigger", () => {
    const versionTrigger = document.querySelector(".version-container");
    const clickSpy = jest.spyOn(versionTrigger, "click");

    jest.isolateModules(() => {
      const mod = require("../settingsModal.js");
      mod.initSettingsModal();
    });

    document.getElementById("settings-about-whats-new-button").click();

    expect(clickSpy).toHaveBeenCalledTimes(1);
  });
});
