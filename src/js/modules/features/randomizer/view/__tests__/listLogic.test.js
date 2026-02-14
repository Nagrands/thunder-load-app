import {
  applySearchFilter,
  buildCountLabel,
  normalizeSortMode,
  sortByMode,
} from "../listLogic.js";

describe("randomizer listLogic", () => {
  const clampWeight = (v) => Number(v) || 0;
  const clampMisses = (v) => Number(v) || 0;

  test("normalizeSortMode returns known values only", () => {
    expect(normalizeSortMode("alpha")).toBe("alpha");
    expect(normalizeSortMode("rare")).toBe("rare");
    expect(normalizeSortMode("unexpected")).toBe("order");
  });

  test("applySearchFilter is case-insensitive", () => {
    const list = [{ value: "Hello" }, { value: "world" }];
    expect(applySearchFilter(list, "HEL")).toEqual([{ value: "Hello" }]);
  });

  test("sortByMode sorts by weight", () => {
    const list = [
      { value: "A", weight: 1 },
      { value: "B", weight: 3 },
    ];
    const sorted = sortByMode(list, "weight", { clampMisses, clampWeight });
    expect(sorted.map((i) => i.value)).toEqual(["B", "A"]);
  });

  test("sortByMode sorts by rare misses", () => {
    const list = [
      { value: "A", misses: 2 },
      { value: "B", misses: 9 },
    ];
    const sorted = sortByMode(list, "rare", { clampMisses, clampWeight });
    expect(sorted.map((i) => i.value)).toEqual(["B", "A"]);
  });

  test("buildCountLabel supports favorites and search suffix", () => {
    const t = (key, vars = {}) => {
      if (key === "randomizer.count.en") return `${vars.count} items`;
      if (key === "randomizer.count.of") return ` of ${vars.count}`;
      if (key === "randomizer.count.empty") return "empty";
      if (key === "randomizer.count.emptyFavorites") return "empty favorites";
      return key;
    };

    const label = buildCountLabel({
      baseCount: 5,
      declOfNum: () => "",
      favoritesOnly: false,
      isEn: true,
      searchActive: true,
      t,
      totalCount: 7,
      visibleCount: 2,
    });

    expect(label).toBe("2 items of 5");
  });
});
