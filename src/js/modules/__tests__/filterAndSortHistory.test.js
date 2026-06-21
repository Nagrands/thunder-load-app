import { jest } from "@jest/globals";

const mockState = {
  currentSortKey: "date",
  currentSortMode: "mixed",
  currentSortOrder: "desc",
  currentSearchQuery: "",
  historyHydrated: false,
  historyPage: 1,
  historyPageSize: 20,
  historySourceFilter: "",
};
let mockHistoryData = [];
const mockRenderHistory = jest.fn();

jest.mock("../state.js", () => ({
  getHistoryData: () => mockHistoryData,
  state: mockState,
}));

jest.mock("../history.js", () => ({
  renderHistory: mockRenderHistory,
}));

describe("filterAndSortHistory", () => {
  beforeEach(() => {
    jest.resetModules();
    localStorage.clear();
    mockHistoryData = [];
    mockRenderHistory.mockClear();
    Object.assign(mockState, {
      currentSortKey: "date",
      currentSortMode: "mixed",
      currentSortOrder: "desc",
      currentSearchQuery: "",
      historyHydrated: false,
      historyPage: 1,
      historyPageSize: 20,
      historySourceFilter: "",
    });
  });

  test("keeps source filter before history hydration", async () => {
    localStorage.setItem("historySourceFilter", "youtube.com");
    mockState.historyHydrated = false;
    mockState.historySourceFilter = "youtube.com";
    const { filterAndSortHistory } = await import("../filterAndSortHistory.js");

    filterAndSortHistory("", "desc", true);

    expect(mockState.historySourceFilter).toBe("youtube.com");
    expect(localStorage.getItem("historySourceFilter")).toBe("youtube.com");
  });

  test("clears stale source filter after history hydration", async () => {
    localStorage.setItem("historySourceFilter", "youtube.com");
    mockState.historyHydrated = true;
    mockState.historySourceFilter = "youtube.com";
    mockHistoryData = [
      {
        id: "1",
        sourceUrl: "https://example.com/watch?v=1",
        timestamp: "2026-01-01T00:00:00.000Z",
      },
    ];
    const { filterAndSortHistory } = await import("../filterAndSortHistory.js");

    filterAndSortHistory("", "desc", true);

    expect(mockState.historySourceFilter).toBe("");
    expect(localStorage.getItem("historySourceFilter")).toBeNull();
  });
});
