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
        sortFilesByCategory: jest.fn().mockResolvedValue({
          success: true,
          dryRun: true,
          moved: 2,
          totalFiles: 2,
          skipped: 0,
          errors: [],
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

  test("opens launcher by default and shows power tool on macos", async () => {
    const el = await renderView();
    expect(
      el.querySelector("#tools-launcher")?.classList.contains("hidden"),
    ).toBe(false);
    expect(el.querySelector("#tools-open-wg")).not.toBeNull();
    expect(el.querySelector("#tools-open-hash")).not.toBeNull();
    expect(
      el.querySelector("#tools-open-power")?.classList.contains("hidden"),
    ).toBe(false);
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

  test("shows total tools counter for macos", async () => {
    const el = await renderView();
    expect(el.querySelector("#tools-launcher-tools-count")?.textContent).toBe(
      "tools.launcher.totalLabel: 4",
    );
  });

  test("does not render launcher hotkey labels", async () => {
    const el = await renderView();
    expect(el.querySelector("#tools-launcher-hotkeys")).toBeNull();
    expect(el.querySelector("#tools-launcher-shortcut-wg")).toBeNull();
    expect(el.querySelector("#tools-launcher-shortcut-hash")).toBeNull();
    expect(el.querySelector("#tools-launcher-shortcut-power")).toBeNull();
  });

  test("renders four launcher buttons on windows", async () => {
    window.electron.getPlatformInfo.mockResolvedValue({
      isWindows: true,
      platform: "win32",
    });
    const el = await renderView();
    expect(
      el.querySelector("#tools-open-power")?.classList.contains("hidden"),
    ).toBe(false);
    expect(el.querySelectorAll(".tools-launcher-button").length).toBe(4);
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

  test("sorter picks folder and stores selection", async () => {
    const el = await renderView();
    await openTool(el, "sorter");

    const pickBtn = el.querySelector("#sorter-pick-folder");
    const folderPill = el.querySelector("#sorter-folder-pill");

    pickBtn.click();
    await nextTick();

    expect(window.electron.tools.pickSorterFolder).toHaveBeenCalledTimes(1);
    expect(folderPill?.textContent).toBe("/tmp/sorter");
    expect(folderPill?.getAttribute("title")).toBe("/tmp/sorter");
    expect(localStorage.getItem("toolsSorterLastFolder")).toBe("/tmp/sorter");
  });

  test("sorter shows warning when run is clicked without folder", async () => {
    const el = await renderView();
    await openTool(el, "sorter");

    const runBtn = el.querySelector("#sorter-run");
    const result = el.querySelector("#sorter-result");

    runBtn.click();
    await nextTick();

    expect(window.electron.tools.sortFilesByCategory).not.toHaveBeenCalled();
    expect(result?.textContent).toBe("tools.sorter.needFolder");
    expect(result?.classList.contains("warning")).toBe(true);
  });

  test("sorter runs in dry-run mode and shows success summary", async () => {
    const el = await renderView();
    await openTool(el, "sorter");

    const pickBtn = el.querySelector("#sorter-pick-folder");
    const runBtn = el.querySelector("#sorter-run");
    const dryRun = el.querySelector("#sorter-dry-run");
    const logPath = el.querySelector("#sorter-log-path");
    const result = el.querySelector("#sorter-result");

    dryRun.checked = true;
    logPath.value = "~/sorter.log";

    pickBtn.click();
    await nextTick();
    runBtn.click();
    await nextTick();

    expect(window.electron.tools.sortFilesByCategory).toHaveBeenCalledWith({
      folderPath: "/tmp/sorter",
      dryRun: true,
      logFilePath: "~/sorter.log",
    });
    expect(result?.textContent).toContain("tools.sorter.done");
    expect(result?.textContent).toContain("tools.sorter.dryRunHint");
    expect(result?.classList.contains("success")).toBe(true);
  });

  test("sorter how-to modal opens and can navigate slides", async () => {
    const el = await renderView();
    await openTool(el, "sorter");

    const openBtn = el.querySelector("#sorter-open-howto");
    const modal = el.querySelector("#sorter-howto-modal");
    const track = el.querySelector("#sorter-howto-track");
    const prevBtn = el.querySelector("#sorter-howto-prev");
    const nextBtn = el.querySelector("#sorter-howto-next");

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

  test("sorter how-to modal closes by Escape and returns focus", async () => {
    const el = await renderView();
    await openTool(el, "sorter");

    const root = el.querySelector("#wireguard-view");
    const openBtn = el.querySelector("#sorter-open-howto");
    const modal = el.querySelector("#sorter-howto-modal");
    const closeBtn = el.querySelector("#sorter-howto-close");

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

  test("sorter how-to modal closes on overlay click", async () => {
    const el = await renderView();
    await openTool(el, "sorter");

    const openBtn = el.querySelector("#sorter-open-howto");
    const modal = el.querySelector("#sorter-howto-modal");

    openBtn.click();
    await nextTick();

    modal?.dispatchEvent(new MouseEvent("mousedown", { bubbles: true }));
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
    expect(secondaryActions?.querySelector("#wg-help")).not.toBeNull();
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

  test("shows power tool on macos but keeps windows actions disabled", async () => {
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

  test("opens WG help with localized keys", async () => {
    const el = await renderView();
    await openTool(el, "wg");
    const helpBtn = el.querySelector("#wg-help");
    helpBtn.click();
    expect(showConfirmationDialog).toHaveBeenCalledWith(
      expect.objectContaining({
        title: "wg.help.title",
        subtitle: "wg.help.subtitle",
        confirmText: "wg.help.confirm",
        message: "wg.help.messageHtml",
        singleButton: true,
        tone: "info",
      }),
    );
  });
});
