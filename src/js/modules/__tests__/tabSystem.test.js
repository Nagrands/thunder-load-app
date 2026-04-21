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

  test("hides Downloader when developer option is enabled and Tools is available", () => {
    localStorage.setItem("developerToolsUnlocked", "true");
    localStorage.setItem("developerDisableDownloaderTab", "true");
    localStorage.setItem("wgUnlockDisabled", "false");

    const tabs = new TabSystem(".group-menu", "#main-view");
    tabs.addTab("download", "Download", "fa-solid fa-download", () => {
      const el = document.createElement("div");
      el.textContent = "download";
      return el;
    });
    tabs.addTab("wireguard", "Tools", "fa-solid fa-toolbox", () => {
      const el = document.createElement("div");
      el.textContent = "tools";
      return el;
    });

    tabs.activateTab("download");

    expect(
      document.querySelector('[data-menu="download"]')?.style.display,
    ).toBe("none");
    expect(
      document
        .querySelector('[data-menu="wireguard"]')
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

  test("keeps downloader hidden and falls back to products when tools is disabled", () => {
    localStorage.setItem("developerToolsUnlocked", "true");
    localStorage.setItem("developerDisableDownloaderTab", "true");
    localStorage.setItem("wgUnlockDisabled", "true");

    const tabs = new TabSystem(".group-menu", "#main-view");
    tabs.addTab("download", "Download", "fa-solid fa-download", () => {
      const el = document.createElement("div");
      el.textContent = "download";
      return el;
    });
    tabs.addTab("wireguard", "Tools", "fa-solid fa-toolbox", () => {
      const el = document.createElement("div");
      el.textContent = "tools";
      return el;
    });
    tabs.addTab("products", "Products", "fa-solid fa-list", () => {
      const el = document.createElement("div");
      el.textContent = "products";
      return el;
    });

    tabs.activateTab("download");
    window.dispatchEvent(new CustomEvent("wg:toggleDisabled"));

    expect(
      document.querySelector('[data-menu="download"]')?.style.display,
    ).toBe("none");
    expect(
      document.querySelector('[data-menu="wireguard"]')?.style.display,
    ).toBe("none");
    expect(
      document
        .querySelector('[data-menu="products"]')
        ?.classList.contains("active"),
    ).toBe(true);
  });

  test("clears active tab when no visible tabs remain", () => {
    localStorage.setItem("developerToolsUnlocked", "true");
    localStorage.setItem("developerDisableDownloaderTab", "true");

    const tabs = new TabSystem(".group-menu", "#main-view");
    tabs.addTab("download", "Download", "fa-solid fa-download", () => {
      const el = document.createElement("div");
      el.textContent = "download";
      return el;
    });

    tabs.activateTab("download");

    expect(tabs.activeTabId).toBeNull();
    expect(
      document
        .querySelector('[data-menu="download"]')
        ?.classList.contains("active"),
    ).toBe(false);
  });
});
