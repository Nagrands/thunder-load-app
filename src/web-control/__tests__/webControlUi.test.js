const fs = require("fs");
const path = require("path");
const vm = require("vm");

const {
  createCompactQuality,
  parseSingleUrl,
} = require("../web-compact-quality.js");
const { createWebRouter } = require("../web-control-router.js");

function setupQualityDom() {
  document.body.innerHTML = `
    <textarea id="url"></textarea>
    <select id="video"></select>
    <select id="audio"></select>
    <span id="status"></span>
    <button id="download"></button>
    <button id="queue"></button>
  `;
  return {
    input: document.getElementById("url"),
    videoSelect: document.getElementById("video"),
    audioSelect: document.getElementById("audio"),
    status: document.getElementById("status"),
    actions: [
      document.getElementById("download"),
      document.getElementById("queue"),
    ],
  };
}

describe("web control UI contract", () => {
  it("loads browser helpers and the entry-point aliases without global collisions", () => {
    const context = vm.createContext({ window: {} });
    const scripts = [
      "web-control-router.js",
      "web-compact-quality.js",
      "web-settings.js",
    ];

    scripts.forEach((file) => {
      const source = fs.readFileSync(path.resolve(__dirname, "..", file), "utf8");
      vm.runInContext(source, context, { filename: file });
    });

    expect(() =>
      vm.runInContext(
        `const createCompactQualityController = window.WebCompactQuality.createCompactQuality;
         const createRouterController = window.WebControlRouter.createWebRouter;
         const bindBeforeUnload = window.WebSettings.bindSettingsBeforeUnload;
         const createSettingsController = window.WebSettings.createWebSettingsController;`,
        context,
        { filename: "web-control-entry-aliases.js" },
      ),
    ).not.toThrow();
  });

  it("contains only the main toolbar entry point", () => {
    const html = fs.readFileSync(
      path.resolve(__dirname, "../index.html"),
      "utf8",
    );
    expect(html).not.toContain('class="top-bar"');
    expect(html).not.toContain('class="app-footer"');
    expect(html).not.toContain("downloader-view-mode");
    expect(html).toContain('class="toolbar-settings-button"');
    expect(html).toContain('id="compact-video-quality"');
    expect(html).toContain('id="compact-audio-quality"');
  });

  it("accepts one HTTP URL and rejects multi-value input", () => {
    expect(parseSingleUrl("https://example.com/watch?v=1").error).toBe("");
    expect(parseSingleUrl("https://one.test https://two.test").error).toBe(
      "multiple",
    );
    expect(parseSingleUrl("file:///tmp/video.mp4").error).toBe("invalid");
  });

  it("analyzes formats and creates a paired quality payload", async () => {
    const dom = setupQualityDom();
    const request = jest.fn().mockResolvedValue({
      preview: {
        videoOptions: [
          {
            id: "video-137",
            kind: "video",
            source: "video-only",
            title: "1080p",
            payload: {
              type: "video-only",
              videoFormatId: "137",
              videoExt: "mp4",
            },
          },
        ],
        audioOptions: [
          {
            id: "audio-140",
            kind: "audio",
            source: "audio-only",
            title: "m4a",
            payload: {
              type: "audio-only",
              audioFormatId: "140",
              audioExt: "m4a",
            },
          },
        ],
      },
    });
    const quality = createCompactQuality({ ...dom, request });
    dom.input.value = "https://example.com/watch?v=1";

    await quality.analyze();

    expect(request).toHaveBeenCalledWith("/api/preview", expect.any(Object));
    expect(dom.actions.every((button) => !button.disabled)).toBe(true);
    expect(quality.getPayload()).toMatchObject({
      url: "https://example.com/watch?v=1",
      quality: { type: "pair", videoFormatId: "137", audioFormatId: "140" },
    });
  });

  it("synchronizes the settings modal with browser history", () => {
    document.body.innerHTML = '<div id="modal" aria-hidden="true"></div>';
    window.history.replaceState({}, "", "/");
    const modal = document.getElementById("modal");
    const router = createWebRouter({ modal });

    router.openSettings();
    expect(window.location.pathname).toBe("/settings");
    expect(modal.classList.contains("is-open")).toBe(true);

    window.history.replaceState({}, "", "/downloader");
    window.dispatchEvent(new PopStateEvent("popstate"));
    expect(modal.classList.contains("is-open")).toBe(false);
  });

  it("keeps settings open when discarding a dirty draft is rejected", () => {
    document.body.innerHTML = '<div id="modal" aria-hidden="true"></div>';
    window.history.replaceState({}, "", "/settings");
    const modal = document.getElementById("modal");
    const confirmDiscard = jest.fn(() => false);
    createWebRouter({
      modal,
      hasUnsavedChanges: () => true,
      confirmDiscard,
    });

    window.history.replaceState({}, "", "/");
    window.dispatchEvent(new PopStateEvent("popstate"));

    expect(confirmDiscard).toHaveBeenCalledTimes(1);
    expect(window.location.pathname).toBe("/settings");
    expect(modal.classList.contains("is-open")).toBe(true);
  });
});
