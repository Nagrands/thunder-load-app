export function createEntryNormalizer({
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
  buildSectionQualifier,
  shouldConvertHeadToPieces,
  shouldConvertSmallGreeneryKgToBunch,
  shouldHidePiecesUnitInSection,
  shouldTreatPackAsCrate,
  shouldTreatPackAsPieces,
  shouldTreatUnitlessQuantityAsPieces,
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

  function expandCommonLookupVariants(lookupKey = "") {
    return normalizeLookupKey(lookupKey)
      .replace(/\bзел\b/g, "зеленый")
      .replace(/\bкр\b/g, "красный");
  }

  function analyzeDisplayName(name = "", replacements = defaultReplacements) {
    const lookupKey = normalizeLookupKey(name);
    const expandedLookupKey = expandCommonLookupVariants(lookupKey);
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

    if (expandedLookupKey && replacements[expandedLookupKey]) {
      return {
        displayName: replacements[expandedLookupKey],
        typoCorrected: false,
      };
    }

    if (lookupKey.startsWith("капуста мол")) {
      return {
        displayName: "Капуста молодая",
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
      displayName: sentenceCase(expandedLookupKey || lookupKey),
      typoCorrected: false,
    };
  }

  function resolveParsedEntry(rawEntry, sectionTitle, replacements) {
    const source = cleanupEntryText(rawEntry);
    const parsed = parseQuantity(source);
    const sectionQualifier = buildSectionQualifier(parsed.tail);
    const effectiveName = sectionQualifier
      ? parsed.name
      : cleanupEntryText([parsed.name, parsed.tail].filter(Boolean).join(" "));
    const nameMeta = analyzeDisplayName(effectiveName, replacements);
    const displayName = nameMeta.displayName;
    if (!displayName) return null;
    if (
      !Number.isFinite(parsed.quantity) &&
      displayName === "Латук" &&
      normalizeLookupKey(source) === "лист салата"
    ) {
      return null;
    }

    const starred =
      String(rawEntry || "").includes("⁕") || hasGreeneryMarker(displayName);
    const item = createItem(displayName, starred);
    item.sectionQualifier = sectionQualifier;
    if (item.sectionQualifier) {
      item.key = `${item.key}::${normalizeLookupKey(item.sectionQualifier)}`;
    }
    const issues = [];

    const normalizedUnit = normalizeUnit(parsed.unit);
    const inStore = isStoreSection(sectionTitle);
    const quantity = parsed.quantity;

    if (!Number.isFinite(quantity)) {
      item.hasNameOnly = true;
    } else if (normalizedUnit === "g") {
      const normalizedQuantity = quantity < 1 ? quantity : quantity / 1000;
      addUnit(item, "kg", normalizedQuantity);
    } else if (
      normalizedUnit === "head" &&
      shouldConvertHeadToPieces(displayName)
    ) {
      addUnit(item, "pcs", quantity);
    } else if (normalizedUnit) {
      if (normalizedUnit === "pack" && shouldTreatPackAsCrate(displayName)) {
        addUnit(item, "crate", quantity);
      } else if (normalizedUnit === "pack" && shouldTreatPackAsPieces(displayName)) {
        addUnit(item, "pcs", quantity);
      } else if (
        normalizedUnit === "kg" &&
        shouldConvertSmallGreeneryKgToBunch(displayName, quantity)
      ) {
        addUnit(item, "bunch", Math.round(quantity / 0.05));
      } else {
        addUnit(item, normalizedUnit, quantity);
        if (normalizedUnit === "pcs" && shouldHidePiecesUnitInSection(displayName)) {
          item.hidePcsUnitInSection = true;
        }
      }
    } else if (!inStore) {
      if (shouldTreatUnitlessQuantityAsPieces(displayName)) {
        addUnit(item, "pcs", quantity);
        item.hidePcsUnitInSection = shouldHidePiecesUnitInSection(displayName);
      } else if (shouldConvertSmallGreeneryKgToBunch(displayName, quantity)) {
        addUnit(item, "bunch", Math.round(quantity / 0.05));
      } else {
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
      }
    } else if (shouldTreatUnitlessQuantityAsPieces(displayName)) {
      addUnit(item, "pcs", quantity);
      item.hidePcsUnitInSection = shouldHidePiecesUnitInSection(displayName);
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
    current.hidePcsUnitInSection =
      current.hidePcsUnitInSection || resolved.item.hidePcsUnitInSection;
    current.sectionQualifier =
      current.sectionQualifier || resolved.item.sectionQualifier;
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
