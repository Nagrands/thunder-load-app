/**
 * @file tooltipInitializer.js
 * @description
 * Initializes and manages Bootstrap tooltips across the Thunder Load UI.
 *
 * Responsibilities:
 *  - Normalize and format hotkey strings (remove duplicates, reorder modifiers)
 *  - Replace modifier text with macOS-specific symbols (⌘, ⌥, ⌃, ⇧)
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

const tooltipInstances = new Map();
let tooltipSafetyPatched = false;
let bodyClickListenerAttached = false;

function ensureTooltipSafety() {
  if (tooltipSafetyPatched) return;
  const Tooltip = window.bootstrap?.Tooltip;
  if (!Tooltip || !Tooltip.prototype) return;

  const proto = Tooltip.prototype;

  const originalHide = typeof proto.hide === "function" ? proto.hide : null;
  if (originalHide) {
    proto.hide = function (...args) {
      try {
        if (!this._element) {
          return this;
        }
        if (!this.tip || typeof this.tip.remove !== "function") {
          this._activeTrigger = {};
          this._isHovered = false;
          const tip =
            typeof this.tip === "function"
              ? this.tip()
              : this.tip || this.getTipElement?.();
          if (
            tip &&
            tip.parentNode &&
            typeof tip.parentNode.removeChild === "function"
          ) {
            tip.parentNode.removeChild(tip);
          }
          this.tip = null;
          return this;
        }
        return originalHide.apply(this, args);
      } catch (error) {
        console.warn("[Tooltips] Ошибка при скрытии tooltip:", error);
        return this;
      }
    };
  }

  const originalQueue =
    typeof proto._queueCallback === "function" ? proto._queueCallback : null;
  if (originalQueue) {
    proto._queueCallback = function (callback, element, isAnimated = true) {
      if (!element || !this) {
        if (typeof callback === "function") {
          try {
            callback.call(this);
          } catch (error) {
            console.warn("[Tooltips] Ошибка в безопасном callback:", error);
          }
        }
        return;
      }
      return originalQueue.call(this, callback, element, isAnimated);
    };
  }

  const originalLeave =
    typeof proto._leave === "function" ? proto._leave : null;
  if (originalLeave) {
    proto._leave = function (...args) {
      try {
        if (!this || !this._config || !this._config.delay) {
          // если конфиг потерян, просто скрываем
          try {
            this.hide?.();
          } catch {}
          return;
        }
        return originalLeave.apply(this, args);
      } catch (error) {
        console.warn(
          "[Tooltips] Ошибка в _leave, безопасное завершение:",
          error,
        );
        try {
          this.hide?.();
        } catch {}
        return;
      }
    };
  }

  const originalDispose =
    typeof proto.dispose === "function" ? proto.dispose : null;
  if (originalDispose) {
    proto.dispose = function (...args) {
      try {
        if (
          !this._element ||
          typeof this._element.removeAttribute !== "function"
        ) {
          return this;
        }
        return originalDispose.apply(this, args);
      } catch (error) {
        console.warn("[Tooltips] Ошибка при dispose tooltip:", error);
        return this;
      }
    };
  }

  tooltipSafetyPatched = true;
}

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

function createTooltip(el) {
  if (!el || tooltipInstances.has(el)) return tooltipInstances.get(el);
  let placementOption = el.getAttribute("data-bs-placement") || "top";
  const tooltip = new bootstrap.Tooltip(el, {
    trigger: "hover focus",
    customClass: "tooltip-inner",
    template:
      '<div class="tooltip" role="tooltip"><div class="tooltip-inner"></div></div>',
    placement: placementOption,
    offset: [0, 8],
    boundary: "window",
  });
  // hide on click of trigger
  el.addEventListener(
    "click",
    () => {
      try {
        tooltip.hide();
      } catch {}
    },
    { once: false },
  );
  tooltipInstances.set(el, tooltip);
  return tooltip;
}

function bindLazyTooltip(el) {
  if (!el || el.dataset.tooltipBound === "1") return;
  const handler = () => {
    const t = createTooltip(el);
    try {
      t?.show();
    } catch {}
  };
  el.addEventListener("pointerenter", handler, { once: true, passive: true });
  el.addEventListener("focusin", handler, { once: true });
  el.dataset.tooltipBound = "1";
}

function initTooltips() {
  if (!(window.bootstrap && window.bootstrap.Tooltip)) {
    console.info(
      "[Tooltips] Bootstrap is not available. Skipping tooltip init.",
    );
    return;
  }
  ensureTooltipSafety();
  disposeAllTooltips();

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
    try {
      bindLazyTooltip(el);
    } catch (e) {
      console.warn("Ошибка при создании tooltip:", e);
    }
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
  if (!bodyClickListenerAttached) {
    document.body.addEventListener("click", () => {
      tooltipInstances.forEach((tooltip, el) => {
        if (!(tooltip && tooltip._element?.isConnected)) {
          tooltipInstances.delete(el);
          return;
        }
        try {
          if (typeof tooltip.hide === "function") {
            const tip = tooltip.tip;
            const isActive =
              (typeof tooltip._isShown === "function" && tooltip._isShown()) ||
              (tip &&
                tip.classList &&
                tip.classList.contains("show") &&
                tip.parentNode);
            if (isActive) {
              tooltip.hide();
            }
          }
        } catch (e) {
          console.warn("Ошибка при глобальном скрытии tooltip:", e);
        }
      });
    });
    bodyClickListenerAttached = true;
  }
}

function disposeAllTooltips() {
  tooltipInstances.forEach((tooltip, el) => {
    try {
      if (tooltip && typeof tooltip.dispose === "function") {
        tooltip.dispose();
      }
    } catch (e) {
      console.warn("Ошибка при очистке tooltip:", e);
    }
    try {
      el?.removeAttribute("data-tooltip-bound");
    } catch {}
  });
  tooltipInstances.clear();
}

// Проверка на наличие активного триггера для тултипа
function _isWithActiveTrigger(trigger) {
  if (!trigger || typeof trigger !== "object") return false;
  return Object.values(trigger).some((value) => value);
}

export { initTooltips, disposeAllTooltips };
