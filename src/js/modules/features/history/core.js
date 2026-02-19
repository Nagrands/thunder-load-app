// src/js/modules/history.js

import {
  history,
  historyContainer,
  historyCards,
  historyCardsEmpty,
  historyEmpty,
  historyBulkBar,
  historySelectedCount,
  historyClearSelection,
  totalDownloads,
  filterInput,
  openHistoryButton,
  urlInput,
  downloadButton,
  toggleAllDetailsButton,
} from "../../domElements.js";
import {
  state,
  toggleHistoryVisibility,
  updateButtonState,
  getHistoryData,
  setHistoryData,
} from "../../state.js";
import { setFilterInputValue } from "../../historyFilter.js";
import { updateIcon } from "../../iconUpdater.js";
import { showToast } from "../../toast.js";
import { filterAndSortHistory } from "../../filterAndSortHistory.js";
import { normalizeEntry } from "../../normalizeEntry.js";
import { handleDeleteEntry } from "../../contextMenu.js";
import { initTooltips, disposeAllTooltips } from "../../tooltipInitializer.js";
import { getLanguage, t } from "../../i18n.js";

const RECENT_HISTORY_LIMIT = 8;
const HISTORY_VIRTUALIZATION_MIN_ITEMS = 60;
const HISTORY_VIRTUAL_OVERSCAN_PX = 480;

const HISTORY_IMAGE_PLACEHOLDER = "../assets/img/thumbnail-unavailable.png";
const HISTORY_PAGE_SIZES = [4, 10, 20];
const attemptedPreviewRestores = new Set();

let historyCardsRoot = historyCards;
let historyCardsEmptyRoot = historyCardsEmpty;
let historyEmptyRoot = historyEmpty;
let historyCardPreviewOverlay = null;
let historyCardPreviewImage = null;
let historyCardPreviewCaption = null;
let historyCardPreviewPrev = null;
let historyCardPreviewNext = null;
let historyCardPreviewCounter = null;
let historyPreviewEntries = [];
let historyPreviewIndex = -1;
let historySourceFilterSelect = null;
let historyExportJsonButton = null;
let historyExportCsvButton = null;
let restoreHistoryButton = null;
let historyBulkBarRoot = historyBulkBar;
let historySelectedCountRoot = historySelectedCount;
let historyClearSelectionButton = historyClearSelection;
let paginationRoot = null;
let paginationInfo = null;
let paginationPrev = null;
let paginationNext = null;
let paginationPrevFast = null;
let paginationNextFast = null;
let paginationSize = null;
let historySortKeySelect = null;
let historySortModeSelect = null;
let historyDensityButtons = {
  compact: null,
  comfort: null,
};
let historySelectUIs = {
  source: null,
  pageSize: null,
  sortKey: null,
  sortMode: null,
};
let lastPaginationMeta = {
  page: state.historyPage || 1,
  totalPages: 1,
  totalEntries: 0,
  pageSize: state.historyPageSize || HISTORY_PAGE_SIZES[0],
};
let lastRenderedFiltered = [];
let historyTruncationBound = false;
let historyTruncationResizeTimer = null;
let historyMenuBound = false;
let historyVirtualList = null;

const pluralize = (value, [one, few, many]) => {
  const n = Math.abs(Number(value)) || 0;
  const n10 = n % 10;
  const n100 = n % 100;
  if (n10 === 1 && n100 !== 11) return one;
  if (n10 >= 2 && n10 <= 4 && (n100 < 10 || n100 >= 20)) return few;
  return many;
};

const normalizePageSize = (value) => {
  const n = Number(value);
  if (!Number.isFinite(n) || n <= 0) return HISTORY_PAGE_SIZES[0];
  return Math.max(4, Math.min(200, Math.floor(n)));
};

const normalizeDensity = (value) => {
  const v = String(value || "").toLowerCase();
  if (v === "compact") return "compact";
  if (v === "comfort") return "comfort";
  return "comfort";
};

const applyHistoryDensity = () => {
  const container = document.getElementById("history");
  if (!container) return;
  const density = normalizeDensity(state.historyDensity);
  container.classList.remove("density-compact", "density-comfort");
  container.classList.add(`density-${density}`);
  if (historyDensityButtons.compact) {
    historyDensityButtons.compact.classList.toggle(
      "is-active",
      density === "compact",
    );
  }
  if (historyDensityButtons.comfort) {
    historyDensityButtons.comfort.classList.toggle(
      "is-active",
      density === "comfort",
    );
  }
};

const setHistoryDensity = (value) => {
  const next = normalizeDensity(value);
  if (state.historyDensity === next) return;
  state.historyDensity = next;
  try {
    localStorage.setItem("historyDensity", next);
  } catch {}
  applyHistoryDensity();
};

const syncHistorySelectValues = () => {
  if (historySourceFilterSelect) {
    historySourceFilterSelect.value = state.historySourceFilter || "";
    historySelectUIs.source?.updateLabel?.();
  }
  if (paginationSize) {
    paginationSize.value = String(
      state.historyPageSize || HISTORY_PAGE_SIZES[0],
    );
    historySelectUIs.pageSize?.updateLabel?.();
  }
  if (historySortKeySelect) {
    historySortKeySelect.value = state.currentSortKey || "date";
    historySelectUIs.sortKey?.updateLabel?.();
  }
  if (historySortModeSelect) {
    historySortModeSelect.value = state.currentSortMode || "video";
    historySelectUIs.sortMode?.updateLabel?.();
  }
};

const attachPlaceholderOnError = (img, placeholderSrc, container) => {
  if (!img) return;
  const fallback = placeholderSrc || HISTORY_IMAGE_PLACEHOLDER;
  img.addEventListener("error", () => {
    if (img.dataset.fallbackApplied === "1") return;
    img.dataset.fallbackApplied = "1";
    img.src = fallback;
    if (container) container.classList.add("placeholder");
  });
};

function goToPage(target) {
  const nextPage = Math.max(1, Math.min(target, lastPaginationMeta.totalPages));
  if (nextPage === state.historyPage) return;
  state.historyPage = nextPage;
  filterAndSortHistory(state.currentSearchQuery, state.currentSortOrder, true);
}

function changePageSize(value) {
  const nextSize = normalizePageSize(value);
  if (nextSize === state.historyPageSize) return;
  state.historyPageSize = nextSize;
  state.historyPage = 1;
  try {
    localStorage.setItem("historyPageSize", String(nextSize));
  } catch {}
  filterAndSortHistory(state.currentSearchQuery, state.currentSortOrder, true);
}

function ensurePaginationElements() {
  if (paginationRoot && paginationRoot.isConnected) return;

  paginationRoot = document.createElement("div");
  paginationRoot.id = "history-pagination";
  paginationRoot.className = "history-pagination";
  paginationRoot.innerHTML = `
    <div class="history-page-side history-page-side--left">
      <button
        type="button"
        class="history-action-button history-page-btn"
        id="history-page-prev-fast"
        aria-label="${t("history.pagination.prevFastAria")}"
      >
        <i class="fa-solid fa-angles-left"></i>
      </button>
      <button
        type="button"
        class="history-action-button history-page-btn"
        id="history-page-prev"
        aria-label="${t("history.pagination.prevAria")}"
      >
        <i class="fa-solid fa-chevron-left"></i>
      </button>
    </div>
    <div class="history-page-center">
      <span class="history-page-info" id="history-page-info">
        ${t("history.pagination.info", {
          page: 1,
          total: 1,
          count: 0,
          label: t("history.entry.many"),
        })}
      </span>
      <label class="history-page-size">
        <span>${t("history.pagination.perLabel")}</span>
        <select
          id="history-page-size"
          class="input input-sm history-page-size-select bk-select-init"
          aria-label="${t("history.pagination.perAria")}"
        >
          ${HISTORY_PAGE_SIZES.map((opt) => `<option value="${opt}">${opt}</option>`).join("")}
        </select>
      </label>
    </div>
    <div class="history-page-side history-page-side--right">
      <button
        type="button"
        class="history-action-button history-page-btn"
        id="history-page-next"
        aria-label="${t("history.pagination.nextAria")}"
      >
        <i class="fa-solid fa-chevron-right"></i>
      </button>
      <button
        type="button"
        class="history-action-button history-page-btn"
        id="history-page-next-fast"
        aria-label="${t("history.pagination.nextFastAria")}"
      >
        <i class="fa-solid fa-angles-right"></i>
      </button>
    </div>
  `;

  paginationPrev = paginationRoot.querySelector("#history-page-prev");
  paginationNext = paginationRoot.querySelector("#history-page-next");
  paginationPrevFast = paginationRoot.querySelector("#history-page-prev-fast");
  paginationNextFast = paginationRoot.querySelector("#history-page-next-fast");
  paginationInfo = paginationRoot.querySelector("#history-page-info");
  paginationSize = paginationRoot.querySelector("#history-page-size");
  if (!historySelectUIs.pageSize) {
    historySelectUIs.pageSize = enhanceSelect(paginationSize);
  }

  paginationPrev?.addEventListener("click", () =>
    goToPage(state.historyPage - 1),
  );
  paginationNext?.addEventListener("click", () =>
    goToPage(state.historyPage + 1),
  );
  paginationPrevFast?.addEventListener("click", () =>
    goToPage(state.historyPage - 5),
  );
  paginationNextFast?.addEventListener("click", () =>
    goToPage(state.historyPage + 5),
  );
  paginationSize?.addEventListener("change", (e) =>
    changePageSize(e.target.value),
  );

  const host = historyContainer || history?.parentElement || document.body;
  host.appendChild(paginationRoot);
}

function updatePaginationControls(meta) {
  ensurePaginationElements();
  lastPaginationMeta = {
    page: meta.page,
    totalPages: meta.totalPages,
    totalEntries: meta.totalEntries,
    pageSize: meta.pageSize,
  };

  if (paginationInfo) {
    const lang = getLanguage();
    const countLabel =
      lang === "ru"
        ? pluralize(meta.totalEntries, [
            t("history.entry.one"),
            t("history.entry.few"),
            t("history.entry.many"),
          ])
        : meta.totalEntries === 1
          ? t("history.entry.one")
          : t("history.entry.many");
    paginationInfo.textContent = t("history.pagination.info", {
      page: meta.page,
      total: meta.totalPages,
      count: meta.totalEntries,
      label: countLabel,
    });
  }
  if (paginationPrev) {
    paginationPrev.disabled = meta.page <= 1;
    paginationPrev.setAttribute("aria-disabled", paginationPrev.disabled);
  }
  if (paginationNext) {
    paginationNext.disabled = meta.page >= meta.totalPages;
    paginationNext.setAttribute("aria-disabled", paginationNext.disabled);
  }
  if (paginationPrevFast) {
    paginationPrevFast.disabled = meta.page <= 1;
    paginationPrevFast.setAttribute(
      "aria-disabled",
      paginationPrevFast.disabled,
    );
  }
  if (paginationNextFast) {
    paginationNextFast.disabled = meta.page >= meta.totalPages;
    paginationNextFast.setAttribute(
      "aria-disabled",
      paginationNextFast.disabled,
    );
  }
  if (paginationSize) {
    if (!HISTORY_PAGE_SIZES.includes(meta.pageSize)) {
      const opt = document.createElement("option");
      opt.value = String(meta.pageSize);
      opt.textContent = meta.pageSize;
      paginationSize.appendChild(opt);
    }
    paginationSize.value = String(meta.pageSize);
    historySelectUIs.pageSize?.rebuild?.();
    historySelectUIs.pageSize?.updateLabel?.();
  }

  if (paginationRoot) {
    paginationRoot.style.display = meta.totalEntries > 0 ? "flex" : "none";
  }
}

function ensureHistoryCardsElements() {
  if (!historyCardsRoot || !historyCardsRoot.isConnected) {
    historyCardsRoot = document.getElementById("history-cards");
  }
  if (!historyCardsEmptyRoot || !historyCardsEmptyRoot.isConnected) {
    historyCardsEmptyRoot = document.getElementById("history-cards-empty");
  }
  if (historyCardsRoot && historyCardsEmptyRoot) return;

  let area = document.querySelector(".history-cards-area");
  if (!area) {
    area = document.createElement("div");
    area.className = "history-cards-area";
    area.setAttribute("aria-live", "polite");
    area.innerHTML = `
      <div class="history-cards-header">
        <div>
          <p class="history-cards-subtitle" data-i18n="history.cards.subtitle">
            ${t("history.cards.subtitle")}
          </p>
          <h3 class="history-cards-title" data-i18n="history.cards.title">
            ${t("history.cards.title")}
          </h3>
        </div>
        <div class="history-toolbar__controls history-cards-search history-actions">
          <div class="history-search-wrapper history-input-wrapper">
            <i id="icon-filter-search" class="fas fa-search search-icon"></i>
            <input
              type="text"
              id="filter-input"
              placeholder="${t("history.search.placeholder")}"
              data-i18n-placeholder="history.search.placeholder"
              aria-label="${t("history.search.aria")}"
              data-i18n-aria="history.search.aria"
            />
            <button
              id="clear-filter-input"
              class="history-action-button"
              data-bs-toggle="tooltip"
              data-bs-placement="top"
              title="${t("history.search.clearHint")}"
              data-i18n-title="history.search.clearHint"
            >
              &times;
            </button>
          </div>
          <div class="history-actions-primary">
            <button
              id="history-header"
              class="history-action-button history-count-pill"
              data-bs-toggle="tooltip"
              data-bs-placement="top"
              title="${t("history.count")}"
              data-i18n-title="history.count"
            >
              <span id="total-downloads">0</span>
            </button>
            <button
              id="refresh-button"
              class="history-action-button"
              data-bs-toggle="tooltip"
              data-bs-placement="top"
              title="${t("history.refresh")}"
              data-i18n-title="history.refresh"
            >
              <i class="fa-solid fa-arrow-rotate-right"></i>
            </button>
            <button
              id="sort-button"
              class="history-action-button"
              data-bs-toggle="tooltip"
              data-bs-placement="top"
              title="${t("history.sort")}"
              data-i18n-title="history.sort"
            >
              <i class="fa-solid"></i>
            </button>
            <div
              class="history-density-group"
              role="group"
              aria-label="${t("history.density.label")}"
              data-i18n-aria="history.density.label"
            >
              <button
                id="history-density-compact"
                type="button"
                class="history-density-btn"
                data-density="compact"
                data-bs-toggle="tooltip"
                data-bs-placement="top"
                title="${t("history.density.compact")}"
                data-i18n-title="history.density.compact"
              >
                <i class="fa-solid fa-compress"></i>
              </button>
              <button
                id="history-density-regular"
                type="button"
                class="history-density-btn"
                data-density="regular"
                data-bs-toggle="tooltip"
                data-bs-placement="top"
                title="${t("history.density.regular")}"
                data-i18n-title="history.density.regular"
              >
                <i class="fa-solid fa-grip-lines"></i>
              </button>
              <button
                id="history-density-comfort"
                type="button"
                class="history-density-btn"
                data-density="comfort"
                data-bs-toggle="tooltip"
                data-bs-placement="top"
                title="${t("history.density.comfort")}"
                data-i18n-title="history.density.comfort"
              >
                <i class="fa-solid fa-expand"></i>
              </button>
            </div>
          </div>
          <div class="history-actions-secondary">
            <button
              id="clear-history"
              class="history-action-button"
              data-bs-toggle="tooltip"
              data-bs-placement="top"
              title="${t("history.clear")}"
              data-i18n-title="history.clear"
            >
              <i class="fa-solid fa-trash"></i>
            </button>
            <button
              id="delete-selected"
              class="history-action-button hidden"
              data-bs-toggle="tooltip"
              data-bs-placement="top"
              title="${t("history.deleteSelected")}"
              data-i18n-title="history.deleteSelected"
            >
              <i class="fa-solid fa-trash-can"></i>
            </button>
          </div>
        </div>
      </div>
      <div id="history-cards" class="history-card-grid" role="list"></div>
      <div id="history-cards-empty" class="history-cards-empty">
        <span data-i18n="history.empty.noRecent">
          ${t("history.empty.noRecent")}
        </span>
      </div>
    `;
    const container =
      historyContainer || document.getElementById("history-container");
    if (container) {
      const listAnchor = container.querySelector("#history");
      if (listAnchor) container.insertBefore(area, listAnchor);
      else container.appendChild(area);
    } else {
      document.body.appendChild(area);
    }
  }
  historyCardsRoot = area.querySelector("#history-cards");
  historyCardsEmptyRoot = area.querySelector("#history-cards-empty");
}

function ensureHistoryEmptyElement() {
  if (!historyEmptyRoot || !historyEmptyRoot.isConnected) {
    historyEmptyRoot = document.getElementById("history-empty");
  }
}

// Универсальный кастомный селект (общий стиль с Backup)
function enhanceSelect(selectEl) {
  if (!selectEl || selectEl.dataset.enhanced === "true") return null;
  selectEl.dataset.enhanced = "true";

  const wrapper = document.createElement("div");
  wrapper.className = "bk-select-wrapper";

  const trigger = document.createElement("button");
  trigger.type = "button";
  trigger.className = "bk-select-trigger";
  const labelEl = document.createElement("span");
  labelEl.className = "bk-select-label";
  const labelIcon = document.createElement("i");
  labelIcon.className = "bk-select-label-icon";
  const labelText = document.createElement("span");
  labelText.className = "bk-select-label-text";
  labelEl.append(labelIcon, labelText);
  const icon = document.createElement("i");
  icon.className = "fa-solid fa-chevron-down";
  trigger.append(labelEl, icon);

  const menu = document.createElement("div");
  menu.className = "bk-select-menu";
  menu.hidden = true;

  const updateLabel = () => {
    const opt =
      selectEl.selectedOptions && selectEl.selectedOptions[0]
        ? selectEl.selectedOptions[0]
        : selectEl.options[selectEl.selectedIndex];
    const iconClass = opt?.dataset?.icon || "";
    if (iconClass) {
      labelIcon.className = `bk-select-label-icon ${iconClass}`;
      labelIcon.style.display = "";
    } else {
      labelIcon.className = "bk-select-label-icon";
      labelIcon.style.display = "none";
    }
    labelText.textContent = opt ? opt.textContent : "";
    menu
      .querySelectorAll(".bk-select-option")
      .forEach((item) =>
        item.classList.toggle(
          "is-active",
          item.dataset.value === selectEl.value,
        ),
      );
  };

  const rebuild = () => {
    menu.innerHTML = "";
    Array.from(selectEl.options).forEach((opt) => {
      const item = document.createElement("button");
      item.type = "button";
      item.className = "bk-select-option";
      item.dataset.value = opt.value;
      const itemIcon = document.createElement("i");
      itemIcon.className = "bk-select-option-icon";
      if (opt.dataset.icon) {
        itemIcon.className = `bk-select-option-icon ${opt.dataset.icon}`;
      } else {
        itemIcon.style.display = "none";
      }
      const itemText = document.createElement("span");
      itemText.className = "bk-select-option-text";
      itemText.textContent = opt.textContent;
      item.append(itemIcon, itemText);
      item.addEventListener("click", () => {
        if (selectEl.value !== opt.value) {
          selectEl.value = opt.value;
          selectEl.dispatchEvent(new Event("change", { bubbles: true }));
        }
        updateLabel();
        menu.hidden = true;
        wrapper.classList.remove("is-open");
      });
      menu.appendChild(item);
    });
    updateLabel();
  };

  const closeAll = (e) => {
    if (e && wrapper.contains(e.target)) return;
    menu.hidden = true;
    wrapper.classList.remove("is-open");
  };

  trigger.addEventListener("click", (e) => {
    e.stopPropagation();
    const willOpen = menu.hidden;
    document
      .querySelectorAll(".bk-select-wrapper.is-open .bk-select-menu")
      .forEach((m) => {
        m.hidden = true;
        m.parentElement?.classList.remove("is-open");
      });
    if (willOpen) {
      menu.hidden = false;
      wrapper.classList.add("is-open");
    } else {
      closeAll();
    }
  });

  document.addEventListener("mousedown", closeAll);
  document.addEventListener("focusin", closeAll);
  trigger.addEventListener("keydown", (e) => {
    if (e.key === "Escape") closeAll();
    if (e.key === "ArrowDown" || e.key === "ArrowUp") {
      e.preventDefault();
      menu.hidden = false;
      wrapper.classList.add("is-open");
    }
  });

  selectEl.classList.add("bk-select-hidden");
  selectEl.parentNode.insertBefore(wrapper, selectEl);
  wrapper.append(trigger, selectEl, menu);
  rebuild();

  return { rebuild, updateLabel };
}

function ensureHistoryControlElements() {
  if (!historySourceFilterSelect || !historySourceFilterSelect.isConnected) {
    historySourceFilterSelect = document.getElementById(
      "history-source-filter",
    );
  }
  if (!historyExportJsonButton || !historyExportJsonButton.isConnected) {
    historyExportJsonButton = document.getElementById("history-export-json");
  }
  if (!historyExportCsvButton || !historyExportCsvButton.isConnected) {
    historyExportCsvButton = document.getElementById("history-export-csv");
  }
  if (!restoreHistoryButton || !restoreHistoryButton.isConnected) {
    restoreHistoryButton = document.getElementById("restore-history");
  }
  if (!historyBulkBarRoot || !historyBulkBarRoot.isConnected) {
    historyBulkBarRoot = document.getElementById("history-bulk-bar");
  }
  if (!historySelectedCountRoot || !historySelectedCountRoot.isConnected) {
    historySelectedCountRoot = document.getElementById(
      "history-selected-count",
    );
  }
  if (
    !historyClearSelectionButton ||
    !historyClearSelectionButton.isConnected
  ) {
    historyClearSelectionButton = document.getElementById(
      "history-clear-selection",
    );
  }
  if (!historySortKeySelect || !historySortKeySelect.isConnected) {
    historySortKeySelect = document.getElementById("history-sort-key");
  }
  if (!historySortModeSelect || !historySortModeSelect.isConnected) {
    historySortModeSelect = document.getElementById("history-sort-mode");
  }
  if (
    !historyDensityButtons.compact ||
    !historyDensityButtons.compact.isConnected
  ) {
    historyDensityButtons.compact = document.getElementById(
      "history-density-compact",
    );
  }
  if (
    !historyDensityButtons.comfort ||
    !historyDensityButtons.comfort.isConnected
  ) {
    historyDensityButtons.comfort = document.getElementById(
      "history-density-comfort",
    );
  }

  if (!historySelectUIs.source) {
    historySelectUIs.source = enhanceSelect(historySourceFilterSelect);
  }
  if (!historySelectUIs.sortKey) {
    historySelectUIs.sortKey = enhanceSelect(historySortKeySelect);
  }
  if (!historySelectUIs.sortMode) {
    historySelectUIs.sortMode = enhanceSelect(historySortModeSelect);
  }
}

function ensureHistoryCardPreviewOverlay() {
  if (historyCardPreviewOverlay) return historyCardPreviewOverlay;

  const overlay = document.createElement("div");
  overlay.className = "history-card-preview-overlay hidden";
  overlay.setAttribute("role", "dialog");
  overlay.setAttribute("aria-modal", "true");
  overlay.setAttribute("aria-hidden", "true");
  overlay.setAttribute("aria-label", t("history.preview.overlayLabel"));
  overlay.setAttribute("data-i18n-aria", "history.preview.overlayLabel");
  overlay.tabIndex = -1;
  overlay.innerHTML = `
    <div class="history-card-preview-dialog" role="document">
      <button
        type="button"
        class="history-card-preview-close"
        aria-label="${t("history.preview.close")}"
        data-i18n-aria="history.preview.close"
      >
        <i class="fa-solid fa-xmark"></i>
      </button>
      <button
        type="button"
        class="history-card-preview-nav history-card-preview-prev"
        aria-label="${t("history.preview.prev")}"
        data-i18n-aria="history.preview.prev"
      >
        <i class="fa-solid fa-chevron-left"></i>
      </button>
      <button
        type="button"
        class="history-card-preview-nav history-card-preview-next"
        aria-label="${t("history.preview.next")}"
        data-i18n-aria="history.preview.next"
      >
        <i class="fa-solid fa-chevron-right"></i>
      </button>
      <img class="history-card-preview-image" alt="" />
      <div class="history-card-preview-counter"></div>
      <p class="history-card-preview-caption"></p>
    </div>
  `;

  const closeBtn = overlay.querySelector(".history-card-preview-close");
  const prevBtn = overlay.querySelector(".history-card-preview-prev");
  const nextBtn = overlay.querySelector(".history-card-preview-next");
  closeBtn.addEventListener("click", closeHistoryCardPreview);
  prevBtn.addEventListener("click", () => openHistoryPreviewRelative(-1));
  nextBtn.addEventListener("click", () => openHistoryPreviewRelative(1));
  overlay.addEventListener("click", (event) => {
    if (event.target === overlay) {
      closeHistoryCardPreview();
    }
  });

  document.addEventListener("keydown", (event) => {
    if (
      event.key === "Escape" &&
      historyCardPreviewOverlay &&
      !historyCardPreviewOverlay.classList.contains("hidden")
    ) {
      closeHistoryCardPreview();
    }
    if (
      event.key === "ArrowLeft" &&
      historyCardPreviewOverlay &&
      !historyCardPreviewOverlay.classList.contains("hidden")
    ) {
      openHistoryPreviewRelative(-1);
    }
    if (
      event.key === "ArrowRight" &&
      historyCardPreviewOverlay &&
      !historyCardPreviewOverlay.classList.contains("hidden")
    ) {
      openHistoryPreviewRelative(1);
    }
  });

  historyCardPreviewOverlay = overlay;
  historyCardPreviewImage = overlay.querySelector(
    ".history-card-preview-image",
  );
  historyCardPreviewCaption = overlay.querySelector(
    ".history-card-preview-caption",
  );
  historyCardPreviewCounter = overlay.querySelector(
    ".history-card-preview-counter",
  );
  historyCardPreviewPrev = overlay.querySelector(".history-card-preview-prev");
  historyCardPreviewNext = overlay.querySelector(".history-card-preview-next");

  document.body.appendChild(overlay);
  return overlay;
}

function updateRestoreButton() {
  ensureHistoryControlElements();
  if (!restoreHistoryButton) return;
  const hasBuffer =
    Array.isArray(state.deletedHistoryBuffer) &&
    state.deletedHistoryBuffer.length > 0;
  restoreHistoryButton.disabled = !hasBuffer;
  restoreHistoryButton.classList.toggle("hidden", !hasBuffer);
}

function buildFilterOptions(entries = []) {
  ensureHistoryControlElements();
  const hosts = new Set();
  entries.forEach((entry) => {
    const host = detectHost(entry.sourceUrl);
    if (host) hosts.add(host);
  });

  const applyOptions = (select, values, placeholder) => {
    if (!select) return;
    const current = select.value;
    select.innerHTML = "";
    const base = document.createElement("option");
    base.value = "";
    base.textContent = placeholder;
    select.appendChild(base);
    Array.from(values)
      .sort((a, b) => a.localeCompare(b))
      .forEach((value) => {
        const opt = document.createElement("option");
        opt.value = value;
        opt.textContent = value;
        select.appendChild(opt);
      });
    if (current && !values.has(current)) {
      const opt = document.createElement("option");
      opt.value = current;
      opt.textContent = current;
      select.appendChild(opt);
    }
    select.value = current || "";

    const ui =
      select === historySourceFilterSelect
        ? historySelectUIs.source
        : select === paginationSize
          ? historySelectUIs.pageSize
          : null;
    ui?.rebuild?.();
    ui?.updateLabel?.();
  };

  applyOptions(
    historySourceFilterSelect,
    hosts,
    t("history.filter.source.all"),
  );
  syncHistorySelectValues();
}

function updatePreviewNavState() {
  if (!historyCardPreviewPrev || !historyCardPreviewNext) return;
  const hasList = Array.isArray(historyPreviewEntries);
  const total = hasList ? historyPreviewEntries.length : 0;
  const hasPrev = total > 1 && historyPreviewIndex > 0;
  const hasNext = total > 1 && historyPreviewIndex < total - 1;
  historyCardPreviewPrev.disabled = !hasPrev;
  historyCardPreviewNext.disabled = !hasNext;
  if (historyCardPreviewCounter) {
    if (total > 1 && historyPreviewIndex >= 0) {
      historyCardPreviewCounter.textContent = `${historyPreviewIndex + 1} / ${total}`;
    } else {
      historyCardPreviewCounter.textContent = "";
    }
  }
}

function openHistoryPreviewRelative(delta) {
  if (!Array.isArray(historyPreviewEntries) || !historyPreviewEntries.length)
    return;
  const nextIndex = historyPreviewIndex + delta;
  if (nextIndex < 0 || nextIndex >= historyPreviewEntries.length) return;
  const entry = historyPreviewEntries[nextIndex];
  historyPreviewIndex = nextIndex;
  const src = entry?.thumbnail || "";
  if (!src) return;
  const title = entry?.fileName || entry?.sourceUrl || t("preview.alt");
  historyCardPreviewImage.src = src;
  historyCardPreviewImage.alt = title;
  historyCardPreviewCaption.textContent = title;
  updatePreviewNavState();
}

function openHistoryCardPreview(src, title = "", entry = null) {
  if (!src) return;
  const overlay = ensureHistoryCardPreviewOverlay();
  historyCardPreviewImage.src = src;
  historyCardPreviewImage.alt = title || t("preview.alt");
  historyCardPreviewCaption.textContent = title || "";
  overlay.classList.remove("hidden");
  overlay.setAttribute("aria-hidden", "false");
  overlay.classList.add("is-open");
  overlay.focus();

  if (entry) {
    historyPreviewEntries = Array.isArray(lastRenderedFiltered)
      ? lastRenderedFiltered
      : [];
    historyPreviewIndex = historyPreviewEntries.findIndex(
      (item) => item?.id === entry?.id,
    );
  } else {
    historyPreviewEntries = [];
    historyPreviewIndex = -1;
  }
  updatePreviewNavState();
}

function closeHistoryCardPreview() {
  if (!historyCardPreviewOverlay) return;
  historyCardPreviewOverlay.classList.add("hidden");
  historyCardPreviewOverlay.classList.remove("is-open");
  historyCardPreviewOverlay.setAttribute("aria-hidden", "true");
  if (historyCardPreviewImage) historyCardPreviewImage.src = "";
  historyPreviewEntries = [];
  historyPreviewIndex = -1;
}

async function openHistorySourceLink(url) {
  if (!url) {
    showToast(t("history.toast.sourceUnavailable"), "warning");
    return;
  }
  try {
    await window.electron.invoke("open-external-link", url);
  } catch (error) {
    console.error("Ошибка открытия источника:", error);
    showToast(t("history.toast.sourceOpenError"), "error");
  }
}

async function copyHistoryValue(value) {
  const text = String(value || "").trim();
  if (!text) return;

  try {
    if (navigator?.clipboard?.writeText) {
      await navigator.clipboard.writeText(text);
    } else {
      const textarea = document.createElement("textarea");
      textarea.value = text;
      textarea.setAttribute("readonly", "");
      textarea.style.position = "absolute";
      textarea.style.left = "-9999px";
      document.body.appendChild(textarea);
      textarea.select();
      document.execCommand?.("copy");
      document.body.removeChild(textarea);
    }
    showToast(t("history.toast.copySuccess"), "success");
  } catch (error) {
    console.warn("Не удалось скопировать значение истории:", error);
    showToast(t("history.toast.copyError"), "error");
  }
}

function _showFilterInput() {
  filterInput.classList.remove("hidden");
  filterInput.style.display = "block";
}

function clearHistoryContainer(container) {
  if (!container) return;
  container.innerHTML = "";
}

function destroyHistoryVirtualList() {
  if (!historyVirtualList) return;
  try {
    historyVirtualList.destroy?.();
  } catch (error) {
    console.warn("Не удалось остановить виртуализацию истории:", error);
  }
  historyVirtualList = null;
}

function createHistoryGroupElement(entry) {
  const entryDate = normalizeEntryDate(entry);
  const group = document.createElement("div");
  group.className = "history-group";
  const left = `<span class="history-group__title">${escapeHtml(
    getDayLabel(entryDate),
  )}</span>`;
  const sourceLabel = formatSourceLabel(entry.sourceUrl);
  const sourceIcon = getSourceIconClass(entry.sourceUrl);
  const right =
    state.currentSortKey === "source"
      ? `<span class="history-group__source">${
          sourceIcon ? `<i class="${sourceIcon}"></i>` : ""
        }${escapeHtml(sourceLabel)}</span>`
      : "";
  group.innerHTML = `${left}${right}`;
  return group;
}

function estimateVirtualItemHeight(type) {
  if (type === "group") return 42;
  if (state.historyDetailsExpanded) {
    const density = normalizeDensity(state.historyDensity);
    if (density === "compact") return 290;
    if (density === "comfort") return 340;
    return 320;
  }
  const density = normalizeDensity(state.historyDensity);
  if (density === "compact") return 88;
  if (density === "comfort") return 124;
  return 104;
}

function buildVirtualHistoryItems(entries = []) {
  const items = [];
  let lastGroupKey = null;
  entries.forEach((entry) => {
    const entryDate = normalizeEntryDate(entry);
    const groupKey = getDayKey(entryDate);
    if (groupKey !== lastGroupKey) {
      lastGroupKey = groupKey;
      items.push({
        type: "group",
        key: `group:${groupKey}`,
        entry,
        height: estimateVirtualItemHeight("group"),
      });
    }
    items.push({
      type: "entry",
      key: `entry:${entry?.id ?? entry?.filePath ?? Math.random()}`,
      entry,
      height: estimateVirtualItemHeight("entry"),
    });
  });
  return items;
}

function binarySearchPrefix(prefix, value) {
  let low = 0;
  let high = prefix.length - 1;
  while (low < high) {
    const mid = Math.floor((low + high + 1) / 2);
    if (prefix[mid] <= value) {
      low = mid;
    } else {
      high = mid - 1;
    }
  }
  return low;
}

function renderHistoryVirtualized(container, entries = []) {
  const items = buildVirtualHistoryItems(entries);
  const topSpacer = document.createElement("div");
  topSpacer.className = "history-virtual-spacer history-virtual-spacer--top";
  topSpacer.setAttribute("aria-hidden", "true");

  const windowRoot = document.createElement("div");
  windowRoot.className = "history-virtual-window";

  const bottomSpacer = document.createElement("div");
  bottomSpacer.className =
    "history-virtual-spacer history-virtual-spacer--bottom";
  bottomSpacer.setAttribute("aria-hidden", "true");

  container.append(topSpacer, windowRoot, bottomSpacer);

  let prefix = [];
  let totalHeight = 0;
  const rebuildPrefix = () => {
    prefix = new Array(items.length + 1);
    prefix[0] = 0;
    for (let i = 0; i < items.length; i += 1) {
      prefix[i + 1] = prefix[i] + (items[i].height || 0);
    }
    totalHeight = prefix[prefix.length - 1] || 0;
  };
  rebuildPrefix();

  let currentStart = -1;
  let currentEnd = -1;
  let scrollFrame = null;

  const renderRange = () => {
    scrollFrame = null;
    const rect = container.getBoundingClientRect();
    const viewportHeight =
      window.innerHeight || document.documentElement.clientHeight || 900;
    const offsetInContainer = Math.max(0, -rect.top);
    const visibleStartPx = Math.max(
      0,
      offsetInContainer - HISTORY_VIRTUAL_OVERSCAN_PX,
    );
    const visibleEndPx = Math.max(
      visibleStartPx,
      Math.min(
        totalHeight,
        offsetInContainer + viewportHeight + HISTORY_VIRTUAL_OVERSCAN_PX,
      ),
    );

    const start = Math.max(
      0,
      Math.min(items.length, binarySearchPrefix(prefix, visibleStartPx)),
    );
    const end = Math.max(
      start,
      Math.min(items.length, binarySearchPrefix(prefix, visibleEndPx) + 1),
    );

    if (start === currentStart && end === currentEnd) return;
    currentStart = start;
    currentEnd = end;

    topSpacer.style.height = `${prefix[start]}px`;
    bottomSpacer.style.height = `${Math.max(0, totalHeight - prefix[end])}px`;

    const fragment = document.createDocumentFragment();
    for (let i = start; i < end; i += 1) {
      const item = items[i];
      if (item.type === "group") {
        const group = createHistoryGroupElement(item.entry);
        group.dataset.virtualIndex = String(i);
        fragment.appendChild(group);
        continue;
      }
      const { el } = createLogEntry(item.entry);
      el.dataset.virtualIndex = String(i);
      fragment.appendChild(el);
    }
    windowRoot.innerHTML = "";
    windowRoot.appendChild(fragment);

    attachDeleteListeners();
    requestAnimationFrame(() => {
      updateTitleTruncation();
      initTooltips();
      updateToggleAllButtonState();
    });

    let measuredChanged = false;
    windowRoot.childNodes.forEach((node) => {
      if (!(node instanceof HTMLElement)) return;
      const index = Number(node.dataset.virtualIndex);
      if (!Number.isFinite(index) || index < 0 || index >= items.length) return;
      const measured = Math.ceil(node.getBoundingClientRect().height || 0);
      if (!measured) return;
      if (Math.abs((items[index].height || 0) - measured) < 2) return;
      items[index].height = measured;
      measuredChanged = true;
    });
    if (measuredChanged) {
      rebuildPrefix();
      topSpacer.style.height = `${prefix[start]}px`;
      bottomSpacer.style.height = `${Math.max(0, totalHeight - prefix[end])}px`;
      scheduleRender();
    }
  };

  const scheduleRender = () => {
    if (scrollFrame) return;
    scrollFrame = requestAnimationFrame(renderRange);
  };

  window.addEventListener("scroll", scheduleRender, { passive: true });
  window.addEventListener("resize", scheduleRender, { passive: true });
  windowRoot.addEventListener("load", scheduleRender, true);
  renderRange();

  return {
    enabled: true,
    requestRender: scheduleRender,
    destroy() {
      if (scrollFrame) {
        cancelAnimationFrame(scrollFrame);
        scrollFrame = null;
      }
      window.removeEventListener("scroll", scheduleRender);
      window.removeEventListener("resize", scheduleRender);
      windowRoot.removeEventListener("load", scheduleRender, true);
    },
  };
}

function syncSelectedEntriesWith(entries = []) {
  const availableIds = new Set(
    entries.map((entry) => entry?.id?.toString?.() || "").filter(Boolean),
  );
  state.selectedEntries = (state.selectedEntries || []).filter((id) =>
    availableIds.has(String(id)),
  );
}

function updateDeleteSelectedButton() {
  const clearBtn = document.getElementById("clear-history");
  const deleteBtn = document.getElementById("delete-selected");
  ensureHistoryControlElements();
  const selectedCount = state.selectedEntries.length;

  if (!clearBtn || !deleteBtn) return;

  if (historyBulkBarRoot) {
    historyBulkBarRoot.classList.toggle("hidden", selectedCount === 0);
  }
  if (historySelectedCountRoot) {
    historySelectedCountRoot.textContent = String(selectedCount);
  }

  if (selectedCount > 0) {
    clearBtn.classList.add("hidden");
    deleteBtn.classList.remove("hidden");
  } else {
    clearBtn.classList.remove("hidden");
    deleteBtn.classList.add("hidden");
  }
}

function clearHistorySelection() {
  state.selectedEntries = [];
  state.lastSelectedId = null;
  document.querySelectorAll(".history-row__checkbox").forEach((checkbox) => {
    checkbox.checked = false;
  });
  document
    .querySelectorAll(".log-entry.selected")
    .forEach((el) => el.classList.remove("selected"));
  updateDeleteSelectedButton();
}

function toggleAllHistoryDetails(forceState = null) {
  const rows = Array.from(document.querySelectorAll(".log-entry.history-row"));
  if (!rows.length) return;

  const shouldOpen =
    typeof forceState === "boolean"
      ? forceState
      : rows.some((row) => !row.classList.contains("is-open"));

  rows.forEach((row) => {
    const details = row.querySelector(".history-row__details");
    const toggle = row.querySelector(".history-row__toggle");
    if (!details || !toggle) return;
    row.classList.toggle("is-open", shouldOpen);
    details.classList.toggle("is-open", shouldOpen);
    toggle.setAttribute("aria-expanded", shouldOpen ? "true" : "false");
    const label = shouldOpen
      ? t("history.details.collapse")
      : t("history.details.expand");
    toggle.setAttribute("aria-label", label);
    toggle.title = label;
  });

  if (toggleAllDetailsButton) {
    toggleAllDetailsButton.classList.toggle("is-open", shouldOpen);
    const label = shouldOpen
      ? t("history.details.collapseAll")
      : t("history.details.expandAll");
    toggleAllDetailsButton.setAttribute("aria-label", label);
    toggleAllDetailsButton.setAttribute("data-hint", label);
    toggleAllDetailsButton.title = label;
  }
  state.historyDetailsExpanded = shouldOpen;
  try {
    localStorage.setItem("historyDetailsExpanded", String(shouldOpen));
  } catch {}
  historyVirtualList?.requestRender?.();
}

function updateTitleTruncation() {
  const rows = document.querySelectorAll(".history-row");
  rows.forEach((row) => {
    const name = row.querySelector(".history-row__name");
    if (!name) return;
    const isTruncated = name.scrollWidth > name.clientWidth + 1;
    row.classList.toggle("is-title-truncated", isTruncated);
  });
}

function updateToggleAllButtonState() {
  if (!toggleAllDetailsButton) return;
  const rows = Array.from(document.querySelectorAll(".log-entry.history-row"));
  if (!rows.length) {
    toggleAllDetailsButton.classList.remove("is-open");
    const label = t("history.details.expandAll");
    toggleAllDetailsButton.setAttribute("aria-label", label);
    toggleAllDetailsButton.setAttribute("data-hint", label);
    toggleAllDetailsButton.title = label;
    return;
  }
  const allOpen = rows.every((row) => row.classList.contains("is-open"));
  toggleAllDetailsButton.classList.toggle("is-open", allOpen);
  const label = allOpen
    ? t("history.details.collapseAll")
    : t("history.details.expandAll");
  toggleAllDetailsButton.setAttribute("aria-label", label);
  toggleAllDetailsButton.setAttribute("data-hint", label);
  toggleAllDetailsButton.title = label;
  state.historyDetailsExpanded = allOpen;
  try {
    localStorage.setItem("historyDetailsExpanded", String(allOpen));
  } catch {}
}

function closeAllHistoryMenus(except = null) {
  document.querySelectorAll(".history-row__menu.is-open").forEach((menu) => {
    if (except && menu === except) return;
    menu.classList.remove("is-open");
    menu.classList.remove("is-open-up");
    const trigger = menu.querySelector(".history-row__menu-button");
    if (trigger) trigger.setAttribute("aria-expanded", "false");
    const menuList = menu.querySelector(".history-row__menu-list");
    if (menuList) {
      menuList.style.visibility = "";
    }
    const row = menu.closest(".history-row");
    if (row) row.classList.remove("is-menu-open");
  });
}

function bindHistoryMenuClose() {
  if (historyMenuBound) return;
  historyMenuBound = true;
  document.addEventListener("click", (event) => {
    if (event.target.closest(".history-row__menu")) return;
    closeAllHistoryMenus();
  });
  document.addEventListener("keydown", (event) => {
    if (event.key === "Escape") closeAllHistoryMenus();
  });
}

const detectHost = (url = "") => {
  if (!url) return "";
  try {
    return new URL(url).hostname.replace(/^www\./, "");
  } catch (_) {
    return "";
  }
};

const formatSourceLabel = (url = "") => {
  const host = detectHost(url);
  if (!host) return "";
  const map = new Map([
    ["youtube.com", "YouTube"],
    ["youtu.be", "YouTube"],
    ["music.youtube.com", "YouTube Music"],
    ["twitch.tv", "Twitch"],
    ["vkvideo.ru", "VK Video"],
    ["vk.com", "VK"],
    ["vimeo.com", "Vimeo"],
    ["rutube.ru", "RuTube"],
    ["reddit.com", "Reddit"],
    ["old.reddit.com", "Reddit"],
    ["redd.it", "Reddit"],
  ]);
  if (map.has(host)) return map.get(host);
  const main = host.split(".")[0] || host;
  return main.charAt(0).toUpperCase() + main.slice(1);
};

const getSourceIconClass = (url = "") => {
  const host = detectHost(url);
  if (!host) return "";
  if (
    host === "youtube.com" ||
    host === "youtu.be" ||
    host === "music.youtube.com"
  ) {
    return "fa-brands fa-youtube";
  }
  if (host === "twitch.tv") return "fa-brands fa-twitch";
  if (host === "vkvideo.ru" || host === "vk.com") return "fa-brands fa-vk";
  if (
    host === "reddit.com" ||
    host === "old.reddit.com" ||
    host === "redd.it"
  ) {
    return "fa-brands fa-reddit";
  }
  return "";
};

const isAudioEntry = (entry) => {
  const quality = entry?.quality || entry?.resolution || entry?.format || "";
  return /audio/i.test(quality) || /audio only/i.test(quality);
};

const isCacheableThumbnailUrl = (url) =>
  typeof url === "string" &&
  (url.startsWith("http://") ||
    url.startsWith("https://") ||
    url.startsWith("data:"));

const isFileUrl = (url) =>
  typeof url === "string" && url.toLowerCase().startsWith("file://");

const fileUrlToPath = (url) => {
  if (!isFileUrl(url)) return "";
  try {
    return decodeURI(url.replace(/^file:\/\//i, ""));
  } catch {
    return "";
  }
};

const filePathToUrl = (filePath) => {
  if (!filePath || typeof filePath !== "string") return "";
  if (filePath.startsWith("file://")) return filePath;
  try {
    let normalized = filePath.replace(/\\/g, "/");
    if (/^[A-Za-z]:/.test(normalized)) normalized = "/" + normalized;
    const encoded = encodeURI(normalized).replace(/#/g, "%23");
    return `file://${encoded}`;
  } catch {
    return "";
  }
};

const resolveLocalPreviewPath = (entry) => {
  if (!entry) return "";
  if (entry.thumbnailCacheFile) return entry.thumbnailCacheFile;
  if (entry.thumbnail && isFileUrl(entry.thumbnail)) {
    return fileUrlToPath(entry.thumbnail);
  }
  return "";
};

async function downloadPreviewSource(src, baseName = "preview") {
  if (!src) return;
  const safeName = (baseName || "preview")
    .replace(/[\\/:*?"<>|]+/g, "_")
    .slice(0, 120);

  try {
    const isFile = typeof src === "string" && src.startsWith("file://");
    const isData = typeof src === "string" && src.startsWith("data:");

    if (isFile || isData) {
      const a = document.createElement("a");
      a.href = src;
      a.download = `${safeName}.jpg`;
      document.body.appendChild(a);
      a.click();
      setTimeout(() => document.body.removeChild(a), 0);
      return;
    }

    const res = await fetch(src);
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const blob = await res.blob();
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `${safeName}.jpg`;
    document.body.appendChild(a);
    a.click();
    setTimeout(() => {
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    }, 0);
  } catch (error) {
    console.warn("Не удалось скачать превью:", error);
    showToast(t("history.toast.previewDownloadError"), "error");
  }
}

const deriveYoutubeThumbnail = (sourceUrl = "") => {
  if (!sourceUrl) return "";
  try {
    const u = new URL(sourceUrl);
    const host = (u.hostname || "").replace(/^www\./, "").toLowerCase();
    const isYt = /youtube\.com|youtu\.be/.test(host);
    if (!isYt) return "";

    let id = "";
    if (host.includes("youtu.be")) {
      id = (u.pathname || "").split("/").filter(Boolean)[0] || "";
    } else if (u.searchParams.has("v")) {
      id = u.searchParams.get("v") || "";
    } else if ((u.pathname || "").includes("/embed/")) {
      id = (u.pathname.split("/embed/")[1] || "").split("/")[0] || "";
    } else if ((u.pathname || "").includes("/shorts/")) {
      id = (u.pathname.split("/shorts/")[1] || "").split("/")[0] || "";
    }

    return id ? `https://img.youtube.com/vi/${id}/maxresdefault.jpg` : "";
  } catch {
    return "";
  }
};

const resolveThumbnailSource = (entry) => {
  if (!entry) return "";
  if (isCacheableThumbnailUrl(entry.thumbnail)) return entry.thumbnail;
  if (isAudioEntry(entry)) return "";
  return deriveYoutubeThumbnail(entry.sourceUrl);
};

const pickInfoThumbnail = (info) => {
  if (!info) return "";
  if (info.thumbnail) return info.thumbnail;
  if (Array.isArray(info.thumbnails) && info.thumbnails.length) {
    return (
      info.thumbnails.slice().sort((a, b) => (b.width || 0) - (a.width || 0))[0]
        ?.url || ""
    );
  }
  return "";
};

const fetchThumbnailFromSource = async (entry) => {
  if (!entry?.sourceUrl) return "";
  try {
    const info = await window.electron.invoke(
      "get-video-info",
      entry.sourceUrl,
    );
    if (info?.success === false) return "";
    return pickInfoThumbnail(info);
  } catch (error) {
    console.warn(
      `Не удалось получить данные видео для превью (${entry.sourceUrl}):`,
      error,
    );
    return "";
  }
};

const hasLocalThumbnail = async (entry) => {
  const localPath = resolveLocalPreviewPath(entry);
  if (!localPath) return false;
  try {
    return await window.electron.invoke("check-file-exists", localPath);
  } catch {
    return false;
  }
};

const restoreThumbnailForEntry = async (entry, rawEntry) => {
  if (!entry?.id)
    return { changed: false, updatedEntry: entry, updatedRaw: rawEntry };

  const updatedEntry = { ...entry };
  const updatedRaw = rawEntry ? { ...rawEntry } : null;
  let changed = false;

  const localPath = resolveLocalPreviewPath(updatedEntry);
  const localExists = await hasLocalThumbnail(updatedEntry);
  if (localExists && localPath) {
    const localUrl = filePathToUrl(localPath);
    if (localUrl && updatedEntry.thumbnail !== localUrl) {
      updatedEntry.thumbnail = localUrl;
      changed = true;
    }
    return { changed, updatedEntry, updatedRaw };
  }

  const sourceUrl = resolveThumbnailSource(updatedRaw || updatedEntry);
  let candidateUrl = sourceUrl;

  // Fallback: try to fetch fresh metadata for thumbnail if nothing obvious to reuse
  if (!candidateUrl) {
    candidateUrl = await fetchThumbnailFromSource(updatedRaw || updatedEntry);
  }

  if (!candidateUrl) return { changed, updatedEntry, updatedRaw };

  try {
    const cacheResult = await window.electron.invoke("cache-history-preview", {
      url: candidateUrl,
      entryId: updatedEntry.id,
      fileName: updatedEntry.fileName || "preview",
    });

    if (cacheResult?.success && cacheResult.filePath) {
      const fileUrl = filePathToUrl(cacheResult.filePath);
      updatedEntry.thumbnailCacheFile = cacheResult.filePath;
      updatedEntry.thumbnail =
        fileUrl || updatedEntry.thumbnail || candidateUrl;
      if (updatedRaw) {
        updatedRaw.thumbnailCacheFile = cacheResult.filePath;
        updatedRaw.thumbnail = fileUrl || updatedRaw.thumbnail || candidateUrl;
      }
      changed = true;
    }
  } catch (error) {
    console.warn(
      `Не удалось восстановить превью для записи ${updatedEntry.id}:`,
      error,
    );
  }

  return { changed, updatedEntry, updatedRaw };
};

const restoreMissingHistoryPreviews = async (entries, rawHistory) => {
  if (!Array.isArray(entries) || !entries.length) return;
  if (!Array.isArray(rawHistory) || !rawHistory.length) return;

  const normalizedById = new Map(
    entries.map((item) => [String(item.id), { ...item }]),
  );
  const rawById = new Map(
    rawHistory.map((item) => [String(item.id), { ...item }]),
  );

  let hasChanges = false;

  for (const entry of entries) {
    const id = String(entry.id || "");
    if (!id || attemptedPreviewRestores.has(id)) continue;
    attemptedPreviewRestores.add(id);

    const rawEntry = rawById.get(id);
    const result = await restoreThumbnailForEntry(
      normalizedById.get(id),
      rawEntry,
    );
    if (result.changed) {
      hasChanges = true;
      if (result.updatedEntry) normalizedById.set(id, result.updatedEntry);
      if (result.updatedRaw) rawById.set(id, result.updatedRaw);
    }
  }

  if (!hasChanges) return;

  const updatedEntries = entries.map(
    (entry) => normalizedById.get(String(entry.id)) || entry,
  );
  const updatedRawHistory = rawHistory.map(
    (entry) => rawById.get(String(entry.id)) || entry,
  );

  setHistoryData(updatedEntries);
  filterAndSortHistory(state.currentSearchQuery, state.currentSortOrder, true);

  try {
    await window.electron.invoke("save-history", updatedRawHistory);
  } catch (error) {
    console.warn(
      "Не удалось сохранить историю после восстановления превью:",
      error,
    );
  }
};

const formatCardDate = (entry) => {
  if (!entry) return "";
  if (entry.timestamp) {
    try {
      const d = new Date(entry.timestamp);
      if (!Number.isNaN(d.getTime())) {
        return d.toLocaleString([], {
          dateStyle: "medium",
          timeStyle: "short",
          hour12: false,
        });
      }
    } catch (_) {}
  }
  return entry.dateText || "";
};

const formatSizeLabel = (entry) => {
  if (entry?.isMissing) return "";
  if (entry?.formattedSize) return entry.formattedSize;
  return t("history.file.sizeUnknown");
};

const escapeHtml = (value = "") =>
  String(value)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");

const highlightText = (value, query) => {
  const text = String(value || "");
  const q = String(query || "").trim();
  if (!text || !q) return escapeHtml(text);
  if (q.length < 2) return escapeHtml(text);
  const safeText = escapeHtml(text);
  try {
    const escaped = q.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    const re = new RegExp(`(${escaped})`, "gi");
    return safeText.replace(re, '<mark class="history-highlight">$1</mark>');
  } catch {
    return safeText;
  }
};

const normalizeEntryDate = (entry) => {
  if (!entry) return null;
  if (entry.timestamp) {
    const d = new Date(entry.timestamp);
    if (!Number.isNaN(d.getTime())) return d;
  }
  if (entry.dateText) {
    const d = new Date(entry.dateText);
    if (!Number.isNaN(d.getTime())) return d;
  }
  return null;
};

const getDayKey = (date) => {
  if (!date) return "unknown";
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(
    date.getDate(),
  ).padStart(2, "0")}`;
};

const getDayLabel = (date) => {
  if (!date) return t("history.group.unknown");
  const now = new Date();
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const day = new Date(date.getFullYear(), date.getMonth(), date.getDate());
  const diffDays = Math.round((today - day) / 86400000);
  if (diffDays === 0) return t("history.group.today");
  if (diffDays === 1) return t("history.group.yesterday");
  const lang = getLanguage();
  const sameYear = now.getFullYear() === date.getFullYear();
  return date.toLocaleDateString(lang, {
    day: "numeric",
    month: "short",
    year: sameYear ? undefined : "numeric",
  });
};

async function openHistoryCardFile(entry) {
  if (!entry?.filePath) return;
  try {
    const exists = await window.electron.invoke(
      "check-file-exists",
      entry.filePath,
    );
    if (!exists) {
      entry.isMissing = true;
      markEntryMissing(entry);
      return showToast(t("history.toast.fileMissing"), "error");
    }
    await window.electron.invoke("open-last-video", entry.filePath);
  } catch (error) {
    console.error("Ошибка при открытии файла истории:", error);
    showToast(t("history.toast.fileOpenError"), "error");
  }
}

async function openHistoryCardFolder(entry) {
  if (!entry?.filePath) return;
  try {
    const exists = await window.electron.invoke(
      "check-file-exists",
      entry.filePath,
    );
    if (!exists) {
      entry.isMissing = true;
      markEntryMissing(entry);
      return showToast(t("history.toast.folderMissing"), "error");
    }
    await window.electron.invoke("open-download-folder", entry.filePath);
  } catch (error) {
    console.error("Ошибка при открытии папки истории:", error);
    showToast(t("history.toast.folderOpenError"), "error");
  }
}

function retryHistoryCardDownload(entry) {
  if (!entry?.sourceUrl || !urlInput || !downloadButton) {
    showToast(t("history.toast.retryUnavailable"), "warning");
    return;
  }
  urlInput.value = entry.sourceUrl;
  try {
    urlInput.dispatchEvent(new Event("input", { bubbles: true }));
    urlInput.dispatchEvent(new Event("force-preview"));
  } catch (_) {}
  updateButtonState();
  downloadButton.classList.add("active");
  showToast(
    t("history.toast.retryStart", {
      name: entry.fileName || entry.sourceUrl,
    }),
    "info",
  );
}

function renderHistoryCards(entries = []) {
  ensureHistoryCardsElements();
  if (!historyCardsRoot) return;
  const cardsLimit = normalizePageSize(
    state.historyPageSize || RECENT_HISTORY_LIMIT,
  );
  const subset = (entries || []).slice(0, cardsLimit);
  historyCardsRoot.innerHTML = "";
  if (subset.length === 0) {
    if (historyCardsEmptyRoot) historyCardsEmptyRoot.style.display = "";
    return;
  }
  if (historyCardsEmptyRoot) historyCardsEmptyRoot.style.display = "none";

  subset.forEach((entry) => {
    const hasPreview = Boolean(entry?.thumbnail);
    const thumbSrc = hasPreview ? entry.thumbnail : HISTORY_IMAGE_PLACEHOLDER;
    const isPlaceholder = !hasPreview;

    const card = document.createElement("article");
    card.className = `history-card${entry.isMissing ? " is-missing" : ""}`;
    card.setAttribute("role", "listitem");
    card.dataset.id = entry.id || "";
    card.dataset.filepath = entry.filePath || "";
    card.dataset.url = entry.sourceUrl || "";
    card.dataset.filename = entry.fileName || "";
    card.dataset.quality = entry.quality || "";
    card.dataset.datetime = entry.dateText || "";
    card.dataset.resolution = entry.resolution || "";
    card.dataset.size = entry.formattedSize || "";

    const thumb = document.createElement("div");
    thumb.className = `history-card-thumb${
      isPlaceholder ? " placeholder" : ""
    }`;
    if (thumbSrc) {
      const img = document.createElement("img");
      attachPlaceholderOnError(img, HISTORY_IMAGE_PLACEHOLDER, thumb);
      img.src = thumbSrc;
      img.alt = entry.fileName || t("preview.alt");
      img.loading = "lazy";

      const zoomBtn = document.createElement("button");
      zoomBtn.type = "button";
      zoomBtn.className = "history-card-thumb-button";
      zoomBtn.title = t("history.preview.zoom");
      zoomBtn.setAttribute("data-i18n-title", "history.preview.zoom");
      zoomBtn.setAttribute("data-bs-toggle", "tooltip");
      zoomBtn.setAttribute("data-bs-placement", "top");
      zoomBtn.addEventListener("click", () =>
        openHistoryCardPreview(
          img.src || thumbSrc,
          entry.fileName || entry.sourceUrl,
          entry,
        ),
      );
      const zoomBadge = document.createElement("span");
      zoomBadge.className = "history-card-thumb-zoom";
      zoomBadge.innerHTML =
        '<i class="fa-solid fa-up-right-and-down-left-from-center"></i>';

      zoomBtn.append(img, zoomBadge);
      thumb.appendChild(zoomBtn);
    } else {
      const icon = document.createElement("i");
      icon.className = "fa-regular fa-image";
      thumb.appendChild(icon);
    }
    if (entry.quality) {
      const chip = document.createElement("span");
      chip.className = "history-card-chip";
      chip.textContent = entry.quality;
      thumb.appendChild(chip);
    }

    const body = document.createElement("div");
    body.className = "history-card-body";

    const name = document.createElement("h4");
    name.className = "history-card-name";
    name.title = entry.fileName || "";
    name.textContent = entry.fileName || t("history.file.untitled");
    body.appendChild(name);

    const meta = document.createElement("div");
    meta.className = "history-card-meta";
    const host = detectHost(entry.sourceUrl);
    if (host) {
      const hostBadge = document.createElement("span");
      hostBadge.className = "history-card-host";

      const hostLabel = document.createElement("span");
      hostLabel.className = "history-card-host-label";

      const hostButton = document.createElement("button");
      hostButton.type = "button";
      hostButton.className = "history-card-host-link";
      hostButton.textContent = host;
      hostButton.title = t("history.action.openSource");
      hostButton.setAttribute("data-i18n-title", "history.action.openSource");
      hostButton.setAttribute("data-bs-toggle", "tooltip");
      hostButton.setAttribute("data-bs-placement", "top");
      hostButton.addEventListener("click", () =>
        openHistorySourceLink(entry.sourceUrl),
      );

      hostBadge.append(hostLabel, hostButton);
      meta.appendChild(hostBadge);
    }
    const size = document.createElement("span");
    size.textContent = formatSizeLabel(entry);
    meta.appendChild(size);
    body.appendChild(meta);

    const dateLabel = formatCardDate(entry);
    if (dateLabel) {
      const date = document.createElement("p");
      date.className = "history-card-date";
      date.textContent = dateLabel;
      body.appendChild(date);
    }

    const actions = document.createElement("div");
    actions.className = "history-card-actions";
    const openBtn = document.createElement("button");
    openBtn.type = "button";
    openBtn.className = "history-card-btn";
    openBtn.dataset.action = "open";
    openBtn.innerHTML = `<i class="fa-solid fa-circle-play"></i><span>${t(
      "history.action.open",
    )}</span>`;
    openBtn.title = t("history.action.openFile");
    openBtn.setAttribute("data-i18n-title", "history.action.openFile");
    openBtn.setAttribute("data-bs-toggle", "tooltip");
    openBtn.setAttribute("data-bs-placement", "top");
    openBtn.disabled = entry.isMissing;
    openBtn.addEventListener("click", () => openHistoryCardFile(entry));

    const openFolderBtn = document.createElement("button");
    openFolderBtn.type = "button";
    openFolderBtn.className = "history-card-btn ghost";
    openFolderBtn.dataset.action = "open-folder";
    openFolderBtn.innerHTML = `<i class="fa-solid fa-folder-open"></i><span>${t(
      "history.action.folder",
    )}</span>`;
    openFolderBtn.title = t("history.action.openFolder");
    openFolderBtn.setAttribute("data-i18n-title", "history.action.openFolder");
    openFolderBtn.setAttribute("data-bs-toggle", "tooltip");
    openFolderBtn.setAttribute("data-bs-placement", "top");
    openFolderBtn.disabled = entry.isMissing;
    openFolderBtn.addEventListener("click", () => openHistoryCardFolder(entry));

    const retryBtn = document.createElement("button");
    retryBtn.type = "button";
    retryBtn.className = "history-card-btn ghost";
    retryBtn.dataset.action = "retry";
    retryBtn.innerHTML = `<i class="fa-solid fa-arrow-rotate-right"></i><span>${t(
      "history.action.retry",
    )}</span>`;
    retryBtn.title = t("history.action.retryFile");
    retryBtn.setAttribute("data-i18n-title", "history.action.retryFile");
    retryBtn.setAttribute("data-bs-toggle", "tooltip");
    retryBtn.setAttribute("data-bs-placement", "top");
    retryBtn.disabled = !entry.sourceUrl;
    if (entry.sourceUrl) {
      retryBtn.addEventListener("click", () => retryHistoryCardDownload(entry));
    }

    actions.append(openBtn, openFolderBtn, retryBtn);
    body.appendChild(actions);

    const deleteBtn = document.createElement("button");
    deleteBtn.type = "button";
    deleteBtn.className = "history-card-delete";
    deleteBtn.setAttribute("aria-label", t("history.action.delete"));
    deleteBtn.setAttribute("data-i18n-aria", "history.action.delete");
    deleteBtn.title = t("history.action.delete");
    deleteBtn.setAttribute("data-i18n-title", "history.action.delete");
    deleteBtn.setAttribute("data-bs-toggle", "tooltip");
    deleteBtn.setAttribute("data-bs-placement", "top");
    deleteBtn.innerHTML = '<i class="fa-solid fa-xmark"></i>';
    deleteBtn.addEventListener("click", async (event) => {
      event.preventDefault();
      event.stopPropagation();
      await handleDeleteEntry(card);
    });

    card.append(deleteBtn, thumb, body);
    historyCardsRoot.appendChild(card);
  });
}

function markEntryMissing(entry) {
  if (!entry) return;
  const id = entry.id?.toString?.() || "";
  const current = getHistoryData();
  if (!Array.isArray(current) || !current.length) return;
  const updated = current.map((item) => {
    if (!item) return item;
    const itemId = item.id?.toString?.() || "";
    if (id && itemId !== id) return item;
    return { ...item, isMissing: true };
  });
  setHistoryData(updated);
  filterAndSortHistory(state.currentSearchQuery, state.currentSortOrder, true);
  renderHistoryCards(updated);
}

function createLogEntry(entry) {
  const el = document.createElement("div");
  el.className = "log-entry history-row";
  el.setAttribute("role", "listitem");
  el.setAttribute("data-id", entry.id);
  el.setAttribute("data-url", entry.sourceUrl);
  el.setAttribute("data-timestamp", entry.timestamp || "");
  el.dataset.filepath = entry.filePath || "";
  el.dataset.url = entry.sourceUrl || "";
  el.dataset.filename = entry.fileName || "";
  el.dataset.quality = entry.quality || "";
  el.dataset.datetime = entry.dateText || "";
  el.dataset.resolution = entry.resolution || "";
  el.dataset.size = entry.formattedSize || "";

  if (!entry.dateText) console.warn("⚠️ Нет dateText у записи:", entry);
  if (entry.isMissing) el.classList.add("missing");

  const host = detectHost(entry.sourceUrl);
  const hasPreview = Boolean(entry?.thumbnail);
  const thumbSrc = hasPreview ? entry.thumbnail : HISTORY_IMAGE_PLACEHOLDER;
  const isAudio = isAudioEntry(entry);

  const checkboxId = `history-select-${entry.id || ""}`;

  const selectWrap = document.createElement("label");
  selectWrap.className = "history-row__select";
  selectWrap.setAttribute("for", checkboxId);
  const checkbox = document.createElement("input");
  checkbox.type = "checkbox";
  checkbox.className = "history-row__checkbox";
  checkbox.id = checkboxId;
  checkbox.dataset.id = entry.id || "";
  const isSelected = state.selectedEntries.includes(entry.id?.toString() || "");
  checkbox.checked = isSelected;
  const checkboxUi = document.createElement("span");
  checkboxUi.className = "history-row__checkbox-ui";
  selectWrap.append(checkbox, checkboxUi);

  const main = document.createElement("div");
  main.className = "history-row__main";

  const thumb = document.createElement("button");
  thumb.type = "button";
  thumb.className = `history-row__thumb${hasPreview ? "" : " is-placeholder"}`;
  thumb.setAttribute("aria-label", t("history.preview.zoom"));
  thumb.setAttribute("data-i18n-aria", "history.preview.zoom");
  thumb.setAttribute("data-bs-toggle", "tooltip");
  thumb.setAttribute("data-bs-placement", "top");
  thumb.title = t("history.preview.zoom");
  if (thumbSrc) {
    const img = document.createElement("img");
    img.src = thumbSrc;
    img.alt = entry.fileName || t("preview.alt");
    img.loading = "lazy";
    attachPlaceholderOnError(img, HISTORY_IMAGE_PLACEHOLDER, thumb);
    thumb.appendChild(img);
  } else {
    const icon = document.createElement("i");
    icon.className = "fa-regular fa-image";
    thumb.appendChild(icon);
  }
  thumb.addEventListener("click", (event) => {
    event.stopPropagation();
    openHistoryCardPreview(
      thumbSrc,
      entry.fileName || entry.sourceUrl || t("preview.alt"),
      entry,
    );
  });

  const titleRow = document.createElement("div");
  titleRow.className = "history-row__title";

  const name = document.createElement("span");
  name.className = "history-row__name";
  name.title = entry.fileName || "";
  name.innerHTML = highlightText(
    entry.fileName || t("history.file.untitled"),
    state.currentSearchQuery,
  );
  name.setAttribute("data-bs-toggle", "tooltip");
  name.setAttribute("data-bs-placement", "top");

  const sourceChipLabel =
    state.currentSortKey === "source" ? formatSourceLabel(entry.sourceUrl) : "";
  const sourceChip = document.createElement("span");
  sourceChip.className = "history-row__source-chip";
  sourceChip.textContent = sourceChipLabel || "";
  if (!sourceChipLabel) sourceChip.classList.add("hidden");

  const badges = document.createElement("div");
  badges.className = "history-row__badges";
  if (host) {
    const hostBadge = document.createElement("span");
    hostBadge.className = "history-badge history-badge--host";
    hostBadge.textContent = host;
    badges.appendChild(hostBadge);
  }
  if (entry.quality) {
    const qualityBadge = document.createElement("span");
    qualityBadge.className = "history-badge history-badge--quality";
    qualityBadge.textContent = entry.quality;
    badges.appendChild(qualityBadge);
  }
  if (entry.resolution) {
    const resBadge = document.createElement("span");
    resBadge.className = "history-badge history-badge--resolution";
    resBadge.textContent = entry.resolution;
    badges.appendChild(resBadge);
  }
  if (entry.fps) {
    const fpsBadge = document.createElement("span");
    fpsBadge.className = "history-badge history-badge--fps";
    fpsBadge.textContent = `${entry.fps}fps`;
    badges.appendChild(fpsBadge);
  }
  if (isAudio) {
    const audioBadge = document.createElement("span");
    audioBadge.className = "history-badge history-badge--audio";
    audioBadge.textContent = t("history.badge.audio");
    badges.appendChild(audioBadge);
  }
  if (entry.isMissing) {
    const missingBadge = document.createElement("span");
    missingBadge.className = "history-badge history-badge--missing";
    missingBadge.textContent = t("history.file.missing");
    badges.appendChild(missingBadge);
  }

  titleRow.append(name, sourceChip);

  const meta = document.createElement("div");
  meta.className = "history-row__meta";

  const sizeLabel = formatSizeLabel(entry);
  if (sizeLabel) {
    const size = document.createElement("span");
    size.className = "history-row__size";
    size.innerHTML = `<i class=\"fa-solid fa-database\"></i><span>${sizeLabel}</span>`;
    meta.appendChild(size);
  }

  main.append(titleRow, badges, meta);

  const actions = document.createElement("div");
  actions.className = "history-row__actions";
  const primaryActions = document.createElement("div");
  primaryActions.className = "history-row__actions-primary";
  const secondaryActions = document.createElement("div");
  secondaryActions.className = "history-row__actions-secondary";

  const openBtn = document.createElement("button");
  openBtn.type = "button";
  openBtn.className = "history-row__action";
  openBtn.setAttribute("data-bs-toggle", "tooltip");
  openBtn.setAttribute("data-bs-placement", "top");
  openBtn.title = t("history.action.openFile");
  openBtn.setAttribute("data-i18n-title", "history.action.openFile");
  openBtn.innerHTML = '<i class="fa-solid fa-circle-play"></i>';
  openBtn.disabled = entry.isMissing;
  openBtn.addEventListener("click", async (e) => {
    e.stopPropagation();
    await openHistoryCardFile(entry);
  });

  const openFolderBtn = document.createElement("button");
  openFolderBtn.type = "button";
  openFolderBtn.className = "history-row__action";
  openFolderBtn.setAttribute("data-bs-toggle", "tooltip");
  openFolderBtn.setAttribute("data-bs-placement", "top");
  openFolderBtn.title = t("history.action.openFolderShort");
  openFolderBtn.setAttribute(
    "data-i18n-title",
    "history.action.openFolderShort",
  );
  openFolderBtn.innerHTML = '<i class="fa-solid fa-folder-open"></i>';
  openFolderBtn.disabled = entry.isMissing;
  openFolderBtn.addEventListener("click", async (e) => {
    e.stopPropagation();
    await openHistoryCardFolder(entry);
  });

  const menuItem = (label, icon, options = {}) => {
    const item = document.createElement("button");
    item.type = "button";
    item.className = `history-row__menu-item${options.className || ""}`;
    item.setAttribute("role", "menuitem");
    if (options.disabled) item.disabled = true;
    item.innerHTML = `<i class="${icon}"></i><span>${label}</span>`;
    if (options.onClick) {
      item.addEventListener("click", (e) => {
        e.stopPropagation();
        closeAllHistoryMenus();
        options.onClick();
      });
    }
    return item;
  };

  const menu = document.createElement("div");
  menu.className = "history-row__menu";

  const menuButton = document.createElement("button");
  menuButton.type = "button";
  menuButton.className = "history-row__action history-row__menu-button";
  menuButton.setAttribute("aria-expanded", "false");
  menuButton.setAttribute("aria-label", t("history.action.more"));
  menuButton.setAttribute("data-i18n-aria", "history.action.more");
  menuButton.setAttribute("data-bs-toggle", "tooltip");
  menuButton.setAttribute("data-bs-placement", "top");
  menuButton.title = t("history.action.more");
  menuButton.setAttribute("data-i18n-title", "history.action.more");
  menuButton.innerHTML = '<i class="fa-solid fa-ellipsis-vertical"></i>';

  const menuList = document.createElement("div");
  menuList.className = "history-row__menu-list";
  menuList.setAttribute("role", "menu");

  const openSourceItem = menuItem(
    t("history.action.openSource"),
    "fa-solid fa-up-right-from-square",
    {
      disabled: !entry.sourceUrl,
      onClick: () => openHistorySourceLink(entry.sourceUrl),
    },
  );

  const retryItem = menuItem(
    t("history.action.retry"),
    "fa-solid fa-arrow-rotate-right",
    {
      disabled: !entry.sourceUrl,
      onClick: () => retryHistoryCardDownload(entry),
    },
  );

  const deleteItem = menuItem(
    t("history.action.deleteFromHistory"),
    "fa-solid fa-trash",
    {
      className: " history-row__delete",
    },
  );

  menuList.append(openSourceItem, retryItem, deleteItem);
  menu.append(menuButton, menuList);

  menuButton.addEventListener("click", (event) => {
    event.stopPropagation();
    const willOpen = !menu.classList.contains("is-open");
    closeAllHistoryMenus(willOpen ? menu : null);
    menu.classList.toggle("is-open", willOpen);
    el.classList.toggle("is-menu-open", willOpen);
    menuButton.setAttribute("aria-expanded", willOpen ? "true" : "false");
    if (willOpen) {
      if (!menuButton.dataset.tooltipTitle) {
        menuButton.dataset.tooltipTitle =
          menuButton.getAttribute("title") || "";
      }
      menuButton.removeAttribute("title");
      menuButton.setAttribute("data-bs-original-title", "");
      menuList.style.visibility = "hidden";
      const menuRect = menuList.getBoundingClientRect();
      const pagination = document.getElementById("history-pagination");
      const paginationRect = pagination?.getBoundingClientRect();
      const gap = 8;
      const viewportHeight =
        window.innerHeight || document.documentElement.clientHeight;
      const lowerBound = paginationRect
        ? paginationRect.top - gap
        : viewportHeight - gap;
      const openUp = menuRect.bottom + gap > lowerBound;
      menu.classList.toggle("is-open-up", openUp);
      menuList.style.visibility = "";
    } else {
      const title = menuButton.dataset.tooltipTitle || t("history.action.more");
      menuButton.setAttribute("title", title);
      menuButton.setAttribute("data-bs-original-title", title);
    }
  });

  primaryActions.append(openBtn, openFolderBtn);
  secondaryActions.append(menu);

  const toggle = document.createElement("button");
  toggle.type = "button";
  toggle.className = "history-row__toggle";
  const initialDetailsOpen = state.historyDetailsExpanded === true;
  toggle.setAttribute("aria-expanded", initialDetailsOpen ? "true" : "false");
  const initialToggleLabel = initialDetailsOpen
    ? t("history.details.collapse")
    : t("history.details.expand");
  toggle.setAttribute("aria-label", initialToggleLabel);
  toggle.title = initialToggleLabel;
  toggle.innerHTML = '<i class="fa-solid fa-chevron-down"></i>';
  secondaryActions.append(toggle);
  actions.append(primaryActions, secondaryActions);

  const details = document.createElement("div");
  details.className = "history-row__details";
  if (initialDetailsOpen) {
    details.classList.add("is-open");
    el.classList.add("is-open");
  }

  const preview = document.createElement("div");
  preview.className = `history-row__preview${hasPreview ? "" : " is-placeholder"}`;
  if (thumbSrc) {
    const downloadPreviewBtn = document.createElement("button");
    downloadPreviewBtn.type = "button";
    downloadPreviewBtn.className = "history-row__preview-download";
    downloadPreviewBtn.setAttribute(
      "aria-label",
      t("history.preview.download"),
    );
    downloadPreviewBtn.setAttribute(
      "data-i18n-aria",
      "history.preview.download",
    );
    downloadPreviewBtn.setAttribute("data-bs-toggle", "tooltip");
    downloadPreviewBtn.setAttribute("data-bs-placement", "top");
    downloadPreviewBtn.title = t("history.preview.download");
    downloadPreviewBtn.setAttribute(
      "data-i18n-title",
      "history.preview.download",
    );
    downloadPreviewBtn.innerHTML = '<i class="fa-solid fa-download"></i>';
    downloadPreviewBtn.addEventListener("click", (event) => {
      event.preventDefault();
      event.stopPropagation();
      downloadPreviewSource(thumbSrc, entry.fileName || entry.id || "preview");
    });
    preview.appendChild(downloadPreviewBtn);

    const img = document.createElement("img");
    img.src = thumbSrc;
    img.alt = entry.fileName || t("preview.alt");
    img.loading = "lazy";
    attachPlaceholderOnError(img, HISTORY_IMAGE_PLACEHOLDER, preview);
    preview.appendChild(img);
  } else {
    const icon = document.createElement("i");
    icon.className = "fa-regular fa-image";
    preview.appendChild(icon);
  }
  if (thumbSrc) {
    preview.addEventListener("click", (event) => {
      if (event.target.closest(".history-row__preview-download")) return;
      openHistoryCardPreview(
        thumbSrc,
        entry.fileName || entry.sourceUrl || t("preview.alt"),
        entry,
      );
    });
  }

  const detailsMeta = document.createElement("div");
  detailsMeta.className = "history-row__details-meta";

  const addDetail = (label, value, options = {}) => {
    if (!value) return;
    const row = document.createElement("div");
    row.className = "history-row__details-item";
    const key = document.createElement("span");
    key.className = "history-row__details-key";
    key.textContent = label;
    const valueWrap = document.createElement("div");
    valueWrap.className = "history-row__details-value-wrap";
    const val = document.createElement("span");
    val.className = "history-row__details-value";
    if (options.html) {
      val.innerHTML = value;
    } else {
      val.textContent = value;
    }
    if (options.truncate) {
      val.classList.add("history-row__details-value--truncate");
      val.title = options.copyValue || val.textContent || "";
    }
    valueWrap.appendChild(val);
    if (options.copyable && options.copyValue) {
      const copyBtn = document.createElement("button");
      copyBtn.type = "button";
      copyBtn.className = "history-row__copy";
      copyBtn.setAttribute("aria-label", t("history.action.copy"));
      copyBtn.setAttribute("data-i18n-aria", "history.action.copy");
      copyBtn.setAttribute("data-bs-toggle", "tooltip");
      copyBtn.setAttribute("data-bs-placement", "top");
      copyBtn.title = t("history.action.copy");
      copyBtn.setAttribute("data-i18n-title", "history.action.copy");
      copyBtn.innerHTML = '<i class="fa-regular fa-copy"></i>';
      copyBtn.addEventListener("click", async (event) => {
        event.preventDefault();
        event.stopPropagation();
        await copyHistoryValue(options.copyValue);
      });
      valueWrap.appendChild(copyBtn);
    }
    row.append(key, valueWrap);
    detailsMeta.appendChild(row);
  };

  addDetail(
    t("history.detail.source"),
    highlightText(entry.sourceUrl || "", state.currentSearchQuery),
    {
      html: true,
      truncate: true,
      copyable: true,
      copyValue: entry.sourceUrl || "",
    },
  );
  addDetail(t("history.detail.file"), entry.filePath || "", {
    truncate: true,
    copyable: true,
    copyValue: entry.filePath || "",
  });
  addDetail(t("history.detail.quality"), entry.quality || "");
  addDetail(t("history.detail.resolution"), entry.resolution || "");
  addDetail(t("history.detail.date"), entry.dateText || "");

  details.append(preview, detailsMeta);

  checkbox.addEventListener("change", (e) => {
    const isChecked = e.target.checked;
    const id = entry.id?.toString() || "";
    if (isChecked) {
      if (!state.selectedEntries.includes(id)) {
        state.selectedEntries.push(id);
      }
      el.classList.add("selected");
    } else {
      state.selectedEntries = state.selectedEntries.filter(
        (entryId) => entryId !== id,
      );
      el.classList.remove("selected");
    }
    updateDeleteSelectedButton();
  });

  const toggleDetails = (event = null) => {
    event?.stopPropagation?.();
    const isOpen = !details.classList.contains("is-open");
    details.classList.toggle("is-open", isOpen);
    el.classList.toggle("is-open", isOpen);
    toggle.setAttribute("aria-expanded", isOpen ? "true" : "false");
    const label = isOpen
      ? t("history.details.collapse")
      : t("history.details.expand");
    toggle.setAttribute("aria-label", label);
    toggle.title = label;
    updateToggleAllButtonState();
    historyVirtualList?.requestRender?.();
  };

  toggle.addEventListener("click", (event) => toggleDetails(event));

  el.addEventListener("click", (event) => {
    event.stopPropagation();
    if (
      event.target.closest("button, a, input, label, .history-row__details")
    ) {
      return;
    }
    toggleDetails();
  });

  if (entry._highlight) {
    el.classList.add("new-entry");
    setTimeout(() => {
      el.classList.remove("new-entry");
    }, 5000);
    delete entry._highlight;
  }

  el.append(selectWrap, thumb, main, actions);
  el.appendChild(details);
  if (isSelected) el.classList.add("selected");

  return { el };
}

function attachDeleteListeners() {
  const deleteButtons = document.querySelectorAll(".history-row__delete");
  deleteButtons.forEach((btn) => {
    btn.addEventListener("click", async (e) => {
      e.preventDefault();
      e.stopPropagation();
      closeAllHistoryMenus();
      const logEntry = btn.closest(".log-entry");
      if (logEntry) await handleDeleteEntry(logEntry);
    });
  });
}

document
  .getElementById("delete-selected")
  ?.addEventListener("click", async () => {
    const idsToDelete = state.selectedEntries.map((id) => id.toString());
    console.log("selectedEntries =", state.selectedEntries);

    if (!idsToDelete.length) return;

    const currentHistory = getHistoryData();
    const deletedEntries = currentHistory.filter((entry) =>
      idsToDelete.includes(entry.id.toString()),
    );

    const updatedHistory = currentHistory.filter(
      (entry) => !idsToDelete.includes(entry.id.toString()),
    );

    // ВСТАВКА: логи до и после удаления
    console.log("История до удаления:", currentHistory);
    console.log("IDs к удалению:", idsToDelete);
    console.log("История после удаления:", updatedHistory);
    const previewPaths = deletedEntries
      .map((entry) => entry.thumbnailCacheFile)
      .filter(Boolean);

    console.log("Перед обновлением истории:", getHistoryData());
    setHistoryData(updatedHistory); // ✅ обновляем локальное состояние
    // ВСТАВКА: лог после setHistoryData
    console.log(
      "setHistoryData выполнен. Актуальная история:",
      getHistoryData(),
    );
    console.log("История после удаления:", getHistoryData());
    state.selectedEntries = [];

    await window.electron.invoke("save-history", updatedHistory); // ✅ сохраняем на диск
    filterAndSortHistory(
      state.currentSearchQuery,
      state.currentSortOrder,
      true,
    );
    // ВСТАВКА: лог после перерисовки
    console.log("После перерисовки renderHistory:", getHistoryData());
    await updateDownloadCount();
    updateDeleteSelectedButton();

    let cleanupTimer = null;
    if (previewPaths.length) {
      cleanupTimer = setTimeout(() => {
        window.electron
          .invoke("delete-history-preview", previewPaths)
          .catch((error) =>
            console.warn("Не удалось очистить превью после удаления:", error),
          );
      }, 6000);
    }

    showToast(
      t("history.toast.deletedEntries", { count: deletedEntries.length }),
      "info",
      5500,
      null,
      async () => {
        if (cleanupTimer) {
          clearTimeout(cleanupTimer);
          cleanupTimer = null;
        }
        const restored = [...deletedEntries, ...getHistoryData()];
        setHistoryData(restored);
        await window.electron.invoke("save-history", restored);
        filterAndSortHistory(
          state.currentSearchQuery,
          state.currentSortOrder,
          true,
        );
        if (Array.isArray(state.deletedHistoryBuffer)) {
          state.deletedHistoryBuffer = state.deletedHistoryBuffer.filter(
            (entry) => !idsToDelete.includes(String(entry.id)),
          );
          updateRestoreButton();
        }
        await updateDownloadCount();
        showToast(t("history.toast.deleteCancelled"), "success");
      },
    );
    rememberDeletedEntries(deletedEntries);
    updateRestoreButton();
  });

function _attachOpenFolderListeners() {
  const folderButtons = document.querySelectorAll(".open-folder-btn");
  folderButtons.forEach((btn) => {
    const logEntry = btn.closest(".log-entry");

    // Проверка: если у родителя есть класс missing — отключить кнопку
    if (logEntry?.classList.contains("missing")) {
      btn.setAttribute("disabled", "true");
      return;
    }

    btn.addEventListener("click", async (e) => {
      e.preventDefault();
      e.stopPropagation();

      const filePath = btn.dataset.path;
      if (filePath) {
        try {
          await window.electron.invoke("open-download-folder", filePath);
        } catch (err) {
          console.error(err);
          showToast(t("history.toast.folderMissingShort"), "error");
        }
      }
    });
  });
}

function rememberDeletedEntries(entries = []) {
  if (!Array.isArray(entries) || !entries.length) return;
  const normalized = entries.filter(Boolean);
  if (!normalized.length) return;
  state.deletedHistoryBuffer = [
    ...normalized,
    ...(state.deletedHistoryBuffer || []),
  ].slice(0, 200);
  updateRestoreButton();
}

async function restoreDeletedEntries() {
  const buffer = Array.isArray(state.deletedHistoryBuffer)
    ? state.deletedHistoryBuffer
    : [];
  if (!buffer.length) return;

  const mergedMap = new Map();
  [...buffer, ...getHistoryData()].forEach((entry) => {
    if (!entry) return;
    mergedMap.set(entry.id ?? entry.filePath ?? Math.random(), entry);
  });
  const merged = Array.from(mergedMap.values());
  setHistoryData(merged);
  state.deletedHistoryBuffer = [];
  updateRestoreButton();
  await window.electron.invoke("save-history", merged);
  filterAndSortHistory(state.currentSearchQuery, state.currentSortOrder, true);
  await updateDownloadCount();
  showToast(
    t("history.toast.restoredEntries", { count: buffer.length }),
    "success",
  );
}

const toCsvValue = (value) => `"${String(value ?? "").replace(/"/g, '""')}"`;

function buildCsv(entries = []) {
  const header = [
    "id",
    "fileName",
    "sourceUrl",
    "host",
    "quality",
    "resolution",
    "size",
    "date",
  ];
  const rows = entries.map((entry) => [
    entry.id,
    entry.fileName,
    entry.sourceUrl,
    detectHost(entry.sourceUrl),
    entry.quality || "",
    entry.resolution || "",
    entry.formattedSize || entry.size || "",
    entry.dateText || "",
  ]);
  return [
    header.map(toCsvValue).join(","),
    ...rows.map((row) => row.map(toCsvValue).join(",")),
  ].join("\n");
}

function downloadTextFile(filename, content, mime = "text/plain") {
  try {
    const blob = new Blob([content], { type: mime });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    setTimeout(() => {
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    }, 0);
  } catch (error) {
    console.error("Ошибка экспорта истории:", error);
    showToast(t("history.toast.exportSaveError"), "error");
  }
}

function exportHistory(format = "json") {
  const entries = lastRenderedFiltered.length
    ? lastRenderedFiltered
    : getHistoryData();
  if (!entries.length) {
    showToast(t("history.toast.exportEmpty"), "warning");
    return;
  }
  const timestamp = new Date()
    .toISOString()
    .replace(/[:.]/g, "-")
    .replace("T", "_")
    .replace("Z", "");
  if (format === "csv") {
    const csv = buildCsv(entries);
    downloadTextFile(`history_${timestamp}.csv`, csv, "text/csv");
    showToast(t("history.toast.exportCsv"), "success");
    return;
  }
  const json = JSON.stringify(entries, null, 2);
  downloadTextFile(`history_${timestamp}.json`, json, "application/json");
  showToast(t("history.toast.exportJson"), "success");
}

function renderHistory(entries, meta = {}) {
  const allEntries = Array.isArray(entries) ? entries : getHistoryData();
  const fullEntries =
    Array.isArray(meta.fullEntries) && meta.fullEntries.length
      ? meta.fullEntries
      : allEntries;
  const totalEntries =
    typeof meta.totalEntries === "number"
      ? meta.totalEntries
      : fullEntries.length;

  const pageSize = normalizePageSize(
    meta.pageSize ?? state.historyPageSize ?? HISTORY_PAGE_SIZES[0],
  );
  state.historyPageSize = pageSize;

  const totalPages =
    meta.totalPages ||
    Math.max(1, Math.ceil(totalEntries / Math.max(pageSize, 1)));
  let page =
    meta.page ||
    state.historyPage ||
    (state.currentSortOrder === "asc" ? totalPages : 1);
  if (page > totalPages) page = totalPages;
  if (page < 1) page = 1;
  state.historyPage = page;

  const start = (page - 1) * pageSize;
  const pageEntries =
    meta.paged === true && Array.isArray(entries)
      ? allEntries
      : allEntries.slice(start, start + pageSize);
  const count = totalEntries;
  const isEmpty = totalEntries === 0;
  lastRenderedFiltered = fullEntries;
  buildFilterOptions(fullEntries);
  updateRestoreButton();
  ensureHistoryEmptyElement();

  // ВСТАВКА: лог в начале renderHistory
  console.log(
    "🧾 renderHistory получил entries:",
    fullEntries.map((e) => e.id),
  );
  console.log("renderHistory called at", new Date().toISOString());

  const container = document.getElementById("history");
  applyHistoryDensity();
  bindHistoryMenuClose();

  disposeAllTooltips(); // очистка старых тултипов перед новой инициализацией
  destroyHistoryVirtualList();

  clearHistoryContainer(container);
  clearHistorySelection();
  if (container) container.dataset.virtualized = "false";

  if (isEmpty) {
    const hasActiveFilters =
      Boolean(state.currentSearchQuery?.trim()) ||
      Boolean(state.historySourceFilter);
    const hasUnderlyingHistory = getHistoryData().length > 0;
    const shouldHideControls = !hasActiveFilters && !hasUnderlyingHistory;

    const searchWrapper = document.querySelector(".history-search-wrapper");
    if (searchWrapper) {
      searchWrapper.style.display = shouldHideControls ? "none" : "block";
    }

    const iconSearch = document.getElementById("icon-filter-search");
    if (iconSearch) iconSearch.classList.toggle("hidden", shouldHideControls);

    const actions = document.querySelector(".history-controls");
    if (actions) actions.classList.toggle("hidden", shouldHideControls);

    const filtersRow = document.querySelector(".history-filters-row");
    if (filtersRow) filtersRow.classList.toggle("hidden", shouldHideControls);

    if (historyEmptyRoot) {
      historyEmptyRoot.textContent = hasActiveFilters
        ? t("history.empty.noFiltered")
        : t("history.empty.noRecent");
      historyEmptyRoot.style.display = "";
    }
    updatePaginationControls({
      page,
      totalPages: 1,
      totalEntries: 0,
      pageSize,
    });
    setTimeout(() => initTooltips(), 0);
    return;
  }

  if (historyEmptyRoot) {
    historyEmptyRoot.style.display = "none";
  }

  // Показываем элементы поиска и действий
  const searchWrapper = document.querySelector(".history-search-wrapper");
  if (searchWrapper) searchWrapper.style.display = "block";

  const iconSearch = document.getElementById("icon-filter-search");
  if (iconSearch) iconSearch.classList.remove("hidden");

  const actions = document.querySelector(".history-controls");
  if (actions) actions.classList.remove("hidden");

  const filtersRow = document.querySelector(".history-filters-row");
  if (filtersRow) filtersRow.classList.remove("hidden");

  syncSelectedEntriesWith(pageEntries);
  const shouldVirtualize =
    pageEntries.length >= HISTORY_VIRTUALIZATION_MIN_ITEMS;
  container.dataset.virtualized = shouldVirtualize ? "true" : "false";
  if (shouldVirtualize) {
    historyVirtualList = renderHistoryVirtualized(container, pageEntries);
  } else {
    let lastGroupKey = null;
    pageEntries.forEach((entry) => {
      const entryDate = normalizeEntryDate(entry);
      const groupKey = getDayKey(entryDate);
      if (groupKey !== lastGroupKey) {
        lastGroupKey = groupKey;
        container.appendChild(createHistoryGroupElement(entry));
      }

      const { el } = createLogEntry(entry);
      container.appendChild(el);
    });
    requestAnimationFrame(() => {
      updateTitleTruncation();
      initTooltips();
    });
    attachDeleteListeners();
  }

  const highlighted = container.querySelector(".new-entry");
  if (highlighted) {
    highlighted.scrollIntoView({ behavior: "smooth", block: "center" });
  }

  updateDeleteSelectedButton();

  updatePaginationControls({
    page,
    totalPages,
    totalEntries: count,
    pageSize,
  });
  updateToggleAllButtonState();
}

async function initHistoryState() {
  try {
    ensureHistoryControlElements();
    syncHistorySelectValues();
    await loadHistory(true); // 👈 forceRender=true — гарантируем перерисовку

    setFilterInputValue(state.currentSearchQuery || "");
    await updateDownloadCount();
    historyContainer.style.display = state.historyVisible ? "block" : "none";
    updateButtonState();
    updateIcon("");
  } catch (error) {
    console.error("Error during initial load:", error);
    showToast(t("history.toast.loadError"), "error");
  }
}

function initHistory() {
  ensureHistoryControlElements();
  applyHistoryDensity();
  historySourceFilterSelect?.addEventListener("change", (e) => {
    state.historySourceFilter = e.target.value || "";
    localStorage.setItem("historySourceFilter", state.historySourceFilter);
    state.historyPage = 1;
    historySelectUIs.source?.updateLabel?.();
    filterAndSortHistory(
      state.currentSearchQuery,
      state.currentSortOrder,
      true,
    );
  });
  historySortKeySelect?.addEventListener("change", (e) => {
    state.currentSortKey = e.target.value || "date";
    localStorage.setItem("currentSortKey", state.currentSortKey);
    historySelectUIs.sortKey?.updateLabel?.();
    filterAndSortHistory(
      state.currentSearchQuery,
      state.currentSortOrder,
      true,
    );
  });
  historySortModeSelect?.addEventListener("change", (e) => {
    state.currentSortMode = e.target.value || "video";
    localStorage.setItem("currentSortMode", state.currentSortMode);
    historySelectUIs.sortMode?.updateLabel?.();
    filterAndSortHistory(
      state.currentSearchQuery,
      state.currentSortOrder,
      true,
    );
  });
  historyExportJsonButton?.addEventListener("click", () =>
    exportHistory("json"),
  );
  historyExportCsvButton?.addEventListener("click", () => exportHistory("csv"));
  restoreHistoryButton?.addEventListener("click", () =>
    restoreDeletedEntries(),
  );
  historyClearSelectionButton?.addEventListener("click", () =>
    clearHistorySelection(),
  );
  toggleAllDetailsButton?.addEventListener("click", () =>
    toggleAllHistoryDetails(),
  );
  historyDensityButtons.compact?.addEventListener("click", () =>
    setHistoryDensity("compact"),
  );
  historyDensityButtons.comfort?.addEventListener("click", () =>
    setHistoryDensity("comfort"),
  );

  openHistoryButton.addEventListener("click", () => {
    const newVisibility = !state.historyVisible;
    toggleHistoryVisibility(newVisibility);
    historyContainer.style.display = state.historyVisible ? "block" : "none";
    filterInput.style.display = state.historyVisible ? "block" : "none";
    if (state.historyVisible) loadHistory();
    // queueMicrotask(() => initTooltips());
    // if (tooltipInstance) tooltipInstance.hide();
  });

  historyContainer.style.display = state.historyVisible ? "block" : "none";
  filterInput.style.display = state.historyVisible ? "block" : "none";

  if (!historyTruncationBound) {
    historyTruncationBound = true;
    window.addEventListener("resize", () => {
      if (historyTruncationResizeTimer) return;
      historyTruncationResizeTimer = setTimeout(() => {
        historyTruncationResizeTimer = null;
        requestAnimationFrame(updateTitleTruncation);
      }, 120);
    });
  }

  if (state.historyVisible) loadHistory();
}

const sortHistory = (order = "desc") => {
  state.currentSortOrder = order;
  filterAndSortHistory(state.currentSearchQuery, state.currentSortOrder, true);
};

const updateDownloadCount = async () => {
  try {
    const count = await window.electron.invoke("get-download-count");
    totalDownloads.style.display = count > 0 ? "block" : "none";
    totalDownloads.textContent = count > 0 ? `${count}` : "";
  } catch (error) {
    totalDownloads.style.display = "none";
    if (error.code !== "ENOENT") {
      console.error("Error getting download count:", error);
      showToast(t("history.toast.countError"), "error");
    }
  }
};

const loadHistory = async (forceRender = false) => {
  try {
    const loadedHistory = await window.electron.invoke("load-history");
    const rawHistory = Array.isArray(loadedHistory)
      ? loadedHistory.map((entry) => ({ ...entry }))
      : [];
    const entries = [];

    if (Array.isArray(rawHistory) && rawHistory.some((e) => e?.fileName)) {
      for (const rawEntry of rawHistory) {
        const normalized = await normalizeEntry(rawEntry);
        entries.push(normalized);
      }
    }

    setHistoryData(entries);
    state.historyPage = 1;

    const hasRealEntries = entries.length > 0;
    const filteredEntries = entries.filter((entry) =>
      (entry.fileName || "")
        .toLowerCase()
        .includes(state.currentSearchQuery.toLowerCase()),
    );

    if (hasRealEntries && filteredEntries.length === 0) {
      console.warn("⚠️ Активный фильтр скрывает все записи. Выполняем сброс.");
      state.currentSearchQuery = "";
      localStorage.removeItem("lastSearch");
      setFilterInputValue("");
    }

    // ✅ Только один вызов, с флагом принудительной перерисовки
    filterAndSortHistory(
      state.currentSearchQuery,
      state.currentSortOrder,
      forceRender,
    );

    restoreMissingHistoryPreviews(entries, rawHistory).catch((error) => {
      console.warn("Ошибка при восстановлении превью истории:", error);
    });
  } catch (error) {
    console.error("Ошибка загрузки истории:", error);
    showToast(t("history.toast.loadError"), "error");
  }
};

const addNewEntryToHistory = async (newEntryRaw) => {
  try {
    const normalized = await normalizeEntry(newEntryRaw);
    normalized._highlight = true;

    const existingHistory = getHistoryData();
    const existingIndex = existingHistory.findIndex(
      (entry) => entry.filePath === normalized.filePath,
    );

    let removedPreviews = [];
    if (existingIndex !== -1) {
      const [replacedEntry] = existingHistory.splice(existingIndex, 1);
      if (replacedEntry?.thumbnailCacheFile) {
        removedPreviews.push(replacedEntry.thumbnailCacheFile);
      }
    }
    const updated = [normalized, ...existingHistory];

    setHistoryData(updated);
    state.historyPage = 1;
    await window.electron.invoke("save-history", updated);
    if (removedPreviews.length) {
      try {
        await window.electron.invoke("delete-history-preview", removedPreviews);
      } catch (err) {
        console.warn("Не удалось удалить старое превью:", err);
      }
    }
    filterAndSortHistory(state.currentSearchQuery, state.currentSortOrder);

    await updateDownloadCount();
  } catch (error) {
    console.error("Ошибка при добавлении записи в историю:", error);
    showToast(t("history.toast.addError"), "error");
  }
};

export {
  initHistory,
  initHistoryState,
  getHistoryData,
  renderHistory,
  sortHistory,
  updateDownloadCount,
  loadHistory,
  addNewEntryToHistory,
  updateDeleteSelectedButton,
  clearHistorySelection,
  rememberDeletedEntries,
};
