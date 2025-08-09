// src/js/modules/updateHandler.js

// Используем методы, предоставленные через contextBridge
const { electron } = window;

function hideUpdateProgressBar() {
  const container = document.getElementById("update-progress-container");
  if (container) container.style.display = "none";
}

function initUpdateHandler() {
  // Обработка сообщения о доступном обновлении
  hideUpdateProgressBar();
  electron.on("update-available", (message) => {
    showUpdateAvailableModal(message);
  });

  // Обработка сообщения о прогрессе загрузки
  electron.on("update-progress", (progress) => {
    updateProgressBar(progress);
  });

  // Обработка сообщения об ошибках
  electron.on("update-error", (error) => {
    showErrorNotification(error);
  });

  // Обработка сообщения о загруженном обновлении
  electron.on("update-downloaded", () => {
    showUpdateDownloadedModal();
  });

  // Обработка закрытия модальных окон при клике на кнопки закрытия
  document.querySelectorAll(".close-modal").forEach((button) => {
    button.addEventListener("click", (event) => {
      const modal = button.closest(".modal-overlay");
      if (modal) {
        hideUpdateProgressBar();
        modal.style.display = "none";
      }
    });
  });

  const closeErrorNotificationBtn = document.getElementById(
    "close-error-notification",
  );

  if (closeErrorNotificationBtn) {
    closeErrorNotificationBtn.addEventListener("click", () => {
      closeModal("update-error-modal");
    });
  }
}

/**
 * Функция для отображения модального окна с предложением загрузить обновление.
 * @param {string} message - Сообщение для пользователя.
 */
function showUpdateAvailableModal(message) {
  const modal = document.getElementById("update-available-modal");
  if (modal) {
    const modalBody = modal.querySelector(".modal-body p");
    if (modalBody) {
      modalBody.textContent = message;
    }
    modal.style.display = "flex";
    modal.style.flexDirection = "row";
    modal.style.justifyContent = "center";
    modal.style.alignItems = "center";

    // Обработчики кнопок
    const downloadBtn = document.getElementById("download-update-btn");
    const laterBtn = document.getElementById("later-update-btn");

    if (downloadBtn) {
      downloadBtn.onclick = () => {
        electron.invoke("download-update");
        closeModal("update-available-modal");
      };
    }

    if (laterBtn) {
      laterBtn.onclick = () => {
        closeModal("update-available-modal");
      };
    }
  }
}

/**
 * Функция для отображения модального окна после загрузки обновления.
 */
function showUpdateDownloadedModal() {
  const modal = document.getElementById("update-downloaded-modal");
  if (modal) {
    hideUpdateProgressBar();
    modal.style.display = "flex";
    modal.style.flexDirection = "row";
    modal.style.justifyContent = "center";
    modal.style.alignItems = "center";

    // Обработчики кнопок
    const restartBtn = document.getElementById("restart-app-btn");
    const laterRestartBtn = document.getElementById("later-restart-btn");

    if (restartBtn) {
      restartBtn.onclick = () => {
        electron.invoke("restart-app");
        closeModal("update-downloaded-modal");
      };
    }

    if (laterRestartBtn) {
      laterRestartBtn.onclick = () => {
        closeModal("update-downloaded-modal");
      };
    }
  }
}

/**
 * Функция для обновления прогресс-бара.
 * @param {number} percent - Процент загрузки обновления.
 */
function updateProgressBar(percent) {
  const progressContainer = document.getElementById(
    "update-progress-container",
  );
  const progressBar = document.getElementById("update-progress-bar");
  const progressText = document.getElementById("update-progress-text");

  if (progressContainer && progressBar && progressText) {
    progressContainer.style.display = "flex";
    progressContainer.style.flexDirection = "column";
    progressContainer.style.justifyContent = "center";
    progressContainer.style.alignItems = "center";

    progressBar.value = percent;
    if (typeof percent === "number") {
      progressText.textContent = `Загрузка обновления... ${percent.toFixed(2)}%`;
    } else {
      progressText.textContent = "Загрузка обновления...";
    }
  }
}

/**
 * Функция для отображения уведомления об ошибке.
 * @param {string} error - Сообщение об ошибке.
 */
function showErrorNotification(error) {
  const modal = document.getElementById("update-error-modal");
  const errorMessage = document.getElementById("update-error-message");

  if (modal && errorMessage) {
    hideUpdateProgressBar();
    errorMessage.textContent = `Ошибка обновления: ${error}`;
    modal.style.display = "flex";
    modal.style.flexDirection = "row";
    modal.style.justifyContent = "center";
    modal.style.alignItems = "center";
  }
}

/**
 * Функция для закрытия модального окна по его ID.
 * @param {string} modalId - ID модального окна.
 */
function closeModal(modalId) {
  const modal = document.getElementById(modalId);
  if (modal) {
    modal.style.display = "none";
  }
}

export { initUpdateHandler, updateProgressBar };
