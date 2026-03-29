import { normalizeLookupKey } from "./productListFormatterParsing.js";
import {
  GREENERY_PATTERNS,
  STORE_BAG_PATTERNS,
  TYPO_STEMS,
} from "./productListFormatterData.js";

export function fixKnownTypos(lookupKey = "") {
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

export function hasGreeneryMarker(name = "") {
  const lookupKey = normalizeLookupKey(name);
  return GREENERY_PATTERNS.some((pattern) =>
    lookupKey === pattern || lookupKey.startsWith(`${pattern} `),
  );
}

export function isStoreBagName(name = "") {
  const lookupKey = normalizeLookupKey(name);
  return STORE_BAG_PATTERNS.some(
    (pattern) => lookupKey === pattern || lookupKey.startsWith(`${pattern} `),
  );
}

export function shouldConvertSmallGreeneryKgToBunch(name = "", quantity = 0) {
  const lookupKey = normalizeLookupKey(name);
  if (!hasGreeneryMarker(lookupKey)) return false;
  if (lookupKey === "розмарин") return false;
  return Math.abs(quantity - 0.05) < 0.0001;
}

export function shouldTreatPackAsPieces(name = "") {
  return hasGreeneryMarker(name);
}

export function shouldTreatPackAsCrate(name = "") {
  const lookupKey = normalizeLookupKey(name);
  return lookupKey === "банан";
}

export function shouldTreatUnitlessQuantityAsPieces(name = "") {
  const lookupKey = normalizeLookupKey(name);
  return [
    "яйца",
    "яйцо перепелиное",
    "стебель сельдерея",
  ].includes(lookupKey);
}

export function shouldHidePcsUnitInSection(name = "") {
  const lookupKey = normalizeLookupKey(name);
  return [
    "яйца",
    "яйцо перепелиное",
  ].includes(lookupKey);
}

export function shouldHidePiecesUnitInSection(name = "") {
  const lookupKey = normalizeLookupKey(name);
  return [
    "яйца",
    "яйцо перепелиное",
  ].includes(lookupKey);
}

export function shouldConvertHeadToPieces(name = "") {
  const lookupKey = normalizeLookupKey(name);
  return lookupKey === "салат айсберг";
}

export function buildSectionQualifier(tail = "") {
  const lookupKey = normalizeLookupKey(tail);
  if (!lookupKey) return "";

  if (["сред", "средний", "средняя", "среднее"].includes(lookupKey)) {
    return "(сред.)";
  }

  const tokens = lookupKey.split(/\s+/).filter(Boolean);
  const qualifierMap = new Map([
    ["зел", "(зеленый)"],
    ["зеленый", "(зеленый)"],
    ["зелёный", "(зеленый)"],
    ["кр", "(красный)"],
    ["красный", "(красный)"],
    ["круп", "(крупный)"],
    ["крупный", "(крупный)"],
  ]);

  for (const token of tokens) {
    if (qualifierMap.has(token)) {
      return qualifierMap.get(token) || "";
    }
  }

  return "";
}

export function createItem(displayName = "", starred = false) {
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
    bucket: 0,
    },
    hasNameOnly: false,
    uncertain: false,
    hidePcsUnitInSection: false,
    sectionQualifier: "",
    uncertainReasons: new Set(),
    rawEntries: [],
  };
}

export function addUnit(item, unitKey, quantity) {
  if (!unitKey || !Number.isFinite(quantity) || quantity <= 0) return;
  item.units[unitKey] += quantity;
}
