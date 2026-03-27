import {
  DEFAULT_LABELS,
  DEFAULT_REPLACEMENTS,
} from "./productListFormatterData.js";
import {
  buildAggregateSummary,
  buildSectionContract,
  buildSummaryContract,
  formatSectionLine,
  sortByRuAlpha,
} from "./productListFormatterOutput.js";
import {
  cleanupEntryText,
  isLikelySectionHeading,
  isStoreSection,
  normalizeLookupKey,
  normalizeSectionTitle,
  normalizeUnit,
  parseQuantity,
  sentenceCase,
  splitEntryCandidates,
} from "./productListFormatterParsing.js";
import { createEntryNormalizer } from "./productListFormatterNormalization.js";
import {
  addUnit,
  createItem,
  fixKnownTypos,
  hasGreeneryMarker,
  isStoreBagName,
} from "./productListFormatterRules.js";

const { addParsedEntry, createDiagnosticsBucket } = createEntryNormalizer({
  defaultReplacements: DEFAULT_REPLACEMENTS,
  cleanupEntryText,
  createItem,
  fixKnownTypos,
  formatSectionLine,
  hasGreeneryMarker,
  isStoreBagName,
  isStoreSection,
  normalizeLookupKey,
  normalizeUnit,
  parseQuantity,
  sentenceCase,
  addUnit,
});

function buildProductListContract(input = "", options = {}) {
  const labels = {
    ...DEFAULT_LABELS,
    ...(options.labels || {}),
  };
  const replacements = {
    ...DEFAULT_REPLACEMENTS,
    ...(options.replacements || {}),
  };
  const includeSummary = options.includeSummary !== false;
  const includeGreensSummary = options.includeGreensSummary === true;
  const diagnostics = createDiagnosticsBucket();
  const internalSections = collectSections(input, labels, diagnostics, replacements);
  const sections = internalSections.map(buildSectionContract);
  const internalSummary = includeSummary
    ? buildAggregateSummary(internalSections, labels, {
        includeItem: (item) => !item.starred,
        isStoreSection,
        summaryKey: "summary",
      })
    : null;
  const summary = internalSummary
    ? buildSummaryContract(internalSummary)
    : null;
  const internalGreensSummary = includeGreensSummary
    ? buildAggregateSummary(internalSections, labels, {
        includeItem: (item) => item.starred,
        isStoreSection,
        summaryKey: "greens",
      })
    : null;
  const greensSummary = internalGreensSummary
    ? buildSummaryContract(internalGreensSummary)
    : null;
  const formattedSectionsText = sections
    .map((section) => section.text)
    .join("\n\n")
    .trim();
  const formattedSummaryText = summary ? summary.text : "";
  const formattedGreensSummaryText = greensSummary ? greensSummary.text : "";
  const fullOutputText = [
    formattedSectionsText,
    formattedSummaryText,
    formattedGreensSummaryText,
  ]
    .filter(Boolean)
    .join("\n\n")
    .trim();

  const normalizationStats = {
    duplicatesMerged: diagnostics.issues.filter(
      (issue) => issue.code === "duplicateMerged",
    ).length,
    typosCorrected: diagnostics.issues.filter(
      (issue) => issue.code === "typoCorrected",
    ).length,
    reviewRequired: sections.reduce(
      (total, section) =>
        total + section.items.filter((item) => item.uncertain).length,
      0,
    ),
  };

  return {
    sections,
    summary,
    greensSummary,
    formattedSectionsText,
    formattedSummaryText,
    formattedGreensSummaryText,
    fullOutputText,
    issues: diagnostics.issues,
    diffEntries: diagnostics.diffEntries,
    normalizationStats,
  };
}

function collectSections(
  input = "",
  labels = DEFAULT_LABELS,
  diagnostics,
  replacements,
) {
  const rawLines = String(input || "").split("\n");
  const sections = [];
  let currentSection = null;
  let previousBlank = true;

  rawLines.forEach((rawLine, index) => {
    const line = cleanupEntryText(rawLine);
    if (!line) {
      previousBlank = true;
      return;
    }

    const nextLine = rawLines
      .slice(index + 1)
      .map((item) => cleanupEntryText(item))
      .find(Boolean);
    const atStart = sections.length === 0 && !currentSection;
    const isHeading = isLikelySectionHeading(line, nextLine, {
      afterBlank: previousBlank,
      atStart,
    });

    if (isHeading) {
      currentSection = {
        title: normalizeSectionTitle(line),
        itemsMap: new Map(),
      };
      sections.push(currentSection);
      previousBlank = false;
      return;
    }

    if (!currentSection) {
      currentSection = {
        title: labels.unsorted,
        itemsMap: new Map(),
      };
      sections.push(currentSection);
    }

    splitEntryCandidates(line).forEach((entry) =>
      addParsedEntry(
        currentSection.itemsMap,
        entry,
        currentSection.title,
        diagnostics,
        replacements,
      ),
    );
    previousBlank = false;
  });

  return sections.map((section) => {
    const items = Array.from(section.itemsMap.values()).sort((left, right) =>
      sortByRuAlpha(left.displayName, right.displayName),
    );
    const lines = items.map(formatSectionLine);
    return {
      name: section.title,
      title: section.title,
      items,
      lines,
    };
  });
}

export function parseProductList(input = "", options = {}) {
  return buildProductListContract(input, options);
}

export function formatProductLists(input = "", options = {}) {
  return buildProductListContract(input, options);
}
