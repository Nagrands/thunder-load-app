// src/js/modules/downloadActions.js

import {
  openFolderButton,
  openLastVideoButton,
  selectFolderButton,
} from "./domElements.js";
import { initTooltips } from "./tooltipInitializer.js";
import { initDownloadButton } from "./downloadManager.js";
import { showToast } from "./toast.js";

/**
 * Обработчик открытия папки загрузок
 */
async function handleOpenFolder() {
  try {
    const lastDownloadedFile =
      window.localStorage.getItem("lastDownloadedFile");
    if (lastDownloadedFile) {
      await window.electron.invoke("open-download-folder", lastDownloadedFile);
    } else {
      showToast("Не найден путь к последнему скачанному файлу.", "warning");
    }
  } catch (error) {
    console.error("Error opening download folder:", error);
    showToast("Ошибка открытия папки загрузок.", "error");
  }
}

/**
 * Обработчик открытия последнего видео
 */
async function handleOpenLastVideo() {
  const lastDownloadedFile = window.localStorage.getItem("lastDownloadedFile");
  if (lastDownloadedFile) {
    console.log(
      `Попытка открыть последнее загруженное видео: ${lastDownloadedFile}`,
    );
    try {
      const result = await window.electron.invoke(
        "open-last-video",
        lastDownloadedFile,
      );
      if (!result || !result.success) {
        console.error(
          "Failed to open last video:",
          result ? result.error : "Unknown error",
        );
        showToast("Ошибка открытия последнего видео.", "error");
      } else {
        console.log("Последнее видео успешно открыто.");
      }
    } catch (error) {
      console.error("Error opening last video:", error);
      showToast("Ошибка открытия последнего видео.", "error");
    }
  } else {
    console.warn("No last downloaded file path found.");
    showToast("Не найден путь к последнему скачанному файлу.", "warning");
  }
}

/**
 * Обработчик выбора папки для загрузок
 */
async function handleSelectDownloadFolder() {
  try {
    const result = await window.electron.invoke("select-download-folder");
    if (result.success) {
      showToast(`Папка для загрузки изменена на: ${result.path}`, "success");
      window.localStorage.setItem("downloadPath", result.path);
      // Устанавливаем новый путь для загрузок в main process
      await window.electron.invoke("set-download-path", result.path);
    } else {
      showToast("Выбор папки был отменен.", "warning");
    }
  } catch (error) {
    console.error("Error selecting folder:", error);
    showToast("Ошибка при выборе папки.", "error");
  }
}

/**
 * Функция для инициализации действий загрузки
 */
function initDownloadActions() {
  console.log("Инициализация downloadActions");
  initDownloadButton();
  // Обработчик открытия папки загрузок
  openFolderButton.addEventListener("click", handleOpenFolder);

  // Обработчик открытия последнего видео
  openLastVideoButton.addEventListener("click", async () => {
    await handleOpenLastVideo();
    initTooltips();
  });

  // Проверка наличия последнего скачанного файла при загрузке страницы
  const lastDownloadedFile = window.localStorage.getItem("lastDownloadedFile");
  if (lastDownloadedFile) {
    openLastVideoButton.disabled = false;
  }

  // Обработчик выбора папки для загрузок
  selectFolderButton.addEventListener("click", handleSelectDownloadFolder);

  // Установка сохраненного пути загрузки при загрузке страницы
  const savedPath = window.localStorage.getItem("downloadPath");
  if (savedPath) {
    window.electron.invoke("set-download-path", savedPath);
  }
}

export { initDownloadActions };
