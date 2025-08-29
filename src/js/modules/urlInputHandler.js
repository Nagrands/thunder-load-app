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
    // кнопка "Добавить всё"
    let addAllBtn = document.getElementById('preview-enqueue-all');
    if (!card || !t || !d || !img) return;
    if (!data || !data.success) { card.style.display = 'none'; if (addAllBtn) addAllBtn.style.display='none'; return; }
    t.textContent = data.title || '';
    d.textContent = data.duration ? `Длительность: ${durationToStr(data.duration)}` : '';
    if (data.thumbnail) {
      img.src = data.thumbnail; img.style.display = '';
    } else { img.removeAttribute('src'); img.style.display = 'none'; }
    card.style.display = (data.title || data.thumbnail) ? '' : 'none';

    // плейлист → показать кнопку и повесить обработчик
    const count = Number(data.playlistCount || (data.entries?.length || 0)) || 0;
    if (count > 1 && Array.isArray(data.entries) && data.entries.length) {
      if (!addAllBtn) {
        addAllBtn = document.createElement('button');
        addAllBtn.id = 'preview-enqueue-all';
        addAllBtn.className = 'btn btn-small';
        addAllBtn.style.marginLeft = '12px';
        addAllBtn.style.whiteSpace = 'nowrap';
        addAllBtn.innerHTML = `<i class="fa-solid fa-list"></i> Добавить все (${data.entries.length})`;
        addAllBtn.setAttribute('data-bs-toggle','tooltip');
        addAllBtn.setAttribute('data-bs-placement','top');
        addAllBtn.setAttribute('title','Добавить все элементы плейлиста в очередь');
        card.appendChild(addAllBtn);
        try { initTooltips(); } catch(_) {}
      } else {
        addAllBtn.innerHTML = `<i class="fa-solid fa-list"></i> Добавить все (${data.entries.length})`;
        addAllBtn.style.display = '';
        try { initTooltips(); } catch(_) {}
      }
      addAllBtn.onclick = () => {
        try {
          const ev = new CustomEvent('queue:addMany', { detail: { urls: data.entries } });
          window.dispatchEvent(ev);
        } catch (_) {}
      };
    } else if (addAllBtn) {
      addAllBtn.style.display = 'none';
    }
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
    wrapper.addEventListener('dragenter', () => wrapper.classList.add('drag-over'));
    wrapper.addEventListener('dragleave', () => wrapper.classList.remove('drag-over'));
    wrapper.addEventListener('drop', () => wrapper.classList.remove('drag-over'));
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
