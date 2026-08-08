const { ShutdownCoordinator } = require("../shutdownCoordinator");

describe("ShutdownCoordinator", () => {
  test("runs registered cleanup once and shares the stop promise", async () => {
    const cleanup = jest.fn().mockResolvedValue(undefined);
    const coordinator = new ShutdownCoordinator({ timeoutMs: 1000 });
    coordinator.register("resource", cleanup);
    const first = coordinator.stop();
    const second = coordinator.stop();
    expect(second).toBe(first);
    await first;
    expect(cleanup).toHaveBeenCalledTimes(1);
    expect(coordinator.state).toBe("stopped");
  });
});
