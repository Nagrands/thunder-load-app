describe("topBarResponsive", () => {
  const buildDom = () => {
    document.body.innerHTML = `
      <div class="top-bar">
        <div class="top-bar__right-group">
          <button id="shortcuts-button" type="button"></button>
          <button id="open-github" type="button"></button>
          <button id="reload-app" type="button"></button>
          <button id="topbar-more-toggle" type="button" aria-expanded="false" aria-controls="topbar-overflow-menu"></button>
          <div id="topbar-overflow-menu" hidden>
            <button class="topbar-overflow__item" data-proxy-target="#shortcuts-button"></button>
            <button class="topbar-overflow__item" data-proxy-target="#open-github"></button>
            <button class="topbar-overflow__item" data-proxy-target="#reload-app"></button>
          </div>
        </div>
      </div>
    `;
  };

  beforeEach(() => {
    jest.resetModules();
    buildDom();
    const topBar = document.querySelector(".top-bar");
    topBar.getBoundingClientRect = () => ({ height: 88 });
    window.ResizeObserver = class {
      observe() {}
      disconnect() {}
    };
  });

  test("opens and closes overflow by toggle", () => {
    jest.isolateModules(() => {
      const { initTopBarResponsive } = require("../topBarResponsive.js");
      initTopBarResponsive();
    });

    const toggle = document.getElementById("topbar-more-toggle");
    const menu = document.getElementById("topbar-overflow-menu");

    toggle.click();
    expect(menu.hidden).toBe(false);
    expect(toggle.getAttribute("aria-expanded")).toBe("true");

    toggle.click();
    expect(menu.hidden).toBe(true);
    expect(toggle.getAttribute("aria-expanded")).toBe("false");
  });

  test("closes overflow on Escape", () => {
    jest.isolateModules(() => {
      const { initTopBarResponsive } = require("../topBarResponsive.js");
      initTopBarResponsive();
    });

    const toggle = document.getElementById("topbar-more-toggle");
    const menu = document.getElementById("topbar-overflow-menu");
    toggle.click();
    expect(menu.hidden).toBe(false);

    document.dispatchEvent(new KeyboardEvent("keydown", { key: "Escape" }));
    expect(menu.hidden).toBe(true);
  });

  test("clicking proxy item triggers target click", () => {
    const target = document.getElementById("shortcuts-button");
    const targetSpy = jest.fn();
    target.addEventListener("click", targetSpy);

    jest.isolateModules(() => {
      const { initTopBarResponsive } = require("../topBarResponsive.js");
      initTopBarResponsive();
    });

    const toggle = document.getElementById("topbar-more-toggle");
    const firstProxy = document.querySelector(
      '#topbar-overflow-menu [data-proxy-target="#shortcuts-button"]',
    );

    toggle.click();
    firstProxy.click();

    expect(targetSpy).toHaveBeenCalledTimes(1);
    expect(document.getElementById("topbar-overflow-menu").hidden).toBe(true);
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

  test("does not surface suppressed actions in overflow", () => {
    const target = document.getElementById("open-github");
    target.hidden = true;
    target.dataset.topbarSuppressed = "1";

    jest.isolateModules(() => {
      const { initTopBarResponsive } = require("../topBarResponsive.js");
      initTopBarResponsive();
    });

    const proxy = document.querySelector(
      '#topbar-overflow-menu [data-proxy-target="#open-github"]',
    );

    expect(proxy.hidden).toBe(true);
    expect(proxy.disabled).toBe(true);
  });
});
