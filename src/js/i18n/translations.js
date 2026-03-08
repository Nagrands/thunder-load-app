import { backupTranslations } from "./translations/backup.js";
import { coreTranslations } from "./translations/core.js";
import { downloaderTranslations } from "./translations/downloader.js";
import { historyTranslations } from "./translations/history.js";
import { settingsTranslations } from "./translations/settings.js";
import { toolsTranslations } from "./translations/tools.js";
import { updatesTranslations } from "./translations/updates.js";

const translationSections = [
  coreTranslations,
  downloaderTranslations,
  historyTranslations,
  settingsTranslations,
  toolsTranslations,
  backupTranslations,
  updatesTranslations,
];

const mergeLanguageSections = (lang) =>
  translationSections.reduce((acc, section) => {
    Object.assign(acc, section[lang] || {});
    return acc;
  }, {});

export const translations = {
  ru: mergeLanguageSections("ru"),
  en: mergeLanguageSections("en"),
};
