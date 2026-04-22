describe("scrollLockManager", () => {
  beforeEach(() => {
    jest.resetModules();
    document.body.className = "";
    document.documentElement.style.overflow = "";
  });

  test("keeps body lock until the last owner releases it", async () => {
    await jest.isolateModulesAsync(async () => {
      const { acquireBodyScrollLock, releaseBodyScrollLock } =
        await import("../scrollLockManager.js");

      acquireBodyScrollLock("settings");
      acquireBodyScrollLock("quality");
      releaseBodyScrollLock("settings");

      expect(document.body.classList.contains("modal-scroll-lock")).toBe(true);
      expect(document.body.classList.contains("modal-overlay-active")).toBe(
        true,
      );

      releaseBodyScrollLock("quality");

      expect(document.body.classList.contains("modal-scroll-lock")).toBe(false);
      expect(document.body.classList.contains("modal-overlay-active")).toBe(
        false,
      );
    });
  });

  test("does not break on repeated acquire for the same owner", async () => {
    await jest.isolateModulesAsync(async () => {
      const { acquireDocumentScrollLock, releaseDocumentScrollLock } =
        await import("../scrollLockManager.js");

      acquireDocumentScrollLock("hash-howto");
      acquireDocumentScrollLock("hash-howto");
      releaseDocumentScrollLock("hash-howto");

      expect(document.documentElement.style.overflow).toBe("");
      expect(document.body.classList.contains("modal-overlay-active")).toBe(
        false,
      );
    });
  });

  test("supports body and document locks independently", async () => {
    await jest.isolateModulesAsync(async () => {
      const {
        acquireBodyScrollLock,
        releaseBodyScrollLock,
        acquireDocumentScrollLock,
        releaseDocumentScrollLock,
      } = await import("../scrollLockManager.js");

      acquireBodyScrollLock("settings");
      acquireDocumentScrollLock("hash-howto");

      releaseBodyScrollLock("settings");
      expect(document.body.classList.contains("modal-scroll-lock")).toBe(false);
      expect(document.body.classList.contains("modal-overlay-active")).toBe(
        true,
      );
      expect(document.documentElement.style.overflow).toBe("hidden");

      releaseDocumentScrollLock("hash-howto");
      expect(document.documentElement.style.overflow).toBe("");
      expect(document.body.classList.contains("modal-overlay-active")).toBe(
        false,
      );
    });
  });

  test("repair and clear keep DOM synchronized with owner state", async () => {
    await jest.isolateModulesAsync(async () => {
      const { acquireBodyScrollLock, repairScrollLocks, clearAllScrollLocks } =
        await import("../scrollLockManager.js");

      acquireBodyScrollLock("settings");
      document.body.classList.remove("modal-scroll-lock");
      repairScrollLocks();

      expect(document.body.classList.contains("modal-scroll-lock")).toBe(true);
      expect(document.body.classList.contains("modal-overlay-active")).toBe(
        true,
      );

      clearAllScrollLocks();

      expect(document.body.classList.contains("modal-scroll-lock")).toBe(false);
      expect(document.body.classList.contains("modal-overlay-active")).toBe(
        false,
      );
      expect(document.documentElement.style.overflow).toBe("");
    });
  });
});
