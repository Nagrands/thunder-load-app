import { DEFAULT_REPLACEMENTS } from "./productListFormatterData.js";
import { normalizeLookupKey } from "./productListFormatterParsing.js";

const STORAGE_KEY = "thunder_products_dev_dictionary";

function normalizeLine(value = "") {
  return String(value || "").replace(/\r/g, "").trim();
}

function createInspectionBucket() {
  return {
    dictionary: {},
    appliedCount: 0,
    invalidLines: [],
    duplicateLines: [],
    noopLines: [],
    overrideLines: [],
  };
}

export function inspectProductFormatterDictionary(text = "") {
  const lines = String(text || "").split("\n");
  const inspection = createInspectionBucket();
  const seenSources = new Map();

  lines.forEach((rawLine, index) => {
    const lineNumber = index + 1;
    const line = normalizeLine(rawLine);
    if (!line) return;

    const separatorIndex = line.indexOf("=");
    if (separatorIndex === -1) {
      inspection.invalidLines.push(lineNumber);
      return;
    }

    const source = normalizeLine(line.slice(0, separatorIndex));
    const target = normalizeLine(line.slice(separatorIndex + 1));
    const normalizedSource = normalizeLookupKey(source);
    const normalizedTarget = normalizeLookupKey(target);

    if (!normalizedSource || !target) {
      inspection.invalidLines.push(lineNumber);
      return;
    }

    if (normalizedSource === normalizedTarget) {
      inspection.noopLines.push(lineNumber);
      return;
    }

    if (seenSources.has(normalizedSource)) {
      inspection.duplicateLines.push(lineNumber);
    }

    const builtInTarget = DEFAULT_REPLACEMENTS[normalizedSource];
    if (builtInTarget && builtInTarget !== target) {
      inspection.overrideLines.push(lineNumber);
    }

    seenSources.set(normalizedSource, lineNumber);
    inspection.dictionary[normalizedSource] = target;
  });

  inspection.appliedCount = Object.keys(inspection.dictionary).length;
  return inspection;
}

export function parseProductFormatterDictionary(text = "") {
  return inspectProductFormatterDictionary(text).dictionary;
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
