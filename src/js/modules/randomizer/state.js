// src/js/modules/randomizer/state.js

import {
  DEFAULT_ITEMS,
  MAX_HISTORY,
  DEFAULT_PRESET_NAME,
  normalizeItems,
  normalizePresets,
  clampWeight,
  clampMisses,
} from "./helpers.js";

const STORAGE_KEYS = {
  ITEMS: "randomizerItems",
  HISTORY: "randomizerHistory",
  SETTINGS: "randomizerSettings",
  POOL: "randomizerPool",
  PRESETS: "randomizerPresets",
  CURRENT_PRESET: "randomizerCurrentPreset",
  DEFAULT_PRESET: "randomizerDefaultPreset",
};

export function createRandomizerState(storage) {
  const { readJson, saveJson, readText, writeText, hasKey, setItem } = storage;

  const clampSpinSeconds = (value) =>
    Math.min(60, Math.max(0, Number(value ?? 0.4)));
  const clampAutoInterval = (value) =>
    Math.min(3600, Math.max(1, Math.round(Number(value ?? 5))));
  const clampAutoStopCount = (value) =>
    Math.min(9999, Math.max(1, Math.round(Number(value ?? 5))));
  const normalizeStopMode = (raw) =>
    ["none", "count", "match"].includes(raw) ? raw : "none";
  const normalizeStopMatch = (value) =>
    typeof value === "string" ? value.slice(0, 120) : "";

  const hasStoredItems = hasKey(STORAGE_KEYS.ITEMS);
  let presets = normalizePresets(readJson(STORAGE_KEYS.PRESETS, []), {
    allowEmptyItems: true,
    defaultItems: DEFAULT_ITEMS,
  });
  let currentPresetName = readText(STORAGE_KEYS.CURRENT_PRESET) || "";
  let defaultPresetName = readText(STORAGE_KEYS.DEFAULT_PRESET) || "";
  let items = normalizeItems(readJson(STORAGE_KEYS.ITEMS, DEFAULT_ITEMS), {
    allowEmpty: hasStoredItems,
    defaultItems: DEFAULT_ITEMS,
  });
  let history = readJson(STORAGE_KEYS.HISTORY, []);
  let settings = readJson(STORAGE_KEYS.SETTINGS, {
    noRepeat: true,
    spinSeconds: 0.4,
    autoRollInterval: 5,
    autoStopMode: "none",
    autoStopCount: 5,
    autoStopMatch: "",
    autoStopOnPoolDepletion: true,
    autoNotifySound: true,
    autoNotifyFlash: true,
  });
  settings = {
    noRepeat: !!settings?.noRepeat,
    spinSeconds: clampSpinSeconds(settings?.spinSeconds),
    autoRollInterval: clampAutoInterval(settings?.autoRollInterval),
    autoStopMode: normalizeStopMode(settings?.autoStopMode),
    autoStopCount: clampAutoStopCount(settings?.autoStopCount),
    autoStopMatch: normalizeStopMatch(settings?.autoStopMatch),
    autoStopOnPoolDepletion: settings?.autoStopOnPoolDepletion !== false,
    autoNotifySound: settings?.autoNotifySound !== false,
    autoNotifyFlash: settings?.autoNotifyFlash !== false,
  };
  let pool = readJson(STORAGE_KEYS.POOL, []);

  const savePresets = () => {
    saveJson(STORAGE_KEYS.PRESETS, presets);
    if (currentPresetName)
      setItem(STORAGE_KEYS.CURRENT_PRESET, currentPresetName);
    if (defaultPresetName)
      setItem(STORAGE_KEYS.DEFAULT_PRESET, defaultPresetName);
  };

  const ensurePresetExists = () => {
    if (!presets.length) {
      presets = [
        {
          name: DEFAULT_PRESET_NAME,
          items: items.length ? items : normalizeItems(DEFAULT_ITEMS),
        },
      ];
    }
    if (!currentPresetName) currentPresetName = presets[0].name;
    if (!defaultPresetName) defaultPresetName = presets[0].name;
    if (defaultPresetName && !presets.some((p) => p.name === defaultPresetName))
      defaultPresetName = "";
    savePresets();
  };

  const normalizePool = () => {
    pool = (Array.isArray(pool) ? pool : []).filter((value) =>
      items.some((item) => item.value === value && !item.excluded),
    );
    if (!pool.length)
      pool = items.filter((item) => !item.excluded).map((item) => item.value);
    saveJson(STORAGE_KEYS.POOL, pool);
  };

  const resetPool = () => {
    pool = items.filter((item) => !item.excluded).map((item) => item.value);
    saveJson(STORAGE_KEYS.POOL, pool);
  };

  const consumeFromPool = (value) => {
    pool = pool.filter((entry) => entry !== value);
    saveJson(STORAGE_KEYS.POOL, pool);
  };

  const persistItems = (options = {}) => {
    const { resetPool: shouldResetPool = false, updatePreset = true } = options;
    saveJson(STORAGE_KEYS.ITEMS, items);
    if (updatePreset) syncCurrentPresetItems();
    if (shouldResetPool) resetPool();
    else saveJson(STORAGE_KEYS.POOL, pool);
  };

  const persistHistory = () => saveJson(STORAGE_KEYS.HISTORY, history);
  const persistSettings = () => saveJson(STORAGE_KEYS.SETTINGS, settings);

  const refreshPresetSelectData = () => ({
    presets,
    currentPresetName,
    defaultPresetName,
  });

  const applyPreset = (name) => {
    const preset = presets.find((p) => p.name === name);
    if (!preset) return false;
    currentPresetName = preset.name;
    items = normalizeItems(preset.items, { allowEmpty: true });
    resetPool();
    savePresets();
    return true;
  };

  const syncCurrentPresetItems = () => {
    const preset = presets.find((p) => p.name === currentPresetName);
    if (!preset) return;
    preset.items = items.map((item) => ({ ...item }));
    savePresets();
  };

  const createPreset = (name, sourceItems = items) => {
    const trimmed = (name || "").trim();
    if (!trimmed) return false;
    const exists = presets.some(
      (p) => p.name.toLowerCase() === trimmed.toLowerCase(),
    );
    const baseItems = normalizeItems(
      Array.isArray(sourceItems) ? sourceItems : items,
      { allowEmpty: true },
    );
    const clonedItems = baseItems.map((item) => ({ ...item }));
    if (exists) {
      presets = presets.map((p) =>
        p.name.toLowerCase() === trimmed.toLowerCase()
          ? { ...p, name: trimmed, items: clonedItems }
          : p,
      );
      currentPresetName = trimmed;
    } else {
      presets.push({ name: trimmed, items: clonedItems });
      currentPresetName = trimmed;
    }
    savePresets();
    return true;
  };

  const deletePreset = (name) => {
    if (presets.length <= 1) return false;
    presets = presets.filter((p) => p.name !== name);
    if (defaultPresetName === name) defaultPresetName = "";
    if (currentPresetName === name) {
      currentPresetName = presets[0]?.name || "";
      items = presets[0]?.items
        ? normalizeItems(presets[0].items, { allowEmpty: true })
        : items;
      resetPool();
    }
    savePresets();
    return true;
  };

  const addHistoryEntry = (value, presetName = currentPresetName) => {
    history.unshift({ value, ts: Date.now(), preset: presetName || "" });
    history = history.slice(0, MAX_HISTORY);
    persistHistory();
  };

  const clearHistory = () => {
    history = [];
    persistHistory();
  };

  const updateItem = (oldValue, newValue, options = {}) => {
    const trimmed = newValue.trim();
    if (!trimmed) return false;
    const duplicate = items.some(
      (entry) =>
        entry.value.toLowerCase() === trimmed.toLowerCase() &&
        entry.value.toLowerCase() !== oldValue.toLowerCase(),
    );
    if (duplicate) return false;
    const idx = items.findIndex((entry) => entry.value === oldValue);
    if (idx === -1) return false;
    const current = items[idx];
    items.splice(idx, 1, { ...current, value: trimmed });
    pool = pool.map((value) => (value === oldValue ? trimmed : value));
    persistItems(options);
    return true;
  };

  const addItem = (value) => {
    const normalized = value.trim();
    if (!normalized) return false;
    const exists = items.some(
      (item) => item.value.toLowerCase() === normalized.toLowerCase(),
    );
    if (exists) return false;
    const newItem = {
      value: normalized,
      weight: clampWeight(),
      hits: 0,
      misses: 0,
      favorite: false,
      excluded: false,
    };
    items.push(newItem);
    pool.push(newItem.value);
    persistItems({ resetPool: false });
    return true;
  };

  const bulkAdd = (values) => {
    let added = 0;
    values.forEach((value) => {
      const before = items.length;
      addItem(value);
      if (items.length > before) added += 1;
    });
    return added;
  };

  const removeItems = (toRemove) => {
    items = items.filter((item) => !toRemove.has(item.value));
    pool = pool.filter((value) => !toRemove.has(value));
    persistItems({ resetPool: false });
  };

  const moveItem = (fromValue, toValue) => {
    if (!fromValue || !toValue || fromValue === toValue) return false;
    const fromIndex = items.findIndex((entry) => entry.value === fromValue);
    const toIndex = items.findIndex((entry) => entry.value === toValue);
    if (fromIndex === -1 || toIndex === -1) return false;
    const [moved] = items.splice(fromIndex, 1);
    items.splice(toIndex, 0, moved);
    persistItems({ resetPool: false });
    return true;
  };

  const setWeight = (value, weight) => {
    const idx = items.findIndex((entry) => entry.value === value);
    if (idx === -1) return false;
    items[idx].weight = clampWeight(weight);
    persistItems({ resetPool: false });
    return true;
  };

  const setDefaultPreset = (name) => {
    const exists = presets.some((p) => p.name === name);
    defaultPresetName = exists ? name : "";
    savePresets();
    return exists;
  };

  const pickCandidates = (noRepeat) =>
    noRepeat
      ? items.filter((item) => !item.excluded && pool.includes(item.value))
      : items.filter((item) => !item.excluded);

  const toggleFavorite = (value) => {
    const idx = items.findIndex((entry) => entry.value === value);
    if (idx === -1) return false;
    items[idx].favorite = !items[idx].favorite;
    persistItems({ resetPool: false });
    return items[idx].favorite;
  };

  const toggleExclude = (value) => {
    const idx = items.findIndex((entry) => entry.value === value);
    if (idx === -1) return false;
    const next = !items[idx].excluded;
    items[idx].excluded = next;
    if (next) {
      pool = pool.filter((entry) => entry !== value);
    } else if (settings.noRepeat && !pool.includes(value)) {
      pool.push(value);
    }
    persistItems({ resetPool: false });
    return next;
  };

  return {
    STORAGE_KEYS,
    getState: () => ({
      items,
      presets,
      history,
      settings,
      pool,
      currentPresetName,
      defaultPresetName,
    }),
    ensurePresetExists,
    normalizePool,
    resetPool,
    applyPreset,
    createPreset,
    deletePreset,
    syncCurrentPresetItems,
    savePresets,
    persistItems,
    persistHistory,
    persistSettings,
    refreshPresetSelectData,
    addHistoryEntry,
    updateItem,
    addItem,
    bulkAdd,
    removeItems,
    moveItem,
    setWeight,
    setDefaultPreset,
    pickCandidates,
    consumeFromPool,
    clearHistory,
    toggleFavorite,
    toggleExclude,
  };
}
