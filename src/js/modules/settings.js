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
} from "./domElements.js";

import { getTheme } from "./themeManager.js";
import { getFontSize, setFontSize } from "./fontSizeManager.js";
import { renderToolsInfo } from "./toolsInfo.js";

/**
 * Функция для инициализации настроек
 */
function initSettings() {
  // Font size dropdown (custom) logic
  const openConfigFolderBtn = document.getElementById(
    "open-config-folder-button",
  );
  if (openConfigFolderBtn) {
    openConfigFolderBtn.addEventListener("click", () => {
      window.electron.invoke("open-config-folder");
    });
  }
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
        window.electron.invoke(
          "toast",
          `<strong>Размер шрифта</strong> установлен на <strong>${newSize}px</strong>`,
          "success",
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
      // Обновляем активный элемент в выпадающем меню
      fontSizeDropdownMenu.querySelectorAll("li").forEach((li) => {
        li.classList.remove("active");
        if (li.getAttribute("data-value") === defaultSize) {
          li.classList.add("active");
        }
      });
      document.documentElement.style.setProperty(
        "--font-size",
        `${defaultSize}px`,
      );
      document.body.style.setProperty("--font-size", `${defaultSize}px`);
      await window.electron.invoke("set-font-size", defaultSize);
      window.electron.invoke(
        "toast",
        `<strong>Размер шрифта</strong> сброшен на <strong>${defaultSize}px</strong>`,
        "success",
      );
    });
  }

  // Theme dropdown logic (custom dropdown, not native select)
  const themeDropdownBtn = document.getElementById("theme-dropdown-btn");
  const themeDropdownMenu = document.getElementById("theme-dropdown-menu");
  const themeLabel = document.getElementById("theme-selected-label");

  // Лог и гарантия наличия элементов
  console.log("Тема: ", { themeDropdownBtn, themeDropdownMenu, themeLabel });
  if (themeDropdownBtn && themeDropdownMenu && themeLabel) {
    const savedTheme = localStorage.getItem("theme") || "dark";
    document.documentElement.setAttribute("data-theme", savedTheme);
    themeLabel.textContent =
      savedTheme === "light"
        ? "Light Sky"
        : savedTheme.charAt(0).toUpperCase() + savedTheme.slice(1);
    // Highlight selected theme in dropdown on init
    themeDropdownMenu.querySelectorAll("li").forEach((item) => {
      item.classList.remove("active");
      if (item.getAttribute("data-value") === savedTheme) {
        item.classList.add("active");
      }
    });

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
        localStorage.setItem("theme", selectedTheme);
        themeLabel.textContent =
          selectedTheme === "light"
            ? "Light Sky"
            : selectedTheme.charAt(0).toUpperCase() + selectedTheme.slice(1);
        // Highlight selected theme in dropdown
        themeDropdownMenu
          .querySelectorAll("li")
          .forEach((li) => li.classList.remove("active"));
        item.classList.add("active");
        document.documentElement.setAttribute("data-theme", selectedTheme);
        themeDropdownMenu.classList.remove("show");
        await window.electron.invoke("set-theme", selectedTheme);
        window.electron.invoke(
          "toast",
          `Выбрана тема: <strong>${themeLabel.textContent}</strong>`,
          "success",
        );
      });
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
      const defaultTheme = "dark";
      localStorage.setItem("theme", defaultTheme);
      themeLabel.textContent = "Dark";
      // Обновляем активный элемент в выпадающем меню
      themeDropdownMenu.querySelectorAll("li").forEach((li) => {
        li.classList.remove("active");
        if (li.getAttribute("data-value") === defaultTheme) {
          li.classList.add("active");
        }
      });
      document.documentElement.setAttribute("data-theme", defaultTheme);
      themeDropdownMenu.classList.remove("show");
      await window.electron.invoke("set-theme", defaultTheme);
      window.electron.invoke(
        "toast",
        `<strong>Тема</strong> сброшена на <strong> ${defaultTheme} </strong>`,
        "success",
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
  settingsCloseToTrayRadio.addEventListener("change", () => {
    if (settingsCloseToTrayRadio.checked) {
      window.electron.invoke("set-minimize-instead-of-close", true);
    }
  });

  settingsCloseAppRadio.addEventListener("change", () => {
    if (settingsCloseAppRadio.checked) {
      window.electron.invoke("set-minimize-instead-of-close", false);
    }
  });

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
            ? "Модальное окно после загрузки <strong>отключено</strong>"
            : "Модальное окно после загрузки <strong>включено</strong>";
          window.electron.invoke("toast", message, "success");
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

  // Отрисовать версии инструментов при загрузке настроек
  renderToolsInfo();

  // Обновлять блок версий при каждом открытии настроек
  window.electron.on("open-settings", () => {
    renderToolsInfo();
  });
}

export async function exportConfig() {
  // Параллельно получаем все необходимые настройки:
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
  ]);

  // Формируем объект конфигурации
  const config = {
    general: {
      autoLaunch,
      minimizeOnLaunch,
      minimizeInsteadOfClose,
    },
    window: {
      defaultTab,
      expandWindowOnDownloadComplete,
    },
    appearance: {
      theme,
      fontSize,
    },
    notifications: {
      closeNotification,
      disableCompleteModal,
    },
    shortcuts: {
      disableGlobalShortcuts,
    },
    clipboard: {
      openOnCopyUrl,
    },
  };

  // Создаем blob и инициируем скачивание файла config.json
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
    "Файл конфигурации успешно сохранён",
    "success",
  );
  setTimeout(() => {
    window.electron.invoke(
      "toast",
      "Вы можете загрузить файл на другом устройстве",
      "info",
    );
  }, 3000);
  URL.revokeObjectURL(url);
}

export async function importConfig(file) {
  const text = await file.text();
  try {
    const config = JSON.parse(text);

    // Тема и шрифт — localStorage + визуальное применение
    if (config.appearance?.theme) localStorage.setItem("theme", config.appearance.theme);
    if (config.appearance?.fontSize)
      localStorage.setItem("fontSize", config.appearance.fontSize);

    // Применяем остальные настройки через Electron
    if (typeof config.general?.autoLaunch !== "undefined") {
      await window.electron.invoke(
        "toggle-auto-launch",
        config.general.autoLaunch,
      );
    }
    if (typeof config.general?.minimizeOnLaunch !== "undefined") {
      await window.electron.invoke(
        "set-minimize-on-launch-status",
        config.general.minimizeOnLaunch,
      );
    }
    if (typeof config.notifications?.closeNotification !== "undefined") {
      await window.electron.invoke(
        "set-close-notification-status",
        config.notifications.closeNotification,
      );
    }
    if (typeof config.shortcuts?.disableGlobalShortcuts !== "undefined") {
      await window.electron.invoke(
        "set-disable-global-shortcuts-status",
        config.shortcuts.disableGlobalShortcuts,
      );
    }
    if (typeof config.clipboard?.openOnCopyUrl !== "undefined") {
      await window.electron.invoke(
        "set-open-on-copy-url-status",
        config.clipboard.openOnCopyUrl,
      );
    }
    if (typeof config.window?.expandWindowOnDownloadComplete !== "undefined") {
      await window.electron.invoke(
        "set-open-on-download-complete-status",
        config.window.expandWindowOnDownloadComplete,
      );
    }
    if (typeof config.general?.minimizeInsteadOfClose !== "undefined") {
      await window.electron.invoke(
        "set-minimize-instead-of-close",
        config.general.minimizeInsteadOfClose,
      );
    }
    if (typeof config.window?.defaultTab !== "undefined") {
      await window.electron.invoke(
        "set-default-tab",
        config.window.defaultTab,
      );
    }
    if (typeof config.notifications?.disableCompleteModal !== "undefined") {
      await window.electron.invoke(
        "set-disable-complete-modal-status",
        config.notifications.disableCompleteModal,
      );
    }

    await window.electron.invoke(
      "toast",
      "Конфигурация успешно импортирована",
      "success",
    );
    location.reload();
  } catch (e) {
    alert("Ошибка импорта: " + e.message);
  }
}

export const getDefaultTab = () => window.electron.invoke("get-default-tab");
export const setDefaultTab = (tabId) =>
  window.electron.invoke("set-default-tab", tabId);

export { initSettings };
