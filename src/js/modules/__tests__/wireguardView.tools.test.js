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

import renderWireGuard from "../views/wireguardView";
import { showConfirmationDialog } from "../modals";

const nextTick = () => new Promise((resolve) => setTimeout(resolve, 0));

async function renderView() {
  const el = renderWireGuard();
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
        : "#tools-open-power";
  el.querySelector(id)?.click();
  await nextTick();
}

describe("wireguardView quick actions", () => {
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
        calculateHash: jest.fn().mockResolvedValue({
          success: true,
          actualHash: "abcd",
          matches: null,
        }),
        createWindowsRestartShortcut: jest.fn().mockResolvedValue({
          success: false,
          unsupported: true,
        }),
        createWindowsShutdownShortcut: jest.fn().mockResolvedValue({
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

  test("opens launcher by default and shows two tools on non-windows", async () => {
    const el = await renderView();
    expect(el.querySelector("#tools-launcher")?.classList.contains("hidden")).toBe(
      false,
    );
    expect(el.querySelector("#tools-open-wg")).not.toBeNull();
    expect(el.querySelector("#tools-open-hash")).not.toBeNull();
    expect(el.querySelector("#tools-open-power")?.classList.contains("hidden")).toBe(
      true,
    );
  });

  test("renders three launcher buttons on windows", async () => {
    window.electron.getPlatformInfo.mockResolvedValue({
      isWindows: true,
      platform: "win32",
    });
    const el = await renderView();
    expect(el.querySelector("#tools-open-power")?.classList.contains("hidden")).toBe(
      false,
    );
  });

  test("restores last hash view from localStorage", async () => {
    localStorage.setItem("toolsLastView", "hash");
    const el = await renderView();
    expect(el.querySelector('#tools-launcher')?.classList.contains("hidden")).toBe(
      true,
    );
    expect(
      el.querySelector('[data-tool-view="hash"]')?.classList.contains("hidden"),
    ).toBe(false);
    expect(el.querySelector("#tools-back-btn")?.classList.contains("hidden")).toBe(
      false,
    );
  });

  test("falls back to launcher when last view power is unavailable", async () => {
    localStorage.setItem("toolsLastView", "power");
    window.electron.getPlatformInfo.mockResolvedValue({
      isWindows: false,
      platform: "linux",
    });
    const el = await renderView();
    expect(el.querySelector("#tools-launcher")?.classList.contains("hidden")).toBe(
      false,
    );
    expect(
      el.querySelector('[data-tool-view="power"]')?.classList.contains("hidden"),
    ).toBe(true);
  });

  test("does not render converter placeholder card", async () => {
    const el = await renderView();
    expect(el.textContent).not.toContain("quickActions.converter.title");
    expect(el.textContent).not.toContain("quickActions.soon");
  });

  test("opens WG view from launcher and shows back button", async () => {
    const el = await renderView();
    await openTool(el, "wg");
    expect(el.querySelector("#tools-launcher")?.classList.contains("hidden")).toBe(
      true,
    );
    expect(
      el.querySelector('[data-tool-view="wg"]')?.classList.contains("hidden"),
    ).toBe(false);
    expect(el.querySelector("#tools-back-btn")?.classList.contains("hidden")).toBe(
      false,
    );
  });

  test("back button returns to launcher", async () => {
    const el = await renderView();
    await openTool(el, "hash");
    el.querySelector("#tools-back-btn")?.click();
    await nextTick();
    expect(el.querySelector("#tools-launcher")?.classList.contains("hidden")).toBe(
      false,
    );
  });

  test("escape in tool view returns to launcher", async () => {
    const el = await renderView();
    await openTool(el, "hash");
    const root = el.querySelector("#wireguard-view");
    root?.dispatchEvent(new KeyboardEvent("keydown", { key: "Escape", bubbles: true }));
    await nextTick();
    expect(el.querySelector("#tools-launcher")?.classList.contains("hidden")).toBe(
      false,
    );
  });

  test("renders WG quick hierarchy with primary and secondary actions", async () => {
    const el = await renderView();
    await openTool(el, "wg");

    const quickCard = el.querySelector(".tools-card-wg-quick");
    const primarySend = quickCard?.querySelector("#wg-send");
    const secondaryLabel = quickCard?.querySelector(".tools-card__secondary-label");
    const secondaryActions = quickCard?.querySelector(".tools-card__secondary-actions");

    expect(primarySend).not.toBeNull();
    expect(secondaryLabel?.textContent).toBe("More actions");
    expect(secondaryActions?.querySelector("#wg-reset")).not.toBeNull();
    expect(secondaryActions?.querySelector("#wg-open-config-file")).not.toBeNull();
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
    const copyBtn = el.querySelector("#hash-copy-actual");
    const status = el.querySelector("#hash-status-badge");
    expect(copyBtn?.hasAttribute("disabled")).toBe(true);
    expect(status?.textContent).toBe("hashCheck.status.idle");
  });

  test("enables hash copy and copies actual hash after verify", async () => {
    const el = await renderView();
    await openTool(el, "hash");
    const pickBtn = el.querySelector("#hash-pick-file");
    const runBtn = el.querySelector("#hash-run");
    const copyBtn = el.querySelector("#hash-copy-actual");
    const status = el.querySelector("#hash-status-badge");
    const actual = el.querySelector("#hash-actual-value");

    pickBtn.click();
    await nextTick();
    runBtn.click();
    await nextTick();

    expect(status?.textContent).toBe("hashCheck.status.match");
    expect(actual?.textContent).toBe("abcd");
    expect(copyBtn?.hasAttribute("disabled")).toBe(false);

    copyBtn.click();
    await nextTick();

    expect(navigator.clipboard.writeText).toHaveBeenCalledWith("abcd");
    expect(copyBtn.querySelector("span")?.textContent).toBe(
      "hashCheck.copySuccess",
    );
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
    expect(algo.disabled).toBe(true);
    expect(expected.disabled).toBe(true);
    expect(panel.getAttribute("aria-busy")).toBe("true");

    resolveHash({ success: true, actualHash: "abcd", matches: true });
    await nextTick();

    expect(runBtn.disabled).toBe(false);
    expect(pickBtn.disabled).toBe(false);
    expect(algo.disabled).toBe(false);
    expect(expected.disabled).toBe(false);
    expect(panel.getAttribute("aria-busy")).toBe("false");
  });

  test("hides windows restart card on non-windows", async () => {
    const el = await renderView();
    await openTool(el, "power");
    const restartCard = el.querySelector("#tools-restart-card");
    expect(restartCard.classList.contains("hidden")).toBe(true);
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
    const restartBtn = el.querySelector("#create-restart-shortcut");

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
    const shutdownBtn = el.querySelector("#create-shutdown-shortcut");

    shutdownBtn.click();
    await nextTick();

    expect(showConfirmationDialog).toHaveBeenCalled();
    expect(
      window.electron.tools.createWindowsShutdownShortcut,
    ).not.toHaveBeenCalled();
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
