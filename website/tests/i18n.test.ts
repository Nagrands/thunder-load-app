import { describe, expect, it } from "vitest";
import { alternateLocale, contentSlug, localeFromId } from "@/i18n";

describe("localization helpers", () => {
  it("maps content identifiers and alternate locales", () => {
    expect(contentSlug("ru/installation.mdx")).toBe("installation");
    expect(localeFromId("en/player")).toBe("en");
    expect(alternateLocale("ru")).toBe("en");
  });
});
