import { JOB_STATUS } from "../features/queue/model.js";
import {
  getActiveDownloadJobs,
  getPendingDownloadJobs,
  patchDownloadJob,
  upsertDownloadJob,
} from "../features/queue/store.js";

describe("queue store", () => {
  test("owns every queue category in downloadJobs", () => {
    const state = { downloadJobs: [] };
    upsertDownloadJob(state, {
      jobId: "job-1",
      url: "https://example.com/1",
      quality: "Source",
      status: JOB_STATUS.pending,
    });
    patchDownloadJob(state, "job-1", {
      status: JOB_STATUS.running,
      progress: 42,
    });
    expect(Object.keys(state)).toEqual(["downloadJobs"]);
    expect(getPendingDownloadJobs(state)).toHaveLength(0);
    expect(getActiveDownloadJobs(state)[0].progress).toBe(42);
  });

  test("normalizes durable metadata and optional runtime metrics", () => {
    const state = { downloadJobs: [] };
    upsertDownloadJob(state, {
      jobId: "job-metrics",
      url: "https://example.com/metrics",
      status: JOB_STATUS.running,
      thumbnail: "https://example.com/thumb.jpg",
      errorMessage: "Network error",
      retryAfterMinutes: 8,
      downloadedBytes: 1024,
      totalBytes: 2048,
      totalBytesApproximate: true,
      speedBytesPerSec: 512,
      etaSeconds: 2,
    });
    expect(state.downloadJobs[0]).toEqual(
      expect.objectContaining({
        thumbnail: "https://example.com/thumb.jpg",
        errorMessage: "Network error",
        retryAfterMinutes: 8,
        downloadedBytes: 1024,
        totalBytes: 2048,
        totalBytesApproximate: true,
        speedBytesPerSec: 512,
        etaSeconds: 2,
      }),
    );
  });
});
