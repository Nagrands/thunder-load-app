// src/js/modules/downloadActions.js

import {
  openFolderButton,
  openLastVideoButton,
  selectFolderButton,
} from "./domElements.js";
import { initTooltips } from "./tooltipInitializer.js";
import { initDownloadButton } from "./downloadManager.js";
import { showToast } from "./toast.js";
import { t } from "./i18n.js";

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
        showToast(t("download.folder.resolveError"), "warning");
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
        showToast(t("download.folder.lastMissing"), "warning");
        await openCurrentDownloadDir();
      }
    } else {
      await openCurrentDownloadDir();
    }
  } catch (error) {
    console.error("Error opening download folder:", error);
    showToast(t("download.folder.openError"), "error");
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
        showToast(t("download.complete.openError"), "error");
      } else {
        console.log("Последнее видео успешно открыто.");
      }
    } catch (error) {
      console.error("Error opening last video:", error);
      showToast(t("download.complete.openError"), "error");
    }
  } else {
    console.warn("No last downloaded file path found.");
    showToast(t("download.lastFile.missing"), "warning");
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
      showToast(t("download.folder.selectCancelled"), "warning");
    }
  } catch (error) {
    console.error("Error selecting folder:", error);
    showToast(t("download.folder.selectError"), "error");
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
    showToast(t("download.folder.changed", { path: newPath }), "success");
    // при необходимости обновляем UI здесь
  });
  window.electron.on("download-complete", ({ filePath }) => {
    if (!filePath) return;
    window.localStorage.setItem("lastDownloadedFile", filePath);
    if (openLastVideoButton) openLastVideoButton.disabled = false;
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
