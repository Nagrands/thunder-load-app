import { initTooltips } from "./tooltipInitializer.js";
import { t } from "./i18n.js";
import { readDeveloperModeEnabled } from "./developerMode.js";

const dom = {
  root: null,
  version: null,
  toolsAction: null,
  sidebarToggle: null,
  toolsStatus: null,
  sidebarNavHost: null,
  groupMenu: null,
  formatButton: null,
};

const state = {
  isInitialized: false,
  activeTabId: "download",
  toolsHiddenByPreference: false,
  sidebarCollapsed: false,
};

function setSoftVisibility(element, visible) {
  if (!element) return;
  element.hidden = false;
  element.classList.toggle("is-hidden", !visible);
  element.setAttribute("aria-hidden", visible ? "false" : "true");
}

function bindDom() {
  dom.root = document.getElementById("app-sidebar");
  dom.version = document.getElementById("sidebar-app-version");
  dom.toolsAction = document.getElementById("dl-tools-action");
  dom.sidebarToggle = document.getElementById("app-sidebar-toggle");
  dom.toolsStatus = document.getElementById("sidebar-tools-status");
  dom.sidebarNavHost = document.getElementById("sidebar-tab-nav");
  dom.groupMenu = document.querySelector(".group-menu");
  dom.formatButton = document.getElementById("sidebar-open-format");

  try {
    state.toolsHiddenByPreference =
      localStorage.getItem("downloaderToolsStatusHidden") === "1";
    state.sidebarCollapsed = localStorage.getItem("appSidebarCollapsed") === "1";
  } catch {
    state.toolsHiddenByPreference = false;
    state.sidebarCollapsed = false;
  }

  return !!(
    dom.root &&
    dom.version &&
    dom.toolsAction &&
    dom.sidebarToggle &&
    dom.toolsStatus &&
    dom.sidebarNavHost &&
    dom.groupMenu
  );
}

function syncFormatVisibility() {
  if (!dom.formatButton) return;
  dom.formatButton.hidden = !readDeveloperModeEnabled();
}

async function openFormatWindow() {
  try {
    const response = await window.electron?.invoke?.("open-format-window");
    if (!response?.success) {
      console.error("[sidebarNavigation] Failed to open Format window:", response?.error);
    }
  } catch (error) {
    console.error("[sidebarNavigation] Failed to open Format window:", error);
  }
}

function syncToolsVisibility() {
  if (!dom.toolsStatus || !dom.toolsAction) return;
  const locallyHidden =
    state.toolsHiddenByPreference ||
    dom.toolsStatus.classList.contains("hidden");
  const shouldShow = state.activeTabId === "download" && !locallyHidden;
  dom.toolsStatus.classList.toggle("is-context-hidden", !shouldShow);
  dom.toolsStatus.setAttribute("aria-hidden", shouldShow ? "false" : "true");
  dom.toolsAction.classList.toggle("is-context-hidden", !shouldShow);
  dom.toolsAction.setAttribute("aria-hidden", shouldShow ? "false" : "true");
}

async function refreshVersion() {
  try {
    const version = await window.electron?.invoke?.("get-version");
    const label = version ? `v${version}` : "v?";
    dom.version.textContent = label;
    dom.version.setAttribute("title", label);
    dom.version.setAttribute("data-bs-original-title", label);
  } catch (error) {
    console.warn("[sidebarNavigation] Failed to resolve app version:", error);
    dom.version.textContent = "v?";
  }
}

function handleTabsActivated(event) {
  state.activeTabId = String(event?.detail?.id || "").trim() || "download";
  syncToolsVisibility();
}

function handleI18nChanged() {
  syncToolsVisibility();
  try {
    initTooltips();
  } catch {}
}

function syncSidebarCollapsed() {
  document.body.classList.toggle("app-sidebar-collapsed", state.sidebarCollapsed);
  dom.sidebarToggle?.setAttribute("aria-expanded", String(!state.sidebarCollapsed));
  const label = state.sidebarCollapsed
    ? t("sidebar.expandSidebar")
    : t("sidebar.collapseSidebar");
  dom.sidebarToggle?.setAttribute("aria-label", label);
  dom.sidebarToggle?.setAttribute("title", label);
  dom.sidebarToggle?.setAttribute("data-bs-original-title", label);
  const icon = dom.sidebarToggle?.querySelector("i");
  icon?.classList.toggle("fa-angles-left", !state.sidebarCollapsed);
  icon?.classList.toggle("fa-angles-right", state.sidebarCollapsed);
  try {
    localStorage.setItem("appSidebarCollapsed", state.sidebarCollapsed ? "1" : "0");
  } catch {}
}

function initSidebarNavigation() {
  if (!bindDom()) return;

  if (!state.isInitialized) {
    dom.sidebarToggle.addEventListener("click", () => {
      state.sidebarCollapsed = !state.sidebarCollapsed;
      syncSidebarCollapsed();
    });
    window.addEventListener("tabs:activated", handleTabsActivated);
    window.addEventListener("i18n:changed", handleI18nChanged);
    window.addEventListener("tools:visibility", (event) => {
      state.toolsHiddenByPreference = event?.detail?.hidden === true;
      syncToolsVisibility();
    });
    window.addEventListener(
      "tools:developer-unlock-changed",
      syncFormatVisibility,
    );
    dom.formatButton?.addEventListener("click", openFormatWindow);
    state.isInitialized = true;
  }

  dom.groupMenu.setAttribute("role", "tablist");
  dom.groupMenu.setAttribute("aria-label", t("topbar.nav"));
  dom.sidebarNavHost.prepend(dom.groupMenu);
  syncSidebarCollapsed();
  state.activeTabId =
    document.querySelector(".group-menu .menu-item.active")?.dataset?.menu ||
    "download";
  syncFormatVisibility();
  setSoftVisibility(dom.sidebarNavHost, true);
  syncToolsVisibility();
  void refreshVersion();

  try {
    initTooltips();
  } catch {}
}

export { initSidebarNavigation };
