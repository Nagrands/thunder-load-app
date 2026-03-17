import { createToolViewState } from "../views/tools/toolViewState.js";

describe("createToolViewState", () => {
  beforeEach(() => {
    localStorage.clear();
    delete window.__thunder_dev_tools_unlocked__;
  });

  test("resolves remembered tool only when it is available", () => {
    const state = createToolViewState();

    localStorage.setItem("toolsRememberLastView", "true");
    localStorage.setItem("toolsLastView", "power");
    state.setPlatformInfo({ isWindows: false, platform: "linux" });

    expect(state.resolveInitialToolView()).toBe("launcher");

    state.setPlatformInfo({ isWindows: true, platform: "win32" });
    expect(state.isToolAvailable("power")).toBe(true);
    expect(state.resolveInitialToolView()).toBe("power");
  });

  test("resolves remembered backup tool and falls back when disabled", () => {
    const state = createToolViewState();

    localStorage.setItem("toolsRememberLastView", "true");
    localStorage.setItem("toolsLastView", "backup");
    state.setPlatformInfo({ isWindows: true, platform: "win32" });

    expect(state.isToolAvailable("backup")).toBe(true);
    expect(state.resolveInitialToolView()).toBe("backup");

    localStorage.setItem("backupDisabled", "true");
    expect(state.isToolAvailable("backup")).toBe(false);
    expect(state.resolveInitialToolView()).toBe("launcher");
  });

  test("tracks developer unlock state for macOS power tools", () => {
    const state = createToolViewState();

    state.setPlatformInfo({ isWindows: false, platform: "darwin" });
    state.setDeveloperToolsUnlocked(false);
    expect(state.isPowerToolAvailable()).toBe(false);

    state.setDeveloperToolsUnlocked(true);
    expect(state.isPowerToolAvailable()).toBe(true);
    expect(window.__thunder_dev_tools_unlocked__).toBe(true);
  });

  test("remembers media-inspector as a valid last tool view", () => {
    const state = createToolViewState();

    localStorage.setItem("toolsRememberLastView", "true");
    localStorage.setItem("toolsLastView", "media-inspector");
    state.setPlatformInfo({ isWindows: false, platform: "darwin" });

    expect(state.isToolAvailable("media-inspector")).toBe(true);
    expect(state.resolveInitialToolView()).toBe("media-inspector");
  });
});
