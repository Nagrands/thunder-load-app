const UNIT_RE =
  "(кг|килограмм(?:а|ов)?|к|гр|грамм(?:а|ов)?|г|шт|штук|штуки|шт\\.|пуч|пучок|пучка|п|гол|голова|головы|голов|головка|головки|пака|пак|пач|пачка|пачки|банка|банки|ящ|ящик|ящика|м|ведро|ведра|в)";
const BULLET_RE = /[•·●▪◦‣⁃∙◉○◌◍]/g;
const QUOTE_RE = /["'`“”„‟«»‹›]/g;
const SLASH_DELIMITER_RE = /\s+\/+\s+/g;
const BRACKETED_QUANTITY_RE = new RegExp(
  `\\(\\s*(\\d+(?:[.,:]\\d+)?)\\s*${UNIT_RE}?\\s*\\)`,
  "gi",
);

export const QUANTITY_RE = `(\\d+(?:\\.\\d+)?)\\s*${UNIT_RE}?`;

const PREFIX_QUANTITY_RE = new RegExp(`^${QUANTITY_RE}\\s+(.+)$`, "i");
const SUFFIX_QUANTITY_RE = new RegExp(`^(.+?)\\s+${QUANTITY_RE}$`, "i");
const INFIX_QUANTITY_RE = new RegExp(
  `^(.+?)\\s+${QUANTITY_RE}(?:\\s+(.+))?$`,
  "i",
);

function preNormalizeRawText(value = "") {
  return String(value || "")
    .replace(/[\u200B-\u200D\u2060\uFEFF]/g, "")
    .replace(/[\u00A0\u1680\u2000-\u200A\u202F\u205F\u3000]/g, " ")
    .replace(/[‐‑‒–—−]/g, "-")
    .replace(QUOTE_RE, "")
    .replace(BULLET_RE, ",")
    .replace(BRACKETED_QUANTITY_RE, "$1 $2")
    .replace(/(^|[\s(])(?:o|о|O|О)(?=[.,]\d)/g, "$10")
    .replace(/(\d)\s*[xх×]\s*(?=(?:шт|штук|штуки|кг|килограмм|гр|грамм|г|пуч|пучок|гол|пака|пак|пач|банка|ящ|ящик|м|ведро|в)\b)/gi, "$1 ")
    .replace(/(\d)\s*[xх×](?=$|[\s,.;:])/g, "$1 шт")
    .replace(/(^|[\s,.;:])([xх×])\s*(\d)(?=$|[\s,.;:])/gi, "$1$3 шт")
    .replace(/\/{2,}/g, "/")
    .replace(/[,:;!?/\\]+$/g, "");
}

export function normalizeWhitespace(value = "") {
  return preNormalizeRawText(value)
    .replace(/\r/g, "")
    .replace(/\t/g, " ")
    .replace(/\u00a0/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

export function cleanupEntryText(value = "") {
  return normalizeWhitespace(
    preNormalizeRawText(value)
      .replace(/([а-яё])([А-ЯЁ])/g, "$1 $2")
      .replace(/(^|[\s-])[оО](?=[.,]\d)/g, "$10")
      .replace(/(\d)\s*([,:])\s*(\d)/g, "$1.$3")
      .replace(/(\d),(\d)/g, "$1.$2")
      .replace(/(\d):(\d)/g, "$1.$2")
      .replace(/(\d)\s+(\d{3})(?=\s*(кг|гр|г)\b)/gi, "$1.$2")
      .replace(/([A-Za-zА-Яа-яЁё⁕])\s*-\s*(?=\d)/g, "$1 ")
      .replace(/(^|\s)-\s*(?=\d)/g, "$1")
      .replace(/(\d)\s*-\s*(?=[A-Za-zА-Яа-яЁё⁕]+)/g, "$1 ")
      .replace(/(\d)\s*-\s*(?=(кг|гр|г|шт|штук|штуки|пуч|пучок|пучка|п|гол|головы|голов|головка|головки|пака|пак|пач|пачка|пачки|банка|банки|ящ|ящик|ящика|м|ведро|ведра|в)\b)/gi, "$1 ")
      .replace(/(^|\s)пол\s+пака(?=\s|$)/gi, "$10.5 пака")
      .replace(/\bмед\s+(\d+(?:[.,]\d+)?)\s*бан(?:ка|ки)?\b/gi, "мед $1")
      .replace(/\bсред\s+на\s+голубцы\b/gi, "")
      .replace(/\b(кг|гр|г|шт|пуч|гол|пака|пак|пач|пачка|пачки|банка|банки|ящ|ящик|ящика|м|ведро|ведра|в)\./gi, "$1")
      .replace(/([A-Za-zА-Яа-яЁё⁕])\s*\/\s*(?=\d)/g, "$1 ")
      .replace(/(\d)([A-Za-zА-Яа-яЁё⁕]+)/g, "$1 $2")
      .replace(/([A-Za-zА-Яа-яЁё⁕])(\d)/g, "$1 $2")
      .replace(/[,:;!?/\\]+$/g, "")
      .replace(/\.+$/g, ""),
  );
}

export function normalizeLookupKey(value = "") {
  return normalizeWhitespace(
    String(value || "")
      .toLowerCase()
      .replace(/ё/g, "е")
      .replace(/⁕/g, "")
      .replace(/-+/g, " ")
      .replace(/[.,:;]+/g, " "),
  );
}

export function sentenceCase(value = "") {
  const normalized = normalizeWhitespace(value.toLowerCase());
  if (!normalized) return "";
  return normalized.charAt(0).toUpperCase() + normalized.slice(1);
}

export function isStoreSection(sectionTitle = "") {
  return normalizeLookupKey(sectionTitle) === "магазин";
}

export function splitEntryCandidates(line = "") {
  return cleanupEntryText(
    preNormalizeRawText(line).replace(SLASH_DELIMITER_RE, ", "),
  )
    .split(/\s*[,;]\s*/)
    .map((item) => cleanupEntryText(item))
    .filter(Boolean);
}

export function looksLikeIngredient(value = "") {
  const line = cleanupEntryText(value);
  if (!line) return false;
  return (
    /[\d]/.test(line) ||
    /[,;]/.test(line) ||
    /\b(пол\s+пака|кг|килограмм|гр|грамм|шт|штук|штуки|пуч|пучок|гол|головка|пака|пач|пачка)\b/i.test(
      line,
    ) ||
    line.split(/\s+/).length > 1
  );
}

export function normalizeSectionTitle(value = "") {
  const cleaned = cleanupEntryText(value).replace(/\s+в\s+\d{1,2}\s*$/i, "");
  const normalized = normalizeLookupKey(cleaned).replace(/\s+в\s+\d{1,2}\s*$/, "");
  if (!normalized) return "";
  const requestMatch = normalized.match(/^заявка\s+(\d+)$/i);
  if (requestMatch) return `Заявка ${requestMatch[1]}`;
  const hasLetters = /[A-Za-zА-Яа-яЁё]/.test(cleaned);
  if (hasLetters && cleaned === cleaned.toUpperCase()) {
    return normalized.toUpperCase();
  }
  return normalized.charAt(0).toUpperCase() + normalized.slice(1);
}

export function isLikelySectionHeading(line, nextLine, context = {}) {
  const normalized = cleanupEntryText(line);
  if (!normalized) return false;
  if (!(context.afterBlank || context.atStart)) return false;
  if (!nextLine) return false;
  const lookup = normalizeLookupKey(normalized).replace(/\s+в\s+\d{1,2}\s*$/, "");
  if (/^заявка\s+\d+$/i.test(lookup)) return true;
  if (lookup === "магазин") return true;
  if (/[,;:]/.test(normalized)) return false;
  if (/[\d]/.test(normalized) && !/\s+в\s+\d{1,2}\s*$/i.test(normalized)) {
    return false;
  }
  if (normalized.split(/\s+/).length > 4) return false;
  return looksLikeIngredient(nextLine);
}

export function parseQuantity(line = "") {
  const cleaned = cleanupEntryText(line);
  if (!cleaned) return { name: "", quantity: null, unit: "", tail: "" };

  let match = cleaned.match(SUFFIX_QUANTITY_RE);
  if (match) {
    return {
      name: cleanupEntryText(match[1]),
      quantity: Number(match[2]),
      unit: cleanupEntryText(match[3] || ""),
      tail: "",
    };
  }

  match = cleaned.match(PREFIX_QUANTITY_RE);
  if (match) {
    return {
      name: cleanupEntryText(match[4]),
      quantity: Number(match[1]),
      unit: cleanupEntryText(match[2] || ""),
      tail: "",
    };
  }

  match = cleaned.match(INFIX_QUANTITY_RE);
  if (match) {
    const before = cleanupEntryText(match[1]);
    const after = cleanupEntryText(match[4] || "");
    return {
      name: before,
      quantity: Number(match[2]),
      unit: cleanupEntryText(match[3] || ""),
      tail: after,
    };
  }

  return { name: cleaned, quantity: null, unit: "", tail: "" };
}

export function normalizeUnit(unit = "") {
  const value = normalizeLookupKey(unit);
  if (!value) return "";
  if (["кг", "килограмм", "килограмма", "килограммов", "к"].includes(value))
    return "kg";
  if (["гр", "грамм", "грамма", "граммов", "г"].includes(value)) return "g";
  if (["шт", "штук", "штуки", "x", "х", "×"].includes(value)) return "pcs";
  if (["пуч", "пучок", "пучка", "п"].includes(value)) return "bunch";
  if (["гол", "голова", "головы", "голов", "головка", "головки"].includes(value))
    return "head";
  if (["пака", "пак", "пач", "пачка", "пачки"].includes(value)) return "pack";
  if (["ящ", "ящик", "ящика"].includes(value)) return "crate";
  if (["м"].includes(value)) return "bag";
  if (["ведро", "ведра", "в"].includes(value)) return "bucket";
  return "";
}
