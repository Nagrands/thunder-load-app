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

  test("renders hash check controls in tools view", async () => {
    const el = renderWireGuard();
    document.body.appendChild(el);

    await new Promise((resolve) => setTimeout(resolve, 0));

    expect(el.querySelector("#hash-pick-file")).not.toBeNull();
    expect(el.querySelector("#hash-run")).not.toBeNull();
    expect(el.querySelector("#hash-result-panel")).not.toBeNull();
    expect(el.querySelector("#hash-status-badge")).not.toBeNull();
    expect(el.querySelector("#hash-actual-value")).not.toBeNull();
    expect(el.querySelector("#hash-copy-actual")).not.toBeNull();
    expect(el.querySelector("#create-restart-shortcut")).not.toBeNull();
    expect(el.querySelector("#create-shutdown-shortcut")).not.toBeNull();
  });

  test("keeps hash copy disabled in idle state", async () => {
    const el = renderWireGuard();
    document.body.appendChild(el);
    await new Promise((resolve) => setTimeout(resolve, 0));

    const copyBtn = el.querySelector("#hash-copy-actual");
    const status = el.querySelector("#hash-status-badge");
    expect(copyBtn?.hasAttribute("disabled")).toBe(true);
    expect(status?.textContent).toBe("hashCheck.status.idle");
  });

  test("enables hash copy and copies actual hash after successful verify", async () => {
    const el = renderWireGuard();
    document.body.appendChild(el);
    await new Promise((resolve) => setTimeout(resolve, 0));

    const pickBtn = el.querySelector("#hash-pick-file");
    const runBtn = el.querySelector("#hash-run");
    const copyBtn = el.querySelector("#hash-copy-actual");
    const status = el.querySelector("#hash-status-badge");
    const actual = el.querySelector("#hash-actual-value");

    pickBtn.click();
    await new Promise((resolve) => setTimeout(resolve, 0));
    runBtn.click();
    await new Promise((resolve) => setTimeout(resolve, 0));

    expect(status?.textContent).toBe("hashCheck.status.match");
    expect(actual?.textContent).toBe("abcd");
    expect(copyBtn?.hasAttribute("disabled")).toBe(false);

    copyBtn.click();
    await new Promise((resolve) => setTimeout(resolve, 0));

    expect(navigator.clipboard.writeText).toHaveBeenCalledWith("abcd");
    expect(copyBtn.querySelector("span")?.textContent).toBe(
      "hashCheck.copySuccess",
    );
  });

  test("shows windows restart card but disables action on non-windows", async () => {
    const el = renderWireGuard();
    document.body.appendChild(el);
    await new Promise((resolve) => setTimeout(resolve, 0));

    const restartCard = el.querySelector("#tools-restart-card");
    const restartBtn = el.querySelector("#create-restart-shortcut");
    const shutdownBtn = el.querySelector("#create-shutdown-shortcut");
    expect(restartCard).not.toBeNull();
    expect(restartCard.classList.contains("hidden")).toBe(false);
    expect(restartBtn?.hasAttribute("disabled")).toBe(true);
    expect(shutdownBtn?.hasAttribute("disabled")).toBe(true);
  });

  test("keeps WG advanced collapsed by default", async () => {
    const el = renderWireGuard();
    document.body.appendChild(el);
    await new Promise((resolve) => setTimeout(resolve, 0));

    const panel = el.querySelector("#tools-wg-advanced-panel");
    expect(panel?.classList.contains("is-collapsed")).toBe(true);
    expect(panel?.classList.contains("is-open")).toBe(false);
  });

  test("toggles WG advanced panel and persists state", async () => {
    const el = renderWireGuard();
    document.body.appendChild(el);
    await new Promise((resolve) => setTimeout(resolve, 0));

    const btn = el.querySelector("#tools-wg-advanced-toggle");
    const panel = el.querySelector("#tools-wg-advanced-panel");
    expect(btn).not.toBeNull();
    expect(panel).not.toBeNull();

    btn.click();
    expect(panel.classList.contains("is-open")).toBe(true);
    expect(localStorage.getItem("toolsWgAdvancedOpen")).toBe("1");

    btn.click();
    expect(panel.classList.contains("is-collapsed")).toBe(true);
    expect(localStorage.getItem("toolsWgAdvancedOpen")).toBe("0");
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

    const el = renderWireGuard();
    document.body.appendChild(el);
    await new Promise((resolve) => setTimeout(resolve, 0));

    const restartBtn = el.querySelector("#create-restart-shortcut");
    restartBtn.click();
    await new Promise((resolve) => setTimeout(resolve, 0));

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

    const el = renderWireGuard();
    document.body.appendChild(el);
    await new Promise((resolve) => setTimeout(resolve, 0));

    const shutdownBtn = el.querySelector("#create-shutdown-shortcut");
    shutdownBtn.click();
    await new Promise((resolve) => setTimeout(resolve, 0));

    expect(showConfirmationDialog).toHaveBeenCalled();
    expect(
      window.electron.tools.createWindowsShutdownShortcut,
    ).not.toHaveBeenCalled();
  });
});
