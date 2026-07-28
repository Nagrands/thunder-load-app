jest.mock("../settingsModal.js", () => ({
  closeSettings: jest.fn(),
  openSettings: jest.fn(),
  openSettingsWithTab: jest.fn(),
  updateThemeDropdownUI: jest.fn(),
}));

jest.mock("../settingsStore.js", () => ({
  setTheme: jest.fn().mockResolvedValue("dark"),
}));

jest.mock("../toast.js", () => ({
  showToast: jest.fn(),
}));

jest.mock("../i18n.js", () => ({
  t: (key) => key,
}));

jest.mock("../modalManager.js", () => ({
  closeAllModals: jest.fn(),
}));

describe("hotkeys backup transfer", () => {
  let consoleErrorSpy;

  const buildDom = () => {
    document.body.innerHTML = `
      <button id="download-button" type="button"></button>
      <button id="open-folder" type="button"></button>
      <button id="open-history" type="button"></button>
      <button id="open-last-video" type="button"></button>
      <button id="clear-history" type="button"></button>
      <div id="whats-new-modal" style="display:none"></div>
      <div id="confirmation-modal" style="display:none"></div>
      <div id="settings-modal" style="display:none"></div>
      <button id="settings-button" type="button"></button>
      <button id="theme-toggle" type="button"></button>
    `;
  };

  beforeEach(() => {
    jest.resetModules();
    jest.clearAllMocks();
    consoleErrorSpy = jest.spyOn(console, "error").mockImplementation(() => {});
    buildDom();
    window.electron = {
      invoke: jest.fn(async (channel) => {
        if (channel !== "shortcuts:get") return null;
        return {
          success: true,
          catalog: [],
          assignments: {
            "navigation.backup": "CommandOrControl+3",
            "settings.open": "CommandOrControl+,",
          },
        };
      }),
      on: jest.fn(),
    };
  });

  afterEach(() => {
    consoleErrorSpy?.mockRestore();
  });

  test("routes Ctrl+3 but not Meta+3 on Windows/Linux", async () => {
    const tabs = {
      activateTab: jest.fn(),
    };
    const requestToolsView = jest.fn();
    let hotkeysModule;

    jest.isolateModules(() => {
      jest.doMock("../toolsNavigation.js", () => ({
        requestToolsView,
      }));
      hotkeysModule = require("../hotkeys.js");
      hotkeysModule.initHotkeys(tabs);
    });

    await Promise.resolve();
    document.dispatchEvent(
      new KeyboardEvent("keydown", { key: "3", ctrlKey: true }),
    );
    document.dispatchEvent(
      new KeyboardEvent("keydown", { key: "3", metaKey: true }),
    );
    hotkeysModule.disableHotkeys();

    expect(requestToolsView).toHaveBeenCalledTimes(1);
    expect(requestToolsView).toHaveBeenCalledWith("backup");
    expect(tabs.activateTab).toHaveBeenCalledTimes(1);
    expect(tabs.activateTab).toHaveBeenCalledWith("wireguard");
  });

  test("Ctrl+, toggles settings through its lifecycle", async () => {
    const settingsModal = document.getElementById("settings-modal");
    const settingsLifecycle = require("../settingsModal.js");
    const modalManager = require("../modalManager.js");
    let hotkeysModule;

    jest.isolateModules(() => {
      hotkeysModule = require("../hotkeys.js");
      hotkeysModule.initHotkeys({ activateTab: jest.fn() });
    });

    await Promise.resolve();
    settingsModal.style.display = "flex";
    document.dispatchEvent(
      new KeyboardEvent("keydown", { key: ",", ctrlKey: true }),
    );

    expect(settingsLifecycle.closeSettings).toHaveBeenCalledTimes(1);
    expect(settingsLifecycle.openSettings).not.toHaveBeenCalled();
    expect(modalManager.closeAllModals).not.toHaveBeenCalled();

    settingsModal.style.display = "none";
    document.dispatchEvent(
      new KeyboardEvent("keydown", { key: ",", ctrlKey: true }),
    );
    hotkeysModule.disableHotkeys();

    expect(modalManager.closeAllModals).toHaveBeenCalledTimes(1);
    expect(settingsLifecycle.openSettings).toHaveBeenCalledTimes(1);
  });
});
