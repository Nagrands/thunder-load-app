import { getLanguage, setLanguage, t } from "../../i18n.js";

const LANGUAGE_DROPDOWN_BOUND_KEY = "settingsLanguageDropdownBound";
const LANGUAGE_DROPDOWN_STATE_KEY =
  "__thunder_settings_language_dropdown_state__";

function formatLanguageLabel(lang) {
  const map = {
    ru: t("language.ru"),
    en: t("language.en"),
  };
  return map[lang] || lang;
}

function syncLanguageDropdownState(languageDropdownMenu, languageLabel, lang) {
  languageLabel.textContent = formatLanguageLabel(lang);
  languageDropdownMenu.querySelectorAll("li").forEach((item) => {
    item.classList.toggle("active", item.getAttribute("data-value") === lang);
  });
}

function getLanguageDropdownState() {
  const state = window[LANGUAGE_DROPDOWN_STATE_KEY];
  if (state) return state;
  const next = { bound: false, sync: null };
  window[LANGUAGE_DROPDOWN_STATE_KEY] = next;
  return next;
}

export function initLanguageDropdown() {
  const languageDropdownBtn = document.getElementById("language-dropdown-btn");
  const languageDropdownMenu = document.getElementById(
    "language-dropdown-menu",
  );
  const languageLabel = document.getElementById("language-selected-label");

  if (!languageDropdownBtn || !languageDropdownMenu || !languageLabel) return;

  const currentLang = getLanguage();
  const state = getLanguageDropdownState();
  state.sync = (lang) => {
    syncLanguageDropdownState(languageDropdownMenu, languageLabel, lang);
  };
  state.sync(currentLang);

  if (languageDropdownBtn.dataset[LANGUAGE_DROPDOWN_BOUND_KEY] === "1") {
    return;
  }
  languageDropdownBtn.dataset[LANGUAGE_DROPDOWN_BOUND_KEY] = "1";

  languageDropdownBtn.addEventListener("click", (event) => {
    event.preventDefault();
    event.stopPropagation();
    const isOpen = languageDropdownMenu.classList.contains("show");
    document
      .querySelectorAll(".dropdown-menu")
      .forEach((menu) => menu.classList.remove("show"));
    if (!isOpen) {
      languageDropdownMenu.classList.add("show");
    }
  });

  languageDropdownMenu.querySelectorAll("li").forEach((item) => {
    item.addEventListener("click", () => {
      const nextLang = item.getAttribute("data-value");
      setLanguage(nextLang);
      state.sync?.(nextLang);
      languageDropdownMenu.classList.remove("show");
    });
  });

  if (!state.bound) {
    state.bound = true;
    window.addEventListener("i18n:changed", (event) => {
      const next = event?.detail?.lang || getLanguage();
      state.sync?.(next);
    });
  }
}
