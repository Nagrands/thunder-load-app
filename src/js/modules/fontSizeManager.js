// src/js/modules/fontSizeManager.js

const FONT_SIZE_KEY = "fontSize";

async function setFontSize(size) {
  // Гарантируем обновление localStorage до любых других действий
  localStorage.setItem("fontSize", size);
  await window.electron.invoke("set-font-size", size);
  document.documentElement.style.setProperty("--font-size", `${size}px`);
  document.body.style.setProperty("--font-size", `${size}px`);
}

export async function toggleFontSize() {
  // Читаем текущий размер шрифта или используем значение по умолчанию, например, "16"
  const currentFontSize = localStorage.getItem("fontSize") || "16";
  // Переключаем между, скажем, "18" и "16"
  const newFontSize = currentFontSize === "18" ? "16" : "18";

  // Применяем новый размер шрифта к html и body через custom property
  document.documentElement.style.setProperty("--font-size", `${newFontSize}px`);
  document.body.style.setProperty("--font-size", `${newFontSize}px`);
  // Сохраняем новое значение в localStorage
  localStorage.setItem("fontSize", newFontSize);

  return newFontSize;
}

async function initializeFontSize() {
  const savedSize = await getFontSize();
  document.documentElement.style.setProperty("--font-size", `${savedSize}px`);
  document.body.style.setProperty("--font-size", `${savedSize}px`);
}

export async function getFontSize() {
  // Возвращаем сохраненный размер шрифта или значение по умолчанию
  return localStorage.getItem("fontSize") || "16";
}

export { setFontSize, initializeFontSize };
