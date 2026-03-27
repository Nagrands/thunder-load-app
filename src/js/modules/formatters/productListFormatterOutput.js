function formatNumber(value) {
  if (!Number.isFinite(value)) return "";
  const rounded = Math.round(value * 1000) / 1000;
  const stringValue = String(rounded);
  return stringValue.includes(".")
    ? stringValue.replace(/\.0+$/, "").replace(/(\.\d*?)0+$/, "$1")
    : stringValue;
}

export function hasMeasuredUnits(item) {
  return Object.values(item.units).some((value) => value > 0);
}

export function sortByRuAlpha(a, b) {
  return String(a).localeCompare(String(b), "ru", { sensitivity: "base" });
}

export function formatUnitsForSection(item) {
  const parts = [];
  if (item.units.kg > 0) parts.push(formatNumber(item.units.kg));
  if (item.units.pcs > 0) parts.push(`${formatNumber(item.units.pcs)}шт`);
  if (item.units.bunch > 0) parts.push(`${formatNumber(item.units.bunch)}п`);
  if (item.units.head > 0) parts.push(`${formatNumber(item.units.head)} гол`);
  if (item.units.pack > 0) parts.push(`${formatNumber(item.units.pack)} пака`);
  if (item.units.bag > 0) parts.push(`${formatNumber(item.units.bag)}м`);
  return parts.join(" + ");
}

export function formatUnitsForSummary(item) {
  const parts = [];
  if (item.units.kg > 0) parts.push(`${formatNumber(item.units.kg)} кг`);
  if (item.units.pcs > 0) parts.push(`${formatNumber(item.units.pcs)} шт`);
  if (item.units.bunch > 0) parts.push(`${formatNumber(item.units.bunch)}п`);
  if (item.units.head > 0) parts.push(`${formatNumber(item.units.head)} гол`);
  if (item.units.pack > 0) parts.push(`${formatNumber(item.units.pack)} пака`);
  if (item.units.bag > 0) parts.push(`${formatNumber(item.units.bag)}м`);
  if (item.units.crate > 0) parts.push(`${formatNumber(item.units.crate)}ящ`);
  return parts.join(" + ");
}

export function formatSectionLine(item) {
  const suffix = formatUnitsForSection(item);
  const displayName = item.starred ? `${item.displayName}⁕` : item.displayName;
  return suffix ? `${displayName} ${suffix}` : displayName;
}

export function formatSummaryLine(item) {
  const suffix = formatUnitsForSummary(item);
  const sources = Array.from(item.sources).map((source) =>
    String(source).replace(/\s*\(([^)]+)\)\s*$/, " $1"),
  );
  const sourceText = sources.length ? ` (${sources.join(", ")})` : "";
  if (!suffix) return `${item.displayName}${sourceText}`;
  return `${item.displayName} ${suffix}${sourceText}`;
}

export function cloneUnits(units = {}) {
  return {
    kg: units.kg || 0,
    pcs: units.pcs || 0,
    bunch: units.bunch || 0,
    head: units.head || 0,
    pack: units.pack || 0,
    bag: units.bag || 0,
    crate: units.crate || 0,
  };
}

export function buildSectionContract(section) {
  const items = section.items.map((item) => {
    const line = formatSectionLine(item);
    return {
      key: item.key,
      name: item.displayName,
      displayName: item.displayName,
      starred: item.starred,
      hasNameOnly: item.hasNameOnly,
      units: cloneUnits(item.units),
      uncertain: item.uncertain,
      uncertainReasons: Array.from(item.uncertainReasons),
      sourceEntries: item.rawEntries.slice(),
      line,
      text: line,
    };
  });
  const lines = items.map((item) => item.line);
  const text = [section.title, ...lines].join("\n").trim();

  return {
    name: section.title,
    title: section.title,
    items,
    lines,
    text,
    previewText: text,
    formattedText: text,
  };
}

export function buildSummaryContract(summary) {
  const items = summary.items.map((item) => {
    const line = formatSummaryLine(item);
    return {
      key: item.key,
      name: item.displayName,
      displayName: item.displayName,
      units: cloneUnits(item.units),
      hasNameOnly: item.hasNameOnly,
      sources: Array.from(item.sources),
      line,
      text: line,
    };
  });
  const lines = items.map((item) => item.line);
  const text = [summary.title, ...lines].join("\n").trim();

  return {
    name: summary.title,
    title: summary.title,
    items,
    lines,
    text,
    previewText: text,
    formattedText: text,
  };
}

export function buildAggregateSummary(sections, labels, options = {}) {
  const {
    includeItem = () => true,
    isStoreSection = () => false,
    summaryKey = "summary",
  } = options;
  const summaryMap = new Map();

  sections.forEach((section) => {
    section.items.forEach((item) => {
      if (!includeItem(item, section)) return;
      const key = item.key;
      const summaryItem = summaryMap.get(key) || {
        key,
        displayName: item.displayName,
        units: {
          kg: 0,
          pcs: 0,
          bunch: 0,
          head: 0,
          pack: 0,
          bag: 0,
          crate: 0,
        },
        hasNameOnly: false,
        sources: new Set(),
      };

      summaryItem.sources.add(section.title);
      summaryItem.hasNameOnly = summaryItem.hasNameOnly || item.hasNameOnly;
      Object.keys(summaryItem.units).forEach((unitKey) => {
        summaryItem.units[unitKey] += item.units[unitKey] || 0;
      });

      if (isStoreSection(section.title) && !hasMeasuredUnits(item)) {
        summaryItem.units.crate += 1;
      }

      summaryMap.set(key, summaryItem);
    });
  });

  const items = Array.from(summaryMap.values()).sort((left, right) =>
    sortByRuAlpha(left.displayName, right.displayName),
  );
  if (!items.length) return null;
  const lines = items.map(formatSummaryLine);

  return {
    name: labels[summaryKey],
    title: labels[summaryKey],
    items,
    lines,
  };
}
