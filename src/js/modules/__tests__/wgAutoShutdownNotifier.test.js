/** @jest-environment jsdom */

jest.mock("../toast.js", () => ({
  showToast: jest.fn(),
}));

jest.mock("../i18n.js", () => ({
  t: jest.fn((key) => key),
}));

jest.mock("../domElements.js", () => ({
  toastContainer: null,
}));

const flush = async () => {
  await Promise.resolve();
  await Promise.resolve();
};

describe("wgAutoShutdownNotifier", () => {
  beforeEach(() => {
    jest.resetModules();
    jest.useFakeTimers();
    document.body.innerHTML = `
      <div id="toast-container"></div>
      <input id="wg-autosend" type="checkbox" checked />
    `;
    global.window = global.window || {};
    window.electron = {
      invoke: jest.fn(async (channel) => {
        if (channel === "get-auto-shutdown-status") return true;
        if (channel === "get-auto-shutdown-seconds") return 30;
        if (channel === "get-auto-shutdown-deadline") return Date.now() + 30000;
        if (channel === "set-auto-shutdown-status") return true;
        return null;
      }),
      on: jest.fn(),
    };
  });

  afterEach(() => {
    jest.clearAllTimers();
    jest.useRealTimers();
    document.body.innerHTML = "";
    delete window.electron;
    jest.clearAllMocks();
  });

  test("renders localized auto-shutdown toast content", async () => {
    const { initWgAutoShutdownNotifier } =
      await import("../wgAutoShutdownNotifier.js");

    initWgAutoShutdownNotifier({ autosend: true });
    await flush();

    const toast = document.querySelector(".toast-autoshutdown");
    expect(toast).toBeTruthy();
    expect(toast?.querySelector(".toast-title")?.textContent).toBe(
      "wg.autoShutdown.toast.title",
    );
    expect(toast?.querySelector(".toast-message")?.textContent).toContain(
      "wg.autoShutdown.toast.body",
    );
    expect(toast?.querySelector(".toast-action-btn")?.textContent.trim()).toBe(
      "wg.autoShutdown.toast.cancel",
    );
    expect(
      toast?.querySelector(".toast-close")?.getAttribute("aria-label"),
    ).toBe("toast.close");
  });

  test("uses localized success toast after cancel", async () => {
    const { showToast } = require("../toast.js");
    const { initWgAutoShutdownNotifier } =
      await import("../wgAutoShutdownNotifier.js");

    initWgAutoShutdownNotifier({ autosend: true });
    await flush();

    document.querySelector(".toast-action-btn")?.click();
    await flush();

    expect(showToast).toHaveBeenCalledWith(
      "wg.autoShutdown.toast.cancelled",
      "success",
    );
  });
});
