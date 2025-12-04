import { createRandomizerState } from "../randomizer/state.js";
import {
  DEFAULT_ITEMS,
  DEFAULT_PRESET_NAME,
  normalizeItems,
} from "../randomizer/helpers.js";

const createMockStorage = () => {
  const store = new Map();
  return {
    readJson: (key, fallback) =>
      store.has(key) ? JSON.parse(store.get(key)) : fallback,
    saveJson: (key, value) => store.set(key, JSON.stringify(value)),
    hasKey: (key) => store.has(key),
    readText: (key) => store.get(key) || "",
    setItem: (key, value) => store.set(key, value),
    _store: store,
  };
};

describe("randomizer state", () => {
  test("initializes with defaults and ensures preset", () => {
    const storage = createMockStorage();
    const state = createRandomizerState(storage);
    state.ensurePresetExists();
    const { presets, items, currentPresetName, defaultPresetName } =
      state.getState();
    expect(presets.length).toBeGreaterThan(0);
    expect(items.length).toBeGreaterThan(0);
    expect(currentPresetName).toBe(DEFAULT_PRESET_NAME);
    expect(defaultPresetName).toBe(DEFAULT_PRESET_NAME);
  });

  test("applyPreset switches items and resets pool", () => {
    const storage = createMockStorage();
    storage.saveJson("randomizerPresets", [
      { name: "Base", items: [{ value: "A" }] },
      { name: "Alt", items: [{ value: "B" }] },
    ]);
    storage.setItem("randomizerCurrentPreset", "Base");
    const state = createRandomizerState(storage);
    state.ensurePresetExists();
    state.applyPreset("Alt");
    const { items, currentPresetName, pool } = state.getState();
    expect(currentPresetName).toBe("Alt");
    expect(items.map((i) => i.value)).toEqual(["B"]);
    expect(pool).toEqual(["B"]);
  });

  test("addItem, bulkAdd, removeItems mutate items and pool", () => {
    const storage = createMockStorage();
    const state = createRandomizerState(storage);
    state.ensurePresetExists();
    state.addItem("New");
    let { items, pool } = state.getState();
    expect(items.map((i) => i.value)).toContain("New");
    expect(pool).toContain("New");

    const added = state.bulkAdd(["X", "Y", "New"]);
    ({ items, pool } = state.getState());
    expect(added).toBe(2);
    expect(items.map((i) => i.value)).toEqual(
      expect.arrayContaining(["X", "Y", "New"]),
    );

    state.removeItems(new Set(["X", "New"]));
    ({ items, pool } = state.getState());
    expect(items.map((i) => i.value)).not.toContain("X");
    expect(pool).not.toContain("New");
  });

  test("setWeight and updateItem change item fields", () => {
    const storage = createMockStorage();
    const state = createRandomizerState(storage);
    state.ensurePresetExists();
    state.addItem("Weighty");
    state.setWeight("Weighty", 5);
    state.updateItem("Weighty", "Renamed");
    const { items } = state.getState();
    const renamed = items.find((i) => i.value === "Renamed");
    expect(renamed?.weight).toBe(5);
  });

  test("consumeFromPool removes from pool when noRepeat", () => {
    const storage = createMockStorage();
    const state = createRandomizerState(storage);
    state.ensurePresetExists();
    state.resetPool();
    state.consumeFromPool(DEFAULT_ITEMS[0]);
    const { pool } = state.getState();
    expect(pool).not.toContain(DEFAULT_ITEMS[0]);
  });

  test("addHistoryEntry caps history length", () => {
    const storage = createMockStorage();
    const state = createRandomizerState(storage);
    state.ensurePresetExists();
    for (let i = 0; i < 20; i += 1) {
      state.addHistoryEntry(`v${i}`);
    }
    const { history } = state.getState();
    expect(history.length).toBeLessThanOrEqual(15);
    expect(history[0].value).toBe("v19");
  });
});
