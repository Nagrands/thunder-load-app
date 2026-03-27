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
  return Math.abs(quantity - 0.05) < 0.0001;
}

export function shouldTreatPackAsPieces(name = "") {
  return hasGreeneryMarker(name);
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
    },
    hasNameOnly: false,
    uncertain: false,
    uncertainReasons: new Set(),
    rawEntries: [],
  };
}

export function addUnit(item, unitKey, quantity) {
  if (!unitKey || !Number.isFinite(quantity) || quantity <= 0) return;
  item.units[unitKey] += quantity;
}
