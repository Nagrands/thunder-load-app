// src/js/modules/themeManager.js

const THEME_KEY = "theme";
const THEME_CYCLE = ["dark", "midnight", "emerald", "sunset", "violet"];
const FALLBACK_THEME = THEME_CYCLE[0];

function normalizeTheme(theme) {
  return THEME_CYCLE.includes(theme) ? theme : FALLBACK_THEME;
}

/**
 * Устанавливает тему вручную или переключает, если параметр не передан
 */
function toggleTheme(theme) {
  const newTheme =
    normalizeTheme(theme) ||
    (() => {
      const current = normalizeTheme(localStorage.getItem(THEME_KEY));
      const index = THEME_CYCLE.indexOf(current);
      const nextIndex = index === -1 ? 0 : (index + 1) % THEME_CYCLE.length;
      return THEME_CYCLE[nextIndex];
    })();
  document.documentElement.setAttribute("data-theme", newTheme);
  localStorage.setItem(THEME_KEY, newTheme);
  return newTheme;
}

/**
 * Получает сохранённую тему
 */
function getTheme() {
  const theme = normalizeTheme(localStorage.getItem(THEME_KEY));
  localStorage.setItem(THEME_KEY, theme);
  return theme;
}

/**
 * Инициализирует тему при загрузке
 */
function initializeTheme() {
  const savedTheme = getTheme();
  document.documentElement.setAttribute("data-theme", savedTheme);
}

export { toggleTheme, getTheme, initializeTheme };
