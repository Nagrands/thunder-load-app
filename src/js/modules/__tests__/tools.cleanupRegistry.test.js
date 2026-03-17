import { createCleanupRegistry } from "../views/tools/cleanupRegistry.js";

describe("createCleanupRegistry", () => {
  beforeEach(() => {
    jest.useFakeTimers();
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  test("removes window listeners and pending timers on dispose", () => {
    const cleanup = createCleanupRegistry();
    const listener = jest.fn();
    const timer = jest.fn();

    cleanup.onWindowEvent("tools:test-event", listener);
    cleanup.setTimeout(timer, 50);

    window.dispatchEvent(new Event("tools:test-event"));
    expect(listener).toHaveBeenCalledTimes(1);

    cleanup.dispose();
    jest.advanceTimersByTime(50);

    window.dispatchEvent(new Event("tools:test-event"));
    expect(listener).toHaveBeenCalledTimes(1);
    expect(timer).not.toHaveBeenCalled();
  });

  test("clears intervals through the registry", () => {
    const cleanup = createCleanupRegistry();
    const tick = jest.fn();

    cleanup.setInterval(tick, 25);
    jest.advanceTimersByTime(75);
    expect(tick).toHaveBeenCalledTimes(3);

    cleanup.dispose();
    jest.advanceTimersByTime(100);
    expect(tick).toHaveBeenCalledTimes(3);
  });
});
