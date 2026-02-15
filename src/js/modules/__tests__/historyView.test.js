import { jest } from "@jest/globals";

jest.mock("../tooltipInitializer.js", () => ({
  initTooltips: jest.fn(),
  disposeAllTooltips: jest.fn(),
}));

jest.mock("../toast.js", () => ({
  showToast: jest.fn(),
}));

jest.mock("../contextMenu.js", () => ({
  handleDeleteEntry: jest.fn(),
}));

jest.mock("../iconUpdater.js", () => ({
  updateIcon: jest.fn(),
}));

jest.mock("../historyFilter.js", () => ({
  setFilterInputValue: jest.fn(),
}));

jest.mock("../filterAndSortHistory.js", () => ({
  filterAndSortHistory: jest.fn(),
}));

const setupDom = () => {
  document.body.innerHTML = `
    <input id="url" />
    <button id="download-button"><span class="button-text"></span></button>
    <button id="download-cancel"></button>
    <button id="open-history"></button>
    <div id="history-container">
      <div class="history-controls"></div>
      <div class="history-filters-row"></div>
      <div class="history-search-wrapper"></div>
      <i id="icon-filter-search"></i>
      <div id="history-bulk-bar" class="history-bulk-bar hidden"></div>
      <span id="history-selected-count"></span>
      <button id="history-clear-selection"></button>
      <button id="toggle-all-details"></button>
      <div id="history"></div>
      <div id="history-empty"></div>
    </div>
    <input id="filter-input" />
    <button id="history-density-compact"></button>
    <button id="history-density-comfort"></button>
  `;

  global.window.electron = {
    invoke: jest.fn(),
  };

  global.requestAnimationFrame = (cb) => cb();
};

const createEntry = (overrides = {}) => ({
  id: overrides.id ?? "1",
  fileName: overrides.fileName ?? "Test video",
  sourceUrl: overrides.sourceUrl ?? "https://example.com/watch?v=1",
  timestamp: overrides.timestamp ?? new Date().toISOString(),
  dateText: overrides.dateText ?? "2026-02-07 12:00",
  quality: overrides.quality ?? "1080p",
  resolution: overrides.resolution ?? "1920x1080",
  formattedSize: overrides.formattedSize ?? "10 MB",
  filePath: overrides.filePath ?? "/tmp/video.mp4",
  thumbnail:
    overrides.thumbnail ??
    "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR4nGNgYAAAAAMAASsJTYQAAAAASUVORK5CYII=",
});

describe("Downloader history list", () => {
  beforeAll(() => {
    jest.spyOn(console, "error").mockImplementation(() => {});
    jest.spyOn(console, "warn").mockImplementation(() => {});
  });

  afterAll(() => {
    console.error.mockRestore();
    console.warn.mockRestore();
  });

  beforeEach(() => {
    jest.resetModules();
    localStorage.clear();
    setupDom();
  });

  test("applies density class and active button", async () => {
    localStorage.setItem("historyDensity", "compact");
    const { renderHistory } = await import("../history.js");

    renderHistory([createEntry()]);

    const list = document.getElementById("history");
    expect(list.classList.contains("density-compact")).toBe(true);
    expect(
      document
        .getElementById("history-density-compact")
        .classList.contains("is-active"),
    ).toBe(true);
  });

  test("groups entries by date with labels", async () => {
    jest.useFakeTimers();
    jest.setSystemTime(new Date("2026-02-07T12:00:00"));
    localStorage.setItem("uiLanguage", "ru");

    const { renderHistory } = await import("../history.js");

    const today = new Date("2026-02-07T10:00:00").toISOString();
    const yesterday = new Date("2026-02-06T18:30:00").toISOString();

    renderHistory([
      createEntry({ id: "1", timestamp: today }),
      createEntry({ id: "2", timestamp: yesterday }),
    ]);

    const groups = Array.from(document.querySelectorAll(".history-group"));
    const labels = groups.map((g) => g.textContent.trim());

    expect(groups).toHaveLength(2);
    expect(labels).toContain("Сегодня");
    expect(labels).toContain("Вчера");

    jest.useRealTimers();
  });

  test("moves secondary actions into menu", async () => {
    const { renderHistory } = await import("../history.js");

    renderHistory([createEntry()]);

    const actions = document.querySelector(".history-row__actions");
    expect(actions).not.toBeNull();

    const actionButtons = actions.querySelectorAll(".history-row__action");
    expect(actionButtons).toHaveLength(3);

    const menu = actions.querySelector(".history-row__menu");
    const menuButton = actions.querySelector(".history-row__menu-button");
    const menuList = actions.querySelector(".history-row__menu-list");

    expect(menu).not.toBeNull();
    expect(menuButton).not.toBeNull();
    expect(menuList).not.toBeNull();
    expect(menu.classList.contains("is-open")).toBe(false);

    menuButton.dispatchEvent(new MouseEvent("click", { bubbles: true }));
    expect(menu.classList.contains("is-open")).toBe(true);
  });

  test("enables virtualized rendering for large history pages", async () => {
    localStorage.setItem("historyPageSize", "200");
    const { renderHistory } = await import("../history.js");

    const entries = Array.from({ length: 120 }, (_, idx) =>
      createEntry({
        id: String(idx + 1),
        fileName: `Entry ${idx + 1}`,
        sourceUrl: `https://example.com/watch?v=${idx + 1}`,
      }),
    );

    renderHistory(entries, {
      pageSize: 200,
      totalEntries: entries.length,
      fullEntries: entries,
    });

    const list = document.getElementById("history");
    const renderedRows = list.querySelectorAll(".history-row");
    expect(list.dataset.virtualized).toBe("true");
    expect(list.querySelector(".history-virtual-window")).not.toBeNull();
    expect(renderedRows.length).toBeGreaterThan(0);
    expect(renderedRows.length).toBeLessThan(entries.length);
  });

  test("keeps full render for small history pages", async () => {
    const { renderHistory } = await import("../history.js");
    const entries = Array.from({ length: 12 }, (_, idx) =>
      createEntry({
        id: String(idx + 1),
        fileName: `Small ${idx + 1}`,
        sourceUrl: `https://example.com/watch?v=small-${idx + 1}`,
      }),
    );

    renderHistory(entries, {
      pageSize: 20,
      totalEntries: entries.length,
      fullEntries: entries,
    });

    const list = document.getElementById("history");
    expect(list.dataset.virtualized).toBe("false");
    expect(list.querySelector(".history-virtual-window")).toBeNull();
    expect(list.querySelectorAll(".history-row")).toHaveLength(entries.length);
  });
});
