jest.mock("../domElements", () => ({}));

const { TextEncoder, TextDecoder } = require("util");
global.TextEncoder = global.TextEncoder || TextEncoder;
global.TextDecoder = global.TextDecoder || TextDecoder;

const { JSDOM } = require("jsdom");
let settingsModule;

describe("updateModuleBadge", () => {
  beforeEach(() => {
    jest.resetModules();
    document.body.innerHTML = `
      <button class="tab-link" data-tab="wgunlock-settings">
        <span class="tab-badge tab-badge-off" id="tab-badge-wg">Выкл</span>
      </button>`;
    settingsModule = require("../settings");
  });

  it("shows badge and marks button disabled when disabled = true", () => {
    expect(typeof settingsModule.__test_updateModuleBadge).toBe("function");
    settingsModule.__test_updateModuleBadge("wg", true);
    const btn = document.querySelector(".tab-link");
    const badge = document.querySelector(".tab-badge");
    expect(btn).not.toBeNull();
    expect(badge).not.toBeNull();
    expect(btn?.classList.contains("tab-disabled")).toBe(true);
    expect(badge?.textContent).toBe("Выкл");
    expect(badge?.hasAttribute("hidden")).toBe(false);
  });

  it("hides badge and removes disabled class when disabled = false", () => {
    expect(typeof settingsModule.__test_updateModuleBadge).toBe("function");
    settingsModule.__test_updateModuleBadge("wg", false);
    const btn = document.querySelector(".tab-link");
    const badge = document.querySelector(".tab-badge");
    expect(btn).not.toBeNull();
    expect(badge).not.toBeNull();
    expect(btn?.classList.contains("tab-disabled")).toBe(false);
    expect(badge?.textContent).toBe("Вкл");
    expect(badge?.style.display).toBe("none");
  });
});
