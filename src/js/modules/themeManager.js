// src/js/modules/themeManager.js

const THEME_KEY = "theme";
const THEME_CYCLE = ["dark", "midnight", "sunset"];

/**
 * Устанавливает тему вручную или переключает, если параметр не передан
 */
function toggleTheme(theme) {
  if (theme === "system") {
    localStorage.removeItem(THEME_KEY);
    document.documentElement.removeAttribute("data-theme");
    return "system";
  }

  const newTheme =
    theme ||
    (() => {
      const current = localStorage.getItem(THEME_KEY) || THEME_CYCLE[0];
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
  return localStorage.getItem(THEME_KEY) || "system";
}

/**
 * Инициализирует тему при загрузке
 */
function initializeTheme() {
  const savedTheme = getTheme();
  if (savedTheme === "system") {
    document.documentElement.removeAttribute("data-theme");
  } else {
    document.documentElement.setAttribute("data-theme", savedTheme);
  }
}

export { toggleTheme, getTheme, initializeTheme };
