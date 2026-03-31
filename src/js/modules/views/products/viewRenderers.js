import { t } from "../../i18n.js";
import { initTooltips } from "../../tooltipInitializer.js";
import { buildSectionStateKey } from "./viewHelpers.js";

function formatIssue(issue) {
  if (!issue?.code) return "";
  switch (issue.code) {
    case "ambiguousUnitAssumedKg":
      return t("productsFormatter.issue.ambiguousUnitAssumedKg", {
        source: issue.source,
        output: issue.output,
      });
    case "duplicateMerged":
      return t("productsFormatter.issue.duplicateMerged", {
        section: issue.sectionTitle,
        name: issue.displayName,
      });
    case "storeQuantityIgnored":
      return t("productsFormatter.issue.storeQuantityIgnored", {
        section: issue.sectionTitle,
        source: issue.source,
      });
    case "typoCorrected":
      return t("productsFormatter.issue.typoCorrected", {
        source: issue.source,
        name: issue.displayName,
      });
    default:
      return issue.source || issue.displayName || issue.code;
  }
}

function issueMatchesFilter(issue, activeFilter) {
  switch (activeFilter) {
    case "review":
      return [
        "ambiguousUnitAssumedKg",
        "storeQuantityIgnored",
        "typoCorrected",
      ].includes(issue?.code);
    case "typos":
      return issue?.code === "typoCorrected";
    case "duplicates":
      return issue?.code === "duplicateMerged";
    default:
      return true;
  }
}

function diffMatchesFilter(entry, activeFilter) {
  switch (activeFilter) {
    case "review":
      return entry?.uncertain === true;
    case "typos":
      return entry?.issueCodes?.includes("typoCorrected") === true;
    case "duplicates":
      return entry?.issueCodes?.includes("duplicateMerged") === true;
    default:
      return true;
  }
}

function appendEmptyDiagnosticsState(container, activeFilter) {
  const empty = document.createElement("div");
  empty.className = "products-diagnostics__empty";
  empty.textContent = t("productsFormatter.diagnostics.emptyFiltered", {
    filter: t(`productsFormatter.diagnostics.filter.${activeFilter}`),
  });
  container.appendChild(empty);
}

function buildVisibleSectionText(title, items = []) {
  const lines = items
    .map((entry) => String(entry?.line || entry?.text || "").trim())
    .filter(Boolean);
  if (!title) {
    return lines.join("\n").trim();
  }
  if (!lines.length) {
    return String(title).trim();
  }
  return `${title}\n${lines.join("\n")}`.trim();
}

export function renderDiagnostics(
  issuesEl,
  diffEl,
  diagnosticsEl,
  result,
  options = {},
) {
  if (!issuesEl || !diffEl || !diagnosticsEl) return;

  issuesEl.replaceChildren();
  diffEl.replaceChildren();

  const activeFilter = options.activeFilter || "all";
  options.filterButtons?.forEach((button) => {
    button.dataset.active = String((button.dataset.filter || "all") === activeFilter);
  });

  const issues = Array.isArray(result.issues) ? result.issues : [];
  const diffEntries = Array.isArray(result.diffEntries) ? result.diffEntries : [];
  const filteredIssues = issues.filter((issue) =>
    issueMatchesFilter(issue, activeFilter),
  );
  const filteredDiffEntries = diffEntries.filter((entry) =>
    diffMatchesFilter(entry, activeFilter),
  );
  const diffPanel = diffEl.closest('[data-ui="products-diff-panel"]');
  const diffToggle = diffPanel?.querySelector("#products-diff-toggle");
  const diffChevron = diffToggle?.querySelector("i");

  const syncDiagnosticsVisibility = () => {
    const issuesPanel = issuesEl.closest('[data-ui="products-issues-panel"]');
    const comparisonPanel = diagnosticsEl.querySelector(
      '[data-ui="products-comparison-panel"]',
    );
    const hasVisibleIssues = issuesEl.childElementCount > 0;
    const hasVisibleDiff = diffEl.childElementCount > 0;
    const hasVisibleComparison = comparisonPanel
      ? comparisonPanel.hidden === false
      : false;
    if (issuesPanel) issuesPanel.hidden = !hasVisibleIssues;
    if (diffPanel) diffPanel.hidden = !hasVisibleDiff;
    diagnosticsEl.hidden =
      !hasVisibleIssues && !hasVisibleDiff && !hasVisibleComparison;
  };

  filteredIssues.forEach((issue) => {
    const item = document.createElement("div");
    item.className = "products-issue";
    const text = document.createElement("div");
    text.className = "products-issue__text";
    text.textContent = formatIssue(issue);
    item.appendChild(text);

    if (issue.source && typeof options.onRevealSource === "function") {
      const revealButton = document.createElement("button");
      revealButton.type = "button";
      revealButton.className =
        "small-button products-diff-row__reveal products-utility-button";
      revealButton.textContent = t("productsFormatter.diagnostics.revealLine");
      revealButton.addEventListener("click", () => {
        options.onRevealSource(issue);
      });
      item.appendChild(revealButton);
    }

    const closeButton = document.createElement("button");
    closeButton.type = "button";
    closeButton.className =
      "small-button products-issue__close products-icon-button";
    closeButton.setAttribute("data-bs-toggle", "tooltip");
    closeButton.setAttribute("data-bs-placement", "top");
    closeButton.setAttribute("title", t("productsFormatter.dismissWarning"));
    closeButton.setAttribute(
      "aria-label",
      t("productsFormatter.dismissWarning"),
    );
    closeButton.innerHTML = `<i class="fa-solid fa-xmark" aria-hidden="true"></i>`;
    closeButton.addEventListener("click", () => {
      item.remove();
      syncDiagnosticsVisibility();
      initTooltips(diagnosticsEl);
    });
    item.appendChild(closeButton);

    issuesEl.appendChild(item);
  });

  filteredDiffEntries.forEach((entry) => {
    const row = document.createElement("div");
    row.className = entry.uncertain
      ? "products-diff-row products-diff-row--uncertain"
      : "products-diff-row";

    const meta = document.createElement("div");
    meta.className = "products-diff-row__meta";
    meta.textContent = entry.sectionTitle;
    row.appendChild(meta);

    const source = document.createElement("div");
    source.className = "products-diff-row__source";
    source.textContent = entry.source;
    row.appendChild(source);

    const output = document.createElement("div");
    output.className = "products-diff-row__output";
    output.textContent = entry.output;
    row.appendChild(output);

    if (entry.source && entry.output && entry.source !== entry.output) {
      const actions = document.createElement("div");
      actions.className = "products-diff-row__actions";

      const applyButton = document.createElement("button");
      applyButton.type = "button";
      applyButton.className =
        "small-button products-diff-row__apply products-utility-button";
      applyButton.textContent = t("productsFormatter.diagnostics.applyLine");
      applyButton.addEventListener("click", () => {
        options.onApplyDiff?.(entry);
      });
      actions.appendChild(applyButton);

      if (typeof options.onRevealSource === "function") {
        const revealButton = document.createElement("button");
        revealButton.type = "button";
        revealButton.className =
          "small-button products-diff-row__reveal products-utility-button";
        revealButton.textContent = t("productsFormatter.diagnostics.revealLine");
        revealButton.addEventListener("click", () => {
          options.onRevealSource(entry);
        });
        actions.appendChild(revealButton);
      }

      row.appendChild(actions);
    }

    diffEl.appendChild(row);
  });

  if (!filteredIssues.length && issues.length && activeFilter !== "all") {
    appendEmptyDiagnosticsState(issuesEl, activeFilter);
  }
  if (!filteredDiffEntries.length && diffEntries.length && activeFilter !== "all") {
    appendEmptyDiagnosticsState(diffEl, activeFilter);
  }

  if (diffToggle && !diffToggle.dataset.bound) {
    diffToggle.addEventListener("click", () => {
      const expanded = diffToggle.getAttribute("aria-expanded") === "true";
      const nextExpanded = !expanded;
      diffToggle.setAttribute("aria-expanded", String(nextExpanded));
      diffEl.hidden = !nextExpanded;
      if (diffPanel) {
        diffPanel.classList.toggle(
          "products-diagnostics__panel--collapsed",
          !nextExpanded,
        );
      }
      if (diffChevron) {
        diffChevron.className = nextExpanded
          ? "fa-solid fa-chevron-down"
          : "fa-solid fa-chevron-right";
      }
    });
    diffToggle.dataset.bound = "true";
  }

  if (diffToggle) {
    diffToggle.setAttribute("aria-expanded", "false");
  }
  diffEl.hidden = true;
  if (diffPanel) {
    diffPanel.classList.add("products-diagnostics__panel--collapsed");
  }
  if (diffChevron) {
    diffChevron.className = "fa-solid fa-chevron-right";
  }

  syncDiagnosticsVisibility();
}

export function renderComparison(summaryEl, listEl, panelEl, comparison) {
  if (!summaryEl || !listEl || !panelEl) return;

  summaryEl.replaceChildren();
  listEl.replaceChildren();

  if (!comparison) {
    panelEl.hidden = true;
    return;
  }

  const summary = document.createElement("div");
  summary.className = "products-comparison-summary__text";
  if (!comparison.entries.length) {
    summary.textContent = t("productsFormatter.comparison.noChanges");
    summaryEl.appendChild(summary);
    panelEl.hidden = false;
    return;
  }

  summary.textContent = t("productsFormatter.comparison.summary", {
    added: comparison.added,
    removed: comparison.removed,
    sections: comparison.changedSections,
  });
  summaryEl.appendChild(summary);

  comparison.entries.forEach((entry) => {
    const row = document.createElement("div");
    row.className =
      entry.type === "added"
        ? "products-comparison-row products-comparison-row--added"
        : "products-comparison-row products-comparison-row--removed";

    const meta = document.createElement("div");
    meta.className = "products-comparison-row__meta";
    meta.textContent = entry.sectionTitle;
    row.appendChild(meta);

    const text = document.createElement("div");
    text.className = "products-comparison-row__text";
    text.textContent = `${
      entry.type === "added"
        ? t("productsFormatter.comparison.added")
        : t("productsFormatter.comparison.removed")
    }: ${entry.line}`;
    row.appendChild(text);

    listEl.appendChild(row);
  });

  panelEl.hidden = false;
}

export function setResultMenuState(toggle, panel, open) {
  if (toggle) {
    toggle.setAttribute("aria-expanded", String(open));
    toggle.dataset.active = open ? "true" : "false";
  }
  if (panel) {
    panel.hidden = !open;
  }
}

function createSectionBlock(
  title,
  items = [],
  type = "section",
  copyTextValue = "",
  onCopy,
  collapsed = false,
  onToggleCollapse,
) {
  const section = document.createElement("section");
  section.className =
    type === "summary"
      ? "products-preview__section products-preview__section--summary"
      : "products-preview__section";
  if (collapsed) {
    section.classList.add("products-preview__section--collapsed");
  }
  section.dataset.previewType = type;

  const header = document.createElement("div");
  header.className = "products-preview__header";

  const headingButton = document.createElement("button");
  headingButton.type = "button";
  headingButton.className = "products-preview__heading-button";
  headingButton.setAttribute("aria-expanded", String(!collapsed));

  const chevron = document.createElement("i");
  chevron.className = collapsed
    ? "fa-solid fa-chevron-right"
    : "fa-solid fa-chevron-down";
  chevron.setAttribute("aria-hidden", "true");
  headingButton.appendChild(chevron);

  const heading = document.createElement("h3");
  heading.className = "products-preview__title";
  heading.textContent = title;
  headingButton.appendChild(heading);
  header.appendChild(headingButton);

  if (copyTextValue && typeof onCopy === "function") {
    const copyButton = document.createElement("button");
    copyButton.type = "button";
    copyButton.className = "products-section-copy";
    copyButton.dataset.copyText = copyTextValue;
    copyButton.setAttribute("data-bs-toggle", "tooltip");
    copyButton.setAttribute("data-bs-placement", "top");
    copyButton.setAttribute("title", t("productsFormatter.copy"));
    copyButton.setAttribute("aria-label", t("productsFormatter.copy"));
    copyButton.innerHTML = `<i class="fa-regular fa-copy" aria-hidden="true"></i>`;
    copyButton.addEventListener("click", () => onCopy(copyTextValue, copyButton));
    header.appendChild(copyButton);
  }

  section.appendChild(header);

  const list = document.createElement("ul");
  list.className = "products-preview__list";

  items.forEach((entry) => {
    const item = document.createElement("li");
    item.className = entry.uncertain
      ? "products-preview__item products-preview__item--uncertain"
      : "products-preview__item";
    const textNode = document.createElement("span");
    textNode.className = "products-preview__item-text";
    textNode.textContent = entry.line || entry.text || "";
    item.appendChild(textNode);

    if (entry.uncertain) {
      const badge = document.createElement("span");
      badge.className = "products-preview__badge";
      badge.textContent = t("productsFormatter.uncertain");
      item.appendChild(badge);
    }
    list.appendChild(item);
  });

  headingButton.addEventListener("click", () => {
    const nextCollapsed = !section.classList.contains(
      "products-preview__section--collapsed",
    );
    section.classList.toggle("products-preview__section--collapsed", nextCollapsed);
    chevron.className = nextCollapsed
      ? "fa-solid fa-chevron-right"
      : "fa-solid fa-chevron-down";
    headingButton.setAttribute("aria-expanded", String(!nextCollapsed));
    onToggleCollapse?.(nextCollapsed);
  });

  section.appendChild(list);
  return section;
}

export function renderPreview(
  previewEl,
  summaryCardEl,
  result,
  onCopySection,
  collapsedSections,
  onToggleCollapse,
  options = {},
) {
  if (!previewEl || !summaryCardEl) return;
  const showOnlyUncertain = options.showOnlyUncertain === true;
  const searchQuery = String(options.searchQuery || "").trim().toLowerCase();
  const matchesSearch = (sectionTitle, entry) => {
    if (!searchQuery) return true;
    const haystack = [
      sectionTitle,
      entry?.line,
      entry?.text,
      entry?.displayName,
      entry?.name,
    ]
      .filter(Boolean)
      .join(" ")
      .toLowerCase();
    return haystack.includes(searchQuery);
  };

  previewEl.replaceChildren();
  summaryCardEl.replaceChildren();
  summaryCardEl.hidden = true;
  let renderedBlocks = 0;

  result.sections.forEach((section) => {
    const visibleItems = showOnlyUncertain
      ? section.items.filter((item) => item.uncertain)
      : section.items;
    const matchedItems = searchQuery
      ? visibleItems.filter((item) => matchesSearch(section.title, item))
      : visibleItems;
    if (!matchedItems.length) return;
    const key = buildSectionStateKey("section", section.title);
    previewEl.appendChild(
      createSectionBlock(
        section.title,
        matchedItems,
        "section",
        buildVisibleSectionText(section.title, matchedItems),
        onCopySection,
        collapsedSections?.[key] === true,
        (collapsed) => onToggleCollapse?.(key, collapsed),
      ),
    );
    renderedBlocks += 1;
  });

  if (result.summary) {
    const visibleItems = showOnlyUncertain
      ? result.summary.items.filter((item) => item.uncertain)
      : result.summary.items;
    const matchedItems = searchQuery
      ? visibleItems.filter((item) => matchesSearch(result.summary.title, item))
      : visibleItems;
    if ((matchedItems.length || !showOnlyUncertain) && (!searchQuery || matchedItems.length)) {
      const key = buildSectionStateKey("summary", result.summary.title);
      previewEl.appendChild(
        createSectionBlock(
          result.summary.title,
          matchedItems,
          "summary",
          buildVisibleSectionText(result.summary.title, matchedItems),
          onCopySection,
          collapsedSections?.[key] === true,
          (collapsed) => onToggleCollapse?.(key, collapsed),
        ),
      );
      renderedBlocks += 1;
    }
  }

  if (result.greensSummary) {
    const visibleItems = showOnlyUncertain
      ? result.greensSummary.items.filter((item) => item.uncertain)
      : result.greensSummary.items;
    const matchedItems = searchQuery
      ? visibleItems.filter((item) =>
          matchesSearch(result.greensSummary.title, item),
        )
      : visibleItems;
    if ((matchedItems.length || !showOnlyUncertain) && (!searchQuery || matchedItems.length)) {
      const key = buildSectionStateKey("greens", result.greensSummary.title);
      previewEl.appendChild(
        createSectionBlock(
          result.greensSummary.title,
          matchedItems,
          "summary",
          buildVisibleSectionText(result.greensSummary.title, matchedItems),
          onCopySection,
          collapsedSections?.[key] === true,
          (collapsed) => onToggleCollapse?.(key, collapsed),
        ),
      );
      renderedBlocks += 1;
    }
  }

  if (showOnlyUncertain && renderedBlocks === 0) {
    const filteredEmpty = document.createElement("div");
    filteredEmpty.className = "products-preview__filtered-empty";
    filteredEmpty.textContent = t(
      "productsFormatter.resultActions.noUncertain",
    );
    previewEl.appendChild(filteredEmpty);
    return;
  }

  if (searchQuery && renderedBlocks === 0) {
    const filteredEmpty = document.createElement("div");
    filteredEmpty.className = "products-preview__filtered-empty";
    filteredEmpty.textContent = t(
      "productsFormatter.resultActions.noSearchMatches",
      { query: searchQuery },
    );
    previewEl.appendChild(filteredEmpty);
  }
}

export function setCopyButtonState(copyButton, mode = "idle") {
  if (!copyButton) return;
  copyButton.dataset.state = mode;
  const icon = copyButton.querySelector("i");
  if (!icon) return;

  if (mode === "success") {
    icon.className = "fa-solid fa-check";
    copyButton.setAttribute("title", t("productsFormatter.copyDone"));
    copyButton.setAttribute("aria-label", t("productsFormatter.copyDone"));
    return;
  }

  icon.className = "fa-regular fa-copy";
  copyButton.setAttribute("title", t("productsFormatter.copy"));
  copyButton.setAttribute("aria-label", t("productsFormatter.copy"));
}

export function setSectionCopyButtonState(copyButton, mode = "idle") {
  if (!copyButton) return;
  const icon = copyButton.querySelector("i");
  if (mode === "success") {
    if (icon) icon.className = "fa-solid fa-check";
    copyButton.setAttribute("title", t("productsFormatter.copyDone"));
    copyButton.setAttribute("aria-label", t("productsFormatter.copyDone"));
    return;
  }

  if (icon) icon.className = "fa-regular fa-copy";
  copyButton.setAttribute("title", t("productsFormatter.copy"));
  copyButton.setAttribute("aria-label", t("productsFormatter.copy"));
}
