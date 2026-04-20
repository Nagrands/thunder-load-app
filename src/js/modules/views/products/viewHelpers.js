import { inspectProductFormatterDictionary } from "../../formatters/productFormatterDictionary.js";

const FOCUSABLE_SELECTOR = [
  'button:not([disabled])',
  '[href]',
  'input:not([disabled]):not([type="hidden"])',
  'select:not([disabled])',
  'textarea:not([disabled])',
  '[tabindex]:not([tabindex="-1"])',
].join(", ");

function fallbackCopyText(value = "") {
  const textarea = document.createElement("textarea");
  textarea.value = String(value || "");
  textarea.setAttribute("readonly", "");
  textarea.style.position = "absolute";
  textarea.style.left = "-9999px";
  document.body.appendChild(textarea);
  textarea.select();
  const success = document.execCommand?.("copy");
  document.body.removeChild(textarea);
  if (!success) {
    throw new Error("copy_failed");
  }
}

export async function copyText(value = "") {
  const text = String(value || "");
  if (navigator.clipboard?.writeText) {
    await navigator.clipboard.writeText(text);
    return;
  }
  fallbackCopyText(text);
}

export function getCurrentTextareaLineNumber(text = "", selectionStart = 0) {
  const normalizedText = String(text || "").replace(/\r/g, "");
  const safeSelectionStart = Math.max(
    0,
    Math.min(Number(selectionStart) || 0, normalizedText.length),
  );
  return normalizedText.slice(0, safeSelectionStart).split("\n").length;
}

export function getTextareaSelectionForLine(text = "", lineNumber = 1) {
  const normalizedText = String(text || "").replace(/\r/g, "");
  const lines = normalizedText.split("\n");
  const safeLineNumber = Math.max(
    1,
    Math.min(Number(lineNumber) || 1, lines.length || 1),
  );
  let selectionStart = 0;
  for (let index = 0; index < safeLineNumber - 1; index += 1) {
    selectionStart += (lines[index] || "").length + 1;
  }
  const selectionEnd = selectionStart + (lines[safeLineNumber - 1] || "").length;
  return { selectionStart, selectionEnd };
}

export function inspectDictionaryText(text = "", options = {}) {
  const inspection = inspectProductFormatterDictionary(text);
  const requestedLine = Number(options.lineNumber) || 0;
  const previewEntry = requestedLine
    ? inspection.entries.find((entry) => entry.lineNumber === requestedLine) || null
    : [...inspection.entries].reverse().find((entry) => entry.raw) || null;
  return {
    validCount: inspection.appliedCount,
    inspection,
    invalidLines: inspection.invalidLines,
    duplicateLines: inspection.duplicateLines,
    noopLines: inspection.noopLines,
    overrideLines: inspection.overrideLines,
    previewEntry,
  };
}

export function buildDictionarySuggestions(result = null) {
  if (!result) return [];

  const suggestions = new Map();
  const pushSuggestion = (key, value) => {
    if (!key || !value || suggestions.has(key)) return;
    suggestions.set(key, value);
  };

  (result.issues || []).forEach((issue) => {
    if (issue.code === "typoCorrected" && issue.displayName) {
      pushSuggestion(
        `alias:${normalizeKey(issue.source)}`,
        {
          type: "alias",
          label: `${normalizeText(issue.source)} = ${issue.displayName}`,
        },
      );
    }
  });

  (result.diffEntries || []).forEach((entry) => {
    if (entry.uncertain && entry.source && entry.output) {
      pushSuggestion(
        `normalize:${normalizeKey(entry.source)}`,
        {
          type: "normalize",
          label: `normalize: ${normalizeText(entry.source)} = ${normalizeText(entry.output)}`,
        },
      );
    }
  });

  return Array.from(suggestions.values()).slice(0, 3);
}

function normalizeText(value = "") {
  return String(value || "").replace(/\s+/g, " ").trim();
}

function normalizeKey(value = "") {
  return normalizeText(value).toLowerCase();
}

export function buildSectionStateKey(type = "section", title = "") {
  return `${type}:${title}`;
}

export function buildComparison(previousResult, nextResult) {
  if (!previousResult?.sections?.length || !nextResult?.sections?.length) {
    return null;
  }

  const previousMap = new Map(
    previousResult.sections.map((section) => [section.title, new Set(section.lines)]),
  );
  const nextMap = new Map(
    nextResult.sections.map((section) => [section.title, new Set(section.lines)]),
  );
  const titles = Array.from(new Set([...previousMap.keys(), ...nextMap.keys()]));
  const entries = [];

  titles.forEach((title) => {
    const previousLines = previousMap.get(title) || new Set();
    const nextLines = nextMap.get(title) || new Set();

    nextLines.forEach((line) => {
      if (!previousLines.has(line)) {
        entries.push({ sectionTitle: title, type: "added", line });
      }
    });

    previousLines.forEach((line) => {
      if (!nextLines.has(line)) {
        entries.push({ sectionTitle: title, type: "removed", line });
      }
    });
  });

  if (!entries.length) {
    return {
      added: 0,
      removed: 0,
      changedSections: 0,
      entries: [],
    };
  }

  return {
    added: entries.filter((entry) => entry.type === "added").length,
    removed: entries.filter((entry) => entry.type === "removed").length,
    changedSections: new Set(entries.map((entry) => entry.sectionTitle)).size,
    entries,
  };
}

export function getMetrics(result) {
  const sectionCount = result.sections.length;
  const itemCount = result.sections.reduce(
    (total, section) => total + section.items.length,
    0,
  );
  return {
    sectionCount,
    itemCount,
    hasSummary: !!result.summary,
    hasGreensSummary: !!result.greensSummary,
  };
}

export function getFocusableElements(container) {
  if (!container) return [];
  return Array.from(container.querySelectorAll(FOCUSABLE_SELECTOR)).filter(
    (element) =>
      element instanceof HTMLElement &&
      !element.hidden &&
      !element.closest("[hidden]"),
  );
}
