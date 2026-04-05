/** @jest-environment jsdom */

describe("footerStatusBar", () => {
  const initTooltipsMock = jest.fn();
  let intersectionObservers;

  function setScrollPosition(value) {
    Object.defineProperty(window, "scrollY", {
      value,
      configurable: true,
      writable: true,
    });
    Object.defineProperty(window, "pageYOffset", {
      value,
      configurable: true,
      writable: true,
    });
  }

  beforeEach(() => {
    jest.resetModules();
    jest.useFakeTimers();
    initTooltipsMock.mockReset();
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
              <div
                id="footer-tools-status"
                class="app-footer__tools-status downloader-tools-status"
              ></div>
            </div>
            <div id="footer-tab-nav" hidden></div>
          </div>
          <div class="app-footer__zone app-footer__zone--actions">
            <button id="dl-tools-reinstall" type="button"></button>
            <button id="open-history" type="button"></button>
            <button id="footer-open-settings" type="button"></button>
            <button id="footer-back-to-top" type="button" hidden></button>
          </div>
        </div>
      </footer>

      <div id="nav-visibility-sentinel"></div>
      <div class="group-menu">
        <button
          class="menu-item active is-progress-active"
          data-menu="download"
          style="--download-tab-progress: 0.42"
        >
          <span class="menu-progress" aria-hidden="true"></span>
          <span class="menu-main">
            <span class="menu-text">Загрузчик</span>
            <span class="menu-badge" aria-hidden="true">7</span>
          </span>
        </button>
      </div>
    `;

    document.querySelector(".center-menu").appendChild(
      document.querySelector(".group-menu"),
    );

    global.window = global.window || {};
    window.electron = {
      invoke: jest.fn(),
    };
    window.scrollTo = jest.fn();
    setScrollPosition(0);
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

  afterEach(() => {
    jest.useRealTimers();
  });

  async function loadModule() {
    jest.doMock("../tooltipInitializer.js", () => ({
      initTooltips: initTooltipsMock,
    }));
    jest.doMock("../i18n.js", () => ({
      t: (key) => {
        const map = {
          "tabs.download": "Downloader",
          "tabs.tools": "Tools",
          "footer.sectionLabel": "Section",
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

    expect(window.electron.invoke).toHaveBeenCalledWith("get-version");
    expect(version.textContent).toBe("v1.4.4");
    expect(section.textContent).toBe("Downloader");
    expect(document.querySelector(".center-menu .group-menu")).not.toBeNull();
    expect(
      document
        .getElementById("footer-tools-status")
        .classList.contains("is-context-hidden"),
    ).toBe(false);
    expect(
      document
        .getElementById("dl-tools-reinstall")
        .classList.contains("is-context-hidden"),
    ).toBe(false);
    expect(
      document.getElementById("footer-tab-nav").classList.contains("is-hidden"),
    ).toBe(true);
    expect(
      document
        .getElementById("footer-back-to-top")
        .classList.contains("is-hidden"),
    ).toBe(true);
    expect(initTooltipsMock).toHaveBeenCalled();
  });

  test("moves group-menu into footer when sentinel leaves top viewport", async () => {
    window.electron.invoke.mockResolvedValue("1.4.4");
    const { initFooterStatusBar } = await loadModule();

    initFooterStatusBar();
    await Promise.resolve();

    const observer = intersectionObservers[0];
    setScrollPosition(48);
    observer.callback([{ boundingClientRect: { top: 40 } }]);
    jest.advanceTimersByTime(95);

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
    expect(
      document
        .getElementById("footer-tools-status")
        .classList.contains("is-context-hidden"),
    ).toBe(true);
    expect(
      document
        .getElementById("dl-tools-reinstall")
        .classList.contains("is-context-hidden"),
    ).toBe(true);
    expect(document.getElementById("app-footer").classList.contains("app-footer--nav-mode")).toBe(true);
    const downloadTab = document.querySelector(
      '#footer-tab-nav [data-menu="download"]',
    );
    expect(downloadTab?.style.getPropertyValue("--download-tab-progress")).toBe(
      "0.42",
    );
    expect(downloadTab?.classList.contains("is-progress-active")).toBe(true);
  });

  test("moves group-menu back to top bar when returning to top", async () => {
    window.electron.invoke.mockResolvedValue("1.4.4");
    const { initFooterStatusBar } = await loadModule();

    initFooterStatusBar();
    await Promise.resolve();

    const observer = intersectionObservers[0];
    setScrollPosition(48);
    observer.callback([{ boundingClientRect: { top: 40 } }]);
    jest.advanceTimersByTime(95);
    setScrollPosition(0);
    observer.callback([{ boundingClientRect: { top: 140 } }]);
    jest.advanceTimersByTime(95);

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
    expect(
      document
        .getElementById("footer-tools-status")
        .classList.contains("is-context-hidden"),
    ).toBe(false);
    expect(
      document
        .getElementById("dl-tools-reinstall")
        .classList.contains("is-context-hidden"),
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
    expect(
      document
        .getElementById("footer-tools-status")
        .classList.contains("is-context-hidden"),
    ).toBe(true);
    expect(
      document
        .getElementById("dl-tools-reinstall")
        .classList.contains("is-context-hidden"),
    ).toBe(true);
  });

  test("hides footer tools block when settings toggle broadcasts hidden state", async () => {
    window.electron.invoke.mockResolvedValue("1.4.4");
    const { initFooterStatusBar } = await loadModule();

    initFooterStatusBar();
    await Promise.resolve();

    const tools = document.getElementById("footer-tools-status");
    const reinstall = document.getElementById("dl-tools-reinstall");
    window.dispatchEvent(
      new CustomEvent("tools:visibility", { detail: { hidden: true } }),
    );

    expect(tools.classList.contains("is-context-hidden")).toBe(true);
    expect(reinstall.classList.contains("is-context-hidden")).toBe(true);

    window.dispatchEvent(
      new CustomEvent("tools:visibility", { detail: { hidden: false } }),
    );

    expect(tools.classList.contains("is-context-hidden")).toBe(false);
    expect(reinstall.classList.contains("is-context-hidden")).toBe(false);
  });

  test("opens settings from the footer action", async () => {
    window.electron.invoke.mockResolvedValue("1.4.4");
    const { initFooterStatusBar } = await loadModule();

    initFooterStatusBar();
    await Promise.resolve();
    document.getElementById("footer-open-settings").click();

    expect(document.getElementById("footer-open-settings")).toBeTruthy();
  });

  test("renders history action before settings in the footer", async () => {
    window.electron.invoke.mockResolvedValue("1.4.4");
    const { initFooterStatusBar } = await loadModule();

    initFooterStatusBar();
    await Promise.resolve();

    expect(document.getElementById("open-history")).toBeTruthy();
    expect(
      document.querySelector(".app-footer__zone--actions")?.firstElementChild?.id,
    ).toBe("dl-tools-reinstall");
  });

  test("scrolls smoothly to top from footer action", async () => {
    window.electron.invoke.mockResolvedValue("1.4.4");
    const { initFooterStatusBar } = await loadModule();

    initFooterStatusBar();
    await Promise.resolve();
    setScrollPosition(48);
    intersectionObservers[0].callback([{ boundingClientRect: { top: 40 } }]);
    jest.advanceTimersByTime(95);
    document.getElementById("footer-back-to-top").click();

    expect(window.scrollTo).toHaveBeenCalledWith({
      top: 0,
      behavior: "smooth",
    });
  });

  test("keeps footer controller stable when IntersectionObserver is unavailable", async () => {
    window.IntersectionObserver = undefined;
    window.electron.invoke.mockResolvedValue("1.4.4");
    setScrollPosition(20);
    const { initFooterStatusBar } = await loadModule();

    expect(() => initFooterStatusBar()).not.toThrow();
    await Promise.resolve();
    expect(() => window.dispatchEvent(new Event("scroll"))).not.toThrow();
    jest.advanceTimersByTime(95);
  });

  test("does not switch modes while sentinel stays inside hysteresis band", async () => {
    window.electron.invoke.mockResolvedValue("1.4.4");
    const { initFooterStatusBar } = await loadModule();

    initFooterStatusBar();
    await Promise.resolve();

    const observer = intersectionObservers[0];
    setScrollPosition(8);
    observer.callback([{ boundingClientRect: { top: 75 } }]);
    jest.advanceTimersByTime(120);

    expect(document.querySelector(".center-menu .group-menu")).not.toBeNull();
    expect(document.querySelector("#footer-tab-nav .group-menu")).toBeNull();
  });
});
