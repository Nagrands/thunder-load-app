// src/js/modules/network.js

import { showToast } from "./toast.js";
import { t } from "./i18n.js";

const STATUS_ONLINE = "online";
const STATUS_OFFLINE = "offline";

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

  window.addEventListener("i18n:changed", () => updateNetworkIndicator());
}

export { initNetworkListeners };
