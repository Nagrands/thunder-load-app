import {
  DEFAULT_LABELS,
  DEFAULT_REPLACEMENTS,
} from "./productListFormatterData.js";
import {
  buildAggregateSummary,
  buildSectionContract,
  buildSummaryContract,
  formatSectionLine,
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
import { createProductFormatterLexicon } from "./productListFormatterLexicon.js";
import { createSectionCollector } from "./productListFormatterSections.js";
import {
  addUnit,
  createItem,
  shouldConvertHeadToPieces,
  shouldConvertSmallGreeneryKgToBunch,
  shouldHidePiecesUnitInSection,
  shouldTreatPackAsCrate,
  shouldTreatPackAsPieces,
  shouldTreatUnitlessQuantityAsPieces,
} from "./productListFormatterRules.js";

const lexicon = createProductFormatterLexicon({
  cleanupEntryText,
  normalizeLookupKey,
  sentenceCase,
});

const { addParsedEntry, createDiagnosticsBucket } = createEntryNormalizer({
  defaultReplacements: DEFAULT_REPLACEMENTS,
  cleanupEntryText,
  createItem,
  resolveDisplayName: lexicon.resolveDisplayName,
  formatSectionLine,
  hasGreeneryMarker: lexicon.hasGreeneryMarker,
  isStoreBagName: lexicon.isStoreBagName,
  isStoreSection,
  normalizeLookupKey,
  normalizeUnit,
  parseQuantity,
  addUnit,
  buildItemQualifiers: lexicon.buildItemQualifiers,
  shouldConvertHeadToPieces,
  shouldConvertSmallGreeneryKgToBunch,
  shouldHidePiecesUnitInSection,
  shouldTreatPackAsCrate,
  shouldTreatPackAsPieces,
  shouldTreatUnitlessQuantityAsPieces,
});

const { collectSections } = createSectionCollector({
  addParsedEntry,
  cleanupEntryText,
  formatSectionLine,
  isLikelySectionHeading,
  looksLikeKnownProductLine: lexicon.looksLikeKnownProductLine,
  normalizeLookupKey,
  normalizeSectionTitle,
  splitEntryCandidates,
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
export function parseProductList(input = "", options = {}) {
  return buildProductListContract(input, options);
}

export function formatProductLists(input = "", options = {}) {
  return buildProductListContract(input, options);
}
