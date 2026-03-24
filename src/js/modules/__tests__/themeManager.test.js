describe("themeManager", () => {
  beforeEach(() => {
    jest.resetModules();
    localStorage.clear();
    document.documentElement.removeAttribute("data-theme");
  });

  test("falls back from removed light theme to dark", () => {
    localStorage.setItem("theme", "light");
    const { getTheme, initializeTheme } = require("../themeManager.js");

    expect(getTheme()).toBe("dark");
    expect(localStorage.getItem("theme")).toBe("dark");

    initializeTheme();
    expect(document.documentElement.getAttribute("data-theme")).toBe("dark");
  });
});
