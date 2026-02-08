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
});
