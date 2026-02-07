// src/js/modules/topBarThemeToggle.js

import { setTheme } from "./settingsStore.js";
import { updateThemeDropdownUI } from "./settingsModal.js";

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

function initTopBarThemeToggle() {
  const btn = document.getElementById("theme-toggle");
  if (!btn) return;

  btn.addEventListener("click", async () => {
    const current = readCurrentTheme();
    const next = getNextTheme(current);
    document.documentElement.classList.add("theme-transition");
    try {
      await setTheme(next);
      updateThemeDropdownUI(next);
    } catch (e) {
      console.error("Theme toggle failed:", e);
    } finally {
      setTimeout(
        () => document.documentElement.classList.remove("theme-transition"),
        260,
      );
    }
  });
}

export { initTopBarThemeToggle };
