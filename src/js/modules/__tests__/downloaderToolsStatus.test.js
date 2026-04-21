/** @jest-environment jsdom */

jest.mock("../toast.js", () => ({ showToast: jest.fn() }));
jest.mock("../tooltipInitializer.js", () => ({
  initTooltips: jest.fn(),
  hideAllTooltips: jest.fn(),
}));
jest.mock("../toolsInfo.js", () => ({
  ...jest.requireActual("../toolsInfo.js"),
}));
jest.mock("../modals.js", () => ({})); // toolsInfo imports modals/domElements; keep empty
jest.mock("../i18n.js", () => ({
  t: (key, vars = {}) => {
    const map = {
      "tools.status.ready": "Tools are ready",
      "tools.status.unavailable": "Tools are unavailable",
      "tools.status.checking": "Checking tools…",
      "tools.status.bridgeMissing": "Tools: bridge unavailable",
      "tools.status.error": "Tools check failed",
      "tools.status.checkingUpdates": "Checking for updates",
      "tools.summary.ok": "All dependencies are installed",
      "tools.summary.missingList": "Missing: {items}",
      "tools.button.install": "Install",
      "tools.button.update": "Update",
      "tools.error.install": "Install failed",
      "tools.error.update": "Update failed",
      "tools.toast.installSuccess": "Dependencies installed",
      "tools.status.updatesFound": "Updates available",
      "tools.status.noNetwork": "No network: check your connection",
      "tools.status.installing": "Downloading",
      "downloader.tools.checking": "Checking tools…",
      "downloader.tools.installTitle":
        "Install dependencies (yt-dlp, ffmpeg, Deno)",
      "downloader.tools.updateTitle": "Update tools (yt-dlp, ffmpeg)",
    };
    let text = map[key] || key;
    Object.entries(vars).forEach(([name, value]) => {
      text = text.replace(new RegExp(`\\{${name}\\}`, "g"), String(value));
    });
    return text;
  },
}));

const buildDom = () => {
  document.body.innerHTML = `
    <div id="footer-tools-status" class="app-footer__tools-status downloader-tools-status">
      <div class="status-line" id="dl-tools-status" role="status" aria-live="polite">
        <i class="fa-solid fa-circle-notch fa-spin" id="dl-tools-icon" aria-hidden="true"></i>
        <span id="dl-tools-text" data-i18n="downloader.tools.checking">Checking tools…</span>
        <div class="tool-badges" id="dl-tools-badges"></div>
      </div>
      <button
        type="button"
        id="dl-tools-action"
        title=""
        data-bs-toggle="tooltip"
        class="hidden"
      >
        <i id="dl-tools-action-icon" class="fa-solid fa-download"></i>
        <span id="dl-tools-action-label">Install</span>
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
      invoke: jest.fn().mockResolvedValue(undefined),
      tools: {
        getVersions: jest.fn(),
        installAll: jest.fn(),
        checkUpdates: jest.fn(),
        updateYtDlp: jest.fn(),
        updateFfmpeg: jest.fn(),
      },
    };
    Object.defineProperty(window.navigator, "onLine", {
      value: true,
      configurable: true,
    });
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
    window.electron.tools.checkUpdates.mockResolvedValue({
      ytDlp: { current: "2024.01.01", latest: "2024.01.01" },
      ffmpeg: { current: "7.1", latest: "7.1" },
      deno: { current: "2.0.0", latest: "2.0.0" },
    });
    const { initDownloaderToolsStatus } =
      await import("../downloaderToolsStatus.js");
    initDownloaderToolsStatus();
    await tick();
    expect(document.getElementById("dl-tools-text").textContent).toContain(
      "Tools are ready",
    );
    const badges = Array.from(document.querySelectorAll(".tool-badge")).map(
      (el) => el.textContent.trim(),
    );
    expect(badges).toEqual(["yt-dlp 2024.01.01", "ffmpeg 7.1", "Deno 2.0.0"]);
    expect(
      document.getElementById("dl-tools-action").classList.contains("hidden"),
    ).toBe(true);
    const container = document.getElementById("footer-tools-status");
    expect(container.outerHTML).toMatchInlineSnapshot(`
     "<div id="footer-tools-status" class="app-footer__tools-status downloader-tools-status">
           <div class="status-line is-ok" id="dl-tools-status" role="status" aria-live="polite">
             <i class="fa-solid fa-check" id="dl-tools-icon" aria-hidden="true"></i>
             <span id="dl-tools-text" data-i18n="downloader.tools.checking">Tools are ready</span>
             <div class="tool-badges" id="dl-tools-badges"><span class="tool-badge ok" data-tool="yt"><span class="tool-badge__state" aria-hidden="true"><i class="fa-solid fa-check"></i></span><span class="tool-badge__label">yt-dlp</span> <span class="tool-badge__version">2024.01.01</span></span><span class="tool-badge ok" data-tool="ff"><span class="tool-badge__state" aria-hidden="true"><i class="fa-solid fa-check"></i></span><span class="tool-badge__label">ffmpeg</span> <span class="tool-badge__version">7.1</span></span><span class="tool-badge ok" data-tool="deno"><span class="tool-badge__state" aria-hidden="true"><i class="fa-solid fa-check"></i></span><span class="tool-badge__label">Deno</span> <span class="tool-badge__version">2.0.0</span></span></div>
           </div>
           <button type="button" id="dl-tools-action" title="" data-bs-toggle="tooltip" class="hidden" aria-hidden="true" data-bs-original-title="">
             <i id="dl-tools-action-icon" class="fa-solid fa-download"></i>
             <span id="dl-tools-action-label">Install</span>
           </button>
         </div>"
    `);
  });

  test("shows install action when tools are missing", async () => {
    window.electron.tools.getVersions.mockResolvedValue({
      ytDlp: { ok: false },
      ffmpeg: { ok: true, path: "/tmp/ffmpeg", version: "ffmpeg version 7.1" },
      deno: { ok: false },
    });
    const { initDownloaderToolsStatus } =
      await import("../downloaderToolsStatus.js");
    initDownloaderToolsStatus();
    await tick();
    expect(document.getElementById("dl-tools-text").textContent).toContain(
      "yt-dlp, Deno",
    );
    expect(document.getElementById("dl-tools-action-label").textContent).toBe(
      "Install",
    );
    expect(document.getElementById("dl-tools-action").title).toBe(
      "Install dependencies (yt-dlp, ffmpeg, Deno)",
    );
    expect(
      document.getElementById("dl-tools-action").classList.contains("hidden"),
    ).toBe(false);
  });

  test("shows bridge missing state when tools bridge is unavailable", async () => {
    delete window.electron.tools;
    const { initDownloaderToolsStatus } =
      await import("../downloaderToolsStatus.js");

    initDownloaderToolsStatus();
    await tick();

    expect(document.getElementById("dl-tools-text").textContent).toBe(
      "Tools: bridge unavailable",
    );
    expect(
      document.getElementById("dl-tools-action").classList.contains("hidden"),
    ).toBe(true);
  });

  test("install action triggers installAll and refresh", async () => {
    let resolveInstall;
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
    window.electron.tools.checkUpdates.mockResolvedValue({
      ytDlp: { current: "2024.02.02", latest: "2024.02.02" },
      ffmpeg: { current: "7.1", latest: "7.1" },
      deno: { current: "2.1.0", latest: "2.1.0" },
    });
    window.electron.tools.installAll.mockImplementation(
      () =>
        new Promise((resolve) => {
          resolveInstall = resolve;
        }),
    );

    const { initDownloaderToolsStatus } =
      await import("../downloaderToolsStatus.js");
    initDownloaderToolsStatus();
    await tick();

    document.getElementById("dl-tools-action").click();
    await tick();

    expect(
      document.getElementById("dl-tools-action").classList.contains("is-busy"),
    ).toBe(true);
    expect(document.getElementById("dl-tools-action")?.disabled).toBe(true);
    expect(document.getElementById("dl-tools-action-label").textContent).toBe(
      "Downloading",
    );
    expect(document.getElementById("dl-tools-action-icon").className).toContain(
      "fa-spin",
    );

    resolveInstall?.();
    await tick();
    await tick();

    expect(window.electron.tools.installAll).toHaveBeenCalledTimes(1);
    expect(window.electron.invoke).toHaveBeenCalledWith(
      "toast",
      "Dependencies installed",
      "success",
    );
    expect(document.getElementById("dl-tools-text").textContent).toBe(
      "Tools are ready",
    );
    expect(
      document.getElementById("dl-tools-action").classList.contains("hidden"),
    ).toBe(true);
  });

  test("shows update action when updates are available and runs selective updates", async () => {
    window.electron.tools.getVersions
      .mockResolvedValueOnce({
        ytDlp: { ok: true, path: "/tmp/yt-dlp", version: "2024.01.01" },
        ffmpeg: {
          ok: true,
          path: "/tmp/ffmpeg",
          version: "ffmpeg version 7.1",
        },
        deno: { ok: true, path: "/tmp/deno", version: "deno 2.0.0" },
      })
      .mockResolvedValueOnce({
        ytDlp: { ok: true, path: "/tmp/yt-dlp", version: "2024.02.01" },
        ffmpeg: {
          ok: true,
          path: "/tmp/ffmpeg",
          version: "ffmpeg version 7.2",
        },
        deno: { ok: true, path: "/tmp/deno", version: "deno 2.0.0" },
      });
    window.electron.tools.checkUpdates.mockResolvedValue({
      ytDlp: { current: "2024.01.01", latest: "2024.02.01" },
      ffmpeg: { current: "7.1", latest: "7.2" },
      deno: { current: "2.0.0", latest: "2.0.0" },
    });

    const { initDownloaderToolsStatus } =
      await import("../downloaderToolsStatus.js");
    initDownloaderToolsStatus();
    await tick();
    await tick();

    expect(document.getElementById("dl-tools-text").textContent).toBe(
      "Updates available",
    );
    expect(document.getElementById("dl-tools-action-label").textContent).toBe(
      "Update",
    );

    document.getElementById("dl-tools-action").click();
    await tick();
    await tick();

    expect(window.electron.tools.updateYtDlp).toHaveBeenCalledTimes(1);
    expect(window.electron.tools.updateFfmpeg).toHaveBeenCalledTimes(1);
    expect(
      document.getElementById("dl-tools-action").classList.contains("hidden"),
    ).toBe(true);
  });

  test("keeps CTA hidden when tools are installed and up to date", async () => {
    window.electron.tools.getVersions.mockResolvedValue({
      ytDlp: { ok: true, path: "/tmp/yt-dlp", version: "2024.01.01" },
      ffmpeg: {
        ok: true,
        path: "/tmp/ffmpeg",
        version: "ffmpeg version 7.1",
      },
      deno: { ok: true, path: "/tmp/deno", version: "deno 2.0.0" },
    });
    window.electron.tools.checkUpdates.mockResolvedValue({
      ytDlp: { current: "2024.01.01", latest: "2024.01.01" },
      ffmpeg: { current: "7.1", latest: "7.1" },
      deno: { current: "2.0.0", latest: "2.0.0" },
    });

    const { initDownloaderToolsStatus } =
      await import("../downloaderToolsStatus.js");
    initDownloaderToolsStatus();
    await tick();
    await tick();

    expect(
      document.getElementById("dl-tools-action").classList.contains("hidden"),
    ).toBe(true);
  });

  test("shows error state when update check fails without breaking footer CTA", async () => {
    window.electron.tools.getVersions.mockResolvedValue({
      ytDlp: { ok: true, path: "/tmp/yt-dlp", version: "2024.01.01" },
      ffmpeg: {
        ok: true,
        path: "/tmp/ffmpeg",
        version: "ffmpeg version 7.1",
      },
      deno: { ok: true, path: "/tmp/deno", version: "deno 2.0.0" },
    });
    window.electron.tools.checkUpdates.mockRejectedValue(new Error("boom"));

    const { initDownloaderToolsStatus } =
      await import("../downloaderToolsStatus.js");
    initDownloaderToolsStatus();
    await tick();
    await tick();

    expect(document.getElementById("dl-tools-text").textContent).toBe(
      "Tools check failed",
    );
    expect(
      document.getElementById("dl-tools-action").classList.contains("hidden"),
    ).toBe(true);
  });

  test("settings visibility event hides container until re-enabled", async () => {
    window.electron.tools.getVersions.mockResolvedValue({
      ytDlp: { ok: true, path: "/tmp/yt-dlp", version: "2024.01.01" },
      ffmpeg: {
        ok: true,
        path: "/tmp/ffmpeg",
        version: "ffmpeg version 7.1",
      },
      deno: { ok: true, path: "/tmp/deno", version: "deno 2.0.0" },
    });
    const { initDownloaderToolsStatus } =
      await import("../downloaderToolsStatus.js");
    initDownloaderToolsStatus();
    await tick();

    const container = document.getElementById("footer-tools-status");
    expect(container.classList.contains("hidden")).toBe(false);

    window.dispatchEvent(
      new CustomEvent("tools:visibility", { detail: { hidden: true } }),
    );
    expect(container.classList.contains("hidden")).toBe(true);
    expect(container.getAttribute("aria-hidden")).toBe("true");
    expect(localStorage.getItem("downloaderToolsStatusHidden")).toBe("1");

    window.dispatchEvent(
      new CustomEvent("tools:visibility", { detail: { hidden: false } }),
    );
    expect(container.classList.contains("hidden")).toBe(false);
    expect(container.getAttribute("aria-hidden")).toBe("false");
    expect(localStorage.getItem("downloaderToolsStatusHidden")).toBeNull();
  });
});
