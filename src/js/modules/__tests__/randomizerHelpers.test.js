import {
  clampHits,
  clampWeight,
  declOfNum,
  normalizeItems,
  normalizePresets,
  DEFAULT_ITEMS,
  MAX_ITEM_LENGTH,
} from "../randomizer/helpers.js";

describe("randomizer helpers", () => {
  test("clampWeight keeps within bounds and rounds", () => {
    expect(clampWeight("5.6")).toBe(6);
    expect(clampWeight(0)).toBe(1);
    expect(clampWeight(999)).toBe(10);
    expect(clampWeight("foo")).toBe(1);
  });

  test("clampHits floors and guards negatives", () => {
    expect(clampHits(3.9)).toBe(3);
    expect(clampHits(-2)).toBe(0);
    expect(clampHits("foo")).toBe(0);
  });

  test("normalizeItems removes duplicates, trims, and applies defaults", () => {
    const normalized = normalizeItems(
      [
        { value: " A ", weight: 2 },
        { value: "a", weight: 5 },
        "B",
        { value: "" },
      ],
      { allowEmpty: true },
    );
    expect(normalized).toEqual([
      {
        value: "A",
        weight: 2,
        hits: 0,
        misses: 0,
        favorite: false,
        excluded: false,
      },
      {
        value: "B",
        weight: 1,
        hits: 0,
        misses: 0,
        favorite: false,
        excluded: false,
      },
    ]);
  });

  test("normalizeItems falls back to defaults if empty and not allowed", () => {
    const normalized = normalizeItems([], { allowEmpty: false });
    expect(normalized.length).toBe(DEFAULT_ITEMS.length);
  });

  test("normalizePresets filters invalid and deduplicates names", () => {
    const presets = normalizePresets(
      [
        { name: "One", items: [{ value: "A" }] },
        { name: "one", items: [{ value: "B" }] },
        { name: " Two ", items: [{ value: "C" }] },
        { name: "" },
      ],
      { allowEmptyItems: true },
    );
    expect(presets).toEqual([
      {
        name: "One",
        items: [
          {
            value: "A",
            weight: 1,
            hits: 0,
            misses: 0,
            favorite: false,
            excluded: false,
          },
        ],
      },
      {
        name: "Two",
        items: [
          {
            value: "C",
            weight: 1,
            hits: 0,
            misses: 0,
            favorite: false,
            excluded: false,
          },
        ],
      },
    ]);
  });

  test("declOfNum picks correct russian endings", () => {
    expect(declOfNum(1, ["вариант", "варианта", "вариантов"])).toBe("вариант");
    expect(declOfNum(2, ["вариант", "варианта", "вариантов"])).toBe("варианта");
    expect(declOfNum(5, ["вариант", "варианта", "вариантов"])).toBe(
      "вариантов",
    );
  });

  test("MAX_ITEM_LENGTH matches constraint", () => {
    expect(MAX_ITEM_LENGTH).toBeGreaterThan(0);
  });
});
