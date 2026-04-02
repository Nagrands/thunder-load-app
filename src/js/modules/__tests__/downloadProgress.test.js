describe("downloadProgress", () => {
  const mockT = jest.fn((key, vars = {}) => {
    if (key === "download.eta") return `ETA ${vars.time}`;
    if (key === "queue.stage.download") return "Downloading data";
    if (key === "download.progress.stage")
      return `${vars.stage} ${vars.progress}${vars.eta || ""}`;
    if (key === "download.progress")
      return `Downloading ${vars.progress}${vars.eta || ""}`;
    if (key === "download.progress.multi")
      return `Downloading ${vars.progress}% (${vars.count} active)`;
    if (key === "tabs.download") return "Downloader";
    if (key === "tabs.download.countOnly")
      return `${vars.base} (${vars.count})`;
    if (key === "tabs.download.progressOnly")
      return `${vars.base} - ${vars.progress}%`;
    if (key === "tabs.download.progressWithCount")
      return `${vars.base} - ${vars.progress}% (${vars.count})`;
    return key;
  });

  const buildDom = () => {
    document.body.innerHTML = `
      <div id="download-button"><span class="button-text"></span></div>
      <div id="progress-bar-container" class="is-active" aria-valuenow="0"></div>
      <div id="progress-bar"></div>
      <div class="group-menu">
        <button class="menu-item" data-menu="download">
          <span class="menu-progress" aria-hidden="true"></span>
          <span class="menu-main">
            <span class="menu-text">Downloader</span>
            <span class="menu-badge" aria-hidden="true"></span>
          </span>
        </button>
      </div>
    `;
  };

  beforeEach(() => {
    jest.resetModules();
    mockT.mockClear();
    buildDom();
    jest.useFakeTimers();
    global.window = global.window || {};
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  it("supports legacy numeric progress payload", () => {
    let progressHandler = null;
    window.electron = {
      onProgress: jest.fn((cb) => {
        progressHandler = cb;
      }),
    };

    jest.isolateModules(() => {
      jest.doMock("../state", () => ({
        state: { isDownloading: true, activeDownloads: [] },
      }));
      jest.doMock("../domElements", () => ({
        buttonText: document.querySelector(".button-text"),
        progressBar: document.getElementById("progress-bar"),
        progressBarContainer: document.getElementById("progress-bar-container"),
      }));
      jest.doMock("../i18n", () => ({
        t: mockT,
      }));

      const { initDownloadProgress } = require("../downloadProgress");
      initDownloadProgress();
    });

    progressHandler(12);
    const container = document.getElementById("progress-bar-container");
    const tab = document.querySelector('[data-menu="download"]');
    expect(container.style.getPropertyValue("--progress-ratio")).toBe("0.12");
    expect(container.getAttribute("aria-valuenow")).toBe("12.0");
    expect(tab.style.getPropertyValue("--download-tab-progress")).toBe("0.12");
    expect(tab.classList.contains("is-progress-active")).toBe(true);
    expect(tab.getAttribute("aria-label")).toBe("Downloader - 12.0%");
  });

  it("aggregates object payload progress for two active jobs", () => {
    let progressHandler = null;
    window.electron = {
      onProgress: jest.fn((cb) => {
        progressHandler = cb;
      }),
    };

    jest.isolateModules(() => {
      jest.doMock("../state", () => ({
        state: {
          isDownloading: false,
          activeDownloads: [],
        },
      }));
      jest.doMock("../domElements", () => ({
        buttonText: document.querySelector(".button-text"),
        progressBar: document.getElementById("progress-bar"),
        progressBarContainer: document.getElementById("progress-bar-container"),
      }));
      jest.doMock("../i18n", () => ({
        t: mockT,
      }));

      const { initDownloadProgress } = require("../downloadProgress");
      initDownloadProgress();
    });

    window.dispatchEvent(
      new CustomEvent("download:state", {
        detail: { isDownloading: true, activeCount: 2 },
      }),
    );

    progressHandler({ jobId: "a", progress: 40 });
    progressHandler({ jobId: "b", progress: 20 });

    const container = document.getElementById("progress-bar-container");
    const text = document.querySelector(".button-text").textContent;
    const tab = document.querySelector('[data-menu="download"]');
    expect(container.style.getPropertyValue("--progress-ratio")).toBe("0.3");
    expect(container.getAttribute("aria-valuenow")).toBe("30.0");
    expect(text).toContain("(2 active)");
    expect(tab.style.getPropertyValue("--download-tab-progress")).toBe("0.3");
  });

  it("resets tracking when download state transitions to idle", () => {
    let progressHandler = null;
    window.electron = {
      onProgress: jest.fn((cb) => {
        progressHandler = cb;
      }),
    };

    jest.isolateModules(() => {
      jest.doMock("../state", () => ({
        state: {
          isDownloading: false,
          activeDownloads: [],
        },
      }));
      jest.doMock("../domElements", () => ({
        buttonText: document.querySelector(".button-text"),
        progressBar: document.getElementById("progress-bar"),
        progressBarContainer: document.getElementById("progress-bar-container"),
      }));
      jest.doMock("../i18n", () => ({
        t: mockT,
      }));

      const { initDownloadProgress } = require("../downloadProgress");
      initDownloadProgress();
    });

    window.dispatchEvent(
      new CustomEvent("download:state", {
        detail: { isDownloading: true, activeCount: 2 },
      }),
    );
    progressHandler({ jobId: "a", progress: 100 });
    progressHandler({ jobId: "b", progress: 100 });

    window.dispatchEvent(
      new CustomEvent("download:state", {
        detail: { isDownloading: false, activeCount: 0 },
      }),
    );
    jest.advanceTimersByTime(601);

    const tab = document.querySelector('[data-menu="download"]');
    expect(tab.classList.contains("is-progress-active")).toBe(false);
    expect(tab.style.getPropertyValue("--download-tab-progress")).toBe("0");
    expect(tab.getAttribute("aria-label")).toBe("Downloader");

    // New sequence starts from fresh value after idle reset.
    window.dispatchEvent(
      new CustomEvent("download:state", {
        detail: { isDownloading: true, activeCount: 1 },
      }),
    );
    progressHandler({ jobId: "c", progress: 25 });
    const container = document.getElementById("progress-bar-container");
    expect(container.getAttribute("aria-valuenow")).toBe("25.0");
    expect(tab.getAttribute("aria-label")).toBe("Downloader - 25.0%");
  });

  it("shows current stage in button text for a single active job", () => {
    let progressHandler = null;
    window.electron = {
      onProgress: jest.fn((cb) => {
        progressHandler = cb;
      }),
    };

    jest.isolateModules(() => {
      jest.doMock("../state", () => ({
        state: {
          isDownloading: false,
          activeDownloads: [],
        },
      }));
      jest.doMock("../domElements", () => ({
        buttonText: document.querySelector(".button-text"),
        progressBar: document.getElementById("progress-bar"),
        progressBarContainer: document.getElementById("progress-bar-container"),
      }));
      jest.doMock("../i18n", () => ({
        t: mockT,
      }));

      const { initDownloadProgress } = require("../downloadProgress");
      initDownloadProgress();
    });

    window.dispatchEvent(
      new CustomEvent("download:state", {
        detail: { isDownloading: true, activeCount: 1 },
      }),
    );

    progressHandler({ jobId: "a", progress: 40, phase: "download" });

    expect(document.querySelector(".button-text").textContent).toContain(
      "Downloading data",
    );
  });

  it("keeps queue count in downloader tab accessibility while progress is active", () => {
    let progressHandler = null;
    window.electron = {
      onProgress: jest.fn((cb) => {
        progressHandler = cb;
      }),
    };

    const tab = document.querySelector('[data-menu="download"]');
    const badge = tab.querySelector(".menu-badge");
    badge.textContent = "7";
    badge.classList.add("is-visible");
    tab.dataset.downloadCount = "7";

    jest.isolateModules(() => {
      jest.doMock("../state", () => ({
        state: {
          isDownloading: false,
          activeDownloads: [],
        },
      }));
      jest.doMock("../domElements", () => ({
        buttonText: document.querySelector(".button-text"),
        progressBar: document.getElementById("progress-bar"),
        progressBarContainer: document.getElementById("progress-bar-container"),
      }));
      jest.doMock("../i18n", () => ({
        t: mockT,
      }));

      const { initDownloadProgress } = require("../downloadProgress");
      initDownloadProgress();
    });

    window.dispatchEvent(
      new CustomEvent("download:state", {
        detail: { isDownloading: true, activeCount: 1 },
      }),
    );

    progressHandler({ jobId: "a", progress: 42 });

    expect(tab.getAttribute("aria-label")).toBe("Downloader - 42.0% (7)");
  });
});
