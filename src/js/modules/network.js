// src/js/modules/network.js

import { showToast } from "./toast.js";
import { t } from "./i18n.js";

const STATUS_ONLINE = "online";
const STATUS_OFFLINE = "offline";
const NETWORK_STATUS_VISIBILITY_KEY = "topbarNetworkStatusVisible";

function isNetworkStatusVisible() {
  try {
    const raw = localStorage.getItem(NETWORK_STATUS_VISIBILITY_KEY);
    if (raw === null) return false;
    return JSON.parse(raw) === true;
  } catch {
    return false;
  }
}

function applyNetworkStatusVisibility(forceVisible) {
  const statusEl = document.getElementById("network-status");
  if (!statusEl) return;
  const visible =
    typeof forceVisible === "boolean" ? forceVisible : isNetworkStatusVisible();
  statusEl.hidden = !visible;
  statusEl.setAttribute("aria-hidden", visible ? "false" : "true");
}

function updateNetworkIndicator(forceStatus) {
  const statusEl = document.getElementById("network-status");
  const textEl = document.getElementById("network-status-text");
  if (!statusEl || !textEl) return;
  const isOnline =
    forceStatus === STATUS_ONLINE
      ? true
      : forceStatus === STATUS_OFFLINE
        ? false
        : navigator.onLine;
  const nextStatus = isOnline ? STATUS_ONLINE : STATUS_OFFLINE;
  statusEl.dataset.status = nextStatus;
  const label = isOnline
    ? t("topbar.network.online")
    : t("topbar.network.offline");
  textEl.textContent = label;
  statusEl.setAttribute("title", label);
  statusEl.setAttribute("aria-label", label);
}

/**
 * Функция для проверки состояния сети
 */
function checkInternetConnection() {
  if (!navigator.onLine) {
    showToast(
      "Отсутствует подключение к интернету. Пожалуйста, проверьте соединение.",
      "error",
    );
  }
}

/**
 * Инициализация слушателей на изменение состояния сети
 */
function initNetworkListeners() {
  applyNetworkStatusVisibility();

  window.addEventListener("online", () => {
    showToast("Интернет-соединение восстановлено.", "success");
    updateNetworkIndicator(STATUS_ONLINE);
  });

  window.addEventListener("offline", () => {
    showToast(
      "Отсутствует подключение к интернету. Пожалуйста, проверьте соединение.",
      "error",
    );
    updateNetworkIndicator(STATUS_OFFLINE);
  });

  // Проверка состояния сети при загрузке страницы
  checkInternetConnection();
  updateNetworkIndicator();
  window.addEventListener("topbar:network-visibility", (event) => {
    applyNetworkStatusVisibility(event?.detail?.visible);
  });

  window.addEventListener("i18n:changed", () => updateNetworkIndicator());
}

export { initNetworkListeners };
