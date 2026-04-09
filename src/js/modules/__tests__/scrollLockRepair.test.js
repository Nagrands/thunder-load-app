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

  test("keeps body scroll lock when settings modal is still open", async () => {
    await jest.isolateModulesAsync(async () => {
      const { initScrollLockRepair } = await import("../scrollLockRepair.js");

      document.body.innerHTML = `
        <div id="settings-modal" aria-hidden="false" style="display:flex"></div>
      `;
      document.body.classList.add("modal-scroll-lock");
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

  test("keeps document overflow lock while a modal overlay is visible", async () => {
    await jest.isolateModulesAsync(async () => {
      const { initScrollLockRepair } = await import("../scrollLockRepair.js");

      document.body.innerHTML = `
        <div class="modal-overlay" style="display:flex"></div>
      `;
      document.documentElement.style.overflow = "hidden";
      initScrollLockRepair();

      window.dispatchEvent(new Event("focus"));

      expect(document.documentElement.style.overflow).toBe("hidden");
    });
  });
});
