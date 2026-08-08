import { createDisposableScope } from "../disposableScope.js";

describe("disposableScope", () => {
  test("removes listeners, timers and aborts owned work idempotently", () => {
    jest.useFakeTimers();
    const scope = createDisposableScope();
    const target = new EventTarget();
    const listener = jest.fn();
    scope.event(target, "change", listener);
    scope.timeout(listener, 100);
    const controller = scope.abortController();
    scope.dispose();
    scope.dispose();
    target.dispatchEvent(new Event("change"));
    jest.runAllTimers();
    expect(listener).not.toHaveBeenCalled();
    expect(controller.signal.aborted).toBe(true);
    jest.useRealTimers();
  });
});
