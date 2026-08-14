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
        <span data-ui="batch-review-count"></span>
        <span data-ui="batch-review-issues"></span>
        <span data-ui="batch-review-quality"></span>
        <div data-ui="batch-review-list"></div>
        <div data-ui="batch-review-pagination"><span data-ui="batch-review-page"></span></div>
        <button data-action="batch-review-prev"></button>
        <button data-action="batch-review-next"></button>
        <button data-action="batch-review-select-all"></button>
        <button data-action="batch-review-clear"></button>
        <button data-action="batch-review-cancel"></button>
        <button data-action="batch-review-enqueue"></button>
        <button data-action="batch-review-download"></button>
      </div>
    </div>
  `;
}

describe("batch review controller", () => {
  let controller;

  beforeEach(() => {
    jest.resetModules();
    buildDom();
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
    document.querySelector('[data-action="batch-review-enqueue"]').click();

    await expect(pending).resolves.toEqual({
      mode: "batch",
      urls: ["https://example.com/a"],
      action: "enqueue",
    });
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
