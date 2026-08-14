import { createQueueScheduler } from "../features/queue/scheduler.js";

const flush = () => new Promise((resolve) => setTimeout(resolve, 0));

describe("queue scheduler", () => {
  test("fills available slots and reserves payloads until completion", async () => {
    const jobs = [{ signature: "a" }, { signature: "b" }, { signature: "c" }];
    const resolvers = [];
    const startJob = jest.fn(
      () => new Promise((resolve) => resolvers.push(resolve)),
    );
    const scheduler = createQueueScheduler({
      getPendingJobs: () => jobs,
      getActiveCount: () => 0,
      getParallelLimit: () => 2,
      isPaused: () => false,
      getSignature: (job) => job.signature,
      startJob,
    });

    expect(scheduler.pump()).toBe(2);
    expect(startJob).toHaveBeenCalledTimes(2);
    expect(scheduler.getReservationCount()).toBe(2);
    resolvers.shift()();
    await flush();
    expect(startJob).toHaveBeenCalledTimes(3);
    scheduler.dispose();
  });

  test("auto pump respects pause while manual pump does not", () => {
    const startJob = jest.fn();
    const scheduler = createQueueScheduler({
      getPendingJobs: () => [{ signature: "a" }],
      getActiveCount: () => 0,
      getParallelLimit: () => 1,
      isPaused: () => true,
      getSignature: (job) => job.signature,
      startJob,
    });
    expect(scheduler.pump("auto")).toBe(0);
    expect(scheduler.pump("manual")).toBe(1);
  });
});
