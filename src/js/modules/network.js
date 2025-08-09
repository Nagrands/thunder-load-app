// src/js/modules/network.js

import { showToast } from "./toast.js";

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
  });

  window.addEventListener("offline", () => {
    showToast(
      "Отсутствует подключение к интернету. Пожалуйста, проверьте соединение.",
      "error",
    );
  });

  // Проверка состояния сети при загрузке страницы
  checkInternetConnection();
}

export { initNetworkListeners };
