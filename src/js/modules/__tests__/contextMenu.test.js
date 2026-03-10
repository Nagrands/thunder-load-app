import { jest } from "@jest/globals";

const mockShowConfirmationDialog = jest.fn();
const mockShowToast = jest.fn();

const deferred = () => {
  let resolve;
  let reject;
  const promise = new Promise((res, rej) => {
    resolve = res;
    reject = rej;
  });
  return { promise, resolve, reject };
};

const flush = async () => {
  await Promise.resolve();
  await Promise.resolve();
};

jest.mock("../modals.js", () => ({
  showConfirmationDialog: mockShowConfirmationDialog,
}));

jest.mock("../toast.js", () => ({
  showToast: mockShowToast,
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
    <div class="input-container">
      <div class="url-input-wrapper" id="url-input-wrapper">
        <input id="url" />
      </div>
    </div>
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
    <nav id="context-menu" style="display:none; position:absolute;">
      <ul role="menu">
        <li role="none">
          <button id="open-video" type="button" role="menuitem">Open video</button>
        </li>
        <li role="none">
          <button id="open-folder" type="button" role="menuitem">Open folder</button>
        </li>
        <li role="none">
          <button id="open-site" type="button" role="menuitem">Open site</button>
        </li>
        <li role="none">
          <button id="retry-download" type="button" role="menuitem">Retry</button>
        </li>
        <li role="none">
          <button id="delete-entry" type="button" role="menuitem">Delete entry</button>
        </li>
        <li role="none">
          <button id="delete-file" type="button" role="menuitem">Delete file</button>
        </li>
      </ul>
    </nav>
  `;

  global.window.electron = {
    invoke: jest.fn(async (channel) => {
      if (channel === "check-file-exists") return true;
      return null;
    }),
  };
  global.window.scrollTo = jest.fn();

  const retryTarget = document.getElementById("url-input-wrapper");
  retryTarget.getBoundingClientRect = jest.fn(() => ({
    top: 540,
    left: 0,
    width: 100,
    height: 40,
    right: 100,
    bottom: 580,
  }));
};

const openContextMenuOnEntry = async () => {
  const logEntry = document.querySelector(".log-entry");
  logEntry.dispatchEvent(
    new MouseEvent("contextmenu", {
      bubbles: true,
      cancelable: true,
      pageX: 160,
      pageY: 120,
    }),
  );
  await flush();
};

describe("context menu UI", () => {
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
    mockShowToast.mockReset();
  });

  test("opens and focuses first enabled menu item", async () => {
    const { initContextMenu } = await import("../contextMenu.js");
    initContextMenu();

    await openContextMenuOnEntry();

    expect(document.getElementById("context-menu").style.display).toBe("block");
    expect(document.activeElement).toBe(document.getElementById("open-video"));
  });

  test("supports ArrowUp/ArrowDown/Home/End keyboard navigation", async () => {
    const { initContextMenu } = await import("../contextMenu.js");
    initContextMenu();

    await openContextMenuOnEntry();
    const menu = document.getElementById("context-menu");

    menu.dispatchEvent(
      new KeyboardEvent("keydown", { key: "ArrowDown", bubbles: true }),
    );
    expect(document.activeElement).toBe(document.getElementById("open-folder"));

    menu.dispatchEvent(
      new KeyboardEvent("keydown", { key: "End", bubbles: true }),
    );
    expect(document.activeElement).toBe(document.getElementById("delete-file"));

    menu.dispatchEvent(
      new KeyboardEvent("keydown", { key: "ArrowUp", bubbles: true }),
    );
    expect(document.activeElement).toBe(
      document.getElementById("delete-entry"),
    );

    menu.dispatchEvent(
      new KeyboardEvent("keydown", { key: "Home", bubbles: true }),
    );
    expect(document.activeElement).toBe(document.getElementById("open-video"));
  });

  test("runs action on Enter", async () => {
    const { initContextMenu } = await import("../contextMenu.js");
    initContextMenu();

    await openContextMenuOnEntry();
    const menu = document.getElementById("context-menu");
    const openSite = document.getElementById("open-site");
    openSite.focus();

    menu.dispatchEvent(
      new KeyboardEvent("keydown", { key: "Enter", bubbles: true }),
    );
    await flush();

    expect(window.electron.invoke).toHaveBeenCalledWith(
      "open-external-link",
      "https://example.com/video",
    );
  });

  test("closes menu on Escape", async () => {
    const { initContextMenu } = await import("../contextMenu.js");
    initContextMenu();

    await openContextMenuOnEntry();

    const menu = document.getElementById("context-menu");
    menu.dispatchEvent(
      new KeyboardEvent("keydown", { key: "Escape", bubbles: true }),
    );

    expect(menu.style.display).toBe("none");
  });

  test("does not execute disabled menu item", async () => {
    window.electron.invoke.mockImplementation(async (channel) => {
      if (channel === "check-file-exists") return false;
      return null;
    });

    const { initContextMenu } = await import("../contextMenu.js");
    initContextMenu();

    await openContextMenuOnEntry();

    const openVideo = document.getElementById("open-video");
    expect(openVideo.disabled).toBe(true);

    openVideo.dispatchEvent(new MouseEvent("click", { bubbles: true }));
    await flush();

    expect(window.electron.invoke).not.toHaveBeenCalledWith(
      "open-last-video",
      "/tmp/test.mp4",
    );
  });

  test("hides context menu immediately when delete confirmation opens", async () => {
    const pendingConfirm = deferred();
    mockShowConfirmationDialog.mockReturnValue(pendingConfirm.promise);

    const { initContextMenu } = await import("../contextMenu.js");
    initContextMenu();

    await openContextMenuOnEntry();

    const menu = document.getElementById("context-menu");
    expect(menu.style.display).toBe("block");

    document
      .getElementById("delete-entry")
      .dispatchEvent(new MouseEvent("click", { bubbles: true }));

    await Promise.resolve();

    expect(mockShowConfirmationDialog).toHaveBeenCalledTimes(1);
    expect(menu.style.display).toBe("none");

    pendingConfirm.resolve(false);
    await Promise.resolve();
  });

  test("retry scrolls to URL input and focuses it", async () => {
    jest.useFakeTimers();
    const { initContextMenu } = await import("../contextMenu.js");
    initContextMenu();

    await openContextMenuOnEntry();
    document
      .getElementById("retry-download")
      .dispatchEvent(new MouseEvent("click", { bubbles: true }));

    const url = document.getElementById("url");

    expect(url.value).toBe("https://example.com/video");
    expect(window.scrollTo).toHaveBeenCalledWith(
      expect.objectContaining({
        behavior: "smooth",
      }),
    );

    jest.runAllTimers();
    await flush();

    expect(document.activeElement).toBe(url);
    expect(url.selectionStart).toBe(0);
    expect(url.selectionEnd).toBe(url.value.length);
    jest.useRealTimers();
  });

  test("uses html-enabled toast after entry deletion", async () => {
    mockShowConfirmationDialog.mockResolvedValue(true);
    window.electron.invoke.mockImplementation(async (channel) => {
      if (channel === "check-file-exists") return true;
      if (channel === "load-history") {
        return [
          {
            id: 42,
            fileName: "Test file",
            filePath: "/tmp/test.mp4",
            sourceUrl: "https://example.com/video",
          },
        ];
      }
      if (channel === "save-history") return true;
      return null;
    });

    const { handleDeleteEntry } = await import("../contextMenu.js");
    const entry = document.querySelector(".log-entry");

    await handleDeleteEntry(entry);

    expect(mockShowToast).toHaveBeenCalledWith(
      expect.stringContaining(
        "Запись успешно удалена<br><strong>Test file</strong>.",
      ),
      "success",
      5500,
      null,
      null,
      false,
      { allowHtml: true },
    );
  });
});
