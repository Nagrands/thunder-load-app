/**
 * @file contextMenu.js
 * @description
 * Provides right-click context menu functionality for history log entries
 * in the Thunder Load application.
 *
 * Responsibilities:
 *  - Show and position a custom context menu near the mouse cursor
 *  - Enable or disable menu items based on file existence
 *  - Handle context menu actions:
 *      • Open video
 *      • Open containing folder
 *      • Open original site
 *      • Delete history entry (with confirmation)
 *      • Delete file from disk (with confirmation)
 *      • Retry download
 *  - Keep track of currently selected log entry
 *  - Synchronize UI state after modifications (history, counts, sorting, toasts)
 *  - Integrate with Electron main process through IPC invokes
 *
 * Exports:
 *  - initContextMenu — initializes menu and history event listeners
 *  - handleDeleteEntry — removes entry from DOM and history (with confirmation)
 */

// src/js/modules/contextMenu.js

import { setHistoryData, getHistoryData } from "./state.js";
import { filterAndSortHistory } from "./historyFilter.js";
import { urlInput, downloadButton } from "./domElements.js";
import { history, historyContainer, contextMenu } from "./domElements.js";
import { showToast } from "./toast.js";
import { showConfirmationDialog as showConfirmationModal } from "./modals.js";
import { updateDownloadCount, sortHistory } from "./history.js";
import { state, updateButtonState } from "./state.js";

/**
 * Текущий выбранный элемент истории
 */
let currentLogEntry = null;

function getEntryData(logEntry) {
  if (!logEntry) return {};
  const textEl = logEntry.querySelector(".text");
  const data = logEntry.dataset || {};
  const textData = textEl?.dataset || {};
  const take = (key) => data[key] || textData[key] || "";
  const dateTime =
    take("datetime") ||
    textEl?.querySelector?.(".date-time")?.textContent?.trim() ||
    logEntry.querySelector(".date-time")?.textContent?.trim() ||
    "";
  const quality =
    take("quality") ||
    logEntry.querySelector(".quality")?.textContent?.trim() ||
    "";
  const resolution =
    take("resolution") ||
    logEntry
      .querySelector(".hist-badge.type-resolution")
      ?.textContent?.trim() ||
    "";
  const size =
    take("size") ||
    logEntry.querySelector(".file-size")?.textContent?.trim() ||
    "";
  return {
    filePath: take("filepath"),
    sourceUrl: take("url"),
    fileName: take("filename") || logEntry.textContent.trim(),
    dateTime,
    quality,
    resolution,
    size,
  };
}

/**
 * Функция для показа контекстного меню
 * @param {MouseEvent} event - Событие мыши
 * @param {HTMLElement} logEntry - Элемент лога
 */
async function showContextMenu(event, logEntry) {
  event.preventDefault();

  // Снимаем выделение с предыдущего выбранного лога, если он есть
  if (currentLogEntry) {
    currentLogEntry.classList.remove("selected");
  }

  // Устанавливаем текущий лог как выбранный
  currentLogEntry = logEntry;
  currentLogEntry.classList.add("selected");

  // Проверяем доступность файла
  const { filePath } = getEntryData(currentLogEntry);
  console.log(`Путь к файлу: ${filePath}`);
  let fileExists = false;
  if (filePath) {
    fileExists = await window.electron.invoke("check-file-exists", filePath);
    console.log(`Файл существует: ${fileExists}`);
  }

  // Отключаем пункты меню, если файл не существует
  const openVideoItem = contextMenu.querySelector("#open-video");
  const openFolderItem = contextMenu.querySelector("#open-folderc");
  const deleteFileItem = contextMenu.querySelector("#delete-file");

  if (!fileExists) {
    openVideoItem.classList.add("disabled");
    openFolderItem.classList.add("disabled");
    deleteFileItem.classList.add("disabled");
  } else {
    openVideoItem.classList.remove("disabled");
    openFolderItem.classList.remove("disabled");
    deleteFileItem.classList.remove("disabled");
  }

  // Получаем координаты клика (учитывая прокрутку страницы)
  const { pageX: clickPageX, pageY: clickPageY } = event;

  // Получаем размеры и границы контекстного меню
  contextMenu.style.display = "block"; // Временно показываем, чтобы получить размеры
  const menuRect = contextMenu.getBoundingClientRect();
  const menuWidth = menuRect.width;
  const menuHeight = menuRect.height;
  const windowWidth = window.innerWidth;
  const windowHeight = window.innerHeight;
  const scrollX = window.scrollX;
  const scrollY = window.scrollY;

  let adjustedX = clickPageX;
  let adjustedY = clickPageY;

  // Проверка, не выходит ли меню за границы окна
  if (clickPageX + menuWidth > scrollX + windowWidth) {
    adjustedX = scrollX + windowWidth - menuWidth - 10;
  }

  if (clickPageY + menuHeight > scrollY + windowHeight) {
    adjustedY = scrollY + windowHeight - menuHeight - 10;
  }

  if (adjustedY < scrollY) {
    adjustedY = scrollY + 10;
  }

  if (adjustedX < scrollX) {
    adjustedX = scrollX + 10;
  }

  // Устанавливаем корректные координаты
  contextMenu.style.top = `${adjustedY}px`;
  contextMenu.style.left = `${adjustedX}px`;
  contextMenu.style.display = "block"; // Показываем меню
}

/**
 * Функция для скрытия контекстного меню
 */
function hideContextMenu() {
  contextMenu.style.display = "none";
  if (currentLogEntry) {
    currentLogEntry.classList.remove("selected");
  }
}

/**
 * Обработчик клика по контекстному меню
 * @param {MouseEvent} event - Событие мыши
 */
async function handleContextMenuClick(event) {
  const targetElement = event.target;
  const menuItem = targetElement.closest("li");

  if (!menuItem || !currentLogEntry) return;

  const action = menuItem.id;
  const { filePath, sourceUrl, fileName } = getEntryData(currentLogEntry);

  try {
    switch (action) {
      case "open-video":
        await handleOpenVideo(filePath);
        break;
      case "open-folderc":
        await handleOpenFolder(filePath);
        break;
      case "open-site":
        await handleOpenSite(currentLogEntry);
        break;
      case "delete-entry":
        await handleDeleteEntry(currentLogEntry);
        break;
      case "delete-file":
        await handleDeleteFile(currentLogEntry);
        break;
      case "retry-download":
        handleRetryDownload(currentLogEntry);
        break;
      default:
        break;
    }
  } catch (error) {
    console.error("Error handling context menu action:", error);
    showToast("Ошибка при выполнении действия.", "error");
  } finally {
    hideContextMenu();
  }
}

/**
 * Функция для открытия видео
 * @param {string} filePath - Путь к файлу
 */
async function handleOpenVideo(filePath) {
  try {
    const fileExists = await window.electron.invoke(
      "check-file-exists",
      filePath,
    );
    if (!fileExists) {
      showToast("Файл не существует или был удалён.", "error");
      return;
    }
    await window.electron.invoke("open-last-video", filePath);
  } catch (error) {
    console.error("Ошибка при открытии видео:", error);
    showToast("Ошибка при открытии видео.", "error");
  }
}

/**
 * Функция для открытия папки
 * @param {string} filePath - Путь к файлу
 */
async function handleOpenFolder(filePath) {
  try {
    const fileExists = await window.electron.invoke(
      "check-file-exists",
      filePath,
    );
    if (!fileExists) {
      showToast("Файл не существует или был удалён.", "error");
      return;
    }
    await window.electron.invoke("open-download-folder", filePath);
    showToast("Папка открыта успешно.", "success");
  } catch (error) {
    console.error("Ошибка при открытии папки:", error);
    showToast("Ошибка при открытии папки.", "error");
  }
}

/**
 * Функция для открытия сайта
 * @param {HTMLElement} logEntry - Элемент лога
 */
async function handleOpenSite(logEntry) {
  const { sourceUrl } = getEntryData(logEntry);
  const url = sourceUrl;
  if (url) {
    try {
      await window.electron.invoke("open-external-link", url);
    } catch (error) {
      console.error("Error opening site:", error);
      showToast("Ошибка при открытии сайта.", "error");
    }
  }
}

/**
 * Функция для удаления записи из истории
 * @param {HTMLElement} logEntry - Элемент лога
 */
async function handleDeleteEntry(logEntry) {
  const entryId = logEntry.getAttribute("data-id");
  if (!entryId) {
    console.error("No ID found for the entry. Aborting deletion.");
    return;
  }

  const { fileName, dateTime, quality } = getEntryData(logEntry);
  const entryName = fileName || logEntry.textContent.trim();
  const entryDateTime =
    dateTime || logEntry.querySelector(".date-time")?.textContent?.trim() || "";
  const entryQuality =
    quality || logEntry.querySelector(".quality")?.textContent?.trim() || "";
  const formattedName = entryName
    .replace(entryDateTime, "")
    .replace(entryQuality, "")
    .trim();
  const confirmationMessage = `
    <h4 class="toast-warning">Вы уверены, что хотите удалить запись?</h4>
    <br>
    <div class="info-entry">
        <div class="date-time-quality">
            <span class="date-time">
              <i class="fa-solid fa-clock"></i> ${entryDateTime}
            </span>
            <span class="quality">
              <i class="fa-regular fa-rectangle-list"></i>${entryQuality}
            </span>
        </div>
        <span class="info-note">
            <p><i class="fa-solid fa-film"></i>
            ${formattedName}</p>
        </span>
    </div>
    `;

  const confirmed = await showConfirmationDialog(confirmationMessage);
  if (!confirmed) return;

  try {
    console.log(`Удаление элемента из DOM \n"${formattedName}"`);
    logEntry.remove(); // Удаление записи из DOM

    const { currentHistory, wasDeleted } =
      await deleteEntryFromHistory(entryId); // Удаление записи из истории
    setHistoryData(currentHistory);
    console.log("(ContextMenu) Обновлённая история:", getHistoryData());
    filterAndSortHistory(
      state.currentSearchQuery,
      state.currentSortOrder,
      true,
    );

    if (wasDeleted) {
      await updateDownloadCount();
      sortHistory(state.currentSortOrder);
      showToast(
        `Запись успешно удалена<br><strong>${formattedName}</strong>.`,
        "success",
      );
    } else {
      console.warn("No entry was removed. Possible ID mismatch.");
      showToast("Ошибка при удалении записи. Попробуйте еще раз.", "error");
    }
  } catch (error) {
    console.error("Ошибка при удалении записи:", error);
    showToast("Ошибка при удалении записи.", "error");
  }
}

/**
 * Функция для удаления записи из истории (файла)
 * @param {string} entryId - ID записи
 * @returns {Object} - Объект с текущей историей и флагом удаления
 */
async function deleteEntryFromHistory(entryId) {
  let currentHistory = await window.electron.invoke("load-history");
  const initialHistoryLength = currentHistory.length;
  const numericId = Number(entryId);
  const entryToDelete = currentHistory.find((entry) => entry.id === numericId);

  // Фильтрация истории
  currentHistory = currentHistory.filter((entry) => entry.id !== numericId);

  // Сохранение обновленной истории
  await window.electron.invoke("save-history", currentHistory);
  if (entryToDelete?.thumbnailCacheFile) {
    try {
      await window.electron.invoke(
        "delete-history-preview",
        entryToDelete.thumbnailCacheFile,
      );
    } catch (error) {
      console.warn("Не удалось удалить превью записи:", error);
    }
  }

  const wasDeleted = currentHistory.length < initialHistoryLength;
  return { currentHistory, wasDeleted };
}

/**
 * Функция для удаления файла с диска
 * @param {HTMLElement} logEntry - Элемент лога
 */
async function handleDeleteFile(logEntry) {
  const { filePath } = getEntryData(logEntry);
  if (!filePath) {
    showToast("Путь к файлу не найден.", "error");
    return;
  }

  // Проверяем наличие и доступность файла
  try {
    const fileExists = await window.electron.invoke(
      "check-file-exists",
      filePath,
    );
    if (!fileExists) {
      showToast("Файл не существует или уже был удалён.", "warning");
      return;
    }
  } catch (error) {
    console.error("Ошибка при проверке существования файла:", error);
    showToast("Ошибка при проверке файла.", "error");
    return;
  }

  // Подтверждение удаления файла
  const { fileName, dateTime, quality } = getEntryData(logEntry);
  const entryDateTime = dateTime || "";
  const entryQuality = quality || "";
  const confirmationMessage = `
    <h4 class="toast-warning">Вы уверены, что хотите удалить файл?</h4>
    <br>
    <div class="info-entry">
        <div class="date-time-quality">
            <span class="date-time">
              <i class="fa-solid fa-clock"></i>${entryDateTime}
            </span>
            <span class="quality">
              <i class="fa-regular fa-rectangle-list"></i>${entryQuality}
            </span>
        </div>
        <span class="info-delete">
            <p><i class="fa-solid fa-film"></i>
            ${fileName}</p>
        </span>
    </div>
    `;

  const confirmed = await showConfirmationDialog(confirmationMessage);
  if (!confirmed) return;

  try {
    const deletionResult = await window.electron.invoke(
      "delete-file",
      filePath,
    );
    if (deletionResult) {
      // Обновляем интерфейс после удаления файла
      logEntry.dataset.filepath = "";
      logEntry.classList.add("file-deleted", "is-missing");
      const textEl = logEntry.querySelector(".text");
      if (textEl) {
        textEl.removeAttribute("data-filepath");
        textEl.innerHTML +=
          ' <span class="file-deleted-label">(файл удалён)</span>';
      } else {
        logEntry.querySelectorAll(".history-card-btn").forEach((btn) => {
          if (btn.dataset.action !== "retry") btn.disabled = true;
        });
      }
      showToast(
        `Файл успешно удалён: <strong>${fileName}</strong>.`,
        "success",
      );
    } else {
      // В случае, если delete-file вернул false или другую неудачную индикацию
      showToast("Не удалось удалить файл.", "error");
    }
  } catch (error) {
    console.error("Ошибка при удалении файла:", error);
    showToast("Ошибка при удалении файла.", "error");
  }
}

/**
 * Функция для отображения диалога подтверждения и возвращения результата
 * @param {string} message - Сообщение для подтверждения
 * @returns {Promise<boolean>} - Возвращает true, если пользователь подтвердил, иначе false
 */
async function showConfirmationDialog(message) {
  return new Promise((resolve) => {
    // Предполагаем, что showConfirmationDialog принимает сообщение и колбэки для подтверждения и отмены
    showConfirmationModal(
      message,
      () => {
        resolve(true); // Пользователь подтвердил
      },
      () => {
        resolve(false); // Пользователь отменил
      },
    );
  });
}

/**
 * Функция для повторной загрузки видео
 * @param {HTMLElement} logEntry - Элемент лога
 */
function handleRetryDownload(logEntry) {
  const { sourceUrl: retryUrl, fileName } = getEntryData(logEntry);
  if (retryUrl) {
    urlInput.value = retryUrl; // Используем импортированный urlInput
    updateButtonState();

    // Синхронизируем UI кнопок вокруг поля и форсируем предпросмотр
    try {
      urlInput.dispatchEvent(new Event("input", { bubbles: true }));
      urlInput.dispatchEvent(new Event("force-preview"));
    } catch (_) {}

    downloadButton.classList.remove("disabled");
    downloadButton.classList.add("active");

    showToast(`Повторная загрузка: <strong>${fileName}</strong>.`, "warning");
  }
}

/**
 * Инициализация обработчиков контекстного меню
 */
function initContextMenu() {
  // Обработчик контекстного меню на истории и карточках
  const historyRoot = historyContainer || history || document.body;
  historyRoot.addEventListener(
    "contextmenu",
    async (event) => {
      const targetEntry =
        event.target.closest(".log-entry") ||
        event.target.closest(".history-card");
      if (targetEntry) {
        await showContextMenu(event, targetEntry);
      }
    },
    { capture: true },
  );

  if (history) {
    history.addEventListener("click", async (event) => {
      const logEntry = event.target.closest(".log-entry");
      if (!logEntry) return;

      try {
        const data = getEntryData(logEntry);
        if (event.target.matches(".log-entry img")) {
          const url = data.sourceUrl;
          if (url) {
            await window.electron.invoke("open-external-link", url);
          }
        } else {
          const filePath = data.filePath;
          if (filePath) {
            await window.electron.invoke("open-last-video", filePath);
          }
        }
      } catch (error) {
        console.error("Error handling history click:", error);
        showToast("Ошибка при обработке клика по истории.", "error");
      }
    });
  }

  // Скрытие контекстного меню при клике в любом месте
  document.addEventListener("click", hideContextMenu);

  // Обработчик кликов по контекстному меню
  contextMenu.addEventListener("click", handleContextMenuClick);
}

export { initContextMenu, handleDeleteEntry };
