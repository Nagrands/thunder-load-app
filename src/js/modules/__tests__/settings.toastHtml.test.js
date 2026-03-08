const stubToggle = () => ({
  checked: false,
  addEventListener: jest.fn(),
  setAttribute: jest.fn(),
  removeAttribute: jest.fn(),
});

jest.mock("../domElements", () => ({
  settingsAutoLaunchToggle: stubToggle(),
  settingsMinimizeOnLaunchToggle: stubToggle(),
  settingsCloseNotificationToggle: stubToggle(),
  settingsOpenOnDownloadCompleteToggle: stubToggle(),
  settingsOpenOnCopyUrlToggle: stubToggle(),
  settingsDisableGlobalShortcutsToggle: stubToggle(),
  settingsCloseToTrayRadio: stubToggle(),
  settingsCloseAppRadio: stubToggle(),
  settingsDisableCompleteModalToggle: stubToggle(),
  settingsLowEffectsToggle: stubToggle(),
}));

describe("settings html toasts", () => {
  beforeEach(() => {
    jest.resetModules();
    localStorage.clear();
    document.body.innerHTML = "";
  });

  function createI18nMock() {
    return {
      applyI18n: jest.fn(),
      getLanguage: () => "ru",
      setLanguage: jest.fn(),
      t: (key, vars = {}) => {
        if (key === "settings.fontSize.set") {
          return `<strong>Размер шрифта</strong> установлен на <strong>${vars.size}px</strong>`;
        }
        if (key === "settings.fontSize.reset") {
          return `<strong>Размер шрифта</strong> сброшен на <strong>${vars.size}px</strong>`;
        }
        if (key === "settings.theme.set") {
          return `Выбрана тема: <strong>${vars.theme}</strong>`;
        }
        if (key === "settings.theme.reset") {
          return `<strong>Тема</strong> сброшена на <strong>${vars.theme}</strong>`;
        }
        if (key === "settings.appearance.theme.dark") {
          return "Dark";
        }
        if (key === "settings.appearance.theme.light") {
          return "Light";
        }
        if (key === "settings.appearance.theme.midnight") {
          return "Midnight";
        }
        if (key === "settings.appearance.theme.sunset") {
          return "Sunset";
        }
        if (key === "settings.appearance.theme.violet") {
          return "Violet";
        }
        return key;
      },
    };
  }

  it("uses showToast allowHtml for font size toasts", async () => {
    const showToast = jest.fn();
    global.window = global.window || {};
    window.electron = {
      invoke: jest.fn().mockResolvedValue(false),
      on: jest.fn(),
      send: jest.fn(),
      tools: { getLocation: jest.fn().mockResolvedValue(null) },
    };
    document.body.innerHTML = `
      <div id="window-settings">
        <button id="font-size-dropdown-btn" type="button"></button>
        <ul id="font-size-dropdown-menu">
          <li data-value="14">14</li>
          <li data-value="16">16</li>
        </ul>
        <span id="font-size-selected-label"></span>
        <button id="reset-font-size" type="button"></button>
      </div>`;

    let mod;
    jest.isolateModules(() => {
      jest.doMock("../toast.js", () => ({ showToast }));
      jest.doMock("../i18n", () => createI18nMock());
      jest.doMock("../settingsStore.js", () => ({
        getTheme: jest.fn().mockResolvedValue("dark"),
        getFontSize: jest.fn().mockResolvedValue("16"),
        setFontSize: jest.fn().mockResolvedValue({ success: true }),
        setTheme: jest.fn().mockResolvedValue({ success: true }),
      }));
      mod = require("../settings");
    });

    await mod.initSettings?.();
    const item14 = document.querySelector('#font-size-dropdown-menu li[data-value="14"]');
    item14?.dispatchEvent(new MouseEvent("click", { bubbles: true }));
    const resetBtn = document.getElementById("reset-font-size");
    resetBtn?.click();
    await Promise.resolve();
    await Promise.resolve();

    expect(
      showToast.mock.calls.some(
        (args) =>
          String(args[0] || "").includes("<strong>Размер шрифта</strong>") &&
          args[1] === "success" &&
          args[6]?.allowHtml === true,
      ),
    ).toBe(true);
    expect(showToast).toHaveBeenCalledTimes(2);
  });

  it("uses showToast allowHtml for theme toasts", async () => {
    const showToast = jest.fn();
    global.window = global.window || {};
    window.electron = {
      invoke: jest.fn().mockResolvedValue(false),
      on: jest.fn(),
      send: jest.fn(),
      tools: { getLocation: jest.fn().mockResolvedValue(null) },
    };
    document.body.innerHTML = `
      <div id="window-settings">
        <button id="theme-dropdown-btn" type="button"></button>
        <ul id="theme-dropdown-menu">
          <li data-value="dark">Dark</li>
          <li data-value="light">Light</li>
        </ul>
        <span id="theme-selected-label"></span>
        <button id="reset-theme" type="button"></button>
      </div>`;

    let mod;
    jest.isolateModules(() => {
      jest.doMock("../toast.js", () => ({ showToast }));
      jest.doMock("../i18n", () => createI18nMock());
      jest.doMock("../settingsStore.js", () => ({
        getTheme: jest.fn().mockResolvedValue("light"),
        getFontSize: jest.fn().mockResolvedValue("16"),
        setFontSize: jest.fn().mockResolvedValue({ success: true }),
        setTheme: jest.fn().mockResolvedValue({ success: true }),
      }));
      mod = require("../settings");
    });

    await mod.initSettings?.();
    const darkTheme = document.querySelector('#theme-dropdown-menu li[data-value="dark"]');
    darkTheme?.dispatchEvent(new MouseEvent("click", { bubbles: true }));
    const resetBtn = document.getElementById("reset-theme");
    resetBtn?.click();
    await Promise.resolve();
    await Promise.resolve();

    expect(document.getElementById("theme-selected-label")?.textContent).toBe("Dark");
    expect(
      document
        .querySelector('#theme-dropdown-menu li[data-value="dark"]')
        ?.classList.contains("active"),
    ).toBe(true);
    expect(document.getElementById("theme-dropdown-btn")?.dataset.currentTheme).toBe(
      "dark",
    );

    expect(
      showToast.mock.calls.some(
        (args) =>
          String(args[0] || "").includes("<strong>") &&
          String(args[0] || "").includes("Dark") &&
          args[1] === "success" &&
          args[6]?.allowHtml === true,
      ),
    ).toBe(true);
    expect(showToast).toHaveBeenCalledTimes(2);
  });

});
