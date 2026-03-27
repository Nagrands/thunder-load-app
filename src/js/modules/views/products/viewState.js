import { t } from "../../i18n.js";
import { initTooltips } from "../../tooltipInitializer.js";
import { buildSectionStateKey, inspectDictionaryText } from "./viewHelpers.js";
import { getMetrics, setCopyButtonState } from "./viewRenderers.js";

export function createViewStateHandlers({
  wrapper,
  state,
  input,
  dictionaryInput,
  dictionaryMeta,
  dictionaryLayer,
  dictionaryPanel,
  dictionaryToggleButton,
  copyButton,
  preview,
  summaryCard,
  resultContent,
  resultMeta,
  normalizationStats,
  diagnostics,
  issuesList,
  diffList,
  comparisonPanel,
  comparisonSummary,
  comparisonList,
  metaSections,
  metaItems,
  metaSummary,
  metaGreens,
  filterUncertainToggle,
  dirtyState,
  empty,
  formatButton,
  setStatus,
  showResult,
}) {
  const updateDirtyState = () => {
    if (dirtyState) {
      dirtyState.hidden = !state.isDirty;
    }
    if (copyButton) {
      copyButton.disabled = !state.hasResult || state.isDirty;
      setCopyButtonState(copyButton, state.hasResult ? "ready" : "idle");
    }
    wrapper.querySelectorAll(".products-section-copy").forEach((button) => {
      button.disabled = state.isDirty;
    });
    if (formatButton) {
      formatButton.dataset.dirty = state.isDirty ? "true" : "false";
    }
  };

  const updateDictionaryMeta = () => {
    if (!dictionaryInput || !dictionaryMeta) return;
    const validation = inspectDictionaryText(dictionaryInput.value);
    dictionaryInput.classList.toggle(
      "products-dictionary__textarea--invalid",
      validation.invalidLines.length > 0,
    );
    dictionaryMeta.dataset.tone =
      validation.invalidLines.length > 0 ? "warning" : "default";
    if (!validation.validCount && validation.invalidLines.length) {
      dictionaryMeta.textContent = t("productsFormatter.dictionaryStatsInvalid", {
        invalid: validation.invalidLines.join(", "),
      });
      return;
    }
    dictionaryMeta.textContent = validation.invalidLines.length
      ? t("productsFormatter.dictionaryStatsMixed", {
          count: validation.validCount,
          invalid: validation.invalidLines.join(", "),
        })
      : t("productsFormatter.dictionaryStatsValid", {
          count: validation.validCount,
        });
  };

  const syncDirtyFromInputs = (statusKey = "productsFormatter.status.stale") => {
    if (!state.currentResult) {
      state.isDirty = false;
      updateDirtyState();
      return;
    }
    state.isDirty =
      String(input?.value || "") !== state.lastFormattedSource ||
      String(dictionaryInput?.value || "") !== state.lastFormattedDictionary;
    updateDirtyState();
    if (state.isDirty) {
      setStatus(t(statusKey), "warning");
    }
  };

  const syncDictionaryPanel = () => {
    if (!dictionaryLayer || !dictionaryPanel) return;
    dictionaryLayer.hidden = !state.dictionaryOpen;
    dictionaryPanel.setAttribute(
      "aria-hidden",
      state.dictionaryOpen ? "false" : "true",
    );
    if (dictionaryToggleButton) {
      dictionaryToggleButton.setAttribute(
        "aria-expanded",
        String(state.dictionaryOpen),
      );
    }
    if (state.dictionaryOpen) {
      initTooltips(wrapper);
      dictionaryInput?.focus();
    }
  };

  const clearCopyFeedbackTimer = () => {
    if (!state.copyFeedbackTimer) return;
    clearTimeout(state.copyFeedbackTimer);
    state.copyFeedbackTimer = null;
  };

  const clearSectionCopyFeedbackTimer = () => {
    if (!state.sectionCopyFeedbackTimer) return;
    clearTimeout(state.sectionCopyFeedbackTimer);
    state.sectionCopyFeedbackTimer = null;
  };

  const resetPreview = ({ resetComparison = false } = {}) => {
    state.copiedText = "";
    state.hasResult = false;
    clearCopyFeedbackTimer();
    clearSectionCopyFeedbackTimer();
    preview?.replaceChildren();
    summaryCard?.replaceChildren();
    if (summaryCard) summaryCard.hidden = true;
    if (resultContent) resultContent.hidden = true;
    if (resultMeta) resultMeta.hidden = true;
    if (normalizationStats) normalizationStats.hidden = true;
    if (diagnostics) diagnostics.hidden = true;
    issuesList?.replaceChildren();
    diffList?.replaceChildren();
    comparisonSummary?.replaceChildren();
    comparisonList?.replaceChildren();
    if (comparisonPanel) comparisonPanel.hidden = true;
    if (empty) empty.hidden = false;
    if (copyButton) {
      copyButton.disabled = true;
      setCopyButtonState(copyButton, "idle");
    }
    if (resetComparison) {
      state.previousResult = null;
      state.currentResult = null;
      state.collapsedSections = {};
      state.lastFormattedSource = "";
      state.lastFormattedDictionary = "";
    }
    state.isDirty = false;
    state.showOnlyUncertain = false;
    if (filterUncertainToggle) filterUncertainToggle.checked = false;
    updateDirtyState();
  };

  const closeDictionaryPanel = ({ restoreFocus = true } = {}) => {
    if (!state.dictionaryOpen) return;
    state.dictionaryOpen = false;
    syncDictionaryPanel();
    if (restoreFocus) {
      const focusTarget = state.dictionaryReturnFocus || dictionaryToggleButton;
      if (focusTarget instanceof HTMLElement) {
        focusTarget.focus();
      }
    }
    state.dictionaryReturnFocus = null;
  };

  const openDictionaryPanel = () => {
    state.dictionaryReturnFocus =
      document.activeElement instanceof HTMLElement
        ? document.activeElement
        : dictionaryToggleButton;
    state.dictionaryOpen = true;
    syncDictionaryPanel();
  };

  const updateMetrics = (result) => {
    const metrics = getMetrics(result);
    if (metaSections) {
      metaSections.textContent = t("productsFormatter.meta.sections", {
        count: metrics.sectionCount,
      });
    }
    if (metaItems) {
      metaItems.textContent = t("productsFormatter.meta.items", {
        count: metrics.itemCount,
      });
    }
    if (metaSummary) {
      metaSummary.textContent = metrics.hasSummary
        ? t("productsFormatter.meta.summaryOn")
        : t("productsFormatter.meta.summaryOff");
    }
    if (metaGreens) {
      metaGreens.textContent = metrics.hasGreensSummary
        ? t("productsFormatter.meta.greensOn")
        : t("productsFormatter.meta.greensOff");
    }
  };

  const applyCollapsedStateToAll = (collapsed) => {
    if (!state.currentResult) return;
    if (!collapsed) {
      state.collapsedSections = {};
      showResult(state.currentResult);
      return;
    }

    const nextState = {};
    state.currentResult.sections.forEach((section) => {
      nextState[buildSectionStateKey("section", section.title)] = true;
    });
    if (state.currentResult.summary) {
      nextState[
        buildSectionStateKey("summary", state.currentResult.summary.title)
      ] = true;
    }
    if (state.currentResult.greensSummary) {
      nextState[
        buildSectionStateKey("greens", state.currentResult.greensSummary.title)
      ] = true;
    }
    state.collapsedSections = nextState;
    showResult(state.currentResult);
  };

  return {
    applyCollapsedStateToAll,
    clearCopyFeedbackTimer,
    clearSectionCopyFeedbackTimer,
    closeDictionaryPanel,
    openDictionaryPanel,
    resetPreview,
    syncDictionaryPanel,
    syncDirtyFromInputs,
    updateDictionaryMeta,
    updateDirtyState,
    updateMetrics,
  };
}
