// src/js/modules/history.js

import {
  history,
  historyContainer,
  totalDownloads,
  iconFilterSearch,
  refreshButton,
  filterInput,
  clearHistoryButton,
  sortButton,
  openHistoryButton,
} from "./domElements.js";
import {
  state,
  toggleHistoryVisibility,
  updateButtonState,
  getHistoryData,
  setHistoryData,
} from "./state.js";
import { setFilterInputValue } from "./historyFilter.js";
import { updateIcon } from "./iconUpdater.js";
import { showToast } from "./toast.js";
import { filterAndSortHistory } from "./filterAndSortHistory.js";
import { normalizeEntry } from "./normalizeEntry.js";
import { handleDeleteEntry } from "./contextMenu.js";
import { initTooltips, disposeAllTooltips } from "./tooltipInitializer.js";

function updateSpoilerVisibility(open = true) {
  const spoiler = document.querySelector(".spoiler-history");
  if (spoiler) spoiler.open = open;
}

function showFilterInput() {
  filterInput.classList.remove("hidden");
  filterInput.style.display = "block";
}

function clearHistoryContainer(container) {
  [...container.querySelectorAll(".log-entry, .divider")].forEach((el) =>
    el.remove(),
  );
}

function updateDeleteSelectedButton() {
  const clearBtn = document.getElementById("clear-history");
  const deleteBtn = document.getElementById("delete-selected");

  if (!clearBtn || !deleteBtn) return;

  if (state.selectedEntries.length > 0) {
    clearBtn.classList.add("hidden");
    deleteBtn.classList.remove("hidden");
  } else {
    clearBtn.classList.remove("hidden");
    deleteBtn.classList.add("hidden");
  }
}

function createLogEntry(entry, index) {
  const el = document.createElement("div");
  el.className = "log-entry fade-in";
  el.setAttribute("role", "listitem");
  el.setAttribute("data-id", entry.id);
  el.setAttribute("data-url", entry.sourceUrl);
  el.setAttribute("data-timestamp", entry.timestamp || "");

  if (!entry.dateText) console.warn("⚠️ Нет dateText у записи:", entry);
  if (entry.isMissing) el.classList.add("missing");

  const format = entry.format || "";
  const formattedSize = entry.formattedSize ? ` ${entry.formattedSize}` : "";
  const formatInfo = `${format}${formattedSize}`;
  // Host badge + audio-only flag
  let host = "";
  let hostClass = "";
  try {
    if (entry.sourceUrl) {
      host = new URL(entry.sourceUrl).hostname.replace(/^www\./, "");
      const h = host.toLowerCase();
      if (/youtube\.com|youtu\.be/.test(h)) hostClass = "host-youtube";
      else if (/twitch\.tv/.test(h)) hostClass = "host-twitch";
      else if (/vkvideo\.ru|vk\.com/.test(h)) hostClass = "host-vk";
      else if (/coub\.com/.test(h)) hostClass = "host-coub";
    }
  } catch {}
  const isAudioOnly =
    /audio/i.test(entry?.quality || "") ||
    /audio/i.test(entry?.resolution || "") ||
    /audio only/i.test(format);

  el.innerHTML = `
    <div class="text" data-filepath="${entry.filePath}" data-url="${entry.sourceUrl}" data-filename="${entry.fileName}">
      <div class="date-time-quality">
        <span class="date-time">
          <i class="fa-solid fa-clock"></i> ${entry.dateText || "неизвестно"}
        </span>
        <span class="quality">
          <span class="q-badge" title="Формат/качество">${(entry.quality || "").replace(/</g,'&lt;')}</span>
          <div class="log-badges top">
            ${host ? `<span class="hist-badge type-host ${hostClass}" title="Источник">${host}</span>` : ""}
            ${entry.resolution ? `<span class="hist-badge type-resolution" title="Разрешение">${entry.resolution}</span>` : ""}
            ${entry.fps ? `<span class="hist-badge type-fps" title="Кадров/с">${entry.fps}fps</span>` : ""}
          </div>
          ${entry.isMissing
            ? `<span class="file-missing" title="Файл отсутствует на диске">файл удалён</span>`
            : `<span class="file-size">${formattedSize}</span>`}
        </span>
      </div>
      <div class="log-filename">
        <span class="log-number">${index + 1}.</span>
        <img src="file://${entry.iconUrl}" alt="Icon">
        <span class="log-name" title="${(entry.fileName || "").replace(/"/g, '&quot;')}">${entry.fileName}</span>
        
        <div class="log-actions">
          ${!entry.isMissing ? `
            <button class="log-play-btn" data-bs-toggle="tooltip" data-bs-placement="top" title="Воспроизвести" data-path="${entry.filePath}">
              <i class="fa-solid fa-circle-play"></i>
            </button>` : ""}
          ${
            !entry.isMissing
              ? `
            <button class="open-folder-btn" data-bs-toggle="tooltip" data-bs-placement="top" title="Открыть папку" data-path="${entry.filePath}">
              <i class="fa-solid fa-folder-open"></i>
            </button>`
              : ""
          }
          <button class="delete-entry-btn" data-bs-toggle="tooltip" data-bs-placement="top" title="Удалить из истории" data-id="${entry.id}">
            <i class="fa-solid fa-trash"></i>
          </button>
        </div>
      </div>
    </div>
  `;

  const id = entry.id;

  if (el._clickHandler) {
    el.removeEventListener("click", el._clickHandler);
  }

  const playBtn = el.querySelector('.log-play-btn');
  if (playBtn && !entry.isMissing) {
    playBtn.addEventListener('click', async (e) => {
      e.stopPropagation();
      try {
        const exists = await window.electron.invoke("check-file-exists", entry.filePath);
        if (!exists) return showToast("Файл не найден на диске", "error");
        await window.electron.invoke("open-last-video", entry.filePath);
      } catch (err) { console.error(err); }
    });
  }

  el._clickHandler = async function (e) {
    e.stopPropagation();

    if (e.shiftKey) {
      e.preventDefault();
      const allItems = Array.from(document.querySelectorAll(".log-entry"));
      const currentIndex = allItems.findIndex((item) => item.dataset.id == id);
      const lastIndex = allItems.findIndex(
        (item) => item.dataset.id == state.lastSelectedId,
      );

      console.log(
        "[Shift] currentIndex:",
        currentIndex,
        "lastIndex:",
        lastIndex,
      );

      if (currentIndex !== -1 && lastIndex !== -1) {
        const [start, end] = [currentIndex, lastIndex].sort((a, b) => a - b);
        const itemsToSelect = allItems.slice(start, end + 1);

        itemsToSelect.forEach((item) => {
          item.classList.add("selected");
          const itemId = item.dataset.id;
          if (!state.selectedEntries.includes(itemId)) {
            state.selectedEntries.push(itemId);
          }
        });

        updateDeleteSelectedButton();
        return;
      }
    }

    if (e.ctrlKey || e.metaKey) {
      e.preventDefault();
      el.classList.toggle("selected");

      if (el.classList.contains("selected")) {
        if (!state.selectedEntries.includes(id)) {
          state.selectedEntries.push(id);
        }
      } else {
        state.selectedEntries = state.selectedEntries.filter(
          (entryId) => entryId !== id,
        );
      }

      updateDeleteSelectedButton();
      state.lastSelectedId = id;
      console.log("[Ctrl] lastSelectedId set to", id);
      return;
    }

    if (el.classList.contains("missing")) return;

    const exists = await window.electron.invoke(
      "check-file-exists",
      entry.filePath,
    );
    if (!exists) {
      showToast("Файл не найден на диске", "error");
      return;
    }

    await window.electron.invoke("open-last-video", entry.filePath);
    state.lastSelectedId = id;
    console.log("[Click] lastSelectedId set to", id);
  };

  el.addEventListener("click", el._clickHandler);

  const folderBtn = el.querySelector(".open-folder-btn");
  if (folderBtn && !entry.isMissing) {
    folderBtn.addEventListener("click", async (e) => {
      e.stopPropagation();
      try {
        const exists = await window.electron.invoke(
          "check-file-exists",
          entry.filePath,
        );
        if (!exists) {
          showToast("Папка не найдена", "error");
          return;
        }
        await window.electron.invoke("open-download-folder", entry.filePath);
      } catch (err) {
        console.error("Ошибка открытия папки:", err);
        showToast("Ошибка при открытии папки", "error");
      }
    });
  }

  if (entry._highlight) {
    const textElement = el.querySelector(".text");
    if (textElement) {
      textElement.classList.add("new-entry");
      setTimeout(() => {
        textElement.classList.remove("new-entry");
      }, 5000);
    }
    delete entry._highlight;
  }

  const divider = document.createElement("hr");
  divider.className = "divider fade-in";

  return { el, divider };
}

function attachDeleteListeners() {
  const deleteButtons = document.querySelectorAll(".delete-entry-btn");
  deleteButtons.forEach((btn) => {
    btn.addEventListener("click", async (e) => {
      e.preventDefault();
      e.stopPropagation();
      const logEntry = btn.closest(".log-entry");
      if (logEntry) await handleDeleteEntry(logEntry);
    });
  });
}

document
  .getElementById("delete-selected")
  ?.addEventListener("click", async () => {
    const idsToDelete = state.selectedEntries.map((id) => id.toString());
    console.log("selectedEntries =", state.selectedEntries);

    if (!idsToDelete.length) return;

    const currentHistory = getHistoryData();
    const deletedEntries = currentHistory.filter((entry) =>
      idsToDelete.includes(entry.id.toString()),
    );

    const updatedHistory = currentHistory.filter(
      (entry) => !idsToDelete.includes(entry.id.toString()),
    );

    // ВСТАВКА: логи до и после удаления
    console.log("История до удаления:", currentHistory);
    console.log("IDs к удалению:", idsToDelete);
    console.log("История после удаления:", updatedHistory);

    console.log("Перед обновлением истории:", getHistoryData());
    setHistoryData(updatedHistory); // ✅ обновляем локальное состояние
    // ВСТАВКА: лог после setHistoryData
    console.log(
      "setHistoryData выполнен. Актуальная история:",
      getHistoryData(),
    );
    console.log("История после удаления:", getHistoryData());
    state.selectedEntries = [];

    await window.electron.invoke("save-history", updatedHistory); // ✅ сохраняем на диск
    filterAndSortHistory(
      state.currentSearchQuery,
      state.currentSortOrder,
      true,
    );
    // ВСТАВКА: лог после перерисовки
    console.log("После перерисовки renderHistory:", getHistoryData());
    await updateDownloadCount();
    updateDeleteSelectedButton();

    showToast(
      `Удалено ${deletedEntries.length} записей. <a href="#" id="undo-delete">Отменить</a>`,
      "info",
      5500,
      async () => {
        const restored = [...deletedEntries, ...getHistoryData()];
        setHistoryData(restored);
        await window.electron.invoke("save-history", restored);
        filterAndSortHistory(
          state.currentSearchQuery,
          state.currentSortOrder,
          true,
        );
        await updateDownloadCount();
        showToast("Удаление отменено.", "success");
      },
    );
  });

function attachOpenFolderListeners() {
  const folderButtons = document.querySelectorAll(".open-folder-btn");
  folderButtons.forEach((btn) => {
    const logEntry = btn.closest(".log-entry");

    // Проверка: если у родителя есть класс missing — отключить кнопку
    if (logEntry?.classList.contains("missing")) {
      btn.setAttribute("disabled", "true");
      return;
    }

    btn.addEventListener("click", async (e) => {
      e.preventDefault();
      e.stopPropagation();

      const filePath = btn.dataset.path;
      if (filePath) {
        try {
          await window.electron.invoke("open-download-folder", filePath);
        } catch (err) {
          console.error(err);
          showToast("Папка не найдена.", "error");
        }
      }
    });
  });
}

function renderHistory(entries) {
  // ВСТАВКА: лог в начале renderHistory
  console.log(
    "🧾 renderHistory получил entries:",
    entries.map((e) => e.id),
  );
  console.log("renderHistory called at", new Date().toISOString());
  console.trace("renderHistory stack");

  const container = document.getElementById("history");
  const emptyMessage = document.getElementById("empty-history");
  const isEmpty = entries.length === 0;

  clearHistoryContainer(container);

  disposeAllTooltips(); // очистка старых тултипов перед новой инициализацией

  if (isEmpty) {
    if (emptyMessage) {
      emptyMessage.textContent = state.currentSearchQuery
        ? `По запросу «${state.currentSearchQuery}» ничего не найдено.`
        : "История загрузок не содержит данных.";
      emptyMessage.style.display = "block";
    }

    const searchWrapper = document.querySelector(".history-search-wrapper");
    const isCompletelyEmpty = state.currentSearchQuery === "";
    if (searchWrapper) {
      searchWrapper.style.display = isCompletelyEmpty ? "none" : "block";
    }

    const iconSearch = document.getElementById("icon-filter-search");
    if (iconSearch) iconSearch.classList.toggle("hidden", isCompletelyEmpty);

    const actions = document.querySelector(".history-actions");
    if (actions) actions.classList.toggle("hidden", isCompletelyEmpty);

    updateSpoilerVisibility(true);
    setTimeout(() => initTooltips(), 0);
    return;
  }

  // Удаляем сообщение о пустой истории
  if (emptyMessage) {
    emptyMessage.textContent = "";
    emptyMessage.style.display = "none";
  }

  // Показываем элементы поиска и действий
  const searchWrapper = document.querySelector(".history-search-wrapper");
  if (searchWrapper) searchWrapper.style.display = "block";

  const iconSearch = document.getElementById("icon-filter-search");
  if (iconSearch) iconSearch.classList.remove("hidden");

  const actions = document.querySelector(".history-actions");
  if (actions) actions.classList.remove("hidden");

  updateSpoilerVisibility(true);

  const count = entries.length;
  entries.forEach((entry, index) => {
    const order = state.currentSortOrder === "asc" ? index + 1 : count - index;

    const { el, divider } = createLogEntry(entry, order - 1);
    container.appendChild(el);
    container.appendChild(divider);
  });
  setTimeout(() => initTooltips(), 0); // 🎯 инициализация тултипов после полной отрисовки

  const highlighted = container.querySelector(".new-entry");
  if (highlighted) {
    highlighted.scrollIntoView({ behavior: "smooth", block: "center" });
  }

  attachDeleteListeners();

  state.selectedEntries = Array.from(
    document.querySelectorAll(".log-entry.selected"),
  ).map((el) => el.dataset.id);
  updateDeleteSelectedButton();
}

async function initHistoryState() {
  try {
    await loadHistory(true); // 👈 forceRender=true — гарантируем перерисовку

    setFilterInputValue(state.currentSearchQuery || "");
    await updateDownloadCount();
    historyContainer.style.display = state.historyVisible ? "block" : "none";
    updateButtonState();
    updateIcon("");
  } catch (error) {
    console.error("Error during initial load:", error);
    showToast("Ошибка загрузки истории.", "error");
  }
}

function initHistory() {
  openHistoryButton.addEventListener("click", () => {
    const newVisibility = !state.historyVisible;
    toggleHistoryVisibility(newVisibility);
    historyContainer.style.display = state.historyVisible ? "block" : "none";
    filterInput.style.display = state.historyVisible ? "block" : "none";
    if (state.historyVisible) loadHistory();
    // queueMicrotask(() => initTooltips());
    // if (tooltipInstance) tooltipInstance.hide();
  });

  historyContainer.style.display = state.historyVisible ? "block" : "none";
  filterInput.style.display = state.historyVisible ? "block" : "none";

  if (state.historyVisible) loadHistory();
}

const sortHistory = (order = "desc") => {
  state.currentSortOrder = order;
  const entries = getHistoryData(); // Получаем актуальные данные
  renderHistory(entries); // Перерисовываем историю
};

const updateDownloadCount = async () => {
  try {
    const count = await window.electron.invoke("get-download-count");
    totalDownloads.style.display = count > 0 ? "block" : "none";
    totalDownloads.textContent = count > 0 ? `${count}` : "";
  } catch (error) {
    totalDownloads.style.display = "none";
    if (error.code !== "ENOENT") {
      console.error("Error getting download count:", error);
      showToast("Ошибка получения количества загрузок.", "error");
    }
  }
};

const loadHistory = async (forceRender = false) => {
  try {
    const loadedHistory = await window.electron.invoke("load-history");
    const entries = [];

    if (
      Array.isArray(loadedHistory) &&
      loadedHistory.some((e) => e?.fileName)
    ) {
      for (const rawEntry of loadedHistory) {
        const normalized = await normalizeEntry(rawEntry);
        entries.push(normalized);
      }
    }

    setHistoryData(entries);

    const hasRealEntries = entries.length > 0;
    const filteredEntries = entries.filter((entry) =>
      (entry.fileName || "")
        .toLowerCase()
        .includes(state.currentSearchQuery.toLowerCase()),
    );

    if (hasRealEntries && filteredEntries.length === 0) {
      console.warn("⚠️ Активный фильтр скрывает все записи. Выполняем сброс.");
      state.currentSearchQuery = "";
      localStorage.removeItem("lastSearch");
      setFilterInputValue("");
    }

    // ✅ Только один вызов, с флагом принудительной перерисовки
    filterAndSortHistory(
      state.currentSearchQuery,
      state.currentSortOrder,
      forceRender,
    );
  } catch (error) {
    console.error("Ошибка загрузки истории:", error);
    showToast("Ошибка загрузки истории.", "error");
  }
};

const addNewEntryToHistory = async (newEntryRaw) => {
  try {
    const normalized = await normalizeEntry(newEntryRaw);
    normalized._highlight = true;

    const existingHistory = getHistoryData();
    const existingIndex = existingHistory.findIndex(
      (entry) => entry.filePath === normalized.filePath,
    );

    let updated;

    if (existingIndex !== -1) {
      // Если файл уже есть — заменяем и перемещаем в начало
      existingHistory.splice(existingIndex, 1); // удаляем старую запись
      updated = [normalized, ...existingHistory]; // вставляем новую в начало
    } else {
      // Иначе добавляем новую запись
      updated = [normalized, ...existingHistory];
    }

    setHistoryData(updated);
    await window.electron.invoke("save-history", updated);
    filterAndSortHistory(state.currentSearchQuery, state.currentSortOrder);

    await updateDownloadCount();
  } catch (error) {
    console.error("Ошибка при добавлении записи в историю:", error);
    showToast("Ошибка при добавлении в историю", "error");
  }
};

export {
  initHistory,
  initHistoryState,
  getHistoryData,
  renderHistory,
  sortHistory,
  updateDownloadCount,
  loadHistory,
  addNewEntryToHistory,
  updateDeleteSelectedButton,
};
