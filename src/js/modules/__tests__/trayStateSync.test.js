import {
  initTrayStateSync,
  resetTrayStateSyncForTests,
  resolveTrayState,
} from "../trayStateSync.js";

describe("trayStateSync", () => {
  beforeEach(() => {
    resetTrayStateSyncForTests();
    window.electron = { send: jest.fn() };
    Object.defineProperty(navigator, "onLine", {
      configurable: true,
      value: true,
    });
  });

  afterEach(() => resetTrayStateSyncForTests());

  test("uses the documented state priority", () => {
    expect(
      resolveTrayState({
        online: false,
        failedCount: 1,
        activeCount: 1,
        paused: true,
      }),
    ).toBe("offline");
    expect(
      resolveTrayState({
        online: true,
        failedCount: 1,
        activeCount: 1,
        paused: true,
      }),
    ).toBe("error");
    expect(
      resolveTrayState({
        online: true,
        failedCount: 0,
        activeCount: 1,
        paused: true,
      }),
    ).toBe("downloading");
    expect(
      resolveTrayState({
        online: true,
        failedCount: 0,
        activeCount: 0,
        paused: true,
      }),
    ).toBe("paused");
    expect(
      resolveTrayState({
        online: true,
        failedCount: 0,
        activeCount: 0,
        paused: false,
      }),
    ).toBe("idle");
  });

  test("sends startup state and only sends actual changes", () => {
    initTrayStateSync();
    expect(window.electron.send).toHaveBeenLastCalledWith(
      "tray-state-update",
      "idle",
    );

    window.dispatchEvent(
      new CustomEvent("download:state", {
        detail: { activeCount: 1, failedCount: 0, paused: false },
      }),
    );
    window.dispatchEvent(
      new CustomEvent("download:state", {
        detail: { activeCount: 2, failedCount: 0, paused: false },
      }),
    );
    expect(window.electron.send).toHaveBeenLastCalledWith(
      "tray-state-update",
      "downloading",
    );
    expect(window.electron.send).toHaveBeenCalledTimes(2);
  });

  test("restores the derived state after reconnecting", () => {
    initTrayStateSync();
    Object.defineProperty(navigator, "onLine", {
      configurable: true,
      value: false,
    });
    window.dispatchEvent(new Event("offline"));
    expect(window.electron.send).toHaveBeenLastCalledWith(
      "tray-state-update",
      "offline",
    );
    Object.defineProperty(navigator, "onLine", {
      configurable: true,
      value: true,
    });
    window.dispatchEvent(new Event("online"));
    expect(window.electron.send).toHaveBeenLastCalledWith(
      "tray-state-update",
      "idle",
    );
  });
});
