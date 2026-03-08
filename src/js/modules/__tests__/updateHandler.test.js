/** @jest-environment jsdom */

jest.mock("../i18n.js", () => ({
  applyI18n: jest.fn(),
  t: jest.fn((key) => key),
}));

describe("updateHandler", () => {
  beforeEach(() => {
    jest.resetModules();
    document.body.innerHTML = `
      <div class="version-container">
        <span id="app-version-label">1.0.0</span>
      </div>
      <div id="update-progress-container" style="display:block"></div>
    `;
    global.window = global.window || {};
    window.electron = {
      on: jest.fn(),
      invoke: jest.fn(),
    };
  });

  afterEach(() => {
    document.body.innerHTML = "";
    delete window.electron;
    jest.clearAllMocks();
  });

  test("renders localized update available flyover", async () => {
    const { initUpdateHandler } = await import("../updateHandler.js");

    initUpdateHandler();

    const availableHandler = window.electron.on.mock.calls.find(
      ([eventName]) => eventName === "update-available",
    )?.[1];

    expect(typeof availableHandler).toBe("function");
    availableHandler("Update available");

    const flyover = document.querySelector(".upd-flyover");
    expect(flyover).toBeTruthy();
    expect(
      flyover?.querySelector("[data-i18n='update.flyover.available.title']")
        ?.textContent,
    ).toBe("update.flyover.available.title");
    expect(
      flyover?.querySelector("[data-i18n='update.flyover.available.current']")
        ?.textContent,
    ).toBe("update.flyover.available.current");
    expect(
      flyover?.querySelector("[data-i18n='update.flyover.available.next']")
        ?.textContent,
    ).toBe("update.flyover.available.next");
    expect(
      flyover?.querySelector("[data-i18n='update.flyover.available.action']")
        ?.textContent,
    ).toBe("update.flyover.available.action");
    expect(flyover?.querySelector("#upd-close")?.getAttribute("aria-label")).toBe(
      "modal.close",
    );
  });

  test("renders localized downloaded state content", async () => {
    const { initUpdateHandler } = await import("../updateHandler.js");

    initUpdateHandler();

    const downloadedHandler = window.electron.on.mock.calls.find(
      ([eventName]) => eventName === "update-downloaded",
    )?.[1];

    expect(typeof downloadedHandler).toBe("function");
    downloadedHandler();

    const flyover = document.querySelector(".upd-flyover");
    expect(
      flyover?.querySelector("[data-i18n='update.flyover.done.title']")
        ?.textContent,
    ).toBe("update.flyover.done.title");
    expect(
      flyover?.querySelector("[data-i18n='update.flyover.done.body']")
        ?.textContent,
    ).toBe("update.flyover.done.body");
    expect(
      flyover?.querySelector("[data-i18n='update.flyover.done.action']")
        ?.textContent,
    ).toBe("update.flyover.done.action");
  });
});
