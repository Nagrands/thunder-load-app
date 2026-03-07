/** @jest-environment jsdom */

const showToastMock = jest.fn();
const initDownloadButtonMock = jest.fn();
const initTooltipsMock = jest.fn();

function buildDom() {
  document.body.innerHTML = `
    <button id="open-folder"></button>
    <button id="open-last-video"></button>
    <button id="select-folder"></button>
  `;
}

describe("downloadActions", () => {
  beforeEach(() => {
    jest.resetModules();
    buildDom();
    localStorage.clear();
    showToastMock.mockReset();
    initDownloadButtonMock.mockReset();
    initTooltipsMock.mockReset();
    global.window = global.window || {};
    window.electron = {
      invoke: jest.fn(),
      on: jest.fn(),
    };
    window.electron.invoke.mockImplementation(async (channel) => {
      if (channel === "get-download-path") {
        return "/tmp/downloads";
      }
      return undefined;
    });
  });

  async function loadModule() {
    jest.doMock("../domElements.js", () => ({
      openFolderButton: document.getElementById("open-folder"),
      openLastVideoButton: document.getElementById("open-last-video"),
      selectFolderButton: document.getElementById("select-folder"),
    }));
    jest.doMock("../downloadManager.js", () => ({
      initDownloadButton: initDownloadButtonMock,
    }));
    jest.doMock("../tooltipInitializer.js", () => ({
      initTooltips: initTooltipsMock,
    }));
    jest.doMock("../toast.js", () => ({
      showToast: showToastMock,
    }));
    jest.doMock("../i18n.js", () => ({
      t: (key, vars = {}) => {
        const map = {
          "download.folder.resolveError":
            "Could not determine the downloads folder.",
          "download.folder.lastMissing":
            "The last file was not found. Open the current downloads folder instead.",
          "download.folder.openError": "Failed to open the downloads folder.",
          "download.complete.openError": "Failed to open the last video.",
          "download.lastFile.missing":
            "The path to the last downloaded file was not found.",
          "download.folder.selectCancelled": "Folder selection was canceled.",
          "download.folder.selectError": "Failed to choose a folder.",
          "download.folder.changed": `Downloads folder changed to: ${vars.path}`,
        };
        return map[key] || key;
      },
    }));
    return import("../downloadActions.js");
  }

  test("shows warning when current download folder cannot be resolved", async () => {
    window.electron.invoke.mockImplementation(async (channel) => {
      if (channel === "get-download-path") {
        return null;
      }
      return undefined;
    });
    const { initDownloadActions } = await loadModule();

    initDownloadActions();
    document.getElementById("open-folder").click();
    await Promise.resolve();

    expect(showToastMock).toHaveBeenCalledWith(
      "Could not determine the downloads folder.",
      "warning",
    );
  });

  test("shows warning when last downloaded file path is missing", async () => {
    const { initDownloadActions } = await loadModule();

    initDownloadActions();
    document.getElementById("open-last-video").click();
    await Promise.resolve();

    expect(showToastMock).toHaveBeenCalledWith(
      "The path to the last downloaded file was not found.",
      "warning",
    );
  });

  test("shows warning when folder selection is canceled", async () => {
    window.electron.invoke.mockImplementation(async (channel) => {
      if (channel === "get-download-path") {
        return "/tmp/downloads";
      }
      if (channel === "select-download-folder") {
        return { success: false };
      }
      return undefined;
    });
    const { initDownloadActions } = await loadModule();

    initDownloadActions();
    document.getElementById("select-folder").click();
    await Promise.resolve();

    expect(showToastMock).toHaveBeenCalledWith(
      "Folder selection was canceled.",
      "warning",
    );
  });

  test("shows localized toast when downloads folder changes", async () => {
    let downloadPathChangedHandler = null;
    window.electron.on.mockImplementation((event, cb) => {
      if (event === "download-path-changed") {
        downloadPathChangedHandler = cb;
      }
    });
    window.electron.invoke.mockResolvedValue("/tmp/downloads");
    const { initDownloadActions } = await loadModule();

    initDownloadActions();
    expect(typeof downloadPathChangedHandler).toBe("function");

    downloadPathChangedHandler("/Users/test/Downloads");

    expect(showToastMock).toHaveBeenCalledWith(
      "Downloads folder changed to: /Users/test/Downloads",
      "success",
    );
  });
});
