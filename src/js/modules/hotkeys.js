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

const MAC_DISPLAY = {
  Ctrl: "⌃",
  Shift: "⇧",
  Alt: "⌥",
  Meta: "⌘",
};

const isMac = navigator.platform.toUpperCase().includes("MAC");

import {
  downloadButton,
  openFolderButton,
  openHistoryButton,
  openLastVideoButton,
  clearHistoryButton,
  shortcutsModal,
  whatsNewModal,
  confirmationModal,
  toggleBtn,
  settingsModal,
} from "./domElements.js";
import { updateThemeDropdownUI } from "./settingsModal.js";
import { showToast } from "./toast.js";
import {
  hideSidebar,
  toggleSidebar,
  toggleCollapsed,
  openSettings,
  closeSettings,
} from "./sidebar.js";
import { closeAllModals } from "./modalManager.js"; // Импортируем функцию закрытия всех модалов

// Список всех модальных окон
const modals = [
  shortcutsModal,
  whatsNewModal,
  confirmationModal,
  settingsModal,
  // Добавьте другие модальные окна здесь
];

// Определяем список локальных горячих клавиш
const localHotkeys = new Map([
  [
    "Ctrl+Alt+B",
    () => {
      toggleCollapsed();
    },
  ],
  [
    "Meta+Alt+B",
    () => {
      toggleCollapsed();
    },
  ],
  [
    "Ctrl+1",
    () => {
      if (tabSystemReference) {
        tabSystemReference.activateTab("download");
        console.log("Переключено на вкладку Downloader (Ctrl+1)");
      }
    },
  ],
  [
    "Meta+1",
    () => {
      if (tabSystemReference) {
        tabSystemReference.activateTab("download");
        console.log("Переключено на вкладку Downloader (Meta+1)");
      }
    },
  ],
  [
    "Ctrl+2",
    () => {
      if (tabSystemReference) {
        tabSystemReference.activateTab("wireguard");
        console.log("Переключено на вкладку WG Unlock (Ctrl+2)");
      }
    },
  ],
  [
    "Meta+2",
    () => {
      if (tabSystemReference) {
        tabSystemReference.activateTab("wireguard");
        console.log("Переключено на вкладку WG Unlock (Meta+2)");
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
      hideSidebar();
    },
  ],
  [
    "Meta+D",
    () => {
      closeAllModals(modals);
      downloadButton.click();
      hideSidebar();
    },
  ],
  [
    "Ctrl+K",
    () => {
      closeAllModals(modals);
      openFolderButton.click();
      showToast("Открытие папки с последним видео.", "info");
    },
  ],
  [
    "Meta+K",
    () => {
      closeAllModals(modals);
      openFolderButton.click();
      showToast("Открытие папки с последним видео.", "info");
    },
  ],
  [
    "Ctrl+T",
    async () => {
      closeAllModals(modals);
      const order = ["system", "dark", "midnight", "sunset"]; // цикл тем с системной
      const curAttr = document.documentElement.getAttribute("data-theme");
      const cur = curAttr || localStorage.getItem("theme") || "system";
      const idx = Math.max(0, order.indexOf(cur));
      const next = order[(idx + 1) % order.length];
      document.documentElement.classList.add("theme-transition");
      if (next === "system") {
        document.documentElement.removeAttribute("data-theme");
        localStorage.removeItem("theme");
      } else {
        document.documentElement.setAttribute("data-theme", next);
        localStorage.setItem("theme", next);
      }
      updateThemeDropdownUI(next);
      await window.electron.invoke("set-theme", next);
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
      const order = ["system", "dark", "midnight", "sunset"]; // цикл тем с системной
      const curAttr = document.documentElement.getAttribute("data-theme");
      const cur = curAttr || localStorage.getItem("theme") || "system";
      const idx = Math.max(0, order.indexOf(cur));
      const next = order[(idx + 1) % order.length];
      document.documentElement.classList.add("theme-transition");
      if (next === "system") {
        document.documentElement.removeAttribute("data-theme");
        localStorage.removeItem("theme");
      } else {
        document.documentElement.setAttribute("data-theme", next);
        localStorage.setItem("theme", next);
      }
      updateThemeDropdownUI(next);
      await window.electron.invoke("set-theme", next);
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
      hideSidebar();
    },
  ],
  [
    "Meta+H",
    () => {
      closeAllModals(modals);
      openHistoryButton.click();
      hideSidebar();
    },
  ],
  [
    "Ctrl+L",
    () => {
      closeAllModals(modals);
      openLastVideoButton.click();
      showToast("Открытие последнего видео.", "info");
    },
  ],
  [
    "Meta+L",
    () => {
      closeAllModals(modals);
      openLastVideoButton.click();
      showToast("Открытие последнего видео.", "info");
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
    "Ctrl+B",
    () => {
      closeAllModals(modals);
      if (settingsModal.style.display === "flex") {
        closeSettings();
      } else {
        toggleSidebar();
        highlightToggleBtn();
      }
    },
  ],
  [
    "Meta+B",
    () => {
      closeAllModals(modals);
      if (settingsModal.style.display === "flex") {
        closeSettings();
      } else {
        toggleSidebar();
        highlightToggleBtn();
      }
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
        hideSidebar();
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
        hideSidebar();
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

/**
 * Временно подсвечивает кнопку toggle.
 */
function highlightToggleBtn() {
  toggleBtn.classList.add("highlight");
  setTimeout(() => {
    toggleBtn.classList.remove("highlight");
  }, 300); // Подсветка длится 300 мс
}

export { initHotkeys, enableHotkeys, disableHotkeys };

// Набор для предотвращения повторного срабатывания комбинаций клавиш при удержании
const pressedKeys = new Set();
