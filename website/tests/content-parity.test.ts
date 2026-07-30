import { readdirSync } from "node:fs";
import { describe, expect, it } from "vitest";

function names(folder: string) {
  return readdirSync(new URL(folder, import.meta.url)).filter((name) => name.endsWith(".mdx")).sort();
}

describe("localized content", () => {
  it("keeps documentation routes in RU/EN parity", () => {
    expect(names("../src/content/docs/ru/")).toEqual(names("../src/content/docs/en/"));
  });

  it("keeps blog routes in RU/EN parity", () => {
    expect(names("../src/content/blog/ru/")).toEqual(names("../src/content/blog/en/"));
  });
});
