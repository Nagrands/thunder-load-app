// src/js/modules/settingsModal.js

import { toggleFontSize, getFontSize } from "./settingsStore.js";
import {
  exportConfig,
  importConfig,
  getDefaultTab,
  setDefaultTab,
} from "./settings.js";

export function updateThemeDropdownUI(theme) {
  const label = document.getElementById("theme-selected-label");
  const menu = document.getElementById("theme-dropdown-menu");
  const btn = document.getElementById("theme-dropdown-btn");
  const item = menu?.querySelector(`[data-value="${theme}"]`);

  if (label && item) {
    label.textContent = item.textContent;
    menu.querySelectorAll("li").forEach((li) => li.classList.remove("active"));
    item.classList.add("active");
    if (btn) btn.setAttribute("data-current-theme", theme);
  }
}

export function initSettingsModal() {
  const tabLinks = document.querySelectorAll(".tab-link");
  const exportBtn = document.getElementById("export-config-button");
  const importBtn = document.getElementById("import-config-button");
  const importInput = document.getElementById("import-config-input");
  const fontSizeToggle = document.getElementById("settings-font-size-toggle");
  const resetBtn = document.getElementById("reset-config-button");

  const initDefaultTabSetting = async () => {
    const radios = document.querySelectorAll('input[name="defaultTab"]');
    const currentDefaultTab = await getDefaultTab();
    radios.forEach((radio) => {
      radio.checked = radio.value === currentDefaultTab;
      radio.addEventListener("change", (e) => setDefaultTab(e.target.value));
    });
  };

  // Обработчики табов в модалке
  if (tabLinks.length) {
    tabLinks.forEach((button) => {
      button.addEventListener("click", () => {
        // Удаляем активный класс со всех вкладок
        tabLinks.forEach((btn) => btn.classList.remove("active"));
        button.classList.add("active");

        // Скрываем все табы
        const tabPanes = document.querySelectorAll(".tab-pane");
        tabPanes.forEach((pane) => pane.classList.remove("active"));

        // Показываем выбранный таб
        const tabId = button.getAttribute("data-tab");
        const activePane = document.getElementById(tabId);
        if (activePane) activePane.classList.add("active");

        // Сохраняем выбранную вкладку
        localStorage.setItem("lastSettingsTab", tabId);
      });
    });

    // Восстанавливаем вкладку при открытии
    const savedTab = localStorage.getItem("lastSettingsTab");
    if (savedTab) {
      const buttonToActivate = document.querySelector(
        `.tab-link[data-tab="${savedTab}"]`,
      );
      if (buttonToActivate) buttonToActivate.click();
    }
  }

  if (exportBtn) exportBtn.addEventListener("click", exportConfig);

  if (importBtn && importInput) {
    importBtn.addEventListener("click", () => importInput.click());
    importInput.addEventListener("change", async (event) => {
      const file = event.target.files[0];
      if (file) await importConfig(file);
    });
  }

  if (fontSizeToggle) {
    fontSizeToggle.addEventListener("change", async () => {
      const newSize = await toggleFontSize();
      fontSizeToggle.checked = newSize === "18px";
      const mainFontSizeToggle = document.getElementById("font-size-toggle");
      if (mainFontSizeToggle) mainFontSizeToggle.checked = newSize === "18px";
    });

    (async () => {
      const currentFontSize = await getFontSize();
      fontSizeToggle.checked = String(currentFontSize) === "18" || String(currentFontSize) === "18px";
    })();
  }

  if (resetBtn) {
    resetBtn.addEventListener("click", async () => {
      if (!confirm("Вы уверены, что хотите сбросить все настройки?")) return;

      try {
        localStorage.removeItem("theme");
        localStorage.removeItem("fontSize");

        await Promise.all([
          window.electron.invoke("toggle-auto-launch", false),
          window.electron.invoke("set-minimize-on-launch-status", false),
          window.electron.invoke("set-minimize-to-tray-status", false),
          window.electron.invoke("set-close-notification-status", true),
          window.electron.invoke("set-disable-global-shortcuts-status", false),
          window.electron.invoke("set-open-on-copy-url-status", false),
          window.electron.invoke("set-open-on-download-complete-status", false),
          window.electron.invoke("set-minimize-instead-of-close", false),
          setDefaultTab("download"),
        ]);

        location.reload();
      } catch (error) {
        console.error("Ошибка при сбросе настроек:", error);
        alert(
          "Не удалось сбросить настройки. Проверьте консоль для подробностей.",
        );
      }
    });
  }

  initDefaultTabSetting();

  // --- Логика выбора темы удалена, чтобы избежать конфликта с settings.js ---
  // (См. settings.js для реализации кастомного dropdown выбора темы)
}
