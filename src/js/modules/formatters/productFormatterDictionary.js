const STORAGE_KEY = "thunder_products_dev_dictionary";

function normalizeLine(value = "") {
  return String(value || "").replace(/\r/g, "").trim();
}

export function parseProductFormatterDictionary(text = "") {
  return String(text || "")
    .split("\n")
    .map((line) => normalizeLine(line))
    .filter(Boolean)
    .reduce((dictionary, line) => {
      const separatorIndex = line.indexOf("=");
      if (separatorIndex === -1) return dictionary;
      const source = normalizeLine(line.slice(0, separatorIndex)).toLowerCase();
      const target = normalizeLine(line.slice(separatorIndex + 1));
      if (!source || !target) return dictionary;
      dictionary[source] = target;
      return dictionary;
    }, {});
}

export function loadProductFormatterDictionary() {
  try {
    return window.localStorage?.getItem(STORAGE_KEY) || "";
  } catch {
    return "";
  }
}

export function saveProductFormatterDictionary(text = "") {
  try {
    window.localStorage?.setItem(STORAGE_KEY, String(text || ""));
  } catch {}
}

export function clearProductFormatterDictionary() {
  try {
    window.localStorage?.removeItem(STORAGE_KEY);
  } catch {}
}
