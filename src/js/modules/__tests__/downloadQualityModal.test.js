const buildDom = () => {
  document.body.innerHTML = `
    <div id="download-quality-modal" class="modal-overlay download-quality-modal" aria-hidden="true">
      <button type="button" data-quality-close>&times;</button>
      <div id="download-quality-loading" class="hidden"></div>
      <small id="download-quality-loading-detail"></small>
      <div id="download-quality-empty" class="hidden"></div>
      <div id="download-quality-error" class="hidden">
        <div class="quality-error-text"></div>
      </div>
      <button id="download-quality-retry" type="button"></button>
      <button id="download-quality-confirm" type="button"></button>
      <button id="download-quality-cancel" type="button"></button>
      <div id="download-quality-options"></div>
      <button class="quality-tab" data-quality-tab="video"></button>
      <button class="quality-tab" data-quality-tab="video-only"></button>
      <button class="quality-tab" data-quality-tab="audio"></button>
      <span id="download-quality-count-video"></span>
      <span id="download-quality-count-video-only"></span>
      <span id="download-quality-count-audio"></span>
      <button id="download-quality-best-current" type="button"></button>
      <img id="download-quality-thumb" />
      <div id="download-quality-thumb-fallback" class="hidden"></div>
      <h4 id="download-quality-name"></h4>
      <p id="download-quality-uploader"></p>
      <p id="download-quality-duration"></p>
      <p id="download-quality-preview-resolution"></p>
      <button id="download-quality-open-source" type="button"></button>
      <button id="download-quality-download-preview" type="button"></button>
      <button id="download-quality-copy-source" type="button"></button>
      <div id="download-quality-selection-summary">
        <small id="download-quality-selection-output"></small>
      </div>
      <strong id="download-quality-selection-title"></strong>
      <small id="download-quality-selection-meta"></small>
    </div>
  `;
};

describe("downloadQualityModal close behavior", () => {
  beforeEach(() => {
    jest.resetModules();
    buildDom();
    global.window = global.window || {};
    window.electron = {
      ipcRenderer: {
        invoke: jest.fn().mockResolvedValue({
          success: true,
          title: "Video title",
          uploader: "Uploader",
          duration: 120,
          thumbnail: "https://cdn.example.com/preview.jpg",
          thumbnail_width: 1280,
          thumbnail_height: 720,
          formats: [
            {
              format_id: "18",
              vcodec: "avc1",
              acodec: "mp4a",
              height: 360,
              ext: "mp4",
            },
          ],
        }),
      },
      invoke: jest.fn().mockResolvedValue({}),
    };
  });

  afterEach(() => {
    delete global.fetch;
    delete window.navigator.clipboard;
  });

  it("closes modal when close button is clicked", async () => {
    await jest.isolateModulesAsync(async () => {
      jest.doMock("../toast", () => ({ showToast: jest.fn() }));
      const { openDownloadQualityModal } = require("../downloadQualityModal");
      const modal = document.getElementById("download-quality-modal");
      const close = modal.querySelector("[data-quality-close]");

      const resultPromise = openDownloadQualityModal("https://example.com/video");
      await Promise.resolve();
      await Promise.resolve();

      expect(modal.classList.contains("is-open")).toBe(true);

      close.dispatchEvent(new MouseEvent("click", { bubbles: true }));
      const result = await resultPromise;

      expect(result).toBeNull();
      expect(modal.classList.contains("is-open")).toBe(false);
      expect(modal.getAttribute("aria-hidden")).toBe("true");
    });
  });

  it("downloads preview image from quality modal", async () => {
    await jest.isolateModulesAsync(async () => {
      const showToast = jest.fn();
      const anchorClick = jest.spyOn(HTMLAnchorElement.prototype, "click");
      const originalCreateObjectURL = URL.createObjectURL;
      const originalRevokeObjectURL = URL.revokeObjectURL;
      global.fetch = jest.fn().mockResolvedValue({
        ok: true,
        blob: async () => new Blob(["test"], { type: "image/jpeg" }),
      });
      URL.createObjectURL = jest.fn(() => "blob:test-url");
      URL.revokeObjectURL = jest.fn();

      jest.doMock("../toast", () => ({ showToast }));
      const { openDownloadQualityModal } = require("../downloadQualityModal");

      const resultPromise = openDownloadQualityModal("https://example.com/video");
      await Promise.resolve();

      const previewBtn = document.getElementById(
        "download-quality-download-preview",
      );
      const resolution = document.getElementById("download-quality-preview-resolution");
      for (let i = 0; i < 5 && typeof previewBtn.onclick !== "function"; i++) {
        await new Promise((resolve) => setTimeout(resolve, 0));
      }
      expect(typeof previewBtn.onclick).toBe("function");

      previewBtn.onclick();
      await Promise.resolve();
      await new Promise((resolve) => setTimeout(resolve, 0));

      expect(fetch).toHaveBeenCalledWith("https://cdn.example.com/preview.jpg", {
        cache: "no-cache",
      });
      expect(resolution.textContent).toContain("1280x720");
      expect(showToast).toHaveBeenCalledWith(expect.any(String), "success");

      const cancelBtn = document.getElementById("download-quality-cancel");
      cancelBtn.click();
      await resultPromise;

      anchorClick.mockRestore();
      URL.createObjectURL = originalCreateObjectURL;
      URL.revokeObjectURL = originalRevokeObjectURL;
    });
  });

  it("copies source url from quality modal", async () => {
    await jest.isolateModulesAsync(async () => {
      const showToast = jest.fn();
      const writeText = jest.fn().mockResolvedValue(undefined);
      Object.defineProperty(window.navigator, "clipboard", {
        configurable: true,
        value: { writeText },
      });

      jest.doMock("../toast", () => ({ showToast }));
      const { openDownloadQualityModal } = require("../downloadQualityModal");

      const resultPromise = openDownloadQualityModal("https://example.com/video");
      await Promise.resolve();
      await Promise.resolve();

      const copyBtn = document.getElementById("download-quality-copy-source");
      expect(copyBtn.disabled).toBe(false);

      await copyBtn.onclick();
      expect(writeText).toHaveBeenCalledWith("https://example.com/video");
      expect(showToast).toHaveBeenCalledWith(expect.any(String), "success");

      document.getElementById("download-quality-cancel").click();
      await resultPromise;
    });
  });

  it("shows fallback when preview thumbnail is missing", async () => {
    await jest.isolateModulesAsync(async () => {
      window.electron.ipcRenderer.invoke = jest.fn().mockResolvedValue({
        success: true,
        title: "Video title",
        uploader: "Uploader",
        duration: 120,
        thumbnail: "",
        formats: [
          {
            format_id: "18",
            vcodec: "avc1",
            acodec: "mp4a",
            height: 360,
            ext: "mp4",
          },
        ],
      });
      jest.doMock("../toast", () => ({ showToast: jest.fn() }));
      const { openDownloadQualityModal } = require("../downloadQualityModal");

      const resultPromise = openDownloadQualityModal("https://example.com/video");
      await Promise.resolve();
      await Promise.resolve();

      const thumb = document.getElementById("download-quality-thumb");
      const thumbFallback = document.getElementById("download-quality-thumb-fallback");
      const previewBtn = document.getElementById("download-quality-download-preview");
      const resolution = document.getElementById("download-quality-preview-resolution");

      expect(thumb.style.display).toBe("none");
      expect(thumbFallback.classList.contains("hidden")).toBe(false);
      expect(previewBtn.disabled).toBe(true);
      expect(resolution.textContent).toContain("—");

      document.getElementById("download-quality-cancel").click();
      await resultPromise;
    });
  });

  it("renders quality metrics collapsed by default", async () => {
    await jest.isolateModulesAsync(async () => {
      jest.doMock("../toast", () => ({ showToast: jest.fn() }));
      const { openDownloadQualityModal } = require("../downloadQualityModal");

      const resultPromise = openDownloadQualityModal("https://example.com/video");
      await Promise.resolve();
      await Promise.resolve();

      const metrics = document.querySelectorAll(".quality-option-metrics");
      expect(metrics.length).toBeGreaterThan(0);
      metrics.forEach((el) => {
        expect(el.classList.contains("is-collapsed")).toBe(true);
      });

      document.getElementById("download-quality-cancel").click();
      await resultPromise;
    });
  });

  it("expands metrics only for selected card toggle", async () => {
    await jest.isolateModulesAsync(async () => {
      window.electron.ipcRenderer.invoke = jest.fn().mockResolvedValue({
        success: true,
        title: "Video title",
        uploader: "Uploader",
        duration: 120,
        thumbnail: "https://cdn.example.com/preview.jpg",
        formats: [
          {
            format_id: "37",
            vcodec: "avc1",
            acodec: "mp4a",
            height: 1080,
            fps: 30,
            ext: "mp4",
          },
          {
            format_id: "22",
            vcodec: "avc1",
            acodec: "mp4a",
            height: 720,
            fps: 30,
            ext: "mp4",
          },
        ],
      });
      jest.doMock("../toast", () => ({ showToast: jest.fn() }));
      const { openDownloadQualityModal } = require("../downloadQualityModal");

      const resultPromise = openDownloadQualityModal("https://example.com/video");
      await Promise.resolve();
      await Promise.resolve();

      const options = document.querySelectorAll(".quality-option");
      expect(options.length).toBeGreaterThan(1);
      const secondToggle = options[1].querySelector(".quality-option-toggle");

      secondToggle.click();
      const refreshedOptions = document.querySelectorAll(".quality-option");
      const firstMetrics = refreshedOptions[0].querySelector(".quality-option-metrics");
      const secondMetrics = refreshedOptions[1].querySelector(".quality-option-metrics");
      const refreshedSecondToggle = refreshedOptions[1].querySelector(
        ".quality-option-toggle",
      );

      expect(firstMetrics.classList.contains("is-collapsed")).toBe(true);
      expect(secondMetrics.classList.contains("is-collapsed")).toBe(false);
      expect(refreshedSecondToggle.textContent.toLowerCase()).toContain("свер");

      document.getElementById("download-quality-cancel").click();
      await resultPromise;
    });
  });

  it("collapses metrics again when toggle is clicked second time", async () => {
    await jest.isolateModulesAsync(async () => {
      jest.doMock("../toast", () => ({ showToast: jest.fn() }));
      const { openDownloadQualityModal } = require("../downloadQualityModal");

      const resultPromise = openDownloadQualityModal("https://example.com/video");
      await Promise.resolve();
      await Promise.resolve();

      const option = document.querySelector(".quality-option");
      const toggle = option.querySelector(".quality-option-toggle");
      let metrics = option.querySelector(".quality-option-metrics");

      toggle.click();
      metrics = document.querySelector(".quality-option .quality-option-metrics");
      expect(metrics.classList.contains("is-collapsed")).toBe(false);

      const toggleAfterExpand = document.querySelector(
        ".quality-option .quality-option-toggle",
      );
      toggleAfterExpand.click();
      metrics = document.querySelector(".quality-option .quality-option-metrics");
      expect(metrics.classList.contains("is-collapsed")).toBe(true);

      document.getElementById("download-quality-cancel").click();
      await resultPromise;
    });
  });

  it("does not change selected option or trigger confirm on metrics toggle", async () => {
    await jest.isolateModulesAsync(async () => {
      window.electron.ipcRenderer.invoke = jest.fn().mockResolvedValue({
        success: true,
        title: "Video title",
        uploader: "Uploader",
        duration: 120,
        thumbnail: "https://cdn.example.com/preview.jpg",
        formats: [
          {
            format_id: "37",
            vcodec: "avc1",
            acodec: "mp4a",
            height: 1080,
            fps: 30,
            ext: "mp4",
          },
          {
            format_id: "22",
            vcodec: "avc1",
            acodec: "mp4a",
            height: 720,
            fps: 30,
            ext: "mp4",
          },
        ],
      });
      jest.doMock("../toast", () => ({ showToast: jest.fn() }));
      const { openDownloadQualityModal } = require("../downloadQualityModal");

      const modal = document.getElementById("download-quality-modal");
      const resultPromise = openDownloadQualityModal("https://example.com/video");
      await Promise.resolve();
      await Promise.resolve();

      const optionsBefore = Array.from(document.querySelectorAll(".quality-option"));
      const initiallySelectedId = optionsBefore.find(
        (el) => el.getAttribute("aria-checked") === "true",
      )?.dataset.optionId;
      const secondToggle = optionsBefore[1].querySelector(".quality-option-toggle");
      secondToggle.click();

      const optionsAfter = Array.from(document.querySelectorAll(".quality-option"));
      const selectedAfterToggle = optionsAfter.find(
        (el) => el.getAttribute("aria-checked") === "true",
      )?.dataset.optionId;

      expect(selectedAfterToggle).toBe(initiallySelectedId);
      expect(modal.classList.contains("is-open")).toBe(true);

      document.getElementById("download-quality-cancel").click();
      const result = await resultPromise;
      expect(result).toBeNull();
    });
  });

  it("resolves preview resolution from thumbnails metadata", async () => {
    await jest.isolateModulesAsync(async () => {
      window.electron.ipcRenderer.invoke = jest.fn().mockResolvedValue({
        success: true,
        title: "Video title",
        uploader: "Uploader",
        duration: 120,
        thumbnail: "https://cdn.example.com/preview-alt.jpg",
        thumbnails: [
          { url: "https://cdn.example.com/preview-alt.jpg", width: 1920, height: 1080 },
        ],
        formats: [
          {
            format_id: "18",
            vcodec: "avc1",
            acodec: "mp4a",
            height: 360,
            ext: "mp4",
          },
        ],
      });
      jest.doMock("../toast", () => ({ showToast: jest.fn() }));
      const { openDownloadQualityModal } = require("../downloadQualityModal");

      const resultPromise = openDownloadQualityModal("https://example.com/video");
      await Promise.resolve();
      await Promise.resolve();

      const resolution = document.getElementById("download-quality-preview-resolution");
      const previewBtn = document.getElementById("download-quality-download-preview");
      expect(resolution.textContent).toContain("1920x1080");
      expect(previewBtn.disabled).toBe(false);

      document.getElementById("download-quality-cancel").click();
      await resultPromise;
    });
  });

  it("enqueues selected option on A hotkey", async () => {
    await jest.isolateModulesAsync(async () => {
      jest.doMock("../toast", () => ({ showToast: jest.fn() }));
      const { openDownloadQualityModal } = require("../downloadQualityModal");

      const resultPromise = openDownloadQualityModal("https://example.com/video");
      await Promise.resolve();
      await Promise.resolve();

      document.dispatchEvent(
        new KeyboardEvent("keydown", { key: "a", bubbles: true }),
      );
      const result = await resultPromise;

      expect(result).toBeTruthy();
      expect(result?.enqueue).toBe(true);
      expect(result?.payload).toBeTruthy();
    });
  });

  it("hides selection/actions and disables enqueue while formats are loading", async () => {
    await jest.isolateModulesAsync(async () => {
      let resolveInfo;
      window.electron.ipcRenderer.invoke = jest.fn(
        () =>
          new Promise((resolve) => {
            resolveInfo = resolve;
          }),
      );

      jest.doMock("../toast", () => ({ showToast: jest.fn() }));
      const { openDownloadQualityModal } = require("../downloadQualityModal");

      const modalPromise = openDownloadQualityModal("https://example.com/video");
      await Promise.resolve();

      const selectionSummary = document.getElementById(
        "download-quality-selection-summary",
      );
      const openSourceBtn = document.getElementById("download-quality-open-source");
      const previewBtn = document.getElementById(
        "download-quality-download-preview",
      );
      const copyBtn = document.getElementById("download-quality-copy-source");

      expect(selectionSummary.classList.contains("hidden")).toBe(true);
      expect(openSourceBtn.classList.contains("hidden")).toBe(true);
      expect(previewBtn.classList.contains("hidden")).toBe(true);
      expect(copyBtn.classList.contains("hidden")).toBe(true);

      resolveInfo({
        success: true,
        title: "Video title",
        uploader: "Uploader",
        duration: 120,
        thumbnail: "https://cdn.example.com/preview.jpg",
        formats: [
          {
            format_id: "18",
            vcodec: "avc1",
            acodec: "mp4a",
            height: 360,
            ext: "mp4",
          },
        ],
      });

      await Promise.resolve();
      await Promise.resolve();

      expect(selectionSummary.classList.contains("hidden")).toBe(false);
      expect(openSourceBtn.classList.contains("hidden")).toBe(false);
      expect(previewBtn.classList.contains("hidden")).toBe(false);
      expect(copyBtn.classList.contains("hidden")).toBe(false);

      const cancelBtn = document.getElementById("download-quality-cancel");
      cancelBtn.click();
      await modalPromise;
    });
  });
});
