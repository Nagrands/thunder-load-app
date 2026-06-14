const buildFilterDom = () => {
  document.body.innerHTML = `
    <div id="queue-filters">
      <button data-queue-filter="all" aria-pressed="true"><span data-queue-filter-count></span></button>
      <button data-queue-filter="active" aria-pressed="false"><span data-queue-filter-count></span></button>
      <button data-queue-filter="pending" aria-pressed="false"><span data-queue-filter-count></span></button>
      <button data-queue-filter="error" aria-pressed="false"><span data-queue-filter-count></span></button>
      <button data-queue-filter="done" aria-pressed="false"><span data-queue-filter-count></span></button>
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
});
