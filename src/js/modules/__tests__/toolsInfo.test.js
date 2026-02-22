import {
  renderToolsInfo,
  refreshToolsInfoState,
  __resetToolsInfoForTests,
} from "../toolsInfo";

jest.mock("../tooltipInitializer.js", () => ({
  initTooltips: jest.fn(),
}));

jest.mock("../modals.js", () => ({
  showConfirmationDialog: jest.fn(),
}));

describe("renderToolsInfo", () => {
  const versionPayload = {
    ytDlp: { ok: true, path: "/bin/yt-dlp", version: "2024.01.01" },
    ffmpeg: { ok: true, path: "/bin/ffmpeg", version: "ffmpeg version 7.1" },
    deno: { ok: true, path: "/bin/deno", version: "deno 1.42.0" },
  };
  const flush = () => new Promise((resolve) => setTimeout(resolve, 0));

  beforeEach(() => {
    __resetToolsInfoForTests();
    document.body.innerHTML = '<section id="tools-info"></section>';
    Object.defineProperty(window.navigator, "onLine", {
      value: true,
      configurable: true,
    });
    window.electron = {
      invoke: jest.fn().mockResolvedValue(undefined),
      tools: {
        getLocation: jest.fn().mockResolvedValue({
          success: true,
          path: "/tmp/tools",
          isDefault: false,
          defaultPath: "/opt/tools",
        }),
        getVersions: jest.fn().mockResolvedValue(versionPayload),
        installAll: jest.fn().mockResolvedValue(undefined),
        checkUpdates: jest.fn().mockResolvedValue(null),
        updateYtDlp: jest.fn().mockResolvedValue(undefined),
        updateFfmpeg: jest.fn().mockResolvedValue(undefined),
      },
    };
  });

  afterEach(() => {
    document.body.innerHTML = "";
    delete window.electron;
    jest.clearAllMocks();
  });

  it("renders dynamic tools UI with ti- prefixed ids", async () => {
    await renderToolsInfo();

    expect(document.getElementById("ti-tools-location-path")).not.toBeNull();
    expect(document.getElementById("tools-location-path")).toBeNull();
  });

  it("shows tools version summary when all tools exist", async () => {
    await renderToolsInfo();
    const cards = document.querySelectorAll(".tool-card");
    expect(cards.length).toBe(3);
    const versions = Array.from(cards).map((card) =>
      card.querySelector(".tool-card__version")?.textContent?.trim(),
    );
    expect(versions).toEqual(
      expect.arrayContaining(["2024.01.01", "7.1", "1.42.0"]),
    );
    const badge = document.getElementById("tools-summary-badge");
    expect(badge?.textContent).toMatch(/Готово|OK/i);
  });

  it("install button downloads when tools are missing", async () => {
    window.electron.tools.getVersions.mockResolvedValueOnce({
      ytDlp: { ok: false },
      ffmpeg: { ok: false },
      deno: { ok: true, path: "/bin/deno", version: "deno 1.42.0" },
    });
    await renderToolsInfo();
    const primary = document.getElementById("tools-install-btn");
    const label = primary?.querySelector("span");
    expect(label?.textContent).toMatch(/Скачать зависимости/i);
    primary?.click();
    await flush();
    expect(window.electron.tools.installAll).toHaveBeenCalledTimes(1);
  });

  it("check button reveals update flow when updates are available", async () => {
    window.electron.tools.getVersions.mockResolvedValueOnce({
      ytDlp: { ok: true, path: "/bin/yt-dlp", version: "2024.01.01" },
      ffmpeg: {
        ok: true,
        path: "/bin/ffmpeg",
        version: "ffmpeg version 7.1",
      },
      deno: { ok: true, path: "/bin/deno", version: "deno 1.42.0" },
    });
    window.electron.tools.checkUpdates.mockResolvedValueOnce({
      ytDlp: { current: "2024.01.01", latest: "2024.02.01" },
      ffmpeg: { current: "7.1", latest: "7.2" },
      deno: { current: "1.42.0", latest: "1.42.0" },
    });
    await renderToolsInfo();
    const checkBtn = document.getElementById("tools-check-btn");
    const updateBtn = document.getElementById("tools-update-btn");
    expect(checkBtn).not.toBeNull();
    checkBtn?.click();
    await flush(); // check updates completes and rewires button
    expect(window.electron.tools.checkUpdates).toHaveBeenCalled();
    expect(updateBtn?.style.display).toBe("");
    updateBtn?.click();
    await flush();
    expect(window.electron.tools.updateYtDlp).toHaveBeenCalled();
    expect(window.electron.tools.updateFfmpeg).toHaveBeenCalled();
  });

  it("force reinstall from overflow menu triggers installAll", async () => {
    await renderToolsInfo();
    // раскрываем меню "..."
    const moreBtn = document.getElementById("tools-more-btn");
    const forceBtn = document.getElementById("tools-force-btn");
    expect(moreBtn).not.toBeNull();
    expect(forceBtn).not.toBeNull();
    const { showConfirmationDialog } = require("../modals.js");
    showConfirmationDialog.mockResolvedValue(true);
    moreBtn?.click();
    forceBtn?.click();
    await flush();
    expect(window.electron.tools.installAll).toHaveBeenCalled();
  });

  it("updates summary after successful install", async () => {
    // первая загрузка — инструменты отсутствуют
    window.electron.tools.getVersions
      .mockResolvedValueOnce({
        ytDlp: { ok: false },
        ffmpeg: { ok: false },
        deno: { ok: false },
      })
      // после установки возвращаем корректные версии
      .mockResolvedValueOnce(versionPayload);

    await renderToolsInfo();
    const badgeBefore = document.getElementById("tools-summary-badge");
    expect(badgeBefore?.textContent).not.toMatch(/Готово/i);

    const installBtn = document.getElementById("tools-install-btn");
    installBtn?.click();
    await flush();

    const badgeAfter = document.getElementById("tools-summary-badge");
    expect(window.electron.tools.installAll).toHaveBeenCalled();
    expect(badgeAfter?.textContent).toMatch(/Готово|OK/i);
  });

  it("migrate button respects overwrite confirmation", async () => {
    window.electron.tools.detectLegacy = jest.fn().mockResolvedValue({
      success: true,
      found: [{ dir: "/old", tools: {} }],
    });
    window.electron.tools.migrateOld = jest
      .fn()
      .mockResolvedValue({ success: true, copied: ["/old/bin"], skipped: [] });

    const { showConfirmationDialog } = require("../modals.js");
    showConfirmationDialog.mockResolvedValueOnce(true);

    await renderToolsInfo();
    const migrateBtn = document.getElementById("ti-tools-location-migrate");
    expect(migrateBtn).not.toBeNull();
    migrateBtn?.click();
    await flush();
    expect(window.electron.tools.migrateOld).toHaveBeenCalledWith(
      expect.objectContaining({ overwrite: true }),
    );
  });

  it("does not recreate root DOM on repeated refresh", async () => {
    await renderToolsInfo();
    const rootBefore = document.getElementById("tools-panel");
    await refreshToolsInfoState({ force: true });
    const rootAfter = document.getElementById("tools-panel");
    expect(rootAfter).toBe(rootBefore);
  });

  it("keeps single-bound handlers across multiple refreshes", async () => {
    window.electron.tools.checkUpdates.mockResolvedValue({
      ytDlp: { current: "2024.01.01", latest: "2024.02.01" },
      ffmpeg: { current: "7.1", latest: "7.1" },
      deno: { current: "1.42.0", latest: "1.42.0" },
    });
    await renderToolsInfo();
    await refreshToolsInfoState({ force: true });
    await refreshToolsInfoState({ force: true });

    const checkBtn = document.getElementById("tools-check-btn");
    checkBtn?.click();
    await flush();

    expect(window.electron.tools.checkUpdates).toHaveBeenCalledTimes(1);
  });

  it("ignores stale refresh response and keeps latest state", async () => {
    await renderToolsInfo();

    let resolveFirst;
    const firstPromise = new Promise((resolve) => {
      resolveFirst = resolve;
    });
    const secondPayload = {
      ytDlp: { ok: true, path: "/bin/yt-dlp", version: "2025.01.01" },
      ffmpeg: { ok: true, path: "/bin/ffmpeg", version: "ffmpeg version 8.0" },
      deno: { ok: true, path: "/bin/deno", version: "deno 2.2.0" },
    };

    window.electron.tools.getVersions.mockReset();
    window.electron.tools.getVersions
      .mockImplementationOnce(() => firstPromise)
      .mockImplementationOnce(() => Promise.resolve(secondPayload));

    const p1 = refreshToolsInfoState({ force: true });
    const p2 = refreshToolsInfoState({ force: true });
    await p2;
    resolveFirst(versionPayload);
    await p1;
    await flush();

    const versions = Array.from(
      document.querySelectorAll(".tool-card__version"),
    )
      .map((el) => el.textContent.trim())
      .join(" ");
    expect(versions).toContain("2025.01.01");
    expect(versions).toContain("8.0");
  });

  it("reuses existing tool card nodes on refresh (partial update)", async () => {
    await renderToolsInfo();
    const ytBefore = document.querySelector('.tool-card[data-tool="yt"]');
    window.electron.tools.getVersions.mockResolvedValueOnce({
      ytDlp: { ok: true, path: "/bin/yt-dlp", version: "2026.01.01" },
      ffmpeg: { ok: true, path: "/bin/ffmpeg", version: "ffmpeg version 7.1" },
      deno: { ok: true, path: "/bin/deno", version: "deno 1.42.0" },
    });
    await refreshToolsInfoState({ force: true });
    const ytAfter = document.querySelector('.tool-card[data-tool="yt"]');
    expect(ytAfter).toBe(ytBefore);
    expect(ytAfter?.querySelector(".tool-card__version")?.textContent).toBe(
      "2026.01.01",
    );
  });

  it("uses cached checkUpdates result within TTL", async () => {
    const updatesPayload = {
      ytDlp: { current: "2024.01.01", latest: "2024.02.01" },
      ffmpeg: { current: "7.1", latest: "7.1" },
      deno: { current: "1.42.0", latest: "1.42.0" },
    };
    window.electron.tools.checkUpdates.mockResolvedValue(updatesPayload);
    await renderToolsInfo();
    const checkBtn = document.getElementById("tools-check-btn");
    checkBtn?.click();
    await flush();

    await new Promise((resolve) => setTimeout(resolve, 400));
    checkBtn?.click();
    await flush();

    expect(window.electron.tools.checkUpdates).toHaveBeenCalledTimes(1);
  });

  it("shows explicit offline summary state and quick actions", async () => {
    await renderToolsInfo();
    window.dispatchEvent(new Event("offline"));
    const panel = document.getElementById("tools-panel");
    const badge = document.getElementById("tools-summary-badge");
    const retryBtn = document.getElementById("tools-quick-retry-btn");
    const openBtn = document.getElementById("tools-quick-open-location-btn");
    expect(panel?.getAttribute("data-summary-state")).toBe("offline");
    expect(badge?.textContent).toMatch(/Офлайн|Offline/i);
    expect(retryBtn?.style.display).toBe("");
    expect(openBtn?.style.display).toBe("");
  });
});
