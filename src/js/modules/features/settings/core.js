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
import { t } from "../../i18n.js";
import {
  DEFAULT_CONFIG,
  DEFAULT_PLAYER_SETTINGS,
  QUALITY_PROFILE_DEFAULT,
  QUALITY_PROFILE_KEY,
} from "./defaults.js";
import { getDefaultTab, setDefaultTab } from "./defaultTabStore.js";
import {
  clearOpenSettingsHandlers,
  onOpenSettings,
} from "./openSettingsBus.js";
import { initDeveloperToolsGate } from "./developerToolsGate.js";
import { initDownloadQualityProfileSettings } from "./downloadQualityProfileSettings.js";
import { initLanguageDropdown } from "./languageDropdown.js";
import {
  initAccessibleDropdown,
  syncAccessibleDropdownSelection,
} from "./accessibleDropdown.js";
import {
  initYtDlpCookiesSettings,
  normalizeYtDlpCookiesSettings,
  YTDLP_COOKIES_DEFAULT,
} from "./ytDlpCookiesSettings.js";
import { initWebControlSettings } from "./webControlSettings.js";
import {
  initPlayerSettings,
  normalizePlayerSettings,
} from "./playerSettings.js";
import { applyPlayerSettings } from "../../nowPlaying/settingsEvents.js";

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

  initDeveloperToolsGate();

  initDownloadQualityProfileSettings();
  initPlayerSettings();

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

  initYtDlpCookiesSettings();
  initWebControlSettings();

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
    syncAccessibleDropdownSelection(fontSizeDropdownMenu, savedSize);
    initAccessibleDropdown(fontSizeDropdownBtn, fontSizeDropdownMenu);

    fontSizeDropdownMenu.querySelectorAll("li").forEach((item) => {
      item.addEventListener("click", async () => {
        const newSize = item.getAttribute("data-value");
        localStorage.setItem("fontSize", newSize);
        fontSizeLabel.textContent = `${newSize} px`;
        // Highlight selected font size in dropdown
        syncAccessibleDropdownSelection(fontSizeDropdownMenu, newSize);
        await setFontSize(newSize);
        fontSizeDropdownMenu.classList.remove("show");
        fontSizeDropdownBtn.setAttribute("aria-expanded", "false");
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
  }
  if (resetFontSizeBtn && fontSizeLabel) {
    resetFontSizeBtn.addEventListener("click", async () => {
      const defaultSize = "16";
      localStorage.setItem("fontSize", defaultSize);
      fontSizeLabel.textContent = `${defaultSize} px`;
      syncAccessibleDropdownSelection(fontSizeDropdownMenu, defaultSize);
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
  const themeOptions = ["dark", "midnight", "emerald", "sunset", "violet"];
  const normalizeTheme = (theme) =>
    theme === "system" || !theme || !themeOptions.includes(theme)
      ? "dark"
      : theme;
  const formatThemeLabel = (theme) => {
    const normalizedTheme = normalizeTheme(theme);
    const map = {
      dark: t("settings.appearance.theme.dark"),
      midnight: t("settings.appearance.theme.midnight"),
      emerald: t("settings.appearance.theme.emerald"),
      sunset: t("settings.appearance.theme.sunset"),
      violet: t("settings.appearance.theme.violet"),
    };
    return map[normalizedTheme] || normalizedTheme;
  };
  const syncThemeDropdownState = (theme) => {
    const normalizedTheme = normalizeTheme(theme);

    themeLabel.textContent = formatThemeLabel(normalizedTheme);
    syncAccessibleDropdownSelection(themeDropdownMenu, normalizedTheme);
    themeDropdownBtn.setAttribute("data-current-theme", normalizedTheme);
  };

  console.log("Тема: ", { themeDropdownBtn, themeDropdownMenu, themeLabel });
  if (themeDropdownBtn && themeDropdownMenu && themeLabel) {
    const savedTheme = await getTheme();
    document.documentElement.setAttribute("data-theme", savedTheme);
    syncThemeDropdownState(savedTheme);

    initAccessibleDropdown(themeDropdownBtn, themeDropdownMenu);

    themeDropdownMenu.querySelectorAll("li").forEach((item) => {
      item.addEventListener("click", async () => {
        const selectedTheme = item.getAttribute("data-value");
        document.documentElement.classList.add("theme-transition");
        await setTheme(selectedTheme);
        syncThemeDropdownState(selectedTheme);
        themeDropdownMenu.classList.remove("show");
        themeDropdownBtn.setAttribute("aria-expanded", "false");
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
  }
  // Глобальный обработчик закрытия всех dropdown-меню, не мешает кастомным выпадающим меню
  document.addEventListener("click", (e) => {
    const dropdowns = document.querySelectorAll(".dropdown-menu");
    dropdowns.forEach((menu) => {
      const button = menu.previousElementSibling;
      if (!menu.contains(e.target) && !(button && button.contains(e.target))) {
        menu.classList.remove("show");
        button?.setAttribute("aria-expanded", "false");
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
    settingsDisableGlobalShortcutsToggle.addEventListener("change", async () => {
      const enable = settingsDisableGlobalShortcutsToggle.checked;
      try {
        const result = await window.electron.invoke(
          "set-disable-global-shortcuts-status",
          enable,
        );
        if (result?.success === false) {
          throw new Error(result.error || "Unable to update global shortcuts");
        }
        console.log(
          `Отключение глобальных горячих клавиш ${enable ? "включено" : "отключено"}`,
        );
      } catch (error) {
        settingsDisableGlobalShortcutsToggle.checked = !enable;
        console.error(
          "Ошибка при изменении состояния глобальных горячих клавиш:",
          error,
        );
        showToast(t("settings.shortcuts.error"), "error");
      }
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

  // Переключатель отображения статуса инструментов в шапке Загрузчика
  (function initAutoOpenQualityModalToggle() {
    const checkbox = document.getElementById(
      "settings-auto-open-quality-modal",
    );
    if (!checkbox) return;
    const KEY = "downloadAutoOpenQualityModal";
    const syncFromStore = () => {
      try {
        checkbox.checked = localStorage.getItem(KEY) !== "0";
      } catch {
        checkbox.checked = true;
      }
    };
    syncFromStore();
    checkbox.addEventListener("change", () => {
      const enabled = checkbox.checked;
      try {
        if (enabled) localStorage.removeItem(KEY);
        else localStorage.setItem(KEY, "0");
      } catch {}
      window.dispatchEvent(
        new CustomEvent("download:auto-quality-modal-changed", {
          detail: { enabled },
        }),
      );
    });
    window.addEventListener("download:auto-quality-modal-changed", (ev) => {
      checkbox.checked = ev?.detail?.enabled !== false;
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
    toolsLocation,
    ytDlpCookies,
    shortcutsState,
    playerState,
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
    window.electron.tools?.getLocation?.().catch(() => null),
    window.electron
      .invoke("get-ytdlp-cookies-settings")
      .catch(() => YTDLP_COOKIES_DEFAULT),
    window.electron.invoke("shortcuts:get").catch(() => null),
    Promise.resolve(window.electron.nowPlaying?.getState?.()).catch(() => null),
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
  const autoOpenQualityModal = (() => {
    try {
      return localStorage.getItem("downloadAutoOpenQualityModal") !== "0";
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
      autoOpenQualityModal,
      showToolsStatus,
    },
    appearance: {
      theme,
      fontSize,
      lowEffects: getLowEffects(),
    },
    player: normalizePlayerSettings(
      playerState?.success === false
        ? DEFAULT_PLAYER_SETTINGS
        : playerState?.data || playerState || DEFAULT_PLAYER_SETTINGS,
    ),
    shortcuts: {
      disableGlobalShortcuts,
      assignments:
        shortcutsState?.success !== false &&
        shortcutsState?.assignments &&
        typeof shortcutsState.assignments === "object"
          ? { ...shortcutsState.assignments }
          : {},
    },
    tools: {
      resetLocation: false,
      locationPath: toolsLocation?.path || null,
      isDefault: toolsLocation?.isDefault ?? null,
    },
    ytDlp: {
      cookies: normalizeYtDlpCookiesSettings(ytDlpCookies),
    },
  });

  return merged;
}

async function applyConfig(config, options = {}) {
  const importedShortcuts = config?.shortcuts;
  const hasShortcutAssignments =
    importedShortcuts &&
    Object.prototype.hasOwnProperty.call(importedShortcuts, "assignments") &&
    importedShortcuts.assignments !== null;
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
    if (cfg.window.autoOpenQualityModal) {
      localStorage.removeItem("downloadAutoOpenQualityModal");
    } else {
      localStorage.setItem("downloadAutoOpenQualityModal", "0");
    }
  } catch {}

  try {
    if (cfg.window.showToolsStatus) {
      localStorage.removeItem("downloaderToolsStatusHidden");
    } else {
      localStorage.setItem("downloaderToolsStatusHidden", "1");
    }
  } catch {}

  try {
    localStorage.setItem(
      "firstRunCompleted",
      cfg.general.firstRunCompleted ? "1" : "0",
    );
  } catch {}

  try {
    localStorage.removeItem("developerDisableDownloaderTab");
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
    window.electron.invoke(
      "set-ytdlp-cookies-settings",
      normalizeYtDlpCookiesSettings(cfg.ytDlp?.cookies),
    ),
  ];

  await Promise.all(ipcTasks);

  const playerSettings = normalizePlayerSettings(cfg.player);
  const playerResult = await window.electron.nowPlaying?.updateSettings?.(
    playerSettings,
  );
  if (playerResult?.success === false) {
    throw new Error(
      playerResult.error?.message || t("settings.player.saveError"),
    );
  }
  applyPlayerSettings(playerResult?.data || playerSettings);

  const assertShortcutResult = (result) => {
    if (result?.success !== false) return result;
    const error = new Error(
      result.message ||
        result.error ||
        result.code ||
        "Unable to apply shortcuts",
    );
    error.code = result.code || result.error;
    error.details = result;
    throw error;
  };

  const disableGlobalShortcuts = !!cfg.shortcuts.disableGlobalShortcuts;
  if (disableGlobalShortcuts) {
    assertShortcutResult(
      await window.electron.invoke(
        "set-disable-global-shortcuts-status",
        true,
      ),
    );
  }

  const shortcutsResult = await window.electron.invoke(
    hasShortcutAssignments ? "shortcuts:replace" : "shortcuts:reset",
    hasShortcutAssignments
      ? { assignments: cfg.shortcuts.assignments }
      : undefined,
  );
  assertShortcutResult(shortcutsResult);

  if (!disableGlobalShortcuts) {
    assertShortcutResult(
      await window.electron.invoke(
        "set-disable-global-shortcuts-status",
        false,
      ),
    );
  }

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
      window.dispatchEvent(
        new CustomEvent("tools:refresh-info", {
          detail: { force: true, source: "settings" },
        }),
      );
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

      try {
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
      } catch (error) {
        console.error("[settings] Failed to import configuration:", error);
        alert(
          t("settings.config.import.error", {
            error: error?.message || String(error),
          }),
        );
      }
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

export const __test_collectCurrentConfig = collectCurrentConfig;
export const __test_applyConfig = applyConfig;

export { getDefaultTab, initSettings, setDefaultTab };
