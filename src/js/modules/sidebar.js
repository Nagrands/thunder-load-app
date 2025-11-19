// src/js/modules/sidebar.js

import {
  sidebar,
  overlay,
  toggleBtn,
  settingsModal,
  collapseSidebarButton,
  compactSidebarButton,
  settingsButton,
} from "./domElements.js";
import { disposeAllTooltips, initTooltips } from "./tooltipInitializer.js";

/**
 * Функция для переключения бокового меню
 */
function toggleSidebar() {
  const pinned = sidebar.classList.contains("is-pinned");
  const isActive = sidebar.classList.contains("active");
  if (isActive) {
    // Если закреплено — не закрываем по обычному тогглу/внешнему клику
    if (pinned) {
      overlay.classList.remove("active");
      return;
    }
    sidebar.classList.remove("active");
    overlay.classList.remove("active");
    toggleBtn.classList.remove("hidden");
  } else {
    sidebar.classList.add("active");
    // Для закреплённого — не показываем overlay, чтобы можно было взаимодействовать с приложением
    if (!pinned) {
      overlay.classList.add("active");
      toggleBtn.classList.add("hidden");
    } else {
      // В закреплённом режиме кнопка-тогглер остаётся доступной
      overlay.classList.remove("active");
      toggleBtn.classList.remove("hidden");
    }
  }
}

/**
 * Функция для скрытия бокового меню
 */
function hideSidebar() {
  if (sidebar.classList.contains("active")) {
    // Не закрываем, если закреплено
    if (sidebar.classList.contains("is-pinned")) return;
    sidebar.classList.remove("active");
    overlay.classList.remove("active");
    toggleBtn.classList.remove("hidden");
  }
}

/**
 * Функция для открытия настроек
 */
let __prevFocusedEl = null;
let __trapHandler = null;

function getTabbables(root) {
  const sel = [
    "a[href]",
    "button:not([disabled])",
    "input:not([disabled])",
    "select:not([disabled])",
    "textarea:not([disabled])",
    '[tabindex]:not([tabindex="-1"])',
  ].join(",");
  return Array.from(root.querySelectorAll(sel)).filter(
    (el) => el.offsetParent !== null,
  );
}

function openSettings() {
  settingsModal.style.display = "flex";
  settingsModal.style.justifyContent = "center";
  settingsModal.style.alignItems = "center";
  hideSidebar();

  try {
    window.dispatchEvent(new Event("settings:opened"));
  } catch {}

  // Focus trap setup
  __prevFocusedEl = document.activeElement;
  const tabbables = getTabbables(settingsModal);
  if (tabbables.length) {
    // Prefer active tab button
    const activeTab = settingsModal.querySelector(".tab-link.active");
    (activeTab || tabbables[0]).focus();
  } else {
    settingsModal.focus?.();
  }

  __trapHandler = (e) => {
    if (e.key !== "Tab") return;
    const nodes = getTabbables(settingsModal);
    if (!nodes.length) return;
    const first = nodes[0];
    const last = nodes[nodes.length - 1];
    if (e.shiftKey) {
      if (document.activeElement === first) {
        e.preventDefault();
        last.focus();
      }
    } else {
      if (document.activeElement === last) {
        e.preventDefault();
        first.focus();
      }
    }
  };
  window.addEventListener("keydown", __trapHandler, true);
}

/**
 * Функция для закрытия настроек
 */
function closeSettings() {
  settingsModal.style.display = "none";
  overlay.classList.remove("active");
  if (__trapHandler) {
    window.removeEventListener("keydown", __trapHandler, true);
    __trapHandler = null;
  }
  // Restore focus to the opener if possible
  try {
    (settingsButton || __prevFocusedEl)?.focus?.();
  } catch {}
  __prevFocusedEl = null;
}

document.getElementById("open-github")?.addEventListener("click", () => {
  const url = "https://github.com/Nagrands/thunder-load-app";
  window.electron.invoke("open-external-link", url);
});

export { toggleSidebar, hideSidebar, openSettings, closeSettings };
export { toggleCollapsed };

// ==============================
// Collapsed (compact) sidebar mode with persistence
// ==============================

const COLLAPSE_KEY = "sidebarCollapsed";
const PIN_KEY = "sidebarPinned";
let __pinSuspendedOnDrawer = false; // временная приостановка pin в drawer-режиме

function applyCollapsedFromStore() {
  try {
    const raw = localStorage.getItem(COLLAPSE_KEY);
    const collapsed = raw ? JSON.parse(raw) === true : false;
    sidebar?.classList.toggle("is-collapsed", !!collapsed);
    compactSidebarButton?.setAttribute("aria-pressed", String(!!collapsed));
    compactSidebarButton?.setAttribute(
      "title",
      collapsed
        ? "Развернуть меню (компактный режим)"
        : "Свернуть меню (компактный режим)",
    );
    compactSidebarButton?.classList.toggle("is-active", !!collapsed);
    applySocialLinksLayout();
  } catch {}
}

function toggleCollapsed() {
  const collapsed = !sidebar.classList.contains("is-collapsed");
  sidebar.classList.toggle("is-collapsed", collapsed);
  try {
    localStorage.setItem(COLLAPSE_KEY, JSON.stringify(collapsed));
  } catch {}
  compactSidebarButton?.setAttribute("aria-pressed", String(collapsed));
  compactSidebarButton?.setAttribute(
    "title",
    collapsed
      ? "Развернуть меню (компактный режим)"
      : "Свернуть меню (компактный режим)",
  );
  compactSidebarButton?.classList.toggle("is-active", collapsed);
  applySocialLinksLayout();
  // refresh tooltips placement for compact mode
  try {
    disposeAllTooltips();
    initTooltips();
  } catch {}
}

// Pinned state handling
function applyPinnedFromStore() {
  try {
    const raw = localStorage.getItem(PIN_KEY);
    const pinned = raw ? JSON.parse(raw) === true : false;
    sidebar?.classList.toggle("is-pinned", !!pinned);
    collapseSidebarButton?.setAttribute("aria-pressed", String(!!pinned));
    collapseSidebarButton?.setAttribute(
      "title",
      pinned ? "Открепить меню" : "Закрепить меню",
    );
    collapseSidebarButton?.classList.toggle("is-active", !!pinned);
    if (pinned) {
      sidebar.classList.add("active");
      overlay.classList.remove("active");
      // В закреплённом режиме оставляем видимой кнопку-тогглер
      toggleBtn.classList.remove("hidden");
    } else {
      // при откреплении режим compact допустим, но в drawer он будет отключён
    }
    applySocialLinksLayout();
    // refresh tooltips on responsive changes
    try {
      disposeAllTooltips();
      initTooltips();
    } catch {}
  } catch {}
}

function togglePinned() {
  const willPin = !sidebar.classList.contains("is-pinned");
  sidebar.classList.toggle("is-pinned", willPin);
  try {
    localStorage.setItem(PIN_KEY, JSON.stringify(willPin));
  } catch {}
  collapseSidebarButton?.setAttribute("aria-pressed", String(willPin));
  collapseSidebarButton?.setAttribute(
    "title",
    willPin ? "Открепить меню" : "Закрепить меню",
  );
  collapseSidebarButton?.classList.toggle("is-active", willPin);
  // Закрепляя — показываем без overlay; открепляя — оставляем текущее состояние
  if (willPin) {
    sidebar.classList.add("active");
    overlay.classList.remove("active");
    toggleBtn.classList.remove("hidden");
  } else {
    // Открепление само по себе не трогает компактный режим; он отключается в drawer-режиме
  }
  applySocialLinksLayout();
}

// Close regardless of pinned (used by close button)
function closeSidebarForced() {
  sidebar.classList.remove("is-pinned", "active");
  try {
    localStorage.setItem(PIN_KEY, JSON.stringify(false));
  } catch {}
  overlay.classList.remove("active");
  toggleBtn.classList.remove("hidden");
  collapseSidebarButton?.setAttribute("aria-pressed", "false");
  collapseSidebarButton?.classList.remove("is-active");
  collapseSidebarButton?.setAttribute("title", "Закрепить меню");
}

// Bind events
collapseSidebarButton?.addEventListener("click", (e) => {
  e.stopPropagation();
  togglePinned();
});
compactSidebarButton?.addEventListener("click", (e) => {
  e.stopPropagation();
  toggleCollapsed();
});

// Apply on init
applyCollapsedFromStore();
applyPinnedFromStore();

export { closeSidebarForced };

// ==============================
// Responsive: switch to drawer on small screens
// ==============================
function applyResponsiveMode() {
  try {
    const isNarrow = window.innerWidth <= 1024;
    sidebar?.classList.toggle("is-drawer", isNarrow);
    if (isNarrow) {
      // Drawer режим не поддерживает закрепление/сворачивание
      if (sidebar.classList.contains("is-pinned")) {
        sidebar.classList.remove("is-pinned");
        __pinSuspendedOnDrawer = true; // запомним, что пин был активен
        collapseSidebarButton?.classList.remove("is-active");
        collapseSidebarButton?.setAttribute("aria-pressed", "false");
        collapseSidebarButton?.setAttribute("title", "Закрепить меню");
      }
      if (sidebar.classList.contains("is-collapsed")) {
        sidebar.classList.remove("is-collapsed");
        localStorage.setItem(COLLAPSE_KEY, JSON.stringify(false));
        compactSidebarButton?.classList.remove("is-active");
        compactSidebarButton?.setAttribute("aria-pressed", "false");
        compactSidebarButton?.setAttribute(
          "title",
          "Свернуть меню (компактный режим)",
        );
      }
    }
    // Возврат из drawer: восстановим закрепление, если было приостановлено или сохранено в store
    if (!isNarrow) {
      const storedPin = (() => {
        try {
          return JSON.parse(localStorage.getItem(PIN_KEY) || "false") === true;
        } catch {
          return false;
        }
      })();
      if (__pinSuspendedOnDrawer || storedPin) {
        sidebar.classList.add("is-pinned", true);
        sidebar.classList.add("active");
        overlay.classList.remove("active");
        toggleBtn.classList.remove("hidden");
        collapseSidebarButton?.classList.add("is-active");
        collapseSidebarButton?.setAttribute("aria-pressed", "true");
        collapseSidebarButton?.setAttribute("title", "Открепить меню");
        __pinSuspendedOnDrawer = false;
      }
      // восстановить компактный режим из store
      try {
        const rawC = localStorage.getItem(COLLAPSE_KEY);
        const wantCollapsed = rawC ? JSON.parse(rawC) === true : false;
        sidebar.classList.toggle("is-collapsed", !!wantCollapsed);
        compactSidebarButton?.classList.toggle("is-active", !!wantCollapsed);
        compactSidebarButton?.setAttribute(
          "aria-pressed",
          String(!!wantCollapsed),
        );
        compactSidebarButton?.setAttribute(
          "title",
          wantCollapsed
            ? "Развернуть меню (компактный режим)"
            : "Свернуть меню (компактный режим)",
        );
      } catch {}
    }
    applySocialLinksLayout();
  } catch {}
}

window.addEventListener("resize", applyResponsiveMode);
// initial
applyResponsiveMode();

// ==============================
// Keyboard navigation (accessibility)
// ==============================
try {
  sidebar?.addEventListener("keydown", (e) => {
    const items = Array.from(sidebar.querySelectorAll(".sidebar-item"));
    if (items.length === 0) return;
    const currentIndex = items.indexOf(document.activeElement);
    const isDrawer = sidebar.classList.contains("is-drawer");
    const isPinned = sidebar.classList.contains("is-pinned");

    if (e.key === "ArrowDown") {
      e.preventDefault();
      const next = items[(Math.max(0, currentIndex) + 1) % items.length];
      next?.focus();
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      const prev =
        items[
          (currentIndex > 0 ? currentIndex - 1 : items.length - 1) %
            items.length
        ];
      prev?.focus();
    } else if (e.key === "Home") {
      e.preventDefault();
      items[0]?.focus();
    } else if (e.key === "End") {
      e.preventDefault();
      items[items.length - 1]?.focus();
    } else if (e.key === "Escape") {
      // Close drawer on Esc if not pinned
      if (isDrawer && !isPinned && sidebar.classList.contains("active")) {
        sidebar.classList.remove("active");
        overlay?.classList.remove("active");
        toggleBtn?.classList.remove("hidden");
        e.preventDefault();
      }
    }
  });
} catch {}

// Keep social icon layout in sync with state (CSS fallback)
function applySocialLinksLayout() {
  try {
    const iconLinks = sidebar?.querySelector(".social-links .icon-links");
    if (!iconLinks) return;
    const pinned = sidebar.classList.contains("is-pinned");
    const collapsed = sidebar.classList.contains("is-collapsed");
    const links = iconLinks.querySelectorAll("a");
    if (collapsed) {
      iconLinks.style.flexDirection = "column";
      iconLinks.style.borderRadius = "12px";
      links.forEach((a) => {
        a.style.width = "36px";
        a.style.height = "36px";
        a.style.justifyContent = "center";
      });
    } else {
      iconLinks.style.flexDirection = "row";
      iconLinks.style.borderRadius = "999px";
      iconLinks.style.padding = "6px 8px";
      links.forEach((a) => {
        a.style.width = "36px";
        a.style.justifyContent = "center";
      });
    }
  } catch {}
}

// initial sync
applySocialLinksLayout();

// ==============================
// Collapsible groups (accordion-like) with persistence
// ==============================
const GROUPS_KEY = "sidebarGroupsState";

function loadGroupsState() {
  try {
    return JSON.parse(localStorage.getItem(GROUPS_KEY) || "{}") || {};
  } catch {
    return {};
  }
}
function saveGroupsState(state) {
  try {
    localStorage.setItem(GROUPS_KEY, JSON.stringify(state));
  } catch {}
}

function setCollapseMaxHeight(container, expanded) {
  if (!container) return;
  if (expanded) {
    container.hidden = false;
    // set a large max-height based on content
    container.style.maxHeight = container.scrollHeight + "px";
    // after transition, allow auto height for dynamic content
    const onEnd = () => {
      container.style.maxHeight = "none";
      container.removeEventListener("transitionend", onEnd);
    };
    container.addEventListener("transitionend", onEnd, { once: true });
  } else {
    // ensure transition from a numeric value
    if (getComputedStyle(container).maxHeight === "none") {
      container.style.maxHeight = container.scrollHeight + "px";
      // force reflow
      void container.offsetHeight;
    }
    container.style.maxHeight = "0px";
    const onEnd = () => {
      container.hidden = true;
      container.removeEventListener("transitionend", onEnd);
    };
    container.addEventListener("transitionend", onEnd, { once: true });
  }
}

function initCollapsibleGroups() {
  try {
    const state = loadGroupsState();
    const titles = Array.from(
      sidebar.querySelectorAll(".sidebar-title[aria-controls]"),
    );
    titles.forEach((title) => {
      const id = String(
        title.getAttribute("data-group") || title.getAttribute("aria-controls"),
      );
      const contentId = title.getAttribute("aria-controls");
      if (!contentId) return;
      const container = sidebar.querySelector("#" + CSS.escape(contentId));
      if (!container) return;

      const stored = state[id];
      const expanded = stored === undefined ? true : stored === true;
      title.setAttribute("aria-expanded", String(expanded));
      container.hidden = !expanded;
      requestAnimationFrame(() => setCollapseMaxHeight(container, expanded));

      const toggle = () => {
        const nowExpanded = title.getAttribute("aria-expanded") !== "true";
        title.setAttribute("aria-expanded", String(nowExpanded));
        setCollapseMaxHeight(container, nowExpanded);
        const cur = loadGroupsState();
        cur[id] = nowExpanded;
        saveGroupsState(cur);
      };

      title.addEventListener("click", (e) => {
        e.preventDefault();
        toggle();
      });
      title.addEventListener("keydown", (e) => {
        if (e.key === "Enter" || e.key === " ") {
          e.preventDefault();
          toggle();
        }
      });
    });
  } catch {}
}

// init collapsible groups after layout
initCollapsibleGroups();
