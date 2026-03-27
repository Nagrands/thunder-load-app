import { normalizeLookupKey } from "./productListFormatterParsing.js";

export const DEFAULT_LABELS = Object.freeze({
  summary: "Итого",
  greens: "Зелень",
  unsorted: "Без раздела",
});

export const DEFAULT_REPLACEMENTS = Object.freeze({
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
