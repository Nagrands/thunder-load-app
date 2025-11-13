// src/js/modules/settingsStore.js

import { getTheme as tmGetTheme } from "./themeManager.js";
import { setFontSize as fsSetFontSize, getFontSize as fsGetFontSize } from "./fontSizeManager.js";

// Lightweight event bus for settings updates
const bus = new EventTarget();

/**
 * Subscribe to settings changes
 * @param {"theme"|"fontSize"} type
 * @param {(e: CustomEvent) => void} handler
 */
export function onChange(type, handler) {
  bus.addEventListener(type, handler);
}

function emit(type, detail) {
  bus.dispatchEvent(new CustomEvent(type, { detail }));
}

// THEME
export async function setTheme(theme) {
  try {
    if (theme === "system") {
      localStorage.removeItem("theme");
      document.documentElement.removeAttribute("data-theme");
    } else {
      localStorage.setItem("theme", theme);
      document.documentElement.setAttribute("data-theme", theme);
    }
    try {
      await window.electron?.invoke?.("set-theme", theme);
    } catch {}
    emit("theme", { value: theme });
    return theme;
  } catch (e) {
    console.error("settingsStore.setTheme error", e);
    throw e;
  }
}

export function getTheme() {
  return tmGetTheme();
}

// FONT SIZE
export async function setFontSize(pxString) {
  await fsSetFontSize(pxString);
  emit("fontSize", { value: pxString });
  return pxString;
}

export function getFontSize() {
  return fsGetFontSize();
}

// Convenience toggle between 16 and 18 like previous UI
export async function toggleFontSize() {
  const current = (await getFontSize()) || "16";
  const next = current === "18" ? "16" : "18";
  return setFontSize(next);
}

