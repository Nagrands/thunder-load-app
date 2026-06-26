const renderQualityDom = () => {
  document.body.innerHTML = `
    <div
      id="quality-profile-segment"
      role="radiogroup"
      aria-label="quality profile"
    >
      <button
        id="quality-profile-segment-remember"
        data-value="remember"
        role="radio"
        aria-checked="false"
        tabindex="-1"
      ></button>
      <button
        id="quality-profile-segment-audio"
        data-value="audio"
        role="radio"
        aria-checked="false"
        tabindex="-1"
      ></button>
    </div>
    <span id="quality-profile-summary-icon"></span>
    <strong id="quality-profile-summary-title"></strong>
    <small id="quality-profile-summary-hint"></small>`;
};

describe("downloadQualityProfileSettings", () => {
  beforeEach(() => {
    jest.resetModules();
    localStorage.clear();
    delete window.__thunder_open_settings_handlers__;
    delete window.__thunder_open_settings_dispatch_ready__;
    window.electron = {
      invoke: jest.fn().mockResolvedValue({ success: true }),
      on: jest.fn(),
      send: jest.fn(),
    };
  });

  it("initializes remember mode from storage and updates summary", () => {
    localStorage.setItem("downloadQualityProfile", "remember");
    renderQualityDom();
    const { initDownloadQualityProfileSettings } = require("../features/settings/downloadQualityProfileSettings.js");

    initDownloadQualityProfileSettings();

    const remember = document.getElementById(
      "quality-profile-segment-remember",
    );
    const audio = document.getElementById("quality-profile-segment-audio");
    const title = document.getElementById("quality-profile-summary-title");

    expect(remember?.classList.contains("is-active")).toBe(true);
    expect(remember?.getAttribute("aria-checked")).toBe("true");
    expect(audio?.classList.contains("is-active")).toBe(false);
    expect(audio?.getAttribute("aria-checked")).toBe("false");
    expect(title?.textContent).toBe("Последний выбор");
  });

  it("falls back to remember for invalid stored values", () => {
    localStorage.setItem("downloadQualityProfile", "bad");
    renderQualityDom();
    const { initDownloadQualityProfileSettings } = require("../features/settings/downloadQualityProfileSettings.js");

    initDownloadQualityProfileSettings();

    expect(
      document
        .getElementById("quality-profile-segment-remember")
        ?.classList.contains("is-active"),
    ).toBe(true);
  });

  it("switches to audio on click and persists value", () => {
    localStorage.setItem("downloadQualityProfile", "remember");
    renderQualityDom();
    const { initDownloadQualityProfileSettings } = require("../features/settings/downloadQualityProfileSettings.js");

    initDownloadQualityProfileSettings();
    document
      .getElementById("quality-profile-segment-audio")
      ?.dispatchEvent(new MouseEvent("click", { bubbles: true }));

    expect(localStorage.getItem("downloadQualityProfile")).toBe("audio");
    expect(window.electron.invoke).toHaveBeenCalledWith(
      "toast",
      "Профиль качества сохранён.",
      "success",
    );
  });

  it("supports keyboard preview, commit, and open-settings refresh", () => {
    localStorage.setItem("downloadQualityProfile", "remember");
    renderQualityDom();
    const { initDownloadQualityProfileSettings } = require("../features/settings/downloadQualityProfileSettings.js");

    initDownloadQualityProfileSettings();

    const segment = document.getElementById("quality-profile-segment");
    segment?.dispatchEvent(
      new KeyboardEvent("keydown", { key: "ArrowRight", bubbles: true }),
    );
    expect(localStorage.getItem("downloadQualityProfile")).toBe("remember");
    expect(
      document
        .getElementById("quality-profile-segment-audio")
        ?.classList.contains("is-active"),
    ).toBe(true);

    segment?.dispatchEvent(
      new KeyboardEvent("keydown", { key: "Enter", bubbles: true }),
    );
    expect(localStorage.getItem("downloadQualityProfile")).toBe("audio");

    localStorage.setItem("downloadQualityProfile", "remember");
    window.__thunder_open_settings_handlers__?.get(
      "download-quality-profile",
    )?.();

    expect(
      document
        .getElementById("quality-profile-segment-remember")
        ?.classList.contains("is-active"),
    ).toBe(true);
  });

  it("reinitializes without duplicating DOM listeners", () => {
    renderQualityDom();
    const { initDownloadQualityProfileSettings } = require("../features/settings/downloadQualityProfileSettings.js");

    initDownloadQualityProfileSettings();
    initDownloadQualityProfileSettings();
    document
      .getElementById("quality-profile-segment-audio")
      ?.dispatchEvent(new MouseEvent("click", { bubbles: true }));

    const toastCalls = window.electron.invoke.mock.calls.filter(
      ([channel]) => channel === "toast",
    );
    expect(toastCalls).toHaveLength(1);
  });

  it("does not fail without DOM or electron invoke", () => {
    document.body.innerHTML = "";
    window.electron = {};
    const { initDownloadQualityProfileSettings } = require("../features/settings/downloadQualityProfileSettings.js");

    expect(() => initDownloadQualityProfileSettings()).not.toThrow();
    expect(initDownloadQualityProfileSettings()).toBeNull();

    renderQualityDom();
    initDownloadQualityProfileSettings();
    expect(() =>
      document
        .getElementById("quality-profile-segment-audio")
        ?.dispatchEvent(new MouseEvent("click", { bubbles: true })),
    ).not.toThrow();
  });
});
