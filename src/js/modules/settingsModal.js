// src/js/modules/settingsModal.js

import { toggleFontSize, getFontSize } from "./settingsStore.js";
import {
  exportConfig,
  importConfig,
  getDefaultTab,
  setDefaultTab,
  resetConfigToDefaults,
} from "./settings.js";
import { settingsModal, settingsButton } from "./domElements.js";
import { t } from "./i18n.js";
import { initFirstRunModal } from "./firstRunModal.js";

let previousFocus = null;
let trapHandler = null;

function isDownloadQualityModalOpen() {
  return !!document
    .getElementById("download-quality-modal")
    ?.classList.contains("is-open");
}

function syncModalScrollLock() {
  const shouldLock =
    settingsModal?.style.display === "flex" || isDownloadQualityModalOpen();
  document.body.classList.toggle("modal-scroll-lock", shouldLock);
}

function getSettingsTabsWrapper() {
  return document.getElementById("settings-tabs-panel");
}

function getSettingsSectionsToggle() {
  return document.getElementById("settings-sections-toggle");
}

function closeSettingsSectionsPanel() {
  const wrapper = getSettingsTabsWrapper();
  const toggle = getSettingsSectionsToggle();
  if (wrapper) {
    wrapper.classList.remove("settings-tabs--open");
    wrapper.dataset.open = "false";
  }
  if (toggle) {
    toggle.setAttribute("aria-expanded", "false");
  }
}

function openSettingsSectionsPanel() {
  const wrapper = getSettingsTabsWrapper();
  const toggle = getSettingsSectionsToggle();
  if (wrapper) {
    wrapper.classList.add("settings-tabs--open");
    wrapper.dataset.open = "true";
  }
  if (toggle) {
    toggle.setAttribute("aria-expanded", "true");
  }
}

function syncActiveSettingsSectionLabel() {
  const label = document.getElementById("settings-active-section-label");
  if (!label) return;
  const activeBtn = settingsModal?.querySelector(".tab-link.active");
  const directTextSpan = activeBtn
    ? Array.from(activeBtn.children).find(
        (el) => el.tagName === "SPAN" && !el.classList.contains("tab-badge"),
      )
    : null;
  const text = directTextSpan?.textContent || activeBtn?.textContent || "";
  label.textContent = String(text).trim();
}

function getTabbables(root) {
  if (!root) return [];
  const selector = [
    "a[href]",
    "button:not([disabled])",
    "input:not([disabled])",
    "select:not([disabled])",
    "textarea:not([disabled])",
    '[tabindex]:not([tabindex="-1"])',
  ].join(",");
  return Array.from(root.querySelectorAll(selector)).filter(
    (el) => el.offsetParent !== null,
  );
}

export function openSettings() {
  if (!settingsModal) return;
  settingsModal.style.display = "flex";
  settingsModal.style.justifyContent = "center";
  settingsModal.style.alignItems = "flex-start";
  settingsModal.setAttribute("aria-hidden", "false");
  previousFocus = document.activeElement;
  syncModalScrollLock();

  try {
    window.dispatchEvent(new Event("settings:opened"));
  } catch {}
  syncActiveSettingsSectionLabel();
  closeSettingsSectionsPanel();

  const tabbables = getTabbables(settingsModal);
  if (tabbables.length) {
    const activeTab = settingsModal.querySelector(".tab-link.active");
    (activeTab || tabbables[0]).focus();
  } else {
    settingsModal.focus?.();
  }

  trapHandler = (event) => {
    if (event.key !== "Tab") return;
    const nodes = getTabbables(settingsModal);
    if (!nodes.length) return;
    const first = nodes[0];
    const last = nodes[nodes.length - 1];
    if (event.shiftKey) {
      if (document.activeElement === first) {
        event.preventDefault();
        last.focus();
      }
    } else if (document.activeElement === last) {
      event.preventDefault();
      first.focus();
    }
  };

  window.addEventListener("keydown", trapHandler, true);
}

function activateSettingsTab(tabId) {
  if (!tabId) return;
  const tabLinks = document.querySelectorAll(".tab-link");
  tabLinks.forEach((btn) => {
    if (btn.dataset.tab === tabId) {
      btn.click();
    }
  });
}

export function openSettingsWithTab(tabId) {
  openSettings();
  setTimeout(() => activateSettingsTab(tabId), 0);
}

export function closeSettings() {
  if (!settingsModal) return;
  settingsModal.style.display = "none";
  settingsModal.setAttribute("aria-hidden", "true");
  if (trapHandler) {
    window.removeEventListener("keydown", trapHandler, true);
    trapHandler = null;
  }
  closeSettingsSectionsPanel();
  syncModalScrollLock();
  try {
    (settingsButton || previousFocus)?.focus?.();
  } catch {}
  previousFocus = null;
}

export function updateThemeDropdownUI(theme) {
  const next = theme === "system" ? "dark" : theme;
  const label = document.getElementById("theme-selected-label");
  const menu = document.getElementById("theme-dropdown-menu");
  const btn = document.getElementById("theme-dropdown-btn");
  const item = menu?.querySelector(`[data-value="${next}"]`);

  if (label && item) {
    label.textContent = item.textContent;
    menu.querySelectorAll("li").forEach((li) => li.classList.remove("active"));
    item.classList.add("active");
    if (btn) btn.setAttribute("data-current-theme", next);
  }
}

export function initSettingsModal() {
  const tabLinks = document.querySelectorAll(".tab-link");
  const exportBtn = document.getElementById("export-config-button");
  const importBtn = document.getElementById("import-config-button");
  const importInput = document.getElementById("import-config-input");
  const fontSizeToggle = document.getElementById("settings-font-size-toggle");
  const resetBtn = document.getElementById("reset-config-button");
  const firstRunResetBtn = document.getElementById("first-run-reset-button");
  const sectionsToggle = getSettingsSectionsToggle();

  const initDefaultTabSetting = async () => {
    const radios = document.querySelectorAll('input[name="defaultTab"]');
    const currentDefaultTab = await getDefaultTab();
    const resolvedDefaultTab =
      currentDefaultTab === "backup" ? "wireguard" : currentDefaultTab;
    radios.forEach((radio) => {
      radio.checked = radio.value === resolvedDefaultTab;
      radio.addEventListener("change", (e) => setDefaultTab(e.target.value));
    });
  };

  // Обработчики табов в модалке
  if (tabLinks.length) {
    if (sectionsToggle) {
      sectionsToggle.addEventListener("click", () => {
        const wrapper = getSettingsTabsWrapper();
        const isOpen =
          wrapper?.classList.contains("settings-tabs--open") || false;
        if (isOpen) {
          closeSettingsSectionsPanel();
        } else {
          openSettingsSectionsPanel();
        }
      });
    }

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
        syncActiveSettingsSectionLabel();
        closeSettingsSectionsPanel();
      });
    });

    // Восстанавливаем вкладку при открытии
    const savedTab = localStorage.getItem("lastSettingsTab");
    if (savedTab) {
      activateSettingsTab(savedTab);
    }
    syncActiveSettingsSectionLabel();
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
      fontSizeToggle.checked =
        String(currentFontSize) === "18" || String(currentFontSize) === "18px";
    })();
  }

  if (resetBtn) {
    resetBtn.addEventListener("click", async () => {
      if (!confirm(t("settings.reset.confirm"))) return;

      try {
        await resetConfigToDefaults();
      } catch (error) {
        console.error("Ошибка при сбросе настроек:", error);
        alert(t("settings.reset.error"));
      }
    });
  }

  if (firstRunResetBtn) {
    firstRunResetBtn.addEventListener("click", () => {
      try {
        localStorage.setItem("firstRunCompleted", "0");
      } catch {}
      closeSettings();
      initFirstRunModal();
    });
  }

  initDefaultTabSetting();

  // --- Логика выбора темы удалена, чтобы избежать конфликта с settings.js ---
  // (См. settings.js для реализации кастомного dropdown выбора темы)
}
