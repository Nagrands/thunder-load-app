// src/js/modules/urlInputHandler.js

import { urlInput } from "./domElements.js";
import { isValidUrl, isSupportedUrl } from "./validation.js";
import { showToast } from "./toast.js";

const clearButton = document.getElementById("clear-url");
const pasteButton = document.getElementById("paste-url");
const selectFolderButton = document.getElementById("select-folder");

function initUrlInputHandler() {
  if (!urlInput || !clearButton || !pasteButton || !selectFolderButton) return;

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
    return h > 0 ? `${h}:${String(m).padStart(2,'0')}:${String(r).padStart(2,'0')}` : `${m}:${String(r).padStart(2,'0')}`;
  };

  const renderPreview = (data) => {
    const card = document.getElementById('preview-card');
    const t = document.getElementById('preview-title');
    const d = document.getElementById('preview-duration');
    const img = document.getElementById('preview-thumb');
    if (!card || !t || !d || !img) return;
    if (!data || !data.success) { card.style.display = 'none'; return; }
    t.textContent = data.title || '';
    d.textContent = data.duration ? `Длительность: ${durationToStr(data.duration)}` : '';
    if (data.thumbnail) {
      img.src = data.thumbnail; img.style.display = '';
    } else { img.removeAttribute('src'); img.style.display = 'none'; }
    card.style.display = (data.title || data.thumbnail) ? '' : 'none';
  };

  const maybeFetchPreview = () => {
    const url = urlInput.value.trim();
    if (!isValidUrl(url) || !isSupportedUrl(url)) { renderPreview(null); return; }
    if (url === lastPreviewUrl) return; // не повторяем
    lastPreviewUrl = url;
    window.electron.ipcRenderer.invoke('get-video-info', url).then(renderPreview).catch(() => renderPreview(null));
  };

  // Внешний триггер принудительного показа предпросмотра (например, из истории → Повторить)
  urlInput.addEventListener('force-preview', () => {
    // сбрасываем кэш URL, чтобы форсировать повторный запрос
    lastPreviewUrl = "";
    // вызываем немедленно без debounce
    const url = urlInput.value.trim();
    if (!isValidUrl(url) || !isSupportedUrl(url)) { renderPreview(null); return; }
    window.electron.ipcRenderer.invoke('get-video-info', url).then(renderPreview).catch(() => renderPreview(null));
  });

  urlInput.addEventListener("input", () => {
    toggleButtons();
    const val = urlInput.value.trim();
    // Если поле пустое — моментально скрываем превью без ожидания debounce
    if (val === "") {
      if (previewTimer) clearTimeout(previewTimer);
      lastPreviewUrl = "";
      renderPreview(null);
      return;
    }
    if (previewTimer) clearTimeout(previewTimer);
    previewTimer = setTimeout(maybeFetchPreview, 500);
  });
  urlInput.addEventListener("focus", toggleButtons);
  urlInput.addEventListener("blur", toggleButtons);

  // Старт загрузки по Enter (без модификаторов)
  urlInput.addEventListener("keydown", (e) => {
    if (e.key === "Enter" && !e.shiftKey && !e.ctrlKey && !e.metaKey && !e.altKey) {
      e.preventDefault();
      const btn = document.getElementById("download-button");
      if (btn && !btn.disabled) btn.click();
    }
  });

  clearButton.addEventListener("click", () => {
    urlInput.value = "";
    toggleButtons();
    // Немедленно скрываем превью
    lastPreviewUrl = "";
    renderPreview(null);
    urlInput.focus();
  });

  pasteButton.addEventListener("click", async () => {
    const text = (await navigator.clipboard.readText()) || '';
    urlInput.value = text.trim();
    toggleButtons();
    urlInput.dispatchEvent(new Event("input", { bubbles: true })); // запускаем реакцию
    // Также запрашиваем предпросмотр
    urlInput.dispatchEvent(new Event('force-preview'));
    urlInput.focus();
  });

  // Drag & Drop ссылок в область ввода URL
  const wrapper = document.querySelector('.url-input-wrapper');
  if (wrapper) {
    const prevent = (e) => { e.preventDefault(); e.stopPropagation(); };
    ['dragenter','dragover','dragleave','drop'].forEach(ev => wrapper.addEventListener(ev, prevent));
    wrapper.addEventListener('drop', (e) => {
      try {
        const text = (e.dataTransfer.getData('text/uri-list') || e.dataTransfer.getData('text') || '').trim();
        if (text) {
          urlInput.value = text;
          urlInput.dispatchEvent(new Event('input', { bubbles: true }));
          urlInput.focus();
        }
      } catch (_) {}
    });
  }
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
