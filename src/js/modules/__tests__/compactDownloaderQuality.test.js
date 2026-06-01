/** @jest-environment jsdom */

const buildDom = () => {
  document.body.innerHTML = `
    <div class="input-container">
      <div class="url-entry-shell">
        <button id="downloader-view-detailed" type="button"></button>
        <button id="downloader-view-compact" type="button"></button>
      </div>
      <nav class="button-group downloader-action-row url-input-action-row">
        <section id="compact-quality-panel" hidden>
          <div class="compact-quality-panel__grid">
            <div class="compact-quality-field">
              <label for="compact-video-quality">Видео</label>
              <select id="compact-video-quality"></select>
            </div>
            <div class="compact-quality-field">
              <label for="compact-audio-quality">Аудио</label>
              <select id="compact-audio-quality"></select>
            </div>
          </div>
          <p id="compact-quality-status" class="hidden"></p>
        </section>
        <button id="open-last-video" type="button"></button>
        <div class="download-quality-group downloader-action-row__primary">
          <button id="download-button" type="button"></button>
          <button id="download-cancel" type="button"></button>
        </div>
        <button id="open-folder" type="button"></button>
      </nav>
    </div>
  `;
};

describe("compactDownloaderQuality", () => {
  beforeEach(() => {
    jest.resetModules();
    localStorage.clear();
    delete window.__videoInfoCache;
    delete window.__videoInfoBrokerState;
    buildDom();
    window.electron = {
      ipcRenderer: { invoke: jest.fn() },
    };
  });

  it("persists compact view mode and applies shell classes", async () => {
    await jest.isolateModulesAsync(async () => {
      const { initCompactDownloaderQuality, isCompactDownloaderMode } = require(
        "../compactDownloaderQuality",
      );
      initCompactDownloaderQuality();

      document.getElementById("downloader-view-compact").click();

      expect(isCompactDownloaderMode()).toBe(true);
      expect(localStorage.getItem("downloaderViewMode")).toBe("compact");
      expect(
        document
          .querySelector(".input-container")
          .classList.contains("is-downloader-compact"),
      ).toBe(true);
      expect(document.getElementById("compact-quality-panel").hidden).toBe(
        false,
      );
      expect(
        document.querySelector(".url-input-action-row #compact-quality-panel"),
      ).not.toBeNull();
      expect(document.getElementById("open-last-video")).not.toBeNull();
      expect(document.getElementById("download-cancel")).not.toBeNull();
      expect(document.getElementById("open-folder")).not.toBeNull();
      expect(
        Array.from(document.querySelectorAll(".compact-quality-field")).every(
          (field) => field.hidden,
        ),
      ).toBe(true);
    });
  });

  it("builds video and audio selectors from preview formats", async () => {
    await jest.isolateModulesAsync(async () => {
      const {
        PREVIEW_EVENT,
        getCompactQualityPayload,
        initCompactDownloaderQuality,
      } = require("../compactDownloaderQuality");
      initCompactDownloaderQuality();

      window.dispatchEvent(
        new CustomEvent(PREVIEW_EVENT, {
          detail: {
            url: "https://example.com/video",
            info: {
              success: true,
              title: "Video",
              formats: [
                {
                  format_id: "137",
                  vcodec: "avc1",
                  acodec: "none",
                  height: 1080,
                  ext: "mp4",
                },
                {
                  format_id: "140",
                  vcodec: "none",
                  acodec: "mp4a.40.2",
                  abr: 128,
                  ext: "m4a",
                },
              ],
            },
          },
        }),
      );

      expect(document.getElementById("compact-video-quality").options.length).toBe(
        2,
      );
      expect(document.getElementById("compact-audio-quality").textContent).toContain(
        "MP3",
      );
      expect(
        Array.from(document.querySelectorAll(".compact-quality-field")).every(
          (field) => !field.hidden,
        ),
      ).toBe(true);
      expect(document.querySelectorAll(".compact-quality-menu").length).toBe(2);
      expect(
        document.querySelector(".compact-quality-menu__value").textContent,
      ).toContain("1080p");
      expect(getCompactQualityPayload()).toMatchObject({
        type: "pair",
        videoFormatId: "137",
        audioFormatId: "140",
      });
    });
  });

  it("hides quality selectors again when preview formats are missing", async () => {
    await jest.isolateModulesAsync(async () => {
      const { PREVIEW_EVENT, initCompactDownloaderQuality } = require(
        "../compactDownloaderQuality",
      );
      initCompactDownloaderQuality();

      window.dispatchEvent(
        new CustomEvent(PREVIEW_EVENT, {
          detail: {
            url: "https://example.com/video",
            info: {
              success: true,
              title: "Video",
              formats: [
                {
                  format_id: "18",
                  vcodec: "avc1",
                  acodec: "mp4a.40.2",
                  height: 720,
                  ext: "mp4",
                },
              ],
            },
          },
        }),
      );
      window.dispatchEvent(
        new CustomEvent(PREVIEW_EVENT, {
          detail: {
            url: "https://example.com/video",
            info: { success: false, formats: [] },
          },
        }),
      );

      expect(
        Array.from(document.querySelectorAll(".compact-quality-field")).every(
          (field) => field.hidden,
        ),
      ).toBe(true);
      expect(document.getElementById("compact-video-quality").options.length).toBe(
        0,
      );
      expect(document.getElementById("compact-audio-quality").options.length).toBe(
        0,
      );
    });
  });
});
