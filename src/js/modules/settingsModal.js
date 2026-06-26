// src/js/modules/settingsModal.js

import { toggleFontSize, getFontSize } from "./settingsStore.js";
import {
  exportConfig,
  importConfig,
  getDefaultTab,
  setDefaultTab,
  resetConfigToDefaults,
} from "./settings.js";
import { settingsModal, settingsTrigger } from "./domElements.js";
import { t } from "./i18n.js";
import { initFirstRunModal } from "./firstRunModal.js";
import { hideAllTooltips } from "./tooltipInitializer.js";
import { showToast } from "./toast.js";
import {
  acquireBodyScrollLock,
  releaseBodyScrollLock,
} from "./scrollLockManager.js";
import { syncAccessibleDropdownSelection } from "./features/settings/accessibleDropdown.js";

let previousFocus = null;
let trapHandler = null;
const SETTINGS_MODAL_SCROLL_LOCK_OWNER = "settings-modal";

function isDownloadQualityModalOpen() {
  return !!document
    .getElementById("download-quality-modal")
    ?.classList.contains("is-open");
}

function isDropdownHandlingEscape(event) {
  const dropdown = event.target?.closest?.(".dropdown");
  const openMenu = dropdown?.querySelector(".dropdown-menu.show");
  const expandedTrigger = dropdown?.querySelector(
    '.dropdown-toggle[aria-expanded="true"]',
  );
  return !!(openMenu || expandedTrigger);
}

function syncModalScrollLock() {
  const shouldLock =
    settingsModal?.style.display === "flex" || isDownloadQualityModalOpen();
  if (shouldLock) acquireBodyScrollLock(SETTINGS_MODAL_SCROLL_LOCK_OWNER);
  else releaseBodyScrollLock(SETTINGS_MODAL_SCROLL_LOCK_OWNER);
}

function getSettingsTabsWrapper() {
  return document.getElementById("settings-tabs-panel");
}

function getSettingsSectionsToggle() {
  return document.getElementById("settings-sections-toggle");
}

function getSettingsTabLinks() {
  return settingsModal
    ? Array.from(settingsModal.querySelectorAll(".settings-tabs .tab-link"))
    : [];
}

function getSettingsTabPanes() {
  return settingsModal
    ? Array.from(settingsModal.querySelectorAll(".tab-content .tab-pane"))
    : [];
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

async function populateAboutSection() {
  try {
    const [version, runtimeInfo] = await Promise.all([
      window.electron?.invoke?.("get-version"),
      window.electron?.getRuntimeInfo?.(),
    ]);

    const setText = (id, value, { prefixV = true } = {}) => {
      const el = document.getElementById(id);
      if (!el) return;
      const normalized = String(value || "").trim();
      el.textContent = normalized ? `${prefixV ? "v" : ""}${normalized}` : "—";
    };

    setText("settings-app-version", version);
    setText("settings-about-electron-version", runtimeInfo?.electron);
    setText("settings-about-chrome-version", runtimeInfo?.chrome);
    setText("settings-about-node-version", runtimeInfo?.node);
  } catch {}
}

async function copyAboutSectionInfo() {
  const [version, runtimeInfo, platformInfo] = await Promise.all([
    window.electron?.invoke?.("get-version"),
    window.electron?.getRuntimeInfo?.(),
    window.electron?.getPlatformInfo?.(),
  ]);
  const lines = [
    "Thunder",
    `App: v${String(version || "—").trim() || "—"}`,
    `Electron: v${String(runtimeInfo?.electron || "—").trim() || "—"}`,
    `Chrome: v${String(runtimeInfo?.chrome || "—").trim() || "—"}`,
    `Node: v${String(runtimeInfo?.node || "—").trim() || "—"}`,
    `Platform: ${String(platformInfo?.platform || "—").trim() || "—"}`,
    `Arch: ${String(platformInfo?.arch || "—").trim() || "—"}`,
  ];
  await navigator.clipboard.writeText(lines.join("\n"));
}

export function openSettings() {
  if (!settingsModal) return;
  hideAllTooltips();
  previousFocus = document.activeElement;
  if (document.activeElement instanceof HTMLElement) {
    document.activeElement.blur();
  }
  settingsModal.style.display = "flex";
  settingsModal.style.justifyContent = "center";
  settingsModal.style.alignItems = "center";
  settingsModal.setAttribute("aria-hidden", "false");
  syncModalScrollLock();

  try {
    window.dispatchEvent(new Event("settings:opened"));
  } catch {}
  populateAboutSection();
  syncActiveSettingsSectionLabel();
  closeSettingsSectionsPanel();

  const tabbables = getTabbables(settingsModal);
  if (tabbables.length) {
    const activeTab = settingsModal.querySelector(".tab-link.active");
    (activeTab || tabbables[0]).focus();
  } else {
    settingsModal.focus?.();
  }

  if (trapHandler) {
    window.removeEventListener("keydown", trapHandler, true);
  }

  trapHandler = (event) => {
    if (
      event.key === "Escape" &&
      !isDownloadQualityModalOpen() &&
      !isDropdownHandlingEscape(event)
    ) {
      event.preventDefault();
      event.stopPropagation();
      closeSettings();
      return;
    }
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
  const button = getSettingsTabLinks().find((btn) => btn.dataset.tab === tabId);
  button?.click();
}

function resolveStoredSettingsTab(tabId) {
  const fallbackTab = "general-settings";
  if (!tabId || tabId === "about-settings") return fallbackTab;
  const exists = getSettingsTabLinks().some((btn) => btn.dataset.tab === tabId);
  return exists ? tabId : fallbackTab;
}

export function openSettingsWithTab(tabId) {
  openSettings();
  setTimeout(() => activateSettingsTab(tabId), 0);
}

export function closeSettings() {
  if (!settingsModal) return;
  const restoreTarget = settingsTrigger || previousFocus;
  hideAllTooltips();
  settingsModal.style.display = "none";
  settingsModal.setAttribute("aria-hidden", "true");
  if (trapHandler) {
    window.removeEventListener("keydown", trapHandler, true);
    trapHandler = null;
  }
  closeSettingsSectionsPanel();
  syncModalScrollLock();
  try {
    if (restoreTarget instanceof HTMLElement) {
      restoreTarget.dataset.tooltipSuppressed = "true";
      restoreTarget.focus?.();
      queueMicrotask(() => {
        delete restoreTarget.dataset.tooltipSuppressed;
      });
    }
  } catch {}
  hideAllTooltips();
  try {
    window.dispatchEvent(new Event("settings:closed"));
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
    syncAccessibleDropdownSelection(menu, next);
    if (btn) btn.setAttribute("data-current-theme", next);
  }
}

export function initSettingsModal() {
  const tabLinks = getSettingsTabLinks();
  const exportBtn = document.getElementById("export-config-button");
  const importBtn = document.getElementById("import-config-button");
  const importInput = document.getElementById("import-config-input");
  const fontSizeToggle = document.getElementById("settings-font-size-toggle");
  const resetBtn = document.getElementById("reset-config-button");
  const firstRunResetBtn = document.getElementById("first-run-reset-button");
  const aboutWhatsNewBtn = document.getElementById(
    "settings-about-whats-new-button",
  );
  const aboutCopyInfoBtn = document.getElementById(
    "settings-about-copy-info-button",
  );
  const aboutCheckUpdatesBtn = document.getElementById(
    "settings-about-check-updates-button",
  );
  const sectionsToggle = getSettingsSectionsToggle();

  if (settingsModal && settingsModal.dataset.closeLifecycleBound !== "1") {
    settingsModal.dataset.closeLifecycleBound = "1";
    settingsModal.addEventListener("modal:close-request", (event) => {
      event.preventDefault();
      closeSettings();
    });
  }

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

    const activateTab = (button, { moveFocus = false } = {}) => {
      const tabId = button.dataset.tab;
      if (!tabId) return;

      tabLinks.forEach((tab) => {
        const isActive = tab === button;
        tab.classList.toggle("active", isActive);
        tab.setAttribute("aria-selected", String(isActive));
        tab.tabIndex = isActive ? 0 : -1;
      });

      getSettingsTabPanes().forEach((pane) => {
        const isActive = pane.id === tabId;
        pane.classList.toggle("active", isActive);
        pane.hidden = !isActive;
      });

      localStorage.setItem("lastSettingsTab", tabId);
      syncActiveSettingsSectionLabel();
      closeSettingsSectionsPanel();
      if (moveFocus) button.focus();
    };

    tabLinks.forEach((button, index) => {
      button.addEventListener("click", () => activateTab(button));
      button.addEventListener("keydown", (event) => {
        const lastIndex = tabLinks.length - 1;
        const keyTargets = {
          ArrowDown: index === lastIndex ? 0 : index + 1,
          ArrowRight: index === lastIndex ? 0 : index + 1,
          ArrowUp: index === 0 ? lastIndex : index - 1,
          ArrowLeft: index === 0 ? lastIndex : index - 1,
          Home: 0,
          End: lastIndex,
        };
        const targetIndex = keyTargets[event.key];
        if (targetIndex === undefined) return;
        event.preventDefault();
        activateTab(tabLinks[targetIndex], { moveFocus: true });
      });
    });

    // Восстанавливаем вкладку при открытии
    const savedTab = localStorage.getItem("lastSettingsTab");
    if (savedTab) {
      const resolvedTab = resolveStoredSettingsTab(savedTab);
      if (resolvedTab !== savedTab) {
        localStorage.setItem("lastSettingsTab", resolvedTab);
      }
      activateSettingsTab(resolvedTab);
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

  if (aboutWhatsNewBtn) {
    aboutWhatsNewBtn.addEventListener("click", () => {
      const trigger = document.querySelector(".version-container");
      if (trigger instanceof HTMLElement) {
        trigger.click();
      }
    });
  }

  if (aboutCopyInfoBtn) {
    aboutCopyInfoBtn.addEventListener("click", async () => {
      try {
        await copyAboutSectionInfo();
        showToast(t("settings.about.copySuccess"), "success");
      } catch (error) {
        console.error("[settingsModal] Failed to copy app info:", error);
        showToast(t("settings.about.copyError"), "error");
      }
    });
  }

  if (aboutCheckUpdatesBtn) {
    aboutCheckUpdatesBtn.addEventListener("click", async () => {
      try {
        closeSettings();
        const result = await window.electron?.invoke?.("check-app-updates");
        if (result?.success === false) {
          showToast(t("settings.about.updatesError"), "error");
        }
      } catch (error) {
        console.error("[settingsModal] Failed to start update check:", error);
        showToast(t("settings.about.updatesError"), "error");
      }
    });
  }

  initDefaultTabSetting();
  populateAboutSection();

  // --- Логика выбора темы удалена, чтобы избежать конфликта с settings.js ---
  // (См. settings.js для реализации кастомного dropdown выбора темы)
}
