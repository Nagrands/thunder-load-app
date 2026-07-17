import TabSystem from "../tabSystem.js";

describe("TabSystem", () => {
  beforeEach(() => {
    localStorage.clear();
    delete window.__thunder_dev_tools_unlocked__;
    document.body.innerHTML = `
      <div class="group-menu"></div>
      <div id="main-view"></div>
    `;
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  test("does not append a tab wrapper into itself when re-rendering an emptied tab", () => {
    const tabs = new TabSystem(".group-menu", "#main-view");
    const wrapper = document.createElement("div");
    wrapper.id = "tools-wrapper";

    const render = jest.fn(() => {
      if (!wrapper.hasChildNodes()) {
        const content = document.createElement("section");
        content.textContent = "tools";
        wrapper.appendChild(content);
      }
      return wrapper;
    });

    tabs.addTab("tools", "Tools", "fa-solid fa-toolbox", render);
    tabs.addTab("other", "Other", "fa-solid fa-circle", () => {
      const el = document.createElement("div");
      el.textContent = "other";
      return el;
    });

    tabs.activateTab("tools");
    expect(wrapper.childNodes).toHaveLength(1);

    wrapper.replaceChildren();
    tabs.activateTab("other");

    expect(() => tabs.activateTab("tools")).not.toThrow();
    expect(render).toHaveBeenCalledTimes(2);
    expect(wrapper.childNodes).toHaveLength(1);
    expect(document.getElementById("main-view").contains(wrapper)).toBe(true);
    expect(
      document
        .querySelector('[data-menu="tools"]')
        ?.querySelector(".menu-progress"),
    ).not.toBeNull();
  });

  test("keeps the latest tab visible after rapid hotkey-style switching", () => {
    jest.useFakeTimers();
    const tabs = new TabSystem(".group-menu", "#main-view");
    const renderTab = (text) => {
      const el = document.createElement("div");
      el.textContent = text;
      return el;
    };

    tabs.addTab("download", "Download", "fa-solid fa-download", () =>
      renderTab("download"),
    );
    tabs.addTab("tools", "Tools", "fa-solid fa-toolbox", () =>
      renderTab("tools"),
    );

    tabs.activateTab("download");
    tabs.activateTab("tools");
    tabs.activateTab("download");
    jest.advanceTimersByTime(tabs.ANIM_MS);

    const downloadView = document.querySelector('[data-tab-id="download"]');
    const toolsView = document.querySelector('[data-tab-id="tools"]');
    expect(tabs.activeTabId).toBe("download");
    expect(downloadView.style.display).not.toBe("none");
    expect(downloadView.classList.contains("tab-show")).toBe(true);
    expect(downloadView.classList.contains("tab-hide")).toBe(false);
    expect(toolsView.style.display).toBe("none");
  });

  test("keeps generated tabs and panels accessible", () => {
    const tabs = new TabSystem(".group-menu", "#main-view");
    tabs.addTab("now-playing", "Now Playing", "fa-solid fa-music", () => {
      const el = document.createElement("section");
      return el;
    });

    tabs.activateTab("now-playing");

    const button = document.querySelector('[data-menu="now-playing"]');
    const panel = document.querySelector('[data-tab-id="now-playing"]');
    expect(button.getAttribute("role")).toBe("tab");
    expect(button.getAttribute("aria-selected")).toBe("true");
    expect(button.getAttribute("aria-controls")).toBe(panel.id);
    expect(panel.getAttribute("role")).toBe("tabpanel");
    expect(panel.getAttribute("aria-labelledby")).toBe(button.id);
    expect(document.body.classList.contains("is-now-playing-active")).toBe(
      true,
    );
  });

  test("keeps Downloader available when legacy developer preference exists", () => {
    localStorage.setItem("developerToolsUnlocked", "true");
    localStorage.setItem("developerDisableDownloaderTab", "true");

    const tabs = new TabSystem(".group-menu", "#main-view");
    tabs.addTab("download", "Download", "fa-solid fa-download", () => {
      const el = document.createElement("div");
      el.textContent = "download";
      return el;
    });
    tabs.activateTab("download");

    expect(
      document.querySelector('[data-menu="download"]')?.style.display,
    ).toBe("");
    expect(
      document
        .querySelector('[data-menu="download"]')
        ?.classList.contains("active"),
    ).toBe(true);
  });

  test("keeps products tab hidden until developer mode is enabled", () => {
    const tabs = new TabSystem(".group-menu", "#main-view");
    tabs.addTab("download", "Download", "fa-solid fa-download", () => {
      const el = document.createElement("div");
      el.textContent = "download";
      return el;
    });
    tabs.addTab("products", "Products", "fa-solid fa-list", () => {
      const el = document.createElement("div");
      el.textContent = "products";
      return el;
    });

    expect(
      document.querySelector('[data-menu="products"]')?.style.display,
    ).toBe("none");

    localStorage.setItem("developerToolsUnlocked", "true");
    window.dispatchEvent(
      new CustomEvent("tools:developer-unlock-changed", {
        detail: { enabled: true },
      }),
    );

    expect(
      document.querySelector('[data-menu="products"]')?.style.display,
    ).toBe("");
  });

  test("falls back from products tab when developer mode is disabled", () => {
    localStorage.setItem("developerToolsUnlocked", "true");

    const tabs = new TabSystem(".group-menu", "#main-view");
    tabs.addTab("download", "Download", "fa-solid fa-download", () => {
      const el = document.createElement("div");
      el.textContent = "download";
      return el;
    });
    tabs.addTab("products", "Products", "fa-solid fa-list", () => {
      const el = document.createElement("div");
      el.textContent = "products";
      return el;
    });

    tabs.activateTab("products");
    expect(
      document
        .querySelector('[data-menu="products"]')
        ?.classList.contains("active"),
    ).toBe(true);

    localStorage.setItem("developerToolsUnlocked", "false");
    window.dispatchEvent(
      new CustomEvent("tools:developer-unlock-changed", {
        detail: { enabled: false },
      }),
    );

    expect(
      document.querySelector('[data-menu="products"]')?.style.display,
    ).toBe("none");
    expect(
      document
        .querySelector('[data-menu="download"]')
        ?.classList.contains("active"),
    ).toBe(true);
  });
});
