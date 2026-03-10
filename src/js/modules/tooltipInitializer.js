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
const popoverInstances = new Map();
let tooltipSafetyPatched = false;
let bodyClickListenerAttached = false;
let delegatedPopoverListenersAttached = false;
let activeTriggerPatched = false;

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

  const originalShow = typeof proto.show === "function" ? proto.show : null;
  if (originalShow) {
    proto.show = function (...args) {
      try {
        // Do not allow tooltip rendering while confirmation modal is open.
        if (document.body?.classList?.contains("confirmation-open")) {
          return this;
        }
        return originalShow.apply(this, args);
      } catch (error) {
        console.warn("[Tooltips] Ошибка при показе tooltip:", error);
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
          !this?._element ||
          typeof this._element.removeAttribute !== "function"
        ) {
          return this;
        }
        return originalDispose.apply(this, args);
      } catch (error) {
        console.warn("[Tooltips] Ошибка при dispose tooltip:", error);
        try {
          this._element?.removeAttribute?.("aria-describedby");
        } catch {}
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
  if (!el || !window.bootstrap?.Tooltip) return null;
  let tooltip = tooltipInstances.get(el);
  if (tooltip) return tooltip;

  const placementOption = el.getAttribute("data-bs-placement") || "top";
  const config = {
    trigger: "hover focus",
    customClass: "tooltip-inner",
    template:
      '<div class="tooltip" role="tooltip"><div class="tooltip-inner"></div></div>',
    placement: placementOption,
    offset: [0, 8],
    boundary: "window",
  };

  try {
    tooltip = window.bootstrap.Tooltip.getOrCreateInstance(el, config);
  } catch {
    tooltip = new window.bootstrap.Tooltip(el, config);
  }
  tooltipInstances.set(el, tooltip);
  return tooltip;
}

function hideAllTooltips() {
  tooltipInstances.forEach((tooltip, el) => {
    if (!(tooltip && el?.isConnected)) {
      tooltipInstances.delete(el);
      return;
    }
    try {
      tooltip.hide?.();
    } catch {}
  });
  popoverInstances.forEach((popover, el) => {
    if (!(popover && el?.isConnected)) {
      popoverInstances.delete(el);
      return;
    }
    try {
      popover.hide?.();
    } catch {}
  });

  // Fallback for instances that were created outside our map.
  if (window.bootstrap?.Tooltip) {
    document.querySelectorAll('[data-bs-toggle="tooltip"]').forEach((el) => {
      try {
        window.bootstrap.Tooltip.getInstance(el)?.hide?.();
      } catch {}
    });
  }
  if (window.bootstrap?.Popover) {
    document.querySelectorAll('[data-bs-toggle="popover"]').forEach((el) => {
      try {
        window.bootstrap.Popover.getInstance(el)?.hide?.();
      } catch {}
    });
  }
}

function cleanupOrphanTooltips() {
  tooltipInstances.forEach((tooltip, el) => {
    if (el?.isConnected) return;
    try {
      tooltip?.hide?.();
    } catch {}
    tooltipInstances.delete(el);
  });
}

function resolveTooltipTitle(el) {
  if (!el) return "";
  const title = String(el.getAttribute("title") || "").trim();
  if (title) return title;
  const bsOriginalTitle = String(
    el.getAttribute("data-bs-original-title") || "",
  ).trim();
  if (bsOriginalTitle) return bsOriginalTitle;
  return String(el.dataset.tooltipTitle || "").trim();
}

function syncTooltipInstance(el) {
  if (!el || el.disabled) return;
  const title = resolveTooltipTitle(el);
  const instance = tooltipInstances.get(el);

  if (!title) {
    if (instance) {
      try {
        instance.dispose?.();
      } catch {}
      tooltipInstances.delete(el);
    }
    try {
      el.removeAttribute("data-tooltip-managed");
      el.removeAttribute("data-tooltip-title");
    } catch {}
    return;
  }

  const tooltip = instance || createTooltip(el);
  if (!tooltip) return;
  if (!el.getAttribute("data-bs-original-title") && title) {
    el.setAttribute("data-bs-original-title", title);
  }
  const prevTitle = el.dataset.tooltipTitle || "";

  if (prevTitle !== title) {
    try {
      if (typeof tooltip.setContent === "function") {
        tooltip.setContent({ ".tooltip-inner": title });
      } else {
        // Bootstrap instance without setContent (older runtime/mocks):
        // update title sources in place without dispose/recreate churn.
        el.setAttribute("data-bs-original-title", title);
        if (tooltip._config && typeof tooltip._config === "object") {
          tooltip._config.title = title;
        }
      }
    } catch {
      try {
        tooltip.dispose?.();
      } catch {}
      tooltipInstances.delete(el);
      createTooltip(el);
    }
    el.dataset.tooltipTitle = title;
  }

  if (el.dataset.tooltipManaged !== "1") {
    el.dataset.tooltipManaged = "1";
  }
}

function findPopoverTarget(target) {
  if (!target || !(target instanceof Element)) return null;
  return target.closest('[data-bs-toggle="popover"]');
}

function createPopover(el) {
  if (!el || !window.bootstrap?.Popover) return null;
  let popover = popoverInstances.get(el);
  if (popover) return popover;

  const placementOption = el.getAttribute("data-bs-placement") || "auto";
  const config = {
    trigger: "manual",
    placement: placementOption,
    boundary: "window",
    html: true,
    sanitize: false,
  };

  try {
    popover = window.bootstrap.Popover.getOrCreateInstance(el, config);
  } catch {
    popover = new window.bootstrap.Popover(el, config);
  }
  popoverInstances.set(el, popover);
  return popover;
}

function hidePopoverForElement(el) {
  const popover = popoverInstances.get(el) || createPopover(el);
  if (!popover) return;
  try {
    popover.hide();
  } catch {}
}

function hideAllPopovers(exceptEl = null) {
  popoverInstances.forEach((popover, el) => {
    if (exceptEl && el === exceptEl) return;
    try {
      popover.hide();
    } catch {}
  });
}

function isInsidePopoverContent(target) {
  if (!(target instanceof Element)) return false;
  return Boolean(target.closest(".popover"));
}

function togglePopoverFromEvent(event) {
  const el = findPopoverTarget(event.target);
  if (!el || !el.isConnected || el.disabled) return;
  event.preventDefault();
  event.stopPropagation();

  const popover = createPopover(el);
  if (!popover) return;

  const tipElement =
    (typeof popover.getTipElement === "function" && popover.getTipElement()) ||
    popover.tip;
  const isShown =
    Boolean(tipElement?.classList?.contains?.("show")) &&
    Boolean(tipElement?.isConnected);

  if (isShown) {
    hidePopoverForElement(el);
    return;
  }
  hideAllPopovers(el);
  try {
    popover.show();
  } catch {}
}

function attachDelegatedPopoverListeners() {
  if (delegatedPopoverListenersAttached) return;
  delegatedPopoverListenersAttached = true;

  document.addEventListener("click", togglePopoverFromEvent, true);
  document.addEventListener("keydown", (event) => {
    if (event.key === "Escape") {
      hideAllPopovers();
    }
  });
}

function initPopovers(root = document) {
  if (!(window.bootstrap && window.bootstrap.Popover)) return;
  attachDelegatedPopoverListeners();

  const contextRoot =
    root && typeof root.querySelectorAll === "function" ? root : document;
  const popoverTriggerList = Array.from(
    contextRoot.querySelectorAll('[data-bs-toggle="popover"]'),
  );
  popoverTriggerList.forEach((el) => {
    if (el.dataset.popoverManaged === "1") return;
    el.dataset.popoverManaged = "1";
  });
}

function applyHotkeyTitles(tooltipTriggerList, isMac) {
  tooltipTriggerList.forEach((el) => {
    const previousHotkeySuffix = el.dataset.tooltipHotkeyApplied || "";
    let baseTitle = el.getAttribute("title") ?? "";
    if (
      previousHotkeySuffix &&
      baseTitle.endsWith(` (${previousHotkeySuffix})`)
    ) {
      baseTitle = baseTitle.slice(0, -` (${previousHotkeySuffix})`.length);
    }
    const hotkey = el.dataset.hotkey;
    if (!baseTitle) {
      delete el.dataset.tooltipHotkeyApplied;
      return;
    }
    if (hotkey) {
      const cleaned = removeDuplicateModifiers(hotkey);
      const updated = replaceModifiers(cleaned, isMac);
      const nextTitle = `${baseTitle} (${updated})`;
      if (el.getAttribute("title") !== nextTitle) {
        el.setAttribute("title", nextTitle);
      }
      el.dataset.tooltipHotkeyApplied = updated;
      return;
    }
    if (el.dataset.tooltipHotkeyApplied) {
      delete el.dataset.tooltipHotkeyApplied;
    }
    if (el.getAttribute("title") !== baseTitle) {
      el.setAttribute("title", baseTitle);
    }
  });
}

function initTooltips(root = document) {
  if (!(window.bootstrap && window.bootstrap.Tooltip)) {
    if (process.env.NODE_ENV !== "test") {
      console.info(
        "[Tooltips] Bootstrap is not available. Skipping tooltip init.",
      );
    }
    return;
  }
  ensureTooltipSafety();
  cleanupOrphanTooltips();

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

  const contextRoot =
    root && typeof root.querySelectorAll === "function" ? root : document;
  const tooltipTriggerList = Array.from(
    contextRoot.querySelectorAll('[data-bs-toggle="tooltip"]'),
  );

  // Патч Bootstrap Tooltip для безопасного вызова _isWithActiveTrigger
  if (
    !activeTriggerPatched &&
    bootstrap?.Tooltip?.prototype?._isWithActiveTrigger
  ) {
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
    activeTriggerPatched = true;
  }

  applyHotkeyTitles(tooltipTriggerList, isMac);

  tooltipTriggerList.forEach((el) => {
    syncTooltipInstance(el);
  });
  cleanupOrphanTooltips();
  initPopovers(contextRoot);

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
    document.body.addEventListener("click", (event) => {
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
      popoverInstances.forEach((popover, el) => {
        if (!(popover && popover._element?.isConnected)) {
          popoverInstances.delete(el);
          return;
        }
        const target = event.target;
        const clickedTrigger = target instanceof Element && el.contains(target);
        if (clickedTrigger || isInsidePopoverContent(target)) return;
        try {
          popover.hide();
        } catch {}
      });
    });
    bodyClickListenerAttached = true;
  }
}

function disposeAllTooltips(options = {}) {
  const force = options?.force === true;
  tooltipInstances.forEach((tooltip, el) => {
    if (!force && el?.isConnected) return;
    try {
      if (tooltip && typeof tooltip.dispose === "function") {
        tooltip.dispose();
      }
    } catch (e) {
      console.warn("Ошибка при очистке tooltip:", e);
    }
    try {
      el?.removeAttribute("data-tooltip-managed");
      el?.removeAttribute("data-tooltip-hotkey-applied");
    } catch {}
    tooltipInstances.delete(el);
  });
  popoverInstances.forEach((popover, el) => {
    if (!force && el?.isConnected) return;
    try {
      if (popover && typeof popover.dispose === "function") {
        popover.dispose();
      }
    } catch (e) {
      console.warn("Ошибка при очистке popover:", e);
    }
    try {
      el?.removeAttribute("data-popover-managed");
    } catch {}
    popoverInstances.delete(el);
  });
}

// Проверка на наличие активного триггера для тултипа
function _isWithActiveTrigger(trigger) {
  if (!trigger || typeof trigger !== "object") return false;
  return Object.values(trigger).some((value) => value);
}

export { initTooltips, disposeAllTooltips, hideAllTooltips };
