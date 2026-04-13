describe("scrollLockRepair", () => {
  beforeEach(() => {
    jest.resetModules();
    document.documentElement.style.overflow = "";
    document.body.className = "";
    document.body.innerHTML = "";
  });

  test("removes stale body scroll lock on refocus when no modal is open", async () => {
    await jest.isolateModulesAsync(async () => {
      const { initScrollLockRepair } = await import("../scrollLockRepair.js");

      document.body.classList.add("modal-scroll-lock");
      initScrollLockRepair();

      window.dispatchEvent(new Event("focus"));

      expect(document.body.classList.contains("modal-scroll-lock")).toBe(false);
    });
  });

  test("keeps body scroll lock when a lock owner is still active", async () => {
    await jest.isolateModulesAsync(async () => {
      const { initScrollLockRepair } = await import("../scrollLockRepair.js");
      const { acquireBodyScrollLock } = await import("../scrollLockManager.js");

      acquireBodyScrollLock("settings-modal");
      document.body.classList.remove("modal-scroll-lock");
      initScrollLockRepair();

      window.dispatchEvent(new Event("focus"));

      expect(document.body.classList.contains("modal-scroll-lock")).toBe(true);
    });
  });

  test("clears stale document overflow lock when no overlay is visible", async () => {
    await jest.isolateModulesAsync(async () => {
      const { initScrollLockRepair } = await import("../scrollLockRepair.js");

      document.documentElement.style.overflow = "hidden";
      initScrollLockRepair();

      document.dispatchEvent(new Event("visibilitychange"));

      expect(document.documentElement.style.overflow).toBe("");
    });
  });

  test("keeps document overflow lock while a lock owner is still active", async () => {
    await jest.isolateModulesAsync(async () => {
      const { initScrollLockRepair } = await import("../scrollLockRepair.js");
      const { acquireDocumentScrollLock } = await import(
        "../scrollLockManager.js"
      );

      acquireDocumentScrollLock("hash-howto");
      document.documentElement.style.overflow = "";
      initScrollLockRepair();

      window.dispatchEvent(new Event("focus"));

      expect(document.documentElement.style.overflow).toBe("hidden");
    });
  });

  test("clears all scroll locks when tools view is hidden", async () => {
    await jest.isolateModulesAsync(async () => {
      const { initScrollLockRepair } = await import("../scrollLockRepair.js");
      const {
        acquireBodyScrollLock,
        acquireDocumentScrollLock,
      } = await import("../scrollLockManager.js");

      acquireBodyScrollLock("settings-modal");
      acquireDocumentScrollLock("hash-howto");
      initScrollLockRepair();

      const toolsView = document.createElement("div");
      document.body.appendChild(toolsView);
      toolsView.dispatchEvent(
        new CustomEvent("tools:view-hidden", { bubbles: true }),
      );

      expect(document.body.classList.contains("modal-scroll-lock")).toBe(false);
      expect(document.documentElement.style.overflow).toBe("");
    });
  });
});
