// src/js/modules/history.js

import {
  history,
  historyContainer,
  historyCards,
  historyCardsEmpty,
  totalDownloads,
  iconFilterSearch,
  refreshButton,
  filterInput,
  clearHistoryButton,
  sortButton,
  openHistoryButton,
  urlInput,
  downloadButton,
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

const RECENT_HISTORY_LIMIT = 8;
const HISTORY_AUDIO_PLACEHOLDER =
  "data:image/svg+xml;utf8," +
  encodeURIComponent(
    "<svg xmlns='http://www.w3.org/2000/svg' width='320' height='180' viewBox='0 0 320 180'><defs><linearGradient id='g' x1='0' y1='0' x2='1' y2='1'><stop offset='0' stop-color='%231a1f2e'/><stop offset='1' stop-color='%23243352'/></linearGradient></defs><rect width='320' height='180' fill='url(%23g)'/><g fill='%23a3b3ff' opacity='0.9'><path d='M190 60v58a26 26 0 11-10-20V70l40-10v12z'/></g></svg>",
  );
const attemptedPreviewRestores = new Set();

let historyCardsRoot = historyCards;
let historyCardsEmptyRoot = historyCardsEmpty;
let historyCardPreviewOverlay = null;
let historyCardPreviewImage = null;
let historyCardPreviewCaption = null;

function ensureHistoryCardsElements() {
  if (!historyCardsRoot || !historyCardsRoot.isConnected) {
    historyCardsRoot = document.getElementById("history-cards");
  }
  if (!historyCardsEmptyRoot || !historyCardsEmptyRoot.isConnected) {
    historyCardsEmptyRoot = document.getElementById("history-cards-empty");
  }
  if (historyCardsRoot && historyCardsEmptyRoot) return;

  let area = document.querySelector(".history-cards-area");
  if (!area) {
    area = document.createElement("div");
    area.className = "history-cards-area";
    area.setAttribute("aria-live", "polite");
    area.innerHTML = `
      <div class="history-cards-header">
        <div>
          <p class="history-cards-subtitle">Недавние загрузки</p>
          <h3 class="history-cards-title">История загрузок</h3>
        </div>
        <div class="history-cards-search history-actions">
          <div class="history-search-wrapper history-input-wrapper">
            <i id="icon-filter-search" class="fas fa-search search-icon"></i>
            <input type="text" id="filter-input" placeholder="Поиск по истории" aria-label="Поиск по истории" />
            <button
              id="clear-filter-input"
              class="history-action-button"
              data-bs-toggle="tooltip"
              data-bs-placement="top"
              title="Очистить поиск"
            >
              &times;
            </button>
          </div>
          <div class="history-search-actions">
            <button
              id="refresh-button"
              class="history-action-button"
              data-bs-toggle="tooltip"
              data-bs-placement="top"
              title="Обновить"
            >
              <i class="fa-solid fa-arrow-rotate-right"></i>
            </button>
            <button
              id="sort-button"
              class="history-action-button"
              data-bs-toggle="tooltip"
              data-bs-placement="top"
              title="Сортировка"
            >
              <i class="fa-solid"></i>
            </button>
            <button
              id="clear-history"
              class="history-action-button"
              data-bs-toggle="tooltip"
              data-bs-placement="top"
              title="Очистить"
            >
              <i class="fa-solid fa-trash"></i>
            </button>
            <button
              id="delete-selected"
              class="history-action-button hidden"
              data-bs-toggle="tooltip"
              data-bs-placement="top"
              title="Удалить выбранные"
            >
              <i class="fa-solid fa-trash-can"></i>
            </button>
            <button
              id="history-header"
              class="history-action-button"
              data-bs-toggle="tooltip"
              data-bs-placement="top"
              title="Записей истории"
            >
              <span id="total-downloads">0</span>
            </button>
          </div>
        </div>
      </div>
      <div id="history-cards" class="history-card-grid" role="list"></div>
      <div id="history-cards-empty" class="history-cards-empty">
        Недавних загрузок пока нет.
      </div>
    `;
    const container =
      historyContainer || document.getElementById("history-container");
    if (container) {
      const listAnchor = container.querySelector("#history");
      if (listAnchor) container.insertBefore(area, listAnchor);
      else container.appendChild(area);
    } else {
      document.body.appendChild(area);
    }
  }
  historyCardsRoot = area.querySelector("#history-cards");
  historyCardsEmptyRoot = area.querySelector("#history-cards-empty");
}

function ensureHistoryCardPreviewOverlay() {
  if (historyCardPreviewOverlay) return historyCardPreviewOverlay;

  const overlay = document.createElement("div");
  overlay.className = "history-card-preview-overlay hidden";
  overlay.setAttribute("role", "dialog");
  overlay.setAttribute("aria-modal", "true");
  overlay.setAttribute("aria-hidden", "true");
  overlay.setAttribute("aria-label", "Просмотр превью загрузки");
  overlay.tabIndex = -1;
  overlay.innerHTML = `
    <div class="history-card-preview-dialog">
      <button
        type="button"
        class="history-card-preview-close"
        aria-label="Закрыть превью"
      >
        <i class="fa-solid fa-xmark"></i>
      </button>
      <img class="history-card-preview-image" alt="" />
      <p class="history-card-preview-caption"></p>
    </div>
  `;

  const closeBtn = overlay.querySelector(".history-card-preview-close");
  closeBtn.addEventListener("click", closeHistoryCardPreview);
  overlay.addEventListener("click", (event) => {
    if (event.target === overlay) {
      closeHistoryCardPreview();
    }
  });

  document.addEventListener("keydown", (event) => {
    if (
      event.key === "Escape" &&
      historyCardPreviewOverlay &&
      !historyCardPreviewOverlay.classList.contains("hidden")
    ) {
      closeHistoryCardPreview();
    }
  });

  historyCardPreviewOverlay = overlay;
  historyCardPreviewImage = overlay.querySelector(
    ".history-card-preview-image",
  );
  historyCardPreviewCaption = overlay.querySelector(
    ".history-card-preview-caption",
  );

  document.body.appendChild(overlay);
  return overlay;
}

function openHistoryCardPreview(src, title = "") {
  if (!src) return;
  const overlay = ensureHistoryCardPreviewOverlay();
  historyCardPreviewImage.src = src;
  historyCardPreviewImage.alt = title || "Preview";
  historyCardPreviewCaption.textContent = title || "";
  overlay.classList.remove("hidden");
  overlay.setAttribute("aria-hidden", "false");
  overlay.focus();
}

function closeHistoryCardPreview() {
  if (!historyCardPreviewOverlay) return;
  historyCardPreviewOverlay.classList.add("hidden");
  historyCardPreviewOverlay.setAttribute("aria-hidden", "true");
  if (historyCardPreviewImage) historyCardPreviewImage.src = "";
}

async function openHistorySourceLink(url) {
  if (!url) {
    showToast("Ссылка на источник недоступна.", "warning");
    return;
  }
  try {
    await window.electron.invoke("open-external-link", url);
  } catch (error) {
    console.error("Ошибка открытия источника:", error);
    showToast("Не удалось открыть источник загрузки.", "error");
  }
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

const detectHost = (url = "") => {
  if (!url) return "";
  try {
    return new URL(url).hostname.replace(/^www\./, "");
  } catch (_) {
    return "";
  }
};

const isAudioEntry = (entry) => {
  const quality = entry?.quality || entry?.resolution || entry?.format || "";
  return /audio/i.test(quality) || /audio only/i.test(quality);
};

const isCacheableThumbnailUrl = (url) =>
  typeof url === "string" &&
  (url.startsWith("http://") ||
    url.startsWith("https://") ||
    url.startsWith("data:"));

const isFileUrl = (url) =>
  typeof url === "string" && url.toLowerCase().startsWith("file://");

const fileUrlToPath = (url) => {
  if (!isFileUrl(url)) return "";
  try {
    return decodeURI(url.replace(/^file:\/\//i, ""));
  } catch {
    return "";
  }
};

const filePathToUrl = (filePath) => {
  if (!filePath || typeof filePath !== "string") return "";
  if (filePath.startsWith("file://")) return filePath;
  try {
    let normalized = filePath.replace(/\\/g, "/");
    if (/^[A-Za-z]:/.test(normalized)) normalized = "/" + normalized;
    const encoded = encodeURI(normalized).replace(/#/g, "%23");
    return `file://${encoded}`;
  } catch {
    return "";
  }
};

const resolveLocalPreviewPath = (entry) => {
  if (!entry) return "";
  if (entry.thumbnailCacheFile) return entry.thumbnailCacheFile;
  if (entry.thumbnail && isFileUrl(entry.thumbnail)) {
    return fileUrlToPath(entry.thumbnail);
  }
  return "";
};

const deriveYoutubeThumbnail = (sourceUrl = "") => {
  if (!sourceUrl) return "";
  try {
    const u = new URL(sourceUrl);
    const host = (u.hostname || "").replace(/^www\./, "").toLowerCase();
    const isYt = /youtube\.com|youtu\.be/.test(host);
    if (!isYt) return "";

    let id = "";
    if (host.includes("youtu.be")) {
      id = (u.pathname || "").split("/").filter(Boolean)[0] || "";
    } else if (u.searchParams.has("v")) {
      id = u.searchParams.get("v") || "";
    } else if ((u.pathname || "").includes("/embed/")) {
      id = (u.pathname.split("/embed/")[1] || "").split("/")[0] || "";
    } else if ((u.pathname || "").includes("/shorts/")) {
      id = (u.pathname.split("/shorts/")[1] || "").split("/")[0] || "";
    }

    return id
      ? `https://img.youtube.com/vi/${id}/maxresdefault.jpg`
      : "";
  } catch {
    return "";
  }
};

const resolveThumbnailSource = (entry) => {
  if (!entry) return "";
  if (isCacheableThumbnailUrl(entry.thumbnail)) return entry.thumbnail;
  if (isAudioEntry(entry)) return "";
  return deriveYoutubeThumbnail(entry.sourceUrl);
};

const pickInfoThumbnail = (info) => {
  if (!info) return "";
  if (info.thumbnail) return info.thumbnail;
  if (Array.isArray(info.thumbnails) && info.thumbnails.length) {
    return (
      info.thumbnails
        .slice()
        .sort((a, b) => (b.width || 0) - (a.width || 0))[0]?.url || ""
    );
  }
  return "";
};

const fetchThumbnailFromSource = async (entry) => {
  if (!entry?.sourceUrl) return "";
  try {
    const info = await window.electron.invoke(
      "get-video-info",
      entry.sourceUrl,
    );
    if (info?.success === false) return "";
    return pickInfoThumbnail(info);
  } catch (error) {
    console.warn(
      `Не удалось получить данные видео для превью (${entry.sourceUrl}):`,
      error,
    );
    return "";
  }
};

const hasLocalThumbnail = async (entry) => {
  const localPath = resolveLocalPreviewPath(entry);
  if (!localPath) return false;
  try {
    return await window.electron.invoke("check-file-exists", localPath);
  } catch {
    return false;
  }
};

const restoreThumbnailForEntry = async (entry, rawEntry) => {
  if (!entry?.id) return { changed: false, updatedEntry: entry, updatedRaw: rawEntry };

  const updatedEntry = { ...entry };
  const updatedRaw = rawEntry ? { ...rawEntry } : null;
  let changed = false;

  const localPath = resolveLocalPreviewPath(updatedEntry);
  const localExists = await hasLocalThumbnail(updatedEntry);
  if (localExists && localPath) {
    const localUrl = filePathToUrl(localPath);
    if (localUrl && updatedEntry.thumbnail !== localUrl) {
      updatedEntry.thumbnail = localUrl;
      changed = true;
    }
    return { changed, updatedEntry, updatedRaw };
  }

  const sourceUrl = resolveThumbnailSource(updatedRaw || updatedEntry);
  let candidateUrl = sourceUrl;

  // Fallback: try to fetch fresh metadata for thumbnail if nothing obvious to reuse
  if (!candidateUrl) {
    candidateUrl = await fetchThumbnailFromSource(updatedRaw || updatedEntry);
  }

  if (!candidateUrl) return { changed, updatedEntry, updatedRaw };

  try {
    const cacheResult = await window.electron.invoke("cache-history-preview", {
      url: candidateUrl,
      entryId: updatedEntry.id,
      fileName: updatedEntry.fileName || "preview",
    });

    if (cacheResult?.success && cacheResult.filePath) {
      const fileUrl = filePathToUrl(cacheResult.filePath);
      updatedEntry.thumbnailCacheFile = cacheResult.filePath;
      updatedEntry.thumbnail = fileUrl || updatedEntry.thumbnail || candidateUrl;
      if (updatedRaw) {
        updatedRaw.thumbnailCacheFile = cacheResult.filePath;
        updatedRaw.thumbnail = fileUrl || updatedRaw.thumbnail || candidateUrl;
      }
      changed = true;
    }
  } catch (error) {
    console.warn(
      `Не удалось восстановить превью для записи ${updatedEntry.id}:`,
      error,
    );
  }

  return { changed, updatedEntry, updatedRaw };
};

const restoreMissingHistoryPreviews = async (entries, rawHistory) => {
  if (!Array.isArray(entries) || !entries.length) return;
  if (!Array.isArray(rawHistory) || !rawHistory.length) return;

  const normalizedById = new Map(
    entries.map((item) => [String(item.id), { ...item }]),
  );
  const rawById = new Map(
    rawHistory.map((item) => [String(item.id), { ...item }]),
  );

  let hasChanges = false;

  for (const entry of entries) {
    const id = String(entry.id || "");
    if (!id || attemptedPreviewRestores.has(id)) continue;
    attemptedPreviewRestores.add(id);

    const rawEntry = rawById.get(id);
    const result = await restoreThumbnailForEntry(
      normalizedById.get(id),
      rawEntry,
    );
    if (result.changed) {
      hasChanges = true;
      if (result.updatedEntry) normalizedById.set(id, result.updatedEntry);
      if (result.updatedRaw) rawById.set(id, result.updatedRaw);
    }
  }

  if (!hasChanges) return;

  const updatedEntries = entries.map(
    (entry) => normalizedById.get(String(entry.id)) || entry,
  );
  const updatedRawHistory = rawHistory.map(
    (entry) => rawById.get(String(entry.id)) || entry,
  );

  setHistoryData(updatedEntries);
  filterAndSortHistory(
    state.currentSearchQuery,
    state.currentSortOrder,
    true,
  );

  try {
    await window.electron.invoke("save-history", updatedRawHistory);
  } catch (error) {
    console.warn(
      "Не удалось сохранить историю после восстановления превью:",
      error,
    );
  }
};

const formatCardDate = (entry) => {
  if (!entry) return "";
  if (entry.timestamp) {
    try {
      const d = new Date(entry.timestamp);
      if (!Number.isNaN(d.getTime())) {
        return d.toLocaleString([], {
          dateStyle: "medium",
          timeStyle: "short",
          hour12: false,
        });
      }
    } catch (_) {}
  }
  return entry.dateText || "";
};

const formatSizeLabel = (entry) => {
  if (entry?.isMissing) return "Файл удалён";
  if (entry?.formattedSize) return entry.formattedSize;
  return "Размер не определён";
};

async function openHistoryCardFile(entry) {
  if (!entry?.filePath) return;
  try {
    const exists = await window.electron.invoke(
      "check-file-exists",
      entry.filePath,
    );
    if (!exists) {
      entry.isMissing = true;
      renderHistoryCards(getHistoryData());
      return showToast("Файл не найден на диске.", "error");
    }
    await window.electron.invoke("open-last-video", entry.filePath);
  } catch (error) {
    console.error("Ошибка при открытии файла истории:", error);
    showToast("Не удалось открыть файл.", "error");
  }
}

function retryHistoryCardDownload(entry) {
  if (!entry?.sourceUrl || !urlInput || !downloadButton) {
    showToast("Ссылка для повторной загрузки недоступна.", "warning");
    return;
  }
  urlInput.value = entry.sourceUrl;
  try {
    urlInput.dispatchEvent(new Event("input", { bubbles: true }));
    urlInput.dispatchEvent(new Event("force-preview"));
  } catch (_) {}
  updateButtonState();
  downloadButton.classList.add("active");
  showToast(
    `Повторная загрузка: <strong>${entry.fileName || entry.sourceUrl}</strong>.`,
    "info",
  );
}

function renderHistoryCards(entries = []) {
  ensureHistoryCardsElements();
  if (!historyCardsRoot) return;
  const subset = (entries || []).slice(0, RECENT_HISTORY_LIMIT);
  historyCardsRoot.innerHTML = "";
  if (subset.length === 0) {
    if (historyCardsEmptyRoot) historyCardsEmptyRoot.style.display = "";
    return;
  }
  if (historyCardsEmptyRoot) historyCardsEmptyRoot.style.display = "none";

  subset.forEach((entry) => {
    const card = document.createElement("article");
    card.className = `history-card${entry.isMissing ? " is-missing" : ""}`;
    card.setAttribute("role", "listitem");
    card.dataset.id = entry.id || "";
    card.dataset.filepath = entry.filePath || "";
    card.dataset.url = entry.sourceUrl || "";
    card.dataset.filename = entry.fileName || "";
    card.dataset.quality = entry.quality || "";
    card.dataset.datetime = entry.dateText || "";
    card.dataset.resolution = entry.resolution || "";
    card.dataset.size = entry.formattedSize || "";

    const thumb = document.createElement("div");
    const thumbSrc = entry?.thumbnail
      ? entry.thumbnail
      : isAudioEntry(entry)
        ? HISTORY_AUDIO_PLACEHOLDER
        : "";
    thumb.className = `history-card-thumb${thumbSrc ? "" : " placeholder"}`;
    if (thumbSrc) {
      const img = document.createElement("img");
      img.src = thumbSrc;
      img.alt = entry.fileName || "Preview";
      img.loading = "lazy";

      const zoomBtn = document.createElement("button");
      zoomBtn.type = "button";
      zoomBtn.className = "history-card-thumb-button";
      zoomBtn.title = "Увеличить превью";
      zoomBtn.setAttribute("data-bs-toggle", "tooltip");
      zoomBtn.setAttribute("data-bs-placement", "top");
      zoomBtn.addEventListener("click", () =>
        openHistoryCardPreview(thumbSrc, entry.fileName || entry.sourceUrl),
      );
      const zoomBadge = document.createElement("span");
      zoomBadge.className = "history-card-thumb-zoom";
      zoomBadge.innerHTML =
        '<i class="fa-solid fa-up-right-and-down-left-from-center"></i>';

      zoomBtn.append(img, zoomBadge);
      thumb.appendChild(zoomBtn);
    } else {
      const icon = document.createElement("i");
      icon.className = "fa-regular fa-image";
      thumb.appendChild(icon);
    }
    if (entry.quality) {
      const chip = document.createElement("span");
      chip.className = "history-card-chip";
      chip.textContent = entry.quality;
      thumb.appendChild(chip);
    }

    const body = document.createElement("div");
    body.className = "history-card-body";

    const name = document.createElement("h4");
    name.className = "history-card-name";
    name.title = entry.fileName || "";
    name.textContent = entry.fileName || "Без названия";
    body.appendChild(name);

    const meta = document.createElement("div");
    meta.className = "history-card-meta";
    const host = detectHost(entry.sourceUrl);
    if (host) {
      const hostBadge = document.createElement("span");
      hostBadge.className = "history-card-host";

      const hostLabel = document.createElement("span");
      hostLabel.className = "history-card-host-label";

      const hostButton = document.createElement("button");
      hostButton.type = "button";
      hostButton.className = "history-card-host-link";
      hostButton.textContent = host;
      hostButton.title = "Открыть источник загрузки";
      hostButton.setAttribute("data-bs-toggle", "tooltip");
      hostButton.setAttribute("data-bs-placement", "top");
      hostButton.addEventListener("click", () =>
        openHistorySourceLink(entry.sourceUrl),
      );

      hostBadge.append(hostLabel, hostButton);
      meta.appendChild(hostBadge);
    }
    const size = document.createElement("span");
    size.textContent = formatSizeLabel(entry);
    meta.appendChild(size);
    body.appendChild(meta);

    const dateLabel = formatCardDate(entry);
    if (dateLabel) {
      const date = document.createElement("p");
      date.className = "history-card-date";
      date.textContent = dateLabel;
      body.appendChild(date);
    }

    const actions = document.createElement("div");
    actions.className = "history-card-actions";
    const openBtn = document.createElement("button");
    openBtn.type = "button";
    openBtn.className = "history-card-btn";
    openBtn.dataset.action = "open";
    openBtn.innerHTML =
      '<i class="fa-regular fa-file-video"></i><span>Открыть</span>';
    openBtn.title = "Открыть файл на диске";
    openBtn.setAttribute("data-bs-toggle", "tooltip");
    openBtn.setAttribute("data-bs-placement", "top");
    openBtn.disabled = entry.isMissing;
    openBtn.addEventListener("click", () => openHistoryCardFile(entry));

    const retryBtn = document.createElement("button");
    retryBtn.type = "button";
    retryBtn.className = "history-card-btn ghost";
    retryBtn.dataset.action = "retry";
    retryBtn.innerHTML =
      '<i class="fa-solid fa-arrow-rotate-right"></i><span>Скачать снова</span>';
    retryBtn.title = "Скачать эту запись повторно";
    retryBtn.setAttribute("data-bs-toggle", "tooltip");
    retryBtn.setAttribute("data-bs-placement", "top");
    retryBtn.disabled = !entry.sourceUrl;
    if (entry.sourceUrl) {
      retryBtn.addEventListener("click", () => retryHistoryCardDownload(entry));
    }

    actions.append(openBtn, retryBtn);
    body.appendChild(actions);

    card.append(thumb, body);
    historyCardsRoot.appendChild(card);
  });
}

function createLogEntry(entry, index) {
  const el = document.createElement("div");
  el.className = "log-entry fade-in";
  el.setAttribute("role", "listitem");
  el.setAttribute("data-id", entry.id);
  el.setAttribute("data-url", entry.sourceUrl);
  el.setAttribute("data-timestamp", entry.timestamp || "");
  el.dataset.filepath = entry.filePath || "";
  el.dataset.url = entry.sourceUrl || "";
  el.dataset.filename = entry.fileName || "";
  el.dataset.quality = entry.quality || "";
  el.dataset.datetime = entry.dateText || "";
  el.dataset.resolution = entry.resolution || "";
  el.dataset.size = entry.formattedSize || "";

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
  const isAudioOnly = isAudioEntry(entry);

  // Pick preview thumbnail; for audio-only use a placeholder image
  const thumbSrc = entry?.thumbnail
    ? entry.thumbnail
    : isAudioOnly
      ? HISTORY_AUDIO_PLACEHOLDER
      : "";

  el.innerHTML = `
    <div class="text" data-filepath="${entry.filePath}" data-url="${entry.sourceUrl}" data-filename="${entry.fileName}">
      <div class="date-time-quality">
        <div class="date-time">
          <i class="fa-solid fa-clock"></i> ${entry.dateText || "неизвестно"}
          ${host ? `<span class="hist-badge type-host ${hostClass}" title="Источник">${entry.iconUrl ? `<img class="host-icon" src="file://${entry.iconUrl}" alt="">` : ""}${host}</span>` : ""}
        </div>
        <span class="quality">
          <div class="log-badges top">
            ${entry.resolution ? `<span class="hist-badge type-resolution" title="Разрешение">${entry.resolution}</span>` : ""}
            <span class="q-badge" title="Разрешение/Кадров">${(entry.quality || "").replace(/</g, "&lt;")}</span>
            ${entry.fps ? `<span class="hist-badge type-fps" title="Кадров/с">${entry.fps}fps</span>` : ""}
            ${
              entry.isMissing
                ? `<span class="file-missing" title="Файл отсутствует на диске">файл удалён</span>`
                : `<span class="file-size" title="Размер файла">${formattedSize}</span>`
            }
          </div>
        </span>
      </div>
      <div class="log-filename">
        <span class="log-number">${index + 1}.</span>
        <img class="log-thumb${thumbSrc ? "" : " hidden"}" src="${thumbSrc || ""}" alt="Preview" title="Развернуть превью" data-role="preview-toggle">
        <span class="log-name" title="${(entry.fileName || "").replace(/"/g, "&quot;")}">${entry.fileName}</span>
        
        <div class="log-actions">
          ${
            !entry.isMissing
              ? `
            <button class="log-play-btn" data-bs-toggle="tooltip" data-bs-placement="top" title="Воспроизвести" data-path="${entry.filePath}">
              <i class="fa-solid fa-circle-play"></i>
            </button>`
              : ""
          }
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
      <div class="history-preview-collapsible${thumbSrc ? "" : " hidden"}">
        ${thumbSrc ? `<img class="history-preview-image" src="${thumbSrc}" alt="Preview">` : ""}
      </div>
    </div>
  `;

  const id = entry.id;

  if (el._clickHandler) {
    el.removeEventListener("click", el._clickHandler);
  }

  const playBtn = el.querySelector(".log-play-btn");
  if (playBtn && !entry.isMissing) {
    playBtn.addEventListener("click", async (e) => {
      e.stopPropagation();
      try {
        const exists = await window.electron.invoke(
          "check-file-exists",
          entry.filePath,
        );
        if (!exists) return showToast("Файл не найден на диске", "error");
        await window.electron.invoke("open-last-video", entry.filePath);
      } catch (err) {
        console.error(err);
      }
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

  // Upgrade inline thumbnail: wrap with container and add indicator
  try {
    const thumbImg = el.querySelector('img[data-role="preview-toggle"]');
    if (thumbImg) {
      const wrap = document.createElement("div");
      wrap.className =
        "log-thumb-wrap" +
        (thumbImg.classList.contains("hidden") ? " hidden" : "");
      wrap.setAttribute("data-role", "preview-toggle");
      wrap.title = "Развернуть превью";
      thumbImg.classList.remove("hidden");
      thumbImg.removeAttribute("data-role");
      wrap.appendChild(thumbImg.cloneNode(true));
      const ind = document.createElement("i");
      ind.className = "thumb-indicator fa-solid fa-chevron-down";
      wrap.appendChild(ind);
      thumbImg.parentNode.insertBefore(wrap, thumbImg);
      thumbImg.remove();
    }
  } catch (_) {}

  // Preview expand/collapse toggle
  try {
    const toggleBtn =
      el.querySelector(".log-thumb-wrap") ||
      el.querySelector('[data-role="preview-toggle"]');
    const collapsible = el.querySelector(".history-preview-collapsible");
    if (toggleBtn && collapsible) {
      // Fallback for YouTube maxres → hqdefault if 404
      const attachYtFallback = (imgEl) => {
        try {
          if (!imgEl) return;
          const src = imgEl.getAttribute("src") || "";
          if (/img\.youtube\.com\/vi\/[^/]+\/maxresdefault\.jpg/i.test(src)) {
            imgEl.onerror = () => {
              imgEl.onerror = null;
              imgEl.src = src.replace("maxresdefault.jpg", "hqdefault.jpg");
            };
          }
        } catch (_) {}
      };
      attachYtFallback(collapsible.querySelector("img"));
      attachYtFallback(el.querySelector(".log-thumb-wrap .log-thumb"));

      const toggle = (ev) => {
        ev.stopPropagation();
        const isOpen = collapsible.classList.toggle("open");
        toggleBtn.classList.toggle("open", isOpen);
        if (isOpen) {
          const img = collapsible.querySelector("img");
          const targetH = Math.min(420, img?.naturalHeight || 180);
          collapsible.style.maxHeight = targetH + "px";
          collapsible.style.opacity = "1";
        } else {
          collapsible.style.maxHeight = "0px";
          collapsible.style.opacity = "0";
        }
      };
      toggleBtn.addEventListener("click", toggle);
    }
  } catch (_) {}

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
    const previewPaths = deletedEntries
      .map((entry) => entry.thumbnailCacheFile)
      .filter(Boolean);

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

    let cleanupTimer = null;
    if (previewPaths.length) {
      cleanupTimer = setTimeout(() => {
        window.electron
          .invoke("delete-history-preview", previewPaths)
          .catch((error) =>
            console.warn("Не удалось очистить превью после удаления:", error),
          );
      }, 6000);
    }

    showToast(
      `Удалено ${deletedEntries.length} записей.`,
      "info",
      5500,
      null,
      async () => {
        if (cleanupTimer) {
          clearTimeout(cleanupTimer);
          cleanupTimer = null;
        }
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
  const isEmpty = entries.length === 0;

  disposeAllTooltips(); // очистка старых тултипов перед новой инициализацией

  clearHistoryContainer(container);

  if (isEmpty) {
    const searchWrapper = document.querySelector(".history-search-wrapper");
    const isCompletelyEmpty = state.currentSearchQuery === "";
    if (searchWrapper) {
      searchWrapper.style.display = isCompletelyEmpty ? "none" : "block";
    }

    const iconSearch = document.getElementById("icon-filter-search");
    if (iconSearch) iconSearch.classList.toggle("hidden", isCompletelyEmpty);

    const actions = document.querySelector(".history-actions");
    if (actions) actions.classList.toggle("hidden", isCompletelyEmpty);

    renderHistoryCards([]); // синхронизируем карточки с пустым состоянием
    setTimeout(() => initTooltips(), 0);
    return;
  }

  // Показываем элементы поиска и действий
  const searchWrapper = document.querySelector(".history-search-wrapper");
  if (searchWrapper) searchWrapper.style.display = "block";

  const iconSearch = document.getElementById("icon-filter-search");
  if (iconSearch) iconSearch.classList.remove("hidden");

  const actions = document.querySelector(".history-actions");
  if (actions) actions.classList.remove("hidden");

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
  renderHistoryCards(entries);
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
    const rawHistory = Array.isArray(loadedHistory)
      ? loadedHistory.map((entry) => ({ ...entry }))
      : [];
    const entries = [];

    if (
      Array.isArray(rawHistory) &&
      rawHistory.some((e) => e?.fileName)
    ) {
      for (const rawEntry of rawHistory) {
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

    restoreMissingHistoryPreviews(entries, rawHistory).catch((error) => {
      console.warn("Ошибка при восстановлении превью истории:", error);
    });
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

    let removedPreviews = [];
    if (existingIndex !== -1) {
      const [replacedEntry] = existingHistory.splice(existingIndex, 1);
      if (replacedEntry?.thumbnailCacheFile) {
        removedPreviews.push(replacedEntry.thumbnailCacheFile);
      }
    }
    const updated = [normalized, ...existingHistory];

    setHistoryData(updated);
    await window.electron.invoke("save-history", updated);
    if (removedPreviews.length) {
      try {
        await window.electron.invoke("delete-history-preview", removedPreviews);
      } catch (err) {
        console.warn("Не удалось удалить старое превью:", err);
      }
    }
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
