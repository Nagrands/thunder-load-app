const DEFAULT_LABELS = Object.freeze({
  summary: "Итого",
  greens: "Зелень",
  unsorted: "Без раздела",
});

const REPLACEMENTS = Object.freeze({
  "грэй": "Грейпфрут",
  "грей": "Грейпфрут",
  "памела": "Помело",
  "каппи": "Перец капи",
  "огурцы": "Огурец",
  "помидоры": "Помидор",
  "черри": "Помидор черри",
  "помидоры черри": "Помидор черри",
  "помидор черри": "Помидор черри",
  "грибы": "Гриб Шампиньон",
  "сушка": "Сухофрукты",
  "кедр орех": "Кедровый орех",
  "марс": "Лук Марс",
  "лук марс": "Лук Марс",
  "гала": "Яблоко Гала",
  "гренни смит": "Яблоко Гренни Смит",
  "баз зел": "Базилик зеленый",
  "картофель бел": "Картофель белый",
  "картофель роз": "Картофель розовый",
  "огурец длин": "Огурец длинный",
  "помидор роз": "Помидор розовый",
  "перец болгарский": "Перец микс",
  "чили": "Перец чили",
  "имбирь": "Имбирь",
  "лук порей": "Лук порей",
  "айс": "Салат Айсберг",
});

const TYPO_STEMS = Object.freeze({
  петрушка: "Петрушка",
  укроп: "Укроп",
  кинза: "Кинза",
  мята: "Мята",
  базилик: "Базилик",
});

const GREENERY_PATTERNS = Object.freeze([
  "базилик",
  "укроп",
  "кинза",
  "мята",
  "петрушка",
  "редис",
  "лук зеленый",
  "лук зелёный",
  "лук порей",
  "стебель сельдерея",
  "микрозелень",
  "салат",
  "латук",
  "айсберг",
  "дубок",
  "бионда",
  "руккола",
  "шпинат",
  "щавель",
]);

const STORE_BAG_PATTERNS = Object.freeze([
  "картофель",
  "морковь",
  "свекла",
  "капуста",
]);

const QUANTITY_RE =
  "(\\d+(?:\\.\\d+)?)\\s*(кг|килограмм(?:а|ов)?|к|гр|грамм(?:а|ов)?|г|шт|штук|штуки|пуч|пучок|пучка|п|гол|головка|головки|пака)?";
const PREFIX_QUANTITY_RE = new RegExp(`^${QUANTITY_RE}\\s+(.+)$`, "i");
const SUFFIX_QUANTITY_RE = new RegExp(`^(.+?)\\s+${QUANTITY_RE}$`, "i");

function normalizeWhitespace(value = "") {
  return String(value || "")
    .replace(/\r/g, "")
    .replace(/\t/g, " ")
    .replace(/\u00a0/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function cleanupEntryText(value = "") {
  return normalizeWhitespace(
    String(value || "")
      .replace(/(\d),(\d)/g, "$1.$2")
      .replace(/(^|\s)пол\s+пака(?=\s|$)/gi, "$10.5 пака")
      .replace(/\b(кг|гр|г|шт|пуч|гол|пака)\./gi, "$1")
      .replace(/(\d)([A-Za-zА-Яа-яЁё⁕]+)/g, "$1 $2")
      .replace(/([A-Za-zА-Яа-яЁё⁕])(\d)/g, "$1 $2")
      .replace(/[,:;]+$/g, "")
      .replace(/\.+$/g, ""),
  );
}

function normalizeLookupKey(value = "") {
  return normalizeWhitespace(
    String(value || "")
      .toLowerCase()
      .replace(/ё/g, "е")
      .replace(/⁕/g, "")
      .replace(/[.,:;]+/g, " "),
  );
}

function sentenceCase(value = "") {
  const normalized = normalizeWhitespace(value.toLowerCase());
  if (!normalized) return "";
  return normalized.charAt(0).toUpperCase() + normalized.slice(1);
}

function formatNumber(value) {
  if (!Number.isFinite(value)) return "";
  const rounded = Math.round(value * 1000) / 1000;
  const stringValue = String(rounded);
  return stringValue.includes(".")
    ? stringValue.replace(/\.0+$/, "").replace(/(\.\d*?)0+$/, "$1")
    : stringValue;
}

function isStoreSection(sectionTitle = "") {
  return normalizeLookupKey(sectionTitle) === "магазин";
}

function splitEntryCandidates(line = "") {
  return cleanupEntryText(line)
    .split(/\s*[,;]\s*/)
    .map((item) => cleanupEntryText(item))
    .filter(Boolean);
}

function looksLikeIngredient(value = "") {
  const line = cleanupEntryText(value);
  if (!line) return false;
  return (
    /[\d]/.test(line) ||
    /[,;]/.test(line) ||
    /\b(пол\s+пака|кг|килограмм|гр|грамм|шт|штук|штуки|пуч|пучок|гол|головка|пака)\b/i.test(
      line,
    ) ||
    line.split(/\s+/).length > 1
  );
}

function normalizeSectionTitle(value = "") {
  const normalized = normalizeLookupKey(value);
  if (!normalized) return "";
  return normalized.charAt(0).toUpperCase() + normalized.slice(1);
}

function isLikelySectionHeading(line, nextLine, context = {}) {
  const normalized = cleanupEntryText(line);
  if (!normalized) return false;
  if (!(context.afterBlank || context.atStart)) return false;
  if (!nextLine) return false;
  const lookup = normalizeLookupKey(normalized);
  if (lookup === "магазин") return true;
  if (/[\d]/.test(normalized) || /[,;:]/.test(normalized)) return false;
  if (normalized.split(/\s+/).length > 4) return false;
  return looksLikeIngredient(nextLine);
}

function parseQuantity(line = "") {
  const cleaned = cleanupEntryText(line);
  if (!cleaned) return { name: "", quantity: null, unit: "" };

  let match = cleaned.match(SUFFIX_QUANTITY_RE);
  if (match) {
    return {
      name: cleanupEntryText(match[1]),
      quantity: Number(match[2]),
      unit: cleanupEntryText(match[3] || ""),
    };
  }

  match = cleaned.match(PREFIX_QUANTITY_RE);
  if (match) {
    return {
      name: cleanupEntryText(match[4]),
      quantity: Number(match[1]),
      unit: cleanupEntryText(match[2] || ""),
    };
  }

  return { name: cleaned, quantity: null, unit: "" };
}

function normalizeUnit(unit = "") {
  const value = normalizeLookupKey(unit);
  if (!value) return "";
  if (["кг", "килограмм", "килограмма", "килограммов", "к"].includes(value))
    return "kg";
  if (["гр", "грамм", "грамма", "граммов", "г"].includes(value)) return "g";
  if (["шт", "штук", "штуки"].includes(value)) return "pcs";
  if (["пуч", "пучок", "пучка", "п"].includes(value)) return "bunch";
  if (["гол", "головка", "головки"].includes(value)) return "head";
  if (value === "пака") return "pack";
  return "";
}

function fixKnownTypos(lookupKey = "") {
  if (!lookupKey) return "";
  for (const [stem, display] of Object.entries(TYPO_STEMS)) {
    if (lookupKey === stem) return display;
    if (lookupKey.startsWith(stem) && lookupKey.length - stem.length <= 2) {
      return display;
    }
  }
  return "";
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

function createItem(displayName = "", starred = false) {
  return {
    key: normalizeLookupKey(displayName),
    displayName,
    starred,
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
    uncertain: false,
    uncertainReasons: new Set(),
    rawEntries: [],
  };
}

function hasMeasuredUnits(item) {
  return Object.values(item.units).some((value) => value > 0);
}

function addUnit(item, unitKey, quantity) {
  if (!unitKey || !Number.isFinite(quantity) || quantity <= 0) return;
  item.units[unitKey] += quantity;
}

function createDiagnosticsBucket() {
  return {
    issues: [],
    diffEntries: [],
    issueKeys: new Set(),
  };
}

function pushIssue(diagnostics, issue) {
  if (!diagnostics || !issue?.code) return;
  const key = [
    issue.code,
    issue.sectionTitle || "",
    issue.displayName || "",
    issue.source || "",
  ].join("::");
  if (diagnostics.issueKeys.has(key)) return;
  diagnostics.issueKeys.add(key);
  diagnostics.issues.push(issue);
}

function analyzeDisplayName(name = "") {
  const lookupKey = normalizeLookupKey(name);
  if (!lookupKey) {
    return {
      displayName: "",
      typoCorrected: false,
    };
  }

  if (lookupKey.includes("черри")) {
    return {
      displayName: "Помидор черри",
      typoCorrected: false,
    };
  }

  if (REPLACEMENTS[lookupKey]) {
    return {
      displayName: REPLACEMENTS[lookupKey],
      typoCorrected: false,
    };
  }

  const typoFixed = fixKnownTypos(lookupKey);
  if (typoFixed) {
    return {
      displayName: typoFixed,
      typoCorrected: true,
    };
  }

  return {
    displayName: sentenceCase(lookupKey),
    typoCorrected: false,
  };
}

function resolveParsedEntry(rawEntry, sectionTitle) {
  const source = cleanupEntryText(rawEntry);
  const parsed = parseQuantity(source);
  const nameMeta = analyzeDisplayName(parsed.name);
  const displayName = nameMeta.displayName;
  if (!displayName) return;

  const starred =
    String(rawEntry || "").includes("⁕") || hasGreeneryMarker(displayName);
  const item = createItem(displayName, starred);
  const issues = [];

  const normalizedUnit = normalizeUnit(parsed.unit);
  const inStore = isStoreSection(sectionTitle);
  const quantity = parsed.quantity;

  if (!Number.isFinite(quantity)) {
    item.hasNameOnly = true;
  } else if (normalizedUnit === "g") {
    addUnit(item, "kg", quantity / 1000);
  } else if (normalizedUnit) {
    addUnit(item, normalizedUnit, quantity);
  } else if (!inStore) {
    addUnit(item, "kg", quantity);
    item.uncertain = true;
    item.uncertainReasons.add("ambiguousUnitAssumedKg");
    issues.push({
      code: "ambiguousUnitAssumedKg",
      sectionTitle,
      displayName,
      source,
      output: formatSectionLine(item),
    });
  } else if (item.starred) {
    addUnit(item, "bunch", quantity);
  } else if (isStoreBagName(displayName)) {
    const isWholeNumber = Number.isInteger(quantity);
    if (isWholeNumber && quantity >= 1 && quantity <= 10) {
      addUnit(item, "bag", quantity);
    } else {
      addUnit(item, "kg", quantity);
    }
  } else {
    item.hasNameOnly = true;
    item.uncertain = true;
    item.uncertainReasons.add("storeQuantityIgnored");
    issues.push({
      code: "storeQuantityIgnored",
      sectionTitle,
      displayName,
      source,
      output: formatSectionLine(item),
    });
  }

  if (nameMeta.typoCorrected) {
    item.uncertain = true;
    item.uncertainReasons.add("typoCorrected");
    issues.push({
      code: "typoCorrected",
      sectionTitle,
      displayName,
      source,
      output: formatSectionLine(item),
    });
  }

  const output = formatSectionLine(item);
  return {
    key: item.key,
    item,
    source,
    output,
    changed: source !== output,
    issues,
  };
}

function addParsedEntry(targetMap, rawEntry, sectionTitle, diagnostics) {
  const resolved = resolveParsedEntry(rawEntry, sectionTitle);
  if (!resolved) return;

  const current = targetMap.get(resolved.key) || createItem(resolved.item.displayName, resolved.item.starred);
  const existed = targetMap.has(resolved.key);
  current.displayName = resolved.item.displayName;
  current.starred = current.starred || resolved.item.starred;
  current.hasNameOnly = current.hasNameOnly || resolved.item.hasNameOnly;
  current.uncertain = current.uncertain || resolved.item.uncertain;
  resolved.item.rawEntries.forEach((entry) => current.rawEntries.push(entry));
  current.rawEntries.push(resolved.source);
  resolved.item.uncertainReasons.forEach((reason) =>
    current.uncertainReasons.add(reason),
  );
  Object.keys(current.units).forEach((unitKey) => {
    current.units[unitKey] += resolved.item.units[unitKey] || 0;
  });

  if (existed) {
    current.uncertain = true;
    current.uncertainReasons.add("duplicateMerged");
    pushIssue(diagnostics, {
      code: "duplicateMerged",
      sectionTitle,
      displayName: current.displayName,
      source: resolved.source,
      output: formatSectionLine(current),
    });
  }

  resolved.issues.forEach((issue) => {
    pushIssue(diagnostics, issue);
  });

  if (diagnostics && (resolved.changed || resolved.item.uncertain)) {
    diagnostics.diffEntries.push({
      sectionTitle,
      source: resolved.source,
      output: resolved.output,
      uncertain: resolved.item.uncertain,
      issueCodes: resolved.issues.map((issue) => issue.code),
    });
  }

  targetMap.set(resolved.key, current);
}

function formatUnitsForSection(item) {
  const parts = [];
  if (item.units.kg > 0) parts.push(formatNumber(item.units.kg));
  if (item.units.pcs > 0) parts.push(`${formatNumber(item.units.pcs)} шт`);
  if (item.units.bunch > 0) parts.push(`${formatNumber(item.units.bunch)}п`);
  if (item.units.head > 0) parts.push(`${formatNumber(item.units.head)} гол`);
  if (item.units.pack > 0) parts.push(`${formatNumber(item.units.pack)} пака`);
  if (item.units.bag > 0) parts.push(`${formatNumber(item.units.bag)}м`);
  return parts.join(" + ");
}

function formatUnitsForSummary(item) {
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

function formatSectionLine(item) {
  const name = item.starred ? `${item.displayName}⁕` : item.displayName;
  const suffix = formatUnitsForSection(item);
  return suffix ? `${name} ${suffix}` : name;
}

function formatSummaryLine(item) {
  const suffix = formatUnitsForSummary(item);
  const sources = Array.from(item.sources);
  const sourceText = sources.length ? ` (${sources.join(", ")})` : "";
  if (!suffix) return `${item.displayName}${sourceText}`;
  return `${item.displayName} ${suffix}${sourceText}`;
}

function cloneUnits(units = {}) {
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

function buildSectionContract(section) {
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

function buildSummaryContract(summary) {
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

function buildAggregateSummary(sections, labels, options = {}) {
  const { includeItem = () => true, summaryKey = "summary" } = options;
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

function buildProductListContract(input = "", options = {}) {
  const labels = {
    ...DEFAULT_LABELS,
    ...(options.labels || {}),
  };
  const includeSummary = options.includeSummary !== false;
  const includeGreensSummary = options.includeGreensSummary === true;
  const diagnostics = createDiagnosticsBucket();
  const internalSections = collectSections(input, labels, diagnostics);
  const sections = internalSections.map(buildSectionContract);
  const internalSummary = includeSummary
    ? buildAggregateSummary(internalSections, labels, {
        includeItem: (item) => !item.starred,
        summaryKey: "summary",
      })
    : null;
  const summary = internalSummary
    ? buildSummaryContract(internalSummary)
    : null;
  const internalGreensSummary = includeGreensSummary
    ? buildAggregateSummary(internalSections, labels, {
        includeItem: (item) => item.starred,
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
  };
}

function sortByRuAlpha(a, b) {
  return String(a).localeCompare(String(b), "ru", { sensitivity: "base" });
}

function collectSections(input = "", labels = DEFAULT_LABELS, diagnostics) {
  const rawLines = String(input || "").split("\n");
  const sections = [];
  let currentSection = null;
  let previousBlank = true;

  rawLines.forEach((rawLine, index) => {
    const line = cleanupEntryText(rawLine);
    if (!line) {
      previousBlank = true;
      return;
    }

    const nextLine = rawLines
      .slice(index + 1)
      .map((item) => cleanupEntryText(item))
      .find(Boolean);
    const atStart = sections.length === 0 && !currentSection;
    const isHeading = isLikelySectionHeading(line, nextLine, {
      afterBlank: previousBlank,
      atStart,
    });

    if (isHeading) {
      currentSection = {
        title: normalizeSectionTitle(line),
        itemsMap: new Map(),
      };
      sections.push(currentSection);
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
