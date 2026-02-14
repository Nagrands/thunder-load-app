import {
  clampAutoInterval,
  clampAutoStopCount,
  getAutoStopReason,
  normalizeStopMode,
  sanitizeStopMatch,
} from "../autoRollController.js";

describe("randomizer autoRollController", () => {
  const t = (key, vars = {}) => `${key}:${JSON.stringify(vars)}`;

  test("normalizes stop mode", () => {
    expect(normalizeStopMode("count")).toBe("count");
    expect(normalizeStopMode("invalid")).toBe("none");
  });

  test("sanitizes match text", () => {
    expect(sanitizeStopMatch("  abc  ")).toBe("abc");
    expect(sanitizeStopMatch("x".repeat(140)).length).toBe(120);
  });

  test("clamps interval and count", () => {
    expect(clampAutoInterval(0)).toBe(1);
    expect(clampAutoInterval(99999)).toBe(3600);
    expect(clampAutoStopCount(0)).toBe(1);
    expect(clampAutoStopCount(100000)).toBe(9999);
  });

  test("returns count-based stop reason", () => {
    const reason = getAutoStopReason({
      autoRuns: 3,
      itemsCount: 4,
      poolSize: 2,
      result: { value: "A" },
      settings: {
        autoStopMode: "count",
        autoStopCount: 3,
        autoStopMatch: "",
        autoStopOnPoolDepletion: false,
        noRepeat: false,
      },
      t,
    });
    expect(reason).toContain("randomizer.auto.stopReason.count");
  });

  test("returns match-based stop reason", () => {
    const reason = getAutoStopReason({
      autoRuns: 1,
      itemsCount: 2,
      poolSize: 2,
      result: { value: "stream night" },
      settings: {
        autoStopMode: "match",
        autoStopCount: 99,
        autoStopMatch: "stream",
        autoStopOnPoolDepletion: false,
        noRepeat: false,
      },
      t,
    });
    expect(reason).toContain("randomizer.auto.stopReason.match");
  });

  test("returns pool depletion stop reason only in no-repeat mode", () => {
    const reason = getAutoStopReason({
      autoRuns: 1,
      itemsCount: 2,
      poolSize: 0,
      result: { value: "A" },
      settings: {
        autoStopMode: "none",
        autoStopCount: 99,
        autoStopMatch: "",
        autoStopOnPoolDepletion: true,
        noRepeat: true,
      },
      t,
    });
    expect(reason).toContain("randomizer.auto.stopReason.poolEmpty");
  });
});
