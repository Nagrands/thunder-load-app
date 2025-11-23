// src/js/modules/downloaderToolsStatus.js

import { showToast } from "./toast.js";
import { initTooltips } from "./tooltipInitializer.js";
import { summarizeToolsState } from "./toolsInfo.js";

let isInitialized = false;
let isLoading = false;

const el = {
  line: null,
  icon: null,
  text: null,
  reinstall: null,
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
    const msg =
      summary.state === "ok" ? "Инструменты готовы" : summary.text;
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
  if (!window.electron?.tools?.installAll) {
    showToast("Перестановка недоступна в этой сборке.", "warning");
    setState("error", "Перестановка недоступна");
    return;
  }
  if (isLoading) return;
  isLoading = true;
  el.reinstall.disabled = true;
  setState("loading", "Переустанавливаем зависимости…");
  try {
    await window.electron.tools.installAll({ force: true });
    showToast("Инструменты переустановлены", "success");
  } catch (error) {
    console.error("[downloaderToolsStatus] installAll failed:", error);
    showToast(
      "Не удалось переустановить инструменты. Проверьте логи.",
      "error",
    );
    setState("error", "Ошибка переустановки");
  } finally {
    el.reinstall.disabled = false;
    isLoading = false;
    fetchStatus();
  }
}

function bindDom() {
  el.line = document.getElementById("dl-tools-status");
  el.icon = document.getElementById("dl-tools-icon");
  el.text = document.getElementById("dl-tools-text");
  el.reinstall = document.getElementById("dl-tools-reinstall");
  el.badges = document.getElementById("dl-tools-badges");
  if (!el.line || !el.icon || !el.text || !el.reinstall || !el.badges)
    return false;

  el.reinstall.addEventListener("click", () => reinstallTools());
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
