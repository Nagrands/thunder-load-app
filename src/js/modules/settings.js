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
} from "./domElements.js";

import {
  getTheme,
  getFontSize,
  setFontSize,
  setTheme,
} from "./settingsStore.js";
import { renderToolsInfo } from "./toolsInfo.js";
import { showConfirmationDialog } from "./modals.js";
import { getLowEffects, setLowEffects } from "./effectsMode.js";

// Lazy-render guards
let toolsInfoRendered = false;
let toolsRenderPromise = null;

const QUALITY_PROFILE_KEY = "downloadQualityProfile";
const QUALITY_PROFILE_DEFAULT = "remember"; // remember | best | audio

/**
 * Функция для инициализации настроек
 */
async function initSettings() {
  // Font size dropdown (custom) logic
  const openConfigFolderBtn = document.getElementById(
    "open-config-folder-button",
  );
  if (openConfigFolderBtn) {
    openConfigFolderBtn.addEventListener("click", () => {
      window.electron.invoke("open-config-folder");
    });
  }

  // Downloader: профиль качества по умолчанию
  (function initDownloadQualityProfile() {
    const radios = document.querySelectorAll(
      'input[name="downloadQualityProfile"]',
    );
    if (!radios || !radios.length) return;

    const read = () => {
      try {
        return (
          localStorage.getItem(QUALITY_PROFILE_KEY) || QUALITY_PROFILE_DEFAULT
        );
      } catch {
        return QUALITY_PROFILE_DEFAULT;
      }
    };
    const write = (val) => {
      const v = val || QUALITY_PROFILE_DEFAULT;
      try {
        localStorage.setItem(QUALITY_PROFILE_KEY, v);
      } catch {}
      window.electron
        ?.invoke?.("toast", "Профиль качества сохранён.", "success")
        .catch(() => {});
    };

    const apply = (val) => {
      radios.forEach((r) => {
        r.checked = r.value === val;
      });
    };

    const current = read();
    apply(current);

    radios.forEach((r) =>
      r.addEventListener("change", () => {
        if (r.checked) write(r.value);
      }),
    );

    window.electron.on("open-settings", () => {
      apply(read());
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
      fontSizeDropdownMenu.querySelectorAll("li").forEach((li) => {
        li.classList.remove("active");
        if (li.getAttribute("data-value") === defaultSize) {
          li.classList.add("active");
        }
      });
      await setFontSize(defaultSize);
      window.electron.invoke(
        "toast",
        `<strong>Размер шрифта</strong> сброшен на <strong>${defaultSize}px</strong>`,
        "success",
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
  const formatThemeLabel = (theme) =>
    theme === "system"
      ? "System"
      : theme.charAt(0).toUpperCase() + theme.slice(1);

  console.log("Тема: ", { themeDropdownBtn, themeDropdownMenu, themeLabel });
  if (themeDropdownBtn && themeDropdownMenu && themeLabel) {
    const savedTheme = await getTheme();
    if (savedTheme === "system") {
      document.documentElement.removeAttribute("data-theme");
    } else {
      document.documentElement.setAttribute("data-theme", savedTheme);
    }
    themeLabel.textContent = formatThemeLabel(savedTheme);
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
        document.documentElement.classList.add("theme-transition");
        await setTheme(selectedTheme);
        themeLabel.textContent = formatThemeLabel(selectedTheme);
        themeDropdownMenu
          .querySelectorAll("li")
          .forEach((li) => li.classList.remove("active"));
        item.classList.add("active");
        themeDropdownMenu.classList.remove("show");
        setTimeout(
          () => document.documentElement.classList.remove("theme-transition"),
          260,
        );
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
      const defaultTheme = "system";
      document.documentElement.classList.add("theme-transition");
      await setTheme(defaultTheme);
      themeLabel.textContent = "System";
      themeDropdownMenu.querySelectorAll("li").forEach((li) => {
        li.classList.remove("active");
        if (li.getAttribute("data-value") === defaultTheme) {
          li.classList.add("active");
        }
      });
      themeDropdownMenu.classList.remove("show");
      setTimeout(
        () => document.documentElement.classList.remove("theme-transition"),
        260,
      );
      window.electron.invoke(
        "toast",
        `<strong>Тема</strong> сброшена на <strong>System</strong>`,
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

    function toggleAutoSendDisabled(disabled) {
      // Ищем контрол «Авто‑отправка при запуске» (внутри WG‑секции настроек)
      const modal =
        document.getElementById("settings-modal") ||
        document.querySelector("#settings");
      const root = modal || document;
      const autosend = root.querySelector(
        '#wg-autosend, #wg-autosend-toggle, [name="wg-autosend"], [data-setting="wg-autosend"]',
      );
      if (!autosend) return;
      autosend.disabled = !!disabled;
      const label =
        autosend.closest("label, .form-check, .settings-row") ||
        autosend.parentElement;
      if (label) label.classList.toggle("is-disabled", !!disabled);
      // Подсказка через Bootstrap tooltip, если инициализатор активен
      if (label && label.hasAttribute("data-bs-toggle")) {
        try {
          window.bootstrap?.Tooltip?.getOrCreateInstance(label);
        } catch {}
      }
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
      // Блокируем/разблокируем автосенд
      toggleAutoSendDisabled(val);
      // тост
      window.electron?.invoke?.(
        "toast",
        val
          ? "Вкладка <strong>WG Unlock</strong> отключена"
          : "Вкладка <strong>WG Unlock</strong> включена",
        val ? "info" : "success",
      );
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
      staticToggle.checked = read();
      staticToggle.addEventListener("change", () =>
        write(staticToggle.checked),
      );
      window.electron?.on?.("open-settings", () => {
        const val = read();
        staticToggle.checked = val;
        toggleAutoSendDisabled(val);
      });
      toggleAutoSendDisabled(read());
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
      toggleAutoSendDisabled(read());
      window.electron?.on?.("open-settings", () => {
        const val = read();
        existing.checked = val;
        toggleAutoSendDisabled(val);
      });
      return;
    }

    // Создаём UI‑блок именно в секции WG Unlock
    const row = document.createElement("div");
    row.className = "settings-row settings-row--wg-disable";
    row.innerHTML = `
      <label class="checkbox-label" data-bs-toggle="tooltip" data-bs-placement="top" title="Скрывает вкладку и отключает её инициализацию. При отключении блокируется опция ‘Авто‑отправка при запуске’.">
        <input id="wg-disable-toggle" type="checkbox" />
        <i class="fa-solid fa-bolt"></i>
        Отключить вкладку WG Unlock
      </label>
      <p class="field-hint">Применяется сразу. Можно включить обратно в любое время.</p>
    `;

    target.appendChild(row);

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
      (e) => {
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
    window.electron?.on?.("open-settings", () => {
      const val = read();
      input.checked = val;
      toggleAutoSendDisabled(val);
    });

    // Применим блокировку автосенд на старте
    toggleAutoSendDisabled(read());
  })();
  // === /WG Unlock: отключение вкладки ===

  // === Backup: отключение вкладки (settings toggle) ===
  (function initBackupDisableToggle() {
    const KEY = "backupDisabled";
    const read = () => {
      try {
        return JSON.parse(localStorage.getItem(KEY)) === true;
      } catch {
        return false;
      }
    };

    function toggleBackupControlsDisabled(disabled) {
      // Отключаем любые интерактивные элементы внутри основного Backup‑вью (если уже отрисовано)
      const view =
        document.getElementById("backup-view") ||
        document.getElementById("backup-view-wrapper");
      if (!view) return;
      const ctrls = view.querySelectorAll("input, button, select, textarea");
      ctrls.forEach((el) => {
        // сам контейнер вкладки может быть скрыт TabSystem'ом — это ок
        el.disabled = !!disabled;
        const label = el.closest(
          "label, .form-check, .settings-row, .control-row",
        );
        if (label) label.classList.toggle("is-disabled", !!disabled);
      });
    }

    const write = (v) => {
      const val = !!v;
      try {
        localStorage.setItem(KEY, JSON.stringify(val));
      } catch {}
      try {
        window.electron?.send &&
          window.electron.send("settings:set", { key: KEY, value: val });
      } catch {}
      window.dispatchEvent(
        new CustomEvent("backup:toggleDisabled", { detail: { disabled: val } }),
      );
      // Блокируем/разблокируем контролы во вью
      toggleBackupControlsDisabled(val);
      window.electron?.invoke?.(
        "toast",
        val
          ? "Вкладка <strong>Backup</strong> отключена"
          : "Вкладка <strong>Backup</strong> включена",
        val ? "info" : "success",
      );
    };

    const modal =
      document.getElementById("settings-modal") ||
      document.querySelector("#settings");
    if (!modal) return;
    const input = modal.querySelector(
      "#backup-settings #backup-disable-toggle, #backup-disable-toggle",
    );
    if (!input) return;
    input.checked = read();
    input.addEventListener("change", () => write(input.checked));
    window.electron?.on?.("open-settings", () => {
      const val = read();
      input.checked = val;
      toggleBackupControlsDisabled(val);
    });

    // Применим блокировку контролов при инициализации
    toggleBackupControlsDisabled(read());
  })();
  // === /Backup: отключение вкладки ===

  // === Randomizer: отключение вкладки (settings toggle) ===
  (function initRandomizerDisableToggle() {
    const KEY = "randomizerDisabled";
    const read = () => {
      try {
        const raw = localStorage.getItem(KEY);
        if (raw === null) return true;
        return JSON.parse(raw) === true;
      } catch {
        return true;
      }
    };

    function toggleRandomizerControlsDisabled(disabled) {
      const view =
        document.getElementById("randomizer-view") ||
        document.getElementById("randomizer-view-wrapper");
      if (!view) return;
      const ctrls = view.querySelectorAll("input, button, select, textarea");
      ctrls.forEach((el) => {
        el.disabled = !!disabled;
        const label = el.closest(
          "label, .form-check, .settings-row, .control-row",
        );
        if (label) label.classList.toggle("is-disabled", !!disabled);
      });
    }

    const write = (v) => {
      const val = !!v;
      try {
        localStorage.setItem(KEY, JSON.stringify(val));
      } catch {}
      try {
        window.electron?.send?.("settings:set", { key: KEY, value: val });
      } catch {}
      window.dispatchEvent(
        new CustomEvent("randomizer:toggleDisabled", {
          detail: { disabled: val },
        }),
      );
      toggleRandomizerControlsDisabled(val);
      window.electron?.invoke?.(
        "toast",
        val
          ? "Вкладка <strong>Randomizer</strong> отключена"
          : "Вкладка <strong>Randomizer</strong> включена",
        val ? "info" : "success",
      );
    };

    const modal =
      document.getElementById("settings-modal") ||
      document.querySelector("#settings");
    if (!modal) return;
    const input = modal.querySelector(
      "#randomizer-settings #randomizer-disable-toggle, #randomizer-disable-toggle",
    );
    if (!input) return;
    input.checked = read();
    input.addEventListener("change", () => write(input.checked));
    window.electron?.on?.("open-settings", () => {
      const val = read();
      input.checked = val;
      toggleRandomizerControlsDisabled(val);
    });

    toggleRandomizerControlsDisabled(read());
  })();
  // === /Randomizer: отключение вкладки ===

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
    window.electron?.on?.("open-settings", () => {
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
    window.electron?.on?.("open-settings", () => {
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
    window.electron.on("open-settings", async () => {
      await syncAutoShutdownFromStore();
    });
  }
  // === /WG Unlock: авто‑закрытие ===

  async function ensureToolsInfo(force = false) {
    if (toolsRenderPromise) return toolsRenderPromise;
    if (toolsInfoRendered && !force) return null;
    toolsRenderPromise = renderToolsInfo()
      .then(() => {
        toolsInfoRendered = true;
      })
      .catch((e) => {
        console.error("[settings] renderToolsInfo failed:", e);
      })
      .finally(() => {
        toolsRenderPromise = null;
      });
    return toolsRenderPromise;
  }

  // Обновлять блок версий только при открытии настроек
  window.electron.on("open-settings", async () => {
    await ensureToolsInfo(false);
  });
  window.addEventListener("settings:opened", () => {
    ensureToolsInfo(false);
  });

  // Переключатель отображения статуса инструментов в шапке Downloader
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
  (function initToolsLocationControls() {
    const pathInput = document.getElementById("tools-location-path");
    const btnChoose = document.getElementById("tools-location-choose");
    const btnOpen = document.getElementById("tools-location-open");
    const btnReset = document.getElementById("tools-location-reset");
    const btnMigrate = document.getElementById("tools-location-migrate");

    if (!pathInput || !btnChoose || !btnOpen || !btnMigrate) return; // минимальный набор

    const toast = (msg, type = "info") =>
      window.electron.invoke("toast", msg, type);

    async function refreshLocation() {
      try {
        const res = await window.electron.tools?.getLocation?.();
        if (res?.success) {
          const { path: current, isDefault, defaultPath } = res;
          pathInput.value = current || "";
          if (btnReset) {
            btnReset.disabled = !!isDefault;
            const title = isDefault
              ? `Сейчас используется путь по умолчанию${defaultPath ? `: ${defaultPath}` : ""}`
              : `Сбросить на путь по умолчанию${defaultPath ? `: ${defaultPath}` : ""}`;
            btnReset.setAttribute("title", title);
          }
        }
      } catch (e) {
        console.error("[settings] getLocation error:", e);
      }
    }

    async function chooseDirectory() {
      // Пытаемся вызвать известные каналы выбора директории, иначе — prompt
      const candidates = [
        "dialog:choose-tools-dir",
        "dialog:chooseDir",
        "choose-directory",
        "select-directory",
      ];
      for (const ch of candidates) {
        try {
          const res = await window.electron.invoke(ch);
          if (res && typeof res === "string") return res;
          if (res && res.filePaths && res.filePaths[0]) return res.filePaths[0];
          if (res && res.canceled === false && res?.paths?.[0])
            return res.paths[0];
        } catch {}
      }
      // Фолбэк — ввод пути вручную
      const manual = prompt("Укажите путь к папке инструментов");
      return manual || null;
    }

    btnChoose?.addEventListener("click", async () => {
      const dir = await chooseDirectory();
      if (!dir) return;
      try {
        const res = await window.electron.tools?.setLocation?.(dir);
        if (res?.success) {
          await refreshLocation();
          toast("Папка инструментов обновлена", "success");
          try {
            await ensureToolsInfo(true);
          } catch {}
        } else {
          toast(
            "Не удалось установить папку инструментов: " +
              (res?.error || "Unknown error"),
            "error",
          );
        }
      } catch (e) {
        console.error("[settings] setLocation error:", e);
        toast("Ошибка при установке папки инструментов", "error");
      }
    });

    btnOpen?.addEventListener("click", async () => {
      try {
        const res = await window.electron.tools?.openLocation?.();
        if (!res?.success)
          toast("Не удалось открыть папку инструментов", "error");
      } catch (e) {
        console.error("[settings] openLocation error:", e);
        toast("Ошибка при открытии папки инструментов", "error");
      }
    });

    btnReset?.addEventListener("click", async () => {
      try {
        const res = await window.electron.tools?.resetLocation?.();
        if (res?.success) {
          await refreshLocation();
          toast(
            "Путь инструментов сброшен на значение по умолчанию",
            "success",
          );
          try {
            await ensureToolsInfo(true);
          } catch {}
        } else {
          toast(
            "Не удалось сбросить путь инструментов: " +
              (res?.error || "Unknown error"),
            "error",
          );
        }
      } catch (e) {
        console.error("[settings] resetLocation error:", e);
        toast("Ошибка при сбросе пути инструментов", "error");
      }
    });

    btnMigrate?.addEventListener("click", async () => {
      try {
        const detect = await window.electron.tools?.detectLegacy?.();
        if (!detect?.success) {
          toast("Не удалось проверить старые установки", "error");
          return;
        }
        if (!detect.found || !detect.found.length) {
          toast("Старые установки не найдены", "info");
          return;
        }
        const res = await window.electron.tools?.migrateOld?.({
          overwrite: false,
        });
        if (res?.success) {
          const copied = res.copied?.length || 0;
          const skipped = res.skipped?.length || 0;
          toast(
            `Миграция завершена: скопировано ${copied}, пропущено ${skipped}`,
            "success",
          );
          await refreshLocation();
          try {
            await ensureToolsInfo(true);
          } catch {}
        } else {
          toast(
            "Не удалось выполнить миграцию: " + (res?.error || "Unknown error"),
            "error",
          );
        }
      } catch (e) {
        console.error("[settings] migrateOld error:", e);
        toast("Ошибка при миграции", "error");
      }
    });

    // Инициализация только при открытии настроек
    window.electron.on("open-settings", refreshLocation);
  })();
  // === /Tools location UI ===
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
  return config;
}

export async function exportConfig() {
  const config = await collectCurrentConfig();

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

    // Build diff preview
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
        ? `<li>… и ещё ${changes.length - 50} изменений</li>`
        : "";

    const html = `
      <div class="toast-message">
        <p>Будут применены ${changes.length} изменений. Создать резервную копию текущей конфигурации и продолжить?</p>
        <ul>${previewItems}${moreNote}</ul>
      </div>`;

    showConfirmationDialog(html, async () => {
      // Backup current config
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

      // Apply imported config (existing logic)
      await (async () => {
        // Тема и шрифт — localStorage + визуальное применение
        if (config.appearance?.theme) await setTheme(config.appearance.theme);
        if (config.appearance?.fontSize)
          await setFontSize(config.appearance.fontSize);

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
        if (
          typeof config.window?.expandWindowOnDownloadComplete !== "undefined"
        ) {
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
      })();
    });
  } catch (e) {
    alert("Ошибка импорта: " + e.message);
  }
}

export const getDefaultTab = () => window.electron.invoke("get-default-tab");
export const setDefaultTab = (tabId) =>
  window.electron.invoke("set-default-tab", tabId);

export { initSettings };
