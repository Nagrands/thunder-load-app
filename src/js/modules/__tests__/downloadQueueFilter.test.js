const buildFilterDom = () => {
  document.body.innerHTML = `
    <div class="queue-pills" role="toolbar">
      <button id="queue-total-count" data-queue-filter="all" aria-pressed="true"><span>All</span><span data-queue-filter-count></span></button>
      <button id="queue-active-count" data-queue-filter="active" aria-pressed="false"><span>Active</span><span data-queue-filter-count></span></button>
      <button id="queue-count" data-queue-filter="pending" aria-pressed="false"><span>Queued</span><span data-queue-filter-count></span></button>
      <button id="queue-error-count" data-queue-filter="error" aria-pressed="false"><span>Errors</span><span data-queue-filter-count></span></button>
      <button id="queue-done-count" data-queue-filter="done" aria-pressed="false"><span>Done</span><span data-queue-filter-count></span></button>
    </div>
  `;
};

describe("downloadQueueFilter", () => {
  beforeEach(() => {
    jest.resetModules();
    localStorage.clear();
    buildFilterDom();
  });

  it("restores only supported persisted filters", () => {
    localStorage.setItem("downloadQueueFilter", "unexpected");

    const {
      getDownloadQueueFilter,
      syncQueueFilterControls,
    } = require("../downloadQueueFilter");

    syncQueueFilterControls({ total: 7, pending: 3 });

    expect(getDownloadQueueFilter()).toBe("all");
    expect(
      document
        .querySelector('[data-queue-filter="all"]')
        .getAttribute("aria-pressed"),
    ).toBe("true");
    expect(
      document.querySelector(
        '[data-queue-filter="pending"] [data-queue-filter-count]',
      ).textContent,
    ).toBe("3");
    expect(document.querySelector('[data-queue-filter="pending"]').textContent).toContain(
      "Queued",
    );
    expect(document.querySelector('[data-queue-filter="active"]').classList).toContain(
      "hidden",
    );
  });

  it("persists selection and invokes the render callback once", () => {
    const onChange = jest.fn();
    const {
      getDownloadQueueFilter,
      initDownloadQueueFilter,
    } = require("../downloadQueueFilter");

    initDownloadQueueFilter(onChange);
    initDownloadQueueFilter(onChange);
    document.querySelector('[data-queue-filter="done"]').click();

    expect(getDownloadQueueFilter()).toBe("done");
    expect(localStorage.getItem("downloadQueueFilter")).toBe("done");
    expect(onChange).toHaveBeenCalledTimes(1);
    expect(onChange).toHaveBeenCalledWith("done");
    expect(
      document
        .querySelector('[data-queue-filter="done"]')
        .getAttribute("aria-pressed"),
    ).toBe("true");
  });

  it("resets a selected status filter when that status count becomes zero", () => {
    const {
      getDownloadQueueFilter,
      initDownloadQueueFilter,
      syncQueueFilterControls,
    } = require("../downloadQueueFilter");

    initDownloadQueueFilter();
    syncQueueFilterControls({ total: 2, error: 1 });
    document.querySelector('[data-queue-filter="error"]').click();
    expect(getDownloadQueueFilter()).toBe("error");

    syncQueueFilterControls({ total: 1, error: 0, pending: 1 });

    expect(getDownloadQueueFilter()).toBe("all");
    expect(localStorage.getItem("downloadQueueFilter")).toBe(null);
    expect(
      document
        .querySelector('[data-queue-filter="all"]')
        .getAttribute("aria-pressed"),
    ).toBe("true");
    expect(document.querySelector('[data-queue-filter="error"]').classList).toContain(
      "hidden",
    );
  });
});
