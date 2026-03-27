import {
  DEFAULT_LABELS,
  DEFAULT_REPLACEMENTS,
  SECTION_GROUP_CHILD_TITLES,
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
  shouldConvertSmallGreeneryKgToBunch,
  shouldTreatPackAsPieces,
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
  shouldConvertSmallGreeneryKgToBunch,
  shouldTreatPackAsPieces,
});

function isGroupedChildSection(title = "") {
  const lookup = normalizeLookupKey(title);
  return SECTION_GROUP_CHILD_TITLES.includes(lookup);
}

function getMeaningfulLine(rawLines, startIndex) {
  for (let index = startIndex; index < rawLines.length; index += 1) {
    const line = cleanupEntryText(rawLines[index]);
    if (line) {
      return {
        index,
        line,
      };
    }
  }
  return null;
}

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
  let groupedSectionPrefix = "";

  rawLines.forEach((rawLine, index) => {
    const line = cleanupEntryText(rawLine);
    if (!line) {
      previousBlank = true;
      return;
    }

    const nextMeaningful = getMeaningfulLine(rawLines, index + 1);
    const nextLine = nextMeaningful?.line || "";
    const lineAfterNext = nextMeaningful
      ? getMeaningfulLine(rawLines, nextMeaningful.index + 1)?.line || ""
      : "";
    const atStart = sections.length === 0 && !currentSection;
    const isHeading = isLikelySectionHeading(line, nextLine, {
      afterBlank: previousBlank,
      atStart,
    });
    const nextLineIsHeading = nextLine
      ? isLikelySectionHeading(nextLine, lineAfterNext, {
          afterBlank: true,
          atStart: false,
        })
      : false;
    const isGroupedHeading =
      previousBlank &&
      nextLineIsHeading &&
      !/[\d]/.test(line) &&
      !/[,;:]/.test(line) &&
      line.split(/\s+/).length <= 4;

    if (isGroupedHeading) {
      groupedSectionPrefix = normalizeSectionTitle(line);
      currentSection = null;
      previousBlank = false;
      return;
    }

    if (isHeading) {
      const normalizedTitle = normalizeSectionTitle(line);
      const title =
        groupedSectionPrefix && isGroupedChildSection(normalizedTitle)
          ? `${groupedSectionPrefix} (${normalizeLookupKey(normalizedTitle)})`
          : normalizedTitle;
      currentSection = {
        title,
        itemsMap: new Map(),
      };
      sections.push(currentSection);
      if (!isGroupedChildSection(normalizedTitle)) {
        groupedSectionPrefix = "";
      }
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
