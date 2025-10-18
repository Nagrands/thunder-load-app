// src/js/modules/urlInputHandler.js

import { urlInput } from "./domElements.js";
import { initTooltips } from "./tooltipInitializer.js";
import { isValidUrl, isSupportedUrl } from "./validation.js";
import { showToast } from "./toast.js";

const clearButton = document.getElementById("clear-url");
const pasteButton = document.getElementById("paste-url");
const selectFolderButton = document.getElementById("select-folder");

function initUrlInputHandler() {
  if (!urlInput || !clearButton || !pasteButton || !selectFolderButton) return;

  const presetsBox = document.querySelector(".quality-presets");
  const inputContainer = document.querySelector(".input-container");
  const wrapperEl = document.querySelector(".url-input-wrapper");
  const syncIconPosition = () => {
    try {
      if (!inputContainer || !wrapperEl) return;
      const cRect = inputContainer.getBoundingClientRect();
      const wRect = wrapperEl.getBoundingClientRect();
      const center = wRect.top - cRect.top + wRect.height / 2;
      inputContainer.style.setProperty("--icon-top", `${center}px`);

      // Также синхронизируем прогресс-оверлей под размеры строки инпута
      const prog = document.getElementById("progress-bar-container");
      if (prog) {
        const top = wRect.top - cRect.top;
        prog.style.top = `${Math.max(0, top)}px`;
        prog.style.height = `${wRect.height}px`;
        prog.style.borderRadius =
          getComputedStyle(wrapperEl).borderRadius || "12px";
      }
    } catch (_) {}
  };
  const setPresetsVisible = (flag) => {
    if (!presetsBox) return;
    presetsBox.classList.toggle("is-visible", !!flag);
    // Пересчитываем позицию иконки, т.к. высота контейнера меняется
    requestAnimationFrame(syncIconPosition);
  };

  const toggleButtons = () => {
    const isEmpty = urlInput.value.trim() === "";
    clearButton.classList.toggle("hidden", isEmpty);
    pasteButton.classList.toggle("hidden", !isEmpty);

    if (selectFolderButton) {
      selectFolderButton.classList.remove("hidden"); // папка должна быть всегда видна (если не загрузка)
    }
  };

  let previewTimer = null;
  let lastPreviewUrl = "";

  const durationToStr = (sec) => {
    const s = Math.max(0, Number(sec) || 0);
    const h = Math.floor(s / 3600);
    const m = Math.floor((s % 3600) / 60);
    const r = Math.floor(s % 60);
    return h > 0
      ? `${h}:${String(m).padStart(2, "0")}:${String(r).padStart(2, "0")}`
      : `${m}:${String(r).padStart(2, "0")}`;
  };

  const renderPreview = (data) => {
    const card = document.getElementById("preview-card");
    const t = document.getElementById("preview-title");
    const d = document.getElementById("preview-duration");
    const img = document.getElementById("preview-thumb");
    // ensure visible class for fade-in
    // кнопка "Добавить всё"
    let addAllBtn = document.getElementById("preview-enqueue-all");
    if (!card || !t || !d || !img) return;
    if (!data || !data.success) {
      card.style.display = "none";
      card.classList.remove("pos-top");
      if (addAllBtn) addAllBtn.style.display = "none";
      return;
    }
    t.textContent = data.title || "";
    d.textContent = data.duration
      ? `Длительность: ${durationToStr(data.duration)}`
      : "";
    t.setAttribute("title", data.title || "");
    if (data.thumbnail) {
      img.src = data.thumbnail;
      img.style.display = "";
    } else {
      img.removeAttribute("src");
      img.style.display = "none";
    }
    card.style.display = data.title || data.thumbnail ? "" : "none";
    card.classList.add("visible");

    // ——— Умное размещение: по умолчанию снизу в потоке; если снизу мало места — переносим наверх (absolute) ———
    try {
      const container = document.querySelector(".input-container");
      const wrap = document.querySelector(".url-input-wrapper");
      if (container && wrap) {
        // дождёмся отрисовки и измерим высоту карточки
        requestAnimationFrame(() => {
          const vH = window.innerHeight;
          const cRect = container.getBoundingClientRect();
          const wRect = wrap.getBoundingClientRect();
          const cardH = card.offsetHeight || 110;
          const margin = 24;
          const spaceBelow = vH - wRect.bottom;
          const placeTop = spaceBelow < cardH + margin; // если снизу места меньше высоты карточки
          card.classList.toggle("pos-top", placeTop);
        });
      }
    } catch (_) {}

    // плейлист → показать кнопку и повесить обработчик
    const count = Number(data.playlistCount || data.entries?.length || 0) || 0;
    if (count > 1 && Array.isArray(data.entries) && data.entries.length) {
      if (!addAllBtn) {
        addAllBtn = document.createElement("button");
        addAllBtn.id = "preview-enqueue-all";
        addAllBtn.className = "btn btn-small";
        addAllBtn.style.marginLeft = "12px";
        addAllBtn.style.whiteSpace = "nowrap";
        addAllBtn.innerHTML = `<i class="fa-solid fa-list"></i> Добавить все (${data.entries.length})`;
        addAllBtn.setAttribute("data-bs-toggle", "tooltip");
        addAllBtn.setAttribute("data-bs-placement", "top");
        addAllBtn.setAttribute(
          "title",
          "Добавить все элементы плейлиста в очередь",
        );
        card.appendChild(addAllBtn);
        try {
          initTooltips();
        } catch (_) {}
      } else {
        addAllBtn.innerHTML = `<i class="fa-solid fa-list"></i> Добавить все (${data.entries.length})`;
        addAllBtn.style.display = "";
        try {
          initTooltips();
        } catch (_) {}
      }
      addAllBtn.onclick = () => {
        try {
          const ev = new CustomEvent("queue:addMany", {
            detail: { urls: data.entries },
          });
          window.dispatchEvent(ev);
        } catch (_) {}
      };
    } else if (addAllBtn) {
      addAllBtn.style.display = "none";
    }

    // Кнопка закрытия предпросмотра
    let closeBtn = card.querySelector(".preview-close");
    if (!closeBtn) {
      closeBtn = document.createElement("button");
      closeBtn.className = "preview-close";
      closeBtn.setAttribute("aria-label", "Закрыть предпросмотр");
      closeBtn.innerHTML = "&times;";
      closeBtn.addEventListener("click", () => {
        card.style.display = "none";
        card.classList.remove("visible");
        card.classList.remove("pos-top");
      });
      card.appendChild(closeBtn);
    }

    // Обертка для картинки (для позиционирования кнопок)
    let wrap = img?.closest(".preview-thumb-wrap");
    if (!wrap && img) {
      wrap = document.createElement("div");
      wrap.className = "preview-thumb-wrap";
      img.parentNode.insertBefore(wrap, img);
      wrap.appendChild(img);
    }

    // Кнопка «Сохранить превью» поверх картинки
    let saveBtn = wrap ? wrap.querySelector(".preview-save") : null;
    const sanitizeFilename = (s) => {
      try {
        const base = String(s || "")
          .replace(/[\\/:*?"<>|]/g, " ")
          .replace(/\s+/g, " ")
          .trim();
        return base.length ? base.slice(0, 80) : "preview";
      } catch {
        return "preview";
      }
    };
    const pickExt = (blob, src) => {
      const byType = {
        "image/jpeg": "jpg",
        "image/png": "png",
        "image/webp": "webp",
        "image/gif": "gif",
      }[blob?.type || ""];
      if (byType) return byType;
      try {
        const u = new URL(src);
        const m = (u.pathname.match(/\.([a-z0-9]+)$/i) || [])[1];
        if (m) return m.toLowerCase();
      } catch {}
      return "jpg";
    };
    const ensureSaveHandler = (btn, src, title) => {
      btn.onclick = async (e) => {
        e.stopPropagation();
        const useSrc = src || btn.dataset.src || data.thumbnail;
        if (!src) return;
        try {
          const resp = await fetch(useSrc, { cache: "no-cache" });
          const blob = await resp.blob();
          const url = URL.createObjectURL(blob);
          const a = document.createElement("a");
          a.href = url;
          const safe = sanitizeFilename(title || t.textContent || "preview");
          const ext = pickExt(blob, useSrc);
          a.download = `${safe}.${ext}`;
          document.body.appendChild(a);
          a.click();
          setTimeout(() => {
            URL.revokeObjectURL(url);
            a.remove();
          }, 0);
        } catch (err) {
          console.error("Save preview failed", err);
        }
      };
    };
    if (wrap && img && img.style.display !== "none" && data.thumbnail) {
      if (!saveBtn) {
        saveBtn = document.createElement("button");
        saveBtn.className = "preview-save";
        saveBtn.innerHTML =
          '<i class="fa-solid fa-download" aria-hidden="true"></i>';
        wrap.appendChild(saveBtn);
      }
      // Обновляем актуальный src и тултип при каждом новом предпросмотре
      saveBtn.dataset.src = data.thumbnail;
      const ttl = (data.title || "").trim();
      saveBtn.title = ttl ? `Сохранить: \"${ttl}\"` : "Сохранить превью";
      ensureSaveHandler(saveBtn, data.thumbnail, ttl);
    } else if (saveBtn) {
      // Если превью нет — скрываем кнопку
      saveBtn.remove();
    }
  };

  const maybeFetchPreview = () => {
    const url = urlInput.value.trim();
    if (!isValidUrl(url) || !isSupportedUrl(url)) {
      renderPreview(null);
      setPresetsVisible(false);
      return;
    }
    setPresetsVisible(true);
    syncIconPosition();
    if (url === lastPreviewUrl) return; // не повторяем
    lastPreviewUrl = url;
    window.electron.ipcRenderer
      .invoke("get-video-info", url)
      .then(renderPreview)
      .catch(() => renderPreview(null));
  };

  // Внешний триггер принудительного показа предпросмотра (например, из истории → Повторить)
  urlInput.addEventListener("force-preview", () => {
    // сбрасываем кэш URL, чтобы форсировать повторный запрос
    lastPreviewUrl = "";
    // вызываем немедленно без debounce
    const url = urlInput.value.trim();
    if (!isValidUrl(url) || !isSupportedUrl(url)) {
      renderPreview(null);
      return;
    }
    window.electron.ipcRenderer
      .invoke("get-video-info", url)
      .then(renderPreview)
      .catch(() => renderPreview(null));
  });

  urlInput.addEventListener("input", () => {
    toggleButtons();
    const val = urlInput.value.trim();
    // Если поле пустое — моментально скрываем превью без ожидания debounce
    if (val === "") {
      if (previewTimer) clearTimeout(previewTimer);
      lastPreviewUrl = "";
      renderPreview(null);
      setPresetsVisible(false);
      requestAnimationFrame(syncIconPosition);
      return;
    }
    if (previewTimer) clearTimeout(previewTimer);
    previewTimer = setTimeout(maybeFetchPreview, 500);
  });
  urlInput.addEventListener("focus", () => {
    toggleButtons();
    // Автовыделение текста, если поле непустое
    try {
      if (urlInput.value && urlInput.value.length > 0) urlInput.select();
    } catch (_) {}
  });
  urlInput.addEventListener("blur", toggleButtons);

  // Старт загрузки по Enter (без модификаторов)
  urlInput.addEventListener("keydown", (e) => {
    if (e.key !== "Enter") return;
    const btn = document.getElementById("download-button");
    if (!btn || btn.disabled) return;
    e.preventDefault();
    // Shift+Enter → только в очередь
    if (e.shiftKey && !e.altKey && !e.ctrlKey && !e.metaKey) {
      btn.dataset.enqueueOnly = "1";
      btn.click();
      return;
    }
    // Alt+Enter → Audio Only
    if (e.altKey && !e.shiftKey && !e.ctrlKey && !e.metaKey) {
      btn.dataset.forceAudioOnly = "1";
      btn.click();
      return;
    }
    // Обычный Enter → как прежде
    btn.click();
  });

  clearButton.addEventListener("click", () => {
    urlInput.value = "";
    toggleButtons();
    // Немедленно скрываем превью
    lastPreviewUrl = "";
    renderPreview(null);
    setPresetsVisible(false);
    urlInput.focus();
  });

  pasteButton.addEventListener("click", async () => {
    const text = (await navigator.clipboard.readText()) || "";
    urlInput.value = text.trim();
    toggleButtons();
    urlInput.dispatchEvent(new Event("input", { bubbles: true })); // запускаем реакцию
    // Также запрашиваем предпросмотр
    urlInput.dispatchEvent(new Event("force-preview"));
    urlInput.focus();
    requestAnimationFrame(syncIconPosition);
  });

  // Drag & Drop ссылок в область ввода URL
  const wrapper = document.querySelector(".url-input-wrapper");
  if (wrapper) {
    const prevent = (e) => {
      e.preventDefault();
      e.stopPropagation();
    };
    ["dragenter", "dragover", "dragleave", "drop"].forEach((ev) =>
      wrapper.addEventListener(ev, prevent),
    );
    wrapper.addEventListener("dragenter", () =>
      wrapper.classList.add("drag-over"),
    );
    wrapper.addEventListener("dragleave", () =>
      wrapper.classList.remove("drag-over"),
    );
    wrapper.addEventListener("drop", () =>
      wrapper.classList.remove("drag-over"),
    );
    wrapper.addEventListener("drop", (e) => {
      try {
        const text = (
          e.dataTransfer.getData("text/uri-list") ||
          e.dataTransfer.getData("text") ||
          ""
        ).trim();
        if (text) {
          urlInput.value = text;
          urlInput.dispatchEvent(new Event("input", { bubbles: true }));
          urlInput.focus();
          requestAnimationFrame(syncIconPosition);
        }
      } catch (_) {}
    });
  }

  // Первичная синхронизация видимости пресетов
  (function initPresetsVisibility() {
    const v = urlInput.value.trim();
    setPresetsVisible(isValidUrl(v) && isSupportedUrl(v));
    // И первоначально выставим корректную позицию иконки
    requestAnimationFrame(syncIconPosition);
  })();

  // Пересчёт при ресайзе окна
  window.addEventListener("resize", () =>
    requestAnimationFrame(syncIconPosition),
  );
}

function hideUrlActionButtons() {
  pasteButton?.classList.add("hidden");
  selectFolderButton?.classList.add("hidden");
}

function showUrlActionButtons() {
  pasteButton?.classList.remove("hidden");
  selectFolderButton?.classList.remove("hidden");
}

export { initUrlInputHandler, hideUrlActionButtons, showUrlActionButtons };
