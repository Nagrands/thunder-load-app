const buildDom = () => {
  document.body.innerHTML = `
    <div id="download-quality-modal" class="modal-overlay download-quality-modal" aria-hidden="true">
      <button type="button" data-quality-close>&times;</button>
      <div id="download-quality-loading" class="hidden"></div>
      <div id="download-quality-empty" class="hidden"></div>
      <div id="download-quality-error" class="hidden">
        <div class="quality-error-text"></div>
      </div>
      <button id="download-quality-retry" type="button"></button>
      <button id="download-quality-confirm" type="button"></button>
      <button id="download-quality-enqueue" type="button"></button>
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
      <h4 id="download-quality-name"></h4>
      <p id="download-quality-uploader"></p>
      <p id="download-quality-duration"></p>
      <button id="download-quality-open-source" type="button"></button>
      <button id="download-quality-download-preview" type="button"></button>
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
      expect(showToast).toHaveBeenCalledWith(expect.any(String), "success");

      const cancelBtn = document.getElementById("download-quality-cancel");
      cancelBtn.click();
      await resultPromise;

      anchorClick.mockRestore();
      URL.createObjectURL = originalCreateObjectURL;
      URL.revokeObjectURL = originalRevokeObjectURL;
    });
  });
});
