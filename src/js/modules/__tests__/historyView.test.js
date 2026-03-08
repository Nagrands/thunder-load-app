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
        <button id="history-header"><span id="total-downloads">0</span></button>
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
          <button id="toggle-all-details" class="history-more-menu__item"></button>
        </div>

        <div class="history-search-filters-card">
          <div class="history-controls-row history-controls-row--primary">
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
              <div id="history-filters-body"></div>
            </div>
          </div>
        </div>
      </div>

      <button id="history-reset-filters"></button>
      <span id="history-active-filters-count" class="hidden"></span>
      <select id="history-source-filter"></select>
      <select id="history-sort-key"></select>
      <select id="history-sort-mode"></select>
      <div id="history-bulk-bar" class="history-bulk-bar hidden"></div>
      <span id="history-selected-count"></span>
      <button id="history-clear-selection"></button>
      <div id="history"></div>
      <div id="history-empty"></div>
    </div>
  `;

  global.window.electron = {
    invoke: jest.fn(),
  };
  global.window.scrollTo = jest.fn();
  global.window.lucide = {
    createIcons: jest.fn(),
    icons: {},
  };

  global.requestAnimationFrame = (cb) => cb();

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
  formattedSize: overrides.formattedSize ?? "10 MB",
  filePath: overrides.filePath ?? "/tmp/video.mp4",
  downloadStatus: overrides.downloadStatus ?? "done",
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

    const actionButtons = actions.querySelectorAll(".history-row__action");
    expect(actionButtons).toHaveLength(3);
    expect(actions.querySelector('[data-lucide="play"]')).not.toBeNull();
    expect(actions.querySelector('[data-lucide="folder-open"]')).not.toBeNull();

    const menu = actions.querySelector(".history-row__menu");
    const menuButton = actions.querySelector(".history-row__menu-button");
    const menuList = actions.querySelector(".history-row__menu-list");

    expect(menu).not.toBeNull();
    expect(menuButton).not.toBeNull();
    expect(menuList).not.toBeNull();
    expect(menu.classList.contains("is-open")).toBe(false);

    menuButton.dispatchEvent(new MouseEvent("click", { bubbles: true }));
    expect(menu.classList.contains("is-open")).toBe(true);
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
    expect(badges.querySelector(".history-row__size")).not.toBeNull();
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
    expect(row.textContent).toContain("Ошибка");
    expect(
      row.querySelector('.history-row__action[title="Открыть файл"]')?.disabled,
    ).toBe(true);
    expect(
      row.querySelector('.history-row__action[title="Открыть папку"]')?.disabled,
    ).toBe(true);

    const toggle = row.querySelector(".history-row__toggle");
    toggle.dispatchEvent(new MouseEvent("click", { bubbles: true }));
    expect(row.textContent).toContain("Нужна авторизация");
  });

  test("retry from row menu scrolls to URL input and focuses it", async () => {
    jest.useFakeTimers();
    const { renderHistory } = await import("../history.js");
    window.electron.invoke.mockResolvedValue(true);

    renderHistory([createEntry()]);

    const menuButton = document.querySelector(".history-row__menu-button");
    menuButton.dispatchEvent(new MouseEvent("click", { bubbles: true }));

    const menuItems = document.querySelectorAll(".history-row__menu-item");
    const retryItem = menuItems[1];
    retryItem.dispatchEvent(new MouseEvent("click", { bubbles: true }));

    const url = document.getElementById("url");

    expect(url.value).toBe("https://example.com/watch?v=1");
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

    expect(badge.classList.contains("hidden")).toBe(true);
    expect(resetBtn.disabled).toBe(true);

    sourceSelect.value = "youtube.com";
    sourceSelect.dispatchEvent(new Event("change", { bubbles: true }));
    sortModeSelect.value = "audio";
    sortModeSelect.dispatchEvent(new Event("change", { bubbles: true }));

    expect(badge.classList.contains("hidden")).toBe(false);
    expect(badge.textContent).toContain("2");
    expect(resetBtn.disabled).toBe(false);

    resetBtn.click();

    expect(sourceSelect.value).toBe("");
    expect(sortKeySelect.value).toBe("date");
    expect(sortModeSelect.value).toBe("mixed");
    expect(badge.classList.contains("hidden")).toBe(true);
    expect(resetBtn.disabled).toBe(true);
  });

  test("renders unified search+filters card with required controls", async () => {
    const unifiedCard = document.querySelector(".history-search-filters-card");
    expect(unifiedCard).not.toBeNull();
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

  test("renders copy controls for source and file detail rows", async () => {
    const { renderHistory } = await import("../history.js");
    const entry = createEntry({
      sourceUrl:
        "https://example.com/very/long/source/path/that/should/be/truncated",
      filePath:
        "/Users/nagrand/Movies/Download/Long/Long/Long/path/to/downloaded/file-name.webm",
    });

    renderHistory([entry]);

    const copyButtons = document.querySelectorAll(".history-row__copy");
    const truncatedValues = document.querySelectorAll(
      ".history-row__details-value--truncate",
    );

    expect(copyButtons).toHaveLength(2);
    expect(truncatedValues.length).toBeGreaterThanOrEqual(2);
  });

  test("renders redesigned details structure including size field", async () => {
    const { renderHistory } = await import("../history.js");
    renderHistory([
      createEntry({
        formattedSize: "74.9 MB",
        resolution: "1920x822",
        fps: 30,
      }),
    ]);

    const row = document.querySelector(".history-row");
    const details = row.querySelector(".history-row__details");
    const preview = details.querySelector(".history-row__preview");
    const meta = details.querySelector(".history-row__details-meta");
    const items = details.querySelectorAll(".history-row__details-item");

    expect(preview).not.toBeNull();
    expect(meta).not.toBeNull();
    expect(items.length).toBeGreaterThanOrEqual(6);
    expect(details.textContent).toContain("74.9 MB");
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
    expect(row.querySelector(".history-badge--missing").textContent).toContain(
      "удал",
    );
    const actions = row.querySelectorAll(".history-row__action");
    expect(actions[0].disabled).toBe(true);
    expect(actions[1].disabled).toBe(true);
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
