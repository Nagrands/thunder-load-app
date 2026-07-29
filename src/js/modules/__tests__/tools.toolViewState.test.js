import { createToolViewState } from "../views/tools/toolViewState.js";

describe("createToolViewState", () => {
  beforeEach(() => {
    localStorage.clear();
    delete window.__thunder_dev_tools_unlocked__;
  });

  test("always starts from the launcher and ignores legacy remembered state", () => {
    const state = createToolViewState();

    localStorage.setItem("toolsRememberLastView", "true");
    localStorage.setItem("toolsLastView", "power");
    state.setPlatformInfo({ isWindows: true, platform: "win32" });
    expect(state.isToolAvailable("power")).toBe(true);
    expect(state.resolveInitialToolView()).toBe("launcher");
  });

  test("keeps Backup available despite legacy disabled state", () => {
    const state = createToolViewState();

    localStorage.setItem("toolsRememberLastView", "true");
    localStorage.setItem("toolsLastView", "backup");
    state.setPlatformInfo({ isWindows: true, platform: "win32" });

    expect(state.isToolAvailable("backup")).toBe(true);
    localStorage.setItem("backupDisabled", "true");
    expect(state.isToolAvailable("backup")).toBe(true);
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

  test("reads persisted developer unlock state from storage", () => {
    const state = createToolViewState();
    localStorage.setItem("developerToolsUnlocked", "true");

    state.setPlatformInfo({ isWindows: false, platform: "darwin" });

    expect(state.readDeveloperToolsUnlocked()).toBe(true);
    expect(state.isPowerToolAvailable()).toBe(true);
  });

});
