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

const flushPromises = async () => {
  await Promise.resolve();
  await Promise.resolve();
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

  afterEach(() => {
    jest.useRealTimers();
    jest.dontMock("../modals.js");
    jest.dontMock("../history.js");
    jest.dontMock("../historyFilter.js");
    jest.dontMock("../toast.js");
    jest.dontMock("../i18n.js");
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

  const setupClearHistoryTest = async (clearMode, initialHistory) => {
    const showConfirmationDialog = jest.fn(async () => clearMode);
    const showToast = jest.fn();
    const renderHistory = jest.fn();
    const updateDownloadCount = jest.fn(async () => {});
    const clearHistorySelection = jest.fn();
    const setFilterInputValue = jest.fn();

    jest.doMock("../modals.js", () => ({ showConfirmationDialog }));
    jest.doMock("../history.js", () => ({
      loadHistory: jest.fn(async () => {}),
      renderHistory,
      updateDownloadCount,
      clearHistorySelection,
    }));
    jest.doMock("../historyFilter.js", () => ({ setFilterInputValue }));
    jest.doMock("../toast.js", () => ({ showToast }));
    jest.doMock("../i18n.js", () => ({
      t: jest.fn((key, vars = {}) =>
        vars.count === undefined ? key : `${key}:${vars.count}`,
      ),
    }));

    const { initHistoryActions } = await import("../historyActions.js");
    const { state, setHistoryData, getHistoryData } =
      await import("../state.js");
    state.downloadHistory = [...initialHistory];
    state.currentSearchQuery = "test";
    state.historyPage = 3;
    state.selectedEntries = ["failed"];
    setHistoryData(initialHistory);
    localStorage.setItem("lastSearch", "test");

    initHistoryActions();
    document
      .getElementById("clear-history")
      .dispatchEvent(new Event("click", { bubbles: true }));
    await flushPromises();

    return {
      showConfirmationDialog,
      showToast,
      renderHistory,
      updateDownloadCount,
      clearHistorySelection,
      setFilterInputValue,
      state,
      getHistoryData,
    };
  };

  test("clear history dialog clears all entries when all mode is selected", async () => {
    const initialHistory = [
      { id: "done", fileName: "Done", thumbnailCacheFile: "/tmp/done.jpg" },
      {
        id: "failed",
        fileName: "Failed",
        downloadStatus: "failed",
        thumbnailCacheFile: "/tmp/failed.jpg",
      },
    ];

    const ctx = await setupClearHistoryTest("all", initialHistory);

    expect(ctx.showConfirmationDialog).toHaveBeenCalledWith(
      expect.objectContaining({
        choices: expect.arrayContaining([
          expect.objectContaining({ value: "all" }),
          expect.objectContaining({ value: "problem" }),
        ]),
        defaultChoice: "problem",
      }),
    );
    expect(window.electron.invoke).toHaveBeenCalledWith("save-history", []);
    expect(ctx.renderHistory).toHaveBeenCalledWith([]);
    expect(ctx.getHistoryData()).toEqual([]);
    expect(ctx.clearHistorySelection).toHaveBeenCalled();
    expect(ctx.setFilterInputValue).toHaveBeenCalledWith("");
    expect(ctx.updateDownloadCount).toHaveBeenCalled();
    expect(ctx.showToast).toHaveBeenCalledWith(
      "history.toast.deletedEntries:2",
      "info",
      expect.any(Number),
      null,
      expect.any(Function),
    );
  });

  test("clear history dialog removes only failed and missing entries in problem mode", async () => {
    const initialHistory = [
      { id: "done", fileName: "Done", thumbnailCacheFile: "/tmp/done.jpg" },
      {
        id: "failed",
        fileName: "Failed",
        downloadStatus: "failed",
        thumbnailCacheFile: "/tmp/failed.jpg",
      },
      {
        id: "explicit-error",
        fileName: "Error",
        error: true,
      },
      {
        id: "missing",
        fileName: "Missing",
        isMissing: true,
        thumbnailCacheFile: "/tmp/missing.jpg",
      },
    ];

    const ctx = await setupClearHistoryTest("problem", initialHistory);

    const expectedRemaining = [initialHistory[0]];
    expect(window.electron.invoke).toHaveBeenCalledWith(
      "save-history",
      expectedRemaining,
    );
    expect(ctx.renderHistory).toHaveBeenCalledWith(expectedRemaining);
    expect(ctx.state.downloadHistory).toEqual(expectedRemaining);
    expect(ctx.getHistoryData()).toEqual(expectedRemaining);
    expect(ctx.showToast).toHaveBeenCalledWith(
      "history.toast.deletedEntries:3",
      "info",
      expect.any(Number),
      null,
      expect.any(Function),
    );
  });

  test("clear history problem mode does not mutate history when no problem entries exist", async () => {
    const initialHistory = [{ id: "done", fileName: "Done" }];

    const ctx = await setupClearHistoryTest("problem", initialHistory);

    expect(window.electron.invoke).not.toHaveBeenCalledWith(
      "save-history",
      expect.anything(),
    );
    expect(ctx.renderHistory).not.toHaveBeenCalled();
    expect(ctx.getHistoryData()).toEqual(initialHistory);
    expect(ctx.showToast).toHaveBeenCalledWith(
      "history.clear.noProblemEntries",
      "info",
    );
  });

  test("clear history undo restores removed problem entries", async () => {
    const initialHistory = [
      { id: "done", fileName: "Done" },
      {
        id: "failed",
        fileName: "Failed",
        downloadStatus: "failed",
      },
    ];

    const ctx = await setupClearHistoryTest("problem", initialHistory);
    const undo = ctx.showToast.mock.calls.find(
      ([message]) => message === "history.toast.deletedEntries:1",
    )?.[4];

    expect(typeof undo).toBe("function");
    await undo();

    expect(ctx.getHistoryData()).toEqual(initialHistory);
    expect(window.electron.invoke).toHaveBeenLastCalledWith(
      "save-history",
      initialHistory,
    );
    expect(ctx.updateDownloadCount).toHaveBeenCalledTimes(2);
  });

  test("clear history problem mode cleans previews only for removed entries", async () => {
    jest.useFakeTimers();
    const initialHistory = [
      { id: "done", fileName: "Done", thumbnailCacheFile: "/tmp/done.jpg" },
      {
        id: "failed",
        fileName: "Failed",
        downloadStatus: "failed",
        thumbnailCacheFile: "/tmp/failed.jpg",
      },
      {
        id: "missing",
        fileName: "Missing",
        isMissing: true,
        thumbnailCacheFile: "/tmp/missing.jpg",
      },
    ];

    await setupClearHistoryTest("problem", initialHistory);
    expect(window.electron.invoke).not.toHaveBeenCalledWith(
      "delete-history-preview",
      expect.anything(),
    );

    jest.advanceTimersByTime(6000);
    await flushPromises();

    expect(window.electron.invoke).toHaveBeenCalledWith(
      "delete-history-preview",
      ["/tmp/failed.jpg", "/tmp/missing.jpg"],
    );
  });
});
