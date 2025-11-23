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

    const openCurrentDownloadDir = async () => {
      const currentDir = await window.electron.invoke("get-download-path");
      if (currentDir) {
        await window.electron.invoke("open-download-folder", currentDir);
      } else {
        showToast("Не удалось определить папку загрузок.", "warning");
      }
    };

    if (lastDownloadedFile) {
      const exists = await window.electron.invoke(
        "check-file-exists",
        lastDownloadedFile,
      );
      if (exists) {
        await window.electron.invoke(
          "open-download-folder",
          lastDownloadedFile,
        );
      } else {
        showToast(
          "Последний файл не найден. Откройте текущую папку загрузок.",
          "warning",
        );
        await openCurrentDownloadDir();
      }
    } else {
      await openCurrentDownloadDir();
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
        showToast("Не удалось открыть последнее видео.", "error");
      } else {
        console.log("Последнее видео успешно открыто.");
      }
    } catch (error) {
      console.error("Error opening last video:", error);
      showToast("Не удалось открыть последнее видео.", "error");
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
      // Тост приходит из события "download-path-changed"; здесь ничего не делаем
    } else {
      showToast("Выбор папки отменён.", "warning");
    }
  } catch (error) {
    console.error("Error selecting folder:", error);
    showToast("Не удалось выбрать папку.", "error");
  }
}

/**
 * Функция для инициализации действий загрузки
 */
function initDownloadActions() {
  console.log("Инициализация downloadActions");
  // Слушаем событие изменения пути загрузки
  window.electron.on("download-path-changed", (newPath) => {
    console.log(`Путь загрузки изменен: ${newPath}`);
    showToast(`Папка для загрузки изменена на: ${newPath}`, "success");
    // при необходимости обновляем UI здесь
  });
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

  // Получаем текущий путь загрузки из main process
  window.electron.invoke("get-download-path").then((path) => {
    if (path) {
      console.log(`Текущий путь загрузки: ${path}`);
      // при необходимости обновляем UI здесь
    }
  });
}

export { initDownloadActions };
