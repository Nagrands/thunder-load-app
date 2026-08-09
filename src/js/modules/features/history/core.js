// src/js/modules/history.js

import {
  history,
  historyContainer,
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
import { focusUrlInputAfterRetry } from "../../retryFocus.js";
import { formatDownloadHistoryReason } from "../../downloadErrorUi.js";
import { initMediaInspectorPanel } from "../../views/tools/mediaInspectorPanel.js";
import { getVideoPreview } from "../../videoInfoBroker.js";

const HISTORY_IMAGE_PLACEHOLDER = "../assets/img/thumbnail-unavailable.png";
const HISTORY_PAGE_SIZES = [4, 10, 20];
const HISTORY_TOGGLE_ANIMATION_MS = 260;
const HISTORY_UPDATE_DEBOUNCE_MS = 120;
const HISTORY_FILTER_DEFAULTS = {
  source: "",
  sortKey: "date",
  sortMode: "mixed",
};
const attemptedPreviewRestores = new Set();

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
let historyResetFiltersButton = null;
let historyActiveFiltersCount = null;
let totalDownloadSizeRoot = null;
let totalDownloadsLabelRoot = null;
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
let lastRenderedPageEntries = [];
let historyTruncationBound = false;
let historyTruncationResizeTimer = null;
let historyVisibilityTimer = null;
let historyMenuBound = false;
let historyMoreMenuBound = false;
let historyMoreTriggerButton = null;
let historyMoreMenu = null;
let historyFiltersToggleButton = null;
let historyFiltersBody = null;
let historyFiltersCollapsed = false;
let historySearchClearBound = false;
let activeHistoryInspectorEntryId = "";
let activeHistoryInspectorRoot = null;
let activeHistoryInspectorTrigger = null;
let historyLoadPromise = null;
let historyUpdateTimer = null;
let historyUpdateGeneration = 0;
let historyUpdateBound = false;

const HISTORY_FILTERS_COLLAPSED_KEY = "historyFiltersCollapsed";

const pluralize = (value, [one, few, many]) => {
  const n = Math.abs(Number(value)) || 0;
  const n10 = n % 10;
  const n100 = n % 100;
  if (n10 === 1 && n100 !== 11) return one;
  if (n10 >= 2 && n10 <= 4 && (n100 < 10 || n100 >= 20)) return few;
  return many;
};

const formatBytes = (bytes = 0) => {
  const value = Number(bytes);
  if (!Number.isFinite(value) || value <= 0) return "0 MB";
  const units = ["B", "KB", "MB", "GB", "TB"];
  let size = value;
  let unitIndex = 0;
  while (size >= 1024 && unitIndex < units.length - 1) {
    size /= 1024;
    unitIndex += 1;
  }
  const maximumFractionDigits = unitIndex <= 1 || size >= 100 ? 0 : 1;
  return `${size.toLocaleString(getLanguage(), {
    maximumFractionDigits,
  })} ${units[unitIndex]}`;
};

const parseHistorySizeBytes = (entry = {}) => {
  const numericSize = Number(entry.sizeBytes ?? entry.fileSizeBytes);
  if (Number.isFinite(numericSize) && numericSize > 0) return numericSize;

  const rawSize = String(entry.formattedSize || entry.size || "").trim();
  const match = rawSize.match(/^([\d\s.,]+)\s*([KMGT]?I?B|байт|Б)$/i);
  if (!match) return 0;

  const normalizedValue = Number(match[1].replace(/\s/g, "").replace(",", "."));
  if (!Number.isFinite(normalizedValue) || normalizedValue <= 0) return 0;

  const unit = match[2].toUpperCase();
  const multipliers = {
    B: 1,
    Б: 1,
    БАЙТ: 1,
    KB: 1024,
    KIB: 1024,
    MB: 1024 ** 2,
    MIB: 1024 ** 2,
    GB: 1024 ** 3,
    GIB: 1024 ** 3,
    TB: 1024 ** 4,
    TIB: 1024 ** 4,
  };
  return Math.round(normalizedValue * (multipliers[unit] || 0));
};

const getHistoryStats = (entries = []) => {
  const list = Array.isArray(entries) ? entries : [];
  return {
    count: list.length,
    sizeBytes: list.reduce(
      (total, entry) =>
        total + (entry?.isMissing ? 0 : parseHistorySizeBytes(entry)),
      0,
    ),
  };
};

const updateHistoryHeaderStats = ({ count = 0, sizeBytes = 0 } = {}) => {
  if (!totalDownloadSizeRoot || !totalDownloadSizeRoot.isConnected) {
    totalDownloadSizeRoot = document.getElementById("total-download-size");
  }
  if (!totalDownloadsLabelRoot || !totalDownloadsLabelRoot.isConnected) {
    totalDownloadsLabelRoot = document.getElementById("total-downloads-label");
  }
  if (totalDownloads) {
    totalDownloads.style.display = "";
    totalDownloads.textContent = `${Math.max(0, Number(count) || 0)}`;
  }
  if (totalDownloadsLabelRoot) {
    totalDownloadsLabelRoot.textContent = pluralize(Number(count) || 0, [
      t("history.files.one"),
      t("history.files.few"),
      t("history.files.many"),
    ]);
  }
  if (totalDownloadSizeRoot) {
    totalDownloadSizeRoot.textContent = formatBytes(sizeBytes);
  }
};

const normalizePageSize = (value) => {
  const n = Number(value);
  return HISTORY_PAGE_SIZES.includes(n) ? n : HISTORY_PAGE_SIZES[0];
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

const getHistoryActiveFiltersCount = () => {
  const sourceValue =
    historySourceFilterSelect?.value ?? state.historySourceFilter ?? "";
  const sortKeyValue =
    historySortKeySelect?.value ?? state.currentSortKey ?? "date";
  const sortModeValue =
    historySortModeSelect?.value ?? state.currentSortMode ?? "mixed";

  let count = 0;
  if (sourceValue !== HISTORY_FILTER_DEFAULTS.source) count += 1;
  if (sortKeyValue !== HISTORY_FILTER_DEFAULTS.sortKey) count += 1;
  if (sortModeValue !== HISTORY_FILTER_DEFAULTS.sortMode) count += 1;
  return count;
};

const updateHistoryActiveFiltersUi = () => {
  const count = getHistoryActiveFiltersCount();
  if (historyResetFiltersButton) {
    historyResetFiltersButton.disabled = count === 0;
    historyResetFiltersButton.classList.toggle("hidden", count === 0);
  }
  if (!historyActiveFiltersCount) return;
  if (count === 0) {
    historyActiveFiltersCount.textContent = "";
    historyActiveFiltersCount.classList.add("hidden");
    return;
  }
  historyActiveFiltersCount.textContent = t("history.filters.activeCount", {
    count,
  });
  historyActiveFiltersCount.classList.remove("hidden");
};

const resetHistoryFilters = () => {
  ensureHistoryControlElements();
  const applySelectValue = (selectEl, nextValue) => {
    if (!selectEl || selectEl.value === nextValue) return false;
    selectEl.value = nextValue;
    selectEl.dispatchEvent(new Event("change", { bubbles: true }));
    return true;
  };

  const sourceChanged = applySelectValue(
    historySourceFilterSelect,
    HISTORY_FILTER_DEFAULTS.source,
  );
  const sortKeyChanged = applySelectValue(
    historySortKeySelect,
    HISTORY_FILTER_DEFAULTS.sortKey,
  );
  const sortModeChanged = applySelectValue(
    historySortModeSelect,
    HISTORY_FILTER_DEFAULTS.sortMode,
  );

  if (!sourceChanged && !sortKeyChanged && !sortModeChanged) {
    updateHistoryActiveFiltersUi();
  }
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
    historySortKeySelect.value =
      state.currentSortKey || HISTORY_FILTER_DEFAULTS.sortKey;
    historySelectUIs.sortKey?.updateLabel?.();
  }
  if (historySortModeSelect) {
    historySortModeSelect.value =
      state.currentSortMode || HISTORY_FILTER_DEFAULTS.sortMode;
    historySelectUIs.sortMode?.updateLabel?.();
  }
  updateHistoryActiveFiltersUi();
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

const refreshHistoryLucideIcons = () => {
  const api = window?.lucide;
  if (!api?.createIcons || !api?.icons) return;
  try {
    api.createIcons({ icons: api.icons });
  } catch (error) {
    console.warn("Не удалось обновить Lucide-иконки истории:", error);
  }
};

function setHistoryPanelVisible(isVisible, { animate = true } = {}) {
  if (!historyContainer) return;
  const visible = !!isVisible;

  if (historyVisibilityTimer) {
    clearTimeout(historyVisibilityTimer);
    historyVisibilityTimer = null;
  }

  if (visible) {
    historyContainer.style.display = "block";
    historyContainer.setAttribute("aria-hidden", "false");
    const applyOpenState = () => {
      historyContainer.classList.remove("is-collapsed");
      historyContainer.classList.add("is-open");
    };
    if (animate)
      requestAnimationFrame(() => {
        if (state.historyVisible) applyOpenState();
      });
    else applyOpenState();
  } else {
    historyContainer.classList.remove("is-open");
    historyContainer.classList.add("is-collapsed");
    historyContainer.setAttribute("aria-hidden", "true");
    if (!animate) {
      historyContainer.style.display = "none";
    } else {
      historyVisibilityTimer = window.setTimeout(() => {
        if (!state.historyVisible && historyContainer) {
          historyContainer.style.display = "none";
        }
        historyVisibilityTimer = null;
      }, HISTORY_TOGGLE_ANIMATION_MS);
    }
  }

  openHistoryButton?.setAttribute("aria-expanded", visible ? "true" : "false");
  if (filterInput) {
    filterInput.style.display = visible ? "block" : "none";
  }
}

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

  paginationRoot = document.getElementById("history-pagination");
  if (!paginationRoot) return;

  paginationPrev = paginationRoot.querySelector("#history-page-prev");
  paginationNext = paginationRoot.querySelector("#history-page-next");
  paginationPrevFast = paginationRoot.querySelector("#history-page-prev-fast");
  paginationNextFast = paginationRoot.querySelector("#history-page-next-fast");
  paginationInfo = paginationRoot.querySelector("#history-page-info");
  paginationSize = paginationRoot.querySelector("#history-page-size");
  if (!historySelectUIs.pageSize) {
    historySelectUIs.pageSize = enhanceSelect(paginationSize);
  }

  if (paginationRoot.dataset.bound !== "true") {
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
    paginationRoot.dataset.bound = "true";
  }
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
    paginationSize.value = String(meta.pageSize);
    historySelectUIs.pageSize?.rebuild?.();
    historySelectUIs.pageSize?.updateLabel?.();
  }

  if (paginationRoot) {
    paginationRoot.style.display = meta.totalEntries > 0 ? "flex" : "none";
  }
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
  let labelIcon = document.createElement("i");
  labelIcon.className = "bk-select-label-icon";
  const labelText = document.createElement("span");
  labelText.className = "bk-select-label-text";
  labelEl.append(labelIcon, labelText);
  const icon = document.createElement("i");
  icon.setAttribute("data-lucide", "chevron-down");
  trigger.append(labelEl, icon);

  const menu = document.createElement("div");
  menu.className = "bk-select-menu";
  menu.hidden = true;

  const applyIcon = (iconEl, iconValue = "") => {
    let node = iconEl;
    if (!node || node.tagName?.toLowerCase() !== "i") {
      const replacement = document.createElement("i");
      replacement.className = "bk-select-option-icon";
      if (node?.parentNode) {
        node.parentNode.replaceChild(replacement, node);
      } else {
        labelEl.insertBefore(replacement, labelText);
      }
      node = replacement;
    }
    node.className = "bk-select-option-icon";
    node.style.display = "none";
    node.textContent = "";
    node.removeAttribute("data-lucide");

    if (!iconValue) return node;

    if (iconValue.startsWith("lucide:")) {
      const lucideIcon = iconValue.slice("lucide:".length).trim();
      if (!lucideIcon) return node;
      node.setAttribute("data-lucide", lucideIcon);
      node.style.display = "";
      return node;
    }

    node.className = `bk-select-option-icon ${iconValue}`;
    node.style.display = "";
    return node;
  };

  const updateLabel = () => {
    const opt =
      selectEl.selectedOptions && selectEl.selectedOptions[0]
        ? selectEl.selectedOptions[0]
        : selectEl.options[selectEl.selectedIndex];
    const currentIconNode =
      labelEl.querySelector(".bk-select-label-icon") ||
      labelEl.firstElementChild;
    labelIcon = applyIcon(currentIconNode, opt?.dataset?.icon || "");
    labelIcon.classList.add("bk-select-label-icon");
    labelText.textContent = opt ? opt.textContent : "";
    menu
      .querySelectorAll(".bk-select-option")
      .forEach((item) =>
        item.classList.toggle(
          "is-active",
          item.dataset.value === selectEl.value,
        ),
      );
    refreshHistoryLucideIcons();
  };

  const rebuild = () => {
    menu.innerHTML = "";
    Array.from(selectEl.options).forEach((opt) => {
      const item = document.createElement("button");
      item.type = "button";
      item.className = "bk-select-option";
      item.dataset.value = opt.value;
      const itemIcon = document.createElement("i");
      applyIcon(itemIcon, opt.dataset.icon || "");
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
    refreshHistoryLucideIcons();
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
  if (!historyResetFiltersButton || !historyResetFiltersButton.isConnected) {
    historyResetFiltersButton = document.getElementById(
      "history-reset-filters",
    );
  }
  if (!historyActiveFiltersCount || !historyActiveFiltersCount.isConnected) {
    historyActiveFiltersCount = document.getElementById(
      "history-active-filters-count",
    );
  }
  if (!totalDownloadSizeRoot || !totalDownloadSizeRoot.isConnected) {
    totalDownloadSizeRoot = document.getElementById("total-download-size");
  }
  if (!totalDownloadsLabelRoot || !totalDownloadsLabelRoot.isConnected) {
    totalDownloadsLabelRoot = document.getElementById("total-downloads-label");
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
  if (!historyMoreTriggerButton || !historyMoreTriggerButton.isConnected) {
    historyMoreTriggerButton = document.getElementById("history-more-trigger");
  }
  if (!historyMoreMenu || !historyMoreMenu.isConnected) {
    historyMoreMenu = document.getElementById("history-more-menu");
  }
  if (!historyFiltersToggleButton || !historyFiltersToggleButton.isConnected) {
    historyFiltersToggleButton = document.getElementById(
      "history-filters-toggle",
    );
  }
  if (!historyFiltersBody || !historyFiltersBody.isConnected) {
    historyFiltersBody = document.getElementById("history-filters-body");
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
  updateHistoryActiveFiltersUi();
}

function updateSearchClearButtonVisibility() {
  const clearButton = document.getElementById("clear-filter-input");
  if (!clearButton || !filterInput) return;
  const hasValue = Boolean(filterInput.value?.trim());
  clearButton.classList.toggle("hidden", !hasValue);
}

function bindHistorySearchClearVisibility() {
  if (historySearchClearBound || !filterInput) return;
  historySearchClearBound = true;
  filterInput.addEventListener("input", () =>
    updateSearchClearButtonVisibility(),
  );
  updateSearchClearButtonVisibility();
}

function applyHistoryFiltersState() {
  const card = document.getElementById("history-filters-card");
  const toggleIcon = historyFiltersToggleButton?.querySelector("[data-lucide]");
  if (!historyFiltersBody || !historyFiltersToggleButton || !card) return;

  historyFiltersBody.hidden = historyFiltersCollapsed;
  historyFiltersToggleButton.setAttribute(
    "aria-expanded",
    historyFiltersCollapsed ? "false" : "true",
  );
  card.classList.toggle("is-collapsed", historyFiltersCollapsed);
  if (toggleIcon) {
    toggleIcon.setAttribute(
      "data-lucide",
      historyFiltersCollapsed ? "chevron-down" : "chevron-up",
    );
  }
  refreshHistoryLucideIcons();
}

function bindHistoryFiltersToggle() {
  if (!historyFiltersToggleButton) return;
  if (historyFiltersToggleButton.dataset.bound === "1") return;
  historyFiltersToggleButton.dataset.bound = "1";
  historyFiltersToggleButton.addEventListener("click", () => {
    historyFiltersCollapsed = !historyFiltersCollapsed;
    try {
      localStorage.setItem(
        HISTORY_FILTERS_COLLAPSED_KEY,
        historyFiltersCollapsed ? "1" : "0",
      );
    } catch {}
    applyHistoryFiltersState();
  });
}

function ensureHistoryCardPreviewOverlay() {
  if (historyCardPreviewOverlay) return historyCardPreviewOverlay;

  const overlay = document.createElement("div");
  overlay.className = "history-preview-overlay hidden";
  overlay.setAttribute("role", "dialog");
  overlay.setAttribute("aria-modal", "true");
  overlay.setAttribute("aria-hidden", "true");
  overlay.setAttribute("aria-label", t("history.preview.overlayLabel"));
  overlay.setAttribute("data-i18n-aria", "history.preview.overlayLabel");
  overlay.tabIndex = -1;
  overlay.innerHTML = `
    <div class="history-preview-dialog" role="document">
      <button
        type="button"
        class="history-preview-close"
        aria-label="${t("history.preview.close")}"
        data-i18n-aria="history.preview.close"
      >
        <i data-lucide="x"></i>
      </button>
      <button
        type="button"
        class="history-preview-nav history-preview-prev"
        aria-label="${t("history.preview.prev")}"
        data-i18n-aria="history.preview.prev"
      >
        <i data-lucide="chevron-left"></i>
      </button>
      <button
        type="button"
        class="history-preview-nav history-preview-next"
        aria-label="${t("history.preview.next")}"
        data-i18n-aria="history.preview.next"
      >
        <i data-lucide="chevron-right"></i>
      </button>
      <img class="history-preview-image" alt="" />
      <div class="history-preview-counter"></div>
      <p class="history-preview-caption"></p>
    </div>
  `;

  const closeBtn = overlay.querySelector(".history-preview-close");
  const prevBtn = overlay.querySelector(".history-preview-prev");
  const nextBtn = overlay.querySelector(".history-preview-next");
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
  historyCardPreviewImage = overlay.querySelector(".history-preview-image");
  historyCardPreviewCaption = overlay.querySelector(".history-preview-caption");
  historyCardPreviewCounter = overlay.querySelector(".history-preview-counter");
  historyCardPreviewPrev = overlay.querySelector(".history-preview-prev");
  historyCardPreviewNext = overlay.querySelector(".history-preview-next");

  document.body.appendChild(overlay);
  refreshHistoryLucideIcons();
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
    base.dataset.icon = "lucide:globe";
    select.appendChild(base);
    Array.from(values)
      .sort((a, b) => a.localeCompare(b))
      .forEach((value) => {
        const opt = document.createElement("option");
        opt.value = value;
        opt.textContent = value;
        opt.dataset.icon = `lucide:${getSourceIconClass(`https://${value}`) || "globe"}`;
        select.appendChild(opt);
      });
    if (current && !values.has(current)) {
      const opt = document.createElement("option");
      opt.value = current;
      opt.textContent = current;
      opt.dataset.icon = `lucide:${getSourceIconClass(`https://${current}`) || "globe"}`;
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

function _showFilterInput() {
  filterInput.classList.remove("hidden");
  filterInput.style.display = "block";
}

function clearHistoryContainer(container) {
  if (!container) return;
  container.innerHTML = "";
}

function createHistoryGroupElement(entry, groupKey = "unknown", count = 0) {
  const entryDate = normalizeEntryDate(entry);
  const group = document.createElement("div");
  group.className = "history-group";
  group.dataset.groupKey = groupKey;
  const left = `<span class="history-group__title">${escapeHtml(getDayLabel(entryDate))}</span>`;
  const countLabel =
    count > 0 ? `<span class="history-group__count">${count}</span>` : "";
  const sourceLabel = formatSourceLabel(entry.sourceUrl);
  const sourceIcon = getSourceIconClass(entry.sourceUrl);
  const source =
    state.currentSortKey === "source"
      ? `<span class="history-group__source">${
          sourceIcon ? `<i data-lucide="${sourceIcon}"></i>` : ""
        }${escapeHtml(sourceLabel)}</span>`
      : "";
  group.innerHTML = `
    <div class="history-group__left">
      ${left}
      ${countLabel}
      ${source}
    </div>
    <span class="history-group__line" aria-hidden="true"></span>
    <button
      type="button"
      class="history-group__toggle"
      data-group-key="${escapeHtml(groupKey)}"
      aria-label="${t("history.group.selectAll")}"
      data-i18n-aria="history.group.selectAll"
    >
      ${t("history.group.selectAll")}
    </button>
  `;
  return group;
}

function getHistoryGroupCounts(entries = []) {
  const counts = new Map();
  entries.forEach((entry) => {
    const key = getDayKey(normalizeEntryDate(entry));
    counts.set(key, (counts.get(key) || 0) + 1);
  });
  return counts;
}

function syncSelectedEntriesWith(entries = []) {
  const availableIds = new Set(
    entries.map((entry) => entry?.id?.toString?.() || "").filter(Boolean),
  );
  state.selectedEntries = (state.selectedEntries || []).filter((id) =>
    availableIds.has(String(id)),
  );
}

function getGroupEntryIds(groupKey) {
  return lastRenderedPageEntries
    .filter((entry) => getDayKey(normalizeEntryDate(entry)) === groupKey)
    .map((entry) => String(entry.id || ""))
    .filter(Boolean);
}

function updateGroupSelectionLabels() {
  const toggles = document.querySelectorAll(".history-group__toggle");
  toggles.forEach((toggle) => {
    const groupKey = toggle.dataset.groupKey || "";
    const ids = getGroupEntryIds(groupKey);
    if (!ids.length) return;
    const allSelected = ids.every((id) => state.selectedEntries.includes(id));
    const label = allSelected
      ? t("history.group.unselectAll")
      : t("history.group.selectAll");
    toggle.textContent = label;
    toggle.setAttribute("aria-label", label);
  });
}

function toggleGroupSelection(groupKey) {
  const groupIds = getGroupEntryIds(groupKey);
  if (!groupIds.length) return;
  const allSelected = groupIds.every((id) =>
    state.selectedEntries.includes(id),
  );
  if (allSelected) {
    state.selectedEntries = state.selectedEntries.filter(
      (id) => !groupIds.includes(String(id)),
    );
  } else {
    const merged = new Set(state.selectedEntries.map((id) => String(id)));
    groupIds.forEach((id) => merged.add(id));
    state.selectedEntries = Array.from(merged);
  }

  document.querySelectorAll(".history-row__checkbox").forEach((checkbox) => {
    const id = checkbox.dataset.id ? String(checkbox.dataset.id) : "";
    if (!id || !groupIds.includes(id)) return;
    const selected = state.selectedEntries.includes(id);
    checkbox.checked = selected;
    checkbox.closest(".history-row")?.classList.toggle("selected", selected);
  });
  updateDeleteSelectedButton();
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
  updateGroupSelectionLabels();
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
    toggle.classList.toggle("is-open", shouldOpen);
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

function closeHistoryMoreMenu() {
  if (!historyMoreMenu) return;
  historyMoreMenu.classList.add("hidden");
  historyMoreTriggerButton?.classList.remove("is-open");
  historyMoreTriggerButton?.setAttribute("aria-expanded", "false");
}

function toggleHistoryMoreMenu() {
  if (!historyMoreMenu) return;
  const shouldOpen = historyMoreMenu.classList.contains("hidden");
  historyMoreMenu.classList.toggle("hidden", !shouldOpen);
  historyMoreTriggerButton?.classList.toggle("is-open", shouldOpen);
  historyMoreTriggerButton?.setAttribute(
    "aria-expanded",
    shouldOpen ? "true" : "false",
  );
}

function bindHistoryMoreMenu() {
  if (historyMoreMenuBound) return;
  historyMoreMenuBound = true;

  historyMoreTriggerButton?.addEventListener("click", (event) => {
    event.preventDefault();
    event.stopPropagation();
    toggleHistoryMoreMenu();
  });

  historyMoreMenu?.addEventListener("click", (event) => {
    const item = event.target.closest(".history-more-menu__item");
    if (!item) return;
    closeHistoryMoreMenu();
  });

  document.addEventListener("click", (event) => {
    if (!historyMoreMenu || historyMoreMenu.classList.contains("hidden"))
      return;
    if (historyMoreMenu.contains(event.target)) return;
    if (historyMoreTriggerButton?.contains(event.target)) return;
    closeHistoryMoreMenu();
  });

  document.addEventListener("focusin", (event) => {
    if (!historyMoreMenu || historyMoreMenu.classList.contains("hidden"))
      return;
    if (historyMoreMenu.contains(event.target)) return;
    if (historyMoreTriggerButton?.contains(event.target)) return;
    closeHistoryMoreMenu();
  });

  document.addEventListener("keydown", (event) => {
    if (event.key !== "Escape") return;
    closeHistoryMoreMenu();
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
    return "play-circle";
  }
  if (host === "twitch.tv") return "tv";
  if (host === "vkvideo.ru" || host === "vk.com") return "badge-russian-ruble";
  if (
    host === "reddit.com" ||
    host === "old.reddit.com" ||
    host === "redd.it"
  ) {
    return "message-circle";
  }
  return "";
};

const isAudioEntry = (entry) => {
  const quality = entry?.quality || entry?.resolution || entry?.format || "";
  return /audio/i.test(quality) || /audio only/i.test(quality);
};

const getHistoryRetryStateKey = (entry) =>
  entry?.retryable === false
    ? "history.failed.retryState.needsAction"
    : "history.failed.retryState.retryable";

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
    const info = await getVideoPreview(entry.sourceUrl);
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

const formatSizeLabel = (entry) => {
  if (entry?.isMissing) return "";
  if (entry?.formattedSize) return entry.formattedSize;
  return t("history.file.sizeUnknown");
};

const formatDurationLabel = (entry = {}) => {
  const rawDuration =
    entry.durationSec ??
    entry.durationSeconds ??
    entry.duration ??
    entry.mediaDurationSec;
  const totalSeconds = Math.floor(Number(rawDuration));
  if (!Number.isFinite(totalSeconds) || totalSeconds <= 0) return "";

  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;
  if (hours > 0) {
    return `${hours}:${String(minutes).padStart(2, "0")}:${String(seconds).padStart(2, "0")}`;
  }
  return `${minutes}:${String(seconds).padStart(2, "0")}`;
};

const formatHistoryQualityDetails = (entry = {}) => {
  const parts = [];
  if (entry.resolution) parts.push(entry.resolution);
  if (entry.fps) parts.push(`${entry.fps}fps`);
  if (parts.length > 0) return parts.join(" • ");
  return entry.quality || "";
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

function hideActiveHistoryInspector() {
  if (activeHistoryInspectorRoot) {
    activeHistoryInspectorRoot.innerHTML = "";
    activeHistoryInspectorRoot.classList.add("hidden");
    activeHistoryInspectorRoot.classList.remove("is-open");
  }
  if (activeHistoryInspectorTrigger) {
    activeHistoryInspectorTrigger.classList.remove("is-active");
  }
  activeHistoryInspectorEntryId = "";
  activeHistoryInspectorRoot = null;
  activeHistoryInspectorTrigger = null;
}

async function inspectHistoryCardFile(
  entry,
  { root = null, trigger = null, ensureVisible = null } = {},
) {
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

    const entryId = entry.id?.toString?.() || "";
    const isSameEntryOpen =
      activeHistoryInspectorEntryId &&
      activeHistoryInspectorEntryId === entryId &&
      activeHistoryInspectorRoot === root;

    if (isSameEntryOpen) {
      hideActiveHistoryInspector();
      return;
    }

    hideActiveHistoryInspector();

    if (!(root instanceof HTMLElement)) return;

    ensureVisible?.();
    root.classList.remove("hidden");
    root.classList.add("is-open");

    const panel = initMediaInspectorPanel({
      root,
      t,
      allowPickFile: false,
      autoAnalyzeInitial: false,
      variant: "history",
    });
    if (!panel) return;

    activeHistoryInspectorEntryId = entryId;
    activeHistoryInspectorRoot = root;
    activeHistoryInspectorTrigger =
      trigger instanceof HTMLElement ? trigger : null;
    activeHistoryInspectorTrigger?.classList.add("is-active");

    await panel.inspectFile(entry.filePath, { autoAnalyze: true });
  } catch (error) {
    console.error("Ошибка при анализе файла истории:", error);
    showToast(t("history.toast.fileOpenError"), "error");
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
    urlInput.dispatchEvent(
      new CustomEvent("force-preview", {
        detail: { autoOpenQuality: true },
      }),
    );
  } catch (_) {}
  updateButtonState();
  downloadButton.classList.add("active");
  focusUrlInputAfterRetry();
  showToast(
    t("history.toast.retryStart", {
      name: entry.fileName || entry.sourceUrl,
    }),
    "info",
  );
}

function markEntryMissing(entry) {
  if (!entry) return;
  const id = entry.id?.toString?.() || "";
  const filePath = String(entry.filePath || "");
  if (!id && !filePath) return;
  const matchesEntry = (item) => {
    if (!item) return false;
    if (id) return String(item.id || "") === id;
    return String(item.filePath || "") === filePath;
  };
  const current = getHistoryData();
  if (!Array.isArray(current) || !current.length) return;
  const updated = current.map((item) =>
    matchesEntry(item) ? { ...item, isMissing: true } : item,
  );
  const updatedEntry = updated.find(matchesEntry);
  if (!updatedEntry) return;
  setHistoryData(updated);
  lastRenderedFiltered = lastRenderedFiltered.map((item) =>
    matchesEntry(item) ? updatedEntry : item,
  );
  lastRenderedPageEntries = lastRenderedPageEntries.map((item) =>
    matchesEntry(item) ? updatedEntry : item,
  );

  const currentRow = Array.from(
    document.querySelectorAll(
      ".history-row[data-id], .history-row[data-filepath]",
    ),
  ).find((row) =>
    id ? row.dataset.id === id : row.dataset.filepath === filePath,
  );
  if (currentRow) {
    const wasOpen = currentRow.classList.contains("is-open");
    const groupKey = currentRow.dataset.groupKey || "unknown";
    const { el: replacement } = createLogEntry(updatedEntry, groupKey);
    if (wasOpen) {
      replacement.classList.add("is-open");
      replacement
        .querySelector(".history-row__details")
        ?.classList.add("is-open");
      const toggle = replacement.querySelector(".history-row__toggle");
      toggle?.classList.add("is-open");
      toggle?.setAttribute("aria-expanded", "true");
    }
    currentRow.replaceWith(replacement);
    attachDeleteListeners(replacement);
    updateTitleTruncation();
    updateToggleAllButtonState();
    updateGroupSelectionLabels();
    refreshHistoryLucideIcons();
    initTooltips();
  }
  const stats = getHistoryStats(updated);
  updateHistoryHeaderStats({ count: stats.count, sizeBytes: stats.sizeBytes });
}

function isFailedHistoryEntry(entry) {
  return entry?.downloadStatus === "failed" || entry?.error === true;
}

function createLogEntry(entry, groupKey = "unknown") {
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
  el.dataset.groupKey = groupKey;

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
  checkbox.dataset.groupKey = groupKey;
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
    icon.setAttribute("data-lucide", "image");
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
  sourceChip.className =
    "history-badge history-badge--host history-row__source-chip";
  sourceChip.textContent = sourceChipLabel || "";
  if (!sourceChipLabel) sourceChip.classList.add("hidden");

  const badges = document.createElement("div");
  badges.className = "history-row__badges";
  badges.appendChild(sourceChip);
  if (host && !sourceChipLabel) {
    const hostBadge = document.createElement("span");
    hostBadge.className = "history-badge history-badge--host";
    hostBadge.textContent = host;
    badges.appendChild(hostBadge);
  }
  const mediaBadgeParts = [];
  if (entry.resolution) mediaBadgeParts.push(entry.resolution);
  if (entry.fps) mediaBadgeParts.push(`${entry.fps}fps`);
  if (mediaBadgeParts.length > 0) {
    const mediaBadge = document.createElement("span");
    mediaBadge.className =
      "history-badge history-badge--quality history-badge--media";
    if (/3840|4k/i.test(entry.resolution || "")) {
      mediaBadge.classList.add("history-badge--resolution-4k");
    }
    mediaBadge.textContent = mediaBadgeParts.join(" ");
    badges.appendChild(mediaBadge);
  } else if (entry.quality) {
    const qualityBadge = document.createElement("span");
    qualityBadge.className = "history-badge history-badge--quality";
    qualityBadge.textContent = entry.quality;
    badges.appendChild(qualityBadge);
  }
  if (isAudio) {
    const audioBadge = document.createElement("span");
    audioBadge.className = "history-badge history-badge--audio";
    audioBadge.textContent = t("history.badge.audio");
    badges.appendChild(audioBadge);
  }
  const statusCluster = document.createElement("div");
  statusCluster.className = "history-row__status";
  if (entry.isMissing) {
    const missingBadge = document.createElement("span");
    missingBadge.className = "history-badge history-badge--missing";
    missingBadge.textContent = t("history.deleted.badge");
    statusCluster.appendChild(missingBadge);
    el.classList.add("history-row--deleted");
  }
  if (isFailedHistoryEntry(entry)) {
    const failedBadge = document.createElement("span");
    failedBadge.className = "history-badge history-badge--error";
    failedBadge.textContent = t("history.failed.badge");
    statusCluster.appendChild(failedBadge);
    el.classList.add("history-row--error");
  }

  titleRow.append(name);

  const sizeLabel = formatSizeLabel(entry);
  const summary = document.createElement("div");
  summary.className = "history-row__summary";
  summary.appendChild(badges);
  if (statusCluster.childElementCount > 0) {
    summary.appendChild(statusCluster);
  }

  const meta = document.createElement("div");
  meta.className = "history-row__meta";
  if (entry.dateText) {
    const date = document.createElement("span");
    date.className = "history-row__meta-item";
    date.textContent = entry.dateText;
    meta.appendChild(date);
  }
  if (sizeLabel) {
    const size = document.createElement("span");
    size.className = "history-row__size";
    size.innerHTML = `<i data-lucide=\"hard-drive\"></i><span>${sizeLabel}</span>`;
    meta.appendChild(size);
  }

  main.append(titleRow, summary, meta);

  const actions = document.createElement("div");
  actions.className = "history-row__actions";
  const primaryActions = document.createElement("div");
  primaryActions.className = "history-row__actions-primary";
  const secondaryActions = document.createElement("div");
  secondaryActions.className = "history-row__actions-secondary";

  const openBtn = document.createElement("button");
  openBtn.type = "button";
  openBtn.className = "history-row__action";
  openBtn.dataset.action = "open-file";
  openBtn.setAttribute("data-bs-toggle", "tooltip");
  openBtn.setAttribute("data-bs-placement", "top");
  openBtn.title = t("history.action.openFile");
  openBtn.setAttribute("data-i18n-title", "history.action.openFile");
  openBtn.innerHTML = '<i data-lucide="play"></i>';
  openBtn.disabled = entry.isMissing || !entry.filePath;
  openBtn.addEventListener("click", async (e) => {
    e.stopPropagation();
    await openHistoryCardFile(entry);
  });

  const openFolderBtn = document.createElement("button");
  openFolderBtn.type = "button";
  openFolderBtn.className = "history-row__action";
  openFolderBtn.dataset.action = "open-folder";
  openFolderBtn.setAttribute("data-bs-toggle", "tooltip");
  openFolderBtn.setAttribute("data-bs-placement", "top");
  openFolderBtn.title = t("history.action.openFolderShort");
  openFolderBtn.setAttribute(
    "data-i18n-title",
    "history.action.openFolderShort",
  );
  openFolderBtn.innerHTML = '<i data-lucide="folder-open"></i>';
  openFolderBtn.disabled = entry.isMissing || !entry.filePath;
  openFolderBtn.addEventListener("click", async (e) => {
    e.stopPropagation();
    await openHistoryCardFolder(entry);
  });

  const menuItem = (label, icon, options = {}) => {
    const item = document.createElement("button");
    item.type = "button";
    item.className = `history-row__menu-item${options.className || ""}`;
    if (options.action) item.dataset.action = options.action;
    item.setAttribute("role", "menuitem");
    if (options.disabled) item.disabled = true;
    item.innerHTML = `
      <span class="history-row__menu-icon" aria-hidden="true">
        <i data-lucide="${icon}"></i>
      </span>
      <span class="history-row__menu-label">${label}</span>
    `;
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
  menuButton.dataset.action = "more";
  menuButton.setAttribute("aria-expanded", "false");
  menuButton.setAttribute("aria-label", t("history.action.more"));
  menuButton.setAttribute("data-i18n-aria", "history.action.more");
  menuButton.setAttribute("data-bs-toggle", "tooltip");
  menuButton.setAttribute("data-bs-placement", "top");
  menuButton.title = t("history.action.more");
  menuButton.setAttribute("data-i18n-title", "history.action.more");
  menuButton.innerHTML = '<i data-lucide="ellipsis"></i>';

  const menuList = document.createElement("div");
  menuList.className = "history-row__menu-list";
  menuList.setAttribute("role", "menu");

  const openSourceItem = menuItem(
    t("history.action.openSource"),
    "external-link",
    {
      disabled: !entry.sourceUrl,
      action: "open-source",
      onClick: () => openHistorySourceLink(entry.sourceUrl),
    },
  );

  const retryItem = menuItem(t("history.action.retry"), "refresh-cw", {
    disabled: !entry.sourceUrl,
    action: "retry",
    onClick: () => retryHistoryCardDownload(entry),
  });

  const inspectItem = menuItem(t("history.action.inspect"), "activity", {
    disabled: entry.isMissing || !entry.filePath,
    action: "inspect",
    onClick: () => openInspectorFromRow(),
  });

  const deleteItem = menuItem(
    t("history.action.deleteFromHistory"),
    "trash-2",
    {
      className: " history-row__delete history-row__menu-item--danger",
      action: "delete-entry",
    },
  );

  menuList.append(openSourceItem, retryItem, inspectItem, deleteItem);
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
  toggle.dataset.action = "details";
  const initialDetailsOpen = state.historyDetailsExpanded === true;
  toggle.classList.toggle("is-open", initialDetailsOpen);
  toggle.setAttribute("aria-expanded", initialDetailsOpen ? "true" : "false");
  const initialToggleLabel = initialDetailsOpen
    ? t("history.details.collapse")
    : t("history.details.expand");
  toggle.setAttribute("aria-label", initialToggleLabel);
  toggle.title = initialToggleLabel;
  toggle.innerHTML = '<i data-lucide="chevron-down"></i>';
  secondaryActions.append(toggle);
  actions.append(primaryActions, secondaryActions);

  const details = document.createElement("div");
  details.className = "history-row__details";
  if (initialDetailsOpen) {
    details.classList.add("is-open");
    el.classList.add("is-open");
  }

  const detailsContent = document.createElement("div");
  detailsContent.className = "history-row__details-content";

  const preview = document.createElement("div");
  preview.className = `history-row__details-preview history-row__preview${hasPreview ? "" : " is-placeholder"}`;
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
    downloadPreviewBtn.innerHTML = '<i data-lucide="download"></i>';
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
    icon.setAttribute("data-lucide", "image");
    preview.appendChild(icon);
  }
  const previewOverlay = document.createElement("button");
  previewOverlay.type = "button";
  previewOverlay.className = "history-row__preview-play";
  previewOverlay.setAttribute("aria-label", t("history.action.openFile"));
  previewOverlay.setAttribute("data-i18n-aria", "history.action.openFile");
  previewOverlay.setAttribute("data-bs-toggle", "tooltip");
  previewOverlay.setAttribute("data-bs-placement", "top");
  previewOverlay.title = t("history.action.openFile");
  previewOverlay.disabled = entry.isMissing || !entry.filePath;
  previewOverlay.innerHTML = '<i data-lucide="play"></i>';
  previewOverlay.addEventListener("click", async (event) => {
    event.preventDefault();
    event.stopPropagation();
    await openHistoryCardFile(entry);
  });
  preview.appendChild(previewOverlay);
  const durationLabel = formatDurationLabel(entry);
  if (durationLabel) {
    const durationBadge = document.createElement("span");
    durationBadge.className = "history-row__preview-duration";
    durationBadge.textContent = durationLabel;
    preview.appendChild(durationBadge);
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

  const detailsList = document.createElement("div");
  detailsList.className = "history-row__details-list";
  const inspectorSlot = document.createElement("section");
  inspectorSlot.className = "history-row-inspector-slot hidden";

  const addDetail = (label, value, options = {}) => {
    if (!value) return;
    const row = document.createElement("div");
    row.className = "history-row__details-item";
    if (options.kind) row.dataset.detailKind = options.kind;
    const labelWrap = document.createElement("div");
    labelWrap.className = "history-row__details-label";
    const icon = document.createElement("span");
    icon.className = "history-row__details-icon";
    icon.setAttribute("aria-hidden", "true");
    icon.innerHTML = `<i data-lucide="${options.icon || "info"}"></i>`;
    const key = document.createElement("span");
    key.className = "history-row__details-key";
    key.textContent = label;
    labelWrap.append(icon, key);
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
    if (options.actionIcon && options.actionLabel && options.onAction) {
      const actionBtn = document.createElement("button");
      actionBtn.type = "button";
      actionBtn.className = "history-row__details-action history-row__copy";
      if (options.actionName) actionBtn.dataset.action = options.actionName;
      actionBtn.setAttribute("aria-label", options.actionLabel);
      actionBtn.setAttribute("data-bs-toggle", "tooltip");
      actionBtn.setAttribute("data-bs-placement", "top");
      actionBtn.title = options.actionLabel;
      actionBtn.innerHTML = `<i data-lucide="${options.actionIcon}"></i>`;
      actionBtn.disabled = options.actionDisabled === true;
      actionBtn.addEventListener("click", async (event) => {
        event.preventDefault();
        event.stopPropagation();
        await options.onAction();
      });
      valueWrap.appendChild(actionBtn);
    }
    row.append(labelWrap, valueWrap);
    detailsList.appendChild(row);
  };

  addDetail(
    t("history.detail.source"),
    highlightText(entry.sourceUrl || "", state.currentSearchQuery),
    {
      icon: "link",
      kind: "source",
      html: true,
      truncate: true,
      copyValue: entry.sourceUrl || "",
      actionIcon: "external-link",
      actionLabel: t("history.action.openSource"),
      actionName: "open-source",
      actionDisabled: !entry.sourceUrl,
      onAction: () => openHistorySourceLink(entry.sourceUrl),
    },
  );
  addDetail(t("history.detail.file"), entry.filePath || "", {
    icon: "file",
    kind: "file",
    truncate: true,
    copyValue: entry.filePath || "",
    actionIcon: "folder-open",
    actionLabel: t("history.action.openFolderShort"),
    actionName: "open-folder",
    actionDisabled: entry.isMissing || !entry.filePath,
    onAction: () => openHistoryCardFolder(entry),
  });
  if (isFailedHistoryEntry(entry)) {
    addDetail(t("history.detail.status"), t("history.failed.badge"), {
      icon: "circle-alert",
      kind: "status",
    });
    addDetail(
      t("history.detail.failureReason"),
      formatDownloadHistoryReason({
        errorCode: entry?.errorCode,
        message: entry?.errorMessage || "",
        retryable: entry?.retryable,
      }),
      {
        icon: "triangle-alert",
        kind: "failure-reason",
      },
    );
    addDetail(
      t("history.detail.retryState"),
      t(getHistoryRetryStateKey(entry)),
      {
        icon: "refresh-cw",
        kind: "retry-state",
      },
    );
  }
  addDetail(t("history.detail.quality"), formatHistoryQualityDetails(entry), {
    icon: "monitor-play",
    kind: "quality",
  });
  addDetail(t("history.detail.size"), formatSizeLabel(entry), {
    icon: "hard-drive",
    kind: "size",
  });
  addDetail(t("history.detail.date"), entry.dateText || "", {
    icon: "calendar-clock",
    kind: "date",
  });

  detailsContent.append(preview, detailsList);
  details.append(detailsContent, inspectorSlot);

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

  const setDetailsOpen = (nextOpen, event = null) => {
    event?.stopPropagation?.();
    const isOpen = !!nextOpen;
    if (!isOpen && activeHistoryInspectorRoot === inspectorSlot) {
      hideActiveHistoryInspector();
    }
    details.classList.toggle("is-open", isOpen);
    el.classList.toggle("is-open", isOpen);
    toggle.classList.toggle("is-open", isOpen);
    toggle.setAttribute("aria-expanded", isOpen ? "true" : "false");
    const label = isOpen
      ? t("history.details.collapse")
      : t("history.details.expand");
    toggle.setAttribute("aria-label", label);
    toggle.title = label;
    updateToggleAllButtonState();
  };

  const toggleDetails = (event = null) =>
    setDetailsOpen(!details.classList.contains("is-open"), event);

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

  const openInspectorFromRow = () =>
    inspectHistoryCardFile(entry, {
      root: inspectorSlot,
      trigger: menuButton,
      ensureVisible: () => {
        if (!details.classList.contains("is-open")) {
          setDetailsOpen(true);
        }
      },
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

function attachDeleteListeners(root = document) {
  const deleteButtons = root.querySelectorAll(".history-row__delete");
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
  const headerStats = getHistoryStats(fullEntries);
  const isEmpty = totalEntries === 0;
  lastRenderedFiltered = fullEntries;
  lastRenderedPageEntries = pageEntries;
  buildFilterOptions(fullEntries);
  updateRestoreButton();
  ensureHistoryEmptyElement();
  updateHistoryHeaderStats({
    count,
    sizeBytes: headerStats.sizeBytes,
  });

  const container = document.getElementById("history");
  applyHistoryDensity();
  bindHistoryMenuClose();
  closeHistoryMoreMenu();
  hideActiveHistoryInspector();

  disposeAllTooltips(); // очистка старых тултипов перед новой инициализацией

  clearHistoryContainer(container);
  syncSelectedEntriesWith(getHistoryData());

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
    updateSearchClearButtonVisibility();
    refreshHistoryLucideIcons();
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

  let lastGroupKey = null;
  const groupCounts = getHistoryGroupCounts(pageEntries);
  pageEntries.forEach((entry) => {
    const entryDate = normalizeEntryDate(entry);
    const groupKey = getDayKey(entryDate);
    if (groupKey !== lastGroupKey) {
      lastGroupKey = groupKey;
      container.appendChild(
        createHistoryGroupElement(
          entry,
          groupKey,
          groupCounts.get(groupKey) || 0,
        ),
      );
    }

    const { el } = createLogEntry(entry, groupKey);
    container.appendChild(el);
  });
  requestAnimationFrame(() => {
    updateTitleTruncation();
    initTooltips();
    updateGroupSelectionLabels();
    refreshHistoryLucideIcons();
  });
  attachDeleteListeners();

  const highlighted = container.querySelector(".new-entry");
  if (highlighted) {
    highlighted.scrollIntoView({ behavior: "auto", block: "center" });
  }

  updateDeleteSelectedButton();

  updatePaginationControls({
    page,
    totalPages,
    totalEntries: count,
    pageSize,
  });
  updateToggleAllButtonState();
  updateSearchClearButtonVisibility();
  refreshHistoryLucideIcons();
}

async function initHistoryState() {
  try {
    ensureHistoryControlElements();
    bindHistorySearchClearVisibility();
    syncHistorySelectValues();
    applyHistoryFiltersState();
    await refreshHistoryFromDisk();

    setFilterInputValue(state.currentSearchQuery || "");
    updateSearchClearButtonVisibility();
    refreshHistoryLucideIcons();
    syncHistoryHeaderStatsFromCache();
    setHistoryPanelVisible(state.historyVisible, { animate: false });
    updateButtonState();
    updateIcon("");
  } catch (error) {
    console.error("Error during initial load:", error);
    showToast(t("history.toast.loadError"), "error");
  }
}

function initHistory() {
  ensureHistoryControlElements();
  bindHistorySearchClearVisibility();
  try {
    historyFiltersCollapsed =
      localStorage.getItem(HISTORY_FILTERS_COLLAPSED_KEY) === "1";
  } catch {
    historyFiltersCollapsed = false;
  }
  bindHistoryFiltersToggle();
  applyHistoryFiltersState();
  syncHistorySelectValues();
  bindHistoryMoreMenu();
  applyHistoryDensity();
  if (!historyUpdateBound && window.electron?.onHistoryUpdated) {
    historyUpdateBound = true;
    window.electron.onHistoryUpdated(handleHistoryUpdated);
  }
  historySourceFilterSelect?.addEventListener("change", (e) => {
    state.historySourceFilter = e.target.value || "";
    localStorage.setItem("historySourceFilter", state.historySourceFilter);
    state.historyPage = 1;
    historySelectUIs.source?.updateLabel?.();
    updateHistoryActiveFiltersUi();
    filterAndSortHistory(
      state.currentSearchQuery,
      state.currentSortOrder,
      true,
    );
  });
  historySortKeySelect?.addEventListener("change", (e) => {
    state.currentSortKey = e.target.value || HISTORY_FILTER_DEFAULTS.sortKey;
    localStorage.setItem("currentSortKey", state.currentSortKey);
    historySelectUIs.sortKey?.updateLabel?.();
    updateHistoryActiveFiltersUi();
    filterAndSortHistory(
      state.currentSearchQuery,
      state.currentSortOrder,
      true,
    );
  });
  historySortModeSelect?.addEventListener("change", (e) => {
    state.currentSortMode = e.target.value || HISTORY_FILTER_DEFAULTS.sortMode;
    localStorage.setItem("currentSortMode", state.currentSortMode);
    historySelectUIs.sortMode?.updateLabel?.();
    updateHistoryActiveFiltersUi();
    filterAndSortHistory(
      state.currentSearchQuery,
      state.currentSortOrder,
      true,
    );
  });
  historyResetFiltersButton?.addEventListener("click", () =>
    resetHistoryFilters(),
  );
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
  if (history && history.dataset.groupToggleBound !== "1") {
    history.dataset.groupToggleBound = "1";
    history.addEventListener("click", (event) => {
      const toggle = event.target.closest(".history-group__toggle");
      if (!toggle) return;
      event.preventDefault();
      event.stopPropagation();
      const groupKey = toggle.dataset.groupKey || "";
      if (!groupKey) return;
      toggleGroupSelection(groupKey);
    });
  }

  openHistoryButton.addEventListener("click", () => {
    const newVisibility = !state.historyVisible;
    toggleHistoryVisibility(newVisibility);
    setHistoryPanelVisible(state.historyVisible);
    if (
      state.historyVisible &&
      (state.historyStale || !state.historyHydrated)
    ) {
      if (historyUpdateTimer) {
        window.clearTimeout(historyUpdateTimer);
        historyUpdateTimer = null;
      }
      void refreshHistoryFromDisk();
    }
    // queueMicrotask(() => initTooltips());
    // if (tooltipInstance) tooltipInstance.hide();
  });

  setHistoryPanelVisible(state.historyVisible, { animate: false });
  refreshHistoryLucideIcons();

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
}

const sortHistory = (order = "desc") => {
  state.currentSortOrder = order;
  filterAndSortHistory(state.currentSearchQuery, state.currentSortOrder, true);
};

function syncHistoryHeaderStatsFromCache() {
  const stats = getHistoryStats(getHistoryData());
  updateHistoryHeaderStats({
    count: stats.count,
    sizeBytes: stats.sizeBytes,
  });
}

const loadHistory = async (forceRender = false) => {
  if (historyLoadPromise) return historyLoadPromise;

  historyLoadPromise = (async () => {
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
    state.historyHydrated = true;

    filterAndSortHistory(
      state.currentSearchQuery,
      state.currentSortOrder,
      forceRender,
    );

    restoreMissingHistoryPreviews(entries, rawHistory).catch((error) => {
      console.warn("Ошибка при восстановлении превью истории:", error);
    });
    return entries;
  })();

  try {
    return await historyLoadPromise;
  } catch (error) {
    console.error("Ошибка загрузки истории:", error);
    showToast(t("history.toast.loadError"), "error");
    return null;
  } finally {
    historyLoadPromise = null;
  }
};

const refreshHistoryFromDisk = async () => {
  const requestedGeneration = historyUpdateGeneration;
  const entries = await loadHistory(true);
  if (entries === null) return null;

  if (requestedGeneration === historyUpdateGeneration) {
    state.historyStale = false;
  } else if (state.historyVisible) {
    scheduleHistoryUpdateReload();
  }
  return entries;
};

function scheduleHistoryUpdateReload(delay = HISTORY_UPDATE_DEBOUNCE_MS) {
  if (!state.historyVisible) return;
  if (historyUpdateTimer) window.clearTimeout(historyUpdateTimer);
  historyUpdateTimer = window.setTimeout(() => {
    historyUpdateTimer = null;
    void refreshHistoryFromDisk();
  }, delay);
}

function handleHistoryUpdated(payload = {}) {
  historyUpdateGeneration += 1;
  state.historyStale = true;

  const count = Number(payload?.count);
  if (Number.isFinite(count) && count >= 0) {
    updateHistoryHeaderStats({
      count,
      sizeBytes: getHistoryStats(getHistoryData()).sizeBytes,
    });
  }

  if (state.historyVisible) {
    scheduleHistoryUpdateReload();
  } else if (historyUpdateTimer) {
    window.clearTimeout(historyUpdateTimer);
    historyUpdateTimer = null;
  }
}

const addNewEntryToHistory = async (
  newEntryRaw,
  { replaceExistingFilePath = true } = {},
) => {
  const previousHistory = [...getHistoryData()];
  try {
    const normalized = await normalizeEntry(newEntryRaw);
    normalized._highlight = true;

    const existingHistory = getHistoryData();
    const existingIndex =
      replaceExistingFilePath && normalized.filePath
        ? existingHistory.findIndex(
            (entry) => entry.filePath === normalized.filePath,
          )
        : -1;

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
    const saveResult = await window.electron.invoke("save-history", updated);
    if (saveResult?.success === false) {
      throw new Error(saveResult.error || "History save failed");
    }
    if (removedPreviews.length) {
      try {
        await window.electron.invoke("delete-history-preview", removedPreviews);
      } catch (err) {
        console.warn("Не удалось удалить старое превью:", err);
      }
    }
    filterAndSortHistory(state.currentSearchQuery, state.currentSortOrder);

    return true;
  } catch (error) {
    setHistoryData(previousHistory);
    console.error("Ошибка при добавлении записи в историю:", error);
    showToast(t("history.toast.addError"), "error");
    return false;
  }
};

export {
  initHistory,
  initHistoryState,
  getHistoryData,
  renderHistory,
  sortHistory,
  loadHistory,
  refreshHistoryFromDisk,
  addNewEntryToHistory,
  updateDeleteSelectedButton,
  clearHistorySelection,
  rememberDeletedEntries,
};
