describe("topBarResponsive", () => {
  const buildDom = () => {
    document.body.innerHTML = `
      <div class="top-bar">
      </div>
    `;
  };

  beforeEach(() => {
    jest.resetModules();
    document.documentElement.style.removeProperty("--topbar-current-height");
    buildDom();
    const topBar = document.querySelector(".top-bar");
    topBar.getBoundingClientRect = () => ({ height: 88 });
    window.ResizeObserver = class {
      observe() {}
      disconnect() {}
    };
  });

  test("sets --topbar-current-height CSS variable", () => {
    jest.isolateModules(() => {
      const { initTopBarResponsive } = require("../topBarResponsive.js");
      initTopBarResponsive();
    });

    expect(
      document.documentElement.style.getPropertyValue(
        "--topbar-current-height",
      ),
    ).toBe("88px");
  });

  test("updates --topbar-current-height on resize", () => {
    const topBar = document.querySelector(".top-bar");
    topBar.getBoundingClientRect = () => ({ height: 72 });

    jest.isolateModules(() => {
      const { initTopBarResponsive } = require("../topBarResponsive.js");
      initTopBarResponsive();
    });

    topBar.getBoundingClientRect = () => ({ height: 64 });
    window.dispatchEvent(new Event("resize"));

    expect(
      document.documentElement.style.getPropertyValue(
        "--topbar-current-height",
      ),
    ).toBe("64px");
  });

  test("does nothing when top bar is absent", () => {
    document.body.innerHTML = "";

    jest.isolateModules(() => {
      const { initTopBarResponsive } = require("../topBarResponsive.js");
      initTopBarResponsive();
    });

    expect(
      document.documentElement.style.getPropertyValue(
        "--topbar-current-height",
      ),
    ).toBe("");
  });

  test("does not require the removed More overflow controls", () => {
    jest.isolateModules(() => {
      const { initTopBarResponsive } = require("../topBarResponsive.js");
      initTopBarResponsive();
    });

    expect(document.getElementById("topbar-more-toggle")).toBeNull();
    expect(document.getElementById("topbar-overflow-menu")).toBeNull();
    expect(
      document.documentElement.style.getPropertyValue(
        "--topbar-current-height",
      ),
    ).toBe("88px");
  });

  test("darkens window controls after scrolling down and restores them at the top", () => {
    jest.isolateModules(() => {
      const { initTopBarResponsive } = require("../topBarResponsive.js");
      initTopBarResponsive();
    });
    const topBar = document.querySelector(".top-bar");
    Object.defineProperty(window, "scrollY", {
      configurable: true,
      value: 80,
    });
    window.dispatchEvent(new Event("scroll"));
    expect(topBar.classList.contains("is-scrolled")).toBe(true);

    Object.defineProperty(window, "scrollY", {
      configurable: true,
      value: 0,
    });
    window.dispatchEvent(new Event("scroll"));
    expect(topBar.classList.contains("is-scrolled")).toBe(false);
  });
});
