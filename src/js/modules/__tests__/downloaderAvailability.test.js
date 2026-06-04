/** @jest-environment jsdom */

const buildDom = () => {
  document.body.innerHTML = `
    <div class="url-entry-shell">
      <div class="url-input-wrapper">
        <button id="url-source-link" type="button"></button>
        <input id="url" type="text" />
        <button id="paste-url" type="button"></button>
        <button id="clear-url" type="button"></button>
        <span id="url-helper-text">Paste a link or drop it here</span>
        <button id="download-button" type="button"></button>
        <button id="enqueue-button" type="button"></button>
      </div>
    </div>
  `;
};

const tick = () => new Promise((resolve) => setTimeout(resolve, 0));

const getDom = () => ({
  shell: document.querySelector(".url-entry-shell"),
  wrapper: document.querySelector(".url-input-wrapper"),
  input: document.getElementById("url"),
  source: document.getElementById("url-source-link"),
  paste: document.getElementById("paste-url"),
  clear: document.getElementById("clear-url"),
  helper: document.getElementById("url-helper-text"),
  download: document.getElementById("download-button"),
  enqueue: document.getElementById("enqueue-button"),
});

describe("downloaderAvailability", () => {
  beforeEach(() => {
    jest.resetModules();
    buildDom();
    window.electron = {
      tools: {
        getVersions: jest.fn(),
      },
    };
    jest.doMock("../i18n.js", () => ({
      t: (key) => {
        if (key === "input.url.helper.ytDlpMissing") {
          return "Install yt-dlp to paste links and start downloads.";
        }
        if (key === "input.url.helper") {
          return "Paste a link or drop it here";
        }
        return key;
      },
    }));
    jest.doMock("../state.js", () => ({
      updateButtonState: jest.fn(),
    }));
  });

  test("disables URL controls when yt-dlp is missing", async () => {
    window.electron.tools.getVersions.mockResolvedValue({
      ytDlp: { ok: false },
      ffmpeg: { ok: true, path: "/tmp/ffmpeg" },
      deno: { ok: true, path: "/tmp/deno" },
    });

    const { initDownloaderAvailability, isDownloaderAvailable } =
      await import("../downloaderAvailability.js");
    initDownloaderAvailability();
    await tick();

    const dom = getDom();
    expect(isDownloaderAvailable()).toBe(false);
    expect(dom.shell.classList.contains("is-downloader-unavailable")).toBe(
      true,
    );
    expect(dom.wrapper.classList.contains("is-downloader-unavailable")).toBe(
      true,
    );
    expect(dom.input.disabled).toBe(true);
    expect(dom.source.disabled).toBe(true);
    expect(dom.paste.disabled).toBe(true);
    expect(dom.clear.disabled).toBe(true);
    expect(dom.download.disabled).toBe(true);
    expect(dom.enqueue.disabled).toBe(true);
    expect(dom.helper.textContent).toBe(
      "Install yt-dlp to paste links and start downloads.",
    );
  });

  test("enables URL input controls when yt-dlp is available", async () => {
    window.electron.tools.getVersions.mockResolvedValue({
      ytDlp: { ok: true, path: "/tmp/yt-dlp" },
      ffmpeg: { ok: false },
      deno: { ok: false },
    });

    const { initDownloaderAvailability, isDownloaderAvailable } =
      await import("../downloaderAvailability.js");
    initDownloaderAvailability();
    await tick();

    const dom = getDom();
    expect(isDownloaderAvailable()).toBe(true);
    expect(dom.wrapper.classList.contains("is-downloader-unavailable")).toBe(
      false,
    );
    expect(dom.input.disabled).toBe(false);
    expect(dom.paste.disabled).toBe(false);
    expect(dom.download.disabled).toBe(true);
  });

  test("updates availability from tools:status events", async () => {
    window.electron.tools.getVersions.mockResolvedValue({
      ytDlp: { ok: true, path: "/tmp/yt-dlp" },
    });

    const { initDownloaderAvailability, isDownloaderAvailable } =
      await import("../downloaderAvailability.js");
    initDownloaderAvailability();
    await tick();
    expect(isDownloaderAvailable()).toBe(true);

    window.dispatchEvent(
      new CustomEvent("tools:status", {
        detail: {
          summary: {
            details: [{ id: "yt", label: "yt-dlp", ok: false }],
          },
        },
      }),
    );
    expect(isDownloaderAvailable()).toBe(false);
    expect(getDom().input.disabled).toBe(true);

    window.dispatchEvent(
      new CustomEvent("tools:status", {
        detail: {
          raw: { ytDlp: { ok: true, path: "/tmp/yt-dlp" } },
        },
      }),
    );
    expect(isDownloaderAvailable()).toBe(true);
    expect(getDom().input.disabled).toBe(false);
  });
});
