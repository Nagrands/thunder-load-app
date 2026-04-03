/** @jest-environment jsdom */

jest.mock("../i18n.js", () => ({
  applyI18n: jest.fn(),
  t: jest.fn((key) => key),
}));

jest.mock("../overlayManager.js", () => ({
  registerDismissibleOverlay: jest.fn(({ isOpen, close, closeOnEscape }) => {
    const handler = (event) => {
      if (!closeOnEscape || event.key !== "Escape" || !isOpen()) return;
      close();
    };
    globalThis.document.addEventListener("keydown", handler);
    return () => globalThis.document.removeEventListener("keydown", handler);
  }),
}));

describe("updateHandler", () => {
  let originalRequestAnimationFrame;

  beforeEach(() => {
    jest.resetModules();
    document.body.innerHTML = `
      <div class="version-container">
        <span id="app-version-label" tabindex="-1">1.0.0</span>
      </div>
    `;
    global.window = global.window || {};
    window.electron = {
      on: jest.fn(),
      invoke: jest.fn(),
    };
    window.innerWidth = 1440;
    window.innerHeight = 900;
    originalRequestAnimationFrame = global.requestAnimationFrame;
    global.requestAnimationFrame = (callback) => {
      callback();
      return 1;
    };
    const anchor = document.getElementById("app-version-label");
    Object.defineProperty(anchor, "getBoundingClientRect", {
      configurable: true,
      value: () => ({
        left: 40,
        top: 760,
        bottom: 790,
        width: 72,
        height: 30,
        right: 112,
      }),
    });
  });

  afterEach(() => {
    document.body.innerHTML = "";
    delete window.electron;
    global.requestAnimationFrame = originalRequestAnimationFrame;
    jest.useRealTimers();
    jest.clearAllMocks();
  });

  function getHandler(eventName) {
    return window.electron.on.mock.calls.find(
      ([registeredEventName]) => registeredEventName === eventName,
    )?.[1];
  }

  test("renders localized update available flyover and focuses primary action", async () => {
    const { initUpdateHandler } = await import("../updateHandler.js");

    initUpdateHandler();
    getHandler("update-available")?.("Update available");

    const flyover = document.querySelector(".upd-flyover");
    expect(flyover).toBeTruthy();
    expect(
      flyover?.querySelector("[data-i18n='update.flyover.available.title']")
        ?.textContent,
    ).toBe("update.flyover.available.title");
    expect(
      flyover?.querySelector("[data-i18n='update.flyover.available.action']")
        ?.textContent,
    ).toBe("update.flyover.available.action");
    expect(document.querySelector(".update-indicator")).toBeTruthy();
    expect(document.activeElement?.id).toBe("upd-start");
    expect(document.querySelector(".upd-flyover")?.dataset.placement).toBe(
      "top",
    );
  });

  test("opens flyover below anchor when there is not enough room above", async () => {
    const { initUpdateHandler } = await import("../updateHandler.js");
    const anchor = document.getElementById("app-version-label");
    Object.defineProperty(anchor, "getBoundingClientRect", {
      configurable: true,
      value: () => ({
        left: 40,
        top: 24,
        bottom: 54,
        width: 72,
        height: 30,
        right: 112,
      }),
    });

    initUpdateHandler();
    getHandler("update-available")?.("Update available");

    expect(document.querySelector(".upd-flyover")?.dataset.placement).toBe(
      "bottom",
    );
  });

  test("shows checking then up-to-date and auto-hides", async () => {
    jest.useFakeTimers();
    const { initUpdateHandler } = await import("../updateHandler.js");

    initUpdateHandler();
    getHandler("update-message")?.("Checking for updates...");
    getHandler("update-message")?.("Обновлений не найдено.");

    expect(document.querySelector(".state-up-to-date")?.style.display).toBe(
      "block",
    );

    jest.advanceTimersByTime(1800);

    expect(document.querySelector(".upd-flyover")?.style.display).toBe("none");
  });

  test("interrupts up-to-date auto-hide when update becomes available", async () => {
    jest.useFakeTimers();
    const { initUpdateHandler } = await import("../updateHandler.js");

    initUpdateHandler();
    getHandler("update-message")?.("Проверка обновлений...");
    getHandler("update-message")?.("Обновлений не найдено.");
    getHandler("update-available-info")?.({
      current: "1.4.4",
      next: "1.4.5",
    });
    getHandler("update-available")?.("Update available");

    jest.advanceTimersByTime(1800);

    expect(document.querySelector(".state-available")?.style.display).toBe(
      "block",
    );
    expect(document.querySelector(".upd-flyover")?.style.display).toBe("block");
  });

  test("starts download from flyover action and switches to progress state", async () => {
    const { initUpdateHandler } = await import("../updateHandler.js");

    window.electron.invoke.mockResolvedValue({ success: true });
    initUpdateHandler();

    getHandler("update-available-info")?.({
      current: "1.4.4",
      next: "1.4.5",
    });
    getHandler("update-available")?.("Update available");

    document.getElementById("upd-start")?.click();
    await Promise.resolve();

    expect(window.electron.invoke).toHaveBeenCalledWith("download-update");
    expect(document.querySelector(".state-progress")?.style.display).toBe(
      "block",
    );
    expect(document.querySelector(".update-indicator")).toBeNull();
    expect(document.getElementById("upd-next-p")?.textContent).toBe("1.4.5");
  });

  test("renders progress details from updater payload", async () => {
    const { initUpdateHandler } = await import("../updateHandler.js");

    initUpdateHandler();
    getHandler("update-available-info")?.({
      current: "1.4.4",
      next: "1.4.5",
    });
    getHandler("update-progress")?.({
      percent: 42.4,
      bytesPerSecond: 1024 * 1024,
      transferred: 42,
      total: 100,
    });

    expect(document.querySelector(".state-progress")?.style.display).toBe(
      "block",
    );
    expect(document.getElementById("upd-bar")?.value).toBe(42.4);
    expect(document.getElementById("upd-label")?.textContent).toMatch(/42%/);
    expect(document.getElementById("upd-label")?.textContent).toMatch(/MB\/s/);
    expect(document.getElementById("upd-next-p")?.textContent).toBe("1.4.5");
  });

  test("compatibility updateProgressBar wrapper opens progress state", async () => {
    const { updateProgressBar } = await import("../updateHandler.js");

    updateProgressBar({ percent: 55, bytesPerSecond: 2048 });

    expect(document.querySelector(".state-progress")?.style.display).toBe(
      "block",
    );
    expect(document.getElementById("upd-bar")?.value).toBe(55);
  });

  test("shows persistent ready badge after update is downloaded", async () => {
    const { initUpdateHandler } = await import("../updateHandler.js");

    initUpdateHandler();
    getHandler("update-downloaded")?.();

    expect(document.querySelector(".upd-ready-badge")?.style.display).toBe(
      "inline-flex",
    );
    expect(document.activeElement?.id).toBe("upd-restart");
  });

  test("reopens done state from ready badge and clears badge on successful restart", async () => {
    const { initUpdateHandler } = await import("../updateHandler.js");

    window.electron.invoke.mockResolvedValue({ success: true });
    initUpdateHandler();
    getHandler("update-downloaded")?.();

    document.querySelector(".upd-ready-badge")?.click();
    expect(document.querySelector(".state-done")?.style.display).toBe("block");

    document.getElementById("upd-restart")?.click();
    await Promise.resolve();

    expect(window.electron.invoke).toHaveBeenCalledWith("restart-app");
    expect(document.querySelector(".upd-ready-badge")?.style.display).toBe(
      "none",
    );
  });

  test("restores ready badge and shows install error when restart fails", async () => {
    const { initUpdateHandler } = await import("../updateHandler.js");

    window.electron.invoke.mockResolvedValue({
      success: false,
      error: "Failed to restart and install update",
    });
    initUpdateHandler();
    getHandler("update-downloaded")?.();

    document.getElementById("upd-restart")?.click();
    await Promise.resolve();

    expect(document.querySelector(".upd-ready-badge")?.style.display).toBe(
      "inline-flex",
    );
    expect(document.getElementById("upd-error-title")?.textContent).toBe(
      "update.flyover.error.install.title",
    );
  });

  test("maps network errors to retryable error state", async () => {
    const { initUpdateHandler } = await import("../updateHandler.js");

    initUpdateHandler();
    getHandler("update-error")?.("Network timeout while checking updates");

    expect(document.getElementById("upd-error-title")?.textContent).toBe(
      "update.flyover.error.network.title",
    );
    expect(document.getElementById("upd-retry")?.style.display).toBe("");
    expect(document.activeElement?.id).toBe("upd-retry");
  });

  test("maps download errors to retryable error state", async () => {
    const { initUpdateHandler } = await import("../updateHandler.js");

    initUpdateHandler();
    getHandler("update-error")?.("Download failed");

    expect(document.getElementById("upd-error-title")?.textContent).toBe(
      "update.flyover.error.download.title",
    );
    expect(document.getElementById("upd-retry")?.style.display).toBe("");
  });

  test("maps install errors to non-retryable error state", async () => {
    const { initUpdateHandler } = await import("../updateHandler.js");

    initUpdateHandler();
    getHandler("update-error")?.("Failed to restart and install update");

    expect(document.getElementById("upd-error-title")?.textContent).toBe(
      "update.flyover.error.install.title",
    );
    expect(document.getElementById("upd-retry")?.style.display).toBe("none");
    expect(document.activeElement?.id).toBe("upd-dismiss");
  });

  test("retries download from error state when update metadata is known", async () => {
    const { initUpdateHandler } = await import("../updateHandler.js");

    window.electron.invoke.mockResolvedValue({ success: true });
    initUpdateHandler();
    getHandler("update-available-info")?.({
      current: "1.4.4",
      next: "1.4.5",
    });
    getHandler("update-error")?.("Download failed");

    document.getElementById("upd-retry")?.click();
    await Promise.resolve();

    expect(window.electron.invoke).toHaveBeenCalledWith("download-update");
    expect(document.querySelector(".state-progress")?.style.display).toBe(
      "block",
    );
  });

  test("closes flyover on Escape", async () => {
    const { initUpdateHandler } = await import("../updateHandler.js");

    initUpdateHandler();
    getHandler("update-available")?.("Update available");

    document.dispatchEvent(new KeyboardEvent("keydown", { key: "Escape" }));

    expect(document.querySelector(".upd-flyover")?.style.display).toBe("none");
  });
});
