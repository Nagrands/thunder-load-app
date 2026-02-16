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

  it("keeps progress monotonic during active download", () => {
    let progressHandler = null;
    window.electron = {
      onProgress: jest.fn((cb) => {
        progressHandler = cb;
      }),
    };

    jest.isolateModules(() => {
      jest.doMock("../state", () => ({
        state: { isDownloading: true },
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
          return key;
        }),
      }));

      const { initDownloadProgress } = require("../downloadProgress");
      initDownloadProgress();
    });

    progressHandler(150);
    expect(
      document
        .getElementById("progress-bar-container")
        .style.getPropertyValue("--progress-ratio"),
    ).toBe("1");
    expect(
      document
        .getElementById("progress-bar-container")
        .getAttribute("aria-valuenow"),
    ).toBe("100.0");

    progressHandler(90);
    expect(
      document
        .getElementById("progress-bar-container")
        .style.getPropertyValue("--progress-ratio"),
    ).toBe("1");
    expect(
      document
        .getElementById("progress-bar-container")
        .getAttribute("aria-valuenow"),
    ).toBe("100.0");
  });

  it("resets progress tracking after download state stops", () => {
    let progressHandler = null;
    window.electron = {
      onProgress: jest.fn((cb) => {
        progressHandler = cb;
      }),
    };

    jest.isolateModules(() => {
      jest.doMock("../state", () => ({
        state: { isDownloading: true },
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
          return key;
        }),
      }));

      const { initDownloadProgress } = require("../downloadProgress");
      initDownloadProgress();
    });

    progressHandler(100);
    expect(
      document
        .getElementById("progress-bar-container")
        .style.getPropertyValue("--progress-ratio"),
    ).toBe("1");

    window.dispatchEvent(
      new CustomEvent("download:state", { detail: { isDownloading: false } }),
    );
    progressHandler(20);

    expect(
      document
        .getElementById("progress-bar-container")
        .style.getPropertyValue("--progress-ratio"),
    ).toBe("0.2");
    expect(
      document
        .getElementById("progress-bar-container")
        .getAttribute("aria-valuenow"),
    ).toBe("20.0");
  });

  it("recovers from stale 100% event when low real progress arrives", () => {
    let progressHandler = null;
    window.electron = {
      onProgress: jest.fn((cb) => {
        progressHandler = cb;
      }),
    };

    jest.isolateModules(() => {
      jest.doMock("../state", () => ({
        state: { isDownloading: true },
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
          return key;
        }),
      }));

      const { initDownloadProgress } = require("../downloadProgress");
      initDownloadProgress();
    });

    progressHandler(100);
    expect(
      document
        .getElementById("progress-bar-container")
        .style.getPropertyValue("--progress-ratio"),
    ).toBe("1");

    progressHandler(3);
    expect(
      document
        .getElementById("progress-bar-container")
        .style.getPropertyValue("--progress-ratio"),
    ).toBe("0.03");
    expect(
      document
        .getElementById("progress-bar-container")
        .getAttribute("aria-valuenow"),
    ).toBe("3.0");
  });

  it("does not set dataset progress/eta and clears top indicator by timer", () => {
    let progressHandler = null;
    window.electron = {
      onProgress: jest.fn((cb) => {
        progressHandler = cb;
      }),
    };

    jest.isolateModules(() => {
      jest.doMock("../state", () => ({
        state: { isDownloading: true },
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
          return key;
        }),
      }));

      const { initDownloadProgress } = require("../downloadProgress");
      initDownloadProgress();
    });

    progressHandler(100);
    const container = document.getElementById("progress-bar-container");
    const top = document.getElementById("top-download-progress");
    const topFill = document.getElementById("top-download-progress-fill");

    expect(container.dataset.progress).toBeUndefined();
    expect(container.dataset.eta).toBeUndefined();
    expect(top.classList.contains("is-visible")).toBe(true);

    window.dispatchEvent(
      new CustomEvent("download:state", { detail: { isDownloading: false } }),
    );
    jest.advanceTimersByTime(601);

    expect(top.classList.contains("is-visible")).toBe(false);
    expect(topFill.style.width).toBe("0%");
  });
});
