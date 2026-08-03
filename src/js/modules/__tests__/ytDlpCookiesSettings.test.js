import {
  initYtDlpCookiesSettings,
  normalizeYtDlpCookiesSettings,
  YTDLP_COOKIES_DEFAULT,
} from "../features/settings/ytDlpCookiesSettings.js";

describe("yt-dlp cookies settings normalization", () => {
  test("uses defaults for missing or unsupported values", () => {
    expect(normalizeYtDlpCookiesSettings(null)).toEqual(YTDLP_COOKIES_DEFAULT);
    expect(
      normalizeYtDlpCookiesSettings({
        mode: "unknown",
        browser: "unknown",
      }),
    ).toEqual(YTDLP_COOKIES_DEFAULT);
  });

  test("normalizes a valid value without mutating the source", () => {
    const source = {
      mode: "file",
      browser: "firefox",
      filePath: "  /tmp/cookies.txt  ",
    };

    expect(normalizeYtDlpCookiesSettings(source)).toEqual({
      mode: "file",
      browser: "firefox",
      filePath: "/tmp/cookies.txt",
    });
    expect(source.filePath).toBe("  /tmp/cookies.txt  ");
  });

  test("rejects file paths containing null bytes", () => {
    expect(
      normalizeYtDlpCookiesSettings({
        mode: "file",
        browser: "chrome",
        filePath: "/tmp/cookies\u0000.txt",
      }).filePath,
    ).toBe("");
  });
});

describe("yt-dlp cookies settings controls", () => {
  beforeEach(() => {
    document.body.innerHTML = `
      <span id="settings-ytdlp-cookies-summary-state"></span>
      <div data-settings-cookies-select="mode">
        <button id="settings-ytdlp-cookies-mode-trigger" type="button" aria-expanded="false"></button>
        <span id="settings-ytdlp-cookies-mode-label"></span>
        <select id="settings-ytdlp-cookies-mode">
          <option value="off">Off</option>
          <option value="browser">Browser</option>
          <option value="file">File</option>
        </select>
        <div id="settings-ytdlp-cookies-mode-menu" class="hidden">
          <button class="settings-cookies-select__option" data-value="off" data-label-key="settings.downloader.cookies.mode.off"><span>Off</span></button>
          <button class="settings-cookies-select__option" data-value="browser" data-label-key="settings.downloader.cookies.mode.browser"><span>Browser</span></button>
          <button class="settings-cookies-select__option" data-value="file" data-label-key="settings.downloader.cookies.mode.file"><span>File</span></button>
        </div>
      </div>
      <div id="settings-ytdlp-cookies-browser-row">
        <div data-settings-cookies-select="browser">
          <button id="settings-ytdlp-cookies-browser-trigger" type="button" aria-expanded="false"></button>
          <span id="settings-ytdlp-cookies-browser-label"></span>
          <select id="settings-ytdlp-cookies-browser">
            <option value="chrome">Chrome</option>
            <option value="firefox">Firefox</option>
          </select>
          <div id="settings-ytdlp-cookies-browser-menu" class="hidden">
            <button class="settings-cookies-select__option" data-value="chrome"><span>Chrome</span></button>
            <button class="settings-cookies-select__option" data-value="firefox"><span>Firefox</span></button>
          </div>
        </div>
      </div>
      <div id="settings-ytdlp-cookies-file-row"></div>
      <button id="settings-ytdlp-cookies-file-button" type="button"></button>
      <span id="settings-ytdlp-cookies-file-label"></span>
      <button id="settings-ytdlp-cookies-guide" type="button"></button>
    `;
    window.electron = {
      invoke: jest.fn(async (channel, value) => {
        if (channel === "get-ytdlp-cookies-settings") {
          return { mode: "browser", browser: "firefox", filePath: "" };
        }
        if (channel === "set-ytdlp-cookies-settings") {
          return { success: true, settings: value };
        }
        return { canceled: true };
      }),
    };
  });

  test("shows the active mode and supports keyboard listbox navigation", async () => {
    initYtDlpCookiesSettings();
    await Promise.resolve();
    await Promise.resolve();

    const trigger = document.getElementById(
      "settings-ytdlp-cookies-mode-trigger",
    );
    const menu = document.getElementById("settings-ytdlp-cookies-mode-menu");
    const options = Array.from(
      menu.querySelectorAll(".settings-cookies-select__option"),
    );

    expect(
      document.getElementById("settings-ytdlp-cookies-summary-state").dataset
        .mode,
    ).toBe("browser");

    trigger.dispatchEvent(
      new KeyboardEvent("keydown", { key: "ArrowDown", bubbles: true }),
    );
    expect(trigger.getAttribute("aria-expanded")).toBe("true");
    expect(document.activeElement).toBe(options[1]);

    options[1].dispatchEvent(
      new KeyboardEvent("keydown", { key: "ArrowDown", bubbles: true }),
    );
    expect(document.activeElement).toBe(options[2]);

    options[2].dispatchEvent(
      new KeyboardEvent("keydown", { key: "Escape", bubbles: true }),
    );
    expect(trigger.getAttribute("aria-expanded")).toBe("false");
    expect(document.activeElement).toBe(trigger);
  });

  test("reuses the controller state across repeated initialization", async () => {
    let loadCount = 0;
    window.electron.invoke.mockImplementation(async (channel, value) => {
      if (channel === "get-ytdlp-cookies-settings") {
        loadCount += 1;
        return loadCount === 1
          ? { mode: "browser", browser: "firefox", filePath: "" }
          : { mode: "browser", browser: "chrome", filePath: "" };
      }
      if (channel === "set-ytdlp-cookies-settings") {
        return { success: true, settings: value };
      }
      return { canceled: true };
    });

    initYtDlpCookiesSettings();
    await Promise.resolve();
    await Promise.resolve();
    initYtDlpCookiesSettings();
    await Promise.resolve();
    await Promise.resolve();

    const mode = document.getElementById("settings-ytdlp-cookies-mode");
    mode.value = "file";
    mode.dispatchEvent(new Event("change", { bubbles: true }));
    await Promise.resolve();
    await Promise.resolve();

    expect(window.electron.invoke).toHaveBeenCalledWith(
      "set-ytdlp-cookies-settings",
      expect.objectContaining({ mode: "file", browser: "chrome" }),
    );
  });

  test("opens the localized YouTube cookies guide", async () => {
    document.documentElement.lang = "ru";
    initYtDlpCookiesSettings();
    await Promise.resolve();
    await Promise.resolve();

    document.getElementById("settings-ytdlp-cookies-guide").click();
    await Promise.resolve();

    expect(window.electron.invoke).toHaveBeenCalledWith(
      "open-external-link",
      "https://nagrands.github.io/thunder-load-app/ru/blog/youtube-cookies/",
    );
  });

  test("ignores a stale load response after a newer save", async () => {
    let resolveLoad;
    const pendingLoad = new Promise((resolve) => {
      resolveLoad = resolve;
    });
    window.electron.invoke.mockImplementation(async (channel, value) => {
      if (channel === "get-ytdlp-cookies-settings") return pendingLoad;
      if (channel === "set-ytdlp-cookies-settings") {
        return { success: true, settings: value };
      }
      return { canceled: true };
    });

    initYtDlpCookiesSettings();
    const mode = document.getElementById("settings-ytdlp-cookies-mode");
    mode.value = "browser";
    mode.dispatchEvent(new Event("change", { bubbles: true }));
    await Promise.resolve();
    await Promise.resolve();

    resolveLoad({ mode: "off", browser: "chrome", filePath: "" });
    await Promise.resolve();
    await Promise.resolve();

    expect(
      document.getElementById("settings-ytdlp-cookies-summary-state").dataset
        .mode,
    ).toBe("browser");
  });
});
