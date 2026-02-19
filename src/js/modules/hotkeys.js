// src/js/modules/hotkeys.js

let hotkeysEnabled = false;

/**
 * Модуль управления локальными горячими клавишами приложения.
 *
 * Обеспечивает нормализацию сочетаний клавиш с учётом платформы,
 * обработку событий нажатия и отпускания клавиш,
 * а также выполнение связанных с ними действий.
 */

/**
 * Модификаторы клавиш, используемые в сочетаниях.
 */
const MODIFIERS = {
  CTRL: "Ctrl",
  SHIFT: "Shift",
  ALT: "Alt",
  META: "Meta",
};

import {
  downloadButton,
  openFolderButton,
  openHistoryButton,
  openLastVideoButton,
  clearHistoryButton,
  shortcutsModal,
  whatsNewModal,
  confirmationModal,
  settingsModal,
} from "./domElements.js";
import {
  updateThemeDropdownUI,
  openSettings,
  closeSettings,
} from "./settingsModal.js";
import { setTheme } from "./settingsStore.js";
import { showToast } from "./toast.js";
import { t } from "./i18n.js";
import { closeAllModals } from "./modalManager.js"; // Импортируем функцию закрытия всех модалов

// Список всех модальных окон
const modals = [
  shortcutsModal,
  whatsNewModal,
  confirmationModal,
  settingsModal,
  // Добавьте другие модальные окна здесь
];

const THEME_ORDER = ["dark", "midnight", "sunset", "violet", "light"];

const normalizeTheme = (value) =>
  value === "system" || !value ? "dark" : value;

const getThemeLabel = (theme) => {
  const map = {
    dark: t("settings.appearance.theme.dark"),
    midnight: t("settings.appearance.theme.midnight"),
    sunset: t("settings.appearance.theme.sunset"),
    violet: t("settings.appearance.theme.violet"),
    light: t("settings.appearance.theme.light"),
  };
  return map[normalizeTheme(theme)] || theme;
};

const updateThemeToggleTooltip = (theme) => {
  const btn = document.getElementById("theme-toggle");
  if (!btn) return;
  const label = getThemeLabel(theme);
  const title = `${t("topbar.theme")}: ${label}`;
  btn.setAttribute("title", title);
  btn.setAttribute("data-bs-original-title", title);
};

// Определяем список локальных горячих клавиш
const localHotkeys = new Map([
  [
    "Ctrl+1",
    () => {
      if (tabSystemReference) {
        tabSystemReference.activateTab("download");
        console.log("Переключено на вкладку Загрузчик (Ctrl+1)");
      }
    },
  ],
  [
    "Meta+1",
    () => {
      if (tabSystemReference) {
        tabSystemReference.activateTab("download");
        console.log("Переключено на вкладку Загрузчик (Meta+1)");
      }
    },
  ],
  [
    "Ctrl+2",
    () => {
      if (tabSystemReference) {
        tabSystemReference.activateTab("wireguard");
        console.log("Переключено на вкладку Tools (Ctrl+2)");
      }
    },
  ],
  [
    "Meta+2",
    () => {
      if (tabSystemReference) {
        tabSystemReference.activateTab("wireguard");
        console.log("Переключено на вкладку Tools (Meta+2)");
      }
    },
  ],
  [
    "Ctrl+3",
    () => {
      if (tabSystemReference) {
        tabSystemReference.activateTab("backup");
        console.log("Переключено на вкладку Backup (Ctrl+3)");
      }
    },
  ],
  [
    "Meta+3",
    () => {
      if (tabSystemReference) {
        tabSystemReference.activateTab("backup");
        console.log("Переключено на вкладку Backup (Meta+3)");
      }
    },
  ],
  [
    "Ctrl+D",
    () => {
      closeAllModals(modals);
      downloadButton.click();
    },
  ],
  [
    "Meta+D",
    () => {
      closeAllModals(modals);
      downloadButton.click();
    },
  ],
  [
    "Ctrl+K",
    () => {
      closeAllModals(modals);
      openFolderButton.click();
      showToast(t("hotkeys.openLastFolder"), "info");
    },
  ],
  [
    "Meta+K",
    () => {
      closeAllModals(modals);
      openFolderButton.click();
      showToast(t("hotkeys.openLastFolder"), "info");
    },
  ],
  [
    "Ctrl+T",
    async () => {
      closeAllModals(modals);
      const curAttr = document.documentElement.getAttribute("data-theme");
      const cur = normalizeTheme(curAttr || localStorage.getItem("theme"));
      const idx = Math.max(0, THEME_ORDER.indexOf(cur));
      const next = THEME_ORDER[(idx + 1) % THEME_ORDER.length];
      document.documentElement.classList.add("theme-transition");
      await setTheme(next);
      updateThemeDropdownUI(next);
      updateThemeToggleTooltip(next);
      setTimeout(
        () => document.documentElement.classList.remove("theme-transition"),
        260,
      );
    },
  ],
  [
    "Meta+T",
    async () => {
      closeAllModals(modals);
      const curAttr = document.documentElement.getAttribute("data-theme");
      const cur = normalizeTheme(curAttr || localStorage.getItem("theme"));
      const idx = Math.max(0, THEME_ORDER.indexOf(cur));
      const next = THEME_ORDER[(idx + 1) % THEME_ORDER.length];
      document.documentElement.classList.add("theme-transition");
      await setTheme(next);
      updateThemeDropdownUI(next);
      updateThemeToggleTooltip(next);
      setTimeout(
        () => document.documentElement.classList.remove("theme-transition"),
        260,
      );
    },
  ],
  [
    "Ctrl+H",
    () => {
      closeAllModals(modals);
      openHistoryButton.click();
    },
  ],
  [
    "Meta+H",
    () => {
      closeAllModals(modals);
      openHistoryButton.click();
    },
  ],
  [
    "Ctrl+L",
    () => {
      closeAllModals(modals);
      openLastVideoButton.click();
      showToast(t("hotkeys.openLastVideo"), "info");
    },
  ],
  [
    "Meta+L",
    () => {
      closeAllModals(modals);
      openLastVideoButton.click();
      showToast(t("hotkeys.openLastVideo"), "info");
    },
  ],
  [
    "Ctrl+M",
    () => {
      closeAllModals(modals);
      clearHistoryButton.click();
    },
  ],
  [
    "Meta+M",
    () => {
      closeAllModals(modals);
      clearHistoryButton.click();
    },
  ],
  [
    "Ctrl+,",
    () => {
      closeAllModals(modals);
      if (settingsModal.style.display === "flex") {
        closeSettings();
      } else {
        openSettings();
      }
    },
  ],
  [
    "Meta+,",
    () => {
      closeAllModals(modals);
      if (settingsModal.style.display === "flex") {
        closeSettings();
      } else {
        openSettings();
      }
    },
  ],
  [
    "Ctrl+P",
    () => {
      closeAllModals(modals);
      if (shortcutsModal.style.display === "flex") {
        shortcutsModal.style.display = "none";
      } else {
        shortcutsModal.style.display =
          shortcutsModal.style.display === "block" ? "none" : "flex";
        shortcutsModal.style.flexWrap = "wrap";
        shortcutsModal.style.justifyContent = "center";
        shortcutsModal.style.alignItems = "center";
      }
    },
  ],
  [
    "Meta+P",
    () => {
      closeAllModals(modals);
      if (shortcutsModal.style.display === "flex") {
        shortcutsModal.style.display = "none";
      } else {
        shortcutsModal.style.display =
          shortcutsModal.style.display === "block" ? "none" : "flex";
        shortcutsModal.style.flexWrap = "wrap";
        shortcutsModal.style.justifyContent = "center";
        shortcutsModal.style.alignItems = "center";
      }
    },
  ],
]);

/**
 * Проверяет и добавляет ключ в массив, если условие истинно и ключ ещё не добавлен.
 * @param {string[]} keys - Массив текущих ключей.
 * @param {boolean} condition - Условие для добавления ключа.
 * @param {string} keyName - Ключ для добавления.
 */
function addKeyIfNotPresent(keys, condition, keyName) {
  if (condition && !keys.includes(keyName)) {
    keys.push(keyName);
  }
}

/**
 * Нормализует комбинацию нажатых клавиш в строку для сопоставления.
 * @param {KeyboardEvent} event - Событие нажатия клавиши.
 * @returns {string} Нормализованная строка комбинации клавиш.
 */
const normalizeKeyCombo = (event) => {
  let keys = [];

  // Добавляем модификаторы, если они нажаты
  addKeyIfNotPresent(keys, event.ctrlKey, MODIFIERS.CTRL);
  addKeyIfNotPresent(keys, event.shiftKey, MODIFIERS.SHIFT);
  addKeyIfNotPresent(keys, event.altKey, MODIFIERS.ALT);
  addKeyIfNotPresent(keys, event.metaKey, MODIFIERS.META);

  const key = event.key.toUpperCase();
  // Добавляем основной ключ, если это не модификатор
  if (
    !Object.values(MODIFIERS)
      .map((k) => k.toUpperCase())
      .includes(key)
  ) {
    keys.push(key);
  }

  // Убрано преобразование для отображения символов, возвращаем текстовые имена модификаторов

  return keys.join("+");
};

/**
 * Обработчик события нажатия клавиши.
 * @param {KeyboardEvent} event
 */
const handleKeyDown = (event) => {
  try {
    if (event.repeat) return; // Игнорируем повторные события при удержании клавиши

    const activeElement = document.activeElement;
    const isInputFocused =
      ["INPUT", "TEXTAREA"].includes(activeElement.tagName) ||
      activeElement.isContentEditable;

    if (isInputFocused) {
      return; // Не обрабатываем горячие клавиши, если фокус на вводе
    }

    const keyCombo = normalizeKeyCombo(event);

    // Проверяем, была ли уже обработана эта комбинация
    if (pressedKeys.has(keyCombo)) {
      return;
    }

    // Добавляем комбинацию в Set для предотвращения повторного срабатывания
    pressedKeys.add(keyCombo);

    // Проверяем, есть ли действие для этой комбинации
    if (localHotkeys.has(keyCombo)) {
      event.preventDefault(); // Предотвращаем дефолтное поведение
      localHotkeys.get(keyCombo)();
      console.log(`Local hotkey: ${keyCombo}`);
    }
  } catch (error) {
    console.error("Error handling keydown event:", error);
  }
};

/**
 * Обработчик события отпускания клавиши.
 * @param {KeyboardEvent} event
 */
const handleKeyUp = (event) => {
  const keyCombo = normalizeKeyCombo(event);
  // Удаляем комбинацию из Set, чтобы она могла быть обработана снова
  pressedKeys.delete(keyCombo);
};

let tabSystemReference = null;

/**
 * Инициализирует обработчики горячих клавиш.
 * @param {object} tabsInstance - Экземпляр системы вкладок.
 */
const initHotkeys = (tabsInstance) => {
  tabSystemReference = tabsInstance;
  enableHotkeys();
};

/**
 * Включает обработку горячих клавиш.
 */
function enableHotkeys() {
  if (hotkeysEnabled) return;
  document.addEventListener("keydown", handleKeyDown);
  document.addEventListener("keyup", handleKeyUp);
  hotkeysEnabled = true;
}

/**
 * Отключает обработку горячих клавиш.
 */
function disableHotkeys() {
  if (!hotkeysEnabled) return;
  document.removeEventListener("keydown", handleKeyDown);
  document.removeEventListener("keyup", handleKeyUp);
  pressedKeys.clear(); // очищаем кэш комбинаций
  hotkeysEnabled = false;
}

export { initHotkeys, enableHotkeys, disableHotkeys };

// Набор для предотвращения повторного срабатывания комбинаций клавиш при удержании
const pressedKeys = new Set();
