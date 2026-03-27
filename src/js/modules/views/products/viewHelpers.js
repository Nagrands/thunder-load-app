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

export function inspectDictionaryText(text = "") {
  const lines = String(text || "").split("\n");
  let validCount = 0;
  const invalidLines = [];

  lines.forEach((rawLine, index) => {
    const line = String(rawLine || "").replace(/\r/g, "").trim();
    if (!line) return;

    const separatorIndex = line.indexOf("=");
    if (separatorIndex === -1) {
      invalidLines.push(index + 1);
      return;
    }

    const source = line.slice(0, separatorIndex).trim();
    const target = line.slice(separatorIndex + 1).trim();
    if (!source || !target) {
      invalidLines.push(index + 1);
      return;
    }

    validCount += 1;
  });

  return {
    validCount,
    invalidLines,
  };
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
