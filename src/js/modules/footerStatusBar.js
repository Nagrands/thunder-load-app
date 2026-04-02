import { initTooltips } from "./tooltipInitializer.js";
import { t } from "./i18n.js";

const TAB_LABEL_MAP = {
  download: "tabs.download",
  wireguard: "tabs.tools",
  backup: "tabs.backup",
};

const dom = {
  root: null,
  version: null,
  activeSection: null,
  settingsAction: null,
  backToTopAction: null,
  statusCluster: null,
  footerNavHost: null,
  topBar: null,
  topBarCenter: null,
  topNavHost: null,
  sentinel: null,
};

const state = {
  isInitialized: false,
  observer: null,
  fallbackBound: false,
  resizeBound: false,
  isFooterNavMode: false,
  pendingMode: null,
  pendingTimer: null,
};

const NAV_ENTER_SCROLL_Y = 12;
const NAV_EXIT_SCROLL_Y = 4;
const NAV_SWITCH_DELAY_MS = 90;

function setSoftVisibility(element, visible) {
  if (!element) return;
  element.hidden = false;
  element.classList.toggle("is-hidden", !visible);
  element.setAttribute("aria-hidden", visible ? "false" : "true");
}

function bindDom() {
  dom.root = document.getElementById("app-footer");
  dom.version = document.getElementById("footer-app-version");
  dom.activeSection = document.getElementById("footer-active-section");
  dom.settingsAction = document.getElementById("footer-open-settings");
  dom.backToTopAction = document.getElementById("footer-back-to-top");
  dom.statusCluster = document.getElementById("footer-status-cluster");
  dom.footerNavHost = document.getElementById("footer-tab-nav");
  dom.topBar = document.querySelector(".top-bar");
  dom.topBarCenter = document.querySelector(".top-bar__center");
  dom.topNavHost = document.querySelector(".center-menu");
  dom.sentinel = document.getElementById("nav-visibility-sentinel");

  return !!(
    dom.root &&
    dom.version &&
    dom.activeSection &&
    dom.settingsAction &&
    dom.backToTopAction &&
    dom.statusCluster &&
    dom.footerNavHost &&
    dom.topBar &&
    dom.topBarCenter &&
    dom.topNavHost &&
    dom.sentinel
  );
}

function getGroupMenu() {
  return document.querySelector(".group-menu");
}

function resolveTopBarHeight() {
  try {
    const raw = getComputedStyle(document.documentElement).getPropertyValue(
      "--topbar-current-height",
    );
    const cssValue = Number.parseFloat(raw);
    if (cssValue > 0) return cssValue;
  } catch {}

  try {
    const height = dom.topBar?.getBoundingClientRect?.().height || 0;
    if (height > 0) return height;
  } catch {}

  return 96;
}

function resolveScrollY() {
  return (
    window.scrollY ||
    window.pageYOffset ||
    document.documentElement?.scrollTop ||
    document.body?.scrollTop ||
    0
  );
}

function updateActiveSection(tabId = "") {
  if (!dom.activeSection) return;

  const activeButton = document.querySelector(".group-menu .menu-item.active");
  const normalizedId =
    String(tabId || "").trim() || activeButton?.dataset?.menu || "";
  const fallbackLabel =
    activeButton?.querySelector(".menu-text")?.textContent?.trim() ||
    t("tabs.download");
  const labelKey = TAB_LABEL_MAP[normalizedId];
  const label = labelKey ? t(labelKey) : fallbackLabel;

  dom.activeSection.textContent = label;
  dom.activeSection.setAttribute("title", label);
  dom.activeSection.setAttribute("data-bs-original-title", label);
}

async function refreshVersion() {
  try {
    const version = await window.electron?.invoke?.("get-version");
    const label = version ? `v${version}` : "v?";
    dom.version.textContent = label;
    dom.version.setAttribute("title", label);
    dom.version.setAttribute("data-bs-original-title", label);
  } catch (error) {
    console.warn("[footerStatusBar] Failed to resolve app version:", error);
    dom.version.textContent = "v?";
  }
}

function moveGroupMenu(target) {
  const groupMenu = getGroupMenu();
  if (!groupMenu || !target || groupMenu.parentElement === target) return;
  target.appendChild(groupMenu);
}

function applyNavigationMode(useFooterNav) {
  state.isFooterNavMode = !!useFooterNav;
  state.pendingMode = null;

  dom.root?.classList.toggle("app-footer--nav-mode", state.isFooterNavMode);
  dom.topBar?.classList.toggle("top-bar--nav-detached", state.isFooterNavMode);
  dom.topBarCenter?.classList.toggle(
    "top-bar__center--hidden",
    state.isFooterNavMode,
  );

  setSoftVisibility(dom.statusCluster, !state.isFooterNavMode);
  setSoftVisibility(dom.footerNavHost, state.isFooterNavMode);
  setSoftVisibility(dom.backToTopAction, state.isFooterNavMode);
  if (dom.topBarCenter) {
    dom.topBarCenter.setAttribute(
      "aria-hidden",
      state.isFooterNavMode ? "true" : "false",
    );
  }

  moveGroupMenu(state.isFooterNavMode ? dom.footerNavHost : dom.topNavHost);
}

function clearPendingNavigationMode() {
  if (state.pendingTimer) {
    window.clearTimeout(state.pendingTimer);
    state.pendingTimer = null;
  }
}

function scheduleNavigationMode(nextMode) {
  if (nextMode === state.isFooterNavMode) {
    state.pendingMode = null;
    clearPendingNavigationMode();
    return;
  }

  if (state.pendingMode === nextMode) return;

  clearPendingNavigationMode();
  state.pendingMode = nextMode;
  state.pendingTimer = window.setTimeout(() => {
    state.pendingTimer = null;
    if (state.pendingMode === nextMode) {
      applyNavigationMode(nextMode);
    }
  }, NAV_SWITCH_DELAY_MS);
}

function resolveDesiredNavigationMode(sentinelTop) {
  if (state.isFooterNavMode) {
    return sentinelTop > NAV_EXIT_SCROLL_Y;
  }
  return sentinelTop > NAV_ENTER_SCROLL_Y;
}

function evaluateNavigationMode(sentinelTop = null) {
  try {
    const top =
      typeof sentinelTop === "number"
        ? sentinelTop
        : resolveScrollY();
    scheduleNavigationMode(resolveDesiredNavigationMode(top));
  } catch {
    applyNavigationMode(false);
  }
}

function bindFallbackScrollObserver() {
  if (state.fallbackBound) return;

  const handleScroll = () => {
    applyNavigationMode(resolveDesiredNavigationMode(resolveScrollY()));
  };

  window.addEventListener("scroll", handleScroll, { passive: true });
  window.addEventListener("resize", handleScroll);
  state.fallbackBound = true;
}

function setupNavigationObserver() {
  bindFallbackScrollObserver();

  if (state.observer) {
    state.observer.disconnect();
    state.observer = null;
  }

  if (!dom.sentinel) return;

  if (typeof window.IntersectionObserver !== "function") {
    applyNavigationMode(resolveDesiredNavigationMode(resolveScrollY()));
    return;
  }

  const topOffset = Math.round(resolveTopBarHeight());
  state.observer = new window.IntersectionObserver(
    (entries) => {
      const [entry] = entries;
      if (!entry) return;
      evaluateNavigationMode(resolveScrollY());
    },
    {
      threshold: 0,
      rootMargin: `-${topOffset}px 0px 0px 0px`,
    },
  );

  state.observer.observe(dom.sentinel);
  evaluateNavigationMode();
}

function handleTabsActivated(event) {
  updateActiveSection(event?.detail?.id);
}

function handleI18nChanged() {
  updateActiveSection();
  setupNavigationObserver();
  try {
    initTooltips();
  } catch {}
}

function handleResize() {
  setupNavigationObserver();
}

function scrollToTop() {
  try {
    window.scrollTo({ top: 0, behavior: "smooth" });
  } catch {
    try {
      window.scrollTo(0, 0);
    } catch {}
  }
}

function initFooterStatusBar() {
  if (!bindDom()) return;

  if (!state.isInitialized) {
    dom.backToTopAction.addEventListener("click", () => {
      scrollToTop();
    });

    window.addEventListener("tabs:activated", handleTabsActivated);
    window.addEventListener("i18n:changed", handleI18nChanged);

    if (!state.resizeBound) {
      window.addEventListener("resize", handleResize);
      state.resizeBound = true;
    }

    state.isInitialized = true;
  }

  updateActiveSection();
  applyNavigationMode(state.isFooterNavMode);
  setupNavigationObserver();
  void refreshVersion();

  try {
    initTooltips();
  } catch {}
}

export { initFooterStatusBar };
