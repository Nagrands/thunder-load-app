import { describe, expect, it } from "vitest";
import { alternateLocale, contentSlug, localizedPath, localeFromId } from "@/i18n";

describe("localization helpers", () => {
  it("creates stable localized paths", () => {
    expect(localizedPath("ru", "docs/install")).toBe("/ru/docs/install/");
    expect(localizedPath("en")).toBe("/en/");
  });

  it("maps content identifiers and alternate locales", () => {
    expect(contentSlug("ru/installation.mdx")).toBe("installation");
    expect(localeFromId("en/player")).toBe("en");
    expect(alternateLocale("ru")).toBe("en");
  });
});
