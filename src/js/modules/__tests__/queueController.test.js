import { createQueueController } from "../features/queue/controller.js";

const createController = (overrides = {}) => {
  const state = {
    downloadJobs: [],
    maxParallelDownloads: 1,
    suppressAutoPump: false,
    queuePaused: false,
    queueCollapsed: false,
  };
  const repository = {
    hydrate: jest.fn(() => ({ jobs: [], paused: false, collapsed: false, completed: [] })),
    persist: jest.fn(),
  };
  const controller = createQueueController({
    state,
    repository,
    normalizeItem: (job) => ({
      ...job,
      jobId: job.jobId || job.signature || `${job.url}:${JSON.stringify(job.quality)}`,
      signature: job.signature || `${job.url}:${JSON.stringify(job.quality)}`,
      retryable: job.retryable !== false,
    }),
    validateUrl: (url) => url.startsWith("https://"),
    getSignature: (job) => job.signature,
    startJob: jest.fn(() => new Promise(() => {})),
    ...overrides,
  });
  return { controller, repository, state };
};

describe("queue controller", () => {
  test("owns enqueue, duplicate detection, move and non-active removal", () => {
    const { controller, state } = createController();
    expect(controller.enqueueMany(["bad", "https://example.com/a"], "Source"))
      .toMatchObject({ added: 1, invalid: 1 });
    expect(controller.enqueueMany(["https://example.com/a"], "Source").duplicates)
      .toBe(1);
    controller.enqueueMany(["https://example.com/b"], "Source");
    expect(controller.move(state.downloadJobs[1].jobId, "top")).toBe(true);
    expect(state.downloadJobs[0].url).toContain("/b");
    expect(controller.remove(state.downloadJobs[0].jobId)?.url).toContain("/b");
  });

  test("pause/resume, retry and immutable snapshots use downloadJobs only", () => {
    const { controller, state } = createController();
    controller.enqueueMany(["https://example.com/a"], "Source");
    controller.setPaused(true);
    expect(state.downloadJobs[0].status).toBe("paused");
    controller.setPaused(false);
    expect(state.downloadJobs[0].status).toBe("pending");
    state.downloadJobs[0] = { ...state.downloadJobs[0], status: "failed" };
    expect(controller.retry(state.downloadJobs[0].jobId)).toBe(true);
    const snapshot = controller.getSnapshot();
    snapshot.jobs[0].title = "mutated";
    expect(state.downloadJobs[0].title).not.toBe("mutated");
  });

  test("drops stale metadata responses", async () => {
    let resolveMetadata;
    const metadataPromise = new Promise((resolve) => {
      resolveMetadata = resolve;
    });
    const { controller, state } = createController({
      resolveMetadata: () => metadataPromise,
    });
    controller.enqueueMany(["https://example.com/a"], "Source");
    controller.remove(state.downloadJobs[0].jobId);
    resolveMetadata({ title: "Stale" });
    await metadataPromise;
    await Promise.resolve();
    expect(state.downloadJobs).toEqual([]);
  });

  test("enforces the queue cap and refuses to remove running jobs", () => {
    const { controller, state } = createController({ maxJobs: 1 });
    expect(
      controller.enqueueMany(
        ["https://example.com/a", "https://example.com/b"],
        "Source",
      ),
    ).toMatchObject({ added: 1, capped: 1 });
    const pending = state.downloadJobs[0];
    controller.startRunning({ ...pending, status: "running" });
    expect(controller.remove(pending.jobId)).toBeNull();
  });

  test("normalizes progress and failed completion through the controller", () => {
    const { controller, state } = createController();
    controller.startRunning({
      jobId: "running",
      signature: "running",
      url: "https://example.com/a",
      quality: "Source",
    });
    controller.updateProgress("running", {
      progress: 42,
      downloadedBytes: 100,
      speedBytesPerSec: 10,
    });
    expect(state.downloadJobs[0]).toMatchObject({
      progress: 42,
      downloadedBytes: 100,
    });
    controller.finish("running", {
      status: "failed",
      errorCode: "NETWORK",
      retryable: true,
    });
    expect(state.downloadJobs[0]).toMatchObject({
      status: "failed",
      errorCode: "NETWORK",
    });
  });
});
