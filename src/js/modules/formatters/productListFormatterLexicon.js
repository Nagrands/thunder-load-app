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
  function normalizeFuzzyKey(value = "") {
    return expandLookupKeyVariants(value)
      .replace(/[ьъ]/g, "")
      .replace(/й/g, "и")
      .replace(/\s+/g, "");
  }

  function calculateDamerauLevenshteinDistance(left = "", right = "") {
    const leftLength = left.length;
    const rightLength = right.length;
    const matrix = Array.from({ length: leftLength + 1 }, () =>
      Array(rightLength + 1).fill(0),
    );

    for (let row = 0; row <= leftLength; row += 1) {
      matrix[row][0] = row;
    }
    for (let column = 0; column <= rightLength; column += 1) {
      matrix[0][column] = column;
    }

    for (let row = 1; row <= leftLength; row += 1) {
      for (let column = 1; column <= rightLength; column += 1) {
        const substitutionCost =
          left[row - 1] === right[column - 1] ? 0 : 1;
        matrix[row][column] = Math.min(
          matrix[row - 1][column] + 1,
          matrix[row][column - 1] + 1,
          matrix[row - 1][column - 1] + substitutionCost,
        );

        if (
          row > 1 &&
          column > 1 &&
          left[row - 1] === right[column - 2] &&
          left[row - 2] === right[column - 1]
        ) {
          matrix[row][column] = Math.min(
            matrix[row][column],
            matrix[row - 2][column - 2] + 1,
          );
        }
      }
    }

    return matrix[leftLength][rightLength];
  }

  function getFuzzyDistanceLimit(lookupKey = "") {
    const compactLength = normalizeFuzzyKey(lookupKey).length;
    if (compactLength <= 6) return 1;
    if (compactLength <= 10) return 2;
    return 3;
  }

  function shouldTryFuzzyMatch(lookupKey = "") {
    if (!lookupKey) return false;
    if (/\d/.test(lookupKey)) return false;
    const tokens = lookupKey.split(/\s+/).filter(Boolean);
    if (tokens.length !== 1) return false;
    if (tokens.some((token) => token.length <= 2)) return false;
    if (hasGreeneryMarker(lookupKey)) return false;
    if (isStoreBagName(lookupKey)) return false;
    return normalizeFuzzyKey(lookupKey).length >= 4;
  }

  function findFuzzyReplacement(lookupKey = "", customReplacements = replacements) {
    if (!shouldTryFuzzyMatch(lookupKey)) return null;

    const targetKey = normalizeFuzzyKey(lookupKey);
    const tokenCount = lookupKey.split(/\s+/).filter(Boolean).length;
    const maxDistance = getFuzzyDistanceLimit(lookupKey);
    const bestByDisplay = new Map();

    Object.entries(customReplacements).forEach(([candidateKey, displayName]) => {
      const candidateLookupKey = normalizeLookupKey(candidateKey);
      if (!candidateLookupKey) return;
      const candidateTokens = candidateLookupKey.split(/\s+/).filter(Boolean);
      if (candidateTokens.length !== tokenCount) return;

      const candidateFuzzyKey = normalizeFuzzyKey(candidateLookupKey);
      if (
        candidateFuzzyKey[0] !== targetKey[0] ||
        candidateFuzzyKey[candidateFuzzyKey.length - 1] !==
          targetKey[targetKey.length - 1]
      ) {
        return;
      }
      const compactLengthDiff = Math.abs(
        candidateFuzzyKey.length - targetKey.length,
      );
      if (compactLengthDiff > maxDistance) return;

      const distance = calculateDamerauLevenshteinDistance(
        targetKey,
        candidateFuzzyKey,
      );
      if (distance === 0 || distance > maxDistance) return;

      const current = bestByDisplay.get(displayName);
      if (
        !current ||
        distance < current.distance ||
        (
          distance === current.distance &&
          candidateFuzzyKey.length < current.fuzzyKey.length
        )
      ) {
        bestByDisplay.set(displayName, {
          candidateKey: candidateLookupKey,
          displayName,
          distance,
          fuzzyKey: candidateFuzzyKey,
        });
      }
    });

    const rankedCandidates = Array.from(bestByDisplay.values()).sort(
      (left, right) =>
        left.distance - right.distance ||
        left.fuzzyKey.length - right.fuzzyKey.length ||
        left.candidateKey.localeCompare(right.candidateKey, "ru"),
    );

    if (!rankedCandidates.length) return null;

    const [bestCandidate, secondCandidate] = rankedCandidates;
    if (!bestCandidate) return null;
    if (
      secondCandidate &&
      secondCandidate.distance === bestCandidate.distance
    ) {
      return null;
    }

    return bestCandidate;
  }

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
    const tokens = lookupKey.split(/\s+/).filter(Boolean);
    return (
      DISPLAY_NAME_RULES.find((rule) => {
        if (rule.type === "includes") return lookupKey.includes(rule.value);
        if (rule.type === "startsWith") return lookupKey.startsWith(rule.value);
        if (rule.type === "equals") return lookupKey === rule.value;
        if (rule.type === "allTokens") {
          return rule.value.every((token) =>
            tokens.some((currentToken) => currentToken.startsWith(token)),
          );
        }
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

    const fuzzyMatch = findFuzzyReplacement(lookupKey, customReplacements);
    if (fuzzyMatch) {
      return {
        displayName: fuzzyMatch.displayName,
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
