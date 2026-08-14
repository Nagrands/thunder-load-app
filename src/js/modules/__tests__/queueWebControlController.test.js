import { createQueueWebControlController } from "../features/queue/webControlController.js";

const createHarness = () => {
  let jobs = [
    { jobId: "pending", status: "pending", retryable: true },
    { jobId: "failed", status: "failed", retryable: true },
  ];
  const controller = {
    clear: jest.fn(() => {
      const removed = jobs;
      jobs = [];
      return removed;
    }),
    enqueueMany: jest.fn(),
    getSnapshot: jest.fn(() => ({ jobs: jobs.map((job) => ({ ...job })), paused: false })),
    pump: jest.fn(),
    remove: jest.fn((id) => {
      jobs = jobs.filter((job) => job.jobId !== id);
    }),
    restore: jest.fn((restored) => {
      jobs = [...restored];
    }),
    retry: jest.fn(),
    setPaused: jest.fn(),
    startOne: jest.fn(),
  };
  const getSnapshot = jest.fn((options) => ({ jobs, ...options }));
  const web = createQueueWebControlController({
    controller,
    extractUrls: (value) => [value],
    validateUrl: (url) => url.startsWith("https://"),
    normalizeQuality: (quality) => quality || "Source",
    getDownloadedMap: jest.fn(async () => new Map()),
    getSnapshot,
    startDownload: jest.fn(),
    cancelActive: jest.fn(),
    retryHistoryRecovery: jest.fn(),
    openRecovery: jest.fn(),
    isHistoryRecovery: () => false,
  });
  return { controller, getSnapshot, web };
};

describe("queue Web Control controller", () => {
  test("routes pause, start-one and retry through the queue controller", async () => {
    const { controller, web } = createHarness();
    await web.handle("downloader:pause");
    await web.handle("downloader:start-one", { jobId: "pending" });
    await web.handle("downloader:retry", { jobId: "failed" });
    expect(controller.setPaused).toHaveBeenCalledWith(true);
    expect(controller.startOne).toHaveBeenCalledWith("pending");
    expect(controller.retry).toHaveBeenCalledWith("failed");
  });

  test("keeps clear and undo state inside the adapter", async () => {
    const { controller, web } = createHarness();
    const cleared = await web.handle("downloader:clear", { target: "all" });
    expect(cleared.undoClearAvailable).toBe(true);
    const restored = await web.handle("downloader:undo-clear");
    expect(controller.restore).toHaveBeenCalled();
    expect(restored.undoClearAvailable).toBe(false);
  });

  test("rejects unknown wire commands", async () => {
    const { web } = createHarness();
    await expect(web.handle("downloader:unknown")).rejects.toThrow(
      "Unknown downloader action",
    );
  });
});
