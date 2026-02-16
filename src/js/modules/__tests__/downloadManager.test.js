const buildDom = () => {
  document.body.innerHTML = `
    <input id="url" />
    <button id="download-button"><span class="button-text"></span></button>
    <button id="enqueue-button"></button>
    <button id="download-cancel"></button>
    <div id="progress-bar-container"></div>
    <div id="progress-bar"></div>
    <button id="open-last-video"></button>
    <div id="download-queue-info" class="hidden"></div>
    <span id="queue-count"></span>
    <div id="queue-start-indicator" class="hidden"></div>
    <button id="queue-clear-button"></button>
  `;
};

describe("downloadManager queue persistence", () => {
  beforeEach(() => {
    jest.resetModules();
    localStorage.clear();
    buildDom();
    global.window = global.window || {};
    window.electron = {
      invoke: jest.fn(),
      ipcRenderer: { invoke: jest.fn() },
      on: jest.fn(),
    };
  });

  it("loadQueueFromStorage filters invalid, duplicates, and current URL", () => {
    localStorage.setItem(
      "downloadQueue",
      JSON.stringify([
        { url: "https://example.com/a", quality: "q1" },
        { url: "https://example.com/a", quality: "q1" },
        { url: "notaurl", quality: "q2" },
        { url: "https://example.com/b", quality: "q3" },
      ]),
    );

    jest.isolateModules(() => {
      jest.doMock("../domElements", () => ({
        urlInput: document.getElementById("url"),
        downloadButton: document.getElementById("download-button"),
        enqueueButton: document.getElementById("enqueue-button"),
        downloadCancelButton: document.getElementById("download-cancel"),
        buttonText: document.querySelector(".button-text"),
        progressBarContainer: document.getElementById("progress-bar-container"),
        progressBar: document.getElementById("progress-bar"),
        openLastVideoButton: document.getElementById("open-last-video"),
        queueClearButton: document.getElementById("queue-clear-button"),
        historyContainer: null,
      }));
      jest.doMock("../history", () => ({
        getHistoryData: jest.fn(() => []),
      }));
      const { state } = require("../state");
      state.currentUrl = "https://example.com/b";
      const { loadQueueFromStorage } = require("../downloadManager");
      const res = loadQueueFromStorage();
      expect(res).toHaveLength(1);
      expect(res[0].url).toBe("https://example.com/a");
    });
  });

  it("persistQueue stores the queue in localStorage", () => {
    jest.isolateModules(() => {
      jest.doMock("../domElements", () => ({
        urlInput: document.getElementById("url"),
        downloadButton: document.getElementById("download-button"),
        enqueueButton: document.getElementById("enqueue-button"),
        downloadCancelButton: document.getElementById("download-cancel"),
        buttonText: document.querySelector(".button-text"),
        progressBarContainer: document.getElementById("progress-bar-container"),
        progressBar: document.getElementById("progress-bar"),
        openLastVideoButton: document.getElementById("open-last-video"),
        queueClearButton: document.getElementById("queue-clear-button"),
        historyContainer: null,
      }));
      jest.doMock("../history", () => ({
        getHistoryData: jest.fn(() => []),
      }));
      const { state } = require("../state");
      const { persistQueue } = require("../downloadManager");
      state.downloadQueue = [{ url: "https://example.com/a", quality: "q1" }];
      persistQueue();
      const raw = localStorage.getItem("downloadQueue");
      expect(raw).toBeTruthy();
      const parsed = JSON.parse(raw);
      expect(parsed).toHaveLength(1);
      expect(parsed[0].url).toBe("https://example.com/a");
    });
  });
});

describe("downloadManager enqueueOnly behavior", () => {
  beforeEach(() => {
    jest.resetModules();
    localStorage.clear();
    buildDom();
    global.window = global.window || {};
    window.electron = {
      invoke: jest.fn(),
      ipcRenderer: { invoke: jest.fn() },
      on: jest.fn(),
    };
  });

  it("adds to queue without starting download when enqueueOnly is true", async () => {
    jest.isolateModules(async () => {
      jest.doMock("../domElements", () => ({
        urlInput: document.getElementById("url"),
        downloadButton: document.getElementById("download-button"),
        enqueueButton: document.getElementById("enqueue-button"),
        downloadCancelButton: document.getElementById("download-cancel"),
        buttonText: document.querySelector(".button-text"),
        progressBarContainer: document.getElementById("progress-bar-container"),
        progressBar: document.getElementById("progress-bar"),
        openLastVideoButton: document.getElementById("open-last-video"),
        queueClearButton: document.getElementById("queue-clear-button"),
        historyContainer: null,
      }));
      jest.doMock("../history", () => ({
        getHistoryData: jest.fn(() => []),
      }));
      jest.doMock("../downloadQualityModal", () => ({
        openDownloadQualityModal: jest.fn().mockResolvedValue("Source"),
      }));
      const { state } = require("../state");
      const { handleDownloadButtonClick } = require("../downloadManager");
      const urlInput = document.getElementById("url");
      urlInput.value = "https://example.com/a";
      await handleDownloadButtonClick({ enqueueOnly: true });
      expect(state.downloadQueue).toHaveLength(1);
      expect(state.isDownloading).toBe(false);
    });
  });

  it("does not enqueue URL that already exists in history", async () => {
    jest.isolateModules(async () => {
      jest.doMock("../domElements", () => ({
        urlInput: document.getElementById("url"),
        downloadButton: document.getElementById("download-button"),
        enqueueButton: document.getElementById("enqueue-button"),
        downloadCancelButton: document.getElementById("download-cancel"),
        buttonText: document.querySelector(".button-text"),
        progressBarContainer: document.getElementById("progress-bar-container"),
        progressBar: document.getElementById("progress-bar"),
        openLastVideoButton: document.getElementById("open-last-video"),
        queueClearButton: document.getElementById("queue-clear-button"),
        historyContainer: null,
      }));
      jest.doMock("../history", () => ({
        getHistoryData: jest.fn(() => [
          { sourceUrl: "https://example.com/a", filePath: "/tmp/a.mp4" },
        ]),
      }));
      jest.doMock("../downloadQualityModal", () => ({
        openDownloadQualityModal: jest.fn().mockResolvedValue("Source"),
      }));
      const { state } = require("../state");
      const { handleDownloadButtonClick } = require("../downloadManager");
      const urlInput = document.getElementById("url");
      urlInput.value = "https://example.com/a";
      await handleDownloadButtonClick({ enqueueOnly: true });
      expect(state.downloadQueue).toHaveLength(0);
      expect(state.isDownloading).toBe(false);
    });
  });

  it("allows enqueue when URL exists in history but requested mode differs", async () => {
    jest.isolateModules(async () => {
      jest.doMock("../domElements", () => ({
        urlInput: document.getElementById("url"),
        downloadButton: document.getElementById("download-button"),
        enqueueButton: document.getElementById("enqueue-button"),
        downloadCancelButton: document.getElementById("download-cancel"),
        buttonText: document.querySelector(".button-text"),
        progressBarContainer: document.getElementById("progress-bar-container"),
        progressBar: document.getElementById("progress-bar"),
        openLastVideoButton: document.getElementById("open-last-video"),
        queueClearButton: document.getElementById("queue-clear-button"),
        historyContainer: null,
      }));
      jest.doMock("../history", () => ({
        getHistoryData: jest.fn(() => [
          { sourceUrl: "https://example.com/a", quality: "Source" },
        ]),
      }));
      jest.doMock("../downloadQualityModal", () => ({
        openDownloadQualityModal: jest.fn().mockResolvedValue({
          type: "audio-only",
          label: "Audio",
        }),
      }));
      const { state } = require("../state");
      const { handleDownloadButtonClick } = require("../downloadManager");
      const urlInput = document.getElementById("url");
      urlInput.value = "https://example.com/a";
      await handleDownloadButtonClick({ enqueueOnly: true });
      expect(state.downloadQueue).toHaveLength(1);
      expect(state.downloadQueue[0].quality.type).toBe("audio-only");
    });
  });
});

describe("downloadManager progress activity class", () => {
  beforeEach(() => {
    jest.resetModules();
    localStorage.clear();
    buildDom();
    global.window = global.window || {};
    window.electron = {
      invoke: jest.fn(async (channel) => {
        if (channel === "download-video") {
          return {
            fileName: "file.mp4",
            filePath: "/tmp/file.mp4",
            quality: "Source",
            actualQuality: "Source",
            sourceUrl: "https://example.com/a",
            cancelled: false,
          };
        }
        if (channel === "get-icon-path") return "";
        if (channel === "cache-history-preview") return { success: false };
        return {};
      }),
      ipcRenderer: {
        invoke: jest.fn(async (_channel, url) => ({
          success: true,
          title: "Test title",
          webpage_url: url,
        })),
      },
      on: jest.fn(),
    };
  });

  it("adds and removes is-active on progress container around download", async () => {
    await jest.isolateModulesAsync(async () => {
      jest.doMock("../domElements", () => ({
        urlInput: document.getElementById("url"),
        downloadButton: document.getElementById("download-button"),
        enqueueButton: document.getElementById("enqueue-button"),
        downloadCancelButton: document.getElementById("download-cancel"),
        buttonText: document.querySelector(".button-text"),
        progressBarContainer: document.getElementById("progress-bar-container"),
        progressBar: document.getElementById("progress-bar"),
        openLastVideoButton: document.getElementById("open-last-video"),
        queueClearButton: document.getElementById("queue-clear-button"),
        historyContainer: null,
      }));
      jest.doMock("../history", () => ({
        addNewEntryToHistory: jest.fn(async () => {}),
        updateDownloadCount: jest.fn(async () => {}),
        getHistoryData: jest.fn(() => []),
      }));
      jest.doMock("../validation", () => ({
        isValidUrl: jest.fn(() => true),
        isSupportedUrl: jest.fn(() => true),
      }));
      jest.doMock("../tooltipInitializer", () => ({
        initTooltips: jest.fn(),
      }));
      jest.doMock("../toast", () => ({ showToast: jest.fn() }));
      jest.doMock("../iconUpdater", () => ({ updateIcon: jest.fn() }));
      jest.doMock("../i18n", () => ({
        getLanguage: jest.fn(() => "en"),
        t: jest.fn((key) => key),
      }));
      jest.doMock("../urlInputHandler", () => ({
        hideUrlActionButtons: jest.fn(),
      }));

      const { initiateDownload } = require("../downloadManager");
      const progressBarContainer = document.getElementById(
        "progress-bar-container",
      );

      const promise = initiateDownload("https://example.com/a", "Source");
      expect(progressBarContainer.classList.contains("is-active")).toBe(true);
      await promise;
      expect(progressBarContainer.classList.contains("is-active")).toBe(false);
      expect(progressBarContainer.style.getPropertyValue("--progress-ratio")).toBe(
        "0",
      );
      expect(progressBarContainer.getAttribute("aria-valuenow")).toBe("0");
    });
  });

  it("keeps completed progress briefly before reset", async () => {
    jest.useFakeTimers();
    window.electron.invoke.mockImplementation(async (channel) => {
      if (channel === "download-video") {
        return await new Promise((resolve) => {
          setTimeout(
            () =>
              resolve({
                fileName: "file.mp4",
                filePath: "/tmp/file.mp4",
                quality: "Source",
                actualQuality: "Source",
                sourceUrl: "https://example.com/a",
                cancelled: false,
              }),
            50,
          );
        });
      }
      if (channel === "get-icon-path") return "";
      if (channel === "cache-history-preview") return { success: false };
      return {};
    });
    await jest.isolateModulesAsync(async () => {
      jest.doMock("../domElements", () => ({
        urlInput: document.getElementById("url"),
        downloadButton: document.getElementById("download-button"),
        enqueueButton: document.getElementById("enqueue-button"),
        downloadCancelButton: document.getElementById("download-cancel"),
        buttonText: document.querySelector(".button-text"),
        progressBarContainer: document.getElementById("progress-bar-container"),
        progressBar: document.getElementById("progress-bar"),
        openLastVideoButton: document.getElementById("open-last-video"),
        queueClearButton: document.getElementById("queue-clear-button"),
        historyContainer: null,
      }));
      jest.doMock("../history", () => ({
        addNewEntryToHistory: jest.fn(async () => {}),
        updateDownloadCount: jest.fn(async () => {}),
        getHistoryData: jest.fn(() => []),
      }));
      jest.doMock("../validation", () => ({
        isValidUrl: jest.fn(() => true),
        isSupportedUrl: jest.fn(() => true),
      }));
      jest.doMock("../tooltipInitializer", () => ({
        initTooltips: jest.fn(),
      }));
      jest.doMock("../toast", () => ({ showToast: jest.fn() }));
      jest.doMock("../iconUpdater", () => ({ updateIcon: jest.fn() }));
      jest.doMock("../i18n", () => ({
        getLanguage: jest.fn(() => "en"),
        t: jest.fn((key) => key),
      }));
      jest.doMock("../urlInputHandler", () => ({
        hideUrlActionButtons: jest.fn(),
      }));

      const { initiateDownload } = require("../downloadManager");
      const progressBarContainer = document.getElementById(
        "progress-bar-container",
      );

      const promise = initiateDownload("https://example.com/a", "Source");
      await jest.advanceTimersByTimeAsync(10);
      progressBarContainer.classList.add("is-complete");
      progressBarContainer.style.setProperty("--progress-ratio", "1");
      await jest.advanceTimersByTimeAsync(60);
      await promise;

      expect(progressBarContainer.classList.contains("is-active")).toBe(true);
      await jest.advanceTimersByTimeAsync(901);
      expect(progressBarContainer.classList.contains("is-active")).toBe(false);
      expect(progressBarContainer.style.getPropertyValue("--progress-ratio")).toBe(
        "0",
      );
      expect(progressBarContainer.getAttribute("aria-valuenow")).toBe("0");
    });
    jest.useRealTimers();
  });
});
