/** @jest-environment jsdom */

function buildDom() {
  document.body.innerHTML = `
    <span id="downloader-output-summary">MP4 · H.264</span>
    <div id="batch-review-modal" aria-hidden="true">
      <div>
        <span data-ui="batch-review-eyebrow"></span>
        <h2 data-ui="batch-review-title"></h2>
        <label data-ui="batch-review-input-wrap"><textarea data-ui="batch-review-input"></textarea></label>
        <input data-ui="batch-review-search" />
        <button data-action="batch-review-filter" data-filter="all"></button>
        <button data-action="batch-review-filter" data-filter="available"></button>
        <button data-action="batch-review-filter" data-filter="problems"></button>
        <span data-ui="batch-review-count"></span>
        <span data-ui="batch-review-issues"></span>
        <span class="batch-review-chip"><span data-ui="batch-review-quality"></span></span>
        <div data-ui="batch-review-list"></div>
        <div data-ui="batch-review-pagination"><span data-ui="batch-review-page"></span></div>
        <button data-action="batch-review-prev"></button>
        <button data-action="batch-review-next"></button>
        <button data-action="batch-review-select-all"></button>
        <button data-action="batch-review-clear"></button>
        <button data-action="batch-review-cancel"></button>
        <button data-action="batch-review-enqueue">
          <span data-ui="batch-review-enqueue-label"></span>
        </button>
        <button data-action="batch-review-download">
          <span data-ui="batch-review-download-label"></span>
        </button>
      </div>
    </div>
  `;
}

describe("batch review controller", () => {
  let controller;
  let getVideoPreviewMock;

  beforeEach(() => {
    jest.resetModules();
    buildDom();
    getVideoPreviewMock = jest.fn().mockResolvedValue({
      success: true,
      title: "Resolved title",
      duration: 125,
      thumbnail: "https://example.com/thumb.jpg",
      uploader: "Example channel",
    });
    jest.doMock("../videoInfoBroker.js", () => ({
      getVideoPreview: getVideoPreviewMock,
    }));
    jest.doMock("../i18n.js", () => ({
      t: (key, vars = {}) => `${key}:${JSON.stringify(vars)}`,
    }));
    jest.doMock("../validation.js", () => ({
      isValidUrl: (url) => /^https?:\/\//.test(url),
      isSupportedUrl: (url) => !url.includes("unsupported"),
    }));
    jest.doMock("../modalManager.js", () => ({
      registerModal: jest.fn(() => jest.fn()),
      openRegisteredModal: jest.fn((modal) => {
        modal.setAttribute("aria-hidden", "false");
      }),
      closeRegisteredModal: jest.fn((modal) => {
        modal.setAttribute("aria-hidden", "true");
      }),
    }));
    jest.doMock("../scrollLockManager.js", () => ({
      acquireBodyScrollLock: jest.fn(),
      releaseBodyScrollLock: jest.fn(),
    }));
    const module = require("../features/batchReview/controller.js");
    controller = module.initBatchReviewController();
  });

  afterEach(() => controller?.dispose());

  test("reviews batch links and resolves the selected action", async () => {
    const pending = controller.openBatch({
      text: [
        "https://example.com/a",
        "https://example.com/a",
        "https://unsupported.example/b",
      ].join("\n"),
    });

    expect(document.querySelectorAll(".batch-review-item")).toHaveLength(3);
    expect(document.querySelectorAll(".batch-review-item.is-unavailable")).toHaveLength(
      2,
    );
    expect(
      document.querySelector('[data-ui="batch-review-issues"]').textContent,
    ).toContain('"duplicates":1');
    expect(
      document.querySelector('[data-ui="batch-review-count"]').textContent,
    ).toContain('"selected":1,"total":1');
    expect(
      document.querySelector('[data-ui="batch-review-download-label"]')
        .textContent,
    ).toContain('"count":1');
    expect(
      document
        .querySelector('[data-ui="batch-review-list"]')
        .classList.contains("batch-review-modal__list--grid"),
    ).toBe(false);
    document.querySelector('[data-action="batch-review-enqueue"]').click();

    await expect(pending).resolves.toEqual({
      mode: "batch",
      urls: ["https://example.com/a"],
      action: "enqueue",
    });
  });

  test("loads titles and thumbnails for batch links", async () => {
    const pending = controller.openBatch({ text: "https://example.com/a" });

    await new Promise((resolve) => setTimeout(resolve, 120));

    const row = document.querySelector(".batch-review-item");
    expect(getVideoPreviewMock).toHaveBeenCalledWith("https://example.com/a");
    expect(row.querySelector("strong").textContent).toBe("Resolved title");
    expect(row.querySelector("img")?.getAttribute("src")).toBe(
      "https://example.com/thumb.jpg",
    );
    expect(row.classList.contains("is-loading")).toBe(false);
    expect(row.querySelector(".batch-review-item__badge--loading")).toBeNull();

    controller.cancel();
    await expect(pending).resolves.toBeNull();
  });

  test("debounces metadata requests while the batch text changes", async () => {
    const input = document.querySelector('[data-ui="batch-review-input"]');
    const pending = controller.openBatch({ text: "" });

    input.value = "https://example.com/a";
    input.dispatchEvent(new Event("input", { bubbles: true }));
    input.value = "https://example.com/b";
    input.dispatchEvent(new Event("input", { bubbles: true }));

    expect(getVideoPreviewMock).not.toHaveBeenCalled();

    await new Promise((resolve) => setTimeout(resolve, 520));

    expect(getVideoPreviewMock).toHaveBeenCalledTimes(1);
    expect(getVideoPreviewMock).toHaveBeenCalledWith("https://example.com/b");

    controller.cancel();
    await expect(pending).resolves.toBeNull();
  });

  test("filters items by availability", async () => {
    const pending = controller.openBatch({
      text: [
        "https://example.com/a",
        "https://example.com/a",
        "https://unsupported.example/b",
      ].join("\n"),
    });

    const problems = document.querySelector('[data-filter="problems"]');
    problems.click();
    expect(problems.getAttribute("aria-pressed")).toBe("true");
    expect(document.querySelectorAll(".batch-review-item")).toHaveLength(2);

    document.querySelector('[data-filter="available"]').click();
    expect(document.querySelectorAll(".batch-review-item")).toHaveLength(1);

    document.querySelector('[data-filter="all"]').click();
    expect(document.querySelectorAll(".batch-review-item")).toHaveLength(3);

    controller.cancel();
    await expect(pending).resolves.toBeNull();
  });

  test("playlist mode uses a card grid and hides the source panel", async () => {
    const pending = controller.openPlaylist({
      items: [{ id: "a", url: "https://example.com/a", title: "Alpha" }],
    });

    expect(
      document
        .getElementById("batch-review-modal")
        .classList.contains("is-playlist"),
    ).toBe(true);
    expect(
      document
        .querySelector('[data-ui="batch-review-list"]')
        .classList.contains("batch-review-modal__list--grid"),
    ).toBe(true);
    expect(
      document.querySelector('[data-ui="batch-review-input-wrap"]').hidden,
    ).toBe(true);

    controller.cancel();
    await expect(pending).resolves.toBeNull();
  });

  test("search does not clear hidden playlist selections", async () => {
    const pending = controller.openPlaylist({
      sourceUrl: "https://example.com/playlist",
      items: [
        { id: "a", url: "https://example.com/a", title: "Alpha" },
        { id: "b", url: "https://example.com/b", title: "Beta" },
      ],
    });
    const search = document.querySelector('[data-ui="batch-review-search"]');
    search.value = "Alpha";
    search.dispatchEvent(new Event("input", { bubbles: true }));
    expect(document.querySelectorAll(".batch-review-item")).toHaveLength(1);

    document.querySelector('[data-action="batch-review-download"]').click();
    await expect(pending).resolves.toEqual({
      mode: "playlist",
      urls: ["https://example.com/a", "https://example.com/b"],
      action: "download",
    });
  });

  test("paginates large lists and cancel leaves no committed draft", async () => {
    const items = Array.from({ length: 205 }, (_, index) => ({
      id: String(index),
      url: `https://example.com/${index}`,
      title: `Item ${index}`,
    }));
    const pending = controller.openPlaylist({ items });
    expect(document.querySelectorAll(".batch-review-item")).toHaveLength(100);
    document.querySelector('[data-action="batch-review-next"]').click();
    expect(document.querySelectorAll(".batch-review-item")).toHaveLength(100);
    document.querySelector('[data-action="batch-review-cancel"]').click();
    await expect(pending).resolves.toBeNull();
  });

  test("reset closes an open review and discards its draft", async () => {
    const pending = controller.openBatch({ text: "https://example.com/a" });

    controller.reset("url-changed");

    await expect(pending).resolves.toBeNull();
    expect(document.getElementById("batch-review-modal").getAttribute("aria-hidden")).toBe(
      "true",
    );
    expect(controller.getDraft()).toBeNull();
  });
});
