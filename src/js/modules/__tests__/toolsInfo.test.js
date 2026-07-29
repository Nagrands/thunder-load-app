import {
  __resetToolsInfoForTests,
  deactivateToolsInfo,
  destroyToolsInfo,
  installAllTools,
  refreshToolsInfoState,
  renderToolsInfo,
} from "../toolsInfo";

jest.mock("../tooltipInitializer.js", () => ({
  initTooltips: jest.fn(),
}));

jest.mock("../modals.js", () => ({
  showConfirmationDialog: jest.fn(),
}));

const versionPayload = {
  ytDlp: { ok: true, path: "/bin/yt-dlp", version: "2024.01.01" },
  ffmpeg: { ok: true, path: "/bin/ffmpeg", version: "ffmpeg version 7.1" },
  deno: { ok: true, path: "/bin/deno", version: "deno 1.42.0" },
};

const flush = () => new Promise((resolve) => setTimeout(resolve, 0));
const row = (id) => document.querySelector(`[data-tool="${id}"]`);
const menuTrigger = (id) =>
  document.querySelector(`[data-tool-menu-trigger="${id}"]`);

describe("tools dependency manager", () => {
  beforeEach(() => {
    __resetToolsInfoForTests();
    localStorage.clear();
    sessionStorage.clear();
    document.body.innerHTML = '<section id="tools-info"></section>';
    Object.defineProperty(window.navigator, "onLine", {
      value: true,
      configurable: true,
    });
    Object.defineProperty(window.navigator, "clipboard", {
      value: { writeText: jest.fn().mockResolvedValue(undefined) },
      configurable: true,
    });
    window.requestAnimationFrame = (callback) => callback();
    window.electron = {
      getPlatformInfo: jest.fn().mockResolvedValue({ platform: "darwin" }),
      invoke: jest.fn().mockResolvedValue(undefined),
      openExternal: jest.fn(),
      tools: {
        getLocation: jest.fn().mockResolvedValue({
          success: true,
          path: "/tmp/tools folder",
          isDefault: false,
          defaultPath: "/opt/tools",
        }),
        getVersions: jest.fn().mockResolvedValue(versionPayload),
        installAll: jest.fn().mockResolvedValue({ success: true }),
        checkUpdates: jest.fn().mockResolvedValue({
          ytDlp: { current: "2024.01.01", latest: "2024.01.01" },
          ffmpeg: { current: "7.1", latest: "7.1" },
          deno: { current: "1.42.0", latest: "1.42.0" },
        }),
        runDependencyAction: jest.fn().mockResolvedValue({
          success: true,
          toolId: "ytDlp",
          version: "2024.02.01",
        }),
        openLocation: jest.fn().mockResolvedValue({ success: true }),
        showInFolder: jest.fn().mockResolvedValue({ success: true }),
        setLocation: jest.fn().mockResolvedValue({ success: true }),
        resetLocation: jest.fn().mockResolvedValue({ success: true }),
      },
    };
  });

  afterEach(() => {
    destroyToolsInfo();
    document.body.innerHTML = "";
    delete window.electron;
    jest.clearAllMocks();
  });

  it("renders all dependencies as one structured list with real versions", async () => {
    await renderToolsInfo();

    expect(document.querySelectorAll(".dependency-row")).toHaveLength(3);
    expect(row("ytDlp")?.textContent).toContain("2024.01.01");
    expect(row("ffmpeg")?.textContent).toContain("7.1");
    expect(row("deno")?.textContent).toContain("1.42.0");
    expect(document.getElementById("tools-panel")?.dataset.summaryState).toBe(
      "ready",
    );
  });

  it("shows missing, unknown-version and error states without marking ready", async () => {
    window.electron.tools.getVersions.mockResolvedValueOnce({
      ytDlp: { ok: false, error: "missing" },
      ffmpeg: { ok: true, path: "/bin/ffmpeg", version: "" },
      deno: { ok: false, error: "<img src=x onerror=alert(1)>" },
    });

    await renderToolsInfo();

    expect(row("ytDlp")?.dataset.status).toBe("missing");
    expect(row("ffmpeg")?.dataset.status).toBe("unknown_version");
    expect(row("deno")?.dataset.status).toBe("error");
    expect(document.getElementById("tools-panel")?.dataset.summaryState).toBe(
      "error",
    );
    expect(document.querySelector("img[src='x']")).toBeNull();
  });

  it("does not install, update, or perform a network update check on open", async () => {
    await renderToolsInfo();

    expect(window.electron.tools.getVersions).toHaveBeenCalledTimes(1);
    expect(window.electron.tools.checkUpdates).not.toHaveBeenCalled();
    expect(window.electron.tools.installAll).not.toHaveBeenCalled();
    expect(window.electron.tools.runDependencyAction).not.toHaveBeenCalled();
  });

  it("shows cached state first and refreshes existing row nodes in place", async () => {
    localStorage.setItem(
      "toolsDependenciesSnapshotV2",
      JSON.stringify({
        tools: [
          {
            id: "ytDlp",
            installed: true,
            currentVersion: "cached",
            status: "installed",
            lastCheckedAt: 1,
          },
        ],
      }),
    );
    let resolveVersions;
    window.electron.tools.getVersions.mockImplementationOnce(
      () =>
        new Promise((resolve) => {
          resolveVersions = resolve;
        }),
    );

    const renderPromise = renderToolsInfo();
    await flush();
    const before = row("ytDlp");
    expect(before?.textContent).toContain("cached");
    resolveVersions(versionPayload);
    await renderPromise;

    expect(row("ytDlp")).toBe(before);
    expect(before?.textContent).toContain("2024.01.01");
  });

  it("checks updates once, blocks repeated clicks, and shows an update", async () => {
    let resolveCheck;
    window.electron.tools.checkUpdates.mockImplementationOnce(
      () =>
        new Promise((resolve) => {
          resolveCheck = resolve;
        }),
    );
    await renderToolsInfo();
    const button = document.getElementById("tools-check-btn");

    button.click();
    button.click();
    expect(button.disabled).toBe(true);
    expect(window.electron.tools.checkUpdates).toHaveBeenCalledTimes(1);

    resolveCheck({
      ytDlp: { current: "2024.01.01", latest: "2024.02.01" },
      ffmpeg: { current: "7.1", latest: "7.1" },
      deno: { current: "1.42.0", latest: "1.42.0" },
    });
    await flush();

    expect(row("ytDlp")?.dataset.status).toBe("update_available");
    expect(document.getElementById("tools-panel")?.dataset.summaryState).toBe(
      "updates_available",
    );
  });

  it("isolates a failed update check and exposes an error summary", async () => {
    window.electron.tools.checkUpdates.mockRejectedValueOnce(
      new Error("network failed"),
    );
    await renderToolsInfo();

    document.getElementById("tools-check-btn").click();
    await flush();

    expect(document.getElementById("tools-panel")?.dataset.summaryState).toBe(
      "error",
    );
    expect(row("ytDlp")?.dataset.status).toBe("error");
  });

  it("shows an explicit offline state without discarding local versions", async () => {
    Object.defineProperty(window.navigator, "onLine", {
      value: false,
      configurable: true,
    });

    await renderToolsInfo();

    expect(document.getElementById("tools-panel")?.dataset.summaryState).toBe(
      "offline",
    );
    expect(row("ytDlp")?.textContent).toContain("2024.01.01");
    expect(document.getElementById("tools-check-btn")?.disabled).toBe(true);
  });

  it("runs an individual update and reads the factual version again", async () => {
    const { showConfirmationDialog } = require("../modals.js");
    showConfirmationDialog.mockResolvedValue(true);
    window.electron.tools.checkUpdates.mockResolvedValueOnce({
      ytDlp: { current: "2024.01.01", latest: "2024.02.01" },
      ffmpeg: { current: "7.1", latest: "7.1" },
      deno: { current: "1.42.0", latest: "1.42.0" },
    });
    await renderToolsInfo();
    document.getElementById("tools-check-btn").click();
    await flush();

    menuTrigger("ytDlp").click();
    row("ytDlp").querySelector('[data-tool-action="update"]').click();
    await flush();

    expect(window.electron.tools.runDependencyAction).toHaveBeenCalledWith({
      id: "ytDlp",
      action: "update",
    });
    expect(window.electron.tools.getVersions).toHaveBeenCalledTimes(2);
  });

  it("offers install only for a missing dependency", async () => {
    window.electron.tools.getVersions.mockResolvedValueOnce({
      ...versionPayload,
      deno: { ok: false, error: "missing" },
    });
    await renderToolsInfo();

    menuTrigger("deno").click();
    const menu = row("deno").querySelector('[data-tool-menu="deno"]');
    expect(menu.querySelector('[data-tool-action="install"]')).not.toBeNull();
    expect(menu.querySelector('[data-tool-action="reinstall"]')).toBeNull();
  });

  it("closes context menu on Escape and restores trigger focus", async () => {
    await renderToolsInfo();
    const trigger = menuTrigger("ytDlp");
    trigger.click();
    expect(trigger.getAttribute("aria-expanded")).toBe("true");

    document.dispatchEvent(
      new KeyboardEvent("keydown", { key: "Escape", bubbles: true }),
    );

    expect(trigger.getAttribute("aria-expanded")).toBe("false");
    expect(document.activeElement).toBe(trigger);
  });

  it("moves through context-menu actions with arrow keys", async () => {
    await renderToolsInfo();
    menuTrigger("ytDlp").click();
    const items = Array.from(
      row("ytDlp").querySelectorAll('[role="menuitem"]:not(:disabled)'),
    );
    expect(document.activeElement).toBe(items[0]);

    document.dispatchEvent(
      new KeyboardEvent("keydown", { key: "ArrowDown", bubbles: true }),
    );
    expect(document.activeElement).toBe(items[1]);
    document.dispatchEvent(
      new KeyboardEvent("keydown", { key: "End", bubbles: true }),
    );
    expect(document.activeElement).toBe(items.at(-1));
  });

  it("copies the tool path and exposes the full value as a tooltip", async () => {
    await renderToolsInfo();
    const path = document.getElementById("ti-tools-location-path");

    expect(path.title).toBe("/tmp/tools folder");
    document.getElementById("ti-tools-location-copy").click();
    await flush();

    expect(navigator.clipboard.writeText).toHaveBeenCalledWith(
      "/tmp/tools folder",
    );
  });

  it.each([
    ["darwin", "Finder"],
    ["win32", "Проводнике"],
    ["linux", "файловом менеджере"],
  ])("uses the platform reveal label for %s", async (platform, label) => {
    window.electron.getPlatformInfo.mockResolvedValueOnce({ platform });
    await renderToolsInfo();

    expect(
      document.getElementById("ti-tools-location-reveal")?.textContent,
    ).toContain(label);
  });

  it("persists the advanced disclosure within the session with ARIA", async () => {
    await renderToolsInfo();
    const toggle = document.getElementById("tools-advanced-toggle");
    const panel = document.getElementById("tools-advanced-panel");

    expect(toggle.getAttribute("aria-controls")).toBe("tools-advanced-panel");
    expect(toggle.getAttribute("aria-expanded")).toBe("false");
    expect(panel.hidden).toBe(true);
    toggle.click();
    expect(toggle.getAttribute("aria-expanded")).toBe("true");
    expect(panel.hidden).toBe(false);

    destroyToolsInfo();
    await renderToolsInfo();
    expect(
      document
        .getElementById("tools-advanced-toggle")
        ?.getAttribute("aria-expanded"),
    ).toBe("true");
  });

  it("uses button and menu semantics for keyboard-accessible actions", async () => {
    await renderToolsInfo();

    expect(document.getElementById("tools-check-btn")?.tagName).toBe("BUTTON");
    expect(menuTrigger("ffmpeg")?.getAttribute("aria-haspopup")).toBe("menu");
    menuTrigger("ffmpeg").click();
    expect(
      row("ffmpeg")
        ?.querySelector('[data-tool-menu="ffmpeg"]')
        ?.getAttribute("role"),
    ).toBe("menu");
    expect(
      row("ffmpeg")
        ?.querySelector('[data-tool-action="check"]')
        ?.getAttribute("role"),
    ).toBe("menuitem");
  });

  it("removes handlers and ignores late async responses after deactivation", async () => {
    let resolveCheck;
    window.electron.tools.checkUpdates.mockImplementationOnce(
      () =>
        new Promise((resolve) => {
          resolveCheck = resolve;
        }),
    );
    await renderToolsInfo();
    document.getElementById("tools-check-btn").click();
    deactivateToolsInfo();
    resolveCheck({
      ytDlp: { current: "2024.01.01", latest: "2025.01.01" },
    });
    await flush();

    expect(row("ytDlp")?.dataset.status).toBe("installed");
    await refreshToolsInfoState({ force: true });
    expect(window.electron.tools.getVersions).toHaveBeenCalledTimes(2);
    destroyToolsInfo();
    const oldButton = document.getElementById("tools-check-btn");
    oldButton.click();
    expect(window.electron.tools.checkUpdates).toHaveBeenCalledTimes(1);
  });

  it("does not recreate the root during an explicit local refresh", async () => {
    await renderToolsInfo();
    const root = document.getElementById("tools-panel");
    await refreshToolsInfoState({ force: true });
    expect(document.getElementById("tools-panel")).toBe(root);
  });

  it("keeps the legacy installAll export and reports a missing bridge", async () => {
    await expect(installAllTools()).resolves.toEqual({ success: true });
    delete window.electron.tools.installAll;
    await expect(installAllTools()).rejects.toThrow(/недоступна|unavailable/i);
  });
});
