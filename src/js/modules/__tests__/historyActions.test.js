import { jest } from "@jest/globals";

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
    <input id="filter-input" value="test" />
    <button id="refresh-button"></button>
    <button id="clear-history"></button>
    <button id="clear-filter-input"></button>
    <select id="history-source-filter"></select>
    <select id="history-sort-key"></select>
    <button id="history-density-compact"></button>
    <button id="history-density-comfort"></button>
    <button id="history-export-json"></button>
    <button id="history-export-csv"></button>
    <button id="restore-history"></button>
    <span id="total-downloads"></span>
    <div id="toast-container"></div>
  `;
};

describe("historyActions", () => {
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
    global.window.electron = {
      invoke: jest.fn(async (channel) => {
        if (channel === "load-history") return [];
        if (channel === "check-file-exists") return false;
        if (channel === "get-file-size") return 0;
        if (channel === "get-download-count") return 0;
        return null;
      }),
    };
    global.requestAnimationFrame = (cb) => cb();
  });

  test("refresh button updates search query and pulls history", async () => {
    localStorage.setItem("history", JSON.stringify([{ id: "1" }]));

    const { initHistoryActions } = await import("../historyActions.js");
    const { state } = await import("../state.js");

    initHistoryActions();
    document
      .getElementById("refresh-button")
      .dispatchEvent(new Event("click", { bubbles: true }));

    await new Promise((r) => setTimeout(r, 0));

    expect(state.currentSearchQuery).toBe("test");
    expect(localStorage.getItem("lastSearch")).toBe("test");
    expect(state.downloadHistory).toEqual([{ id: "1" }]);
  });
});
