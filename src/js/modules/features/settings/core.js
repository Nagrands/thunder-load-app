// src/js/modules/settings.js

import {
  settingsAutoLaunchToggle,
  settingsMinimizeOnLaunchToggle,
  settingsCloseNotificationToggle,
  settingsOpenOnDownloadCompleteToggle,
  settingsOpenOnCopyUrlToggle,
  settingsDisableGlobalShortcutsToggle,
  settingsCloseToTrayRadio,
  settingsCloseAppRadio,
  settingsDisableCompleteModalToggle,
  settingsLowEffectsToggle,
} from "../../domElements.js";

import {
  getTheme,
  getFontSize,
  setFontSize,
  setTheme,
} from "../../settingsStore.js";
import { showToast } from "../../toast.js";
import { showConfirmationDialog } from "../../modals.js";
import { getLowEffects, setLowEffects } from "../../effectsMode.js";
import { applyI18n, t } from "../../i18n.js";
import {
  DEFAULT_CONFIG,
  QUALITY_PROFILE_DEFAULT,
  QUALITY_PROFILE_KEY,
} from "./defaults.js";
import { clearOpenSettingsHandlers, onOpenSettings } from "./openSettingsBus.js";
import {
  bindModuleBadgesI18nSync,
  syncModuleBadges,
  updateModuleBadge,
} from "./moduleBadges.js";
import { initDeveloperToolsGate } from "./developerToolsGate.js";
import { initLanguageDropdown } from "./languageDropdown.js";
import { ensureToolsInfo } from "./toolsInfoController.js";

function normalizeDefaultTabId(tabId) {
  return tabId === "backup" ? "wireguard" : tabId;
}

const WG_REMEMBER_LAST_TOOL_KEY = "toolsRememberLastView";

/**
 * Функция для инициализации настроек
 */
async function initSettings() {
  clearOpenSettingsHandlers();
  try {
    localStorage.removeItem("topbarNetworkStatusVisible");
  } catch {}

  // Font size dropdown (custom) logic
  const openConfigFolderBtn = document.getElementById(
    "open-config-folder-button",
  );
  if (openConfigFolderBtn) {
    openConfigFolderBtn.addEventListener("click", () => {
      window.electron.invoke("open-config-folder");
    });
  }

  // UI language dropdown (custom)
  initLanguageDropdown();

  bindModuleBadgesI18nSync();
  syncModuleBadges();

  initDeveloperToolsGate();

  // Загрузчик: профиль качества по умолчанию
  (function initDownloadQualityProfile() {
    const segment = document.getElementById("quality-profile-segment");
    const rememberBtn = document.getElementById(
      "quality-profile-segment-remember",
    );
    const audioBtn = document.getElementById("quality-profile-segment-audio");
    const summaryIcon = document.getElementById("quality-profile-summary-icon");
    const summaryTitle = document.getElementById(
      "quality-profile-summary-title",
    );
    const summaryHint = document.getElementById("quality-profile-summary-hint");
    if (!segment || !rememberBtn || !audioBtn || !summaryTitle || !summaryHint)
      return;

    const OPTIONS = ["remember", "audio"];
    const SUMMARY_META = {
      remember: {
        icon: "fa-solid fa-rotate",
        titleKey: "settings.downloader.profile.summary.remember.title",
        hintKey: "settings.downloader.profile.summary.remember.hint",
      },
      audio: {
        icon: "fa-solid fa-music",
        titleKey: "settings.downloader.profile.summary.audio.title",
        hintKey: "settings.downloader.profile.summary.audio.hint",
      },
    };
    const buttons = [rememberBtn, audioBtn];

    const read = () => {
      try {
        const raw = localStorage.getItem(QUALITY_PROFILE_KEY);
        return OPTIONS.includes(raw) ? raw : QUALITY_PROFILE_DEFAULT;
      } catch {
        return QUALITY_PROFILE_DEFAULT;
      }
    };

    const normalize = (value) =>
      OPTIONS.includes(value) ? value : QUALITY_PROFILE_DEFAULT;

    const write = (val) => {
      const v = normalize(val);
      try {
        localStorage.setItem(QUALITY_PROFILE_KEY, v);
      } catch {}
      window.electron
        ?.invoke?.("toast", t("settings.qualityProfile.saved"), "success")
        .catch(() => {});
    };

    const apply = (val) => {
      const current = normalize(val);
      buttons.forEach((btn) => {
        const isActive = btn.dataset.value === current;
        btn.classList.toggle("is-active", isActive);
        btn.setAttribute("aria-checked", isActive ? "true" : "false");
        btn.tabIndex = isActive ? 0 : -1;
      });
      const meta = SUMMARY_META[current];
      if (summaryIcon) summaryIcon.innerHTML = `<i class="${meta.icon}"></i>`;
      summaryTitle.setAttribute("data-i18n", meta.titleKey);
      summaryTitle.textContent = t(meta.titleKey);
      summaryHint.setAttribute("data-i18n", meta.hintKey);
      summaryHint.textContent = t(meta.hintKey);
    };

    const selectAndPersist = (value) => {
      const normalized = normalize(value);
      write(normalized);
      apply(normalized);
    };

    const moveSelection = (offset, { commit = false } = {}) => {
      const current = normalize(read());
      const index = OPTIONS.indexOf(current);
      const next = OPTIONS[(index + offset + OPTIONS.length) % OPTIONS.length];
      apply(next);
      if (commit) write(next);
    };

    const moveToEdge = (toLast, { commit = false } = {}) => {
      const next = toLast ? OPTIONS[OPTIONS.length - 1] : OPTIONS[0];
      apply(next);
      if (commit) write(next);
    };

    const current = read();
    apply(current);

    buttons.forEach((btn) => {
      btn.addEventListener("click", () => {
        selectAndPersist(btn.dataset.value);
      });
    });

    segment.addEventListener("keydown", (event) => {
      switch (event.key) {
        case "ArrowRight":
        case "ArrowDown":
          event.preventDefault();
          moveSelection(1);
          break;
        case "ArrowLeft":
        case "ArrowUp":
          event.preventDefault();
          moveSelection(-1);
          break;
        case "Home":
          event.preventDefault();
          moveToEdge(false);
          break;
        case "End":
          event.preventDefault();
          moveToEdge(true);
          break;
        case "Enter":
        case " ":
          event.preventDefault();
          write(
            buttons.find((btn) => btn.tabIndex === 0)?.dataset.value ||
              normalize(read()),
          );
          break;
        default:
          break;
      }
    });

    onOpenSettings("download-quality-profile", () => {
      apply(read());
    });
  })();

  (function initDownloadParallelLimit() {
    const segment = document.getElementById(
      "settings-download-parallel-segment",
    );
    const option1 = document.getElementById("settings-download-parallel-1");
    const option2 = document.getElementById("settings-download-parallel-2");
    const valueEl = document.getElementById("settings-download-parallel-value");
    if (!segment || !option1 || !option2) return;

    const normalize = (value) => {
      const raw = Number(value);
      if (!Number.isFinite(raw)) return 1;
      return Math.max(1, Math.min(2, Math.trunc(raw)));
    };

    const read = () => {
      try {
        const raw = localStorage.getItem("downloadParallelLimit");
        if (raw === null) return 1;
        const normalized = normalize(raw);
        if (String(normalized) !== raw) {
          localStorage.setItem("downloadParallelLimit", String(normalized));
        }
        return normalized;
      } catch {
        return 1;
      }
    };

    const apply = (value) => {
      const normalized = normalize(value);
      const isOne = normalized === 1;
      option1.classList.toggle("is-active", isOne);
      option2.classList.toggle("is-active", !isOne);
      option1.setAttribute("aria-checked", isOne ? "true" : "false");
      option2.setAttribute("aria-checked", !isOne ? "true" : "false");
      if (valueEl) valueEl.textContent = String(normalized);
    };

    const syncMainLimit = (limit) => {
      window.electron
        ?.invoke?.("set-download-parallel-limit", limit)
        .catch(() => {});
    };

    const write = (value, { toast = true } = {}) => {
      const limit = normalize(value);
      try {
        localStorage.setItem("downloadParallelLimit", String(limit));
      } catch {}
      apply(limit);
      syncMainLimit(limit);
      window.dispatchEvent(
        new CustomEvent("download:parallel-limit-changed", {
          detail: { limit },
        }),
      );
      if (toast) {
        window.electron
          ?.invoke?.(
            "toast",
            t("settings.downloader.parallel.saved", { count: limit }),
            "success",
          )
          .catch(() => {});
      }
    };

    const syncFromStore = () => {
      const limit = read();
      write(limit, { toast: false });
    };

    syncFromStore();
    option1.addEventListener("click", () => write(1));
    option2.addEventListener("click", () => write(2));

    onOpenSettings("download-parallel-limit", () => {
      syncFromStore();
    });
  })();
  const fontSizeDropdownBtn = document.getElementById("font-size-dropdown-btn");
  const fontSizeDropdownMenu = document.getElementById(
    "font-size-dropdown-menu",
  );
  const fontSizeLabel = document.getElementById("font-size-selected-label");
  const resetFontSizeBtn = document.getElementById("reset-font-size");
  if (fontSizeDropdownBtn && fontSizeDropdownMenu && fontSizeLabel) {
    const savedSize = localStorage.getItem("fontSize") || "16";
    fontSizeLabel.textContent = `${savedSize} px`;
    document.documentElement.style.setProperty("--font-size", `${savedSize}px`);
    document.body.style.setProperty("--font-size", `${savedSize}px`);

    // Highlight selected font size on init
    fontSizeDropdownMenu.querySelectorAll("li").forEach((item) => {
      item.classList.remove("active");
      if (item.getAttribute("data-value") === savedSize) {
        item.classList.add("active");
      }
    });

    fontSizeDropdownBtn.addEventListener("click", () => {
      fontSizeDropdownMenu.classList.toggle("show");
    });

    fontSizeDropdownMenu.querySelectorAll("li").forEach((item) => {
      item.addEventListener("click", async () => {
        const newSize = item.getAttribute("data-value");
        localStorage.setItem("fontSize", newSize);
        fontSizeLabel.textContent = `${newSize} px`;
        // Highlight selected font size in dropdown
        fontSizeDropdownMenu
          .querySelectorAll("li")
          .forEach((li) => li.classList.remove("active"));
        item.classList.add("active");
        await setFontSize(newSize);
        fontSizeDropdownMenu.classList.remove("show");
        showToast(
          t("settings.fontSize.set", { size: newSize }),
          "success",
          5500,
          null,
          null,
          false,
          { allowHtml: true },
        );
      });
    });

    document.addEventListener("click", (e) => {
      if (
        !fontSizeDropdownBtn.contains(e.target) &&
        !fontSizeDropdownMenu.contains(e.target)
      ) {
        fontSizeDropdownMenu.classList.remove("show");
      }
    });
  }
  if (resetFontSizeBtn && fontSizeLabel) {
    resetFontSizeBtn.addEventListener("click", async () => {
      const defaultSize = "16";
      localStorage.setItem("fontSize", defaultSize);
      fontSizeLabel.textContent = `${defaultSize} px`;
      fontSizeDropdownMenu.querySelectorAll("li").forEach((li) => {
        li.classList.remove("active");
        if (li.getAttribute("data-value") === defaultSize) {
          li.classList.add("active");
        }
      });
      await setFontSize(defaultSize);
      showToast(
        t("settings.fontSize.reset", { size: defaultSize }),
        "success",
        5500,
        null,
        null,
        false,
        { allowHtml: true },
      );
    });
  }

  // Low effects (disable blur/animations) toggle
  if (settingsLowEffectsToggle) {
    settingsLowEffectsToggle.checked = getLowEffects();
    settingsLowEffectsToggle.addEventListener("change", (e) => {
      const enabled = e.target.checked;
      setLowEffects(enabled);
    });
  }

  const themeDropdownBtn = document.getElementById("theme-dropdown-btn");
  const themeDropdownMenu = document.getElementById("theme-dropdown-menu");
  const themeLabel = document.getElementById("theme-selected-label");
  const normalizeTheme = (theme) =>
    theme === "system" || !theme ? "dark" : theme;
  const formatThemeLabel = (theme) => {
    const normalizedTheme = normalizeTheme(theme);
    const map = {
      dark: t("settings.appearance.theme.dark"),
      midnight: t("settings.appearance.theme.midnight"),
      sunset: t("settings.appearance.theme.sunset"),
      violet: t("settings.appearance.theme.violet"),
      light: t("settings.appearance.theme.light"),
    };
    return map[normalizedTheme] || normalizedTheme;
  };
  const syncThemeDropdownState = (theme) => {
    const normalizedTheme = normalizeTheme(theme);

    themeLabel.textContent = formatThemeLabel(normalizedTheme);
    themeDropdownMenu.querySelectorAll("li").forEach((item) => {
      item.classList.toggle(
        "active",
        item.getAttribute("data-value") === normalizedTheme,
      );
    });
    themeDropdownBtn.setAttribute("data-current-theme", normalizedTheme);
  };

  console.log("Тема: ", { themeDropdownBtn, themeDropdownMenu, themeLabel });
  if (themeDropdownBtn && themeDropdownMenu && themeLabel) {
    const savedTheme = await getTheme();
    document.documentElement.setAttribute("data-theme", savedTheme);
    syncThemeDropdownState(savedTheme);

    // Новый, более надёжный обработчик открытия dropdown для темы
    themeDropdownBtn.addEventListener("click", (e) => {
      e.preventDefault();
      e.stopPropagation();

      const isOpen = themeDropdownMenu.classList.contains("show");

      // Закрываем все dropdown-меню
      document
        .querySelectorAll(".dropdown-menu")
        .forEach((menu) => menu.classList.remove("show"));

      // Показываем только если ранее не был открыт
      if (!isOpen) {
        themeDropdownMenu.classList.add("show");
      }
    });

    themeDropdownMenu.querySelectorAll("li").forEach((item) => {
      item.addEventListener("click", async () => {
        const selectedTheme = item.getAttribute("data-value");
        document.documentElement.classList.add("theme-transition");
        await setTheme(selectedTheme);
        syncThemeDropdownState(selectedTheme);
        themeDropdownMenu.classList.remove("show");
        setTimeout(
          () => document.documentElement.classList.remove("theme-transition"),
          260,
        );
        showToast(
          t("settings.theme.set", { theme: themeLabel.textContent }),
          "success",
          5500,
          null,
          null,
          false,
          { allowHtml: true },
        );
      });
    });

    window.addEventListener("i18n:changed", async () => {
      const currentTheme = await getTheme();
      syncThemeDropdownState(currentTheme);
    });

    // Глобальный обработчик клика вне меню только для темы
    document.addEventListener("click", (e) => {
      if (
        !themeDropdownBtn.contains(e.target) &&
        !themeDropdownMenu.contains(e.target)
      ) {
        themeDropdownMenu.classList.remove("show");
      }
    });
  }
  // Глобальный обработчик закрытия всех dropdown-меню, не мешает кастомным выпадающим меню
  document.addEventListener("click", (e) => {
    const dropdowns = document.querySelectorAll(".dropdown-menu");
    dropdowns.forEach((menu) => {
      const button = menu.previousElementSibling;
      if (!menu.contains(e.target) && !(button && button.contains(e.target))) {
        menu.classList.remove("show");
      }
    });
  });
  // Theme reset button support
  const resetThemeBtn = document.getElementById("reset-theme");
  if (resetThemeBtn && themeDropdownMenu && themeLabel) {
    resetThemeBtn.addEventListener("click", async () => {
      const defaultTheme = "system";
      document.documentElement.classList.add("theme-transition");
      await setTheme(defaultTheme);
      syncThemeDropdownState(defaultTheme);
      themeDropdownMenu.classList.remove("show");
      setTimeout(
        () => document.documentElement.classList.remove("theme-transition"),
        260,
      );
      showToast(
        t("settings.theme.reset", { theme: formatThemeLabel(defaultTheme) }),
        "success",
        5500,
        null,
        null,
        false,
        { allowHtml: true },
      );
    });
  }

  // Получаем текущее состояние автозапуска
  window.electron.invoke("get-auto-launch-status").then((isEnabled) => {
    if (settingsAutoLaunchToggle) {
      settingsAutoLaunchToggle.checked = isEnabled;
      console.log(`Автозапуск установлен на: ${isEnabled}`);
    }
  });

  // Обработчик изменения состояния автозапуска
  if (settingsAutoLaunchToggle) {
    settingsAutoLaunchToggle.addEventListener("change", () => {
      const enable = settingsAutoLaunchToggle.checked;
      window.electron
        .invoke("toggle-auto-launch", enable)
        .then(() => {
          console.log(`Автозапуск ${enable ? "включен" : "отключен"}`);
        })
        .catch((error) => {
          console.error("Ошибка при изменении состояния автозапуска:", error);
        });
    });
  }

  // Инициализация settingsCloseNotificationToggle
  window.electron.invoke("get-close-notification-status").then((isEnabled) => {
    if (settingsCloseNotificationToggle) {
      settingsCloseNotificationToggle.checked = isEnabled;
      console.log(
        `Показывать уведомление при сворачивании в трей установлено на: ${isEnabled}`,
      );
    }
  });

  if (settingsCloseNotificationToggle) {
    settingsCloseNotificationToggle.addEventListener("change", () => {
      const enable = settingsCloseNotificationToggle.checked;
      window.electron
        .invoke("set-close-notification-status", enable)
        .then(() => {
          console.log(
            `Уведомление при сворачивании ${enable ? "включено" : "отключено"}`,
          );
        })
        .catch((error) => {
          console.error("Ошибка при изменении состояния уведомления:", error);
        });
    });
  }

  // Получаем текущее состояние опции "Сворачивать в трей"
  window.electron.invoke("get-minimize-on-launch-status").then((isEnabled) => {
    if (settingsMinimizeOnLaunchToggle) {
      settingsMinimizeOnLaunchToggle.checked = isEnabled;
      console.log(`Сворачивание при запуске установлено на: ${isEnabled}`);
    }
  });

  // Обработчик изменения состояния "Сворачивать в трей"
  if (settingsMinimizeOnLaunchToggle) {
    settingsMinimizeOnLaunchToggle.addEventListener("change", () => {
      const enable = settingsMinimizeOnLaunchToggle.checked;
      window.electron
        .invoke("set-minimize-on-launch-status", enable)
        .then(() => {
          console.log(
            `Сворачивание при запуске ${enable ? "включено" : "отключено"}`,
          );
        });
    });
  }

  // Получаем текущее состояние настройки "Отключить глобальные Горячие клавиши на открытие сайтов"
  window.electron
    .invoke("get-disable-global-shortcuts-status")
    .then((isEnabled) => {
      if (settingsDisableGlobalShortcutsToggle) {
        settingsDisableGlobalShortcutsToggle.checked = isEnabled;
        console.log(
          `Отключение глобальных горячих клавиш установлено на: ${isEnabled}`,
        );
      }
    });

  // Обработчик изменения состояния "Отключить глобальные Горячие клавиши на открытие сайтов"
  if (settingsDisableGlobalShortcutsToggle) {
    settingsDisableGlobalShortcutsToggle.addEventListener("change", () => {
      const enable = settingsDisableGlobalShortcutsToggle.checked;
      window.electron
        .invoke("set-disable-global-shortcuts-status", enable)
        .then(() => {
          console.log(
            `Отключение глобальных горячих клавиш ${enable ? "включено" : "отключено"}`,
          );
        })
        .catch((error) => {
          console.error(
            "Ошибка при изменении состояния глобальных горячих клавиш:",
            error,
          );
        });
    });
  }

  // Получаем текущее состояние опции "Разворачивать окно при копировании URL"
  window.electron.invoke("get-open-on-copy-url-status").then((isEnabled) => {
    if (settingsOpenOnCopyUrlToggle) {
      settingsOpenOnCopyUrlToggle.checked = isEnabled;
      console.log(
        `Разворачивание окна при копировании URL установлено на: ${isEnabled}`,
      );
    }
  });

  // Обработчик изменения состояния "Разворачивать окно при копировании URL"
  if (settingsOpenOnCopyUrlToggle) {
    settingsOpenOnCopyUrlToggle.addEventListener("change", () => {
      const enable = settingsOpenOnCopyUrlToggle.checked;
      window.electron
        .invoke("set-open-on-copy-url-status", enable)
        .then(() => {
          console.log(
            `Разворачивание окна при копировании URL ${enable ? "включено" : "отключено"}`,
          );
        })
        .catch((error) => {
          console.error(
            "Ошибка при изменении состояния разворачивания окна:",
            error,
          );
        });
    });
  }

  // Получаем текущее состояние опции "Разворачивать окно по окончанию загрузки"
  window.electron
    .invoke("get-open-on-download-complete-status")
    .then((isEnabled) => {
      if (settingsOpenOnDownloadCompleteToggle) {
        settingsOpenOnDownloadCompleteToggle.checked = isEnabled;
        console.log(
          `Разворачивание окна по окончанию загрузки установлено на: ${isEnabled}`,
        );
      }
    });

  // Обработчик изменения состояния "Разворачивать окно по окончанию загрузки"
  if (settingsOpenOnDownloadCompleteToggle) {
    settingsOpenOnDownloadCompleteToggle.addEventListener("change", () => {
      const enable = settingsOpenOnDownloadCompleteToggle.checked;
      window.electron
        .invoke("set-open-on-download-complete-status", enable)
        .then(() => {
          console.log(
            `Разворачивание окна по окончанию загрузки ${enable ? "включено" : "отключено"}`,
          );
        })
        .catch((error) => {
          console.error(
            "Ошибка при изменении состояния разворачивания окна по окончанию загрузки:",
            error,
          );
        });
    });
  }

  // Обработка радио-кнопок для закрытия приложения или сворачивания в трей
  if (settingsCloseToTrayRadio) {
    settingsCloseToTrayRadio.addEventListener("change", () => {
      if (settingsCloseToTrayRadio.checked) {
        window.electron.invoke("set-minimize-instead-of-close", true);
      }
    });
  }

  if (settingsCloseAppRadio) {
    settingsCloseAppRadio.addEventListener("change", () => {
      if (settingsCloseAppRadio.checked) {
        window.electron.invoke("set-minimize-instead-of-close", false);
      }
    });
  }

  // Получаем текущее состояние опции "Отключить модальное окно завершения загрузки"
  window.electron
    .invoke("get-disable-complete-modal-status")
    .then((isEnabled) => {
      if (settingsDisableCompleteModalToggle) {
        settingsDisableCompleteModalToggle.checked = isEnabled;
        console.log(
          `Отключение модального окна завершения загрузки: ${isEnabled}`,
        );
      }
    });

  if (settingsDisableCompleteModalToggle) {
    settingsDisableCompleteModalToggle.addEventListener("change", () => {
      const enable = settingsDisableCompleteModalToggle.checked;
      window.electron
        .invoke("set-disable-complete-modal-status", enable)
        .then(() => {
          const message = enable
            ? t("settings.downloadCompleteModal.disabled")
            : t("settings.downloadCompleteModal.enabled");
          window.electron.invoke("toast", message, "success", {
            allowHtml: true,
          });
          console.log(
            `Отключение модального окна завершения загрузки ${enable ? "включено" : "отключено"}`,
          );
        });
    });
  }

  // Установка состояния при загрузке страницы
  window.electron
    .invoke("get-minimize-instead-of-close-status")
    .then((minimizeToTray) => {
      if (minimizeToTray) {
        settingsCloseToTrayRadio.checked = true;
      } else {
        settingsCloseAppRadio.checked = true;
      }
    });

  // === WG Unlock: отключение вкладки (settings toggle) ===
  (function initWgDisableToggle() {
    const KEY = "wgUnlockDisabled";
    const read = () => {
      try {
        const raw = localStorage.getItem(KEY);
        // По умолчанию вкладка отключена, если ключ отсутствует
        if (raw === null) return true;
        return JSON.parse(raw) === true;
      } catch {
        // Безопасный дефолт — отключено
        return true;
      }
    };

    function toggleWgSettingsDisabled(disabled) {
      // Ищем контролы WG-секции, которые должны отключаться вместе с вкладкой
      const modal =
        document.getElementById("settings-modal") ||
        document.querySelector("#settings");
      const root = modal || document;
      const autosend = root.querySelector(
        '#wg-autosend, #wg-autosend-toggle, [name="wg-autosend"], [data-setting="wg-autosend"]',
      );
      const rememberLastTool = root.querySelector("#wg-remember-last-tool");
      [autosend, rememberLastTool].forEach((control) => {
        if (!control) return;
        control.disabled = !!disabled;
        const label =
          control.closest("label, .form-check, .settings-row") ||
          control.parentElement;
        if (label) label.classList.toggle("is-disabled", !!disabled);
        if (label && label.hasAttribute("data-bs-toggle")) {
          try {
            window.bootstrap?.Tooltip?.getOrCreateInstance(label);
          } catch {}
        }
      });
    }

    function findWgSectionContainer(modal) {
      // Ищем ПРАВЫЙ КОНТЕНТ WG-секции (не левую навигацию)
      const byPaneId = modal?.querySelector("#wgunlock-settings");
      if (byPaneId)
        return (
          byPaneId.querySelector(
            ".settings-content, .section-body, .tab-pane, .card-body",
          ) || byPaneId
        );

      const byId = modal?.querySelector("#settings-wg");
      if (byId)
        return (
          byId.querySelector(
            ".settings-content, .section-body, .tab-pane, .card-body",
          ) || byId
        );

      const byData = modal?.querySelector('[data-section="wg"]');
      if (byData)
        return (
          byData.querySelector(
            ".settings-content, .section-body, .tab-pane, .card-body",
          ) || byData
        );

      const byClass = modal?.querySelector(".settings-section--wg");
      if (byClass)
        return (
          byClass.querySelector(
            ".settings-content, .section-body, .tab-pane, .card-body",
          ) || byClass
        );

      // Заголовок WG Unlock → ближайшая секция → её контент
      const heading = Array.from(
        modal?.querySelectorAll("h2, h3, .section-title") || [],
      ).find((h) => /WG\s*Unlock/i.test(h.textContent || ""));
      if (heading) {
        const sec =
          heading.closest(
            ".settings-section, .card, section, .accordion-item",
          ) || heading.parentElement;
        if (sec)
          return (
            sec.querySelector(
              ".settings-content, .section-body, .tab-pane, .card-body",
            ) || sec
          );
      }
      // Фолбэк — контент модалки
      return (
        modal?.querySelector(
          ".settings-body, .modal-body, .settings-content",
        ) ||
        modal ||
        document.body
      );
    }

    const write = (v) => {
      const val = !!v;
      try {
        localStorage.setItem(KEY, JSON.stringify(val));
      } catch {}
      // необязательный IPC-фолбэк — если канал есть в preload whitelist
      try {
        window.electron?.send &&
          window.electron.send("settings:set", { key: KEY, value: val });
      } catch {}
      // мгновенно обновляем интерфейс вкладок (tabSystem.js подпишется на событие)
      window.dispatchEvent(
        new CustomEvent("wg:toggleDisabled", { detail: { disabled: val } }),
      );
      // Блокируем/разблокируем связанные настройки WG
      toggleWgSettingsDisabled(val);
      // тост
      window.electron?.invoke?.(
        "toast",
        val
          ? t("settings.module.wg.disabled")
          : t("settings.module.wg.enabled"),
        val ? "info" : "success",
        { allowHtml: true },
      );
      updateModuleBadge("wg", val);
    };

    // Находим контейнер модалки и WG‑секцию
    const modal =
      document.getElementById("settings-modal") ||
      document.querySelector("#settings");
    const target = findWgSectionContainer(modal);
    if (!target) return; // защитимся, если модалка ещё не инициализирована

    // Если тумблер уже размечен в index.html — привяжем логику и не создаём дубликат
    const staticToggle = document.querySelector(
      "#wgunlock-settings #wg-disable-toggle, #wg-disable-toggle",
    );
    if (staticToggle) {
      const initialVal = read();
      staticToggle.checked = initialVal;
      updateModuleBadge("wg", initialVal);
      staticToggle.addEventListener("change", () =>
        write(staticToggle.checked),
      );
      onOpenSettings("wg-disable-toggle-static", () => {
        const val = read();
        staticToggle.checked = val;
        toggleWgSettingsDisabled(val);
        updateModuleBadge("wg", val);
      });
      toggleWgSettingsDisabled(read());
      return;
    }

    // Guard: если переключатель уже вставлен — не дублируем UI
    const existing = target.querySelector("#wg-disable-toggle");
    if (existing) {
      // синхронизируем состояние и обработчики на всякий случай
      existing.checked = read();
      existing.addEventListener("change", () => write(existing.checked), {
        once: true,
      });
      toggleWgSettingsDisabled(read());
      onOpenSettings("wg-disable-toggle-existing", () => {
        const val = read();
        existing.checked = val;
        toggleWgSettingsDisabled(val);
      });
      return;
    }

    // Создаём UI‑блок именно в секции WG Unlock
    const row = document.createElement("div");
    row.className = "settings-row settings-row--wg-disable";
    row.innerHTML = `
      <label class="checkbox-label" data-bs-toggle="tooltip" data-bs-placement="top" title="${t("settings.wg.disable.hint")}" data-i18n-title="settings.wg.disable.hint">
        <input id="wg-disable-toggle" type="checkbox" />
        <i class="fa-solid fa-bolt"></i>
        <span>${t("settings.disableTab")} ${t("settings.tabs.wg")}</span>
      </label>
      <p class="field-hint" data-i18n="settings.wg.disable.note">${t("settings.wg.disable.note")}</p>
    `;

    target.appendChild(row);
    applyI18n(row);

    // Видимость: показывать блок только на активной WG-секции
    function isWgSectionActive() {
      // Bootstrap 5 tab-pane.active или кастомная активность
      const pane = row.closest(
        ".tab-pane, .settings-section, section, .card, .accordion-item",
      );
      if (!pane) return true; // если не таб — считаем активным
      // active по классам или стилям
      const isActiveClass =
        pane.classList.contains("active") || !pane.hasAttribute("hidden");
      const isVisible = pane.offsetParent !== null; // отрисован
      return isActiveClass && isVisible;
    }
    function syncRowVisibility() {
      row.style.display = isWgSectionActive() ? "" : "none";
    }
    // первичная синхронизация
    syncRowVisibility();

    // Bootstrap событие переключения вкладок
    document.addEventListener(
      "shown.bs.tab",
      (_e) => {
        // если переключились в/из WG — обновим видимость
        syncRowVisibility();
      },
      true,
    );

    // Делегированный обработчик на клик по навигации настроек
    document.addEventListener(
      "click",
      (e) => {
        const el = e.target.closest(
          '[data-bs-toggle="tab"], [role="tab"], .settings-nav a, .settings-nav button',
        );
        if (el) {
          setTimeout(syncRowVisibility, 0);
        }
      },
      true,
    );

    // Наблюдаем за контейнером табов на изменения классов/атрибутов
    const tabsRoot = modal?.querySelector(
      ".tab-content, .settings-tabs, .modal-body",
    );
    if (tabsRoot && "MutationObserver" in window) {
      const mo = new MutationObserver(() => syncRowVisibility());
      mo.observe(tabsRoot, {
        attributes: true,
        subtree: true,
        attributeFilter: ["class", "style", "hidden"],
      });
    }

    // Инициализация чекбокса
    const input = row.querySelector("#wg-disable-toggle");
    input.checked = read();
    input.addEventListener("change", () => write(input.checked));

    // Синхронизация при каждом открытии модалки
    onOpenSettings("wg-disable-toggle-generated", () => {
      const val = read();
      input.checked = val;
      toggleWgSettingsDisabled(val);
      updateModuleBadge("wg", val);
    });

    // Применим блокировку зависимых настроек WG на старте
    const initVal = read();
    toggleWgSettingsDisabled(initVal);
    updateModuleBadge("wg", initVal);
  })();
  // === /WG Unlock: отключение вкладки ===

  // === WG Unlock: запоминать последний инструмент ===
  (function initRememberLastToolToggle() {
    const input = document.getElementById("wg-remember-last-tool");
    if (!input) return;
    const read = () => {
      try {
        const raw = localStorage.getItem(WG_REMEMBER_LAST_TOOL_KEY);
        if (raw === null) return false;
        return JSON.parse(raw) === true;
      } catch {
        return false;
      }
    };
    const write = (enabled) => {
      try {
        localStorage.setItem(
          WG_REMEMBER_LAST_TOOL_KEY,
          JSON.stringify(!!enabled),
        );
      } catch {}
    };
    const syncFromStore = () => {
      input.checked = read();
    };
    syncFromStore();
    input.addEventListener("change", () => write(input.checked));
    onOpenSettings("wg-remember-last-tool", syncFromStore);
  })();
  // === /WG Unlock: запоминать последний инструмент ===

  // === Backup: компактный список профилей ===
  (function initBackupViewModeToggle() {
    const input = document.getElementById("backup-compact-toggle");
    if (!input) return;
    const KEY = "bk_view_mode";
    const read = () => {
      try {
        const raw = localStorage.getItem(KEY);
        const parsed = raw ? JSON.parse(raw) : "full";
        return parsed === "compact";
      } catch {
        return false;
      }
    };
    const write = (compact, source = "settings") => {
      const mode = compact ? "compact" : "full";
      try {
        localStorage.setItem(KEY, JSON.stringify(mode));
      } catch {}
      window.dispatchEvent(
        new CustomEvent("backup:viewMode", { detail: { mode, source } }),
      );
    };
    input.checked = read();
    input.addEventListener("change", () => write(input.checked, "settings"));
    window.addEventListener("backup:viewMode", (event) => {
      const mode = event?.detail?.mode;
      if (!mode) return;
      const shouldCheck = mode === "compact";
      if (input.checked !== shouldCheck) {
        input.checked = shouldCheck;
      }
    });
    onOpenSettings("backup-view-mode", () => {
      const val = read();
      if (input.checked !== val) input.checked = val;
    });
  })();

  // === Backup: показ/скрытие лога ===
  (function initBackupLogToggle() {
    const input = document.getElementById("backup-log-toggle");
    if (!input) return;
    const KEY = "bk_log_visible";
    const read = () => {
      try {
        const raw = localStorage.getItem(KEY);
        if (raw === null) return true;
        return JSON.parse(raw) !== false;
      } catch {
        return true;
      }
    };
    const write = (visible, source = "settings") => {
      const flag = !!visible;
      try {
        localStorage.setItem(KEY, JSON.stringify(flag));
      } catch {}
      window.dispatchEvent(
        new CustomEvent("backup:logVisible", {
          detail: { visible: flag, source },
        }),
      );
    };
    input.checked = read();
    input.addEventListener("change", () => write(input.checked, "settings"));
    window.addEventListener("backup:logVisible", (event) => {
      const detail = event?.detail;
      if (!detail) return;
      const visible = detail.visible !== false;
      if (input.checked !== visible) input.checked = visible;
    });
    onOpenSettings("backup-log-visibility", () => {
      const visible = read();
      if (input.checked !== visible) input.checked = visible;
    });
  })();

  // === WG Unlock: авто‑закрытие (toggle + range 10–60s) ===
  const wgAutoToggle = document.getElementById("wg-auto-shutdown-toggle");
  const wgRangeWrap = document.getElementById("wg-auto-shutdown-range");
  const wgRange = document.getElementById("wg-auto-shutdown-seconds");
  const wgValue = document.getElementById("wg-auto-shutdown-value");

  if (wgAutoToggle && wgRangeWrap && wgRange && wgValue) {
    // Live countdown in Settings modal
    let wgCountdownTimer = null;
    let wgRemaining = 0;

    const stopSettingsCountdown = () => {
      if (wgCountdownTimer) {
        clearInterval(wgCountdownTimer);
        wgCountdownTimer = null;
      }
    };

    const startSettingsCountdown = (secs) => {
      stopSettingsCountdown();
      const s = Number(secs);
      wgRemaining = Number.isFinite(s) ? s : 30;
      wgValue.textContent = String(wgRemaining);
      wgCountdownTimer = setInterval(() => {
        wgRemaining -= 1;
        if (wgRemaining <= 0) {
          wgValue.textContent = "0";
          stopSettingsCountdown();
          return;
        }
        wgValue.textContent = String(wgRemaining);
      }, 1000);
    };
    const syncAutoShutdownFromStore = async () => {
      try {
        const [enabled, seconds] = await Promise.all([
          window.electron.invoke("get-auto-shutdown-status"),
          window.electron.invoke("get-auto-shutdown-seconds"),
        ]);
        const secs = Number(seconds) || 30;
        wgAutoToggle.checked = !!enabled;
        wgRangeWrap.style.display = enabled ? "" : "none";
        wgRange.value = secs;
        wgValue.textContent = String(secs);
        if (enabled) startSettingsCountdown(secs);
        else stopSettingsCountdown();
      } catch (e) {
        console.error("[settings] auto-shutdown init error:", e);
      }
    };

    // init on load
    await syncAutoShutdownFromStore();

    // toggle on/off
    wgAutoToggle.addEventListener("change", () => {
      const enabled = wgAutoToggle.checked;
      wgRangeWrap.style.display = enabled ? "" : "none";
      window.electron.invoke("set-auto-shutdown-status", enabled).catch((e) => {
        console.error("[settings] set-auto-shutdown-status error:", e);
      });
      if (enabled) {
        startSettingsCountdown(wgRange.value);
      } else {
        stopSettingsCountdown();
      }
    });

    // live value label
    wgRange.addEventListener("input", () => {
      wgValue.textContent = String(wgRange.value);
    });

    // persist on change with clamp 10–60
    wgRange.addEventListener("change", () => {
      const secs = Math.min(60, Math.max(10, Number(wgRange.value) || 30));
      wgRange.value = secs;
      wgValue.textContent = String(secs);
      window.electron.invoke("set-auto-shutdown-seconds", secs).catch((e) => {
        console.error("[settings] set-auto-shutdown-seconds error:", e);
      });
      if (wgAutoToggle.checked) {
        startSettingsCountdown(secs);
      }
    });

    // Sync from main/other views: restart/stop countdown based on payload
    window.electron.on("wg-auto-shutdown-updated", ({ enabled, seconds }) => {
      try {
        const secs = Number(seconds) || 30;
        wgAutoToggle.checked = !!enabled;
        wgRangeWrap.style.display = enabled ? "" : "none";
        wgRange.value = secs;
        if (enabled) {
          startSettingsCountdown(secs);
        } else {
          stopSettingsCountdown();
          wgValue.textContent = String(secs);
        }
      } catch (e) {
        console.error("[settings] wg-auto-shutdown-updated handler error:", e);
      }
    });

    // refresh on modal open
    onOpenSettings("wg-auto-shutdown", async () => {
      await syncAutoShutdownFromStore();
    });
  }
  // === /WG Unlock: авто‑закрытие ===

  // Модальное окно "Инструменты" внутри настроек
  (function initToolsModal() {
    const trigger = document.getElementById("settings-tools-open");
    const modal = document.getElementById("settings-tools-modal");
    const closeBtn = document.getElementById("settings-tools-close");
    const content = modal?.querySelector(".settings-tools-modal__content");
    if (!trigger || !modal || !closeBtn || !content) return;

    let previousFocus = null;

    const closeToolsModal = () => {
      modal.style.display = "none";
      modal.setAttribute("aria-hidden", "true");
      trigger.setAttribute("aria-expanded", "false");
      try {
        previousFocus?.focus?.();
      } catch {
        // noop
      }
      previousFocus = null;
    };

    const openToolsModal = async () => {
      previousFocus = document.activeElement;
      modal.style.display = "flex";
      modal.setAttribute("aria-hidden", "false");
      trigger.setAttribute("aria-expanded", "true");
      closeBtn.focus();
      await ensureToolsInfo(false);
    };

    trigger.setAttribute("aria-haspopup", "dialog");
    trigger.setAttribute("aria-controls", "settings-tools-modal");
    trigger.setAttribute("aria-expanded", "false");
    modal.setAttribute("aria-hidden", "true");

    trigger.addEventListener("click", () => {
      openToolsModal();
    });
    closeBtn.addEventListener("click", () => {
      closeToolsModal();
    });
    modal.addEventListener("mousedown", (event) => {
      if (event.target === modal) closeToolsModal();
    });
    document.addEventListener("keydown", (event) => {
      if (modal.style.display !== "flex") return;
      if (event.key === "Escape") {
        event.preventDefault();
        closeToolsModal();
      }
    });
    window.addEventListener("settings:opened", () => {
      closeToolsModal();
    });
  })();

  // Переключатель отображения статуса инструментов в шапке Загрузчика
  (function initToolsStatusVisibilityToggle() {
    const checkbox = document.getElementById("settings-show-tools-status");
    if (!checkbox) return;
    const KEY = "downloaderToolsStatusHidden";
    const syncFromStore = () => {
      try {
        checkbox.checked = localStorage.getItem(KEY) !== "1";
      } catch {
        checkbox.checked = true;
      }
    };
    syncFromStore();
    checkbox.addEventListener("change", () => {
      const hidden = !checkbox.checked;
      try {
        if (hidden) localStorage.setItem(KEY, "1");
        else localStorage.removeItem(KEY);
      } catch {}
      window.dispatchEvent(
        new CustomEvent("tools:visibility", { detail: { hidden } }),
      );
    });
    window.addEventListener("tools:visibility", (ev) => {
      const hidden = ev?.detail?.hidden === true;
      checkbox.checked = !hidden;
    });
  })();

  // === Tools location (yt-dlp, ffmpeg) — UI bindings ===
}

function deepMergeConfig(base, override) {
  const isObj = (v) => v && typeof v === "object" && !Array.isArray(v);
  const result = { ...base };
  Object.entries(override || {}).forEach(([key, val]) => {
    if (isObj(val) && isObj(base[key])) {
      result[key] = deepMergeConfig(base[key], val);
    } else if (val !== undefined) {
      result[key] = val;
    }
  });
  return result;
}

async function collectCurrentConfig() {
  const [
    theme,
    fontSize,
    autoLaunch,
    minimizeOnLaunch,
    closeNotification,
    disableGlobalShortcuts,
    openOnCopyUrl,
    expandWindowOnDownloadComplete,
    minimizeInsteadOfClose,
    disableCompleteModal,
    defaultTab,
    minimizeToTray,
    autoShutdownEnabled,
    autoShutdownSeconds,
    toolsLocation,
  ] = await Promise.all([
    getTheme(),
    getFontSize(),
    window.electron.invoke("get-auto-launch-status"),
    window.electron.invoke("get-minimize-on-launch-status"),
    window.electron.invoke("get-close-notification-status"),
    window.electron.invoke("get-disable-global-shortcuts-status"),
    window.electron.invoke("get-open-on-copy-url-status"),
    window.electron.invoke("get-open-on-download-complete-status"),
    window.electron.invoke("get-minimize-instead-of-close-status"),
    window.electron.invoke("get-disable-complete-modal-status"),
    getDefaultTab(),
    window.electron.invoke("get-minimize-to-tray-status").catch(() => false),
    window.electron.invoke("get-auto-shutdown-status").catch(() => false),
    window.electron.invoke("get-auto-shutdown-seconds").catch(() => 30),
    window.electron.tools?.getLocation?.().catch(() => null),
  ]);

  const qualityProfile = (() => {
    try {
      return (
        localStorage.getItem(QUALITY_PROFILE_KEY) || QUALITY_PROFILE_DEFAULT
      );
    } catch {
      return QUALITY_PROFILE_DEFAULT;
    }
  })();

  const showToolsStatus = (() => {
    try {
      return localStorage.getItem("downloaderToolsStatusHidden") !== "1";
    } catch {
      return true;
    }
  })();
  const firstRunCompleted = (() => {
    try {
      return localStorage.getItem("firstRunCompleted") === "1";
    } catch {
      return false;
    }
  })();

  const readJsonFlag = (key, defVal) => {
    try {
      const raw = localStorage.getItem(key);
      if (raw === null) return defVal;
      return JSON.parse(raw) === true;
    } catch {
      return defVal;
    }
  };

  const backupViewMode = (() => {
    try {
      const raw = localStorage.getItem("bk_view_mode");
      const parsed = raw ? JSON.parse(raw) : "full";
      return parsed === "compact" ? "compact" : "full";
    } catch {
      return "full";
    }
  })();

  const backupLogVisible = (() => {
    try {
      const raw = localStorage.getItem("bk_log_visible");
      if (raw === null) return true;
      return JSON.parse(raw) !== false;
    } catch {
      return true;
    }
  })();

  let wgAutosend = false;
  try {
    const cfg = await window.electron?.ipcRenderer?.invoke?.("wg-get-config");
    if (cfg && typeof cfg.autosend !== "undefined") {
      wgAutosend = !!cfg.autosend;
    }
  } catch {}

  const merged = deepMergeConfig(DEFAULT_CONFIG, {
    general: {
      autoLaunch,
      minimizeOnLaunch,
      minimizeInsteadOfClose,
      minimizeToTray,
      closeNotification,
      firstRunCompleted,
    },
    window: {
      defaultTab,
      expandWindowOnDownloadComplete,
      openOnCopyUrl,
      disableCompleteModal,
      downloadQualityProfile: qualityProfile,
      showToolsStatus,
    },
    appearance: {
      theme,
      fontSize,
      lowEffects: getLowEffects(),
    },
    shortcuts: {
      disableGlobalShortcuts,
    },
    modules: {
      wgUnlockDisabled: readJsonFlag("wgUnlockDisabled", true),
      backupDisabled: readJsonFlag("backupDisabled", false),
    },
    backup: {
      viewMode: backupViewMode,
      logVisible: backupLogVisible,
    },
    wg: {
      autoShutdownEnabled,
      autoShutdownSeconds,
      autosend: wgAutosend,
      rememberLastTool: readJsonFlag(WG_REMEMBER_LAST_TOOL_KEY, false),
    },
    tools: {
      resetLocation: false,
      locationPath: toolsLocation?.path || null,
      isDefault: toolsLocation?.isDefault ?? null,
    },
  });

  return merged;
}

async function applyConfig(config, options = {}) {
  const cfg = deepMergeConfig(DEFAULT_CONFIG, config || {});
  try {
    localStorage.removeItem("topbarNetworkStatusVisible");
  } catch {}

  await setTheme(cfg.appearance.theme);
  await setFontSize(String(cfg.appearance.fontSize));
  setLowEffects(!!cfg.appearance.lowEffects);

  try {
    localStorage.setItem(
      QUALITY_PROFILE_KEY,
      cfg.window.downloadQualityProfile || QUALITY_PROFILE_DEFAULT,
    );
  } catch {}

  try {
    if (cfg.window.showToolsStatus) {
      localStorage.removeItem("downloaderToolsStatusHidden");
    } else {
      localStorage.setItem("downloaderToolsStatusHidden", "1");
    }
  } catch {}

  const writeJson = (key, value) => {
    try {
      localStorage.setItem(key, JSON.stringify(value));
    } catch {}
  };
  try {
    localStorage.setItem(
      "firstRunCompleted",
      cfg.general.firstRunCompleted ? "1" : "0",
    );
  } catch {}

  writeJson("wgUnlockDisabled", !!cfg.modules.wgUnlockDisabled);
  writeJson("backupDisabled", !!cfg.modules.backupDisabled);
  writeJson(
    "bk_view_mode",
    cfg.backup.viewMode === "compact" ? "compact" : "full",
  );
  writeJson("bk_log_visible", !!cfg.backup.logVisible);
  writeJson(WG_REMEMBER_LAST_TOOL_KEY, !!cfg.wg.rememberLastTool);

  try {
    window.electron?.ipcRenderer?.send?.("wg-set-config", {
      key: "autosend",
      val: !!cfg.wg.autosend,
    });
  } catch {}

  const ipcTasks = [
    window.electron.invoke("toggle-auto-launch", !!cfg.general.autoLaunch),
    window.electron.invoke(
      "set-minimize-on-launch-status",
      !!cfg.general.minimizeOnLaunch,
    ),
    window.electron.invoke(
      "set-close-notification-status",
      !!cfg.general.closeNotification,
    ),
    window.electron.invoke(
      "set-disable-global-shortcuts-status",
      !!cfg.shortcuts.disableGlobalShortcuts,
    ),
    window.electron.invoke(
      "set-open-on-copy-url-status",
      !!cfg.window.openOnCopyUrl,
    ),
    window.electron.invoke(
      "set-open-on-download-complete-status",
      !!cfg.window.expandWindowOnDownloadComplete,
    ),
    window.electron.invoke(
      "set-minimize-instead-of-close",
      !!cfg.general.minimizeInsteadOfClose,
    ),
    setDefaultTab(cfg.window.defaultTab),
    window.electron.invoke(
      "set-disable-complete-modal-status",
      !!cfg.window.disableCompleteModal,
    ),
    window.electron.invoke(
      "set-minimize-to-tray-status",
      !!cfg.general.minimizeToTray,
    ),
  ];

  await Promise.all(ipcTasks);

  await window.electron
    .invoke(
      "set-auto-shutdown-seconds",
      Number(cfg.wg.autoShutdownSeconds) || 30,
    )
    .catch(() => {});
  await window.electron
    .invoke("set-auto-shutdown-status", !!cfg.wg.autoShutdownEnabled)
    .catch(() => {});

  if (options.forceToolsReset || cfg.tools.resetLocation) {
    try {
      await window.electron.tools?.resetLocation?.();
    } catch {}
  } else if (cfg.tools.locationPath) {
    try {
      await window.electron.tools?.setLocation?.(cfg.tools.locationPath);
    } catch {}
  }

  if (options.refreshToolsInfo) {
    try {
      await ensureToolsInfo(true);
    } catch {}
  }
}

export async function exportConfig() {
  const config = await collectCurrentConfig();

  const blob = new Blob([JSON.stringify(config, null, 2)], {
    type: "application/json",
  });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = "config.json";
  a.click();
  window.electron.invoke(
    "toast",
    t("settings.config.export.success"),
    "success",
  );
  setTimeout(() => {
    window.electron.invoke("toast", t("settings.config.export.hint"), "info");
  }, 3000);
  URL.revokeObjectURL(url);
}

export async function importConfig(file) {
  const text = await file.text();
  try {
    const config = JSON.parse(text);

    const current = await collectCurrentConfig();
    const changes = [];
    const walk = (a, b, p = []) => {
      const keys = new Set([...Object.keys(a || {}), ...Object.keys(b || {})]);
      for (const k of keys) {
        const pa = [...p, k];
        const va = a ? a[k] : undefined;
        const vb = b ? b[k] : undefined;
        const isObj = (v) => v && typeof v === "object" && !Array.isArray(v);
        if (isObj(va) || isObj(vb)) walk(va || {}, vb || {}, pa);
        else if (JSON.stringify(va) !== JSON.stringify(vb))
          changes.push({ path: pa.join("."), from: va, to: vb });
      }
    };
    walk(current, config);

    const previewItems = changes
      .slice(0, 50)
      .map(
        (c) =>
          `<li><code>${c.path}</code>: <em>${JSON.stringify(c.from)}</em> → <strong>${JSON.stringify(c.to)}</strong></li>`,
      )
      .join("");
    const moreNote =
      changes.length > 50
        ? `<li>${t("settings.config.import.more", { count: changes.length - 50 })}</li>`
        : "";

    const html = `
      <div class="toast-message">
        <p>${t("settings.config.import.confirm", { count: changes.length })}</p>
        <ul>${previewItems}${moreNote}</ul>
      </div>`;

    showConfirmationDialog(html, async () => {
      try {
        const backup = new Blob([JSON.stringify(current, null, 2)], {
          type: "application/json",
        });
        const url = URL.createObjectURL(backup);
        const a = document.createElement("a");
        const stamp = new Date()
          .toISOString()
          .replace(/[:T]/g, "-")
          .slice(0, 19);
        a.href = url;
        a.download = `config.backup-${stamp}.json`;
        a.click();
        setTimeout(() => URL.revokeObjectURL(url), 0);
      } catch {}

      await applyConfig(config, {
        forceToolsReset: config?.tools?.resetLocation === true,
        refreshToolsInfo: true,
      });

      await window.electron.invoke(
        "toast",
        t("settings.config.import.success"),
        "success",
      );
      location.reload();
    });
  } catch (e) {
    alert(t("settings.config.import.error", { error: e.message }));
  }
}

export async function resetConfigToDefaults() {
  await applyConfig(DEFAULT_CONFIG, {
    forceToolsReset: true,
    refreshToolsInfo: true,
  });
  await window.electron.invoke("toast", t("settings.reset.success"), "success");
  location.reload();
}

export const getDefaultTab = () => window.electron.invoke("get-default-tab");
export const setDefaultTab = (tabId) =>
  window.electron.invoke("set-default-tab", normalizeDefaultTabId(tabId));

// Тестовая прокладка для unit-тестов
export const __test_updateModuleBadge = updateModuleBadge;
export const __test_collectCurrentConfig = collectCurrentConfig;
export const __test_applyConfig = applyConfig;
export { updateModuleBadge };

export { initSettings };
