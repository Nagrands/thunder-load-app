// src/js/modules/downloaderToolsStatus.js

import { hideAllTooltips, initTooltips } from "./tooltipInitializer.js";
import { installAllTools, summarizeToolsState } from "./toolsInfo.js";
import { t } from "./i18n.js";
import { logRendererError } from "./rendererDiagnostics.js";

let isInitialized = false;
let isLoading = false;
let isActionRunning = false;
let currentAction = null;

function logError(event, error) {
  logRendererError("Downloader", event, error);
}

const el = {
  container: null,
  line: null,
  icon: null,
  text: null,
  action: null,
  actionIcon: null,
  actionLabel: null,
  badges: null,
};

const setBadges = (details = []) => {
  if (!el.badges) return;
  el.badges.innerHTML = "";
  const frag = document.createDocumentFragment();
  details.forEach((tool) => {
    const badge = document.createElement("span");
    badge.className = `tool-badge ${tool.ok ? "ok" : "missing"}`;
    badge.dataset.tool = tool.id;
    const ver = tool.version || "—";
    badge.innerHTML = `<span class="tool-badge__state" aria-hidden="true"><i class="fa-solid ${tool.ok ? "fa-check" : "fa-xmark"}"></i></span><span class="tool-badge__label">${tool.label}</span>${tool.ok ? ` <span class="tool-badge__version">${ver}${tool.skip ? " (macOS)" : ""}</span>` : ""}`;
    frag.appendChild(badge);
  });
  el.badges.appendChild(frag);
};

function hideAction() {
  if (!el.action) return;
  currentAction = null;
  el.action.classList.add("hidden");
  el.action.classList.remove("is-busy");
  el.action.disabled = false;
  el.action.setAttribute("aria-hidden", "true");
  el.action.setAttribute("title", "");
  el.action.setAttribute("data-bs-original-title", "");
}

function setAction(action) {
  if (!el.action || !el.actionLabel || !el.actionIcon) return;
  if (action !== "install") {
    hideAction();
    return;
  }
  currentAction = action;
  const labelKey = "tools.button.install";
  const titleKey = "downloader.tools.installTitle";
  const label = t(labelKey);
  const title = t(titleKey);

  el.actionLabel.textContent = label;
  el.actionLabel.setAttribute("data-i18n", labelKey);
  el.actionIcon.className = "fa-solid fa-download";
  el.action.classList.remove("hidden");
  el.action.classList.toggle("is-busy", isActionRunning);
  el.action.disabled = isActionRunning;
  el.action.setAttribute("aria-hidden", "false");
  el.action.setAttribute("title", title);
  el.action.setAttribute("data-bs-original-title", title);
  el.action.setAttribute("data-i18n-title", titleKey);
}

function setActionBusy(isBusy, action = currentAction) {
  if (!el.action || !el.actionIcon || !el.actionLabel) return;
  isActionRunning = isBusy;
  el.action.classList.toggle("is-busy", isBusy);
  el.action.disabled = isBusy;
  if (!action) return;
  el.actionIcon.className = isBusy
    ? "fa-solid fa-circle-notch fa-spin"
    : "fa-solid fa-download";
  el.actionLabel.textContent = isBusy
    ? t("tools.status.installing")
    : t("tools.button.install");
}

const setState = (state, message, details = [], action = null) => {
  if (!el.line || !el.icon || !el.text || !el.action) return;

  el.line.classList.remove("is-ok", "is-error", "is-loading");
  hideAllTooltips();
  hideAction();

  switch (state) {
    case "ok":
      el.line.classList.add("is-ok");
      el.icon.className = "fa-solid fa-check";
      el.text.textContent = message || t("tools.status.ready");
      setBadges(details);
      setAction(action);
      break;
    case "error":
      el.line.classList.add("is-error");
      el.icon.className = "fa-solid fa-triangle-exclamation";
      el.text.textContent = message || t("tools.status.unavailable");
      setBadges(details);
      setAction(action);
      break;
    case "loading":
    default:
      el.line.classList.add("is-loading");
      el.icon.className = "fa-solid fa-circle-notch fa-spin";
      el.text.textContent = message || t("tools.status.checking");
      setBadges([]);
      break;
  }
};

async function showToast(message, tone) {
  await window.electron?.invoke?.("toast", message, tone);
}

async function fetchStatus() {
  if (!window.electron?.tools?.getVersions) {
    setState("error", t("tools.status.bridgeMissing"));
    return;
  }
  if (isLoading) return;
  isLoading = true;
  setState("loading");
  try {
    const res = await window.electron.tools.getVersions();
    const summary = summarizeToolsState(res);
    if (summary.state !== "ok") {
      setState("error", summary.text, summary.details, "install");
      return;
    }
    // Version/update network checks belong to the explicitly opened Tools view.
    // The Downloader footer only needs the local availability snapshot.
    setState("ok", t("tools.status.ready"), summary.details);
  } catch (error) {
    logError("tools-status-refresh-failed", error);
    setState("error", t("tools.status.error"));
  } finally {
    isLoading = false;
  }
}

async function runAction() {
  const action = currentAction;
  if (action !== "install" || isActionRunning) return;
  if (!navigator.onLine) {
    setState("error", t("tools.status.noNetwork"), [], action);
    return;
  }

  try {
    setActionBusy(true, action);
    setState("loading", t("tools.status.installing"));
    setAction(action);
    setActionBusy(true, action);
    await installAllTools();
    await showToast(t("tools.toast.installSuccess"), "success");
    await fetchStatus();
  } catch (error) {
    logError("tools-status-action-failed", error);
    const message = t("tools.error.install");
    setState("error", message, [], action);
    await showToast(message, "error");
  } finally {
    isActionRunning = false;
  }
}

function bindDom() {
  el.container = document.getElementById("footer-tools-status");
  el.line = document.getElementById("dl-tools-status");
  el.icon = document.getElementById("dl-tools-icon");
  el.text = document.getElementById("dl-tools-text");
  el.action = document.getElementById("dl-tools-action");
  el.actionIcon = document.getElementById("dl-tools-action-icon");
  el.actionLabel = document.getElementById("dl-tools-action-label");
  el.badges = document.getElementById("dl-tools-badges");
  if (
    !el.container ||
    !el.line ||
    !el.icon ||
    !el.text ||
    !el.action ||
    !el.actionIcon ||
    !el.actionLabel ||
    !el.badges
  )
    return false;

  // На случай старого состояния скрытия (display: none)
  el.container.classList.remove("hidden");

  const HIDDEN_KEY = "downloaderToolsStatusHidden";
  try {
    if (localStorage.getItem(HIDDEN_KEY) === "1") {
      el.container.classList.add("hidden");
      el.container.setAttribute("aria-hidden", "true");
    }
  } catch {}

  el.action.addEventListener("click", () => {
    runAction();
  });
  window.addEventListener("tools:visibility", (ev) => {
    const hidden = ev?.detail?.hidden === true;
    el.container.classList.toggle("hidden", hidden);
    el.container.setAttribute("aria-hidden", hidden ? "true" : "false");
    try {
      if (hidden) localStorage.setItem(HIDDEN_KEY, "1");
      else localStorage.removeItem(HIDDEN_KEY);
    } catch {}
    if (!hidden) fetchStatus();
  });
  // Слушаем broadcast от блока настроек, чтобы обновлять UI после переустановки
  window.addEventListener("tools:status", (ev) => {
    const summary = ev?.detail?.summary;
    if (summary) {
      if (summary.state === "ok") {
        fetchStatus();
        return;
      }
      setState("error", summary.text, summary.details, "install");
    } else {
      fetchStatus();
    }
  });
  return true;
}

export function initDownloaderToolsStatus() {
  if (isInitialized) {
    fetchStatus();
    return;
  }
  if (!bindDom()) return;

  isInitialized = true;
  fetchStatus();
  try {
    initTooltips();
  } catch {}

  // Перепроверка при восстановлении сети
  const onNet = () => fetchStatus();
  window.addEventListener("online", onNet);
  window.addEventListener("offline", onNet);
}
