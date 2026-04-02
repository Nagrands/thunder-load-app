/** @jest-environment jsdom */

describe("footerStatusBar", () => {
  const initTooltipsMock = jest.fn();
  const onSettingsChangeMock = jest.fn();
  let intersectionObservers;

  beforeEach(() => {
    jest.resetModules();
    initTooltipsMock.mockReset();
    onSettingsChangeMock.mockReset();
    intersectionObservers = [];

    document.body.innerHTML = `
      <div class="top-bar">
        <div class="top-bar__center">
          <div class="center-menu"></div>
        </div>
      </div>

      <footer id="app-footer" class="app-footer">
        <div class="app-footer__bar">
          <div class="app-footer__zone app-footer__zone--lead">
            <div id="app-version-label" class="app-footer__context version-container">
              <span id="footer-app-version"></span>
            </div>
          </div>
          <div class="app-footer__zone app-footer__zone--center">
            <div id="footer-status-cluster">
              <div class="app-footer__zone app-footer__zone--status">
                <span id="footer-status-meta" class="app-footer__status-meta"></span>
                <strong id="footer-active-section" class="app-footer__status-value"></strong>
              </div>
              <div class="app-footer__zone app-footer__zone--status">
                <span class="app-footer__status-meta"></span>
                <strong id="footer-theme-value" class="app-footer__status-value"></strong>
              </div>
            </div>
            <div id="footer-tab-nav" hidden></div>
          </div>
          <div class="app-footer__zone app-footer__zone--actions">
            <button id="footer-open-settings" type="button"></button>
            <button id="footer-back-to-top" type="button" hidden></button>
          </div>
        </div>
      </footer>

      <div id="nav-visibility-sentinel"></div>
      <div class="group-menu">
        <button class="menu-item active" data-menu="download">
          <span class="menu-text">Загрузчик</span>
        </button>
      </div>
      <button id="settings-button" type="button"></button>
    `;

    document.querySelector(".center-menu").appendChild(
      document.querySelector(".group-menu"),
    );

    global.window = global.window || {};
    window.electron = {
      invoke: jest.fn(),
    };
    window.scrollTo = jest.fn();
    window.IntersectionObserver = class {
      constructor(callback, options) {
        this.callback = callback;
        this.options = options;
        this.observe = jest.fn();
        this.disconnect = jest.fn();
        intersectionObservers.push(this);
      }
    };
    document.documentElement.setAttribute("data-theme", "emerald");

    const topBar = document.querySelector(".top-bar");
    topBar.getBoundingClientRect = () => ({ height: 88 });
    const sentinel = document.getElementById("nav-visibility-sentinel");
    sentinel.getBoundingClientRect = jest.fn(() => ({ top: 120 }));
  });

  async function loadModule() {
    jest.doMock("../domElements.js", () => ({
      settingsButton: document.getElementById("settings-button"),
    }));
    jest.doMock("../settingsStore.js", () => ({
      onChange: onSettingsChangeMock,
    }));
    jest.doMock("../tooltipInitializer.js", () => ({
      initTooltips: initTooltipsMock,
    }));
    jest.doMock("../i18n.js", () => ({
      t: (key) => {
        const map = {
          "tabs.download": "Downloader",
          "tabs.tools": "Tools",
          "footer.sectionLabel": "Section",
          "settings.appearance.theme.emerald": "Emerald",
          "settings.appearance.theme.midnight": "Midnight",
        };
        return map[key] || key;
      },
    }));

    return import("../footerStatusBar.js");
  }

  test("loads and renders global footer state in top mode", async () => {
    window.electron.invoke.mockResolvedValue("1.4.4");
    const { initFooterStatusBar } = await loadModule();

    initFooterStatusBar();
    await Promise.resolve();

    const version = document.getElementById("footer-app-version");
    const section = document.getElementById("footer-active-section");
    const theme = document.getElementById("footer-theme-value");

    expect(window.electron.invoke).toHaveBeenCalledWith("get-version");
    expect(version.textContent).toBe("v1.4.4");
    expect(section.textContent).toBe("Downloader");
    expect(theme.textContent).toBe("Emerald");
    expect(document.querySelector(".center-menu .group-menu")).not.toBeNull();
    expect(
      document.getElementById("footer-tab-nav").classList.contains("is-hidden"),
    ).toBe(true);
    expect(
      document
        .getElementById("footer-back-to-top")
        .classList.contains("is-hidden"),
    ).toBe(true);
    expect(onSettingsChangeMock).toHaveBeenCalledWith(
      "theme",
      expect.any(Function),
    );
    expect(initTooltipsMock).toHaveBeenCalled();
  });

  test("moves group-menu into footer when sentinel leaves top viewport", async () => {
    window.electron.invoke.mockResolvedValue("1.4.4");
    const { initFooterStatusBar } = await loadModule();

    initFooterStatusBar();
    await Promise.resolve();

    const observer = intersectionObservers[0];
    observer.callback([{ isIntersecting: false }]);

    expect(document.querySelector("#footer-tab-nav .group-menu")).not.toBeNull();
    expect(document.querySelector(".center-menu .group-menu")).toBeNull();
    expect(
      document.getElementById("footer-tab-nav").classList.contains("is-hidden"),
    ).toBe(false);
    expect(
      document
        .getElementById("footer-back-to-top")
        .classList.contains("is-hidden"),
    ).toBe(false);
    expect(
      document
        .getElementById("footer-status-cluster")
        .classList.contains("is-hidden"),
    ).toBe(true);
    expect(document.getElementById("app-footer").classList.contains("app-footer--nav-mode")).toBe(true);
  });

  test("moves group-menu back to top bar when returning to top", async () => {
    window.electron.invoke.mockResolvedValue("1.4.4");
    const { initFooterStatusBar } = await loadModule();

    initFooterStatusBar();
    await Promise.resolve();

    const observer = intersectionObservers[0];
    observer.callback([{ isIntersecting: false }]);
    observer.callback([{ isIntersecting: true }]);

    expect(document.querySelector(".center-menu .group-menu")).not.toBeNull();
    expect(document.querySelector("#footer-tab-nav .group-menu")).toBeNull();
    expect(
      document.getElementById("footer-tab-nav").classList.contains("is-hidden"),
    ).toBe(true);
    expect(
      document
        .getElementById("footer-back-to-top")
        .classList.contains("is-hidden"),
    ).toBe(true);
    expect(
      document
        .getElementById("footer-status-cluster")
        .classList.contains("is-hidden"),
    ).toBe(false);
  });

  test("updates the active section when tab changes", async () => {
    window.electron.invoke.mockResolvedValue("1.4.4");
    const { initFooterStatusBar } = await loadModule();

    initFooterStatusBar();
    await Promise.resolve();
    window.dispatchEvent(
      new CustomEvent("tabs:activated", { detail: { id: "wireguard" } }),
    );

    const section = document.getElementById("footer-active-section");
    expect(section.textContent).toBe("Tools");
    expect(section.getAttribute("title")).toBe("Tools");
  });

  test("updates theme label through settings-store subscription", async () => {
    let themeHandler = null;
    onSettingsChangeMock.mockImplementation((_type, handler) => {
      themeHandler = handler;
    });
    window.electron.invoke.mockResolvedValue("1.4.4");
    const { initFooterStatusBar } = await loadModule();

    initFooterStatusBar();
    await Promise.resolve();
    document.documentElement.setAttribute("data-theme", "midnight");
    themeHandler();

    const theme = document.getElementById("footer-theme-value");
    expect(theme.textContent).toBe("Midnight");
  });

  test("opens settings from the footer action", async () => {
    window.electron.invoke.mockResolvedValue("1.4.4");
    const { initFooterStatusBar } = await loadModule();

    const settingsButton = document.getElementById("settings-button");
    const clickSpy = jest.spyOn(settingsButton, "click");
    initFooterStatusBar();
    await Promise.resolve();
    document.getElementById("footer-open-settings").click();

    expect(clickSpy).toHaveBeenCalledTimes(1);
  });

  test("scrolls smoothly to top from footer action", async () => {
    window.electron.invoke.mockResolvedValue("1.4.4");
    const { initFooterStatusBar } = await loadModule();

    initFooterStatusBar();
    await Promise.resolve();
    intersectionObservers[0].callback([{ isIntersecting: false }]);
    document.getElementById("footer-back-to-top").click();

    expect(window.scrollTo).toHaveBeenCalledWith({
      top: 0,
      behavior: "smooth",
    });
  });

  test("falls back to scroll calculations when IntersectionObserver is unavailable", async () => {
    delete window.IntersectionObserver;
    window.electron.invoke.mockResolvedValue("1.4.4");
    const sentinel = document.getElementById("nav-visibility-sentinel");
    sentinel.getBoundingClientRect = jest.fn(() => ({ top: 20 }));
    const { initFooterStatusBar } = await loadModule();

    initFooterStatusBar();
    await Promise.resolve();
    window.dispatchEvent(new Event("scroll"));

    expect(document.querySelector("#footer-tab-nav .group-menu")).not.toBeNull();
    expect(
      document
        .getElementById("footer-back-to-top")
        .classList.contains("is-hidden"),
    ).toBe(false);
  });
});
