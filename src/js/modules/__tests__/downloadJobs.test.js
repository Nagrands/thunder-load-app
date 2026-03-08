import {
  JOB_STATUS,
  getActiveDownloadJobs,
  getCompletedDownloadJobs,
  getFailedDownloadJobs,
  getPendingDownloadJobs,
  removeDownloadJob,
  upsertDownloadJob,
} from "../downloadJobs.js";

describe("downloadJobs selectors", () => {
  test("keeps legacy collections in sync with the job store", () => {
    const state = {
      downloadJobs: [],
      activeDownloads: [],
      downloadQueue: [],
      failedDownloads: [],
      completedDownloads: [],
      queuePaused: false,
    };

    upsertDownloadJob(state, {
      id: "job-running",
      jobId: "job-running",
      url: "https://example.com/running",
      quality: "Source",
      signature: "running",
      status: JOB_STATUS.running,
      stage: "download",
      progress: 25,
    });
    upsertDownloadJob(state, {
      id: "job-pending",
      jobId: "job-pending",
      url: "https://example.com/pending",
      quality: "Source",
      signature: "pending",
      status: JOB_STATUS.pending,
    });
    upsertDownloadJob(state, {
      id: "job-failed",
      jobId: "job-failed",
      url: "https://example.com/failed",
      quality: "Source",
      signature: "failed",
      status: JOB_STATUS.failed,
    });
    upsertDownloadJob(state, {
      id: "job-done",
      jobId: "job-done",
      url: "https://example.com/done",
      quality: "Source",
      signature: "done",
      status: JOB_STATUS.done,
    });

    expect(getActiveDownloadJobs(state)).toHaveLength(1);
    expect(getPendingDownloadJobs(state)).toHaveLength(1);
    expect(getFailedDownloadJobs(state)).toHaveLength(1);
    expect(getCompletedDownloadJobs(state)).toHaveLength(1);
    expect(state.activeDownloads).toHaveLength(1);
    expect(state.downloadQueue).toHaveLength(1);
    expect(state.failedDownloads).toHaveLength(1);
    expect(state.completedDownloads).toHaveLength(1);

    removeDownloadJob(state, "failed");

    expect(getFailedDownloadJobs(state)).toHaveLength(0);
    expect(state.failedDownloads).toHaveLength(0);
  });
});
