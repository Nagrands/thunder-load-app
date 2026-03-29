import { t } from "../../i18n.js";
import { initTooltips } from "../../tooltipInitializer.js";
import { buildSectionStateKey, inspectDictionaryText } from "./viewHelpers.js";
import { setCopyButtonState, setResultMenuState } from "./viewRenderers.js";

export function createViewStateHandlers({
  wrapper,
  state,
  input,
  dictionaryInput,
  dictionaryMeta,
  dictionaryPreview,
  dictionaryPreviewBody,
  dictionarySummary,
  dictionaryCleanInvalidButton,
  dictionaryLayer,
  dictionaryPanel,
  dictionaryToggleButton,
  resultPane,
  copyButton,
  resultToolbar,
  preview,
  summaryCard,
  resultContent,
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
}) {
  const clearDirtyStatusIfNeeded = () => {
    const statusEl = wrapper.querySelector("#products-status");
    const currentText = String(statusEl?.textContent || "").trim();
    const staleMessage = t("productsFormatter.status.stale");
    const dictionaryChangedMessage = t("productsFormatter.status.dictionaryChanged");
    if (currentText === staleMessage || currentText === dictionaryChangedMessage) {
      setStatus("", "");
    }
  };

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
    if (searchInput) {
      searchInput.disabled = !state.hasResult;
    }
    if (resultMenuToggle) {
      resultMenuToggle.disabled = !state.hasResult;
    }
  };

  const updateDictionaryMeta = () => {
    if (!dictionaryInput || !dictionaryMeta) return;
    const validation = inspectDictionaryText(dictionaryInput.value, {
      lineNumber: state.activeDictionaryLine,
    });
    const problemLines = [
      ...validation.invalidLines,
      ...validation.duplicateLines,
      ...validation.noopLines,
    ].sort((left, right) => left - right);
    const hasProblems = problemLines.length > 0;
    dictionaryInput.classList.toggle(
      "products-dictionary__textarea--invalid",
      hasProblems,
    );
    dictionaryMeta.dataset.tone =
      hasProblems ? "warning" : "default";
    const countsText = !validation.validCount && hasProblems
      ? t("productsFormatter.dictionaryStatsInvalid", {
          duplicates: validation.duplicateLines.length,
          noop: validation.noopLines.length,
          overrides: validation.overrideLines.length,
          invalid: validation.invalidLines.length,
        })
      : hasProblems || validation.overrideLines.length
        ? t("productsFormatter.dictionaryStatsMixed", {
            count: validation.validCount,
            duplicates: validation.duplicateLines.length,
            noop: validation.noopLines.length,
            overrides: validation.overrideLines.length,
            invalid: validation.invalidLines.length,
          })
        : t("productsFormatter.dictionaryStatsValid", {
            count: validation.validCount,
          });
    if (!validation.validCount && hasProblems) {
      dictionaryMeta.textContent = `${countsText} ${t("productsFormatter.dictionaryProblemLines", {
        lines: problemLines.join(", "),
      })}`;
      return;
    }
    dictionaryMeta.textContent = hasProblems
      ? `${countsText} ${t("productsFormatter.dictionaryProblemLines", {
          lines: problemLines.join(", "),
        })}`
      : countsText;

    if (dictionarySummary) {
      const summaryItems = [
        {
          key: "invalid",
          label: t("productsFormatter.dictionaryCategoryInvalid"),
          count: validation.invalidLines.length,
          line: validation.invalidLines[0],
        },
        {
          key: "duplicate",
          label: t("productsFormatter.dictionaryCategoryDuplicate"),
          count: validation.duplicateLines.length,
          line: validation.duplicateLines[0],
        },
        {
          key: "noop",
          label: t("productsFormatter.dictionaryCategoryNoop"),
          count: validation.noopLines.length,
          line: validation.noopLines[0],
        },
        {
          key: "override",
          label: t("productsFormatter.dictionaryCategoryOverride"),
          count: validation.overrideLines.length,
          line: validation.overrideLines[0],
        },
      ].filter((item) => item.count > 0);

      dictionarySummary.replaceChildren();
      dictionarySummary.hidden = summaryItems.length === 0;

      summaryItems.forEach((item) => {
        const button = document.createElement("button");
        button.type = "button";
        button.className = "products-dictionary__chip";
        button.dataset.dictionaryJump = item.key;
        button.dataset.line = String(item.line || 1);
        button.textContent = `${item.label}: ${item.count}`;
        button.setAttribute(
          "aria-label",
          t("productsFormatter.dictionaryJumpToLine", {
            label: item.label,
            line: item.line || 1,
          }),
        );
        dictionarySummary.append(button);
      });
    }

    if (dictionaryCleanInvalidButton) {
      dictionaryCleanInvalidButton.disabled = validation.invalidLines.length === 0;
    }

    if (dictionaryPreview && dictionaryPreviewBody) {
      const preview = validation.previewEntry;
      dictionaryPreview.dataset.tone = "default";
      if (!preview) {
        dictionaryPreviewBody.textContent = t("productsFormatter.dictionaryPreviewEmpty");
      } else if (preview.invalid) {
        dictionaryPreview.dataset.tone = "warning";
        dictionaryPreviewBody.textContent = t("productsFormatter.dictionaryPreviewInvalid", {
          line: preview.lineNumber,
        });
      } else if (preview.noop) {
        dictionaryPreview.dataset.tone = "warning";
        dictionaryPreviewBody.textContent = t("productsFormatter.dictionaryPreviewNoop", {
          source: preview.normalizedSource || preview.source,
        });
      } else {
        const extra = preview.override
          ? ` ${t("productsFormatter.dictionaryPreviewOverride", {
              target: preview.builtInTarget,
            })}`
          : preview.duplicate
            ? ` ${t("productsFormatter.dictionaryPreviewDuplicate")}`
            : "";
        dictionaryPreviewBody.textContent = t("productsFormatter.dictionaryPreviewValue", {
          source: preview.normalizedSource,
          target: preview.target,
        }) + extra;
      }
    }
  };

  const syncDirtyFromInputs = (statusKey = "productsFormatter.status.stale") => {
    if (!state.currentResult) {
      state.isDirty = false;
      updateDirtyState();
      clearDirtyStatusIfNeeded();
      return;
    }
    state.isDirty =
      String(input?.value || "") !== state.lastFormattedSource ||
      String(dictionaryInput?.value || "") !== state.lastFormattedDictionary;
    updateDirtyState();
    if (state.isDirty) {
      setStatus(t(statusKey), "warning");
      return;
    }
    clearDirtyStatusIfNeeded();
  };

  const syncDictionaryPanel = () => {
    if (!dictionaryLayer || !dictionaryPanel) return;
    wrapper.classList.toggle("products-view--dictionary-open", state.dictionaryOpen);
    dictionaryLayer.hidden = !state.dictionaryOpen;
    dictionaryLayer.setAttribute("aria-hidden", state.dictionaryOpen ? "false" : "true");
    dictionaryPanel.setAttribute("aria-hidden", state.dictionaryOpen ? "false" : "true");
    if (resultPane) {
      resultPane.hidden = state.dictionaryOpen;
      resultPane.setAttribute("aria-hidden", state.dictionaryOpen ? "true" : "false");
    }
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
    if (resultToolbar) resultToolbar.hidden = true;
    if (resultContent) resultContent.hidden = true;
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
    state.resultSearchQuery = "";
    state.resultMenuOpen = false;
    if (filterUncertainToggle) filterUncertainToggle.checked = false;
    filterUncertainToggle
      ?.closest('[role="menuitemcheckbox"]')
      ?.setAttribute("aria-checked", "false");
    if (searchInput) searchInput.value = "";
    setResultMenuState(resultMenuToggle, resultMenuPanel, false);
    updateDirtyState();
  };

  const closeDictionaryPanel = () => {
    if (!state.dictionaryOpen) return;
    state.dictionaryOpen = false;
    syncDictionaryPanel();
  };

  const openDictionaryPanel = () => {
    state.dictionaryOpen = true;
    syncDictionaryPanel();
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
  };
}
