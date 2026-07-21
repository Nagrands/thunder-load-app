describe("settingsStore theme persistence", () => {
  beforeEach(() => {
    jest.resetModules();
    localStorage.clear();
    document.documentElement.removeAttribute("data-theme");
  });

  it("propagates set-theme IPC errors when Electron is available", async () => {
    window.electron = {
      invoke: jest
        .fn()
        .mockRejectedValue(new Error("Theme persistence failed")),
    };
    const consoleError = jest
      .spyOn(console, "error")
      .mockImplementation(() => {});
    const { setTheme } = require("../settingsStore.js");

    await expect(setTheme("emerald")).rejects.toThrow(
      "Theme persistence failed",
    );
    expect(window.electron.invoke).toHaveBeenCalledWith("set-theme", "emerald");
    expect(localStorage.getItem("theme")).toBeNull();
    consoleError.mockRestore();
  });

  it("propagates structured set-theme failures without changing local state", async () => {
    window.electron = {
      invoke: jest.fn().mockResolvedValue({
        success: false,
        error: "Theme was rejected",
      }),
    };
    const consoleError = jest
      .spyOn(console, "error")
      .mockImplementation(() => {});
    const { setTheme } = require("../settingsStore.js");

    await expect(setTheme("violet")).rejects.toThrow("Theme was rejected");
    expect(localStorage.getItem("theme")).toBeNull();
    expect(document.documentElement.hasAttribute("data-theme")).toBe(false);
    consoleError.mockRestore();
  });

  it("still applies the theme when Electron is unavailable", async () => {
    delete window.electron;
    const { setTheme } = require("../settingsStore.js");

    await expect(setTheme("sunset")).resolves.toBe("sunset");
    expect(localStorage.getItem("theme")).toBe("sunset");
    expect(document.documentElement.getAttribute("data-theme")).toBe("sunset");
  });
});
