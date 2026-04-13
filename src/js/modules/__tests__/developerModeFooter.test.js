describe("developerModeFooter", () => {
  beforeEach(() => {
    jest.resetModules();
    localStorage.clear();
    document.body.innerHTML = `
      <footer id="app-footer"></footer>
    `;
  });

  test("keeps app footer visible in developer mode", () => {
    localStorage.setItem("developerToolsUnlocked", "true");

    jest.isolateModules(() => {
      const {
        initDeveloperModeFooterVisibility,
      } = require("../developerModeFooter.js");
      initDeveloperModeFooterVisibility();
    });

    const footer = document.getElementById("app-footer");
    expect(footer.hidden).toBe(false);
    expect(footer.style.display).toBe("");
    expect(footer.dataset.developerModeHidden).toBe("0");
  });

  test("keeps app footer visible when developer mode is disabled", () => {
    localStorage.setItem("developerToolsUnlocked", "true");

    jest.isolateModules(() => {
      const {
        initDeveloperModeFooterVisibility,
      } = require("../developerModeFooter.js");
      const { setDeveloperModeEnabled } = require("../developerMode.js");
      initDeveloperModeFooterVisibility();
      setDeveloperModeEnabled(false);
    });

    const footer = document.getElementById("app-footer");
    expect(footer.hidden).toBe(false);
    expect(footer.style.display).toBe("");
    expect(footer.dataset.developerModeHidden).toBe("0");
  });
});
