import { initTooltips } from "./tooltipInitializer.js";
import { getLanguage, t } from "./i18n.js";
import { readDeveloperModeEnabled } from "./developerMode.js";
import { getHistoryData } from "./state.js";

const dom = {
  root: null,
  version: null,
  toolsAction: null,
  sidebarToggle: null,
  toolsStatus: null,
  sidebarNavHost: null,
  groupMenu: null,
  formatButton: null,
  historySection: null,
  historyList: null,
  historyCount: null,
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
  dom.historySection = document.getElementById("app-sidebar-history");
  dom.historyList = document.getElementById("app-sidebar-history-list");
  dom.historyCount = document.getElementById("app-sidebar-history-count");

  try {
    state.toolsHiddenByPreference =
      localStorage.getItem("downloaderToolsStatusHidden") === "1";
    state.sidebarCollapsed =
      localStorage.getItem("appSidebarCollapsed") === "1";
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

function renderRecentHistory() {
  if (!dom.historySection || !dom.historyList) return;
  let count = 3;
  try {
    const savedCount = localStorage.getItem("appSidebarHistoryCount");
    if (["0", "3", "6"].includes(savedCount)) count = Number(savedCount);
  } catch {}
  const entries = (Array.isArray(getHistoryData()) ? getHistoryData() : [])
    .map((entry, index) => ({ entry, index, date: getHistoryDate(entry) }))
    .sort((a, b) => {
      if (a.date === null && b.date === null) return a.index - b.index;
      if (a.date === null) return 1;
      if (b.date === null) return -1;
      return b.date - a.date;
    })
    .slice(0, count);
  dom.historySection.hidden = count === 0 || entries.length === 0;
  if (dom.historyCount) dom.historyCount.textContent = String(entries.length);
  dom.historyList.replaceChildren();
  entries.forEach(({ entry, date }) => {
    const status =
      entry?.isMissing || entry?.status === "missing"
        ? "missing"
        : entry?.error ||
            entry?.status === "failed" ||
            entry?.downloadStatus === "failed"
          ? "failed"
          : "completed";
    const item = document.createElement("article");
    item.className = "app-sidebar-history__item";
    item.setAttribute("role", "listitem");
    const indicator = document.createElement("span");
    indicator.className = `app-sidebar-history__status is-${status}`;
    indicator.setAttribute("aria-hidden", "true");
    const content = document.createElement("span");
    content.className = "app-sidebar-history__content";
    const title = document.createElement("span");
    title.className = "app-sidebar-history__title";
    title.textContent =
      entry?.fileName ||
      entry?.title ||
      entry?.sourceUrl ||
      t("history.file.untitled");
    title.title = title.textContent;
    const meta = document.createElement("span");
    meta.className = "app-sidebar-history__meta";
    const statusText = document.createElement("span");
    statusText.className = `app-sidebar-history__status-label is-${status}`;
    statusText.textContent = t(`sidebar.history.${status}`);
    const time = document.createElement("time");
    time.className = "app-sidebar-history__time";
    time.textContent = date
      ? date.toLocaleString(getLanguage() === "ru" ? "ru-RU" : "en-US", {
          day: "2-digit",
          month: "2-digit",
          hour: "2-digit",
          minute: "2-digit",
          hour12: false,
        })
      : t("sidebar.history.unknownTime");
    if (date) time.dateTime = date.toISOString();
    meta.append(statusText, time);
    content.append(title, meta);
    item.append(indicator, content);
    dom.historyList.appendChild(item);
  });
}

function getHistoryDate(entry = {}) {
  const raw =
    entry.timestamp || entry.createdAt || entry.dateText || entry.dateTime;
  if (!raw) return null;
  const date = new Date(raw);
  return Number.isNaN(date.getTime()) ? null : date;
}

async function openFormatWindow() {
  try {
    const response = await window.electron?.invoke?.("open-format-window");
    if (!response?.success) {
      console.error(
        "[sidebarNavigation] Failed to open Format window:",
        response?.error,
      );
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
  renderRecentHistory();
  try {
    initTooltips();
  } catch {}
}

function syncSidebarCollapsed() {
  document.body.classList.toggle(
    "app-sidebar-collapsed",
    state.sidebarCollapsed,
  );
  dom.sidebarToggle?.setAttribute(
    "aria-expanded",
    String(!state.sidebarCollapsed),
  );
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
    localStorage.setItem(
      "appSidebarCollapsed",
      state.sidebarCollapsed ? "1" : "0",
    );
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
    window.addEventListener("history:data-changed", renderRecentHistory);
    window.addEventListener(
      "app-sidebar:history-count-changed",
      renderRecentHistory,
    );
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
  renderRecentHistory();
  void refreshVersion();

  try {
    initTooltips();
  } catch {}
}

export { initSidebarNavigation };
