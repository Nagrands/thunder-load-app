import { writeQueueJobs } from "../features/queue/persistence.js";

test("queue persistence excludes runtime telemetry", () => {
  const storage = { setItem: jest.fn(), removeItem: jest.fn() };
  writeQueueJobs(storage, "queue", [
    {
      jobId: "job-1",
      url: "https://example.com/video",
      thumbnail: "https://example.com/thumb.jpg",
      errorMessage: "Retry later",
      retryAfterMinutes: 5,
      downloadedBytes: 10,
      totalBytes: 20,
      totalBytesApproximate: true,
      speedBytesPerSec: 2,
      etaSeconds: 5,
    },
  ]);
  const stored = JSON.parse(storage.setItem.mock.calls[0][1]);
  expect(stored[0]).toEqual({
    jobId: "job-1",
    url: "https://example.com/video",
    thumbnail: "https://example.com/thumb.jpg",
    errorMessage: "Retry later",
    retryAfterMinutes: 5,
  });
});
