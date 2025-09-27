/**
 * @file tooltipInitializer.js
 * @description
 * Initializes and manages Bootstrap tooltips across the Thunder Load UI.
 *
 * Responsibilities:
 *  - Normalize and format hotkey strings (remove duplicates, reorder modifiers)
 *  - Replace modifier text with macOS-specific symbols (⌘, ⌥, ⌃, ⇧)
 *  - Adjust sidebar tooltip placement based on collapse state
 *  - Patch Bootstrap's internal methods for stability
 *  - Initialize tooltips for all `[data-bs-toggle="tooltip"]` elements
 *  - Handle cleanup and disposal of tooltip instances
 *  - Update hotkey labels in the "Shortcuts" modal for cross-platform clarity
 *  - Hide tooltips on click (element click or global body click)
 *
 * Exports:
 *  - initTooltips — sets up and activates all tooltips
 *  - disposeAllTooltips — removes all tooltips and cleans state
 */

// src/js/modules/tooltipInitializer.js

function removeDuplicateModifiers(text) {
  const parts = text.split("+").map((p) => p.trim());
  const modifiersOrder = ["Ctrl", "Meta", "Alt", "Shift"];
  const modifiers = [];
  const keys = [];

  parts.forEach((part) => {
    if (modifiersOrder.includes(part) && !modifiers.includes(part)) {
      modifiers.push(part);
    } else if (!modifiersOrder.includes(part)) {
      keys.push(part);
    }
  });

  const orderedModifiers = modifiersOrder.filter((m) => modifiers.includes(m));
  return [...orderedModifiers, ...keys].join(" + ");
}

let tooltipInstances = [];

function replaceModifiers(text, isMac) {
  if (!isMac) return text;

  // Замена конкретных комбинаций
  text = text.replace(/Ctrl\+R/g, "⌘+R");

  // Общая замена Ctrl, Shift, Alt и Meta
  text = text
    .replace(/\bCtrl\b/g, "⌃")
    .replace(/\bShift\b/g, "⇧")
    .replace(/\bAlt\b/g, "⌥")
    .replace(/\bMeta\b/g, "⌘");

  return text;
}

function initTooltips() {
  // Если Bootstrap не загружен, спокойно выходим без ошибок
  if (!(window.bootstrap && window.bootstrap.Tooltip)) {
    console.info("[Tooltips] Bootstrap is not available. Skipping tooltip init.");
    return;
  }
  // Очистка предыдущих тултипов
  tooltipInstances.forEach((tooltip) => {
    try {
      if (tooltip && tooltip._element?.isConnected) {
        tooltip.dispose();
      }
    } catch (e) {
      console.warn("Ошибка при очистке tooltip:", e);
    }
  });
  tooltipInstances = [];

  const isMac = navigator.platform.toUpperCase().includes("MAC");

  if (isMac) {
    document.querySelectorAll("[data-hotkey]").forEach((el) => {
      const hotkey = el.dataset.hotkey;
      const match = hotkey && hotkey.match(/^Ctrl\+Shift\+(\d)$/);
      if (match) {
        el.dataset.hotkey = `Alt+${match[1]}`;
      }
    });
  }

  const tooltipTriggerList = Array.from(
    document.querySelectorAll('[data-bs-toggle="tooltip"]'),
  );

  // Патч Bootstrap Tooltip для безопасного вызова _isWithActiveTrigger
  if (bootstrap?.Tooltip?.prototype?._isWithActiveTrigger) {
    const original = bootstrap.Tooltip.prototype._isWithActiveTrigger;

    bootstrap.Tooltip.prototype._isWithActiveTrigger = function (trigger) {
      if (!trigger || typeof trigger !== "object") return false;
      try {
        return original.call(this, trigger);
      } catch (e) {
        console.warn("Патч: ошибка в _isWithActiveTrigger:", e);
        return false;
      }
    };
  }

  tooltipTriggerList.forEach((el) => {
    const baseTitle = el.getAttribute("title");
    const hotkey = el.dataset.hotkey;

    if (baseTitle != null && hotkey && !baseTitle.includes("(")) {
      const cleaned = removeDuplicateModifiers(hotkey);
      const updated = replaceModifiers(cleaned, isMac);
      el.setAttribute("title", `${baseTitle} (${updated})`);
    }
  });

  tooltipTriggerList.forEach((el) => {
    setTimeout(() => {
      try {
        const sidebar = document.getElementById('sidebar');
        const isCollapsed = sidebar?.classList?.contains('is-collapsed');
        const insideSidebar = !!el.closest('#sidebar');
        const isNavItem = el.classList?.contains('sidebar-item');
        const isServiceIcon = !!el.closest('.social-links .icon-links');
        // Base placement from attribute, fallback to top
        let placementOption = el.getAttribute('data-bs-placement') || 'top';
        // Override for compact sidebar: nav buttons and service icons should show to the right
        if (insideSidebar && isCollapsed && (isNavItem || isServiceIcon)) {
          placementOption = 'right';
        }
        if (
          !el ||
          typeof el.getAttribute !== "function" ||
          el.getAttribute("title") === null
        ) {
          return;
        }

        const tooltip = new bootstrap.Tooltip(el, {
          trigger: "hover focus",
          customClass: "tooltip-inner",
          template:
            '<div class="tooltip" role="tooltip"><div class="tooltip-inner"></div></div>',
          placement: placementOption,
          offset: [0, 8],
          boundary: "window",
        });

        tooltip._activeTrigger = tooltip._activeTrigger || {};

        const originalHide = tooltip.hide;
        tooltip.hide = function () {
          try {
            if (!this._activeTrigger || !this.tip) return;
            return originalHide.call(this);
          } catch (e) {
            console.warn("Защита: ошибка при вызове tooltip.hide():", e);
          }
        };

        queueMicrotask(() => {
          el.addEventListener("click", () => {
            try {
              if (
                tooltip &&
                typeof tooltip.hide === "function" &&
                tooltip._activeTrigger &&
                tooltip.tip
              ) {
                tooltip.hide();
              }
            } catch (e) {
              console.warn("Не удалось скрыть tooltip:", e);
            }
          });
        });

        tooltipInstances.push(tooltip);
      } catch (e) {
        console.warn("Ошибка при создании tooltip:", e);
      }
    }, 0);
  });

  // Обработка текста горячих клавиш в модальном окне (кроме блока "открытие сайтов")
  document
    .querySelectorAll(
      "#shortcuts-modal strong:not(.additional-hotkeys li strong)",
    )
    .forEach((el) => {
      let text = el.textContent;
      const cleaned = removeDuplicateModifiers(text);
      el.textContent = replaceModifiers(cleaned, isMac);
    });

  // Замена для дополнительных горячих клавиш открытия сайтов
  document
    .querySelectorAll("#shortcuts-modal .additional-hotkeys li strong")
    .forEach((el) => {
      let text = el.textContent;
      if (isMac) {
        const match = text.match(/^Ctrl\s*\+\s*Shift\s*\+\s*(\d)$/);
        if (match) {
          text = `Alt + ${match[1]}`;
        }
      }
      const cleaned = removeDuplicateModifiers(text);
      el.textContent = replaceModifiers(cleaned, isMac);
    });

  // Глобальное скрытие тултипов при клике вне
  document.body.addEventListener("click", () => {
    tooltipInstances.forEach((tooltip) => {
      try {
        if (
          tooltip &&
          typeof tooltip.hide === "function" &&
          tooltip._activeTrigger &&
          tooltip.tip &&
          tooltip._element?.isConnected
        ) {
          tooltip.hide();
        }
      } catch (e) {
        console.warn("Ошибка при глобальном скрытии tooltip:", e);
      }
    });
  });
}

function disposeAllTooltips() {
  tooltipInstances.forEach((tooltip) => {
    try {
      if (tooltip && tooltip._element?.isConnected) {
        tooltip.dispose();
      }
    } catch (e) {
      console.warn("Ошибка при очистке tooltip:", e);
    }
  });
  tooltipInstances = [];
}

// Проверка на наличие активного триггера для тултипа
function _isWithActiveTrigger(trigger) {
  if (!trigger || typeof trigger !== "object") return false;
  return Object.values(trigger).some((value) => value);
}

export { initTooltips, disposeAllTooltips };
