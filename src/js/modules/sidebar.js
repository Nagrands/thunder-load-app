// src/js/modules/sidebar.js

import { sidebar, overlay, toggleBtn, settingsModal } from "./domElements.js";

/**
 * Функция для переключения бокового меню
 */
function toggleSidebar() {
  if (sidebar.classList.contains("active")) {
    sidebar.classList.remove("active");
    overlay.classList.remove("active");
    toggleBtn.classList.remove("hidden");
  } else {
    sidebar.classList.add("active");
    overlay.classList.add("active");
    toggleBtn.classList.add("hidden");
  }
}

/**
 * Функция для скрытия бокового меню
 */
function hideSidebar() {
  if (sidebar.classList.contains("active")) {
    sidebar.classList.remove("active");
    overlay.classList.remove("active");
    toggleBtn.classList.remove("hidden");
  }
}

/**
 * Функция для открытия настроек
 */
function openSettings() {
  settingsModal.style.display = "flex";
  settingsModal.style.justifyContent = "center";
  settingsModal.style.alignItems = "center";
  // overlay.classList.add("active");
  hideSidebar();
}

/**
 * Функция для закрытия настроек
 */
function closeSettings() {
  settingsModal.style.display = "none";
  overlay.classList.remove("active");
}

document.getElementById("open-github")?.addEventListener("click", () => {
  const url = "https://github.com/Nagrands/thunder-load-app/releases";
  window.electron.invoke("open-external-link", url);
});

export { toggleSidebar, hideSidebar, openSettings, closeSettings };
