/** @jest-environment jsdom */

describe("scrollbarVisibility", () => {
  beforeEach(() => {
    jest.resetModules();
    jest.useFakeTimers();
    document.documentElement.className = "";
    document.body.className = "";
    delete window.__thunderLoadScrollbarVisibility;
  });

  afterEach(() => {
    jest.useRealTimers();
    document.documentElement.className = "";
    document.body.className = "";
    delete window.__thunderLoadScrollbarVisibility;
  });

  test("shows scrollbars during wheel activity and hides them after idle", async () => {
    await jest.isolateModulesAsync(async () => {
      const { initScrollbarVisibility } = require("../scrollbarVisibility");

      initScrollbarVisibility();
      window.dispatchEvent(new WheelEvent("wheel"));

      expect(document.body.classList.contains("scrollbars-visible")).toBe(true);
      expect(
        document.documentElement.classList.contains("scrollbars-visible"),
      ).toBe(true);

      jest.advanceTimersByTime(899);
      expect(document.body.classList.contains("scrollbars-visible")).toBe(true);

      jest.advanceTimersByTime(1);
      expect(document.body.classList.contains("scrollbars-visible")).toBe(
        false,
      );
      expect(
        document.documentElement.classList.contains("scrollbars-visible"),
      ).toBe(false);
    });
  });
});
