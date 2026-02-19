jest.mock("../settings", () => ({
  updateModuleBadge: jest.fn(),
}));

jest.mock("../settingsStore", () => ({
  setTheme: jest.fn().mockResolvedValue("dark"),
  getTheme: jest.fn().mockResolvedValue("dark"),
}));

jest.mock("../i18n", () => ({
  setLanguage: jest.fn(),
  getLanguage: jest.fn(() => "ru"),
  t: (key) => key,
}));

describe("firstRunModal", () => {
  beforeEach(() => {
    document.body.innerHTML = `
      <div id="first-run-modal">
        <button id="first-run-apply"></button>
        <input type="radio" name="first-run-language" value="ru" checked />
        <input type="radio" name="first-run-language" value="en" />
        <input type="radio" name="first-run-theme" value="system" />
        <input type="radio" name="first-run-theme" value="dark" checked />
        <input type="checkbox" name="first-run-tab" value="download" checked disabled />
        <input type="checkbox" name="first-run-tab" value="wireguard" />
        <input type="checkbox" name="first-run-tab" value="backup" />
      </div>`;
    localStorage.clear();
    jest.resetModules();
  });

  test("shows modal on first run and applies selections", async () => {
    const { initFirstRunModal } = require("../firstRunModal.js");
    initFirstRunModal();

    const modal = document.getElementById("first-run-modal");
    expect(modal?.style.display).toBe("flex");

    const applyBtn = document.getElementById("first-run-apply");
    applyBtn.dispatchEvent(new Event("click"));
    await Promise.resolve();

    const { setLanguage } = require("../i18n.js");
    const { setTheme } = require("../settingsStore.js");

    expect(setTheme).toHaveBeenCalledWith("dark");
    expect(setLanguage).toHaveBeenCalledWith("ru");
    expect(localStorage.getItem("firstRunCompleted")).toBe("1");
    expect(localStorage.getItem("wgUnlockDisabled")).toBe("true");
    expect(localStorage.getItem("backupDisabled")).toBe("true");
  });

  test("does not show modal when already completed", async () => {
    localStorage.setItem("firstRunCompleted", "1");
    const { initFirstRunModal } = require("../firstRunModal.js");
    initFirstRunModal();

    const modal = document.getElementById("first-run-modal");
    expect(modal?.style.display).not.toBe("flex");
  });
});
