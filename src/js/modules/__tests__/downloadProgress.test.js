describe("downloadProgress", () => {
  const buildDom = () => {
    document.body.innerHTML = `
      <div id="download-button"><span class="button-text"></span></div>
      <div id="progress-bar-container" class="is-active" aria-valuenow="0"></div>
      <div id="progress-bar"></div>
      <div id="top-download-progress" class="top-download-progress">
        <div id="top-download-progress-fill"></div>
      </div>
    `;
  };

  beforeEach(() => {
    jest.resetModules();
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
        t: jest.fn((key, vars = {}) => {
          if (key === "download.eta") return `ETA ${vars.time}`;
          if (key === "download.progress")
            return `Downloading ${vars.progress}${vars.eta || ""}`;
          if (key === "download.progress.multi")
            return `Downloading ${vars.progress}% (${vars.count} active)`;
          return key;
        }),
      }));

      const { initDownloadProgress } = require("../downloadProgress");
      initDownloadProgress();
    });

    progressHandler(12);
    const container = document.getElementById("progress-bar-container");
    expect(container.style.getPropertyValue("--progress-ratio")).toBe("0.12");
    expect(container.getAttribute("aria-valuenow")).toBe("12.0");
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
        t: jest.fn((key, vars = {}) => {
          if (key === "download.eta") return `ETA ${vars.time}`;
          if (key === "download.progress")
            return `Downloading ${vars.progress}${vars.eta || ""}`;
          if (key === "download.progress.multi")
            return `Downloading ${vars.progress}% (${vars.count} active)`;
          return key;
        }),
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
    expect(container.style.getPropertyValue("--progress-ratio")).toBe("0.3");
    expect(container.getAttribute("aria-valuenow")).toBe("30.0");
    expect(text).toContain("(2 active)");
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
        t: jest.fn((key, vars = {}) => {
          if (key === "download.eta") return `ETA ${vars.time}`;
          if (key === "download.progress")
            return `Downloading ${vars.progress}${vars.eta || ""}`;
          if (key === "download.progress.multi")
            return `Downloading ${vars.progress}% (${vars.count} active)`;
          return key;
        }),
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

    const top = document.getElementById("top-download-progress");
    const topFill = document.getElementById("top-download-progress-fill");
    expect(top.classList.contains("is-visible")).toBe(false);
    expect(topFill.style.width).toBe("0%");

    // New sequence starts from fresh value after idle reset.
    window.dispatchEvent(
      new CustomEvent("download:state", {
        detail: { isDownloading: true, activeCount: 1 },
      }),
    );
    progressHandler({ jobId: "c", progress: 25 });
    const container = document.getElementById("progress-bar-container");
    expect(container.getAttribute("aria-valuenow")).toBe("25.0");
  });
});
