jest.mock("../i18n.js", () => ({
  t: (key) => key,
}));

import createFullscreenController from "../nowPlaying/fullscreenController.js";
import createImmersiveOverlayVisibility from "../nowPlaying/immersiveOverlayVisibility.js";

describe("Now Playing immersive controllers", () => {
  beforeEach(() => {
    document.body.innerHTML = `
      <section class="now-playing">
        <div class="now-playing__sidebar-reveal-zone" tabindex="0"></div>
        <aside class="now-playing__sidebar"><button>Sidebar</button></aside>
        <button class="now-playing__control--fullscreen">
          <i class="fa-solid fa-expand"></i>
        </button>
      </section>
    `;
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  test("reveals only the sidebar on hover/focus with delayed hide", () => {
    jest.useFakeTimers();
    const root = document.querySelector(".now-playing");
    const sidebar = root.querySelector(".now-playing__sidebar");
    const sidebarZone = root.querySelector(".now-playing__sidebar-reveal-zone");
    const controller = createImmersiveOverlayVisibility({
      root,
      sidebar,
      sidebarZone,
    });
    controller.onShow();

    sidebarZone.dispatchEvent(new MouseEvent("mouseenter"));
    expect(root.classList.contains("is-sidebar-visible")).toBe(true);
    sidebarZone.dispatchEvent(new MouseEvent("mouseleave"));
    jest.advanceTimersByTime(179);
    expect(root.classList.contains("is-sidebar-visible")).toBe(true);
    jest.advanceTimersByTime(1);
    expect(root.classList.contains("is-sidebar-visible")).toBe(false);

    controller.onHide();
    controller.dispose();
    sidebarZone.dispatchEvent(new MouseEvent("mouseenter"));
    expect(root.classList.contains("is-sidebar-visible")).toBe(false);
  });

  test("keeps a pinned sidebar visible across pointer leave and restores it", () => {
    jest.useFakeTimers();
    const root = document.querySelector(".now-playing");
    const sidebar = root.querySelector(".now-playing__sidebar");
    const sidebarZone = root.querySelector(".now-playing__sidebar-reveal-zone");
    const controller = createImmersiveOverlayVisibility({
      root,
      sidebar,
      sidebarZone,
    });

    controller.setSidebarPinned(true);
    controller.onShow();
    expect(root.classList.contains("is-sidebar-pinned")).toBe(true);
    expect(root.classList.contains("is-sidebar-visible")).toBe(true);
    sidebar.dispatchEvent(new MouseEvent("mouseleave"));
    jest.advanceTimersByTime(1000);
    expect(root.classList.contains("is-sidebar-visible")).toBe(true);

    controller.onHide();
    expect(root.classList.contains("is-sidebar-visible")).toBe(false);
    controller.onShow();
    expect(root.classList.contains("is-sidebar-visible")).toBe(true);
    controller.setSidebarPinned(false);
    expect(root.classList.contains("is-sidebar-pinned")).toBe(false);
    jest.advanceTimersByTime(180);
    expect(root.classList.contains("is-sidebar-visible")).toBe(false);
    controller.dispose();
  });

  test("syncs fullscreen state and removes external listeners on dispose", async () => {
    let changedHandler = null;
    const unsubscribe = jest.fn();
    const api = {
      getState: jest.fn().mockResolvedValue({
        success: true,
        data: { isFullscreen: true },
      }),
      setState: jest.fn((isFullscreen) =>
        Promise.resolve({
          success: true,
          data: { isFullscreen },
        }),
      ),
      onChanged: jest.fn((handler) => {
        changedHandler = handler;
        return unsubscribe;
      }),
    };
    const root = document.querySelector(".now-playing");
    const button = root.querySelector(".now-playing__control--fullscreen");
    const controller = createFullscreenController({ root, button, api });
    await controller.ready;

    expect(root.classList.contains("is-fullscreen")).toBe(true);
    expect(button.getAttribute("aria-label")).toBe("nowPlaying.exitFullscreen");
    changedHandler(false);
    expect(root.classList.contains("is-fullscreen")).toBe(false);
    await controller.toggle();
    expect(api.setState).toHaveBeenCalledWith(true);

    window.dispatchEvent(new KeyboardEvent("keydown", { key: "Escape" }));
    await Promise.resolve();
    expect(api.setState).toHaveBeenLastCalledWith(false);
    controller.dispose();
    expect(unsubscribe).toHaveBeenCalledTimes(1);
  });
});
