export function createEntryParser({
  defaultReplacements,
  cleanupEntryText,
  createItem,
  fixKnownTypos,
  formatSectionLine,
  hasGreeneryMarker,
  isStoreBagName,
  isStoreSection,
  normalizeLookupKey,
  normalizeUnit,
  parseQuantity,
  sentenceCase,
  addUnit,
}) {
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

  function analyzeDisplayName(name = "", replacements = defaultReplacements) {
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

    if (replacements[lookupKey]) {
      return {
        displayName: replacements[lookupKey],
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

  function resolveParsedEntry(rawEntry, sectionTitle, replacements) {
    const source = cleanupEntryText(rawEntry);
    const parsed = parseQuantity(source);
    const nameMeta = analyzeDisplayName(parsed.name, replacements);
    const displayName = nameMeta.displayName;
    if (!displayName) return null;

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
    if (
      item.uncertainReasons.has("ambiguousUnitAssumedKg") &&
      normalizeLookupKey(source) === normalizeLookupKey(output) &&
      issues.every((issue) => issue.code === "ambiguousUnitAssumedKg")
    ) {
      item.uncertain = false;
      item.uncertainReasons.delete("ambiguousUnitAssumedKg");
      issues.length = 0;
    }

    return {
      key: item.key,
      item,
      source,
      output,
      changed: source !== output,
      issues,
    };
  }

  function addParsedEntry(
    targetMap,
    rawEntry,
    sectionTitle,
    diagnostics,
    replacements,
  ) {
    const resolved = resolveParsedEntry(rawEntry, sectionTitle, replacements);
    if (!resolved) return;

    const current =
      targetMap.get(resolved.key) ||
      createItem(resolved.item.displayName, resolved.item.starred);
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

    const hasMeaningfulDiff =
      normalizeLookupKey(resolved.source) !== normalizeLookupKey(resolved.output);

    if (diagnostics && (hasMeaningfulDiff || resolved.item.uncertain)) {
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

  return {
    addParsedEntry,
    createDiagnosticsBucket,
  };
}
