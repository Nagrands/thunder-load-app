import { jest } from "@jest/globals";

const mockShowConfirmationDialog = jest.fn();

const deferred = () => {
  let resolve;
  let reject;
  const promise = new Promise((res, rej) => {
    resolve = res;
    reject = rej;
  });
  return { promise, resolve, reject };
};

jest.mock("../modals.js", () => ({
  showConfirmationDialog: mockShowConfirmationDialog,
}));

jest.mock("../toast.js", () => ({
  showToast: jest.fn(),
}));

jest.mock("../history.js", () => ({
  updateDownloadCount: jest.fn(),
  sortHistory: jest.fn(),
}));

jest.mock("../historyFilter.js", () => ({
  filterAndSortHistory: jest.fn(),
}));

jest.mock("../overlayManager.js", () => ({
  registerDismissibleOverlay: jest.fn(),
}));

jest.mock("../state.js", () => ({
  setHistoryData: jest.fn(),
  getHistoryData: jest.fn(() => []),
  state: {
    currentSearchQuery: "",
    currentSortOrder: "desc",
  },
  updateButtonState: jest.fn(),
}));

jest.mock("../i18n.js", () => ({
  t: jest.fn((key) => key),
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
      <div id="history">
        <div class="log-entry" data-id="42" data-filepath="/tmp/test.mp4">
          <div class="text" data-filename="Test file" data-url="https://example.com/video"></div>
        </div>
      </div>
      <div id="history-empty"></div>
    </div>
    <input id="filter-input" />
    <button id="history-density-compact"></button>
    <button id="history-density-comfort"></button>
    <div id="context-menu" style="display:none; position:absolute;">
      <ul>
        <li id="open-video">Open video</li>
        <li id="open-folderc">Open folder</li>
        <li id="delete-entry">Delete entry</li>
        <li id="delete-file">Delete file</li>
      </ul>
    </div>
  `;

  global.window.electron = {
    invoke: jest.fn(async (channel) => {
      if (channel === "check-file-exists") return true;
      return null;
    }),
  };
};

describe("context menu confirmation", () => {
  beforeAll(() => {
    jest.spyOn(console, "error").mockImplementation(() => {});
  });

  afterAll(() => {
    console.error.mockRestore();
  });

  beforeEach(() => {
    jest.resetModules();
    setupDom();
    mockShowConfirmationDialog.mockReset();
  });

  test("hides context menu immediately when delete confirmation opens", async () => {
    const pendingConfirm = deferred();
    mockShowConfirmationDialog.mockReturnValue(pendingConfirm.promise);

    const { initContextMenu } = await import("../contextMenu.js");

    initContextMenu();

    const logEntry = document.querySelector(".log-entry");
    const menu = document.getElementById("context-menu");

    logEntry.dispatchEvent(
      new MouseEvent("contextmenu", {
        bubbles: true,
        cancelable: true,
        pageX: 160,
        pageY: 120,
      }),
    );

    await Promise.resolve();
    await Promise.resolve();

    expect(menu.style.display).toBe("block");

    const deleteItem = document.getElementById("delete-entry");
    deleteItem.dispatchEvent(new MouseEvent("click", { bubbles: true }));

    await Promise.resolve();

    expect(mockShowConfirmationDialog).toHaveBeenCalledTimes(1);
    expect(menu.style.display).toBe("none");

    pendingConfirm.resolve(false);
    await Promise.resolve();
  });
});
