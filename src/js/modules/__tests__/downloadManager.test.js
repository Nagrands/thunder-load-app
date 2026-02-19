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
    <span id="queue-active-count" class="hidden"></span>
    <span id="queue-cap-state" class="hidden"></span>
    <div id="queue-start-indicator" class="hidden"></div>
    <button id="queue-retry-failed-button"></button>
    <button id="queue-start-button"></button>
    <button id="queue-clear-button"></button>
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
      const { initDownloadButton, updateQueueDisplay } = require("../downloadManager");

      state.downloadQueue = [
        { url: "https://example.com/a", quality: "Source" },
        { url: "https://example.com/b", quality: "Source" },
      ];
      initDownloadButton();
      updateQueueDisplay();

      const downBtn = document.querySelector(
        '.queue-item-actions [data-queue-move="down"][data-index="0"]',
      );
      const pendingRow = document.querySelector("#queue-list li:not(.is-active):not(.is-failed)");
      expect(pendingRow?.querySelector(".queue-item-chips .queue-quality-chip")).toBeTruthy();
      downBtn.click();
      expect(state.downloadQueue[0].url).toBe("https://example.com/b");

      const upBtn = document.querySelector(
        '.queue-item-actions [data-queue-move="up"][data-index="1"]',
      );
      upBtn.click();
      expect(state.downloadQueue[0].url).toBe("https://example.com/a");
    });
  });

  it("applies full-limit status class when queue reaches max size", () => {
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

      const queueInfo = document.getElementById("download-queue-info");
      const capState = document.getElementById("queue-cap-state");
      expect(queueInfo.classList.contains("is-full")).toBe(true);
      expect(capState.classList.contains("hidden")).toBe(false);
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
          if (key === "queue.item.active") return "Выполняется";
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

      expect(activeCounter?.textContent).toBe("1");
      expect(activeCounter?.classList.contains("hidden")).toBe(false);
      const activeRow = document.querySelector("#queue-list li.is-active");
      expect(activeRow).toBeTruthy();
      expect(activeRow?.querySelector(".queue-item-chips")).toBeTruthy();
      expect(activeRow?.querySelector(".queue-progress-chip")).toBeTruthy();
      expect(activeRow?.querySelector(".queue-quality-chip")).toBeTruthy();
      expect(activeRow?.querySelector(".queue-status-chip")?.textContent).toBe(
        "Выполняется",
      );
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
          if (key === "queue.item.active") return "Выполняется";
          if (key === "queue.item.failed") return "Ошибка";
          if (key === "queue.item.retrying") return "Повторная загрузка запущена.";
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
      const { initDownloadButton, updateQueueDisplay } = require("../downloadManager");
      state.failedDownloads = [
        { url: "https://example.com/failed", quality: "Source" },
      ];

      initDownloadButton();
      updateQueueDisplay();

      const failedRow = document.querySelector("#queue-list li.is-failed");
      expect(failedRow).toBeTruthy();
      expect(failedRow?.querySelector(".queue-item-chips .queue-quality-chip")).toBeTruthy();
      expect(failedRow?.querySelector(".queue-item-actions [data-queue-remove-failed]")).toBeTruthy();
      const retryBtn = failedRow.querySelector("[data-queue-retry-failed]");
      retryBtn.click();
      await Promise.resolve();

      expect(state.failedDownloads).toHaveLength(0);
      expect(window.electron.invoke).toHaveBeenCalledWith(
        "download-video",
        "https://example.com/failed",
        "Source",
        expect.stringMatching(/^job-/),
      );
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
      expect(state.downloadQueue[0]).toEqual({
        url: "https://example.com/c",
        quality: "Source",
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
      const { initiateDownload, handleDownloadButtonClick } = require("../downloadManager");
      const urlInput = document.getElementById("url");

      state.maxParallelDownloads = 2;
      const activePromise = initiateDownload("https://example.com/active", "Source");
      await Promise.resolve();
      expect(state.activeDownloads.length).toBe(1);

      urlInput.value = "https://example.com/new";
      await handleDownloadButtonClick();

      expect(started).toContain("https://example.com/new");
      expect(state.downloadQueue).toHaveLength(0);

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
      state.downloadQueue = [{ url: "https://example.com/c", quality: "Source" }];

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
