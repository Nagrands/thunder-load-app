import type { Locale } from "@/config/site";

export const locales: Locale[] = ["ru", "en"];
export const defaultLocale: Locale = "ru";

const translations = {
  ru: {
    localeName: "Русский",
    skip: "Перейти к содержимому",
    nav: {
      features: "Возможности",
      download: "Скачать",
      releases: "Что нового",
      docs: "Документация",
      blog: "Блог"
    },
    common: {
      github: "GitHub",
      learnMore: "Подробнее",
      allReleases: "Все версии",
      allDocs: "Вся документация",
      read: "Читать",
      latest: "Последняя версия",
      published: "Опубликовано",
      size: "Размер",
      checksum: "SHA-256",
      planned: "Планируется",
      supported: "Поддерживается",
      requirements: "Требования",
      architectures: "Архитектуры",
      noAssets: "Для этой версии нет подходящих установочных файлов."
    },
    footer: {
      product: "Продукт",
      resources: "Ресурсы",
      privacy: "Конфиденциальность",
      note: "Создан для быстрой и удобной работы с медиа."
    }
  },
  en: {
    localeName: "English",
    skip: "Skip to content",
    nav: {
      features: "Features",
      download: "Download",
      releases: "What’s new",
      docs: "Documentation",
      blog: "Blog"
    },
    common: {
      github: "GitHub",
      learnMore: "Learn more",
      allReleases: "All releases",
      allDocs: "All documentation",
      read: "Read",
      latest: "Latest version",
      published: "Published",
      size: "Size",
      checksum: "SHA-256",
      planned: "Planned",
      supported: "Supported",
      requirements: "Requirements",
      architectures: "Architectures",
      noAssets: "No suitable installers are available for this release."
    },
    footer: {
      product: "Product",
      resources: "Resources",
      privacy: "Privacy",
      note: "Built for fast, effortless media workflows."
    }
  }
} as const;

export function useTranslations(locale: Locale) {
  return translations[locale];
}

export function localizedPath(locale: Locale, path = "") {
  const normalized = path.replace(/^\/+|\/+$/g, "");
  return `/${locale}/${normalized}${normalized ? "/" : ""}`;
}

export function alternateLocale(locale: Locale): Locale {
  return locale === "ru" ? "en" : "ru";
}

export function localeFromId(id: string): Locale {
  return id.startsWith("en/") ? "en" : "ru";
}

export function contentSlug(id: string) {
  return id.replace(/^(ru|en)\//, "").replace(/\.(md|mdx)$/, "");
}
