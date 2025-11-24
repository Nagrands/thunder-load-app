/** @jest-environment jsdom */

jest.mock("../toast.js", () => ({ showToast: jest.fn() }));
jest.mock("../tooltipInitializer.js", () => ({ initTooltips: jest.fn() }));
jest.mock("../toolsInfo.js", () => ({
  summarizeToolsState:
    jest.requireActual("../toolsInfo.js").summarizeToolsState,
}));
jest.mock("../settingsModal.js", () => ({
  openSettingsWithTab: jest.fn(),
}));
jest.mock("../modals.js", () => ({})); // toolsInfo imports modals/domElements; keep empty

const buildDom = () => {
  document.body.innerHTML = `
    <div class="downloader-tools-status">
      <div class="status-line" id="dl-tools-status" role="status" aria-live="polite">
        <i class="fa-solid fa-circle-notch fa-spin" id="dl-tools-icon" aria-hidden="true"></i>
        <span id="dl-tools-text">Проверяем инструменты…</span>
        <div class="tool-badges" id="dl-tools-badges"></div>
      </div>
      <button
        type="button"
        id="dl-tools-toggle"
        title="Скрыть статус"
        data-bs-toggle="tooltip"
        aria-label="Скрыть статус инструментов"
      >
        <i class="fa-solid fa-xmark"></i>
      </button>
      <button
        type="button"
        id="dl-tools-reinstall"
        title="Переустановить зависимости (yt-dlp, ffmpeg, Deno)"
        data-bs-toggle="tooltip"
      >
        <i class="fa-solid fa-arrow-rotate-right"></i>
        <span>Переустановить</span>
      </button>
    </div>
  `;
};

const tick = () => new Promise((resolve) => setTimeout(resolve, 0));

describe("downloaderToolsStatus", () => {
  beforeEach(() => {
    jest.resetModules();
    if (global.localStorage?.clear) {
      localStorage.clear();
    }
    buildDom();
    global.window.electron = {
      tools: {
        getVersions: jest.fn(),
        installAll: jest.fn(),
      },
    };
  });

  test("shows ready state when yt-dlp/ffmpeg/Deno present", async () => {
    window.electron.tools.getVersions.mockResolvedValue({
      ytDlp: { ok: true, path: "/tmp/yt-dlp", version: "2024.01.01" },
      ffmpeg: {
        ok: true,
        path: "/tmp/ffmpeg",
        version: "ffmpeg version 7.1",
      },
      deno: { ok: true, path: "/tmp/deno", version: "deno 2.0.0" },
    });
    const { initDownloaderToolsStatus } = await import(
      "../downloaderToolsStatus.js"
    );
    initDownloaderToolsStatus();
    await tick();
    expect(document.getElementById("dl-tools-text").textContent).toContain(
      "Инструменты готовы",
    );
    const badges = Array.from(document.querySelectorAll(".tool-badge")).map(
      (el) => el.textContent.trim(),
    );
    expect(badges).toEqual(["yt-dlp 2024.01.01", "ffmpeg 7.1", "Deno 2.0.0"]);
    expect(
      document
        .getElementById("dl-tools-reinstall")
        .classList.contains("hidden"),
    ).toBe(true);
    const container = document.querySelector(".downloader-tools-status");
    expect(container.outerHTML).toMatchInlineSnapshot(`
"<div class=\"downloader-tools-status\">
      <div class=\"status-line is-ok\" id=\"dl-tools-status\" role=\"status\" aria-live=\"polite\">
        <i class=\"fa-solid fa-check\" id=\"dl-tools-icon\" aria-hidden=\"true\"></i>
        <span id=\"dl-tools-text\">Инструменты готовы</span>
        <div class=\"tool-badges\" id=\"dl-tools-badges\"><span class=\"tool-badge ok\" data-tool=\"yt\"><i class=\"fa-solid fa-check\"></i> yt-dlp 2024.01.01</span><span class=\"tool-badge ok\" data-tool=\"ff\"><i class=\"fa-solid fa-check\"></i> ffmpeg 7.1</span><span class=\"tool-badge ok\" data-tool=\"deno\"><i class=\"fa-solid fa-check\"></i> Deno 2.0.0</span></div>
      </div>
      <button type=\"button\" id=\"dl-tools-toggle\" title=\"Скрыть статус\" data-bs-toggle=\"tooltip\" aria-label=\"Скрыть статус инструментов\">
        <i class=\"fa-solid fa-xmark\"></i>
      </button>
      <button type=\"button\" id=\"dl-tools-reinstall\" title=\"Переустановить зависимости (yt-dlp, ffmpeg, Deno)\" data-bs-toggle=\"tooltip\" class=\"hidden\">
        <i class=\"fa-solid fa-arrow-rotate-right\"></i>
        <span>Переустановить</span>
      </button>
    </div>"
`);
  });

  test("shows error state when tools missing", async () => {
    window.electron.tools.getVersions.mockResolvedValue({
      ytDlp: { ok: false },
      ffmpeg: { ok: true, path: "/tmp/ffmpeg", version: "ffmpeg version 7.1" },
      deno: { ok: false },
    });
    const { initDownloaderToolsStatus } = await import(
      "../downloaderToolsStatus.js"
    );
    initDownloaderToolsStatus();
    await tick();
    expect(document.getElementById("dl-tools-text").textContent).toContain(
      "yt-dlp, Deno",
    );
    expect(
      document
        .getElementById("dl-tools-reinstall")
        .classList.contains("hidden"),
    ).toBe(false);
  });

  test("reinstall triggers installAll and refresh", async () => {
    window.electron.tools.getVersions
      .mockImplementationOnce(() =>
        Promise.resolve({
          ytDlp: { ok: false },
          ffmpeg: { ok: false },
          deno: { ok: false },
        }),
      )
      .mockImplementationOnce(() =>
        Promise.resolve({
          ytDlp: { ok: true, path: "/tmp/yt-dlp", version: "2024.02.02" },
          ffmpeg: {
            ok: true,
            path: "/tmp/ffmpeg",
            version: "ffmpeg version 7.1",
          },
          deno: { ok: true, path: "/tmp/deno", version: "deno 2.1.0" },
        }),
      );
    window.electron.tools.installAll.mockResolvedValue({ success: true });

    const { initDownloaderToolsStatus } = await import(
      "../downloaderToolsStatus.js"
    );
    initDownloaderToolsStatus();
    await tick();

    document.getElementById("dl-tools-reinstall").click();
    await tick();
    expect(
      require("../settingsModal.js").openSettingsWithTab,
    ).toHaveBeenCalledWith("window-settings");
    // UI статус не меняется автоматически — ждём действий в настройках.
  });

  test("close hides container until settings shows it", async () => {
    window.electron.tools.getVersions.mockResolvedValue({
      ytDlp: { ok: true, path: "/tmp/yt-dlp", version: "2024.01.01" },
      ffmpeg: {
        ok: true,
        path: "/tmp/ffmpeg",
        version: "ffmpeg version 7.1",
      },
      deno: { ok: true, path: "/tmp/deno", version: "deno 2.0.0" },
    });
    const { initDownloaderToolsStatus } = await import(
      "../downloaderToolsStatus.js"
    );
    initDownloaderToolsStatus();
    await tick();

    const container = document.querySelector(".downloader-tools-status");
    const toggle = document.getElementById("dl-tools-toggle");
    expect(container.classList.contains("hidden")).toBe(false);

    toggle.click();
    expect(container.classList.contains("hidden")).toBe(true);
    expect(localStorage.getItem("downloaderToolsStatusHidden")).toBe("1");

    window.dispatchEvent(
      new CustomEvent("tools:visibility", { detail: { hidden: false } }),
    );
    expect(container.classList.contains("hidden")).toBe(false);
    expect(localStorage.getItem("downloaderToolsStatusHidden")).toBeNull();
  });
});
