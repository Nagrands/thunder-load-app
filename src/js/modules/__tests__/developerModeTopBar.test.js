describe("developerModeTopBar", () => {
  beforeEach(() => {
    jest.resetModules();
    localStorage.clear();
    document.body.innerHTML = `
      <button id="open-history" type="button"></button>
      <button id="shortcuts-button" type="button"></button>
      <button id="settings-button" type="button"></button>
      <button id="theme-toggle" type="button"></button>
      <button id="open-github" type="button"></button>
    `;
  });

  test("hides configured topbar buttons in developer mode", () => {
    localStorage.setItem("developerToolsUnlocked", "true");

    jest.isolateModules(() => {
      const {
        initDeveloperModeTopBarVisibility,
      } = require("../developerModeTopBar.js");
      initDeveloperModeTopBarVisibility();
    });

    [
      "open-history",
      "shortcuts-button",
      "settings-button",
      "theme-toggle",
      "open-github",
    ].forEach((id) => {
      const el = document.getElementById(id);
      expect(el.hidden).toBe(true);
      expect(el.dataset.topbarSuppressed).toBe("1");
    });
  });

  test("restores topbar buttons when developer mode is disabled", () => {
    localStorage.setItem("developerToolsUnlocked", "true");

    jest.isolateModules(() => {
      const {
        initDeveloperModeTopBarVisibility,
      } = require("../developerModeTopBar.js");
      const { setDeveloperModeEnabled } = require("../developerMode.js");
      initDeveloperModeTopBarVisibility();
      setDeveloperModeEnabled(false);
    });

    expect(document.getElementById("settings-button").hidden).toBe(false);
    expect(document.getElementById("settings-button").dataset.topbarSuppressed).toBe(
      "0",
    );
  });
});
