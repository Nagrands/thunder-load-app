jest.mock("../toast", () => ({
  showToast: jest.fn(),
}));

jest.mock("../modals", () => ({
  showConfirmationDialog: jest.fn(),
}));

jest.mock("../tooltipInitializer", () => ({
  initTooltips: jest.fn(),
}));

jest.mock("../i18n", () => ({
  applyI18n: jest.fn(),
  getLanguage: jest.fn(() => "en"),
  t: (key) => key,
}));

import renderToolsView from "../views/toolsView";
import { showConfirmationDialog } from "../modals";

const nextTick = () => new Promise((resolve) => setTimeout(resolve, 0));

async function renderView() {
  const el = renderToolsView();
  document.body.appendChild(el);
  await nextTick();
  return el;
}

async function openTool(el, tool) {
  const id =
    tool === "wg"
      ? "#tools-open-wg"
      : tool === "hash"
        ? "#tools-open-hash"
        : tool === "power"
          ? "#tools-open-power"
          : "#tools-open-sorter";
  el.querySelector(id)?.click();
  await nextTick();
}

describe("toolsView quick actions", () => {
  beforeEach(() => {
    showConfirmationDialog.mockReset();
    showConfirmationDialog.mockResolvedValue(true);
    localStorage.clear();
    delete window.__thunder_dev_tools_unlocked__;
    localStorage.setItem("wgUnlockDisabled", "false");
    document.body.innerHTML = "";

    window.electron = {
      tools: {
        pickFileForHash: jest.fn().mockResolvedValue({
          success: true,
          filePath: "/tmp/demo.bin",
        }),
        pickSorterFolder: jest.fn().mockResolvedValue({
          success: true,
          folderPath: "/tmp/sorter",
        }),
        openSorterFolder: jest.fn().mockResolvedValue({
          success: true,
          folderPath: "/tmp/sorter",
        }),
        exportSorterResult: jest.fn().mockResolvedValue({
          success: true,
          filePath: "/tmp/file-sorter.txt",
        }),
        sortFilesByCategory: jest.fn().mockResolvedValue({
          success: true,
          dryRun: true,
          moved: 2,
          totalFiles: 2,
          processedFiles: 2,
          skipped: 0,
          conflictMode: "rename",
          recursive: false,
          ignoreExtensions: [],
          ignoreFolders: [],
          categoryCount: {
            Images: 1,
            Documents: 1,
          },
          errors: [],
          operations: [
            {
              fileName: "first.txt",
              category: "Documents",
              targetPath: "/tmp/sorter/Documents/first.txt",
            },
            {
              fileName: "second.jpg",
              category: "Images",
              targetPath: "/tmp/sorter/Images/second.jpg",
            },
          ],
        }),
        calculateHash: jest.fn().mockResolvedValue({
          success: true,
          actualHash: "abcd",
          matches: null,
        }),
        createWindowsRestartShortcut: jest.fn().mockResolvedValue({
          success: false,
          unsupported: true,
        }),
        createWindowsUefiRebootShortcut: jest.fn().mockResolvedValue({
          success: false,
          unsupported: true,
        }),
        createWindowsAdvancedBootShortcut: jest.fn().mockResolvedValue({
          success: false,
          unsupported: true,
        }),
        createWindowsShutdownShortcut: jest.fn().mockResolvedValue({
          success: false,
          unsupported: true,
        }),
        createWindowsDeviceManagerShortcut: jest.fn().mockResolvedValue({
          success: false,
          unsupported: true,
        }),
        createWindowsNetworkSettingsShortcut: jest.fn().mockResolvedValue({
          success: false,
          unsupported: true,
        }),
      },
      getPlatformInfo: jest.fn().mockResolvedValue({
        isWindows: false,
        platform: "darwin",
      }),
      send: jest.fn(),
      ipcRenderer: {
        invoke: jest.fn(async (channel) => {
          if (channel === "wg-get-config") {
            return {
              ip: "127.0.0.1",
              rPort: 51820,
              lPort: 56132,
              msg: ")",
              autosend: false,
            };
          }
          if (channel === "get-auto-shutdown-status") return false;
          if (channel === "get-auto-shutdown-seconds") return 30;
          if (channel === "get-auto-shutdown-deadline") return null;
          return null;
        }),
        send: jest.fn(),
        on: jest.fn(),
        removeListener: jest.fn(),
      },
    };
    global.fetch = jest.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ tips: [] }),
    });
    Object.defineProperty(navigator, "clipboard", {
      value: {
        writeText: jest.fn().mockResolvedValue(undefined),
      },
      configurable: true,
    });
  });

  test("opens launcher by default and keeps power tool unavailable on macos", async () => {
    const el = await renderView();
    const powerBtn = el.querySelector("#tools-open-power");
    expect(
      el.querySelector("#tools-launcher")?.classList.contains("hidden"),
    ).toBe(false);
    expect(el.querySelector("#tools-open-wg")).not.toBeNull();
    expect(el.querySelector("#tools-open-hash")).not.toBeNull();
    expect(powerBtn?.classList.contains("hidden")).toBe(false);
    expect(powerBtn?.disabled).toBe(true);
    expect(powerBtn?.classList.contains("is-unavailable")).toBe(true);
    expect(
      powerBtn?.closest("#tools-launcher-unavailable-section"),
    ).not.toBeNull();
  });

  test("renders combined header with breadcrumbs and tools section header", async () => {
    const el = await renderView();
    const header = el.querySelector("#tools-launcher-header");
    const breadcrumbs = el.querySelector(".tools-breadcrumbs");
    expect(header).not.toBeNull();
    expect(header?.querySelector(".title-content")).not.toBeNull();
    expect(breadcrumbs).not.toBeNull();
    expect(header?.contains(breadcrumbs)).toBe(false);
    expect(el.querySelector("#tools-launcher-section-header")).not.toBeNull();
    expect(
      el
        .querySelector(".tools-launcher-section-title")
        ?.getAttribute("data-i18n"),
    ).toBe("tools.launcher.availableTitle");
  });

  test("uses localized launcher strings in initial markup", async () => {
    const el = await renderView();

    expect(el.querySelector("#tools-view-title")?.textContent?.trim()).toBe(
      "tools.launcher.title",
    );
    expect(
      el.querySelector(".tools-launcher-section-title")?.textContent?.trim(),
    ).toBe("tools.launcher.availableTitle");
    expect(
      el.querySelector(".tools-launcher-unavailable-title")?.textContent?.trim(),
    ).toBe("tools.launcher.unavailableTitle");
    expect(
      el.querySelector("#tools-back-btn")?.getAttribute("title"),
    ).toBe("tools.nav.back");
  });

  test("shows total tools counter for macos", async () => {
    const el = await renderView();
    expect(el.querySelector("#tools-launcher-tools-count")?.textContent).toBe(
      "tools.launcher.totalLabel: 3",
    );
  });

  test("does not render launcher hotkey labels", async () => {
    const el = await renderView();
    expect(el.querySelector("#tools-launcher-hotkeys")).toBeNull();
    expect(el.querySelector("#tools-launcher-shortcut-wg")).toBeNull();
    expect(el.querySelector("#tools-launcher-shortcut-hash")).toBeNull();
    expect(el.querySelector("#tools-launcher-shortcut-power")).toBeNull();
  });

  test("renders available and unavailable sections on windows", async () => {
    window.electron.getPlatformInfo.mockResolvedValue({
      isWindows: true,
      platform: "win32",
    });
    const el = await renderView();
    expect(
      el.querySelector("#tools-open-power")?.classList.contains("hidden"),
    ).toBe(false);
    expect(
      el.querySelectorAll(".tools-launcher-grid .tools-launcher-button").length,
    ).toBe(4);
    expect(
      el.querySelector("#tools-launcher-unavailable-section"),
    ).not.toBeNull();
    expect(
      el.querySelector("#tools-launcher-unavailable-section")?.classList.contains("hidden"),
    ).toBe(true);
  });

  test("opens launcher by default even if last tool is stored", async () => {
    localStorage.setItem("toolsLastView", "hash");
    const el = await renderView();
    expect(
      el.querySelector("#tools-launcher")?.classList.contains("hidden"),
    ).toBe(false);
    expect(
      el.querySelector('[data-tool-view="hash"]')?.classList.contains("hidden"),
    ).toBe(true);
  });

  test("restores last hash view when remember setting is enabled", async () => {
    localStorage.setItem("toolsRememberLastView", "true");
    localStorage.setItem("toolsLastView", "hash");
    const el = await renderView();
    expect(
      el.querySelector("#tools-launcher")?.classList.contains("hidden"),
    ).toBe(true);
    expect(
      el.querySelector('[data-tool-view="hash"]')?.classList.contains("hidden"),
    ).toBe(false);
    expect(
      el.querySelector("#tools-back-btn")?.classList.contains("hidden"),
    ).toBe(false);
  });

  test("falls back to launcher when last view power is unavailable", async () => {
    localStorage.setItem("toolsRememberLastView", "true");
    localStorage.setItem("toolsLastView", "power");
    window.electron.getPlatformInfo.mockResolvedValue({
      isWindows: false,
      platform: "linux",
    });
    const el = await renderView();
    expect(
      el.querySelector("#tools-launcher")?.classList.contains("hidden"),
    ).toBe(false);
    expect(
      el
        .querySelector('[data-tool-view="power"]')
        ?.classList.contains("hidden"),
    ).toBe(true);
    expect(el.querySelector("#tools-launcher-tools-count")?.textContent).toBe(
      "tools.launcher.totalLabel: 3",
    );
  });

  test("restores File Sorter when last view is remembered", async () => {
    localStorage.setItem("toolsRememberLastView", "true");
    localStorage.setItem("toolsLastView", "sorter");
    const el = await renderView();
    expect(
      el
        .querySelector('[data-tool-view="sorter"]')
        ?.classList.contains("hidden"),
    ).toBe(false);
  });

  test("shows File Sorter as available tool and opens it", async () => {
    const el = await renderView();
    const sorterBtn = el.querySelector("#tools-open-sorter");
    expect(
      sorterBtn?.closest(".tools-launcher-grid"),
    ).not.toBeNull();
    expect(sorterBtn?.disabled).toBe(false);

    sorterBtn?.click();
    await nextTick();
    expect(
      el
        .querySelector('[data-tool-view="sorter"]')
        ?.classList.contains("hidden"),
    ).toBe(false);
  });

  test("keeps File Sorter available when developer mode is enabled", async () => {
    window.__thunder_dev_tools_unlocked__ = true;
    const el = await renderView();
    const sorterBtn = el.querySelector("#tools-open-sorter");
    const powerBtn = el.querySelector("#tools-open-power");

    expect(sorterBtn?.disabled).toBe(false);
    expect(sorterBtn?.classList.contains("is-unavailable")).toBe(false);
    expect(powerBtn?.disabled).toBe(false);
    expect(powerBtn?.classList.contains("is-unavailable")).toBe(false);
    expect(el.querySelector("#tools-launcher-tools-count")?.textContent).toBe(
      "tools.launcher.totalLabel: 4",
    );

    sorterBtn?.click();
    await nextTick();
    expect(
      el
        .querySelector('[data-tool-view="sorter"]')
        ?.classList.contains("hidden"),
    ).toBe(false);
  });

  test("renders sorter rules and uses separate preview/apply actions", async () => {
    const el = await renderView();
    await openTool(el, "sorter");

    expect(el.querySelector(".sorter-workspace-panel")).not.toBeNull();
    expect(el.querySelector(".sorter-setup-grid")).not.toBeNull();
    expect(el.querySelector(".sorter-preview-layout")).not.toBeNull();
    expect(el.querySelector("#sorter-preview-list-count")).not.toBeNull();
    expect(el.querySelector("#sorter-breakdown-count")).not.toBeNull();
    expect(el.querySelector("#sorter-errors-count")).not.toBeNull();
    const rules = el.querySelectorAll("#sorter-rules-list .sorter-rule-card");
    expect(rules.length).toBe(6);
    expect(el.querySelector("#sorter-conflict-mode")).not.toBeNull();
    expect(el.querySelector("#sorter-recursive")).not.toBeNull();
    expect(el.querySelector("#sorter-ignore-extensions")).not.toBeNull();
    expect(el.querySelector("#sorter-ignore-folders")).not.toBeNull();
    expect(el.querySelector("#sorter-preview-run")).not.toBeNull();
    expect(el.querySelector("#sorter-apply-run")).not.toBeNull();
    expect(el.querySelector("#sorter-preview-search")).not.toBeNull();
    expect(el.querySelector("#sorter-preview-category-filter")).not.toBeNull();
    expect(el.querySelector("#sorter-preview-status-filter")).not.toBeNull();
    expect(el.querySelector("#sorter-export-format")).not.toBeNull();
    expect(el.querySelector("#sorter-copy-result")).not.toBeNull();
    expect(el.querySelector("#sorter-export-result")).not.toBeNull();
    expect(el.querySelector("#sorter-dry-run")).toBeNull();

    el.querySelector("#sorter-preview-run")?.click();
    await nextTick();

    expect(window.electron.tools.sortFilesByCategory).not.toHaveBeenCalled();

    el.querySelector("#sorter-pick-folder")?.click();
    await nextTick();
    el.querySelector("#sorter-conflict-mode").value = "skip";
    el.querySelector("#sorter-conflict-mode")?.dispatchEvent(
      new Event("change", { bubbles: true }),
    );
    el.querySelector("#sorter-recursive").checked = true;
    el.querySelector("#sorter-recursive")?.dispatchEvent(
      new Event("change", { bubbles: true }),
    );
    el.querySelector("#sorter-ignore-extensions").value = ".tmp, .part";
    el.querySelector("#sorter-ignore-folders").value = "Cache, temp";
    el.querySelector("#sorter-preview-run")?.click();
    await nextTick();

    expect(window.electron.tools.sortFilesByCategory).toHaveBeenLastCalledWith({
      folderPath: "/tmp/sorter",
      dryRun: true,
      logFilePath: "",
      conflictMode: "skip",
      recursive: true,
      ignoreExtensions: ".tmp, .part",
      ignoreFolders: "Cache, temp",
    });
    expect(
      el.querySelectorAll("#sorter-breakdown-list .sorter-breakdown-item")
        .length,
    ).toBe(2);
    expect(el.querySelector("#sorter-preview-list-count")?.textContent).toBe("2");
    expect(el.querySelector("#sorter-breakdown-count")?.textContent).toBe("2");
    el.querySelector("#sorter-preview-search").value = "second";
    el.querySelector("#sorter-preview-search")?.dispatchEvent(
      new Event("input", { bubbles: true }),
    );
    expect(
      el.querySelectorAll("#sorter-preview-list .sorter-preview-row").length,
    ).toBe(1);
    el.querySelector("#sorter-export-format").value = "json";
    el.querySelector("#sorter-copy-result")?.click();
    await nextTick();
    expect(navigator.clipboard.writeText).toHaveBeenCalledWith(
      expect.stringContaining('"fileName": "second.jpg"'),
    );
    el.querySelector("#sorter-export-result")?.click();
    await nextTick();
    expect(window.electron.tools.exportSorterResult).toHaveBeenCalledWith(
      expect.objectContaining({
        format: "json",
        suggestedName: expect.stringMatching(/\.json$/),
        content: expect.stringContaining('"fileName": "second.jpg"'),
      }),
    );
    expect(localStorage.getItem("toolsSorterConflictMode")).toBe("skip");
    expect(localStorage.getItem("toolsSorterRecursive")).toBe("true");

    window.electron.tools.sortFilesByCategory.mockClear();
    window.electron.tools.sortFilesByCategory.mockResolvedValueOnce({
      success: true,
      dryRun: false,
      moved: 1,
      totalFiles: 3,
      processedFiles: 2,
      skipped: 2,
      categoryCount: {
        Documents: 1,
      },
      errors: [{ fileName: "broken.txt", message: "Disk full" }],
      operations: [
        {
          fileName: "first.txt",
          category: "Documents",
          targetPath: "/tmp/sorter/Documents/first.txt",
          status: "moved",
          action: "move",
        },
        {
          fileName: "second.txt",
          category: "Documents",
          targetPath: "/tmp/sorter/Documents/second.txt",
          status: "skipped",
          action: "skip-existing",
        },
        {
          fileName: "ignored.tmp",
          category: "Other",
          targetPath: "/tmp/sorter/ignored.tmp",
          sourcePath: "/tmp/sorter/nested/ignored.tmp",
          relativeDir: "nested",
          status: "skipped",
          action: "ignored-extension",
          message: "Ignored by extension rule (.tmp)",
        },
        {
          fileName: "broken.txt",
          category: "Documents",
          targetPath: "/tmp/sorter/Documents/broken.txt",
          status: "error",
          action: "error",
          message: "Disk full",
        },
      ],
    });
    el.querySelector("#sorter-apply-run")?.click();
    await nextTick();

    expect(window.electron.tools.sortFilesByCategory).toHaveBeenLastCalledWith({
      folderPath: "/tmp/sorter",
      dryRun: false,
      logFilePath: "",
      conflictMode: "skip",
      recursive: true,
      ignoreExtensions: ".tmp, .part",
      ignoreFolders: "Cache, temp",
    });
    expect(el.querySelector("#sorter-preview-title")?.textContent).toBe(
      "tools.sorter.results.title",
    );
    expect(
      el.querySelector("#sorter-preview-panel")?.classList.contains("is-results"),
    ).toBe(true);
    expect(
      el.querySelectorAll("#sorter-errors-list .sorter-errors-row").length,
    ).toBe(3);
    expect(el.querySelector("#sorter-errors-count")?.textContent).toBe("3");
    expect(el.querySelector("#sorter-errors-list")?.textContent).toContain(
      "nested/ignored.tmp",
    );
    expect(el.querySelector("#sorter-errors-list")?.textContent).toContain(
      "Ignored by extension rule (.tmp)",
    );
  });

  test("does not render converter placeholder card", async () => {
    const el = await renderView();
    expect(el.textContent).not.toContain("quickActions.converter.title");
    expect(el.textContent).not.toContain("quickActions.soon");
  });

  test("opens WG view from launcher and shows back button", async () => {
    const el = await renderView();
    await openTool(el, "wg");
    expect(
      el.querySelector("#tools-launcher")?.classList.contains("hidden"),
    ).toBe(true);
    expect(
      el.querySelector('[data-tool-view="wg"]')?.classList.contains("hidden"),
    ).toBe(false);
    expect(
      el.querySelector("#tools-back-btn")?.classList.contains("hidden"),
    ).toBe(false);
  });

  test("back button returns to launcher", async () => {
    const el = await renderView();
    await openTool(el, "hash");
    el.querySelector("#tools-back-btn")?.click();
    await nextTick();
    expect(
      el.querySelector("#tools-launcher")?.classList.contains("hidden"),
    ).toBe(false);
  });

  test("breadcrumbs stay visible and return to launcher", async () => {
    const el = await renderView();
    await openTool(el, "wg");
    expect(
      el.querySelector("#tools-launcher-header")?.classList.contains("hidden"),
    ).toBe(false);
    expect(
      el
        .querySelector("#tools-breadcrumb-current")
        ?.classList.contains("hidden"),
    ).toBe(false);
    el.querySelector("#tools-breadcrumb-tools")?.click();
    await nextTick();
    expect(
      el.querySelector("#tools-launcher")?.classList.contains("hidden"),
    ).toBe(false);
  });

  test("escape in tool view returns to launcher", async () => {
    const el = await renderView();
    await openTool(el, "hash");
    const root = el.querySelector("#wireguard-view");
    root?.dispatchEvent(
      new KeyboardEvent("keydown", { key: "Escape", bubbles: true }),
    );
    await nextTick();
    expect(
      el.querySelector("#tools-launcher")?.classList.contains("hidden"),
    ).toBe(false);
  });

  test("Esc key variant in tool view returns to launcher", async () => {
    const el = await renderView();
    await openTool(el, "hash");
    const root = el.querySelector("#wireguard-view");
    root?.dispatchEvent(
      new KeyboardEvent("keydown", {
        key: "Esc",
        code: "Escape",
        bubbles: true,
      }),
    );
    await nextTick();
    expect(
      el.querySelector("#tools-launcher")?.classList.contains("hidden"),
    ).toBe(false);
  });

  test("launcher arrow navigation moves focus to next tool", async () => {
    const el = await renderView();
    const root = el.querySelector("#wireguard-view");
    const wgBtn = el.querySelector("#tools-open-wg");
    const hashBtn = el.querySelector("#tools-open-hash");
    wgBtn?.focus();
    root?.dispatchEvent(
      new KeyboardEvent("keydown", {
        key: "ArrowRight",
        bubbles: true,
      }),
    );
    await nextTick();
    expect(document.activeElement).toBe(hashBtn);
  });

  test("launcher arrow navigation supports reverse wrap", async () => {
    const el = await renderView();
    const root = el.querySelector("#wireguard-view");
    const wgBtn = el.querySelector("#tools-open-wg");
    const sorterBtn = el.querySelector("#tools-open-sorter");
    wgBtn?.focus();
    root?.dispatchEvent(
      new KeyboardEvent("keydown", {
        key: "ArrowLeft",
        bubbles: true,
      }),
    );
    await nextTick();
    expect(document.activeElement).toBe(sorterBtn);
  });

  test("does not switch tools with Alt+2", async () => {
    const el = await renderView();
    const root = el.querySelector("#wireguard-view");
    root?.dispatchEvent(
      new KeyboardEvent("keydown", {
        key: "2",
        code: "Digit2",
        altKey: true,
        bubbles: true,
      }),
    );
    await nextTick();
    expect(
      el.querySelector('[data-tool-view="hash"]')?.classList.contains("hidden"),
    ).toBe(true);
  });

  test("does not switch tools with Alt+1 while typing in hash input", async () => {
    const el = await renderView();
    await openTool(el, "hash");
    const expectedInput = el.querySelector("#hash-expected");
    expectedInput?.focus();
    const root = el.querySelector("#wireguard-view");
    root?.dispatchEvent(
      new KeyboardEvent("keydown", {
        key: "1",
        code: "Digit1",
        altKey: true,
        bubbles: true,
      }),
    );
    await nextTick();
    expect(
      el.querySelector('[data-tool-view="hash"]')?.classList.contains("hidden"),
    ).toBe(false);
    expect(
      el.querySelector('[data-tool-view="wg"]')?.classList.contains("hidden"),
    ).toBe(true);
  });

  test("hash how-to modal opens and can navigate slides", async () => {
    const el = await renderView();
    await openTool(el, "hash");

    const openBtn = el.querySelector("#hash-open-howto");
    const modal = el.querySelector("#hash-howto-modal");
    const track = el.querySelector("#hash-howto-track");
    const prevBtn = el.querySelector("#hash-howto-prev");
    const nextBtn = el.querySelector("#hash-howto-next");

    openBtn.click();
    await nextTick();

    expect(modal?.classList.contains("hidden")).toBe(false);
    expect(modal?.getAttribute("aria-hidden")).toBe("false");
    expect(prevBtn?.disabled).toBe(true);
    expect(nextBtn?.disabled).toBe(false);
    expect(track?.style.transform).toBe("translateX(-0%)");

    nextBtn.click();
    await nextTick();
    expect(prevBtn?.disabled).toBe(false);
    expect(track?.style.transform).toBe("translateX(-100%)");

    nextBtn.click();
    nextBtn.click();
    await nextTick();
    expect(nextBtn?.disabled).toBe(true);
    expect(track?.style.transform).toBe("translateX(-300%)");
  });

  test("hash how-to modal closes by Escape and returns focus", async () => {
    const el = await renderView();
    await openTool(el, "hash");

    const root = el.querySelector("#wireguard-view");
    const openBtn = el.querySelector("#hash-open-howto");
    const modal = el.querySelector("#hash-howto-modal");
    const closeBtn = el.querySelector("#hash-howto-close");

    openBtn.focus();
    openBtn.click();
    await nextTick();

    expect(document.activeElement).toBe(closeBtn);
    root?.dispatchEvent(
      new KeyboardEvent("keydown", {
        key: "Escape",
        bubbles: true,
      }),
    );
    await nextTick();

    expect(modal?.classList.contains("hidden")).toBe(true);
    expect(document.activeElement).toBe(openBtn);
  });

  test("hash how-to modal closes on overlay click", async () => {
    const el = await renderView();
    await openTool(el, "hash");

    const openBtn = el.querySelector("#hash-open-howto");
    const modal = el.querySelector("#hash-howto-modal");

    openBtn.click();
    await nextTick();

    modal?.dispatchEvent(new MouseEvent("mousedown", { bubbles: true }));
    await nextTick();

    expect(modal?.classList.contains("hidden")).toBe(true);
  });

  test("wg how-to modal opens and can navigate slides", async () => {
    const el = await renderView();
    await openTool(el, "wg");

    const openBtn = el.querySelector("#wg-open-howto");
    const modal = el.querySelector("#wg-howto-modal");
    const track = el.querySelector("#wg-howto-track");
    const prevBtn = el.querySelector("#wg-howto-prev");
    const nextBtn = el.querySelector("#wg-howto-next");

    openBtn.click();
    await nextTick();

    expect(modal?.classList.contains("hidden")).toBe(false);
    expect(modal?.getAttribute("aria-hidden")).toBe("false");
    expect(prevBtn?.disabled).toBe(true);
    expect(nextBtn?.disabled).toBe(false);
    expect(track?.style.transform).toBe("translateX(-0%)");

    nextBtn.click();
    await nextTick();
    expect(prevBtn?.disabled).toBe(false);
    expect(track?.style.transform).toBe("translateX(-100%)");

    nextBtn.click();
    nextBtn.click();
    await nextTick();
    expect(nextBtn?.disabled).toBe(true);
    expect(track?.style.transform).toBe("translateX(-300%)");
  });

  test("wg how-to modal closes by Escape and returns focus", async () => {
    const el = await renderView();
    await openTool(el, "wg");

    const root = el.querySelector("#wireguard-view");
    const openBtn = el.querySelector("#wg-open-howto");
    const modal = el.querySelector("#wg-howto-modal");
    const closeBtn = el.querySelector("#wg-howto-close");

    openBtn.focus();
    openBtn.click();
    await nextTick();

    expect(document.activeElement).toBe(closeBtn);
    root?.dispatchEvent(
      new KeyboardEvent("keydown", {
        key: "Escape",
        bubbles: true,
      }),
    );
    await nextTick();

    expect(modal?.classList.contains("hidden")).toBe(true);
    expect(document.activeElement).toBe(openBtn);
  });

  test("wg how-to modal closes on overlay click", async () => {
    const el = await renderView();
    await openTool(el, "wg");

    const openBtn = el.querySelector("#wg-open-howto");
    const modal = el.querySelector("#wg-howto-modal");

    openBtn.click();
    await nextTick();

    modal?.dispatchEvent(new MouseEvent("mousedown", { bubbles: true }));
    await nextTick();

    expect(modal?.classList.contains("hidden")).toBe(true);
  });

  test("power how-to modal opens and can navigate slides", async () => {
    const el = await renderView();
    await openTool(el, "power");

    const openBtn = el.querySelector("#power-open-howto");
    const modal = el.querySelector("#power-howto-modal");
    const track = el.querySelector("#power-howto-track");
    const prevBtn = el.querySelector("#power-howto-prev");
    const nextBtn = el.querySelector("#power-howto-next");

    openBtn.click();
    await nextTick();

    expect(modal?.classList.contains("hidden")).toBe(false);
    expect(modal?.getAttribute("aria-hidden")).toBe("false");
    expect(prevBtn?.disabled).toBe(true);
    expect(nextBtn?.disabled).toBe(false);
    expect(track?.style.transform).toBe("translateX(-0%)");

    nextBtn.click();
    await nextTick();
    expect(prevBtn?.disabled).toBe(false);
    expect(track?.style.transform).toBe("translateX(-100%)");

    nextBtn.click();
    nextBtn.click();
    await nextTick();
    expect(nextBtn?.disabled).toBe(true);
    expect(track?.style.transform).toBe("translateX(-300%)");
  });

  test("power how-to modal closes by Escape and returns focus", async () => {
    const el = await renderView();
    await openTool(el, "power");

    const root = el.querySelector("#wireguard-view");
    const openBtn = el.querySelector("#power-open-howto");
    const modal = el.querySelector("#power-howto-modal");
    const closeBtn = el.querySelector("#power-howto-close");

    openBtn.focus();
    openBtn.click();
    await nextTick();

    expect(document.activeElement).toBe(closeBtn);
    root?.dispatchEvent(
      new KeyboardEvent("keydown", {
        key: "Escape",
        bubbles: true,
      }),
    );
    await nextTick();

    expect(modal?.classList.contains("hidden")).toBe(true);
    expect(document.activeElement).toBe(openBtn);
  });

  test("power how-to modal closes on overlay click", async () => {
    const el = await renderView();
    await openTool(el, "power");

    const openBtn = el.querySelector("#power-open-howto");
    const modal = el.querySelector("#power-howto-modal");

    openBtn.click();
    await nextTick();

    modal?.dispatchEvent(new MouseEvent("mousedown", { bubbles: true }));
    await nextTick();

    expect(modal?.classList.contains("hidden")).toBe(true);
  });

  test("sorter how-to modal opens and can navigate slides", async () => {
    const el = await renderView();
    await openTool(el, "sorter");

    const openBtn = el.querySelector("#sorter-open-howto");
    const modal = el.querySelector("#sorter-howto-modal");
    const nextBtn = el.querySelector("#sorter-howto-next");
    const closeBtn = el.querySelector("#sorter-howto-close");
    const track = el.querySelector("#sorter-howto-track");

    openBtn?.click();
    await nextTick();

    expect(modal?.classList.contains("hidden")).toBe(false);
    expect(track?.style.transform).toBe("translateX(-0%)");

    nextBtn?.click();
    await nextTick();

    expect(track?.style.transform).toBe("translateX(-100%)");

    closeBtn?.click();
    await nextTick();

    expect(modal?.classList.contains("hidden")).toBe(true);
  });

  test("renders WG quick hierarchy with primary and secondary actions", async () => {
    const el = await renderView();
    await openTool(el, "wg");

    const quickCard = el.querySelector(".tools-card-wg-quick");
    const primarySend = quickCard?.querySelector("#wg-send");
    const secondaryLabel = quickCard?.querySelector(
      ".tools-card__secondary-label",
    );
    const secondaryActions = quickCard?.querySelector(
      ".tools-card__secondary-actions",
    );

    expect(primarySend).not.toBeNull();
    expect(secondaryLabel?.textContent).toBe("More actions");
    expect(secondaryActions?.querySelector("#wg-reset")).not.toBeNull();
    expect(
      secondaryActions?.querySelector("#wg-open-config-file"),
    ).not.toBeNull();
    expect(secondaryActions?.querySelector("#wg-help")).toBeNull();
  });

  test("keeps WG advanced collapsed by default", async () => {
    const el = await renderView();
    await openTool(el, "wg");

    const btn = el.querySelector("#tools-wg-advanced-toggle");
    const panel = el.querySelector("#tools-wg-advanced-panel");
    expect(btn?.getAttribute("aria-expanded")).toBe("false");
    expect(panel?.classList.contains("is-collapsed")).toBe(true);
    expect(panel?.classList.contains("is-open")).toBe(false);
    expect(panel?.getAttribute("aria-hidden")).toBe("true");
  });

  test("toggles WG advanced panel and persists state", async () => {
    const el = await renderView();
    await openTool(el, "wg");

    const btn = el.querySelector("#tools-wg-advanced-toggle");
    const panel = el.querySelector("#tools-wg-advanced-panel");
    const ip = el.querySelector("#wg-ip");

    btn.click();
    expect(panel.classList.contains("is-open")).toBe(true);
    expect(btn.getAttribute("aria-expanded")).toBe("true");
    expect(panel.getAttribute("aria-hidden")).toBe("false");
    expect(localStorage.getItem("toolsWgAdvancedOpen")).toBe("1");
    expect(document.activeElement).toBe(ip);

    btn.click();
    expect(panel.classList.contains("is-collapsed")).toBe(true);
    expect(btn.getAttribute("aria-expanded")).toBe("false");
    expect(panel.getAttribute("aria-hidden")).toBe("true");
    expect(localStorage.getItem("toolsWgAdvancedOpen")).toBe("0");
    expect(document.activeElement).toBe(btn);
  });

  test("does not send WG request on Enter inside hash input", async () => {
    const el = await renderView();
    await openTool(el, "hash");

    const hashExpected = el.querySelector("#hash-expected");
    hashExpected.focus();
    hashExpected.dispatchEvent(
      new KeyboardEvent("keydown", { key: "Enter", bubbles: true }),
    );
    await nextTick();

    const sendCalls = window.electron.ipcRenderer.invoke.mock.calls.filter(
      ([channel]) => channel === "wg-send-udp",
    );
    expect(sendCalls).toHaveLength(0);
  });

  test("sends WG request on Enter inside WG form", async () => {
    const el = await renderView();
    await openTool(el, "wg");

    const toggle = el.querySelector("#tools-wg-advanced-toggle");
    const wgIp = el.querySelector("#wg-ip");
    toggle.click();
    wgIp.focus();
    wgIp.dispatchEvent(
      new KeyboardEvent("keydown", { key: "Enter", bubbles: true }),
    );
    await nextTick();

    const sendCalls = window.electron.ipcRenderer.invoke.mock.calls.filter(
      ([channel]) => channel === "wg-send-udp",
    );
    expect(sendCalls).toHaveLength(1);
  });

  test("keeps hash copy disabled in idle state", async () => {
    const el = await renderView();
    await openTool(el, "hash");
    const copyFirstBtn = el.querySelector("#hash-copy-actual-1");
    const copySecondBtn = el.querySelector("#hash-copy-actual-2");
    const status = el.querySelector("#hash-status-badge");
    expect(copyFirstBtn?.hasAttribute("disabled")).toBe(true);
    expect(copySecondBtn?.hasAttribute("disabled")).toBe(true);
    expect(status?.textContent).toBe("hashCheck.status.idle");
  });

  test("enables hash copy and copies actual hash after verify", async () => {
    const el = await renderView();
    await openTool(el, "hash");
    const pickBtn = el.querySelector("#hash-pick-file");
    const runBtn = el.querySelector("#hash-run");
    const copyBtn = el.querySelector("#hash-copy-actual-1");
    const status = el.querySelector("#hash-status-badge");
    const actual = el.querySelector("#hash-actual-value");
    const copyFeedback = el.querySelector("#hash-copy-feedback-1");

    pickBtn.click();
    await nextTick();
    runBtn.click();
    await nextTick();

    expect(status?.textContent).toBe("hashCheck.status.calculated");
    expect(actual?.textContent).toBe("abcd");
    expect(copyBtn?.hasAttribute("disabled")).toBe(false);

    copyBtn.click();
    await nextTick();

    expect(navigator.clipboard.writeText).toHaveBeenCalledWith("abcd");
    expect(copyBtn.querySelector("span")).toBeNull();
    expect(copyBtn.querySelector("i")?.classList.contains("fa-check")).toBe(
      true,
    );
    expect(copyFeedback?.textContent).toBe("hashCheck.copySuccess");
  });

  test("compares two selected files by hash", async () => {
    window.electron.tools.pickFileForHash
      .mockResolvedValueOnce({
        success: true,
        filePath: "/tmp/file-a.bin",
      })
      .mockResolvedValueOnce({
        success: true,
        filePath: "/tmp/file-b.bin",
      });
    window.electron.tools.calculateHash
      .mockResolvedValueOnce({
        success: true,
        actualHash: "ffff",
        matches: null,
      })
      .mockResolvedValueOnce({
        success: true,
        actualHash: "ffff",
        matches: null,
      });

    const el = await renderView();
    await openTool(el, "hash");

    const pickFirstBtn = el.querySelector("#hash-pick-file");
    const pickSecondBtn = el.querySelector("#hash-pick-file-2");
    const runBtn = el.querySelector("#hash-run");
    const status = el.querySelector("#hash-status-badge");
    const result = el.querySelector("#hash-result");
    const actualFirst = el.querySelector("#hash-actual-value");
    const actualSecond = el.querySelector("#hash-actual-value-2");
    const secondBox = el.querySelector("#hash-actual-box-2");
    const compareDetails = el.querySelector("#hash-compare-details");
    const compareNameFirst = el.querySelector("#hash-compare-name-1");
    const compareNameSecond = el.querySelector("#hash-compare-name-2");
    const compareFirst = el.querySelector("#hash-compare-state-1");
    const compareSecond = el.querySelector("#hash-compare-state-2");
    const copyFirstBtn = el.querySelector("#hash-copy-actual-1");
    const copySecondBtn = el.querySelector("#hash-copy-actual-2");

    pickFirstBtn.click();
    await nextTick();
    pickSecondBtn.click();
    await nextTick();
    runBtn.click();
    await nextTick();

    expect(window.electron.tools.calculateHash).toHaveBeenCalledTimes(2);
    expect(status?.textContent).toBe("hashCheck.status.match");
    expect(result?.textContent).toBe("hashCheck.filesCompared");
    expect(actualFirst?.textContent).toBe("ffff");
    expect(actualSecond?.textContent).toBe("ffff");
    expect(secondBox?.classList.contains("hidden")).toBe(false);
    expect(compareDetails?.classList.contains("hidden")).toBe(false);
    expect(compareNameFirst?.textContent).toBe("file-a.bin");
    expect(compareNameSecond?.textContent).toBe("file-b.bin");
    expect(compareFirst?.textContent).toBe("hashCheck.compareState.match");
    expect(compareSecond?.textContent).toBe("hashCheck.compareState.match");
    expect(copyFirstBtn?.hasAttribute("disabled")).toBe(false);
    expect(copySecondBtn?.hasAttribute("disabled")).toBe(false);

    copySecondBtn.click();
    await nextTick();
    expect(navigator.clipboard.writeText).toHaveBeenCalledWith("ffff");
  });

  test("clears second file selection and falls back to single-file verify", async () => {
    window.electron.tools.pickFileForHash
      .mockResolvedValueOnce({
        success: true,
        filePath: "/tmp/file-a.bin",
      })
      .mockResolvedValueOnce({
        success: true,
        filePath: "/tmp/file-b.bin",
      });

    const el = await renderView();
    await openTool(el, "hash");

    const pickFirstBtn = el.querySelector("#hash-pick-file");
    const pickSecondBtn = el.querySelector("#hash-pick-file-2");
    const clearSecondBtn = el.querySelector("#hash-clear-file-2");
    const secondFilePill = el.querySelector("#hash-file-name-2");
    const runBtn = el.querySelector("#hash-run");

    pickFirstBtn.click();
    await nextTick();
    pickSecondBtn.click();
    await nextTick();

    expect(clearSecondBtn?.hasAttribute("disabled")).toBe(false);
    expect(secondFilePill?.textContent).toBe("file-b.bin");

    clearSecondBtn.click();
    await nextTick();

    expect(clearSecondBtn?.hasAttribute("disabled")).toBe(true);
    expect(secondFilePill?.textContent).toBe("hashCheck.noFileSecond");

    runBtn.click();
    await nextTick();

    expect(window.electron.tools.calculateHash).toHaveBeenCalledTimes(1);
  });

  test("normalizes expected hash before single-file verification", async () => {
    const el = await renderView();
    await openTool(el, "hash");

    const pickBtn = el.querySelector("#hash-pick-file");
    const expected = el.querySelector("#hash-expected");
    const runBtn = el.querySelector("#hash-run");

    pickBtn.click();
    await nextTick();
    expected.value = "AA bb \n cc";
    runBtn.click();
    await nextTick();

    expect(window.electron.tools.calculateHash).toHaveBeenCalledWith(
      expect.objectContaining({
        expectedHash: "aabbcc",
      }),
    );
  });

  test("when expected hash is set, compares expected against both files", async () => {
    window.electron.tools.pickFileForHash
      .mockResolvedValueOnce({
        success: true,
        filePath: "/tmp/file-a.bin",
      })
      .mockResolvedValueOnce({
        success: true,
        filePath: "/tmp/file-b.bin",
      });
    window.electron.tools.calculateHash
      .mockResolvedValueOnce({
        success: true,
        actualHash: "aaaa",
        matches: null,
      })
      .mockResolvedValueOnce({
        success: true,
        actualHash: "bbbb",
        matches: null,
      });

    const el = await renderView();
    await openTool(el, "hash");

    const pickFirstBtn = el.querySelector("#hash-pick-file");
    const pickSecondBtn = el.querySelector("#hash-pick-file-2");
    const expected = el.querySelector("#hash-expected");
    const runBtn = el.querySelector("#hash-run");
    const status = el.querySelector("#hash-status-badge");
    const result = el.querySelector("#hash-result");
    const compareFirst = el.querySelector("#hash-compare-state-1");
    const compareSecond = el.querySelector("#hash-compare-state-2");

    pickFirstBtn.click();
    await nextTick();
    pickSecondBtn.click();
    await nextTick();
    expected.value = "bbbb";
    runBtn.click();
    await nextTick();

    expect(status?.textContent).toBe("hashCheck.status.match");
    expect(result?.textContent).toBe("hashCheck.expectedCompared");
    expect(compareFirst?.textContent).toBe("hashCheck.compareState.mismatch");
    expect(compareSecond?.textContent).toBe("hashCheck.compareState.match");
  });

  test("locks hash controls while hash is calculating", async () => {
    let resolveHash;
    window.electron.tools.calculateHash.mockImplementationOnce(
      () =>
        new Promise((resolve) => {
          resolveHash = resolve;
        }),
    );
    const el = await renderView();
    await openTool(el, "hash");

    const pickBtn = el.querySelector("#hash-pick-file");
    const pickSecondBtn = el.querySelector("#hash-pick-file-2");
    const runBtn = el.querySelector("#hash-run");
    const algo = el.querySelector("#hash-algorithm");
    const expected = el.querySelector("#hash-expected");
    const panel = el.querySelector("#hash-result-panel");

    pickBtn.click();
    await nextTick();
    runBtn.click();
    await nextTick();

    expect(runBtn.disabled).toBe(true);
    expect(pickBtn.disabled).toBe(true);
    expect(pickSecondBtn.disabled).toBe(true);
    expect(algo.disabled).toBe(true);
    expect(expected.disabled).toBe(true);
    expect(panel.getAttribute("aria-busy")).toBe("true");

    resolveHash({ success: true, actualHash: "abcd", matches: true });
    await nextTick();

    expect(runBtn.disabled).toBe(false);
    expect(pickBtn.disabled).toBe(false);
    expect(pickSecondBtn.disabled).toBe(false);
    expect(algo.disabled).toBe(false);
    expect(expected.disabled).toBe(false);
    expect(panel.getAttribute("aria-busy")).toBe("false");
  });

  test("shows power tool on macos in developer mode but keeps windows actions disabled", async () => {
    window.__thunder_dev_tools_unlocked__ = true;
    const el = await renderView();
    await openTool(el, "power");
    const restartCard = el.querySelector("#tools-restart-card");
    const banner = el.querySelector("#power-platform-banner");
    const actionsWrap = el.querySelector(".power-shortcuts-actions");
    const restartBtn = el.querySelector("#create-restart-shortcut");
    const uefiBtn = el.querySelector("#create-uefi-shortcut");
    const advancedBootBtn = el.querySelector("#create-advanced-boot-shortcut");
    const shutdownBtn = el.querySelector("#create-shutdown-shortcut");
    const deviceManagerBtn = el.querySelector(
      "#create-device-manager-shortcut",
    );
    const networkSettingsBtn = el.querySelector(
      "#create-network-settings-shortcut",
    );
    expect(restartCard.classList.contains("hidden")).toBe(false);
    expect(actionsWrap).not.toBeNull();
    expect(banner?.classList.contains("hidden")).toBe(false);
    expect(restartBtn?.hasAttribute("disabled")).toBe(true);
    expect(uefiBtn?.hasAttribute("disabled")).toBe(true);
    expect(advancedBootBtn?.hasAttribute("disabled")).toBe(true);
    expect(shutdownBtn?.hasAttribute("disabled")).toBe(true);
    expect(deviceManagerBtn?.hasAttribute("disabled")).toBe(true);
    expect(networkSettingsBtn?.hasAttribute("disabled")).toBe(true);
  });

  test("hides power tool on linux", async () => {
    window.electron.getPlatformInfo.mockResolvedValue({
      isWindows: false,
      platform: "linux",
    });
    const el = await renderView();
    const openPowerBtn = el.querySelector("#tools-open-power");
    expect(openPowerBtn?.classList.contains("hidden")).toBe(true);
  });

  test("falls back to launcher when last view power is remembered on macos without developer mode", async () => {
    localStorage.setItem("toolsRememberLastView", "true");
    localStorage.setItem("toolsLastView", "power");
    const el = await renderView();
    expect(
      el.querySelector("#tools-launcher")?.classList.contains("hidden"),
    ).toBe(false);
    expect(
      el
        .querySelector('[data-tool-view="power"]')
        ?.classList.contains("hidden"),
    ).toBe(true);
  });

  test("asks confirmation before restart shortcut IPC call", async () => {
    window.electron.getPlatformInfo.mockResolvedValue({
      isWindows: true,
      platform: "win32",
    });
    window.electron.tools.createWindowsRestartShortcut.mockResolvedValue({
      success: true,
      path: "C:\\Users\\Demo\\Desktop\\Restart Windows.lnk",
    });
    const el = await renderView();
    await openTool(el, "power");
    const banner = el.querySelector("#power-platform-banner");
    const restartBtn = el.querySelector("#create-restart-shortcut");

    expect(banner?.classList.contains("hidden")).toBe(true);
    expect(restartBtn?.hasAttribute("disabled")).toBe(false);
    restartBtn.click();
    await nextTick();

    expect(showConfirmationDialog).toHaveBeenCalled();
    expect(
      window.electron.tools.createWindowsRestartShortcut,
    ).toHaveBeenCalledTimes(1);
    expect(el.querySelector("#restart-shortcut-result")?.textContent).toBe(
      "quickActions.restart.created",
    );
  });

  test("does not call shutdown IPC when confirmation is cancelled", async () => {
    showConfirmationDialog.mockResolvedValueOnce(false);
    window.electron.getPlatformInfo.mockResolvedValue({
      isWindows: true,
      platform: "win32",
    });
    const el = await renderView();
    await openTool(el, "power");
    const banner = el.querySelector("#power-platform-banner");
    const shutdownBtn = el.querySelector("#create-shutdown-shortcut");

    expect(banner?.classList.contains("hidden")).toBe(true);
    expect(shutdownBtn?.hasAttribute("disabled")).toBe(false);
    shutdownBtn.click();
    await nextTick();

    expect(showConfirmationDialog).toHaveBeenCalled();
    expect(
      window.electron.tools.createWindowsShutdownShortcut,
    ).not.toHaveBeenCalled();
  });

  test("creates UEFI shortcut on windows", async () => {
    window.electron.getPlatformInfo.mockResolvedValue({
      isWindows: true,
      platform: "win32",
    });
    window.electron.tools.createWindowsUefiRebootShortcut.mockResolvedValue({
      success: true,
      path: "C:\\Users\\Demo\\Desktop\\Restart to UEFI.lnk",
    });
    const el = await renderView();
    await openTool(el, "power");
    const uefiBtn = el.querySelector("#create-uefi-shortcut");

    expect(uefiBtn?.hasAttribute("disabled")).toBe(false);
    uefiBtn.click();
    await nextTick();

    expect(showConfirmationDialog).toHaveBeenCalled();
    expect(
      window.electron.tools.createWindowsUefiRebootShortcut,
    ).toHaveBeenCalledTimes(1);
    expect(el.querySelector("#uefi-shortcut-result")?.textContent).toBe(
      "quickActions.uefi.created",
    );
  });
});
