describe("developerModeSidebar", () => {
  beforeEach(() => {
    jest.resetModules();
    localStorage.clear();
    document.body.innerHTML = `
      <aside id="app-sidebar"></aside>
    `;
  });

  test("keeps app sidebar visible in developer mode", () => {
    localStorage.setItem("developerToolsUnlocked", "true");

    jest.isolateModules(() => {
      const {
        initDeveloperModeSidebarVisibility,
      } = require("../developerModeSidebar.js");
      initDeveloperModeSidebarVisibility();
    });

    const sidebar = document.getElementById("app-sidebar");
    expect(sidebar.hidden).toBe(false);
    expect(sidebar.style.display).toBe("");
    expect(sidebar.dataset.developerModeHidden).toBe("0");
  });

  test("keeps app sidebar visible when developer mode is disabled", () => {
    localStorage.setItem("developerToolsUnlocked", "true");

    jest.isolateModules(() => {
      const {
        initDeveloperModeSidebarVisibility,
      } = require("../developerModeSidebar.js");
      const { setDeveloperModeEnabled } = require("../developerMode.js");
      initDeveloperModeSidebarVisibility();
      setDeveloperModeEnabled(false);
    });

    const sidebar = document.getElementById("app-sidebar");
    expect(sidebar.hidden).toBe(false);
    expect(sidebar.style.display).toBe("");
    expect(sidebar.dataset.developerModeHidden).toBe("0");
  });
});
