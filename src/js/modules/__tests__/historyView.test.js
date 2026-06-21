import { jest } from "@jest/globals";

jest.mock("../tooltipInitializer.js", () => ({
  initTooltips: jest.fn(),
  disposeAllTooltips: jest.fn(),
}));

jest.mock("../toast.js", () => ({
  showToast: jest.fn(),
}));

jest.mock("../contextMenu.js", () => ({
  handleDeleteEntry: jest.fn(),
}));

jest.mock("../iconUpdater.js", () => ({
  updateIcon: jest.fn(),
}));

jest.mock("../historyFilter.js", () => ({
  setFilterInputValue: jest.fn(),
}));

jest.mock("../filterAndSortHistory.js", () => ({
  filterAndSortHistory: jest.fn(),
}));

const setupDom = () => {
  document.body.innerHTML = `
    <div class="input-container">
      <div class="url-input-wrapper" id="url-input-wrapper">
        <input id="url" />
      </div>
    </div>
    <button id="download-button"><span class="button-text"></span></button>
    <button id="download-cancel"></button>
    <button id="open-history"></button>
    <div id="history-container">
      <div class="history-controls">
        <div id="history-header" class="history-count-pill">
          <i data-lucide="files"></i>
          <span id="total-downloads">0</span>
          <span id="total-downloads-label"></span>
          <span id="total-download-size">0 MB</span>
          <span id="total-download-size-label"></span>
        </div>
        <button id="refresh-button"></button>
        <button id="sort-button"><i data-lucide="arrow-down-wide-narrow"></i></button>
        <button id="clear-history"></button>
        <button id="delete-selected" class="hidden"></button>
        <button id="history-more-trigger" aria-expanded="false"></button>
        <div id="history-more-menu" class="hidden">
          <button id="restore-history" class="history-more-menu__item"></button>
          <button id="history-export-json" class="history-more-menu__item"></button>
          <button id="history-export-csv" class="history-more-menu__item"></button>
          <button id="history-density-compact" class="history-more-menu__item"></button>
          <button id="history-density-comfort" class="history-more-menu__item"></button>
          <button id="toggle-all-details" class="history-more-menu__item">
            <i data-lucide="chevron-down"></i>
          </button>
        </div>

        <div class="history-search-filters-card">
          <div class="history-controls-row history-controls-row--primary history-controls-row--search-filter">
            <div class="history-search-card">
              <div class="history-search-wrapper">
                <i id="icon-filter-search"></i>
                <input id="filter-input" />
                <button id="clear-filter-input" class="hidden"></button>
              </div>
            </div>
          </div>

          <div class="history-controls-row history-controls-row--filters history-filters-row">
            <div id="history-filters-card">
              <button id="history-filters-toggle" aria-expanded="true">
                <i data-lucide="chevron-up"></i>
              </button>
              <div class="history-filters-head-actions">
                <span id="history-active-filters-count" class="hidden"></span>
                <button
                  id="history-reset-filters"
                  class="history-filter-reset hidden"
                  aria-label="Сбросить фильтры"
                  title="Сбросить активные фильтры"
                  data-bs-toggle="tooltip"
                  data-bs-placement="top"
                  data-hint="Сбросить активные фильтры"
                  data-i18n-aria="history.filters.reset"
                  data-i18n-title="history.filters.resetHint"
                  data-i18n-hint="history.filters.resetHint"
                >
                  <i data-lucide="rotate-ccw"></i>
                </button>
              </div>
              <div id="history-filters-body"></div>
            </div>
          </div>
        </div>
      </div>

      <select id="history-source-filter"></select>
      <select id="history-sort-key"></select>
      <select id="history-sort-mode"></select>
      <div id="history-cards"></div>
      <div id="history-cards-empty"></div>
      <div id="history-bulk-bar" class="history-bulk-bar hidden"></div>
      <span id="history-selected-count"></span>
      <button id="history-clear-selection"></button>
      <div id="history"></div>
      <div id="history-empty"></div>
    </div>
  `;

  global.window.electron = {
    invoke: jest.fn(),
    tools: {
      analyzeMediaFile: jest.fn().mockResolvedValue({
        success: true,
        report: {
          file: {
            path: "/tmp/video.mp4",
            name: "video.mp4",
            extension: ".mp4",
            sizeBytes: 1048576,
          },
          format: {
            container: "mp4",
            durationSec: 12,
            bitrate: 500000,
            probeScore: 100,
          },
          videoStreams: [{ codec: "h264", width: 1280, height: 720, fps: 30 }],
          audioStreams: [],
          subtitleStreams: [],
          warnings: [],
          rawAvailable: true,
        },
      }),
      showInFolder: jest.fn().mockResolvedValue({ success: true }),
    },
  };
  global.window.scrollTo = jest.fn();
  global.window.lucide = {
    createIcons: jest.fn(),
    icons: {},
  };

  global.requestAnimationFrame = (cb) => cb();
  Object.defineProperty(navigator, "clipboard", {
    value: {
      writeText: jest.fn().mockResolvedValue(undefined),
    },
    configurable: true,
  });

  const retryTarget = document.getElementById("url-input-wrapper");
  retryTarget.getBoundingClientRect = jest.fn(() => ({
    top: 520,
    left: 0,
    width: 120,
    height: 40,
    right: 120,
    bottom: 560,
  }));
};

const createEntry = (overrides = {}) => ({
  id: overrides.id ?? "1",
  fileName: overrides.fileName ?? "Test video",
  sourceUrl: overrides.sourceUrl ?? "https://example.com/watch?v=1",
  timestamp: overrides.timestamp ?? new Date().toISOString(),
  dateText: overrides.dateText ?? "2026-02-07 12:00",
  quality: overrides.quality ?? "1080p",
  resolution: overrides.resolution ?? "1920x1080",
  fps: overrides.fps,
  durationSec: overrides.durationSec,
  formattedSize: overrides.formattedSize ?? "10 MB",
  sizeBytes: overrides.sizeBytes,
  filePath: overrides.filePath ?? "/tmp/video.mp4",
  downloadStatus: overrides.downloadStatus ?? "done",
  error: overrides.error ?? false,
  errorCode: overrides.errorCode ?? "",
  retryable: overrides.retryable,
  isMissing: overrides.isMissing ?? false,
  thumbnail:
    overrides.thumbnail ??
    "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR4nGNgYAAAAAMAASsJTYQAAAAASUVORK5CYII=",
});

describe("Downloader history list", () => {
  beforeAll(() => {
    jest.spyOn(console, "error").mockImplementation(() => {});
    jest.spyOn(console, "warn").mockImplementation(() => {});
  });

  afterAll(() => {
    console.error.mockRestore();
    console.warn.mockRestore();
  });

  beforeEach(() => {
    jest.resetModules();
    localStorage.clear();
    setupDom();
  });

  test("applies density class and active button", async () => {
    localStorage.setItem("historyDensity", "compact");
    const { renderHistory } = await import("../history.js");

    renderHistory([createEntry()]);

    const list = document.getElementById("history");
    expect(list.classList.contains("density-compact")).toBe(true);
    expect(
      document
        .getElementById("history-density-compact")
        .classList.contains("is-active"),
    ).toBe(true);
  });

  test("updates header icon and total files size summary", async () => {
    const { renderHistory } = await import("../history.js");

    renderHistory([
      createEntry({ id: "1", sizeBytes: 1048576 }),
      createEntry({ id: "2", sizeBytes: 2 * 1048576 }),
      createEntry({ id: "3", sizeBytes: 40 * 1048576, isMissing: true }),
    ]);

    expect(
      document.querySelector("#history-header [data-lucide='files']"),
    ).not.toBeNull();
    expect(document.getElementById("total-downloads").textContent).toBe("3");
    expect(document.getElementById("total-downloads-label").textContent).toBe(
      "записи",
    );
    expect(document.getElementById("total-download-size").textContent).toBe(
      "3 MB",
    );
  });

  test("does not load history during shell initialization", async () => {
    localStorage.setItem("historyVisible", "true");
    const { initHistory } = await import("../history.js");

    initHistory();

    expect(window.electron.invoke).not.toHaveBeenCalledWith("load-history");
  });

  test("initial state load uses cached stats instead of count IPC", async () => {
    window.electron.invoke.mockImplementation((channel) => {
      if (channel === "load-history") {
        return Promise.resolve([
          createEntry({
            id: "1",
            filePath: "/tmp/video.mp4",
          }),
        ]);
      }
      if (channel === "check-file-exists") return Promise.resolve(true);
      if (channel === "get-file-size") return Promise.resolve(3 * 1024 * 1024);
      if (channel === "get-download-count") return Promise.resolve(999);
      return Promise.resolve(null);
    });
    const { initHistoryState } = await import("../history.js");

    await initHistoryState();

    expect(window.electron.invoke).toHaveBeenCalledWith("load-history");
    expect(window.electron.invoke).not.toHaveBeenCalledWith(
      "get-download-count",
    );
    expect(document.getElementById("total-downloads").textContent).toBe("1");
    expect(document.getElementById("total-download-size").textContent).toBe(
      "3 MB",
    );
  });

  test("reuses in-flight history load when panel opens during hydration", async () => {
    let resolveHistory;
    const historyPromise = new Promise((resolve) => {
      resolveHistory = resolve;
    });
    window.electron.invoke.mockImplementation((channel) => {
      if (channel === "load-history") return historyPromise;
      return Promise.resolve(null);
    });
    const { initHistory, initHistoryState } = await import("../history.js");

    initHistory();
    const hydration = initHistoryState();
    document.getElementById("open-history").click();

    expect(
      window.electron.invoke.mock.calls.filter(
        ([channel]) => channel === "load-history",
      ),
    ).toHaveLength(1);

    resolveHistory([]);
    await hydration;
  });

  test("renders compact pagination controls with page-size options", async () => {
    const { renderHistory } = await import("../history.js");
    const entries = Array.from({ length: 12 }, (_, idx) =>
      createEntry({ id: String(idx + 1), fileName: `Entry ${idx + 1}` }),
    );

    renderHistory(entries, {
      pageSize: 10,
      totalEntries: entries.length,
      fullEntries: entries,
    });

    const pagination = document.getElementById("history-pagination");
    const pageSize = document.getElementById("history-page-size");

    expect(pagination).not.toBeNull();
    expect(pagination.dataset.ui).toBe("history-pagination");
    expect(pagination.querySelector(".history-page-side--left")).not.toBeNull();
    expect(
      pagination.querySelector(".history-page-side--right"),
    ).not.toBeNull();
    expect(pagination.querySelector("#history-page-info").textContent).toBe(
      "Стр. 1 / 2 · 12 записей",
    );
    expect(Array.from(pageSize.options).map((opt) => opt.value)).toEqual([
      "4",
      "10",
      "20",
    ]);
    expect(pageSize.value).toBe("10");
    expect(pagination.querySelector(".bk-select-wrapper")).not.toBeNull();
  });

  test("hides pagination for empty history", async () => {
    const { renderHistory } = await import("../history.js");

    renderHistory([], {
      pageSize: 10,
      totalEntries: 0,
      fullEntries: [],
    });

    const pagination = document.getElementById("history-pagination");

    expect(pagination).not.toBeNull();
    expect(pagination.style.display).toBe("none");
  });

  test("keeps pagination disabled states in sync with current page", async () => {
    const { renderHistory } = await import("../history.js");
    const entries = Array.from({ length: 12 }, (_, idx) =>
      createEntry({ id: String(idx + 1), fileName: `Entry ${idx + 1}` }),
    );

    renderHistory(entries, {
      page: 1,
      pageSize: 4,
      totalEntries: entries.length,
      fullEntries: entries,
    });

    expect(document.getElementById("history-page-prev").disabled).toBe(true);
    expect(document.getElementById("history-page-prev-fast").disabled).toBe(
      true,
    );
    expect(document.getElementById("history-page-next").disabled).toBe(false);
    expect(document.getElementById("history-page-next-fast").disabled).toBe(
      false,
    );

    renderHistory(entries, {
      page: 3,
      pageSize: 4,
      totalEntries: entries.length,
      fullEntries: entries,
    });

    expect(document.getElementById("history-page-prev").disabled).toBe(false);
    expect(document.getElementById("history-page-prev-fast").disabled).toBe(
      false,
    );
    expect(document.getElementById("history-page-next").disabled).toBe(true);
    expect(document.getElementById("history-page-next-fast").disabled).toBe(
      true,
    );
  });

  test("groups entries by date with labels", async () => {
    jest.useFakeTimers();
    jest.setSystemTime(new Date("2026-02-07T12:00:00"));
    localStorage.setItem("uiLanguage", "ru");

    const { renderHistory } = await import("../history.js");

    const today = new Date("2026-02-07T10:00:00").toISOString();
    const yesterday = new Date("2026-02-06T18:30:00").toISOString();

    renderHistory([
      createEntry({ id: "1", timestamp: today }),
      createEntry({ id: "2", timestamp: yesterday }),
    ]);

    const groups = Array.from(document.querySelectorAll(".history-group"));
    const labels = groups.map((g) => g.textContent.trim());

    expect(groups).toHaveLength(2);
    expect(labels.some((label) => label.startsWith("Сегодня"))).toBe(true);
    expect(labels.some((label) => label.startsWith("Вчера"))).toBe(true);

    jest.useRealTimers();
  });

  test("moves secondary actions into menu", async () => {
    const { renderHistory } = await import("../history.js");

    renderHistory([createEntry()]);

    const actions = document.querySelector(".history-row__actions");
    expect(actions).not.toBeNull();
    expect(
      actions.querySelector(".history-row__actions-primary"),
    ).not.toBeNull();
    expect(
      actions.querySelector(".history-row__actions-secondary"),
    ).not.toBeNull();

    expect(
      actions.querySelector('[data-action="open-file"] [data-lucide="play"]'),
    ).not.toBeNull();
    expect(
      actions.querySelector(
        '[data-action="open-folder"] [data-lucide="folder-open"]',
      ),
    ).not.toBeNull();
    expect(actions.querySelector('[data-action="details"]')).not.toBeNull();

    const menu = actions.querySelector(".history-row__menu");
    const menuButton = actions.querySelector(".history-row__menu-button");
    const menuList = actions.querySelector(".history-row__menu-list");

    expect(menu).not.toBeNull();
    expect(menuButton).not.toBeNull();
    expect(menuList).not.toBeNull();
    expect(menuList.textContent).toContain("Проверить");
    expect(
      menuList.querySelector(
        '.history-row__menu-item[data-action="inspect"] .history-row__menu-icon',
      ),
    ).not.toBeNull();
    expect(
      menuList
        .querySelector(
          '.history-row__menu-item[data-action="inspect"] .history-row__menu-label',
        )
        ?.textContent.trim(),
    ).toBe("Проверить");
    const deleteItem = menuList.querySelector(
      '.history-row__menu-item[data-action="delete-entry"]',
    );
    expect(deleteItem?.classList.contains("history-row__delete")).toBe(true);
    expect(
      deleteItem?.classList.contains("history-row__menu-item--danger"),
    ).toBe(true);
    expect(menu.classList.contains("is-open")).toBe(false);

    menuButton.dispatchEvent(new MouseEvent("click", { bubbles: true }));
    expect(menu.classList.contains("is-open")).toBe(true);
  });

  test("opens inline media inspector inside a history card and toggles it closed", async () => {
    window.electron.invoke.mockResolvedValue(true);
    const { renderHistoryCards } = await import("../features/history/core.js");

    renderHistoryCards([createEntry()]);

    const inspectButton = document.querySelector(
      '.history-card-btn[data-action="inspect"]',
    );
    const inspectorSlot = document.querySelector(
      ".history-card-inspector-slot",
    );

    inspectButton.click();
    await Promise.resolve();
    await Promise.resolve();

    expect(window.electron.invoke).toHaveBeenCalledWith(
      "check-file-exists",
      "/tmp/video.mp4",
    );
    expect(window.electron.tools.analyzeMediaFile).toHaveBeenCalledWith({
      filePath: "/tmp/video.mp4",
    });
    expect(inspectorSlot.classList.contains("hidden")).toBe(false);
    expect(
      inspectorSlot.querySelector(".media-inspector-card--history"),
    ).not.toBeNull();

    inspectButton.click();
    await Promise.resolve();

    expect(inspectorSlot.classList.contains("hidden")).toBe(true);
  });

  test("opens inline media inspector inside row details and keeps only one open", async () => {
    window.electron.invoke.mockResolvedValue(true);
    const { renderHistory } = await import("../history.js");

    renderHistory([
      createEntry({ id: "1", fileName: "First" }),
      createEntry({ id: "2", fileName: "Second", filePath: "/tmp/second.mp4" }),
    ]);

    const menuButtons = document.querySelectorAll(".history-row__menu-button");
    menuButtons[0].click();
    document
      .querySelector('.history-row__menu-item[data-action="inspect"]')
      .click();
    await Promise.resolve();
    await Promise.resolve();

    const rows = document.querySelectorAll(".history-row");
    expect(
      rows[0]
        .querySelector(".history-row__details")
        ?.classList.contains("is-open"),
    ).toBe(true);
    expect(
      rows[0].querySelector(".history-row-inspector-slot.hidden"),
    ).toBeNull();

    menuButtons[1].click();
    rows[1]
      .querySelector('.history-row__menu-item[data-action="inspect"]')
      .click();
    await Promise.resolve();
    await Promise.resolve();

    expect(
      rows[0]
        .querySelector(".history-row-inspector-slot")
        ?.classList.contains("hidden"),
    ).toBe(true);
    expect(
      rows[1].querySelector(".history-row-inspector-slot.hidden"),
    ).toBeNull();
    expect(window.electron.tools.analyzeMediaFile).toHaveBeenLastCalledWith({
      filePath: "/tmp/second.mp4",
    });
  });

  test("renders compact row badge line with source and size", async () => {
    const { renderHistory } = await import("../history.js");
    renderHistory([
      createEntry({
        sourceUrl: "https://youtube.com/watch?v=1",
        resolution: "1920x1080",
        fps: 60,
        formattedSize: "74.9 MB",
      }),
    ]);

    const row = document.querySelector(".history-row");
    const badges = row.querySelector(".history-row__badges");
    expect(badges).not.toBeNull();
    expect(badges.querySelector(".history-badge--host")).not.toBeNull();
    expect(badges.querySelector(".history-badge--media")).not.toBeNull();
    expect(row.querySelector(".history-row__summary")).not.toBeNull();
    expect(row.querySelector(".history-row__meta")).not.toBeNull();
    expect(row.querySelector(".history-row__size")).not.toBeNull();
  });

  test("renders failed history entry with failure badge and disabled file actions", async () => {
    const { renderHistory } = await import("../history.js");
    renderHistory([
      createEntry({
        filePath: "",
        formattedSize: "",
        downloadStatus: "failed",
        errorCode: "AUTH_REQUIRED",
        retryable: false,
      }),
    ]);

    const row = document.querySelector(".history-row");
    expect(row.classList.contains("history-row--error")).toBe(true);
    expect(row.classList.contains("history-row--deleted")).toBe(false);
    expect(row.textContent).toContain("Ошибка");
    expect(row.querySelector(".history-badge--error").textContent).toContain(
      "Ошибка",
    );
    expect(
      row.querySelector('.history-row__action[data-action="open-file"]')
        ?.disabled,
    ).toBe(true);
    expect(
      row.querySelector('.history-row__action[data-action="open-folder"]')
        ?.disabled,
    ).toBe(true);

    const toggle = row.querySelector(".history-row__toggle");
    expect(toggle.getAttribute("aria-expanded")).toBe("false");
    expect(toggle.classList.contains("is-open")).toBe(false);
    toggle.dispatchEvent(new MouseEvent("click", { bubbles: true }));
    expect(toggle.classList.contains("is-open")).toBe(true);
    expect(toggle.getAttribute("aria-expanded")).toBe("true");
    expect(row.textContent).toContain("Нужна авторизация");
    expect(
      row.querySelector('.history-row__details-item[data-detail-kind="status"]'),
    ).not.toBeNull();
    expect(
      row.querySelector(
        '.history-row__details-item[data-detail-kind="failure-reason"]',
      ),
    ).not.toBeNull();

    toggle.dispatchEvent(new MouseEvent("click", { bubbles: true }));
    expect(toggle.classList.contains("is-open")).toBe(false);
    expect(toggle.getAttribute("aria-expanded")).toBe("false");
  });

  test("renders explicit error history entry with error highlight", async () => {
    const { renderHistory } = await import("../history.js");
    renderHistory([
      createEntry({
        filePath: "",
        formattedSize: "",
        error: true,
        errorCode: "NETWORK_TIMEOUT",
        retryable: true,
      }),
    ]);

    const row = document.querySelector(".history-row");
    expect(row.classList.contains("history-row--error")).toBe(true);
    expect(row.classList.contains("history-row--deleted")).toBe(false);
    expect(row.querySelector(".history-badge--error").textContent).toContain(
      "Ошибка",
    );
  });

  test("retry from row menu scrolls to URL input and focuses it", async () => {
    jest.useFakeTimers();
    const { renderHistory } = await import("../history.js");
    window.electron.invoke.mockResolvedValue(true);

    renderHistory([createEntry()]);

    const menuButton = document.querySelector(".history-row__menu-button");
    menuButton.dispatchEvent(new MouseEvent("click", { bubbles: true }));

    const retryItem = document.querySelector(
      '.history-row__menu-item[data-action="retry"]',
    );
    const forcePreviewEvents = [];
    document
      .getElementById("url")
      .addEventListener("force-preview", (event) =>
        forcePreviewEvents.push(event),
      );
    retryItem.dispatchEvent(new MouseEvent("click", { bubbles: true }));

    const url = document.getElementById("url");

    expect(url.value).toBe("https://example.com/watch?v=1");
    expect(forcePreviewEvents[0]).toBeInstanceOf(CustomEvent);
    expect(forcePreviewEvents[0].detail).toEqual({ autoOpenQuality: true });
    expect(window.scrollTo).toHaveBeenCalledWith(
      expect.objectContaining({
        behavior: "smooth",
      }),
    );

    jest.runAllTimers();
    await Promise.resolve();
    await Promise.resolve();

    expect(document.activeElement).toBe(url);
    expect(url.selectionStart).toBe(0);
    expect(url.selectionEnd).toBe(url.value.length);
    jest.useRealTimers();
  });

  test("toggles control-deck more menu and closes on escape", async () => {
    const { initHistory } = await import("../history.js");
    const trigger = document.getElementById("history-more-trigger");
    const menu = document.getElementById("history-more-menu");

    initHistory();

    trigger.dispatchEvent(new MouseEvent("click", { bubbles: true }));
    expect(menu.classList.contains("hidden")).toBe(false);
    expect(trigger.getAttribute("aria-expanded")).toBe("true");

    document.dispatchEvent(new KeyboardEvent("keydown", { key: "Escape" }));
    expect(menu.classList.contains("hidden")).toBe(true);
    expect(trigger.getAttribute("aria-expanded")).toBe("false");
  });

  test("animates download history panel when footer button toggles it", async () => {
    jest.useFakeTimers();
    const { initHistory } = await import("../history.js");
    const historyButton = document.getElementById("open-history");
    const historyContainer = document.getElementById("history-container");
    const filterInput = document.getElementById("filter-input");

    initHistory();

    expect(historyContainer.style.display).toBe("none");
    expect(historyContainer.classList.contains("is-collapsed")).toBe(true);
    expect(historyButton.getAttribute("aria-expanded")).toBe("false");

    historyButton.click();
    jest.advanceTimersByTime(16);

    expect(historyContainer.style.display).toBe("block");
    expect(historyContainer.classList.contains("is-open")).toBe(true);
    expect(historyContainer.getAttribute("aria-hidden")).toBe("false");
    expect(historyButton.getAttribute("aria-expanded")).toBe("true");
    expect(filterInput.style.display).toBe("block");

    historyButton.click();

    expect(historyContainer.style.display).toBe("block");
    expect(historyContainer.classList.contains("is-collapsed")).toBe(true);
    expect(historyContainer.getAttribute("aria-hidden")).toBe("true");
    expect(historyButton.getAttribute("aria-expanded")).toBe("false");

    jest.advanceTimersByTime(260);

    expect(historyContainer.style.display).toBe("none");
    expect(filterInput.style.display).toBe("none");
    jest.useRealTimers();
  });

  test("updates active filters badge and resets filters to defaults", async () => {
    const sourceSelect = document.getElementById("history-source-filter");
    sourceSelect.innerHTML = `
      <option value="">Все</option>
      <option value="youtube.com">youtube.com</option>
    `;
    const sortKeySelect = document.getElementById("history-sort-key");
    sortKeySelect.innerHTML = `
      <option value="date">По дате</option>
      <option value="quality">По качеству</option>
    `;
    const sortModeSelect = document.getElementById("history-sort-mode");
    sortModeSelect.innerHTML = `
      <option value="video">Видео</option>
      <option value="audio">Аудио</option>
      <option value="mixed">Смешано</option>
    `;

    const { initHistory } = await import("../history.js");

    initHistory();

    const badge = document.getElementById("history-active-filters-count");
    const resetBtn = document.getElementById("history-reset-filters");
    const actions = document.querySelector(".history-filters-head-actions");

    expect(actions).not.toBeNull();
    expect(badge.parentElement).toBe(actions);
    expect(resetBtn.parentElement).toBe(actions);
    expect(Array.from(actions.children)).toEqual([badge, resetBtn]);
    expect(resetBtn.textContent.trim()).toBe("");
    expect(resetBtn.getAttribute("aria-label")).toBe("Сбросить фильтры");
    expect(resetBtn.getAttribute("data-i18n-aria")).toBe(
      "history.filters.reset",
    );
    expect(resetBtn.getAttribute("data-bs-toggle")).toBe("tooltip");
    expect(resetBtn.getAttribute("data-bs-placement")).toBe("top");
    expect(resetBtn.getAttribute("title")).toBe("Сбросить активные фильтры");
    expect(resetBtn.getAttribute("data-i18n-title")).toBe(
      "history.filters.resetHint",
    );
    expect(resetBtn.getAttribute("data-i18n-hint")).toBe(
      "history.filters.resetHint",
    );

    expect(badge.classList.contains("hidden")).toBe(true);
    expect(resetBtn.disabled).toBe(true);
    expect(resetBtn.classList.contains("hidden")).toBe(true);

    sourceSelect.value = "youtube.com";
    sourceSelect.dispatchEvent(new Event("change", { bubbles: true }));
    sortModeSelect.value = "audio";
    sortModeSelect.dispatchEvent(new Event("change", { bubbles: true }));

    expect(badge.classList.contains("hidden")).toBe(false);
    expect(badge.textContent).toContain("2");
    expect(resetBtn.disabled).toBe(false);
    expect(resetBtn.classList.contains("hidden")).toBe(false);
    expect(resetBtn.closest(".history-filters-head-actions")).toBe(actions);
    expect(resetBtn.querySelector('[data-lucide="rotate-ccw"]')).not.toBeNull();
    expect(resetBtn.getAttribute("data-hint")).toBe(
      "Сбросить активные фильтры",
    );

    resetBtn.click();

    expect(sourceSelect.value).toBe("");
    expect(sortKeySelect.value).toBe("date");
    expect(sortModeSelect.value).toBe("mixed");
    expect(badge.classList.contains("hidden")).toBe(true);
    expect(resetBtn.disabled).toBe(true);
    expect(resetBtn.classList.contains("hidden")).toBe(true);
  });

  test("renders unified search+filters card with required controls", async () => {
    const unifiedCard = document.querySelector(".history-search-filters-card");
    expect(unifiedCard).not.toBeNull();
    expect(
      unifiedCard
        .querySelector(".history-controls-row--primary")
        .classList.contains("history-controls-row--search-filter"),
    ).toBe(true);
    expect(unifiedCard.querySelector("#filter-input")).not.toBeNull();
    expect(unifiedCard.querySelector("#history-filters-card")).not.toBeNull();
  });

  test("enables virtualized rendering for large history pages", async () => {
    localStorage.setItem("historyPageSize", "200");
    const { renderHistory } = await import("../history.js");

    const entries = Array.from({ length: 120 }, (_, idx) =>
      createEntry({
        id: String(idx + 1),
        fileName: `Entry ${idx + 1}`,
        sourceUrl: `https://example.com/watch?v=${idx + 1}`,
      }),
    );

    renderHistory(entries, {
      pageSize: 200,
      totalEntries: entries.length,
      fullEntries: entries,
    });

    const list = document.getElementById("history");
    const renderedRows = list.querySelectorAll(".history-row");
    expect(list.dataset.virtualized).toBe("true");
    expect(list.querySelector(".history-virtual-window")).not.toBeNull();
    expect(renderedRows.length).toBeGreaterThan(0);
    expect(renderedRows.length).toBeLessThan(entries.length);
  });

  test("keeps full render for small history pages", async () => {
    const { renderHistory } = await import("../history.js");
    const entries = Array.from({ length: 12 }, (_, idx) =>
      createEntry({
        id: String(idx + 1),
        fileName: `Small ${idx + 1}`,
        sourceUrl: `https://example.com/watch?v=small-${idx + 1}`,
      }),
    );

    renderHistory(entries, {
      pageSize: 20,
      totalEntries: entries.length,
      fullEntries: entries,
    });

    const list = document.getElementById("history");
    expect(list.dataset.virtualized).toBe("false");
    expect(list.querySelector(".history-virtual-window")).toBeNull();
    expect(list.querySelectorAll(".history-row")).toHaveLength(entries.length);
  });

  test("toggles details when clicking history row body", async () => {
    const { renderHistory } = await import("../history.js");

    renderHistory([createEntry()]);

    const row = document.querySelector(".history-row");
    const details = row.querySelector(".history-row__details");

    expect(details.classList.contains("is-open")).toBe(false);

    row.dispatchEvent(new MouseEvent("click", { bubbles: true }));
    expect(details.classList.contains("is-open")).toBe(true);

    row.dispatchEvent(new MouseEvent("click", { bubbles: true }));
    expect(details.classList.contains("is-open")).toBe(false);
  });

  test("keeps toggle-all details chevron state in sync", async () => {
    const { renderHistory, initHistory } = await import("../history.js");

    initHistory();
    renderHistory([
      createEntry({ id: "1" }),
      createEntry({ id: "2", fileName: "Second video" }),
    ]);

    const toggleAll = document.getElementById("toggle-all-details");
    const icon = toggleAll.querySelector('[data-lucide="chevron-down"]');
    const rows = Array.from(document.querySelectorAll(".history-row"));

    expect(icon).not.toBeNull();
    expect(toggleAll.classList.contains("is-open")).toBe(false);
    expect(rows.every((row) => row.classList.contains("is-open"))).toBe(false);

    toggleAll.dispatchEvent(new MouseEvent("click", { bubbles: true }));

    expect(toggleAll.classList.contains("is-open")).toBe(true);
    expect(toggleAll.querySelector('[data-lucide="chevron-down"]')).toBe(icon);
    expect(rows.every((row) => row.classList.contains("is-open"))).toBe(true);

    toggleAll.dispatchEvent(new MouseEvent("click", { bubbles: true }));

    expect(toggleAll.classList.contains("is-open")).toBe(false);
    expect(rows.every((row) => row.classList.contains("is-open"))).toBe(false);
  });

  test("renders source and file detail action controls", async () => {
    const { renderHistory } = await import("../history.js");
    const entry = createEntry({
      sourceUrl:
        "https://example.com/very/long/source/path/that/should/be/truncated",
      filePath:
        "/Users/nagrand/Movies/Download/Long/Long/Long/path/to/downloaded/file-name.webm",
    });

    renderHistory([entry]);

    window.electron.invoke.mockImplementation((channel) => {
      if (channel === "check-file-exists") return Promise.resolve(true);
      return Promise.resolve(true);
    });

    const actionButtons = document.querySelectorAll(
      ".history-row__details-action",
    );
    const truncatedValues = document.querySelectorAll(
      ".history-row__details-value--truncate",
    );

    expect(actionButtons).toHaveLength(2);
    expect(truncatedValues.length).toBeGreaterThanOrEqual(2);
    expect(
      document.querySelector(
        '.history-row__details-item[data-detail-kind="source"] [data-action="open-source"]',
      ),
    ).not.toBeNull();
    expect(
      document.querySelector(
        '.history-row__details-item[data-detail-kind="file"] [data-action="open-folder"]',
      ),
    ).not.toBeNull();

    document
      .querySelector(
        '.history-row__details-item[data-detail-kind="source"] [data-action="open-source"]',
      )
      .dispatchEvent(new MouseEvent("click", { bubbles: true }));
    await Promise.resolve();
    expect(window.electron.invoke).toHaveBeenCalledWith(
      "open-external-link",
      entry.sourceUrl,
    );

    document
      .querySelector(
        '.history-row__details-item[data-detail-kind="file"] [data-action="open-folder"]',
      )
      .dispatchEvent(new MouseEvent("click", { bubbles: true }));
    await Promise.resolve();
    await Promise.resolve();
    expect(window.electron.invoke).toHaveBeenCalledWith(
      "open-download-folder",
      entry.filePath,
    );
  });

  test("renders redesigned details structure including ordered fields", async () => {
    const { renderHistory } = await import("../history.js");
    renderHistory([
      createEntry({
        formattedSize: "74.9 MB",
        resolution: "1920x822",
        fps: 30,
        durationSec: 227,
      }),
    ]);

    const row = document.querySelector(".history-row");
    const details = row.querySelector(".history-row__details");
    const content = details.querySelector(".history-row__details-content");
    const preview = details.querySelector(".history-row__preview");
    const list = details.querySelector(".history-row__details-list");
    const items = details.querySelectorAll(".history-row__details-item");
    const kinds = [...items].map((item) => item.dataset.detailKind);

    expect(content).not.toBeNull();
    expect(preview).not.toBeNull();
    expect(list).not.toBeNull();
    expect(preview.querySelector(".history-row__preview-play")).not.toBeNull();
    expect(preview.querySelector(".history-row__preview-progress")).toBeNull();
    expect(preview.querySelector(".history-row__preview-duration").textContent).toBe(
      "3:47",
    );
    expect(kinds).toEqual(["source", "file", "quality", "size", "date"]);
    expect(items).toHaveLength(5);
    expect(
      details.querySelector(
        '.history-row__details-item[data-detail-kind="quality"] [data-lucide="monitor-play"]',
      ),
    ).not.toBeNull();
    expect(details.textContent).toContain("1920x822 • 30fps");
    expect(details.textContent).toContain("74.9 MB");
  });

  test("renders placeholder details preview when thumbnail is unavailable", async () => {
    const { renderHistory } = await import("../history.js");
    renderHistory([createEntry({ thumbnail: "" })]);

    const preview = document.querySelector(".history-row__details-preview");

    expect(preview).not.toBeNull();
    expect(preview.classList.contains("is-placeholder")).toBe(true);
    expect(preview.querySelector("img")).not.toBeNull();
    expect(preview.querySelector(".history-row__preview-play")).not.toBeNull();
  });

  test("opens downloaded file from details preview play button", async () => {
    const { renderHistory } = await import("../history.js");
    const entry = createEntry({ filePath: "/tmp/downloaded-video.mp4" });
    window.electron.invoke.mockImplementation((channel) => {
      if (channel === "check-file-exists") return Promise.resolve(true);
      return Promise.resolve(true);
    });

    renderHistory([entry]);

    const playButton = document.querySelector(".history-row__preview-play");
    playButton.dispatchEvent(new MouseEvent("click", { bubbles: true }));
    await Promise.resolve();
    await Promise.resolve();

    expect(window.electron.invoke).toHaveBeenCalledWith(
      "open-last-video",
      entry.filePath,
    );
  });

  test("toggles select all / unselect all for a date group", async () => {
    const { renderHistory, initHistory } = await import("../history.js");
    const sameDay = new Date("2026-02-07T10:00:00").toISOString();
    initHistory();
    renderHistory([
      createEntry({ id: "1", timestamp: sameDay }),
      createEntry({ id: "2", timestamp: sameDay, fileName: "Second" }),
    ]);

    const toggle = document.querySelector(".history-group__toggle");
    expect(toggle).not.toBeNull();
    expect(toggle.textContent).toContain("Выбрать");
    expect(document.querySelector(".history-group__count").textContent).toBe(
      "2",
    );

    toggle.dispatchEvent(new MouseEvent("click", { bubbles: true }));
    const checkedAfterSelect = document.querySelectorAll(
      ".history-row__checkbox:checked",
    );
    expect(checkedAfterSelect.length).toBe(2);
    expect(toggle.textContent).toContain("Снять");

    toggle.dispatchEvent(new MouseEvent("click", { bubbles: true }));
    const checkedAfterUnselect = document.querySelectorAll(
      ".history-row__checkbox:checked",
    );
    expect(checkedAfterUnselect.length).toBe(0);
  });

  test("renders deleted badge and disables open actions for deleted entry", async () => {
    const { renderHistory } = await import("../history.js");
    renderHistory([
      createEntry({
        id: "deleted",
        isMissing: true,
      }),
    ]);

    const row = document.querySelector(".history-row");
    expect(row.classList.contains("history-row--deleted")).toBe(true);
    expect(row.classList.contains("history-row--error")).toBe(false);
    expect(row.querySelector(".history-row__status")).not.toBeNull();
    expect(row.querySelector(".history-badge--missing").textContent).toContain(
      "удал",
    );
    expect(row.querySelector('[data-action="open-file"]').disabled).toBe(true);
    expect(row.querySelector('[data-action="open-folder"]').disabled).toBe(
      true,
    );
  });

  test("collapses and expands filters with persisted state", async () => {
    const { initHistory } = await import("../history.js");
    const toggle = document.getElementById("history-filters-toggle");
    const body = document.getElementById("history-filters-body");

    initHistory();
    expect(body.hidden).toBe(false);

    toggle.dispatchEvent(new MouseEvent("click", { bubbles: true }));
    expect(body.hidden).toBe(true);
    expect(localStorage.getItem("historyFiltersCollapsed")).toBe("1");

    toggle.dispatchEvent(new MouseEvent("click", { bubbles: true }));
    expect(body.hidden).toBe(false);
    expect(localStorage.getItem("historyFiltersCollapsed")).toBe("0");
  });
});
