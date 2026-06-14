import {
  loadCompletedJobs,
  persistCompletedJobs,
} from "../downloadQueuePersistence.js";

const STORAGE_KEY = "downloadCompletedQueue";

const createJob = (overrides = {}) => ({
  id: "job-1",
  jobId: "job-1",
  signature: "signature-1",
  status: "done",
  url: "https://example.com/video",
  filePath: "/downloads/video.mp4",
  title: "Video",
  createdAt: 100,
  updatedAt: 200,
  ...overrides,
});

const createStorage = (initialValue = null) => {
  let value = initialValue;
  return {
    getItem: jest.fn(() => value),
    setItem: jest.fn((_key, nextValue) => {
      value = nextValue;
    }),
    removeItem: jest.fn(() => {
      value = null;
    }),
  };
};

describe("loadCompletedJobs", () => {
  test("loads, normalizes, sorts, and filters persisted jobs", () => {
    const storage = createStorage(
      JSON.stringify([
        createJob({
          id: "older",
          jobId: " older ",
          signature: " older-signature ",
          url: " https://example.com/older ",
          filePath: " C:\\Downloads\\older.mp4 ",
          title: " Older title ",
          createdAt: "10",
          updatedAt: "20",
          completedAt: "19",
        }),
        createJob({
          id: "newer",
          jobId: "newer",
          signature: "newer-signature",
          createdAt: "30",
          updatedAt: "40",
        }),
        createJob({ id: "running", status: "running" }),
        createJob({ id: "missing-url", url: "   " }),
        createJob({ id: "missing-path", filePath: "" }),
        null,
        "not-a-job",
      ]),
    );

    expect(loadCompletedJobs(storage)).toEqual([
      createJob({
        id: "newer",
        jobId: "newer",
        signature: "newer-signature",
        createdAt: 30,
        updatedAt: 40,
      }),
      createJob({
        id: "older",
        jobId: "older",
        signature: "older-signature",
        url: "https://example.com/older",
        filePath: "C:\\Downloads\\older.mp4",
        title: "Older title",
        createdAt: 10,
        updatedAt: 20,
        completedAt: 19,
      }),
    ]);
    expect(storage.getItem).toHaveBeenCalledWith(STORAGE_KEY);
  });

  test("uses createdAt when updatedAt is absent or invalid", () => {
    const storage = createStorage(
      JSON.stringify([
        createJob({
          id: "invalid-updated",
          jobId: "invalid-updated",
          signature: "invalid-updated",
          createdAt: "50",
          updatedAt: "invalid",
        }),
        createJob({
          id: "valid-updated",
          jobId: "valid-updated",
          signature: "valid-updated",
          createdAt: "10",
          updatedAt: "20",
        }),
      ]),
    );

    const jobs = loadCompletedJobs(storage);

    expect(jobs.map((job) => job.id)).toEqual([
      "invalid-updated",
      "valid-updated",
    ]);
    expect(jobs[0].updatedAt).toBe(0);
  });

  test.each([
    ["missing value", null],
    ["empty value", ""],
    ["invalid JSON", "{"],
    ["non-array JSON", JSON.stringify({ status: "done" })],
  ])("returns an empty list for %s", (_label, value) => {
    expect(loadCompletedJobs(createStorage(value))).toEqual([]);
  });

  test("returns an empty list when storage access fails", () => {
    const storage = {
      getItem: jest.fn(() => {
        throw new Error("denied");
      }),
    };

    expect(loadCompletedJobs(storage)).toEqual([]);
  });

  test("uses window.localStorage by default", () => {
    window.localStorage.setItem(
      STORAGE_KEY,
      JSON.stringify([createJob({ id: "default-storage" })]),
    );

    expect(loadCompletedJobs()).toHaveLength(1);
  });
});

describe("persistCompletedJobs", () => {
  test("stores only normalized done jobs with non-empty URL and path", () => {
    const storage = createStorage();
    const jobs = [
      createJob({
        id: " valid ",
        jobId: " valid ",
        signature: " signature ",
        status: " done ",
        url: " https://example.com/valid ",
        filePath: " /downloads/valid.mp4 ",
        createdAt: "100",
        updatedAt: "200",
        startedAt: "90",
        completedAt: "not-a-number",
        failedAt: null,
      }),
      createJob({ id: "pending", status: "pending" }),
      createJob({ id: "blank-url", url: " " }),
      createJob({ id: "blank-path", filePath: " " }),
      [],
    ];

    const persisted = persistCompletedJobs(jobs, storage);

    expect(persisted).toEqual([
      createJob({
        id: "valid",
        jobId: "valid",
        signature: "signature",
        status: "done",
        url: "https://example.com/valid",
        filePath: "/downloads/valid.mp4",
        createdAt: 100,
        updatedAt: 200,
        startedAt: 90,
        completedAt: 0,
        failedAt: 0,
      }),
    ]);
    expect(JSON.parse(storage.setItem.mock.calls[0][1])).toEqual(persisted);
    expect(storage.setItem).toHaveBeenCalledWith(
      STORAGE_KEY,
      expect.any(String),
    );
    expect(storage.removeItem).not.toHaveBeenCalled();
  });

  test("keeps the newest job when signature, jobId, or id is duplicated", () => {
    const storage = createStorage();
    const jobs = [
      createJob({
        id: "old-signature",
        jobId: "old-signature",
        signature: "shared-signature",
        updatedAt: 10,
      }),
      createJob({
        id: "new-signature",
        jobId: "new-signature",
        signature: "shared-signature",
        updatedAt: 60,
      }),
      createJob({
        id: "old-job-id",
        jobId: "shared-job-id",
        signature: "old-job-id",
        updatedAt: 20,
      }),
      createJob({
        id: "new-job-id",
        jobId: "shared-job-id",
        signature: "new-job-id",
        updatedAt: 50,
      }),
      createJob({
        id: "shared-id",
        jobId: "",
        signature: "",
        updatedAt: 30,
      }),
      createJob({
        id: "shared-id",
        jobId: "",
        signature: "",
        updatedAt: 40,
      }),
    ];

    const persisted = persistCompletedJobs(jobs, storage);

    expect(persisted.map((job) => job.id)).toEqual([
      "new-signature",
      "new-job-id",
      "shared-id",
    ]);
  });

  test("retains the 30 newest unique jobs", () => {
    const storage = createStorage();
    const jobs = Array.from({ length: 35 }, (_, index) =>
      createJob({
        id: `job-${index}`,
        jobId: `job-${index}`,
        signature: `signature-${index}`,
        updatedAt: index + 1,
      }),
    );

    const persisted = persistCompletedJobs(jobs, storage);

    expect(persisted).toHaveLength(30);
    expect(persisted[0].id).toBe("job-34");
    expect(persisted[29].id).toBe("job-5");
  });

  test("keeps valid jobs without an identity", () => {
    const storage = createStorage();
    const jobs = [
      createJob({
        id: "",
        jobId: "",
        signature: "",
        url: "https://example.com/one",
        updatedAt: 20,
      }),
      createJob({
        id: "",
        jobId: "",
        signature: "",
        url: "https://example.com/two",
        updatedAt: 10,
      }),
    ];

    expect(persistCompletedJobs(jobs, storage)).toHaveLength(2);
  });

  test.each([
    ["an empty array", []],
    ["a non-array value", null],
    ["only invalid jobs", [createJob({ status: "failed" })]],
  ])("removes the storage key for %s", (_label, jobs) => {
    const storage = createStorage("existing");

    expect(persistCompletedJobs(jobs, storage)).toEqual([]);
    expect(storage.removeItem).toHaveBeenCalledWith(STORAGE_KEY);
    expect(storage.setItem).not.toHaveBeenCalled();
  });

  test("returns an empty list when setItem fails", () => {
    const storage = createStorage();
    storage.setItem.mockImplementation(() => {
      throw new Error("quota exceeded");
    });

    expect(persistCompletedJobs([createJob()], storage)).toEqual([]);
  });

  test("returns an empty list when removeItem fails", () => {
    const storage = createStorage();
    storage.removeItem.mockImplementation(() => {
      throw new Error("denied");
    });

    expect(persistCompletedJobs([], storage)).toEqual([]);
  });

  test("ignores fields outside the completed job schema", () => {
    const circular = createJob();
    circular.metadata = circular;

    const persisted = persistCompletedJobs([circular], createStorage());

    expect(persisted).toHaveLength(1);
    expect(persisted[0]).not.toHaveProperty("metadata");
  });

  test("uses window.localStorage by default", () => {
    const persisted = persistCompletedJobs([
      createJob({ id: "default-storage" }),
    ]);

    expect(JSON.parse(window.localStorage.getItem(STORAGE_KEY))).toEqual(
      persisted,
    );
  });
});
