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

jest.mock("../domElements.js", () => ({
  get settingsModal() {
    return global.document.getElementById("settings-modal");
  },
  get settingsButton() {
    return global.document.getElementById("settings-button");
  },
}));

describe("settingsModal mobile sections navigation", () => {
  const makeDom = () => {
    document.body.innerHTML = `
      <button id="settings-button" type="button">open</button>
      <div id="settings-modal" style="display:none">
        <button id="settings-sections-toggle" aria-expanded="false" aria-controls="settings-tabs-panel"></button>
        <button id="first-run-reset-button" type="button"></button>
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
          </div>
        </div>
        <div class="tab-content">
          <div id="general-settings" class="tab-pane active"></div>
          <div id="window-settings" class="tab-pane"></div>
        </div>
      </div>
    `;
  };

  beforeEach(() => {
    jest.resetModules();
    localStorage.clear();
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

  test("openSettings resets mobile panel state and syncs label", () => {
    jest.isolateModules(() => {
      const mod = require("../settingsModal.js");
      mod.initSettingsModal();
      document.getElementById("settings-sections-toggle").click();
      mod.openSettings();
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
    jest.isolateModules(() => {
      const mod = require("../settingsModal.js");
      mod.initSettingsModal();
      mod.openSettings();
      mod.closeSettings();
    });

    const modal = document.getElementById("settings-modal");
    expect(modal.style.display).toBe("none");
    expect(modal.getAttribute("aria-hidden")).toBe("true");
    expect(document.body.classList.contains("modal-scroll-lock")).toBe(false);
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
});
