import { formatProductLists } from "../formatters/productListFormatter.js";
import {
  clearProductFormatterDictionary,
  loadProductFormatterDictionary,
  parseProductFormatterDictionary,
  saveProductFormatterDictionary,
} from "../formatters/productFormatterDictionary.js";
import { cleanupEntryText } from "../formatters/productListFormatterParsing.js";
import { applyI18n, t } from "../i18n.js";
import { initTooltips } from "../tooltipInitializer.js";
import {
  buildComparison,
  copyText,
  getFocusableElements,
} from "./products/viewHelpers.js";
import {
  renderComparison,
  renderDiagnostics,
  renderNormalizationStats,
  renderPreview,
  setCopyButtonState,
  setResultMenuState,
  setSectionCopyButtonState,
} from "./products/viewRenderers.js";
import { bindViewEvents } from "./products/viewEvents.js";
import { buildMarkup } from "./products/viewMarkup.js";
import { createViewStateHandlers } from "./products/viewState.js";

const DEMO_INPUT = `Витамин
Банан пол пака
Лимон 2кг

Тесто
Грибы 4 кг.
картофель 10 кг.
помидоры 500г
огурцы 1 кг.
перец болгарский 5 шт.
укроп 2 пуч.
петрушка 2 Пуч.
Чеснок 0,5
Лимон 4шт

Магазин
Киви
Банан
Картофель бел 2
Укроп 20
Лук Марс
ПетрушкаЦ 15`;

function buildFormatterOptions(includeSummary, includeGreensSummary, dictionaryInput) {
  return {
    includeSummary: includeSummary?.checked !== false,
    includeGreensSummary: includeGreensSummary?.checked === true,
    replacements: parseProductFormatterDictionary(dictionaryInput?.value || ""),
    labels: {
      summary: t("productsFormatter.summaryTitle"),
      greens: t("productsFormatter.greensTitle"),
      unsorted: t("productsFormatter.unsorted"),
    },
  };
}

export default function renderProductFormatterView(wrapper) {
  if (!wrapper) return wrapper;

  if (!wrapper.__productsFormatterBuilt) {
    wrapper.innerHTML = buildMarkup();
    wrapper.classList.add("products-view", "tab-content");
    wrapper.__productsFormatterBuilt = true;
  }

  const input = wrapper.querySelector("#products-input");
  const includeSummary = wrapper.querySelector("#products-summary-toggle");
  const includeGreensSummary = wrapper.querySelector("#products-greens-toggle");
  const formatButton = wrapper.querySelector("#products-format");
  const pasteButton = wrapper.querySelector("#products-paste");
  const clearButton = wrapper.querySelector("#products-clear");
  const demoButton = wrapper.querySelector("#products-demo");
  const dictionaryToggleButton = wrapper.querySelector(
    "#products-dictionary-toggle",
  );
  const dictionaryLayer = wrapper.querySelector("#products-dictionary-layer");
  const dictionaryPanel = wrapper.querySelector("#products-dictionary-panel");
  const dictionaryBackdrop = wrapper.querySelector(
    '[data-ui="products-dictionary-backdrop"]',
  );
  const dictionaryInput = wrapper.querySelector("#products-dictionary-input");
  const dictionaryMeta = wrapper.querySelector("#products-dictionary-meta");
  const dictionaryResetButton = wrapper.querySelector("#products-dictionary-reset");
  const dictionaryCloseButton = wrapper.querySelector("#products-dictionary-close");
  const emptyPasteButton = wrapper.querySelector("#products-empty-paste");
  const emptyDemoButton = wrapper.querySelector("#products-empty-demo");
  const copyButton = wrapper.querySelector("#products-copy");
  const searchInput = wrapper.querySelector("#products-search");
  const resultToolbar = wrapper.querySelector('[data-ui="products-result-toolbar"]');
  const preview = wrapper.querySelector("#products-preview");
  const summaryCard = wrapper.querySelector("#products-summary-card");
  const resultContent = wrapper.querySelector("#products-result-content");
  const normalizationStats = wrapper.querySelector("#products-normalization-stats");
  const diagnostics = wrapper.querySelector("#products-diagnostics");
  const issuesList = wrapper.querySelector("#products-issues-list");
  const diffList = wrapper.querySelector("#products-diff-list");
  const comparisonPanel = wrapper.querySelector("#products-comparison-panel");
  const comparisonSummary = wrapper.querySelector("#products-comparison-summary");
  const comparisonList = wrapper.querySelector("#products-comparison-list");
  const collapseAllButton = wrapper.querySelector("#products-collapse-all");
  const expandAllButton = wrapper.querySelector("#products-expand-all");
  const applyInputButton = wrapper.querySelector("#products-apply-input");
  const filterUncertainToggle = wrapper.querySelector("#products-filter-uncertain");
  const resultMenu = wrapper.querySelector('[data-ui="products-result-menu"]');
  const resultMenuToggle = wrapper.querySelector("#products-result-menu-toggle");
  const resultMenuPanel = wrapper.querySelector(
    '[data-ui="products-result-menu-panel"]',
  );
  const diagnosticsFilters = Array.from(
    wrapper.querySelectorAll(".products-diagnostics__filter"),
  );
  const dirtyState = wrapper.querySelector("#products-dirty-state");
  const empty = wrapper.querySelector("#products-output-empty");
  const status = wrapper.querySelector("#products-status");

  const state =
    wrapper.__productsFormatterState ||
    (wrapper.__productsFormatterState = {
      copiedText: "",
      hasResult: false,
      copyFeedbackTimer: null,
      previousResult: null,
      currentResult: null,
      collapsedSections: {},
      dictionaryOpen: false,
      dictionaryReturnFocus: null,
      sectionCopyFeedbackTimer: null,
      isDirty: false,
      showOnlyUncertain: false,
      resultSearchQuery: "",
      diagnosticsFilter: "all",
      lastFormattedSource: "",
      lastFormattedDictionary: "",
      resultMenuOpen: false,
    });

  const setStatus = (message = "", tone = "") => {
    if (!status) return;
    status.textContent = message;
    if (tone) status.dataset.tone = tone;
    else delete status.dataset.tone;
  };

  const getCurrentSource = () => String(input?.value || "").trim();

  const showResult = (result) => {
    state.copiedText = result.fullOutputText;
    state.hasResult = !!result.fullOutputText;
    state.resultMenuOpen = false;
    setResultMenuState(resultMenuToggle, resultMenuPanel, false);
    clearCopyFeedbackTimer();
    renderPreview(
      preview,
      summaryCard,
      result,
      async (sectionText, sourceButton) => {
        try {
          await copyText(sectionText);
          if (sourceButton) {
            clearSectionCopyFeedbackTimer();
            setSectionCopyButtonState(sourceButton, "success");
            initTooltips(wrapper);
            state.sectionCopyFeedbackTimer = setTimeout(() => {
              setSectionCopyButtonState(sourceButton, "idle");
              initTooltips(wrapper);
              state.sectionCopyFeedbackTimer = null;
            }, 1200);
          }
          clearCopyFeedbackTimer();
          setStatus(t("productsFormatter.status.sectionCopied"), "success");
        } catch {
          setStatus(t("productsFormatter.status.copyError"), "error");
        }
      },
      state.collapsedSections,
      (key, collapsed) => {
        state.collapsedSections[key] = collapsed;
      },
      {
        showOnlyUncertain: state.showOnlyUncertain,
        searchQuery: state.resultSearchQuery,
      },
    );
    renderDiagnostics(issuesList, diffList, diagnostics, result, {
      activeFilter: state.diagnosticsFilter,
      filterButtons: diagnosticsFilters,
      onApplyDiff: (entry) => {
        const lines = String(input?.value || "").split("\n");
        const sourceKey = cleanupEntryText(entry.source);
        const nextLines = [...lines];
        const lineIndex = nextLines.findIndex(
          (line) => cleanupEntryText(line) === sourceKey,
        );
        if (lineIndex === -1) {
          setStatus(t("productsFormatter.status.applyLineError"), "error");
          return;
        }
        nextLines[lineIndex] = entry.output;
        input.value = nextLines.join("\n");
        input.focus();
        syncDirtyFromInputs();
        setStatus(t("productsFormatter.status.lineApplied"), "success");
      },
    });
    renderNormalizationStats(normalizationStats, result);
    renderComparison(
      comparisonSummary,
      comparisonList,
      comparisonPanel,
      buildComparison(state.previousResult, result),
    );
    if (comparisonPanel?.hidden === false && diagnostics) {
      diagnostics.hidden = false;
    }
    if (resultToolbar) resultToolbar.hidden = false;
    if (resultContent) resultContent.hidden = false;
    if (empty) empty.hidden = true;
    state.isDirty = false;
    updateDirtyState();
    initTooltips(wrapper);
  };

  const {
    applyCollapsedStateToAll,
    clearCopyFeedbackTimer,
    clearSectionCopyFeedbackTimer,
    closeDictionaryPanel,
    openDictionaryPanel,
    resetPreview: clearPreview,
    syncDictionaryPanel: syncDictionaryUI,
    syncDirtyFromInputs,
    updateDictionaryMeta: syncDictionaryMeta,
    updateDirtyState,
  } = createViewStateHandlers({
    wrapper,
    state,
    input,
    dictionaryInput,
    dictionaryMeta,
    dictionaryLayer,
    dictionaryPanel,
    dictionaryToggleButton,
    copyButton,
    resultToolbar,
    preview,
    summaryCard,
    resultContent,
    normalizationStats,
    diagnostics,
    issuesList,
    diffList,
    comparisonPanel,
    comparisonSummary,
    comparisonList,
    filterUncertainToggle,
    dirtyState,
    empty,
    searchInput,
    resultMenuToggle,
    resultMenuPanel,
    formatButton,
    setStatus,
    showResult,
  });

  if (searchInput) searchInput.disabled = true;
  if (resultMenuToggle) resultMenuToggle.disabled = true;
  setResultMenuState(resultMenuToggle, resultMenuPanel, false);

  const formatSource = ({
    source = getCurrentSource(),
    statusMessage = t("productsFormatter.status.formatted"),
    comparisonBase = state.currentResult,
  } = {}) => {
    if (!source) {
      clearPreview();
      setStatus(t("productsFormatter.status.empty"), "warning");
      return null;
    }

    const result = formatProductLists(
      source,
      buildFormatterOptions(
        includeSummary,
        includeGreensSummary,
        dictionaryInput,
      ),
    );

    state.previousResult = comparisonBase;
    state.currentResult = result;
    state.lastFormattedSource = String(input?.value || "");
    state.lastFormattedDictionary = String(dictionaryInput?.value || "");
    showResult(result);
    if (statusMessage) {
      setStatus(statusMessage, "success");
    }
    return result;
  };

  bindViewEvents({
    wrapper,
    state,
    input,
    formatButton,
    pasteButton,
    clearButton,
    demoButton,
    dictionaryToggleButton,
    dictionaryPanel,
    dictionaryBackdrop,
    dictionaryInput,
    dictionaryResetButton,
    dictionaryCloseButton,
    emptyPasteButton,
    emptyDemoButton,
    copyButton,
    searchInput,
    applyInputButton,
    collapseAllButton,
    expandAllButton,
    filterUncertainToggle,
    resultMenu,
    resultMenuToggle,
    resultMenuPanel,
    diagnosticsFilters,
    includeSummary,
    includeGreensSummary,
    demoInput: DEMO_INPUT,
    applyCollapsedStateToAll,
    clearPreview,
    closeDictionaryPanel,
    copyText,
    formatProductLists,
    formatSource,
    getCurrentSource,
    getFocusableElements,
    loadProductFormatterDictionary,
    openDictionaryPanel,
    saveProductFormatterDictionary,
    setCopyButtonState,
    buildFormatterOptions,
    clearProductFormatterDictionary,
    syncDictionaryMeta,
    syncDirtyFromInputs,
    clearCopyFeedbackTimer,
    showResult,
    setStatus,
    initTooltips,
    setResultMenuState,
  });

  applyI18n(wrapper);
  syncDictionaryMeta();
  syncDirtyFromInputs();
  syncDictionaryUI();
  initTooltips(wrapper);
  return wrapper;
}
