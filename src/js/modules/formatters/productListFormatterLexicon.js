import {
  DEFAULT_REPLACEMENTS,
  DISPLAY_NAME_RULES,
  GREENERY_PATTERNS,
  ITEM_QUALIFIER_RULES,
  LOOKUP_VARIANT_RULES,
  STORE_BAG_PATTERNS,
  TYPO_STEMS,
} from "./productListFormatterData.js";

export function createProductFormatterLexicon({
  cleanupEntryText,
  normalizeLookupKey,
  sentenceCase,
  replacements = DEFAULT_REPLACEMENTS,
} = {}) {
  function expandLookupKeyVariants(lookupKey = "") {
    return LOOKUP_VARIANT_RULES.reduce(
      (current, rule) => current.replace(rule.pattern, rule.replacement),
      normalizeLookupKey(lookupKey),
    );
  }

  function resolveTypoStem(lookupKey = "") {
    if (!lookupKey) return "";
    for (const [stem, display] of Object.entries(TYPO_STEMS)) {
      const suffixLength = lookupKey.length - stem.length;
      if (
        lookupKey.startsWith(stem) &&
        suffixLength > 0 &&
        suffixLength <= 2
      ) {
        return display;
      }
    }
    return "";
  }

  function matchDisplayNameRule(lookupKey = "") {
    return (
      DISPLAY_NAME_RULES.find((rule) => {
        if (rule.type === "includes") return lookupKey.includes(rule.value);
        if (rule.type === "startsWith") return lookupKey.startsWith(rule.value);
        if (rule.type === "equals") return lookupKey === rule.value;
        return false;
      }) || null
    );
  }

  function resolveDisplayName(name = "", customReplacements = replacements) {
    const lookupKey = normalizeLookupKey(name);
    const expandedLookupKey = expandLookupKeyVariants(lookupKey);
    if (!lookupKey) {
      return {
        displayName: "",
        typoCorrected: false,
      };
    }

    const displayRule = matchDisplayNameRule(lookupKey);
    if (displayRule) {
      return {
        displayName: displayRule.displayName,
        typoCorrected: false,
      };
    }

    if (customReplacements[lookupKey]) {
      return {
        displayName: customReplacements[lookupKey],
        typoCorrected: false,
      };
    }

    if (expandedLookupKey && customReplacements[expandedLookupKey]) {
      return {
        displayName: customReplacements[expandedLookupKey],
        typoCorrected: false,
      };
    }

    const typoFixed = resolveTypoStem(lookupKey);
    if (typoFixed) {
      return {
        displayName: typoFixed,
        typoCorrected: true,
      };
    }

    return {
      displayName: sentenceCase(expandedLookupKey || lookupKey),
      typoCorrected: false,
    };
  }

  function buildItemQualifiers(tail = "") {
    const lookupKey = normalizeLookupKey(tail);
    if (!lookupKey) {
      return {
        sectionQualifier: "",
        summaryQualifier: "",
        hasQualifier: false,
      };
    }

    const tokens = lookupKey.split(/\s+/).filter(Boolean);
    let sectionQualifier = "";
    let summaryQualifier = "";

    for (const token of tokens) {
      if (!sectionQualifier && ITEM_QUALIFIER_RULES.section[token]) {
        sectionQualifier = ITEM_QUALIFIER_RULES.section[token];
      }
      if (!summaryQualifier && ITEM_QUALIFIER_RULES.summary[token]) {
        summaryQualifier = ITEM_QUALIFIER_RULES.summary[token];
      }
    }

    return {
      sectionQualifier,
      summaryQualifier,
      hasQualifier: Boolean(sectionQualifier || summaryQualifier),
    };
  }

  function hasGreeneryMarker(name = "") {
    const lookupKey = normalizeLookupKey(name);
    return GREENERY_PATTERNS.some((pattern) =>
      lookupKey === pattern || lookupKey.startsWith(`${pattern} `),
    );
  }

  function isStoreBagName(name = "") {
    const lookupKey = normalizeLookupKey(name);
    return STORE_BAG_PATTERNS.some(
      (pattern) => lookupKey === pattern || lookupKey.startsWith(`${pattern} `),
    );
  }

  function looksLikeKnownProductLine(line = "", customReplacements = replacements) {
    const normalized = cleanupEntryText(line);
    if (!normalized) return false;
    if (normalized !== normalized.toLowerCase()) return false;
    if (normalized.split(/\s+/).length < 2) return false;

    const lookupKey = normalizeLookupKey(normalized);
    const expandedLookupKey = expandLookupKeyVariants(lookupKey);

    if (customReplacements[lookupKey] || customReplacements[expandedLookupKey]) {
      return true;
    }

    return hasGreeneryMarker(expandedLookupKey);
  }

  return {
    buildItemQualifiers,
    expandLookupKeyVariants,
    hasGreeneryMarker,
    isStoreBagName,
    looksLikeKnownProductLine,
    resolveDisplayName,
    resolveTypoStem,
  };
}
