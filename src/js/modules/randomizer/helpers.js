// src/js/modules/randomizer/helpers.js

export const DEFAULT_ITEMS = [
  "Новый ролик с YouTube",
  "Клип с Twitch",
  "Видео из VK",
  "Музыкальный трек",
  "Файл для резервной копии",
];

export const MAX_HISTORY = 15;
export const WEIGHT_MIN = 1;
export const WEIGHT_MAX = 10;
export const DEFAULT_WEIGHT = 1;
export const DEFAULT_PRESET_NAME = "Основной";
export const MAX_ITEM_LENGTH = 160;

const cloneValue = (value) =>
  Array.isArray(value)
    ? value.slice()
    : typeof value === "object" && value !== null
      ? { ...value }
      : value;

export const readJson = (key, fallback) => {
  try {
    const raw = localStorage.getItem(key);
    if (!raw) return cloneValue(fallback);
    const parsed = JSON.parse(raw);
    return Array.isArray(fallback)
      ? Array.isArray(parsed)
        ? parsed
        : cloneValue(fallback)
      : { ...cloneValue(fallback), ...(parsed || {}) };
  } catch {
    return cloneValue(fallback);
  }
};

export const saveJson = (key, value) => {
  try {
    localStorage.setItem(key, JSON.stringify(value));
  } catch (error) {
    console.warn("[Randomizer] Unable to persist", key, error);
  }
};

export const clampWeight = (raw) => {
  const n = Number(raw);
  if (!Number.isFinite(n)) return DEFAULT_WEIGHT;
  return Math.min(WEIGHT_MAX, Math.max(WEIGHT_MIN, Math.round(n)));
};

export const clampHits = (raw) => {
  const n = Number(raw);
  if (!Number.isFinite(n) || n < 0) return 0;
  return Math.floor(n);
};

export const clampMisses = (raw) => {
  const n = Number(raw);
  if (!Number.isFinite(n) || n < 0) return 0;
  return Math.floor(n);
};

export const normalizeItems = (
  rawItems,
  { allowEmpty = false, defaultItems = DEFAULT_ITEMS } = {},
) => {
  const list = Array.isArray(rawItems) ? rawItems : [];
  const seen = new Set();
  const normalized = [];

  list.forEach((entry) => {
    const rawValue =
      typeof entry === "string"
        ? entry
        : typeof entry?.value === "string"
          ? entry.value
          : "";
    const value = rawValue.trim();
    if (!value) return;
    const key = value.toLowerCase();
    if (seen.has(key)) return;
    seen.add(key);
    const weight = clampWeight(
      typeof entry === "object" && entry !== null
        ? entry.weight
        : DEFAULT_WEIGHT,
    );
    const hits = clampHits(
      typeof entry === "object" && entry !== null ? entry.hits : 0,
    );
    const misses = clampMisses(
      typeof entry === "object" && entry !== null ? entry.misses : 0,
    );
    normalized.push({ value, weight, hits, misses });
  });

  if (!normalized.length) {
    if (allowEmpty && Array.isArray(rawItems)) return [];
    return defaultItems.map((value) => ({
      value,
      weight: DEFAULT_WEIGHT,
      hits: 0,
      misses: 0,
    }));
  }

  return normalized;
};

export const normalizePresets = (
  rawPresets,
  { allowEmptyItems = false, defaultItems = DEFAULT_ITEMS } = {},
) => {
  const list = Array.isArray(rawPresets) ? rawPresets : [];
  const seen = new Set();
  const normalized = [];

  list.forEach((preset) => {
    const name =
      typeof preset?.name === "string" && preset.name.trim()
        ? preset.name.trim()
        : "";
    if (!name) return;
    const key = name.toLowerCase();
    if (seen.has(key)) return;
    seen.add(key);
    const items = normalizeItems(preset?.items || [], {
      allowEmpty: allowEmptyItems,
      defaultItems,
    });
    normalized.push({ name, items });
  });

  return normalized;
};

export const triggerPulse = (el, className = "pulse") => {
  if (!el) return;
  el.classList.remove(className);
  // force reflow
  void el.offsetWidth;
  el.classList.add(className);
};

export function declOfNum(n, titles) {
  const cases = [2, 0, 1, 1, 1, 2];
  return titles[
    n % 100 > 4 && n % 100 < 20 ? 2 : cases[n % 10 < 5 ? n % 10 : 5]
  ];
}

export function escapeHtml(str) {
  const div = document.createElement("div");
  div.textContent = str;
  return div.innerHTML;
}

export default {
  DEFAULT_ITEMS,
  MAX_HISTORY,
  WEIGHT_MIN,
  WEIGHT_MAX,
  DEFAULT_WEIGHT,
  DEFAULT_PRESET_NAME,
  MAX_ITEM_LENGTH,
  readJson,
  saveJson,
  clampWeight,
  clampHits,
  normalizeItems,
  normalizePresets,
  triggerPulse,
  declOfNum,
  escapeHtml,
};
