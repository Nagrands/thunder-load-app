import { translations } from "../i18n/translations.js";

const STORAGE_KEY = "uiLanguage";
const DEFAULT_LANG = "ru";

function resolveLang(value) {
  return value === "en" ? "en" : "ru";
}

let currentLang = resolveLang(
  typeof localStorage !== "undefined"
    ? localStorage.getItem(STORAGE_KEY)
    : DEFAULT_LANG,
);

export function getLanguage() {
  return currentLang;
}

export function t(key, vars = {}) {
  const dict = translations[currentLang] || translations[DEFAULT_LANG] || {};
  const fallback = translations[DEFAULT_LANG] || {};
  let text = dict[key] ?? fallback[key] ?? key;
  Object.entries(vars).forEach(([k, v]) => {
    text = text.replace(new RegExp(`\\{${k}\\}`, "g"), String(v));
  });
  return text;
}

export function applyI18n(root = document) {
  if (!root) return;

  const setAttr = (el, attr, value) => {
    if (typeof value !== "string") return;
    el.setAttribute(attr, value);
  };

  root.querySelectorAll("[data-i18n]").forEach((el) => {
    const key = el.getAttribute("data-i18n");
    if (key) el.textContent = t(key);
  });

  root.querySelectorAll("[data-i18n-html]").forEach((el) => {
    const key = el.getAttribute("data-i18n-html");
    if (key) el.innerHTML = t(key);
  });

  root.querySelectorAll("[data-i18n-placeholder]").forEach((el) => {
    const key = el.getAttribute("data-i18n-placeholder");
    if (key) setAttr(el, "placeholder", t(key));
  });

  root.querySelectorAll("[data-i18n-title]").forEach((el) => {
    const key = el.getAttribute("data-i18n-title");
    if (key) setAttr(el, "title", t(key));
  });

  root.querySelectorAll("[data-i18n-hint]").forEach((el) => {
    const key = el.getAttribute("data-i18n-hint");
    if (key) setAttr(el, "data-hint", t(key));
  });

  root.querySelectorAll("[data-i18n-aria]").forEach((el) => {
    const key = el.getAttribute("data-i18n-aria");
    if (key) setAttr(el, "aria-label", t(key));
  });

  root.querySelectorAll("[data-i18n-alt]").forEach((el) => {
    const key = el.getAttribute("data-i18n-alt");
    if (key) setAttr(el, "alt", t(key));
  });

  root.querySelectorAll("[data-i18n-value]").forEach((el) => {
    const key = el.getAttribute("data-i18n-value");
    if (key && "value" in el) el.value = t(key);
  });
}

export function setLanguage(lang) {
  const next = resolveLang(lang);
  if (next === currentLang) return;
  currentLang = next;
  try {
    localStorage.setItem(STORAGE_KEY, currentLang);
  } catch {}
  if (document?.documentElement) {
    document.documentElement.lang = currentLang;
  }
  applyI18n(document);
  window.dispatchEvent(
    new CustomEvent("i18n:changed", { detail: { lang: currentLang } }),
  );
  // Force full UI refresh for components that render strings at build-time.
  if (typeof window !== "undefined") {
    if (!window.__i18nReloading) {
      window.__i18nReloading = true;
      setTimeout(() => {
        try {
          window.location.reload();
        } catch {}
      }, 0);
    }
  }
}

export function setLanguagePreview(lang) {
  const next = resolveLang(lang);
  if (next === currentLang) return;
  currentLang = next;
  try {
    localStorage.setItem(STORAGE_KEY, currentLang);
  } catch {}
  if (document?.documentElement) {
    document.documentElement.lang = currentLang;
  }
  applyI18n(document);
  window.dispatchEvent(
    new CustomEvent("i18n:changed", { detail: { lang: currentLang } }),
  );
}

export function initI18n() {
  if (document?.documentElement) {
    document.documentElement.lang = currentLang;
  }
  applyI18n(document);
  return currentLang;
}
