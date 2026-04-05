describe("pageBackgroundMode", () => {
  beforeEach(() => {
    jest.resetModules();
    document.body.innerHTML = '<div id="main-view"></div>';
    delete document.body.dataset.pageMode;
    delete document.body.dataset.modalMode;
  });

  test("defaults to downloader mode and reacts to tab changes", () => {
    const { initPageBackgroundMode } = require("../pageBackgroundMode.js");

    initPageBackgroundMode();
    expect(document.body.dataset.pageMode).toBe("downloader");

    window.dispatchEvent(
      new CustomEvent("tabs:activated", { detail: { id: "wireguard" } }),
    );
    expect(document.body.dataset.pageMode).toBe("tools");

    window.dispatchEvent(
      new CustomEvent("tabs:activated", { detail: { id: "download" } }),
    );
    expect(document.body.dataset.pageMode).toBe("downloader");
  });

  test("switches to backup mode for the backup tool view and returns to tools", () => {
    const { initPageBackgroundMode } = require("../pageBackgroundMode.js");

    initPageBackgroundMode();
    window.dispatchEvent(
      new CustomEvent("tabs:activated", { detail: { id: "wireguard" } }),
    );

    window.dispatchEvent(
      new CustomEvent("tools:view-changed", {
        detail: { toolView: "backup" },
      }),
    );
    expect(document.body.dataset.pageMode).toBe("backup");

    window.dispatchEvent(
      new CustomEvent("tools:view-changed", {
        detail: { toolView: "hash" },
      }),
    );
    expect(document.body.dataset.pageMode).toBe("tools");
  });

  test("tracks settings modal mode without losing current page mode", () => {
    const { initPageBackgroundMode } = require("../pageBackgroundMode.js");

    initPageBackgroundMode();
    window.dispatchEvent(
      new CustomEvent("tabs:activated", { detail: { id: "wireguard" } }),
    );
    window.dispatchEvent(
      new CustomEvent("tools:view-changed", {
        detail: { toolView: "backup" },
      }),
    );

    window.dispatchEvent(new Event("settings:opened"));
    expect(document.body.dataset.pageMode).toBe("backup");
    expect(document.body.dataset.modalMode).toBe("settings");

    document.documentElement.setAttribute("data-theme", "emerald");
    expect(document.body.dataset.pageMode).toBe("backup");

    window.dispatchEvent(new Event("settings:closed"));
    expect(document.body.dataset.pageMode).toBe("backup");
    expect(document.body.dataset.modalMode).toBeUndefined();
  });
});
