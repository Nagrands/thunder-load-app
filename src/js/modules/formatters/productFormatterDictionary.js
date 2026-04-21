import { DEFAULT_REPLACEMENTS } from "./productListFormatterData.js";
import { normalizeLookupKey } from "./productListFormatterParsing.js";

const STORAGE_KEY = "thunder_products_dev_dictionary";
const RULE_PREFIX_RE = /^(alias|normalize|tokens)\s*:/i;

function normalizeLine(value = "") {
  return String(value || "")
    .replace(/\r/g, "")
    .trim();
}

function parseRuleType(line = "") {
  const match = String(line || "").match(RULE_PREFIX_RE);
  if (!match) {
    return {
      type: "alias",
      body: String(line || ""),
      explicitType: false,
    };
  }
  return {
    type: String(match[1] || "").toLowerCase(),
    body: String(line || "")
      .slice(match[0].length)
      .trim(),
    explicitType: true,
  };
}

function parseTokenRuleSource(source = "") {
  const normalizedSource = normalizeLine(source);
  const sectionMatch = normalizedSource.match(/\[([^\]]+)\]/);
  const sections = sectionMatch
    ? sectionMatch[1]
        .split("|")
        .map((section) => normalizeLookupKey(section))
        .filter(Boolean)
    : [];
  const withoutSections = sectionMatch
    ? normalizedSource.replace(sectionMatch[0], " ")
    : normalizedSource;
  const parts = withoutSections.split(/\s+/).filter(Boolean);
  const requiresTokens = [];
  const forbidsTokens = [];

  parts.forEach((part) => {
    if (part === "+") return;
    if (part.startsWith("!")) {
      const token = normalizeLookupKey(part.slice(1));
      if (token) forbidsTokens.push(token);
      return;
    }
    const token = normalizeLookupKey(part.replace(/\+/g, ""));
    if (token) requiresTokens.push(token);
  });

  return {
    requiresTokens: Array.from(new Set(requiresTokens)),
    forbidsTokens: Array.from(new Set(forbidsTokens)),
    sections: Array.from(new Set(sections)),
  };
}

function createInspectionBucket() {
  return {
    dictionary: {},
    rules: [],
    appliedCount: 0,
    validCount: 0,
    invalidLines: [],
    duplicateLines: [],
    noopLines: [],
    overrideLines: [],
    entries: [],
    typeCounts: {
      alias: 0,
      normalize: 0,
      token_rule: 0,
    },
  };
}

function buildRuleEntry({
  lineNumber,
  raw,
  type,
  explicitType,
  source,
  target,
  normalizedSource,
  normalizedTarget,
  invalid,
  duplicate,
  noop,
  override,
  builtInTarget = "",
  applied,
  priority = 100,
  enabled = true,
  requiresTokens = [],
  forbidsTokens = [],
  sections = [],
}) {
  return {
    lineNumber,
    raw,
    type,
    explicitType,
    source,
    target,
    normalizedSource,
    normalizedTarget,
    invalid,
    duplicate,
    noop,
    override,
    builtInTarget,
    applied,
    priority,
    enabled,
    requiresTokens,
    forbidsTokens,
    sections,
  };
}

function toRuleTypeLabel(type = "alias") {
  if (type === "tokens") return "token_rule";
  return type;
}

export function inspectProductFormatterDictionary(text = "") {
  const lines = String(text || "").split("\n");
  const inspection = createInspectionBucket();
  const seenRuleKeys = new Map();

  lines.forEach((rawLine, index) => {
    const lineNumber = index + 1;
    const line = normalizeLine(rawLine);
    if (!line) return;

    const parsedType = parseRuleType(line);
    const separatorIndex = parsedType.body.indexOf("=");
    if (separatorIndex === -1) {
      inspection.invalidLines.push(lineNumber);
      inspection.entries.push(
        buildRuleEntry({
          lineNumber,
          raw: line,
          type: toRuleTypeLabel(parsedType.type),
          explicitType: parsedType.explicitType,
          source: "",
          target: "",
          normalizedSource: "",
          normalizedTarget: "",
          invalid: true,
          duplicate: false,
          noop: false,
          override: false,
          applied: false,
        }),
      );
      return;
    }

    const source = normalizeLine(parsedType.body.slice(0, separatorIndex));
    const target = normalizeLine(parsedType.body.slice(separatorIndex + 1));
    const normalizedSource = normalizeLookupKey(source);
    const normalizedTarget = normalizeLookupKey(target);
    const ruleType = toRuleTypeLabel(parsedType.type);
    const tokenContext =
      ruleType === "token_rule"
        ? parseTokenRuleSource(source)
        : { requiresTokens: [], forbidsTokens: [], sections: [] };

    if (
      (!normalizedSource && ruleType !== "token_rule") ||
      !target ||
      (ruleType === "token_rule" && tokenContext.requiresTokens.length === 0)
    ) {
      inspection.invalidLines.push(lineNumber);
      inspection.entries.push(
        buildRuleEntry({
          lineNumber,
          raw: line,
          type: ruleType,
          explicitType: parsedType.explicitType,
          source,
          target,
          normalizedSource,
          normalizedTarget,
          invalid: true,
          duplicate: false,
          noop: false,
          override: false,
          applied: false,
          ...tokenContext,
        }),
      );
      return;
    }

    const noop =
      ruleType !== "token_rule" && normalizedSource === normalizedTarget;
    if (noop) {
      inspection.noopLines.push(lineNumber);
      inspection.entries.push(
        buildRuleEntry({
          lineNumber,
          raw: line,
          type: ruleType,
          explicitType: parsedType.explicitType,
          source,
          target,
          normalizedSource,
          normalizedTarget,
          invalid: false,
          duplicate: false,
          noop: true,
          override: false,
          applied: false,
          ...tokenContext,
        }),
      );
      return;
    }

    const duplicateKey =
      ruleType === "token_rule"
        ? [
            ruleType,
            tokenContext.requiresTokens.join("+"),
            tokenContext.forbidsTokens.join("+"),
            tokenContext.sections.join("+"),
          ].join("::")
        : `${ruleType}::${normalizedSource}`;
    const duplicate = seenRuleKeys.has(duplicateKey);
    if (duplicate) {
      inspection.duplicateLines.push(lineNumber);
    }

    const builtInTarget =
      ruleType === "alias" ? DEFAULT_REPLACEMENTS[normalizedSource] || "" : "";
    const override = !!(builtInTarget && builtInTarget !== target);
    if (override) {
      inspection.overrideLines.push(lineNumber);
    }

    seenRuleKeys.set(duplicateKey, lineNumber);

    const entry = buildRuleEntry({
      lineNumber,
      raw: line,
      type: ruleType,
      explicitType: parsedType.explicitType,
      source,
      target,
      normalizedSource,
      normalizedTarget,
      invalid: false,
      duplicate,
      noop: false,
      override,
      builtInTarget,
      applied: true,
      ...tokenContext,
    });

    inspection.entries.push(entry);
    inspection.rules.push(entry);
    inspection.validCount += 1;
    inspection.appliedCount += 1;
    inspection.typeCounts[ruleType] += 1;

    if (ruleType === "alias") {
      inspection.dictionary[normalizedSource] = target;
    }
  });

  return inspection;
}

export function parseProductFormatterDictionary(text = "") {
  return inspectProductFormatterDictionary(text).dictionary;
}

export function parseProductFormatterDictionaryRules(text = "") {
  return inspectProductFormatterDictionary(text).rules.filter(
    (rule) => rule.applied && !rule.invalid && !rule.noop,
  );
}

export function removeInvalidProductFormatterDictionaryLines(text = "") {
  const lines = String(text || "")
    .replace(/\r/g, "")
    .split("\n");
  const invalidLines = new Set(
    inspectProductFormatterDictionary(text).invalidLines,
  );
  if (!invalidLines.size) {
    return String(text || "");
  }
  return lines.filter((_, index) => !invalidLines.has(index + 1)).join("\n");
}

export function loadProductFormatterDictionary() {
  try {
    return window.localStorage?.getItem(STORAGE_KEY) || "";
  } catch {
    return "";
  }
}

export function saveProductFormatterDictionary(text = "") {
  try {
    window.localStorage?.setItem(STORAGE_KEY, String(text || ""));
  } catch {}
}

export function clearProductFormatterDictionary() {
  try {
    window.localStorage?.removeItem(STORAGE_KEY);
  } catch {}
}
