import {
  applyState,
  getEnabledItems,
  initWindowsTrayMenu,
} from "../windowsTrayMenu.js";

function renderMenu() {
  document.body.innerHTML = `
    <main data-ui="windows-tray-menu">
      <button class="windows-tray-menu__item" data-action="open"><span>Open</span></button>
      <button class="windows-tray-menu__item" data-action="last-video"><span data-last-video-name></span></button>
      <button class="windows-tray-menu__item" data-action="downloads">Downloads</button>
      <button class="windows-tray-menu__item" data-action="settings">Settings</button>
      <button class="windows-tray-menu__item" data-action="quit">Quit</button>
    </main>`;
  return document.querySelector("main");
}

describe("Windows tray panel UI", () => {
  test("applies availability without exposing a path", () => {
    const root = renderMenu();
    applyState(root, {
      lastVideo: { enabled: true, fileName: "A very long video name.mkv" },
      downloads: { enabled: false },
    });

    expect(root.querySelector('[data-action="last-video"]').disabled).toBe(
      false,
    );
    expect(root.querySelector("[data-last-video-name]").textContent).toBe(
      "A very long video name.mkv",
    );
    expect(root.querySelector('[data-action="downloads"]').disabled).toBe(true);
    expect(getEnabledItems(root)).toHaveLength(4);
  });

  test("supports keyboard navigation, Escape and action dispatch", async () => {
    const root = renderMenu();
    const api = {
      getState: jest.fn(async () => ({
        success: true,
        data: {
          lastVideo: { enabled: false, fileName: "" },
          downloads: { enabled: true },
        },
      })),
      performAction: jest.fn(async () => ({ success: true })),
      close: jest.fn(),
    };
    initWindowsTrayMenu({ root, api });
    await Promise.resolve();

    const open = root.querySelector('[data-action="open"]');
    open.focus();
    open.dispatchEvent(
      new KeyboardEvent("keydown", { key: "ArrowDown", bubbles: true }),
    );
    expect(document.activeElement.dataset.action).toBe("downloads");
    document.activeElement.dispatchEvent(
      new KeyboardEvent("keydown", { key: "End", bubbles: true }),
    );
    expect(document.activeElement.dataset.action).toBe("quit");
    document.activeElement.dispatchEvent(
      new KeyboardEvent("keydown", { key: "Escape", bubbles: true }),
    );
    expect(api.close).toHaveBeenCalledTimes(1);

    root.querySelector('[data-action="settings"]').click();
    await Promise.resolve();
    expect(api.performAction).toHaveBeenCalledWith("settings");
  });
});
