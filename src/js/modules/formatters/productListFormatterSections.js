import { SECTION_GROUP_CHILD_TITLES } from "./productListFormatterData.js";
import { sortByRuAlpha } from "./productListFormatterOutput.js";

export function createSectionCollector({
  addParsedEntry,
  cleanupEntryText,
  formatSectionLine,
  isLikelySectionHeading,
  looksLikeKnownProductLine,
  normalizeLookupKey,
  normalizeSectionTitle,
  splitEntryCandidates,
} = {}) {
  function isGroupedChildSection(title = "") {
    const lookup = normalizeLookupKey(title);
    return SECTION_GROUP_CHILD_TITLES.includes(lookup);
  }

  function isAddressLikeBoundary(line = "", nextLineIsHeading = false) {
    if (!nextLineIsHeading) return false;
    if (!/[\d]/.test(line)) return false;
    if (/[,;:]/.test(line)) return false;
    if (line.split(/\s+/).length > 4) return false;
    return true;
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

  function buildLineClassification(rawLines, index, sections, currentSection, previousBlank, replacements) {
    const line = cleanupEntryText(rawLines[index]);
    if (!line) {
      return {
        type: "blank",
        line: "",
      };
    }

    const nextMeaningful = getMeaningfulLine(rawLines, index + 1);
    const nextLine = nextMeaningful?.line || "";
    const lineAfterNext = nextMeaningful
      ? getMeaningfulLine(rawLines, nextMeaningful.index + 1)?.line || ""
      : "";
    const atStart = sections.length === 0 && !currentSection;
    const isHeadingCandidate = isLikelySectionHeading(line, nextLine, {
      afterBlank: previousBlank,
      atStart,
    });
    const isHeading =
      isHeadingCandidate && !looksLikeKnownProductLine(line, replacements);
    const nextLineIsHeading = nextLine
      ? isLikelySectionHeading(nextLine, lineAfterNext, {
          afterBlank: true,
          atStart: false,
        })
      : false;
    const nextLineIsGroupedChild = nextLine
      ? isGroupedChildSection(nextLine)
      : false;
    const isGroupedHeading =
      previousBlank &&
      nextLineIsHeading &&
      nextLineIsGroupedChild &&
      !/[,;:]/.test(line) &&
      (!/[\d]/.test(line) || /^заявка\s+\d+$/i.test(normalizeLookupKey(line))) &&
      line.split(/\s+/).length <= 4;

    if (
      previousBlank &&
      isAddressLikeBoundary(line, nextLineIsHeading) &&
      !/^заявка\s+\d+$/i.test(normalizeLookupKey(line))
    ) {
      return {
        type: "addressBoundary",
        line,
      };
    }

    if (isGroupedHeading) {
      return {
        type: "groupedHeading",
        line,
      };
    }

    if (isHeading) {
      return {
        type: "heading",
        line,
      };
    }

    return {
      type: "entry",
      line,
    };
  }

  function collectSections(
    input = "",
    labels,
    diagnostics,
    replacements,
    dictionaryRules = [],
  ) {
    const rawLines = String(input || "").split("\n");
    const sections = [];
    let currentSection = null;
    let previousBlank = true;
    let groupedSectionPrefix = "";

    rawLines.forEach((_, index) => {
      const classification = buildLineClassification(
        rawLines,
        index,
        sections,
        currentSection,
        previousBlank,
        replacements,
      );

      if (classification.type === "blank") {
        previousBlank = true;
        return;
      }

      if (classification.type === "addressBoundary") {
        previousBlank = true;
        return;
      }

      if (classification.type === "groupedHeading") {
        groupedSectionPrefix = normalizeSectionTitle(classification.line);
        currentSection = null;
        previousBlank = false;
        return;
      }

      if (classification.type === "heading") {
        const normalizedTitle = normalizeSectionTitle(classification.line);
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
          untitled: true,
        };
        sections.push(currentSection);
      }

      if (classification.type === "entry") {
        addEntriesToSection(
          currentSection,
          classification.line,
          diagnostics,
          replacements,
          dictionaryRules,
          index + 1,
        );
      }
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
        untitled: !!section.untitled,
        items,
        lines,
      };
    });
  }

  function addEntriesToSection(
    section,
    line,
    diagnostics,
    replacements,
    dictionaryRules = [],
    sourceLineNumber = null,
  ) {
    splitEntryCandidates(line).forEach((entry) =>
      addParsedEntry(
        section.itemsMap,
        entry,
        section.title,
        diagnostics,
        replacements,
        dictionaryRules,
        sourceLineNumber,
      ),
    );
  }

  return {
    collectSections,
  };
}
