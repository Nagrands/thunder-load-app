/** @jest-environment jsdom */

describe("sidebarNavigation", () => {
  const initTooltipsMock = jest.fn();

  beforeEach(() => {
    jest.resetModules();
    initTooltipsMock.mockReset();
    localStorage.clear();
    document.body.innerHTML = `
      <div class="top-bar"><div class="top-bar__center">
        <div class="center-menu" role="tablist"><div class="group-menu">
          <button class="menu-item active is-progress-active" data-menu="download" style="--download-tab-progress: 0.42">
            <span class="menu-progress" aria-hidden="true"></span>
            <span class="menu-main"><span class="menu-text">Загрузчик</span><span class="menu-badge" aria-hidden="true">7</span></span>
          </button>
        </div></div>
      </div></div>
      <aside id="app-sidebar" class="app-sidebar">
        <div class="app-sidebar__panel">
          <button id="app-sidebar-toggle"><i class="fa-solid fa-angles-left"></i></button>
          <span id="sidebar-app-version"></span>
          <div id="sidebar-tab-nav" class="app-sidebar__tab-nav" role="navigation"></div>
          <div id="sidebar-tools-status" class="app-sidebar__tools-status downloader-tools-status"></div>
          <div class="app-sidebar__zone--actions">
            <button id="dl-tools-action" type="button"></button>
            <button id="sidebar-open-settings" type="button"></button>
          </div>
        </div>
      </aside>
    `;
    window.electron = { invoke: jest.fn().mockResolvedValue("1.4.4") };
    window.scrollTo = jest.fn();
  });

  async function loadModule() {
    jest.doMock("../tooltipInitializer.js", () => ({
      initTooltips: initTooltipsMock,
    }));
    jest.doMock("../i18n.js", () => ({
      t: (key) =>
        ({
          "tabs.download": "Downloader",
          "tabs.tools": "Tools",
          "topbar.nav": "Section navigation",
          "sidebar.collapseSidebar": "Collapse sidebar",
          "sidebar.expandSidebar": "Expand sidebar",
        })[key] || key,
    }));
    return import("../sidebarNavigation.js");
  }

  test("mounts the existing tab menu permanently in the sidebar and loads app version", async () => {
    const { initSidebarNavigation } = await loadModule();
    initSidebarNavigation();
    await Promise.resolve();

    expect(window.electron.invoke).toHaveBeenCalledWith("get-version");
    expect(document.getElementById("sidebar-app-version").textContent).toBe("v1.4.4");
    expect(document.querySelector("#sidebar-tab-nav .group-menu")).not.toBeNull();
    expect(document.querySelector(".center-menu .group-menu")).toBeNull();
    expect(document.querySelector("#sidebar-tab-nav .group-menu").getAttribute("role")).toBe("tablist");
    expect(document.getElementById("sidebar-tab-nav").getAttribute("aria-hidden")).toBe("false");
    expect(initTooltipsMock).toHaveBeenCalled();
  });

  test("keeps navigation mounted when scrolling", async () => {
    const { initSidebarNavigation } = await loadModule();
    initSidebarNavigation();
    window.dispatchEvent(new Event("scroll"));
    expect(document.querySelector("#sidebar-tab-nav .group-menu")).not.toBeNull();
  });

  test("updates the active section and hides download tools on another tab", async () => {
    const { initSidebarNavigation } = await loadModule();
    initSidebarNavigation();
    window.dispatchEvent(new CustomEvent("tabs:activated", { detail: { id: "wireguard" } }));

    expect(document.getElementById("sidebar-tools-status").classList.contains("is-context-hidden")).toBe(true);
    expect(document.getElementById("dl-tools-action").classList.contains("is-context-hidden")).toBe(true);
  });

  test("keeps footer labels hidden on the Downloader tab", async () => {
    const { initSidebarNavigation } = await loadModule();
    initSidebarNavigation();
    window.dispatchEvent(new CustomEvent("tabs:activated", { detail: { id: "download" } }));
    expect(document.getElementById("footer-active-section")).toBeNull();
    expect(document.getElementById("footer-status-meta")).toBeNull();
  });

  test("honors the tools visibility preference event", async () => {
    const { initSidebarNavigation } = await loadModule();
    initSidebarNavigation();
    window.dispatchEvent(new CustomEvent("tools:visibility", { detail: { hidden: true } }));
    expect(document.getElementById("sidebar-tools-status").classList.contains("is-context-hidden")).toBe(true);
    window.dispatchEvent(new CustomEvent("tools:visibility", { detail: { hidden: false } }));
    expect(document.getElementById("sidebar-tools-status").classList.contains("is-context-hidden")).toBe(false);
  });

  test("keeps the existing footer actions available", async () => {
    const { initSidebarNavigation } = await loadModule();
    initSidebarNavigation();
    expect(document.getElementById("sidebar-open-settings")).toBeTruthy();
    expect(document.getElementById("footer-back-to-top")).toBeNull();
  });

  test("collapses and expands the sidebar and persists the preference", async () => {
    const { initSidebarNavigation } = await loadModule();
    initSidebarNavigation();
    const toggle = document.getElementById("app-sidebar-toggle");
    toggle.click();
    expect(document.body.classList.contains("app-sidebar-collapsed")).toBe(true);
    expect(toggle.getAttribute("aria-expanded")).toBe("false");
    expect(localStorage.getItem("appSidebarCollapsed")).toBe("1");
    expect(toggle.getAttribute("aria-label")).toBe("Expand sidebar");

    toggle.click();
    expect(document.body.classList.contains("app-sidebar-collapsed")).toBe(false);
    expect(toggle.getAttribute("aria-expanded")).toBe("true");
    expect(localStorage.getItem("appSidebarCollapsed")).toBe("0");
  });

  test("restores the collapsed sidebar preference on startup", async () => {
    localStorage.setItem("appSidebarCollapsed", "1");
    const { initSidebarNavigation } = await loadModule();
    initSidebarNavigation();
    expect(document.body.classList.contains("app-sidebar-collapsed")).toBe(true);
    expect(document.getElementById("app-sidebar-toggle").getAttribute("aria-expanded")).toBe("false");
  });
});
