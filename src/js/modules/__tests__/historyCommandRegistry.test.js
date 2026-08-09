import {
  getHistoryCommandByContextId,
  isHistoryCommandAvailable,
} from "../features/history/commandRegistry.js";

describe("history command registry", () => {
  const entry = {
    filePath: "/tmp/video.mp4",
    sourceUrl: "https://example.com/video",
  };

  test("maps context-menu ids to the same row commands", () => {
    expect(getHistoryCommandByContextId("open-video")).toBe("open-file");
    expect(getHistoryCommandByContextId("retry-download")).toBe("retry");
    expect(getHistoryCommandByContextId("delete-entry")).toBe("delete-entry");
  });

  test("shares file and source availability rules", () => {
    expect(isHistoryCommandAvailable("open-file", entry)).toBe(true);
    expect(
      isHistoryCommandAvailable("open-file", entry, { fileExists: false }),
    ).toBe(false);
    expect(isHistoryCommandAvailable("open-source", entry)).toBe(true);
    expect(
      isHistoryCommandAvailable("retry", { ...entry, sourceUrl: "" }),
    ).toBe(false);
    expect(isHistoryCommandAvailable("delete-entry", {})).toBe(true);
  });
});
