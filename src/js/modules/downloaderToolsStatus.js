// src/js/modules/downloaderToolsStatus.js

import { showToast } from "./toast.js";
import { initTooltips } from "./tooltipInitializer.js";
import { summarizeToolsState } from "./toolsInfo.js";
import { openSettingsWithTab } from "./settingsModal.js";

let isInitialized = false;
let isLoading = false;

const el = {
  container: null,
  line: null,
  icon: null,
  text: null,
  reinstall: null,
  badges: null,
  toggle: null,
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
    badge.innerHTML = `<i class="fa-solid ${tool.ok ? "fa-check" : "fa-xmark"}"></i> ${tool.label}${tool.ok ? ` ${ver}${tool.skip ? " (macOS)" : ""}` : ""}`;
    frag.appendChild(badge);
  });
  el.badges.appendChild(frag);
};

const setState = (state, message, details = []) => {
  if (!el.line || !el.icon || !el.text || !el.reinstall) return;

  el.line.classList.remove("is-ok", "is-error", "is-loading");
  el.reinstall.classList.add("hidden");

  switch (state) {
    case "ok":
      el.line.classList.add("is-ok");
      el.icon.className = "fa-solid fa-check";
      el.text.textContent = message || "Инструменты готовы";
      setBadges(details);
      break;
    case "error":
      el.line.classList.add("is-error");
      el.icon.className = "fa-solid fa-triangle-exclamation";
      el.text.textContent = message || "Инструменты недоступны";
      el.reinstall.classList.remove("hidden");
      setBadges(details);
      break;
    case "loading":
    default:
      el.line.classList.add("is-loading");
      el.icon.className = "fa-solid fa-circle-notch fa-spin";
      el.text.textContent = message || "Проверяем инструменты…";
      setBadges([]);
      break;
  }
};

async function fetchStatus() {
  if (!window.electron?.tools?.getVersions) {
    setState("error", "Инструменты: bridge недоступен");
    return;
  }
  if (isLoading) return;
  isLoading = true;
  setState("loading");
  try {
    const res = await window.electron.tools.getVersions();
    const summary = summarizeToolsState(res);
    const msg = summary.state === "ok" ? "Инструменты готовы" : summary.text;
    setState(summary.state, msg, summary.details);
    if (summary.state === "ok") {
      el.reinstall.classList.add("hidden");
    } else {
      el.reinstall.classList.remove("hidden");
    }
  } catch (error) {
    console.error("[downloaderToolsStatus] getVersions failed:", error);
    setState("error", "Ошибка проверки инструментов");
  } finally {
    isLoading = false;
  }
}

async function reinstallTools() {
  // Вместо фоновой переустановки открываем настройки с вкладкой Downloader,
  // где есть полный менеджер инструментов.
  openSettingsWithTab("window-settings");
}

function bindDom() {
  el.container = document.querySelector(".downloader-tools-status");
  el.line = document.getElementById("dl-tools-status");
  el.icon = document.getElementById("dl-tools-icon");
  el.text = document.getElementById("dl-tools-text");
  el.reinstall = document.getElementById("dl-tools-reinstall");
  el.badges = document.getElementById("dl-tools-badges");
  el.toggle = document.getElementById("dl-tools-toggle");
  if (
    !el.container ||
    !el.line ||
    !el.icon ||
    !el.text ||
    !el.reinstall ||
    !el.badges ||
    !el.toggle
  )
    return false;

  // На случай старого состояния скрытия (display: none)
  el.container.classList.remove("hidden");

  const HIDDEN_KEY = "downloaderToolsStatusHidden";
  try {
    if (localStorage.getItem(HIDDEN_KEY) === "1") {
      el.container.classList.add("hidden");
    }
  } catch {}

  el.reinstall.addEventListener("click", () => reinstallTools());
  el.toggle.addEventListener("click", () => {
    el.container.classList.add("hidden");
    try {
      localStorage.setItem(HIDDEN_KEY, "1");
    } catch {}
    window.dispatchEvent(
      new CustomEvent("tools:visibility", { detail: { hidden: true } }),
    );
  });
  window.addEventListener("tools:visibility", (ev) => {
    const hidden = ev?.detail?.hidden === true;
    el.container.classList.toggle("hidden", hidden);
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
      const msg = summary.state === "ok" ? "Инструменты готовы" : summary.text;
      setState(summary.state, msg, summary.details);
      if (summary.state === "ok") {
        el.reinstall.classList.add("hidden");
      } else {
        el.reinstall.classList.remove("hidden");
      }
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
