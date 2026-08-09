import {
  matchesHistoryStatus,
  selectHistoryEntries,
  selectHistoryEntriesByIds,
  selectHistoryEntriesByStatus,
} from "../features/history/selectors.js";

const entries = [
  {
    id: "available",
    fileName: "Available video",
    sourceUrl: "https://example.com/available",
    timestamp: "2026-01-03T00:00:00.000Z",
  },
  {
    id: "missing",
    fileName: "Missing video",
    sourceUrl: "https://example.com/missing",
    timestamp: "2026-01-02T00:00:00.000Z",
    isMissing: true,
  },
  {
    id: "failed",
    fileName: "Failed video",
    sourceUrl: "https://example.com/failed",
    timestamp: "2026-01-01T00:00:00.000Z",
    downloadStatus: "failed",
    error: true,
  },
];

describe("history selectors", () => {
  test("classifies available, missing, and failed entries", () => {
    expect(matchesHistoryStatus(entries[0], "available")).toBe(true);
    expect(matchesHistoryStatus(entries[1], "missing")).toBe(true);
    expect(matchesHistoryStatus(entries[2], "error")).toBe(true);
    expect(selectHistoryEntriesByStatus(entries, "available")).toEqual([
      entries[0],
    ]);
  });

  test("applies the status filter to visible results", () => {
    expect(
      selectHistoryEntries(entries, {
        status: "missing",
        query: "video",
        sortOrder: "desc",
      }).map((entry) => entry.id),
    ).toEqual(["missing"]);
  });

  test("selects exact ids independently from search text", () => {
    expect(
      selectHistoryEntriesByIds(entries, ["failed", "available"]).map(
        (entry) => entry.id,
      ),
    ).toEqual(["available", "failed"]);
  });
});
