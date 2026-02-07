// src/js/modules/topBarThemeToggle.js

import { setTheme } from "./settingsStore.js";
import { updateThemeDropdownUI } from "./settingsModal.js";
import { t } from "./i18n.js";
import { initTooltips } from "./tooltipInitializer.js";

const THEME_ORDER = ["system", "dark", "midnight", "sunset", "violet"];

function readCurrentTheme() {
  const attr = document.documentElement.getAttribute("data-theme");
  return attr || localStorage.getItem("theme") || "system";
}

function getNextTheme(cur) {
  const idx = THEME_ORDER.indexOf(cur);
  const nextIndex = idx === -1 ? 0 : (idx + 1) % THEME_ORDER.length;
  return THEME_ORDER[nextIndex];
}

function getThemeLabel(theme) {
  const map = {
    system: t("settings.appearance.theme.system"),
    dark: t("settings.appearance.theme.dark"),
    midnight: t("settings.appearance.theme.midnight"),
    sunset: t("settings.appearance.theme.sunset"),
    violet: t("settings.appearance.theme.violet"),
  };
  return map[theme] || theme;
}

function updateThemeToggleTooltip(theme) {
  const btn = document.getElementById("theme-toggle");
  if (!btn) return;
  const label = getThemeLabel(theme);
  const title = `${t("topbar.theme")}: ${label}`;
  btn.setAttribute("title", title);
  btn.setAttribute("data-bs-original-title", title);
  initTooltips();
}

function initTopBarThemeToggle() {
  const btn = document.getElementById("theme-toggle");
  if (!btn) return;

  updateThemeToggleTooltip(readCurrentTheme());

  btn.addEventListener("click", async () => {
    const current = readCurrentTheme();
    const next = getNextTheme(current);
    document.documentElement.classList.add("theme-transition");
    try {
      await setTheme(next);
      updateThemeDropdownUI(next);
      updateThemeToggleTooltip(next);
    } catch (e) {
      console.error("Theme toggle failed:", e);
    } finally {
      setTimeout(
        () => document.documentElement.classList.remove("theme-transition"),
        260,
      );
    }
  });

  window.addEventListener("i18n:changed", () =>
    updateThemeToggleTooltip(readCurrentTheme()),
  );
}

export { initTopBarThemeToggle };
