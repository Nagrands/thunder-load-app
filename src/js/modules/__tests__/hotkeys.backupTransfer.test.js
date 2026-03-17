jest.mock("../settingsModal.js", () => ({
  closeSettings: jest.fn(),
  openSettings: jest.fn(),
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
      <div id="shortcuts-modal" style="display:none"></div>
      <div id="whats-new-modal" style="display:none"></div>
      <div id="confirmation-modal" style="display:none"></div>
      <div id="settings-modal" style="display:none"></div>
      <button id="settings-button" type="button"></button>
      <button id="theme-toggle" type="button"></button>
    `;
  };

  beforeEach(() => {
    jest.resetModules();
    consoleErrorSpy = jest.spyOn(console, "error").mockImplementation(() => {});
    buildDom();
  });

  afterEach(() => {
    consoleErrorSpy?.mockRestore();
  });

  test("routes Ctrl+3 and Meta+3 to the Tools backup entry point", () => {
    const tabs = {
      activateTab: jest.fn(),
    };
    const requestToolsView = jest.fn();

    jest.isolateModules(() => {
      jest.doMock("../toolsNavigation.js", () => ({
        requestToolsView,
      }));
      const { initHotkeys, disableHotkeys } = require("../hotkeys.js");
      initHotkeys(tabs);

      document.dispatchEvent(
        new KeyboardEvent("keydown", { key: "3", ctrlKey: true }),
      );
      document.dispatchEvent(
        new KeyboardEvent("keydown", { key: "3", metaKey: true }),
      );

      disableHotkeys();
    });

    expect(requestToolsView).toHaveBeenNthCalledWith(1, "backup");
    expect(requestToolsView).toHaveBeenNthCalledWith(2, "backup");
    expect(tabs.activateTab).toHaveBeenNthCalledWith(1, "wireguard");
    expect(tabs.activateTab).toHaveBeenNthCalledWith(2, "wireguard");
  });
});
