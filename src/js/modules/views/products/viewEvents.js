import { t } from "../../i18n.js";

export function bindViewEvents({
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
  demoInput,
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
}) {
  if (wrapper.__productsFormatterBound) {
    return;
  }

  const closeResultMenu = ({ focusToggle = false } = {}) => {
    state.resultMenuOpen = false;
    setResultMenuState(resultMenuToggle, resultMenuPanel, false);
    if (focusToggle && resultMenuToggle instanceof HTMLElement) {
      resultMenuToggle.focus();
    }
  };

  const toggleResultMenu = () => {
    state.resultMenuOpen = !state.resultMenuOpen;
    setResultMenuState(resultMenuToggle, resultMenuPanel, state.resultMenuOpen);
  };

  if (dictionaryInput) {
    dictionaryInput.value = loadProductFormatterDictionary();
    syncDictionaryMeta();
    dictionaryInput.addEventListener("input", () => {
      saveProductFormatterDictionary(dictionaryInput.value);
      syncDictionaryMeta();
      syncDirtyFromInputs("productsFormatter.status.dictionaryChanged");
    });
  }

  dictionaryToggleButton?.addEventListener("click", () => {
    if (state.dictionaryOpen) {
      closeDictionaryPanel();
      return;
    }
    openDictionaryPanel();
  });

  dictionaryCloseButton?.addEventListener("click", () => {
    closeDictionaryPanel();
  });

  dictionaryBackdrop?.addEventListener("click", () => {
    closeDictionaryPanel();
  });

  dictionaryPanel?.addEventListener("keydown", (event) => {
    if (event.key === "Escape") {
      event.preventDefault();
      closeDictionaryPanel();
      return;
    }

    if (event.key !== "Tab") return;

    const focusable = getFocusableElements(dictionaryPanel);
    if (!focusable.length) return;
    const first = focusable[0];
    const last = focusable[focusable.length - 1];

    if (event.shiftKey && document.activeElement === first) {
      event.preventDefault();
      last.focus();
    } else if (!event.shiftKey && document.activeElement === last) {
      event.preventDefault();
      first.focus();
    }
  });

  formatButton?.addEventListener("click", () => {
    formatSource();
  });

  pasteButton?.addEventListener("click", async () => {
    try {
      const text = await navigator.clipboard?.readText?.();
      if (!text) {
        clearPreview({ resetComparison: true });
        input.value = "";
        input.focus();
        setStatus(t("productsFormatter.status.pasteEmpty"), "warning");
        return;
      }
      input.value = text;
      input.focus();
      clearPreview({ resetComparison: true });
      setStatus(t("productsFormatter.status.pasted"), "success");
    } catch {
      setStatus(t("productsFormatter.status.pasteError"), "error");
    }
  });

  clearButton?.addEventListener("click", () => {
    input.value = "";
    input.focus();
    clearPreview({ resetComparison: true });
    setStatus(t("productsFormatter.status.cleared"));
  });

  demoButton?.addEventListener("click", () => {
    input.value = demoInput;
    input.focus();
    clearPreview({ resetComparison: true });
    setStatus(t("productsFormatter.status.demoLoaded"), "success");
  });

  dictionaryResetButton?.addEventListener("click", () => {
    if (dictionaryInput) dictionaryInput.value = "";
    clearProductFormatterDictionary();
    syncDictionaryMeta();
    syncDirtyFromInputs("productsFormatter.status.dictionaryChanged");
    if (!state.isDirty) {
      setStatus(t("productsFormatter.status.dictionaryReset"));
    }
  });

  emptyPasteButton?.addEventListener("click", () => {
    pasteButton?.click();
  });

  emptyDemoButton?.addEventListener("click", () => {
    demoButton?.click();
  });

  applyInputButton?.addEventListener("click", () => {
    if (!state.currentResult?.formattedSectionsText) return;
    input.value = state.currentResult.formattedSectionsText;
    input.focus();
    clearPreview({ resetComparison: true });
    setStatus(t("productsFormatter.status.appliedToInput"), "success");
    closeResultMenu();
  });

  copyButton?.addEventListener("click", async () => {
    if (!state.copiedText || state.isDirty) {
      if (state.isDirty) {
        setStatus(t("productsFormatter.status.stale"), "warning");
      }
      return;
    }
    try {
      await copyText(state.copiedText);
      clearCopyFeedbackTimer();
      setCopyButtonState(copyButton, "success");
      initTooltips(wrapper);
      setStatus(t("productsFormatter.status.copied"), "success");
      state.copyFeedbackTimer = setTimeout(() => {
        setCopyButtonState(copyButton, state.hasResult ? "ready" : "idle");
        initTooltips(wrapper);
        state.copyFeedbackTimer = null;
      }, 1400);
    } catch {
      setStatus(t("productsFormatter.status.copyError"), "error");
    }
  });

  input?.addEventListener("input", () => {
    if (String(input.value || "").trim()) {
      syncDirtyFromInputs();
      return;
    }
    clearPreview({ resetComparison: true });
    setStatus("", "");
  });

  searchInput?.addEventListener("input", () => {
    state.resultSearchQuery = String(searchInput.value || "").trim();
    if (!state.currentResult) return;
    showResult(state.currentResult);
  });

  resultMenuToggle?.addEventListener("click", () => {
    toggleResultMenu();
  });

  document.addEventListener("click", (event) => {
    if (!state.resultMenuOpen || !resultMenu) return;
    if (resultMenu.contains(event.target)) return;
    closeResultMenu();
  });

  wrapper.addEventListener("keydown", (event) => {
    if (event.key !== "Escape") return;
    if (!state.resultMenuOpen) return;
    event.preventDefault();
    closeResultMenu({ focusToggle: true });
  });

  const handleToggleReformat = () => {
    const source = getCurrentSource();
    if (!source || !state.currentResult) return;
    const result = formatProductLists(
      source,
      buildFormatterOptions(
        includeSummary,
        includeGreensSummary,
        dictionaryInput,
      ),
    );
    state.currentResult = result;
    state.lastFormattedSource = String(input?.value || "");
    state.lastFormattedDictionary = String(dictionaryInput?.value || "");
    showResult(result);
  };

  includeSummary?.addEventListener("change", handleToggleReformat);
  includeGreensSummary?.addEventListener("change", handleToggleReformat);
  filterUncertainToggle?.addEventListener("change", () => {
    state.showOnlyUncertain = filterUncertainToggle.checked;
    filterUncertainToggle
      ?.closest('[role="menuitemcheckbox"]')
      ?.setAttribute("aria-checked", String(filterUncertainToggle.checked));
    if (!state.currentResult) return;
    showResult(state.currentResult);
    closeResultMenu();
  });
  diagnosticsFilters?.forEach((button) => {
    button.addEventListener("click", () => {
      const nextFilter = button.dataset.filter || "all";
      if (state.diagnosticsFilter === nextFilter) return;
      state.diagnosticsFilter = nextFilter;
      if (!state.currentResult) return;
      showResult(state.currentResult);
    });
  });
  collapseAllButton?.addEventListener("click", () => {
    applyCollapsedStateToAll(true);
    closeResultMenu();
  });
  expandAllButton?.addEventListener("click", () => {
    applyCollapsedStateToAll(false);
    closeResultMenu();
  });

  input?.addEventListener("keydown", (event) => {
    if (event.key !== "Enter") return;
    if (!event.ctrlKey && !event.metaKey) return;
    event.preventDefault();
    formatButton?.click();
  });

  wrapper.__productsFormatterBound = true;
}
