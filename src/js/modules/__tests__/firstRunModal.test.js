jest.mock("../settings", () => ({
  updateModuleBadge: jest.fn(),
}));

jest.mock("../settingsStore", () => ({
  setTheme: jest.fn().mockResolvedValue("dark"),
  getTheme: jest.fn().mockResolvedValue("dark"),
}));

jest.mock("../i18n", () => ({
  setLanguage: jest.fn(),
  setLanguagePreview: jest.fn(),
  getLanguage: jest.fn(() => "ru"),
  t: (key, vars = {}) =>
    Object.entries(vars).reduce(
      (acc, [name, value]) => acc.replace(`{${name}}`, String(value)),
      key,
    ),
}));

describe("firstRunModal", () => {
  beforeEach(() => {
    document.body.innerHTML = `
      <div id="first-run-modal">
        <div data-first-run-panel="0" class="first-run-section is-active"></div>
        <div data-first-run-panel="1" class="first-run-section" hidden></div>
        <div data-first-run-panel="2" class="first-run-section" hidden></div>
        <div data-first-run-panel="3" class="first-run-section" hidden></div>
        <button class="first-run-step is-active" data-step-index="0" data-step-label-key="firstRun.steps.language"></button>
        <button class="first-run-step" data-step-index="1" data-step-label-key="firstRun.steps.modules"></button>
        <button class="first-run-step" data-step-index="2" data-step-label-key="firstRun.steps.theme"></button>
        <button class="first-run-step" data-step-index="3" data-step-label-key="firstRun.steps.summary"></button>
        <span id="first-run-step-label"></span>
        <strong id="first-run-step-counter"></strong>
        <button id="first-run-back"></button>
        <button id="first-run-primary" class="btn btn-secondary"></button>
        <strong id="first-run-summary-language"></strong>
        <strong id="first-run-summary-tabs"></strong>
        <strong id="first-run-summary-theme"></strong>
        <label class="first-run-option">
          <input type="radio" name="first-run-language" value="ru" checked />
        </label>
        <label class="first-run-option">
          <input type="radio" name="first-run-language" value="en" />
        </label>
        <label class="first-run-option">
          <input type="radio" name="first-run-theme" value="dark" checked />
        </label>
        <label class="first-run-option">
          <input type="radio" name="first-run-theme" value="midnight" />
        </label>
        <label class="first-run-option">
          <input type="checkbox" name="first-run-tab" value="download" checked disabled />
        </label>
        <label class="first-run-option">
          <input type="checkbox" name="first-run-tab" value="wireguard" />
        </label>
        <label class="first-run-option">
          <input type="checkbox" name="first-run-tab" value="backup" />
        </label>
      </div>`;
    localStorage.clear();
    jest.resetModules();
  });

  test("shows wizard on first run, preserves selections, and applies them", async () => {
    const { initFirstRunModal } = require("../firstRunModal.js");
    initFirstRunModal();

    const modal = document.getElementById("first-run-modal");
    expect(modal?.style.display).toBe("flex");
    expect(document.getElementById("first-run-back")?.disabled).toBe(true);
    expect(document.getElementById("first-run-primary")?.textContent).toBe(
      "firstRun.next",
    );

    const english = document.querySelector(
      'input[name="first-run-language"][value="en"]',
    );
    english.checked = true;
    english.dispatchEvent(new Event("change", { bubbles: true }));

    const nextBtn = document.getElementById("first-run-primary");
    nextBtn.dispatchEvent(new Event("click"));

    const wgCheckbox = document.querySelector(
      'input[name="first-run-tab"][value="wireguard"]',
    );
    wgCheckbox.checked = true;
    wgCheckbox.dispatchEvent(new Event("change", { bubbles: true }));
    nextBtn.dispatchEvent(new Event("click"));

    const midnight = document.querySelector(
      'input[name="first-run-theme"][value="midnight"]',
    );
    midnight.checked = true;
    midnight.dispatchEvent(new Event("change", { bubbles: true }));
    nextBtn.dispatchEvent(new Event("click"));

    expect(document.getElementById("first-run-primary")?.textContent).toBe(
      "firstRun.apply",
    );
    expect(document.getElementById("first-run-summary-language")?.textContent).toBe(
      "language.en",
    );
    expect(document.getElementById("first-run-summary-theme")?.textContent).toBe(
      "settings.appearance.theme.midnight",
    );
    expect(document.getElementById("first-run-summary-tabs")?.textContent).toBe(
      "tabs.download, tabs.tools",
    );

    document.getElementById("first-run-back").dispatchEvent(new Event("click"));
    expect(
      document.querySelector('input[name="first-run-theme"][value="midnight"]')
        ?.checked,
    ).toBe(true);
    nextBtn.dispatchEvent(new Event("click"));

    nextBtn.dispatchEvent(new Event("click"));
    await Promise.resolve();

    const { setLanguage } = require("../i18n.js");
    const { setLanguagePreview } = require("../i18n.js");
    const { setTheme } = require("../settingsStore.js");

    expect(setLanguagePreview).toHaveBeenCalledWith("en");
    expect(setTheme).toHaveBeenCalledWith("midnight");
    expect(setLanguage).toHaveBeenCalledWith("en");
    expect(localStorage.getItem("firstRunCompleted")).toBe("1");
    expect(localStorage.getItem("wgUnlockDisabled")).toBe("false");
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
