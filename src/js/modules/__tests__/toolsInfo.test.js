import { renderToolsInfo } from "../toolsInfo";

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

  it("primary button downloads when tools are missing", async () => {
    window.electron.tools.getVersions.mockResolvedValueOnce({
      ytDlp: { ok: false },
      ffmpeg: { ok: false },
      deno: { ok: true, path: "/bin/deno", version: "deno 1.42.0" },
    });
    await renderToolsInfo();
    const primary = document.getElementById("tools-primary-btn");
    const label = document.getElementById("tools-primary-label");
    expect(label?.textContent).toMatch(/Скачать зависимости/i);
    primary?.click();
    await flush();
    expect(window.electron.tools.installAll).toHaveBeenCalledTimes(1);
  });

  it("primary button switches to update flow when updates are available", async () => {
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
    const primary = document.getElementById("tools-primary-btn");
    expect(primary).not.toBeNull();
    primary?.click();
    await flush(); // check updates completes and rewires button
    expect(window.electron.tools.checkUpdates).toHaveBeenCalled();
    // second click triggers selective update
    primary?.click();
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
    // имитируем отсутствие модалки подтверждения (в тестах showConfirmationDialog замокан)
    const { showConfirmationDialog } = require("../modals.js");
    showConfirmationDialog.mockImplementation((_, ok) => ok());
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

    const primary = document.getElementById("tools-primary-btn");
    primary?.click();
    await flush();

    const badgeAfter = document.getElementById("tools-summary-badge");
    expect(window.electron.tools.installAll).toHaveBeenCalled();
    expect(badgeAfter?.textContent).toMatch(/Готово|OK/i);
  });
});
