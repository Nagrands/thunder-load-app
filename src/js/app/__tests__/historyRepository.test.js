const fs = require("fs");
const os = require("os");
const path = require("path");

const {
  createHistoryRepository,
  normalizeHistoryEntry,
} = require("../historyRepository");

describe("HistoryRepository", () => {
  let root;
  let historyFilePath;

  beforeEach(() => {
    root = fs.mkdtempSync(path.join(os.tmpdir(), "history-repository-"));
    historyFilePath = path.join(root, "download_history.json");
  });

  afterEach(() => {
    fs.rmSync(root, { recursive: true, force: true });
  });

  test("migrates a legacy array idempotently into the version 2 envelope", async () => {
    fs.writeFileSync(
      historyFilePath,
      JSON.stringify([
        {
          id: "legacy",
          fileName: "Legacy",
          dateTime: "01.02.2026, 03:04:05",
          formattedSize: "1.5 MB",
          quality: "1920x1080 30fps",
        },
      ]),
      "utf8",
    );
    const repository = createHistoryRepository({ historyFilePath });

    const first = await repository.read();
    const second = await repository.read();
    const stored = JSON.parse(fs.readFileSync(historyFilePath, "utf8"));

    expect(first).toEqual(
      expect.objectContaining({
        success: true,
        count: 1,
        warning: "history-legacy-migrated",
      }),
    );
    expect(second).toEqual(
      expect.objectContaining({ success: true, count: 1 }),
    );
    expect(second.warning).toBeUndefined();
    expect(stored.version).toBe(2);
    expect(stored.entries).toHaveLength(1);
    expect(stored.entries[0]).toEqual(
      expect.objectContaining({
        id: "legacy",
        createdAt: new Date("2026-02-01T03:04:05").toISOString(),
        sizeBytes: 1572864,
        status: "completed",
        resolution: "1920x1080",
        fps: 30,
      }),
    );
  });

  test("backs up corrupt JSON and returns a failure without replacing it", async () => {
    fs.writeFileSync(historyFilePath, "{broken json", "utf8");
    const repository = createHistoryRepository({
      historyFilePath,
      now: () => Date.UTC(2026, 7, 9, 12, 0, 0),
    });

    const result = await repository.read();

    expect(result).toEqual(
      expect.objectContaining({
        success: false,
        warning: "history-corrupt",
        backupPath: expect.stringContaining(
          ".corrupt-2026-08-09T12-00-00-000Z",
        ),
      }),
    );
    expect(fs.readFileSync(result.backupPath, "utf8")).toBe("{broken json");
    expect(fs.readFileSync(historyFilePath, "utf8")).toBe("{broken json");
  });

  test("serializes concurrent saves and leaves no temporary files", async () => {
    const repository = createHistoryRepository({ historyFilePath });

    const first = repository.save([{ id: "first" }]);
    const second = repository.save([{ id: "second" }]);
    const [firstResult, secondResult] = await Promise.all([first, second]);
    const stored = JSON.parse(fs.readFileSync(historyFilePath, "utf8"));

    expect(firstResult.revision).toBe(1);
    expect(secondResult.revision).toBe(2);
    expect(stored.entries.map((entry) => entry.id)).toEqual(["second"]);
    expect(
      fs.readdirSync(root).filter((name) => name.includes(".tmp-")),
    ).toEqual([]);
  });

  test("keeps the previous file when an atomic rename fails", async () => {
    const original = { version: 2, entries: [{ id: "original" }] };
    fs.writeFileSync(historyFilePath, JSON.stringify(original), "utf8");
    const failingFs = {
      ...fs.promises,
      rename: jest.fn(async () => {
        throw new Error("rename failed");
      }),
    };
    const repository = createHistoryRepository({
      historyFilePath,
      fsPromises: failingFs,
    });

    await expect(repository.save([{ id: "replacement" }])).rejects.toThrow(
      "rename failed",
    );

    expect(JSON.parse(fs.readFileSync(historyFilePath, "utf8"))).toEqual(
      original,
    );
    expect(
      fs.readdirSync(root).filter((name) => name.includes(".tmp-")),
    ).toEqual([]);
  });

  test("does not truncate large histories", async () => {
    const repository = createHistoryRepository({ historyFilePath });
    const entries = Array.from({ length: 1200 }, (_, index) => ({
      id: `entry-${index}`,
      fileName: `Entry ${index}`,
    }));

    await repository.save(entries);
    const result = await repository.read();

    expect(result.success).toBe(true);
    expect(result.count).toBe(1200);
    expect(result.entries).toHaveLength(1200);
  });

  test("stores canonical media and error fields", () => {
    expect(
      normalizeHistoryEntry({
        id: "failed",
        timestamp: "2026-08-09T12:00:00.000Z",
        sizeBytes: 42,
        downloadStatus: "failed",
        format: "mp4",
        resolution: "1920x1080",
        fps: 60,
        durationSec: 90,
        errorCode: "network",
        errorMessage: "offline",
        retryable: true,
      }),
    ).toEqual(
      expect.objectContaining({
        createdAt: "2026-08-09T12:00:00.000Z",
        sizeBytes: 42,
        status: "failed",
        format: "mp4",
        resolution: "1920x1080",
        fps: 60,
        durationSec: 90,
        error: { code: "network", message: "offline", retryable: true },
      }),
    );
  });

  test("limits parallel file inspections", async () => {
    const { __test } = require("../historyIpcHandlers");
    let active = 0;
    let peak = 0;
    const files = Array.from({ length: 20 }, (_, index) => `/tmp/${index}`);

    const result = await __test.inspectHistoryFiles(files, {
      concurrency: 3,
      stat: async () => {
        active += 1;
        peak = Math.max(peak, active);
        await Promise.resolve();
        active -= 1;
        return { size: 10 };
      },
    });

    expect(result).toHaveLength(20);
    expect(peak).toBe(3);
  });
});
