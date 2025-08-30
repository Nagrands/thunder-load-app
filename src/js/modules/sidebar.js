// src/js/modules/sidebar.js

import { sidebar, overlay, toggleBtn, settingsModal, collapseSidebarButton } from "./domElements.js";

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
function openSettings() {
  settingsModal.style.display = "flex";
  settingsModal.style.justifyContent = "center";
  settingsModal.style.alignItems = "center";
  // overlay.classList.add("active");
  hideSidebar();
}

/**
 * Функция для закрытия настроек
 */
function closeSettings() {
  settingsModal.style.display = "none";
  overlay.classList.remove("active");
}

document.getElementById("open-github")?.addEventListener("click", () => {
  const url = "https://github.com/Nagrands/thunder-load-app";
  window.electron.invoke("open-external-link", url);
});

export { toggleSidebar, hideSidebar, openSettings, closeSettings };

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
    collapseSidebarButton?.setAttribute("aria-pressed", String(!!collapsed));
    collapseSidebarButton?.setAttribute("title", collapsed ? "Развернуть меню" : "Свернуть меню");
    collapseSidebarButton?.classList.toggle('is-active', !!collapsed);
    applySocialLinksLayout();
  } catch {}
}

function toggleCollapsed() {
  const collapsed = !sidebar.classList.contains("is-collapsed");
  sidebar.classList.toggle("is-collapsed", collapsed);
  try { localStorage.setItem(COLLAPSE_KEY, JSON.stringify(collapsed)); } catch {}
  collapseSidebarButton?.setAttribute("aria-pressed", String(collapsed));
  collapseSidebarButton?.setAttribute("title", collapsed ? "Развернуть меню" : "Свернуть меню");
  collapseSidebarButton?.classList.toggle('is-active', collapsed);
  applySocialLinksLayout();
}

// Pinned state handling
function applyPinnedFromStore() {
  try {
    const raw = localStorage.getItem(PIN_KEY);
    const pinned = raw ? JSON.parse(raw) === true : false;
    sidebar?.classList.toggle("is-pinned", !!pinned);
    collapseSidebarButton?.setAttribute("aria-pressed", String(!!pinned));
    collapseSidebarButton?.setAttribute("title", pinned ? "Открепить меню" : "Закрепить меню");
    collapseSidebarButton?.classList.toggle("is-active", !!pinned);
    if (pinned) {
      sidebar.classList.add("active");
      overlay.classList.remove("active");
      // В закреплённом режиме оставляем видимой кнопку-тогглер
      toggleBtn.classList.remove("hidden");
    } else {
      // ensure default horizontal layout by removing collapse if any
      sidebar.classList.remove("is-collapsed");
      try { localStorage.setItem(COLLAPSE_KEY, JSON.stringify(false)); } catch {}
    }
    applySocialLinksLayout();
  } catch {}
}

function togglePinned() {
  const willPin = !sidebar.classList.contains("is-pinned");
  sidebar.classList.toggle("is-pinned", willPin);
  try { localStorage.setItem(PIN_KEY, JSON.stringify(willPin)); } catch {}
  collapseSidebarButton?.setAttribute("aria-pressed", String(willPin));
  collapseSidebarButton?.setAttribute("title", willPin ? "Открепить меню" : "Закрепить меню");
  collapseSidebarButton?.classList.toggle("is-active", willPin);
  // Закрепляя — показываем без overlay; открепляя — оставляем текущее состояние
  if (willPin) {
    sidebar.classList.add("active");
    overlay.classList.remove("active");
    toggleBtn.classList.remove("hidden");
  } else {
    // При откреплении возвращаем горизонтальный вид и ширину
    if (sidebar.classList.contains("is-collapsed")) {
      sidebar.classList.remove("is-collapsed");
      try { localStorage.setItem(COLLAPSE_KEY, JSON.stringify(false)); } catch {}
    }
  }
  applySocialLinksLayout();
}

// Close regardless of pinned (used by close button)
function closeSidebarForced() {
  sidebar.classList.remove("is-pinned", "active");
  try { localStorage.setItem(PIN_KEY, JSON.stringify(false)); } catch {}
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
    sidebar?.classList.toggle('is-drawer', isNarrow);
    if (isNarrow) {
      // Drawer режим не поддерживает закрепление/сворачивание
      if (sidebar.classList.contains('is-pinned')) {
        sidebar.classList.remove('is-pinned');
        __pinSuspendedOnDrawer = true; // запомним, что пин был активен
        collapseSidebarButton?.classList.remove('is-active');
        collapseSidebarButton?.setAttribute('aria-pressed', 'false');
        collapseSidebarButton?.setAttribute('title', 'Закрепить меню');
      }
      if (sidebar.classList.contains('is-collapsed')) {
        sidebar.classList.remove('is-collapsed');
        localStorage.setItem(COLLAPSE_KEY, JSON.stringify(false));
      }
    }
    // Возврат из drawer: восстановим закрепление, если было приостановлено или сохранено в store
    if (!isNarrow) {
      const storedPin = (() => { try { return JSON.parse(localStorage.getItem(PIN_KEY) || 'false') === true; } catch { return false; } })();
      if (__pinSuspendedOnDrawer || storedPin) {
        sidebar.classList.add('is-pinned', true);
        sidebar.classList.add('active');
        overlay.classList.remove('active');
        toggleBtn.classList.remove('hidden');
        collapseSidebarButton?.classList.add('is-active');
        collapseSidebarButton?.setAttribute('aria-pressed', 'true');
        collapseSidebarButton?.setAttribute('title', 'Открепить меню');
        __pinSuspendedOnDrawer = false;
      }
    }
    applySocialLinksLayout();
  } catch {}
}

window.addEventListener('resize', applyResponsiveMode);
// initial
applyResponsiveMode();

// ==============================
// Keyboard navigation (accessibility)
// ==============================
try {
  sidebar?.addEventListener('keydown', (e) => {
    const items = Array.from(sidebar.querySelectorAll('.sidebar-item'));
    if (items.length === 0) return;
    const currentIndex = items.indexOf(document.activeElement);
    const isDrawer = sidebar.classList.contains('is-drawer');
    const isPinned = sidebar.classList.contains('is-pinned');

    if (e.key === 'ArrowDown') {
      e.preventDefault();
      const next = items[(Math.max(0, currentIndex) + 1) % items.length];
      next?.focus();
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      const prev = items[(currentIndex > 0 ? currentIndex - 1 : items.length - 1) % items.length];
      prev?.focus();
    } else if (e.key === 'Home') {
      e.preventDefault();
      items[0]?.focus();
    } else if (e.key === 'End') {
      e.preventDefault();
      items[items.length - 1]?.focus();
    } else if (e.key === 'Escape') {
      // Close drawer on Esc if not pinned
      if (isDrawer && !isPinned && sidebar.classList.contains('active')) {
        sidebar.classList.remove('active');
        overlay?.classList.remove('active');
        toggleBtn?.classList.remove('hidden');
        e.preventDefault();
      }
    }
  });
} catch {}

// Keep social icon layout in sync with state (CSS fallback)
function applySocialLinksLayout() {
  try {
    const iconLinks = sidebar?.querySelector('.social-links .icon-links');
    if (!iconLinks) return;
    const pinned = sidebar.classList.contains('is-pinned');
    const links = iconLinks.querySelectorAll('a');
    if (pinned) {
      iconLinks.style.flexDirection = 'column';
      iconLinks.style.borderRadius = '12px';
      iconLinks.style.padding = '6px';
      links.forEach((a) => { a.style.width = '100%'; a.style.justifyContent = 'flex-start'; a.style.padding = '0 10px'; });
    } else {
      iconLinks.style.flexDirection = 'row';
      iconLinks.style.borderRadius = '999px';
      iconLinks.style.padding = '6px 8px';
      links.forEach((a) => { a.style.width = '36px'; a.style.justifyContent = 'center'; a.style.padding = '0'; });
    }
  } catch {}
}

// initial sync
applySocialLinksLayout();
