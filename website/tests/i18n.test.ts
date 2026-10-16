import { describe, expect, it } from "vitest";
import { alternateLocale, contentSlug, localeFromId, useTranslations } from "@/i18n";

describe("localization helpers", () => {
  it("maps content identifiers and alternate locales", () => {
    expect(contentSlug("ru/installation.mdx")).toBe("installation");
    expect(localeFromId("en/player")).toBe("en");
    expect(alternateLocale("ru")).toBe("en");
    expect(alternateLocale("en")).toBe("ru");
  });

  it("derives the locale from a content id", () => {
    expect(localeFromId("en/blog/post")).toBe("en");
    expect(localeFromId("ru/docs/install")).toBe("ru");
    expect(localeFromId("standalone")).toBe("ru");
  });

  it("keeps nested slugs and strips the file extension", () => {
    expect(contentSlug("en/blog/post.mdx")).toBe("blog/post");
    expect(contentSlug("ru/docs/install.md")).toBe("docs/install");
  });

  it("exposes a dictionary for both locales", () => {
    expect(useTranslations("ru").nav.docs).toBe("Документация");
    expect(useTranslations("en").nav.docs).toBe("Documentation");
    expect(useTranslations("en").skip).toBe("Skip to content");
  });
});
