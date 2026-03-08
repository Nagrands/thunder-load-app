const buildDom = () => {
  document.body.innerHTML = `
    <input id="url" />
    <button id="download-button"><span class="button-text"></span></button>
    <button id="enqueue-button"></button>
    <button id="download-cancel"></button>
    <div id="downloader-job-summary" class="hidden">
      <strong id="downloader-job-summary-title"></strong>
      <span id="downloader-job-summary-meta"></span>
    </div>
    <div id="progress-bar-container"></div>
    <div id="progress-bar"></div>
    <button id="open-last-video"></button>
    <div id="download-queue-info" class="hidden"></div>
    <span id="queue-count"></span>
    <span id="queue-active-count" class="hidden"></span>
    <span id="queue-done-count" class="hidden"></span>
    <span id="queue-cap-state" class="hidden"></span>
    <div id="queue-start-indicator" class="hidden"></div>
    <button id="queue-retry-failed-button"></button>
    <button id="queue-start-button"></button>
    <button id="queue-pause-button"></button>
    <button id="queue-toggle-button"></button>
    <button id="queue-clear-button"></button>
    <button id="queue-retry-transient-button"></button>
    <button id="queue-clear-failed-button"></button>
    <button id="queue-clear-done-button"></button>
    <div id="queue-list"></div>
    <span id="download-cancel-count" class="hidden"></span>
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

  it("loadQueueFromStorage filters invalid entries and exact duplicates", () => {
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
        addNewEntryToHistory: jest.fn(async () => {}),
        updateDownloadCount: jest.fn(async () => {}),
        getHistoryData: jest.fn(() => []),
      }));
      const { state } = require("../state");
      state.currentUrl = "https://example.com/b";
      const { loadQueueFromStorage } = require("../downloadManager");
      const res = loadQueueFromStorage();
      expect(res).toHaveLength(2);
      expect(res[0].url).toBe("https://example.com/a");
      expect(res[1].url).toBe("https://example.com/b");
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
        addNewEntryToHistory: jest.fn(async () => {}),
        updateDownloadCount: jest.fn(async () => {}),
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

  it("removes queue key from localStorage when queue becomes empty", () => {
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
        addNewEntryToHistory: jest.fn(async () => {}),
        updateDownloadCount: jest.fn(async () => {}),
        getHistoryData: jest.fn(() => []),
      }));
      const { state } = require("../state");
      const { persistQueue } = require("../downloadManager");

      state.downloadQueue = [{ url: "https://example.com/a", quality: "q1" }];
      persistQueue();
      expect(localStorage.getItem("downloadQueue")).toBeTruthy();

      state.downloadQueue = [];
      persistQueue();
      expect(localStorage.getItem("downloadQueue")).toBeNull();
    });
  });

  it("refreshes and persists pending queue title after restore", async () => {
    localStorage.setItem(
      "downloadQueue",
      JSON.stringify([
        { url: "https://example.com/a", quality: "q1", title: "" },
      ]),
    );

    await jest.isolateModulesAsync(async () => {
      window.electron = {
        invoke: jest.fn(),
        ipcRenderer: {
          invoke: jest.fn().mockImplementation((channel) => {
            if (channel === "get-video-info") {
              return Promise.resolve({
                success: true,
                title: "Resolved title",
              });
            }
            return Promise.resolve({});
          }),
        },
        on: jest.fn(),
      };

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

      const { state } = require("../state");
      const { initDownloadButton } = require("../downloadManager");
      initDownloadButton();

      await new Promise((resolve) => setTimeout(resolve, 0));

      expect(state.downloadQueue).toHaveLength(1);
      expect(state.downloadQueue[0].title).toBe("Resolved title");

      const raw = localStorage.getItem("downloadQueue");
      const parsed = JSON.parse(raw || "[]");
      expect(parsed[0].title).toBe("Resolved title");
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
      const { openDownloadQualityModal } = require("../downloadQualityModal");
      const urlInput = document.getElementById("url");
      urlInput.value = "https://example.com/a";
      await handleDownloadButtonClick({ enqueueOnly: true });
      expect(openDownloadQualityModal).toHaveBeenCalledWith(
        "https://example.com/a",
        expect.objectContaining({
          enqueueOnly: true,
        }),
      );
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
      expect(urlInput.value).toBe("https://example.com/a");
    });
  });

  it("keeps URL when quality modal is cancelled", async () => {
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
        getHistoryData: jest.fn(() => []),
      }));
      jest.doMock("../downloadQualityModal", () => ({
        openDownloadQualityModal: jest.fn().mockResolvedValue(null),
      }));

      const { handleDownloadButtonClick } = require("../downloadManager");
      const urlInput = document.getElementById("url");
      urlInput.value = "https://example.com/cancel";

      await handleDownloadButtonClick();

      expect(urlInput.value).toBe("https://example.com/cancel");
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

  it("passes forceAudioOnly to quality modal for audio-only flow", async () => {
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
        getHistoryData: jest.fn(() => []),
      }));
      jest.doMock("../downloadQualityModal", () => ({
        openDownloadQualityModal: jest.fn().mockResolvedValue({
          type: "audio-only",
          label: "Audio",
        }),
      }));

      const { handleDownloadButtonClick } = require("../downloadManager");
      const { openDownloadQualityModal } = require("../downloadQualityModal");
      const urlInput = document.getElementById("url");

      urlInput.value = "https://example.com/audio";
      await handleDownloadButtonClick({ forceAudioOnly: true });

      expect(openDownloadQualityModal).toHaveBeenCalledWith(
        "https://example.com/audio",
        expect.objectContaining({
          forceAudioOnly: true,
          enqueueOnly: undefined,
        }),
      );
    });
  });

  it("does not pass remembered quality label when audio profile is selected", async () => {
    await jest.isolateModulesAsync(async () => {
      localStorage.setItem("downloadQualityProfile", "audio");
      localStorage.setItem("downloadLastQuality", "1080p");

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

      const { handleDownloadButtonClick } = require("../downloadManager");
      const { openDownloadQualityModal } = require("../downloadQualityModal");
      const urlInput = document.getElementById("url");

      urlInput.value = "https://example.com/a";
      await handleDownloadButtonClick({ enqueueOnly: true });

      expect(openDownloadQualityModal).toHaveBeenCalledWith(
        "https://example.com/a",
        expect.objectContaining({
          defaultQualityProfile: "audio",
          preferredLabel: null,
        }),
      );
    });
  });

  it("allows overriding the quality profile with the best preset", async () => {
    await jest.isolateModulesAsync(async () => {
      localStorage.setItem("downloadQualityProfile", "remember");
      localStorage.setItem("downloadLastQuality", "1080p");

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

      const { handleDownloadButtonClick } = require("../downloadManager");
      const { openDownloadQualityModal } = require("../downloadQualityModal");
      const urlInput = document.getElementById("url");

      urlInput.value = "https://example.com/best";
      await handleDownloadButtonClick({ presetProfile: "best" });

      expect(openDownloadQualityModal).toHaveBeenCalledWith(
        "https://example.com/best",
        expect.objectContaining({
          defaultQualityProfile: "best",
          presetQuality: expect.any(String),
        }),
      );
    });
  });
});

describe("downloadManager job summary", () => {
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

  it("shows current active job stage and progress in summary", () => {
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
        queueStartButton: document.getElementById("queue-start-button"),
        queuePauseButton: document.getElementById("queue-pause-button"),
        queueToggleButton: document.getElementById("queue-toggle-button"),
        queueClearButton: document.getElementById("queue-clear-button"),
        queueRetryFailedButton: document.getElementById(
          "queue-retry-failed-button",
        ),
        historyContainer: null,
      }));
      jest.doMock("../history", () => ({
        getHistoryData: jest.fn(() => []),
        addNewEntryToHistory: jest.fn(),
        updateDownloadCount: jest.fn(),
      }));

      const { state } = require("../state");
      const { updateQueueDisplay } = require("../downloadManager");

      state.activeDownloads = [
        {
          jobId: "job-1",
          title: "Demo video",
          url: "https://example.com/demo",
          quality: "Source",
          progress: 42,
          stage: "download",
        },
      ];
      state.downloadQueue = [];
      state.failedDownloads = [];
      state.completedDownloads = [];

      updateQueueDisplay();

      expect(
        document
          .getElementById("downloader-job-summary")
          .classList.contains("hidden"),
      ).toBe(false);
      expect(
        document.getElementById("downloader-job-summary-title").textContent,
      ).toBe("Demo video");
      expect(
        document.getElementById("downloader-job-summary-meta").textContent,
      ).toContain("42%");
    });
  });

  it("renders stage, eta and audio badge for active queue items", () => {
    jest.useFakeTimers().setSystemTime(new Date("2026-03-08T12:00:00Z"));
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
        queueStartButton: document.getElementById("queue-start-button"),
        queuePauseButton: document.getElementById("queue-pause-button"),
        queueToggleButton: document.getElementById("queue-toggle-button"),
        queueClearButton: document.getElementById("queue-clear-button"),
        queueRetryFailedButton: document.getElementById(
          "queue-retry-failed-button",
        ),
        historyContainer: null,
      }));
      jest.doMock("../history", () => ({
        getHistoryData: jest.fn(() => []),
        addNewEntryToHistory: jest.fn(),
        updateDownloadCount: jest.fn(),
      }));

      const { state } = require("../state");
      const { updateQueueDisplay } = require("../downloadManager");

      state.activeDownloads = [
        {
          jobId: "job-2",
          title: "Audio demo",
          url: "https://example.com/audio",
          quality: { type: "audio-only", label: "Audio" },
          type: "audio",
          progress: 50,
          stage: "download",
          createdAt: Date.now() - 10000,
        },
      ];
      state.downloadQueue = [];
      state.failedDownloads = [];
      state.completedDownloads = [];

      updateQueueDisplay();

      const queueText =
        document.getElementById("queue-list").textContent || "";
      expect(queueText).toContain("Скачивание данных");
      expect(queueText).toContain("ETA");
      expect(queueText).toContain("Аудио");
    });
    jest.useRealTimers();
  });

  it("renders explicit reason and retry state chips for failed jobs", () => {
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
        queueStartButton: document.getElementById("queue-start-button"),
        queuePauseButton: document.getElementById("queue-pause-button"),
        queueToggleButton: document.getElementById("queue-toggle-button"),
        queueClearButton: document.getElementById("queue-clear-button"),
        queueRetryTransientButton: document.getElementById(
          "queue-retry-transient-button",
        ),
        queueClearFailedButton: document.getElementById(
          "queue-clear-failed-button",
        ),
        queueClearDoneButton: document.getElementById("queue-clear-done-button"),
        queueRetryFailedButton: document.getElementById(
          "queue-retry-failed-button",
        ),
        historyContainer: null,
      }));
      jest.doMock("../history", () => ({
        getHistoryData: jest.fn(() => []),
        addNewEntryToHistory: jest.fn(),
        updateDownloadCount: jest.fn(),
      }));

      const { state } = require("../state");
      const { updateQueueDisplay } = require("../downloadManager");

      state.failedDownloads = [
        {
          jobId: "fail-1",
          title: "Restricted video",
          url: "https://example.com/private",
          quality: "Source",
          errorCode: "AUTH_REQUIRED",
          retryable: false,
        },
      ];

      updateQueueDisplay();

      const queueText =
        document.getElementById("queue-list").textContent || "";
      expect(queueText).toContain("Нужна авторизация");
      expect(queueText).toContain("Нужен ручной шаг");
    });
  });

  it("shows retry-all bulk action when failed jobs exist", () => {
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
        queueStartButton: document.getElementById("queue-start-button"),
        queuePauseButton: document.getElementById("queue-pause-button"),
        queueToggleButton: document.getElementById("queue-toggle-button"),
        queueClearButton: document.getElementById("queue-clear-button"),
        queueRetryTransientButton: document.getElementById(
          "queue-retry-transient-button",
        ),
        queueClearFailedButton: document.getElementById(
          "queue-clear-failed-button",
        ),
        queueClearDoneButton: document.getElementById("queue-clear-done-button"),
        queueRetryFailedButton: document.getElementById(
          "queue-retry-failed-button",
        ),
        historyContainer: null,
      }));
      jest.doMock("../history", () => ({
        getHistoryData: jest.fn(() => []),
        addNewEntryToHistory: jest.fn(),
        updateDownloadCount: jest.fn(),
      }));

      const { state } = require("../state");
      const { updateQueueDisplay } = require("../downloadManager");

      state.failedDownloads = [
        {
          jobId: "fail-2",
          title: "Retry all",
          url: "https://example.com/fail",
          quality: "Source",
          errorCode: "NETWORK_TIMEOUT",
          retryable: true,
        },
      ];

      updateQueueDisplay();

      expect(
        document
          .getElementById("queue-retry-failed-button")
          .classList.contains("hidden"),
      ).toBe(false);
    });
  });
});

describe("downloadManager queue smart logic", () => {
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

  it("retries only retryable failed jobs via bulk action", async () => {
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
        queueStartButton: document.getElementById("queue-start-button"),
        queuePauseButton: document.getElementById("queue-pause-button"),
        queueToggleButton: document.getElementById("queue-toggle-button"),
        queueClearButton: document.getElementById("queue-clear-button"),
        queueRetryTransientButton: document.getElementById(
          "queue-retry-transient-button",
        ),
        queueClearFailedButton: document.getElementById(
          "queue-clear-failed-button",
        ),
        queueClearDoneButton: document.getElementById("queue-clear-done-button"),
        queueRetryFailedButton: document.getElementById(
          "queue-retry-failed-button",
        ),
        historyContainer: null,
      }));
      jest.doMock("../history", () => ({
        getHistoryData: jest.fn(() => []),
        addNewEntryToHistory: jest.fn(),
        updateDownloadCount: jest.fn(),
      }));

      const { state } = require("../state");
      const { initDownloadButton, updateQueueDisplay } = require("../downloadManager");

      state.failedDownloads = [
        {
          jobId: "f1",
          title: "Retryable",
          url: "https://example.com/a",
          quality: "Source",
          retryable: true,
          errorCode: "NETWORK_TIMEOUT",
        },
        {
          jobId: "f2",
          title: "Manual",
          url: "https://example.com/b",
          quality: "Source",
          retryable: false,
          errorCode: "AUTH_REQUIRED",
        },
      ];

      initDownloadButton();
      updateQueueDisplay();
      document.getElementById("queue-retry-transient-button").click();

      expect(state.activeDownloads).toHaveLength(1);
      expect(state.activeDownloads[0].url).toBe("https://example.com/a");
      expect(state.failedDownloads).toHaveLength(1);
      expect(state.failedDownloads[0].url).toBe("https://example.com/b");
    });
  });

  it("clears completed jobs via bulk action", async () => {
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
        queueStartButton: document.getElementById("queue-start-button"),
        queuePauseButton: document.getElementById("queue-pause-button"),
        queueToggleButton: document.getElementById("queue-toggle-button"),
        queueClearButton: document.getElementById("queue-clear-button"),
        queueRetryTransientButton: document.getElementById(
          "queue-retry-transient-button",
        ),
        queueClearFailedButton: document.getElementById(
          "queue-clear-failed-button",
        ),
        queueClearDoneButton: document.getElementById("queue-clear-done-button"),
        queueRetryFailedButton: document.getElementById(
          "queue-retry-failed-button",
        ),
        historyContainer: null,
      }));
      jest.doMock("../history", () => ({
        getHistoryData: jest.fn(() => []),
        addNewEntryToHistory: jest.fn(),
        updateDownloadCount: jest.fn(),
      }));

      const { state } = require("../state");
      const { initDownloadButton, updateQueueDisplay } = require("../downloadManager");

      state.completedDownloads = [
        {
          jobId: "d1",
          title: "Done",
          url: "https://example.com/done",
          quality: "Source",
        },
      ];

      initDownloadButton();
      updateQueueDisplay();
      document.getElementById("queue-clear-done-button").click();

      expect(state.completedDownloads).toHaveLength(0);
    });
  });

  it("allows same URL with different quality labels in queue", async () => {
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
        queueStartButton: document.getElementById("queue-start-button"),
        queueClearButton: document.getElementById("queue-clear-button"),
        historyContainer: null,
      }));
      jest.doMock("../history", () => ({
        getHistoryData: jest.fn(() => []),
      }));
      jest.doMock("../downloadQualityModal", () => ({
        openDownloadQualityModal: jest
          .fn()
          .mockResolvedValueOnce("Source")
          .mockResolvedValueOnce({ type: "audio-only", label: "Audio" }),
      }));
      const { state } = require("../state");
      const { handleDownloadButtonClick } = require("../downloadManager");
      const urlInput = document.getElementById("url");

      urlInput.value = "https://example.com/a";
      await handleDownloadButtonClick({ enqueueOnly: true });
      urlInput.value = "https://example.com/a";
      await handleDownloadButtonClick({ enqueueOnly: true });

      expect(state.downloadQueue).toHaveLength(2);
      expect(state.downloadQueue[0].quality).toBe("Source");
      expect(state.downloadQueue[1].quality.type).toBe("audio-only");
    });
  });

  it("blocks duplicate queue item with same URL and same quality", async () => {
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
        queueStartButton: document.getElementById("queue-start-button"),
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
      urlInput.value = "https://example.com/a";
      await handleDownloadButtonClick({ enqueueOnly: true });

      expect(state.downloadQueue).toHaveLength(1);
    });
  });

  it("supports moving queue item up/down from queue controls", () => {
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
        queueStartButton: document.getElementById("queue-start-button"),
        queueClearButton: document.getElementById("queue-clear-button"),
        historyContainer: null,
      }));
      jest.doMock("../history", () => ({
        getHistoryData: jest.fn(() => []),
      }));
      jest.doMock("../i18n", () => ({
        getLanguage: jest.fn(() => "en"),
        t: jest.fn((key, params = {}) => {
          if (key === "queue.limit.near") return `Slots left: ${params.count}`;
          if (key === "queue.limit.full") return "Queue limit reached";
          return key;
        }),
      }));
      jest.doMock("../toast", () => ({ showToast: jest.fn() }));

      const { state } = require("../state");
      const {
        initDownloadButton,
        updateQueueDisplay,
      } = require("../downloadManager");

      state.downloadQueue = [
        { url: "https://example.com/a", quality: "Source" },
        { url: "https://example.com/b", quality: "Source" },
      ];
      initDownloadButton();
      updateQueueDisplay();

      const downBtn = document.querySelector(
        '.queue-item-actions [data-queue-move="down"][data-index="0"]',
      );
      const pendingRow = document.querySelector("#queue-list li");
      expect(pendingRow?.querySelector(".queue-quality-chip")).toBeTruthy();
      downBtn.click();
      expect(state.downloadQueue[0].url).toBe("https://example.com/b");

      const upBtn = document.querySelector(
        '.queue-item-actions [data-queue-move="up"][data-index="1"]',
      );
      upBtn.click();
      expect(state.downloadQueue[0].url).toBe("https://example.com/a");
    });
  });

  it("renders 200 queued items when queue reaches max size", () => {
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
        queueStartButton: document.getElementById("queue-start-button"),
        queueClearButton: document.getElementById("queue-clear-button"),
        historyContainer: null,
      }));
      jest.doMock("../history", () => ({
        getHistoryData: jest.fn(() => []),
      }));
      jest.doMock("../i18n", () => ({
        getLanguage: jest.fn(() => "en"),
        t: jest.fn((key, params = {}) => {
          if (key === "queue.limit.near") return `Slots left: ${params.count}`;
          if (key === "queue.limit.full") return "Queue limit reached";
          return key;
        }),
      }));

      const { state } = require("../state");
      const { updateQueueDisplay } = require("../downloadManager");
      state.downloadQueue = Array.from({ length: 200 }, (_, idx) => ({
        url: `https://example.com/${idx}`,
        quality: "Source",
      }));
      updateQueueDisplay();

      const queueItems = document.querySelectorAll("#queue-list li");
      expect(queueItems).toHaveLength(200);
    });
  });

  it("renders active downloads with status chip and separate active counter", () => {
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
        queueStartButton: document.getElementById("queue-start-button"),
        queueClearButton: document.getElementById("queue-clear-button"),
        historyContainer: null,
      }));
      jest.doMock("../history", () => ({
        getHistoryData: jest.fn(() => []),
      }));
      jest.doMock("../i18n", () => ({
        getLanguage: jest.fn(() => "ru"),
        t: jest.fn((key, vars = {}) => {
          if (key === "queue.pill.active") return `${vars.count || 0} активно`;
          if (key === "queue.status.downloading") return "Загрузка";
          if (key === "queue.pill.pending")
            return `${vars.count || 0} в очереди`;
          if (key === "queue.quality.label") return "Качество";
          if (key === "queue.limit.near")
            return `Осталось мест: ${vars.count || 0}`;
          if (key === "queue.limit.full") return "Лимит очереди достигнут";
          return key;
        }),
      }));

      const activeCounter = document.getElementById("queue-active-count");

      const { state } = require("../state");
      const { updateQueueDisplay } = require("../downloadManager");
      state.activeDownloads = [
        { jobId: "job-a", url: "https://example.com/a", quality: "Source" },
      ];
      state.downloadQueue = [
        { url: "https://example.com/b", quality: "Source" },
      ];
      updateQueueDisplay();

      expect(activeCounter?.textContent).toBe("1 активно");
      expect(activeCounter?.classList.contains("hidden")).toBe(false);
      const activeRow = document.querySelector("#queue-list li");
      expect(activeRow).toBeTruthy();
      expect(activeRow?.querySelector(".queue-quality-chip")).toBeTruthy();
      expect(
        activeRow?.querySelector(".queue-status-chip")?.textContent,
      ).toContain("Загрузка");
      expect(activeRow?.getAttribute("role")).toBe("listitem");
    });
  });

  it("renders queue list with list/listitem roles and pending aria label", () => {
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
        queueStartButton: document.getElementById("queue-start-button"),
        queueClearButton: document.getElementById("queue-clear-button"),
        historyContainer: null,
      }));
      jest.doMock("../history", () => ({
        getHistoryData: jest.fn(() => []),
      }));
      jest.doMock("../i18n", () => ({
        getLanguage: jest.fn(() => "ru"),
        t: jest.fn((key, vars = {}) => {
          if (key === "queue.pill.pending")
            return `${vars.count || 0} в очереди`;
          if (key === "queue.status.pending") return "В очереди";
          if (key === "queue.quality.label") return "Качество";
          if (key === "queue.links.many") return "ссылок";
          if (key === "queue.links.one") return "ссылка";
          if (key === "queue.links.few") return "ссылки";
          if (key === "queue.limit.near")
            return `Осталось мест: ${vars.count || 0}`;
          if (key === "queue.limit.full") return "Лимит очереди достигнут";
          return key;
        }),
      }));

      const { state } = require("../state");
      const { updateQueueDisplay } = require("../downloadManager");
      state.downloadQueue = [
        { url: "https://example.com/a", quality: "Source" },
      ];
      updateQueueDisplay();

      const queueList = document.getElementById("queue-list");
      const pendingRow = queueList.querySelector("li");
      expect(queueList.getAttribute("role")).toBe("list");
      expect(queueList.querySelector("ul")?.getAttribute("role")).toBe("list");
      expect(pendingRow?.getAttribute("role")).toBe("listitem");
      expect(
        pendingRow?.querySelector(".queue-status-chip")?.textContent || "",
      ).toContain("В очереди");
    });
  });

  it("renders failed items and retries failed task by action button", async () => {
    await jest.isolateModulesAsync(async () => {
      window.electron = {
        invoke: jest.fn(async (channel, url) => {
          if (channel === "download-video") {
            return {
              fileName: "file.mp4",
              filePath: "/tmp/file.mp4",
              quality: "Source",
              actualQuality: "Source",
              sourceUrl: url,
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
            title: `Title ${url}`,
          })),
        },
        on: jest.fn(),
      };
      jest.doMock("../domElements", () => ({
        urlInput: document.getElementById("url"),
        downloadButton: document.getElementById("download-button"),
        enqueueButton: document.getElementById("enqueue-button"),
        downloadCancelButton: document.getElementById("download-cancel"),
        buttonText: document.querySelector(".button-text"),
        progressBarContainer: document.getElementById("progress-bar-container"),
        progressBar: document.getElementById("progress-bar"),
        openLastVideoButton: document.getElementById("open-last-video"),
        queueRetryFailedButton: document.getElementById(
          "queue-retry-failed-button",
        ),
        queueStartButton: document.getElementById("queue-start-button"),
        queueClearButton: document.getElementById("queue-clear-button"),
        historyContainer: null,
      }));
      jest.doMock("../history", () => ({
        addNewEntryToHistory: jest.fn(async () => {}),
        updateDownloadCount: jest.fn(async () => {}),
        getHistoryData: jest.fn(() => []),
      }));
      jest.doMock("../i18n", () => ({
        getLanguage: jest.fn(() => "ru"),
        t: jest.fn((key, params = {}) => {
          if (key === "queue.status.downloading") return "Загрузка";
          if (key === "queue.status.error") return "Ошибка";
          if (key === "queue.reason.authRequired")
            return "Нужна авторизация";
          if (key === "queue.retryState.needsAction")
            return "Нужен ручной шаг";
          if (key === "queue.pill.pending")
            return `${params.count || 0} в очереди`;
          if (key === "queue.pill.active")
            return `${params.count || 0} активно`;
          if (key === "queue.item.retrying")
            return "Повторная загрузка запущена.";
          if (key === "queue.retryFailed.toast")
            return `Повтор: ${params.count || 0} задач`;
          if (key === "queue.limit.near")
            return `Осталось мест: ${params.count || 0}`;
          if (key === "queue.limit.full") return "Лимит очереди достигнут";
          return key;
        }),
      }));
      jest.doMock("../toast", () => ({ showToast: jest.fn() }));
      jest.doMock("../iconUpdater", () => ({ updateIcon: jest.fn() }));

      const { state } = require("../state");
      const {
        initDownloadButton,
        updateQueueDisplay,
      } = require("../downloadManager");
      state.failedDownloads = [
        { url: "https://example.com/failed", quality: "Source" },
      ];

      initDownloadButton();
      updateQueueDisplay();

      const failedRow = document.querySelector("#queue-list li");
      expect(failedRow).toBeTruthy();
      expect(failedRow?.querySelector(".queue-quality-chip")).toBeTruthy();
      expect(
        failedRow?.querySelector(
          ".queue-item-actions [data-queue-remove-failed]",
        ),
      ).toBeTruthy();
      const retryBtn = failedRow.querySelector("[data-queue-retry-failed]");
      retryBtn.click();
      await Promise.resolve();

      expect(window.electron.invoke).toHaveBeenCalledWith(
        "download-video",
        "https://example.com/failed",
        "Source",
        expect.stringMatching(/^job-/),
      );
    });
  });

  it("keeps manual retry available for non-retryable failed jobs and mirrors status in summary", async () => {
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
        queueRetryFailedButton: document.getElementById(
          "queue-retry-failed-button",
        ),
        queueStartButton: document.getElementById("queue-start-button"),
        queueClearButton: document.getElementById("queue-clear-button"),
        historyContainer: null,
      }));
      jest.doMock("../history", () => ({
        addNewEntryToHistory: jest.fn(async () => {}),
        updateDownloadCount: jest.fn(async () => {}),
        getHistoryData: jest.fn(() => []),
      }));
      window.electron = {
        invoke: jest.fn(async (channel, url) => {
          if (channel === "download-video") {
            return {
              fileName: "private.mp4",
              filePath: "/tmp/private.mp4",
              quality: "Source",
              actualQuality: "Source",
              sourceUrl: url,
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
            title: `Title ${url}`,
          })),
        },
        on: jest.fn(),
      };
      jest.doMock("../i18n", () => ({
        getLanguage: jest.fn(() => "ru"),
        t: jest.fn((key) => {
          const dict = {
            "queue.status.error": "Ошибка",
            "queue.reason.authRequired": "Нужна авторизация",
            "queue.retryState.needsAction": "Нужен ручной шаг",
            "queue.item.retry.manual.title":
              "Повторить после исправления причины",
            "downloader.jobSummary.badgeError": "Ошибка",
            "queue.pill.active": "0 активно",
          };
          return dict[key] || key;
        }),
      }));
      jest.doMock("../toast", () => ({ showToast: jest.fn() }));
      jest.doMock("../iconUpdater", () => ({ updateIcon: jest.fn() }));

      const { state } = require("../state");
      const {
        initDownloadButton,
        updateQueueDisplay,
      } = require("../downloadManager");
      state.downloadJobs = [
        {
          jobId: "failed-1",
          url: "https://example.com/private",
          title: "Private video",
          quality: "Source",
          signature: "failed-1",
          status: "failed",
          errorCode: "AUTH_REQUIRED",
          retryable: false,
        },
      ];

      initDownloadButton();
      updateQueueDisplay();

      const retryBtn = document.querySelector("[data-queue-retry-failed]");
      expect(retryBtn).toBeTruthy();
      expect(retryBtn.disabled).toBe(false);
      expect(retryBtn.getAttribute("title")).toBe(
        "Повторить после исправления причины",
      );
      expect(
        document.getElementById("downloader-job-summary-title").textContent,
      ).toBe("Private video");
      expect(
        document.getElementById("downloader-job-summary-meta").textContent,
      ).toContain("Нужна авторизация");
      retryBtn.click();
      await Promise.resolve();
      expect(window.electron.invoke).toHaveBeenCalledWith(
        "download-video",
        "https://example.com/private",
        "Source",
        expect.stringMatching(/^job-/),
      );
    });
  });

  it("toggles queue list visibility and persists collapsed state", () => {
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
        queueStartButton: document.getElementById("queue-start-button"),
        queuePauseButton: document.getElementById("queue-pause-button"),
        queueToggleButton: document.getElementById("queue-toggle-button"),
        queueClearButton: document.getElementById("queue-clear-button"),
        historyContainer: null,
      }));
      jest.doMock("../history", () => ({
        getHistoryData: jest.fn(() => []),
      }));
      const { state } = require("../state");
      const {
        initDownloadButton,
        updateQueueDisplay,
      } = require("../downloadManager");
      state.downloadQueue = [
        { url: "https://example.com/a", quality: "Source" },
      ];
      initDownloadButton();
      updateQueueDisplay();

      const queueList = document.getElementById("queue-list");
      const toggleBtn = document.getElementById("queue-toggle-button");
      expect(queueList.classList.contains("hidden")).toBe(false);

      toggleBtn.click();
      expect(queueList.classList.contains("hidden")).toBe(true);
      expect(localStorage.getItem("downloadQueueCollapsed")).toBe("1");

      jest.resetModules();
      buildDom();
      window.electron = {
        invoke: jest.fn(),
        ipcRenderer: { invoke: jest.fn() },
        on: jest.fn(),
      };
      jest.isolateModules(() => {
        jest.doMock("../domElements", () => ({
          urlInput: document.getElementById("url"),
          downloadButton: document.getElementById("download-button"),
          enqueueButton: document.getElementById("enqueue-button"),
          downloadCancelButton: document.getElementById("download-cancel"),
          buttonText: document.querySelector(".button-text"),
          progressBarContainer: document.getElementById(
            "progress-bar-container",
          ),
          progressBar: document.getElementById("progress-bar"),
          openLastVideoButton: document.getElementById("open-last-video"),
          queueStartButton: document.getElementById("queue-start-button"),
          queuePauseButton: document.getElementById("queue-pause-button"),
          queueToggleButton: document.getElementById("queue-toggle-button"),
          queueClearButton: document.getElementById("queue-clear-button"),
          historyContainer: null,
        }));
        jest.doMock("../history", () => ({
          getHistoryData: jest.fn(() => []),
        }));
        const { state } = require("../state");
        const {
          initDownloadButton,
          updateQueueDisplay,
        } = require("../downloadManager");
        state.downloadQueue = [
          { url: "https://example.com/a", quality: "Source" },
        ];
        initDownloadButton();
        updateQueueDisplay();
        expect(
          document.getElementById("queue-list").classList.contains("hidden"),
        ).toBe(true);
      });
    });
  });

  it("removes collapsed key when queue is expanded back", () => {
    jest.isolateModules(() => {
      localStorage.setItem("downloadQueueCollapsed", "1");
      jest.doMock("../domElements", () => ({
        urlInput: document.getElementById("url"),
        downloadButton: document.getElementById("download-button"),
        enqueueButton: document.getElementById("enqueue-button"),
        downloadCancelButton: document.getElementById("download-cancel"),
        buttonText: document.querySelector(".button-text"),
        progressBarContainer: document.getElementById("progress-bar-container"),
        progressBar: document.getElementById("progress-bar"),
        openLastVideoButton: document.getElementById("open-last-video"),
        queueStartButton: document.getElementById("queue-start-button"),
        queuePauseButton: document.getElementById("queue-pause-button"),
        queueToggleButton: document.getElementById("queue-toggle-button"),
        queueClearButton: document.getElementById("queue-clear-button"),
        historyContainer: null,
      }));
      jest.doMock("../history", () => ({
        getHistoryData: jest.fn(() => []),
      }));
      const { state } = require("../state");
      const {
        initDownloadButton,
        updateQueueDisplay,
      } = require("../downloadManager");
      state.downloadQueue = [
        { url: "https://example.com/a", quality: "Source" },
      ];
      initDownloadButton();
      updateQueueDisplay();

      const toggleBtn = document.getElementById("queue-toggle-button");
      toggleBtn.click();
      expect(localStorage.getItem("downloadQueueCollapsed")).toBeNull();
      expect(
        document.getElementById("queue-list").classList.contains("hidden"),
      ).toBe(false);
    });
  });

  it("disables pause only when queue has no active and no pending items", () => {
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
        queueStartButton: document.getElementById("queue-start-button"),
        queuePauseButton: document.getElementById("queue-pause-button"),
        queueToggleButton: document.getElementById("queue-toggle-button"),
        queueClearButton: document.getElementById("queue-clear-button"),
        historyContainer: null,
      }));
      jest.doMock("../history", () => ({
        getHistoryData: jest.fn(() => []),
      }));
      const { state } = require("../state");
      const { updateQueueDisplay } = require("../downloadManager");
      const pauseBtn = document.getElementById("queue-pause-button");

      state.downloadJobs = [];
      state.activeDownloads = [];
      state.downloadQueue = [
        { url: "https://example.com/a", quality: "Source" },
      ];
      updateQueueDisplay();
      expect(pauseBtn.disabled).toBe(false);

      state.downloadJobs = [];
      state.activeDownloads = [
        { jobId: "job-1", url: "https://example.com/a", quality: "Source" },
      ];
      updateQueueDisplay();
      expect(pauseBtn.disabled).toBe(false);

      state.downloadJobs = [];
      state.activeDownloads = [];
      state.downloadQueue = [];
      updateQueueDisplay();
      expect(pauseBtn.disabled).toBe(true);
    });
  });

  it("disables start button while there is an active download", () => {
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
        queueStartButton: document.getElementById("queue-start-button"),
        queuePauseButton: document.getElementById("queue-pause-button"),
        queueToggleButton: document.getElementById("queue-toggle-button"),
        queueClearButton: document.getElementById("queue-clear-button"),
        historyContainer: null,
      }));
      jest.doMock("../history", () => ({
        getHistoryData: jest.fn(() => []),
      }));
      const { state } = require("../state");
      const { updateQueueDisplay } = require("../downloadManager");
      const startBtn = document.getElementById("queue-start-button");

      state.downloadJobs = [];
      state.activeDownloads = [];
      state.downloadQueue = [
        { url: "https://example.com/pending", quality: "Source" },
      ];
      updateQueueDisplay();
      expect(startBtn.disabled).toBe(false);

      state.downloadJobs = [];
      state.activeDownloads = [
        {
          jobId: "job-1",
          url: "https://example.com/active",
          quality: "Source",
        },
      ];
      updateQueueDisplay();
      expect(startBtn.disabled).toBe(true);
    });
  });

  it("pause button stops active downloads and puts them back to queue", async () => {
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
        queueStartButton: document.getElementById("queue-start-button"),
        queuePauseButton: document.getElementById("queue-pause-button"),
        queueToggleButton: document.getElementById("queue-toggle-button"),
        queueClearButton: document.getElementById("queue-clear-button"),
        historyContainer: null,
      }));
      jest.doMock("../history", () => ({
        getHistoryData: jest.fn(() => []),
      }));
      const { state } = require("../state");
      const {
        initDownloadButton,
        updateQueueDisplay,
      } = require("../downloadManager");
      const pauseBtn = document.getElementById("queue-pause-button");

      window.electron.invoke = jest.fn(async () => null);

      state.downloadQueue = [
        { url: "https://example.com/pending", quality: "Source" },
      ];
      state.activeDownloads = [
        {
          jobId: "job-1",
          url: "https://example.com/active",
          quality: "Source",
          progress: 35,
        },
      ];
      state.suppressAutoPump = false;
      initDownloadButton();
      updateQueueDisplay();

      pauseBtn.click();
      await new Promise((resolve) => setTimeout(resolve, 0));

      expect(window.electron.invoke).toHaveBeenCalledWith("stop-download");
      expect(state.suppressAutoPump).toBe(true);
      expect(state.activeDownloads).toHaveLength(0);
      expect(state.downloadQueue).toHaveLength(2);
      expect(state.downloadQueue[0].url).toBe("https://example.com/active");
      expect(document.getElementById("queue-start-button").disabled).toBe(
        false,
      );
    });
  });

  it("hides queue block when there are no queue items", () => {
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
        queueStartButton: document.getElementById("queue-start-button"),
        queuePauseButton: document.getElementById("queue-pause-button"),
        queueToggleButton: document.getElementById("queue-toggle-button"),
        queueClearButton: document.getElementById("queue-clear-button"),
        historyContainer: null,
      }));
      jest.doMock("../history", () => ({
        getHistoryData: jest.fn(() => []),
      }));
      const { state } = require("../state");
      const { updateQueueDisplay } = require("../downloadManager");
      state.activeDownloads = [];
      state.downloadQueue = [];
      state.failedDownloads = [];
      state.completedDownloads = [];
      updateQueueDisplay();
      expect(
        document
          .getElementById("download-queue-info")
          .classList.contains("hidden"),
      ).toBe(true);
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
            thumbnail: "https://img.example.com/thumb.jpg",
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
      const previewInfoCallCountBeforeAwait =
        window.electron.ipcRenderer.invoke.mock.calls.filter(
          ([channel]) => channel === "get-video-info",
        ).length;
      await promise;
      const previewInfoCallCountAfterAwait =
        window.electron.ipcRenderer.invoke.mock.calls.filter(
          ([channel]) => channel === "get-video-info",
        ).length;
      expect(previewInfoCallCountAfterAwait).toBe(previewInfoCallCountBeforeAwait);
      expect(progressBarContainer.classList.contains("is-active")).toBe(false);
      expect(
        progressBarContainer.style.getPropertyValue("--progress-ratio"),
      ).toBe("0");
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
                thumbnail: "https://img.example.com/thumb.jpg",
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
      expect(
        progressBarContainer.style.getPropertyValue("--progress-ratio"),
      ).toBe("0");
      expect(progressBarContainer.getAttribute("aria-valuenow")).toBe("0");
    });
    jest.useRealTimers();
  });

  it("shows dedicated toast for yt-dlp network timeout", async () => {
    await jest.isolateModulesAsync(async () => {
      const consoleErrorSpy = jest
        .spyOn(console, "error")
        .mockImplementation(() => {});
      window.electron = {
        invoke: jest.fn(async (channel) => {
          if (channel === "download-video") {
            throw new Error(
              'ERR_YTDLP_NETWORK_TIMEOUT: ERROR: [youtube] aWJpcxjk5DQ: Unable to download API page: HTTPSConnectionPool(host="www.youtube.com", port=443): Read timed out. (read timeout=20.0)',
            );
          }
          return {};
        }),
        ipcRenderer: { invoke: jest.fn() },
        on: jest.fn(),
      };
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
      const { showToast } = require("../toast");

      await initiateDownload(
        "https://www.youtube.com/watch?v=aWJpcxjk5DQ",
        "Source",
      );
      expect(showToast).toHaveBeenCalledWith(
        "download.error.networkTimeout",
        "error",
      );
      consoleErrorSpy.mockRestore();
    });
  });

  it("shows dedicated toast for auth-required videos", async () => {
    await jest.isolateModulesAsync(async () => {
      const consoleErrorSpy = jest
        .spyOn(console, "error")
        .mockImplementation(() => {});
      window.electron = {
        invoke: jest.fn(async (channel) => {
          if (channel === "download-video") {
            throw new Error(
              "ERR_YTDLP_AUTH_REQUIRED: This video requires authorization. Add browser cookies and try again.",
            );
          }
          return {};
        }),
        ipcRenderer: { invoke: jest.fn() },
        on: jest.fn(),
      };
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
      const { showToast } = require("../toast");
      const { addNewEntryToHistory } = require("../history");

      await initiateDownload(
        "https://www.youtube.com/watch?v=private-video",
        "Source",
      );
      expect(showToast).toHaveBeenCalledWith(
        "download.error.authRequired",
        "error",
      );
      expect(addNewEntryToHistory).toHaveBeenCalledWith(
        expect.objectContaining({
          downloadStatus: "failed",
          errorCode: "AUTH_REQUIRED",
          retryable: false,
          sourceUrl: "https://www.youtube.com/watch?v=private-video",
        }),
      );
      consoleErrorSpy.mockRestore();
    });
  });

  it("handles structured DOWNLOAD_VIDEO failures without relying on thrown Error", async () => {
    await jest.isolateModulesAsync(async () => {
      const consoleErrorSpy = jest
        .spyOn(console, "error")
        .mockImplementation(() => {});
      window.electron = {
        invoke: jest.fn(async (channel) => {
          if (channel === "download-video") {
            return {
              success: false,
              errorCode: "PRIVATE_CONTENT",
              retryable: false,
              message:
                "Видео доступно только владельцу, подписчикам или участникам канала.",
            };
          }
          return {};
        }),
        ipcRenderer: { invoke: jest.fn() },
        on: jest.fn(),
      };
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
      const addNewEntryToHistory = jest.fn(async () => {});
      jest.doMock("../history", () => ({
        addNewEntryToHistory,
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
      const showToast = jest.fn();
      jest.doMock("../toast", () => ({ showToast }));
      jest.doMock("../iconUpdater", () => ({ updateIcon: jest.fn() }));
      jest.doMock("../i18n", () => ({
        getLanguage: jest.fn(() => "ru"),
        t: jest.fn((key) => {
          const dict = {
            "download.error.privateContent":
              "Видео доступно только владельцу, подписчикам или участникам канала.",
            "quality.custom": "Выбранный формат",
          };
          return dict[key] || key;
        }),
      }));
      jest.doMock("../urlInputHandler", () => ({
        hideUrlActionButtons: jest.fn(),
      }));

      const { initiateDownload } = require("../downloadManager");

      await initiateDownload(
        "https://www.youtube.com/watch?v=private-video",
        "Source",
      );

      expect(showToast).toHaveBeenCalledWith(
        "Видео доступно только владельцу, подписчикам или участникам канала.",
        "error",
      );
      expect(addNewEntryToHistory).toHaveBeenCalledWith(
        expect.objectContaining({
          downloadStatus: "failed",
          errorCode: "PRIVATE_CONTENT",
          retryable: false,
        }),
      );
      consoleErrorSpy.mockRestore();
    });
  });

  it("treats renderer-side history bookkeeping failures as non-fatal after file is downloaded", async () => {
    await jest.isolateModulesAsync(async () => {
      const consoleWarnSpy = jest
        .spyOn(console, "warn")
        .mockImplementation(() => {});
      window.electron = {
        invoke: jest.fn(async (channel) => {
          if (channel === "download-video") {
            return {
              fileName: "done.mp4",
              filePath: "/tmp/done.mp4",
              quality: "Source",
              actualQuality: "Source",
              sourceUrl: "https://example.com/done",
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
            title: `Title ${url}`,
          })),
        },
        on: jest.fn(),
      };
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
        addNewEntryToHistory: jest.fn(async () => {
          throw new Error("history write failed");
        }),
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
      const showToast = jest.fn();
      jest.doMock("../toast", () => ({ showToast }));
      jest.doMock("../iconUpdater", () => ({ updateIcon: jest.fn() }));
      jest.doMock("../i18n", () => ({
        getLanguage: jest.fn(() => "ru"),
        t: jest.fn((key) => key),
      }));
      jest.doMock("../urlInputHandler", () => ({
        hideUrlActionButtons: jest.fn(),
      }));

      const { initiateDownload } = require("../downloadManager");
      const { state } = require("../state");

      const result = await initiateDownload("https://example.com/done", "Source");

      expect(result).toBeUndefined();
      expect(state.activeDownloads).toHaveLength(0);
      expect(state.downloadJobs.some((job) => job.status === "running")).toBe(
        false,
      );
      expect(showToast).not.toHaveBeenCalledWith(
        "download.error.retry",
        "error",
      );
      expect(consoleWarnSpy).toHaveBeenCalledWith(
        "Post-download history bookkeeping failed, but file is already saved:",
        expect.any(Error),
      );
      consoleWarnSpy.mockRestore();
    });
  });

  it("moves successful downloads out of running state immediately after completion", async () => {
    await jest.isolateModulesAsync(async () => {
      window.electron = {
        invoke: jest.fn(async (channel) => {
          if (channel === "download-video") {
            return {
              fileName: "done.mp4",
              filePath: "/tmp/done.mp4",
              quality: "Source",
              actualQuality: "Source",
              sourceUrl: "https://example.com/done",
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
            title: `Title ${url}`,
          })),
        },
        on: jest.fn(),
      };
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
        getLanguage: jest.fn(() => "ru"),
        t: jest.fn((key) => key),
      }));
      jest.doMock("../urlInputHandler", () => ({
        hideUrlActionButtons: jest.fn(),
      }));

      const { initiateDownload } = require("../downloadManager");
      const { state } = require("../state");

      await initiateDownload("https://example.com/done", "Source");

      expect(state.downloadJobs.some((job) => job.status === "running")).toBe(
        false,
      );
      expect(state.completedDownloads).toHaveLength(1);
      expect(state.completedDownloads[0].status).toBe("done");
      expect(state.isDownloading).toBe(false);
    });
  });
});

describe("downloadManager parallel pool", () => {
  const deferred = () => {
    let resolve;
    let reject;
    const promise = new Promise((res, rej) => {
      resolve = res;
      reject = rej;
    });
    return { promise, resolve, reject };
  };

  beforeEach(() => {
    jest.resetModules();
    localStorage.clear();
    buildDom();
    global.window = global.window || {};
  });

  it("queues new task when parallel pool is full", async () => {
    await jest.isolateModulesAsync(async () => {
      window.electron = {
        invoke: jest.fn(),
        ipcRenderer: { invoke: jest.fn() },
        on: jest.fn(),
      };
      jest.doMock("../domElements", () => ({
        urlInput: document.getElementById("url"),
        downloadButton: document.getElementById("download-button"),
        enqueueButton: document.getElementById("enqueue-button"),
        downloadCancelButton: document.getElementById("download-cancel"),
        buttonText: document.querySelector(".button-text"),
        progressBarContainer: document.getElementById("progress-bar-container"),
        progressBar: document.getElementById("progress-bar"),
        openLastVideoButton: document.getElementById("open-last-video"),
        queueStartButton: document.getElementById("queue-start-button"),
        queueClearButton: document.getElementById("queue-clear-button"),
        historyContainer: null,
      }));
      jest.doMock("../history", () => ({
        getHistoryData: jest.fn(() => []),
      }));
      jest.doMock("../toast", () => ({ showToast: jest.fn() }));

      const { state } = require("../state");
      const { initiateDownload } = require("../downloadManager");
      state.activeDownloads = [
        { jobId: "job-1", signature: "sig-1" },
        { jobId: "job-2", signature: "sig-2" },
      ];
      state.maxParallelDownloads = 2;

      await initiateDownload("https://example.com/c", "Source");
      expect(state.downloadQueue).toHaveLength(1);
      expect(state.downloadQueue[0]).toMatchObject({
        url: "https://example.com/c",
        quality: "Source",
        status: "pending",
      });
      expect(window.electron.invoke).not.toHaveBeenCalledWith(
        "download-video",
        expect.anything(),
        expect.anything(),
        expect.anything(),
      );
    });
  });

  it("starts download immediately when one slot is still free", async () => {
    await jest.isolateModulesAsync(async () => {
      const started = [];
      const activeDeferred = deferred();
      window.electron = {
        invoke: jest.fn((channel, url) => {
          if (channel === "download-video") {
            started.push(url);
            if (url === "https://example.com/active") {
              return activeDeferred.promise;
            }
            return Promise.resolve({
              fileName: "file.mp4",
              filePath: "/tmp/file.mp4",
              quality: "Source",
              actualQuality: "Source",
              sourceUrl: url,
              cancelled: false,
            });
          }
          if (channel === "get-icon-path") return Promise.resolve("");
          if (channel === "cache-history-preview")
            return Promise.resolve({ success: false });
          return Promise.resolve({});
        }),
        ipcRenderer: {
          invoke: jest.fn(async (_channel, url) => ({
            success: true,
            title: `Title ${url}`,
          })),
        },
        on: jest.fn(),
      };
      jest.doMock("../domElements", () => ({
        urlInput: document.getElementById("url"),
        downloadButton: document.getElementById("download-button"),
        enqueueButton: document.getElementById("enqueue-button"),
        downloadCancelButton: document.getElementById("download-cancel"),
        buttonText: document.querySelector(".button-text"),
        progressBarContainer: document.getElementById("progress-bar-container"),
        progressBar: document.getElementById("progress-bar"),
        openLastVideoButton: document.getElementById("open-last-video"),
        queueStartButton: document.getElementById("queue-start-button"),
        queueClearButton: document.getElementById("queue-clear-button"),
        historyContainer: null,
      }));
      jest.doMock("../history", () => ({
        addNewEntryToHistory: jest.fn(async () => {}),
        updateDownloadCount: jest.fn(async () => {}),
        getHistoryData: jest.fn(() => []),
      }));
      jest.doMock("../downloadQualityModal", () => ({
        openDownloadQualityModal: jest.fn().mockResolvedValue("Source"),
      }));
      jest.doMock("../toast", () => ({ showToast: jest.fn() }));
      jest.doMock("../iconUpdater", () => ({ updateIcon: jest.fn() }));

      const { state } = require("../state");
      const {
        initiateDownload,
        handleDownloadButtonClick,
      } = require("../downloadManager");
      const urlInput = document.getElementById("url");

      state.maxParallelDownloads = 2;
      let inputEvents = 0;
      let submittedEvents = 0;
      urlInput.addEventListener("input", () => {
        inputEvents += 1;
      });
      window.addEventListener("download:url-submitted", () => {
        submittedEvents += 1;
      });
      const activePromise = initiateDownload(
        "https://example.com/active",
        "Source",
      );
      await Promise.resolve();
      expect(state.activeDownloads.length).toBe(1);

      urlInput.value = "https://example.com/new";
      await handleDownloadButtonClick();

      expect(started).toContain("https://example.com/new");
      expect(state.downloadQueue).toHaveLength(0);
      expect(urlInput.value).toBe("");
      expect(inputEvents).toBeGreaterThan(0);
      expect(submittedEvents).toBe(1);
      expect(document.activeElement).toBe(urlInput);

      activeDeferred.resolve({
        fileName: "active.mp4",
        filePath: "/tmp/active.mp4",
        quality: "Source",
        actualQuality: "Source",
        sourceUrl: "https://example.com/active",
        cancelled: false,
      });
      await activePromise;
    });
  });

  it("starts next pending task when one active download completes", async () => {
    await jest.isolateModulesAsync(async () => {
      const first = deferred();
      const second = deferred();
      const third = deferred();
      const map = new Map([
        ["https://example.com/a", first],
        ["https://example.com/b", second],
        ["https://example.com/c", third],
      ]);
      window.electron = {
        invoke: jest.fn((channel, url) => {
          if (channel === "download-video") {
            return map.get(url).promise.then((filePath) => ({
              fileName: "file.mp4",
              filePath,
              quality: "Source",
              actualQuality: "Source",
              sourceUrl: url,
              cancelled: false,
            }));
          }
          if (channel === "get-icon-path") return Promise.resolve("");
          if (channel === "cache-history-preview")
            return Promise.resolve({ success: false });
          return Promise.resolve({});
        }),
        ipcRenderer: {
          invoke: jest.fn(async (_channel, url) => ({
            success: true,
            title: `Title ${url}`,
          })),
        },
        on: jest.fn(),
      };
      jest.doMock("../domElements", () => ({
        urlInput: document.getElementById("url"),
        downloadButton: document.getElementById("download-button"),
        enqueueButton: document.getElementById("enqueue-button"),
        downloadCancelButton: document.getElementById("download-cancel"),
        buttonText: document.querySelector(".button-text"),
        progressBarContainer: document.getElementById("progress-bar-container"),
        progressBar: document.getElementById("progress-bar"),
        openLastVideoButton: document.getElementById("open-last-video"),
        queueStartButton: document.getElementById("queue-start-button"),
        queueClearButton: document.getElementById("queue-clear-button"),
        historyContainer: null,
      }));
      jest.doMock("../history", () => ({
        addNewEntryToHistory: jest.fn(async () => {}),
        updateDownloadCount: jest.fn(async () => {}),
        getHistoryData: jest.fn(() => []),
      }));
      jest.doMock("../toast", () => ({ showToast: jest.fn() }));
      jest.doMock("../iconUpdater", () => ({ updateIcon: jest.fn() }));

      const { state } = require("../state");
      const { initiateDownload } = require("../downloadManager");
      state.maxParallelDownloads = 2;
      state.downloadQueue = [
        { url: "https://example.com/c", quality: "Source" },
      ];

      const p1 = initiateDownload("https://example.com/a", "Source");
      const p2 = initiateDownload("https://example.com/b", "Source");
      const initialDownloadCalls = window.electron.invoke.mock.calls.filter(
        ([channel]) => channel === "download-video",
      );
      expect(initialDownloadCalls).toHaveLength(2);

      first.resolve("/tmp/a.mp4");
      await p1;
      await Promise.resolve();

      const downloadCalls = window.electron.invoke.mock.calls.filter(
        ([channel]) => channel === "download-video",
      );
      expect(downloadCalls).toHaveLength(3);
      expect(window.electron.invoke).toHaveBeenCalledWith(
        "download-video",
        "https://example.com/c",
        "Source",
        expect.stringMatching(/^job-/),
      );
      expect(state.downloadQueue).toHaveLength(0);

      second.resolve("/tmp/b.mp4");
      third.resolve("/tmp/c.mp4");
      await p2;
      await Promise.resolve();
    });
  });
});
