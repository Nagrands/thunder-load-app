import { describe, expect, it } from "vitest";
import { evaluateLighthouseBudgets } from "../scripts/lighthouse-budget-policy.mjs";

const perfectScores = {
  performance: 1,
  accessibility: 1,
  bestPractices: 1,
  seo: 1
};

describe("Lighthouse budget policy", () => {
  it("reports runner-sensitive measurements as warnings", () => {
    const result = evaluateLighthouseBudgets({
      url: "https://example.test/",
      scores: { ...perfectScores, performance: 0.89 },
      lcp: 2733,
      cls: 0
    });

    expect(result.failures).toEqual([]);
    expect(result.warnings).toEqual([
      "https://example.test/: performance 89 < 90",
      "https://example.test/: LCP 2733ms > 2500ms"
    ]);
  });

  it("fails genuinely poor scores and Core Web Vitals", () => {
    const result = evaluateLighthouseBudgets({
      url: "https://example.test/",
      scores: { ...perfectScores, performance: 0.74, accessibility: 0.94 },
      lcp: 4001,
      cls: 0.251
    });

    expect(result.warnings).toEqual([]);
    expect(result.failures).toEqual([
      "https://example.test/: performance 74 < 75",
      "https://example.test/: accessibility 94 < 95",
      "https://example.test/: LCP 4001ms > 4000ms",
      "https://example.test/: CLS 0.251 > 0.25"
    ]);
  });

  it("accepts measurements within the good range", () => {
    expect(
      evaluateLighthouseBudgets({
        url: "https://example.test/",
        scores: perfectScores,
        lcp: 2400,
        cls: 0.05
      })
    ).toEqual({ failures: [], warnings: [] });
  });
});
