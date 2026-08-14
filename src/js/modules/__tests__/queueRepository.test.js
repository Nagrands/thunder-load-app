import { createQueueRepository, STORAGE_KEYS } from "../features/queue/repository.js";

const createStorage = () => {
  const values = new Map();
  return {
    getItem: jest.fn((key) => values.get(key) ?? null),
    removeItem: jest.fn((key) => values.delete(key)),
    setItem: jest.fn((key, value) => values.set(key, value)),
    values,
  };
};

describe("queue repository", () => {
  test("hydrates legacy arrays, deduplicates and keeps durable metadata", () => {
    const storage = createStorage();
    storage.values.set(STORAGE_KEYS.paused, "1");
    storage.values.set(
      STORAGE_KEYS.pending,
      JSON.stringify([
        { url: "https://example.com/a", quality: "Source", thumbnail: "a.jpg" },
        { url: "https://example.com/a", quality: "Source" },
      ]),
    );
    const repository = createQueueRepository({
      storage,
      validateJob: (job) => Boolean(job.url),
      getSignature: (job) => `${job.url}:${job.quality}`,
    });

    expect(repository.hydrate()).toMatchObject({
      paused: true,
      jobs: [{ status: "paused", thumbnail: "a.jpg" }],
    });
  });

  test("ignores corrupted storage and excludes runtime telemetry", () => {
    const storage = createStorage();
    storage.values.set(STORAGE_KEYS.pending, "{");
    const repository = createQueueRepository({
      storage,
      validateJob: () => true,
      getSignature: (job) => job.signature,
    });
    expect(repository.hydrate().jobs).toEqual([]);

    repository.persist({
      jobs: [{
        url: "https://example.com/a",
        quality: "Source",
        signature: "a",
        status: "pending",
        downloadedBytes: 10,
        speedBytesPerSec: 5,
      }],
    });
    expect(JSON.parse(storage.values.get(STORAGE_KEYS.pending))[0]).not.toHaveProperty(
      "downloadedBytes",
    );
  });
});
