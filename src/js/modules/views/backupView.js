// src/js/modules/views/backupView.js

import { showToast } from "../toast.js";
import { showConfirmationDialog } from "../modals.js";
import { initTooltips } from "../tooltipInitializer.js";

/**
 * @typedef {Object} BackupProgram
 * @property {string} name               - Short human-friendly preset name.
 * @property {string} source_path        - Absolute source path to backup from.
 * @property {string} backup_path        - Absolute destination folder for archives.
 * @property {string} [profile_path]     - Optional profile folder to include (placed into "Profiles").
 * @property {string[]} [config_patterns]- Optional list of filename masks (e.g. ['*.ini','*.cfg']). Empty → all files.
 */

/**
 * @typedef {Object} BackupState
 * @property {BackupProgram[]} programs          - Current list of backup presets.
 * @property {Record<string, number>} lastTimes  - Map: preset name → timestamp (ms) of last successful backup.
 * @property {string} filter                     - Text filter (applied to name/source/destination).
 * @property {boolean} autoscroll                - If true, the log autoscrolls to bottom on updates.
 * @property {boolean} mono                      - If true, log uses monospace font.
 */

/**
 * Render Backup tab view.
 * Creates the full UI for managing backup presets, including search, list, modal editor, and log.
 * The function is idempotent and returns a detached DOM subtree (wrapper) ready to be inserted.
 * @returns {HTMLDivElement} Root element of the Backup tab.
 */
export default function renderBackup() {
  /**
   * Detects whether the Backup tab is disabled via localStorage flag.
   * @returns {boolean}
   */
  const _isBackupDisabled = () => {
    try {
      const raw = localStorage.getItem("backupDisabled");
      if (raw === null) return false;
      return JSON.parse(raw) === true;
    } catch {
      return false;
    }
  };
  
  if (_isBackupDisabled()) {
    const placeholder = document.createElement("div");
    placeholder.id = "backup-view";
    placeholder.className = "backup-view tab-content p-4 space-y-4";
    placeholder.style.display = "none";
    return placeholder;
  }

  const ipc = window.electron?.ipcRenderer || window.electron;
  
  /**
   * Wrapper over Electron's ipcRenderer.invoke with a guarded fallback.
   * @param {string} ch
   * @param {...any} args
   * @returns {Promise<any>}
   */
  const invoke = (ch, ...args) =>
    ipc?.invoke
      ? ipc.invoke(ch, ...args)
      : Promise.reject(new Error("IPC not available"));

  const wrapper = document.createElement("div");
  wrapper.id = "backup-view";
  wrapper.className = "backup-view tab-content p-4 space-y-4";

  const container = document.createElement("div");
  container.className = "backup-center";

  const html = `
    <div class="wg-glass">
      <div class="wg-header">
        <div class="title">
          <i class="fa-solid fa-database"></i>
          <div class="text">
            <h2>BackUp Manager</h2>
            <p class="subtitle text-muted">Резервное копирование файлов и папок</p>
          </div>
        </div>
      </div>

      <div id="bk-toolbar" class="wg-block" aria-label="Управление профилями">
        <div class="bk-search-container">
          <i class="fa-solid fa-magnifying-glass bk-search-icon"></i>
          <input type="text" id="bk-filter" placeholder="Поиск профиля, пути..." class="input" style="flex:1;" />
          <button type="button" id="bk-clear-filter" class="history-action-button" data-bs-toggle="tooltip" data-bs-placement="top" title="Очистить поиск" style="width:32px; height:32px;"><i class="fa-solid fa-times"></i></button>
        </div>

        <h1 class="section-heading">
          <div>
            Профиль 
            <span id="bk-count" class="bk-count" data-bs-toggle="tooltip" data-bs-placement="top" title="Видимых/всего">0/0</span>
          </div>
          <label class="checkbox-label">
            <input type="checkbox" class="bk-chk" id="bk-select-all" />
            <span class="text-xs text-muted">выбрать всё</span>
          </label>
          <div>
            <span id="bk-search-info" class="text-xs text-muted" style="margin-left:6px"></span>
            <div class="bk-actions">
              <button id="bk-add" class="btn btn-sm" data-bs-toggle="tooltip" data-bs-placement="top" title="Создать профиль">
                <i class="fa-solid fa-plus"></i>
              </button>
              <button id="bk-del" class="btn btn-sm" data-bs-toggle="tooltip" data-bs-placement="top" title="Удалить выбранные" disabled>
                <i class="fa-solid fa-trash"></i>
                <span class="bk-badge" id="bk-del-count" style="display:none">0</span>
              </button>
              <button id="bk-run-selected" class="btn btn-sm" data-bs-toggle="tooltip" data-bs-placement="top" title="Запустить для выбранных" disabled>
                <i class="fa-solid fa-play"></i>
                <span class="bk-badge" id="bk-run-count" style="display:none">0</span>
              </button>
            </div>
          </div>
        </h1>
          
        <div id="bk-list" class="bk-list space-y-2"></div>

        <details class="wg-log-block">
          <summary class="log-summary">
            <span class="log-title"><i class="fa-solid fa-terminal"></i> Лог</span>
            <div class="log-actions">
              <button id="bk-log-copy" type="button" class="small-button" data-bs-toggle="tooltip" data-bs-placement="top" title="Скопировать лог"><i class="fa-solid fa-copy"></i></button>
              <button id="bk-log-export" type="button" class="small-button" data-bs-toggle="tooltip" data-bs-placement="top" title="Экспорт в файл"><i class="fa-solid fa-file-arrow-down"></i></button>
              <button id="bk-log-clear" type="button" class="small-button" data-bs-toggle="tooltip" data-bs-placement="top" title="Очистить лог"><i class="fa-solid fa-trash"></i></button>
            </div>
          </summary>
          <pre id="bk-log" class="wg-status console text-xs overflow-auto"></pre>
        </details>
      </div>
    </div>
  `;
  
  container.innerHTML = html;
  wrapper.appendChild(container);

  // Search filter logic
  const debounce = (fn, ms = 120) => {
    let t;
    return (...args) => {
      clearTimeout(t);
      t = setTimeout(() => fn(...args), ms);
    };
  };
  
  const filterInput = container.querySelector("#bk-filter");
  const clearFilterBtn = container.querySelector("#bk-clear-filter");
  
  if (filterInput) {
    filterInput.addEventListener(
      "input",
      debounce(() => {
        state.filter = filterInput.value.trim();
        renderList();
      }, 150),
    );
  }
  
  if (clearFilterBtn && filterInput) {
    clearFilterBtn.addEventListener("click", () => {
      filterInput.value = "";
      state.filter = "";
      renderList();
      filterInput.focus();
    });
  }

  // Backup Hints Block
  const subtitle = container.querySelector(".wg-header");
  const hintsBlock = document.createElement("div");
  hintsBlock.className = "bk-hints";
  hintsBlock.innerHTML = '<div class="bk-hint-text"></div>';
  subtitle.insertAdjacentElement("afterend", hintsBlock);

  const hints = [
    "💾 Дважды кликните по профилю, чтобы быстро отредактировать пути и параметры.",
    "⚙️ Используйте кнопку «Запустить для выбранных», чтобы копировать несколько профилей сразу.",
    "📁 Нажмите путь назначения в профиле, чтобы открыть его в Finder или Проводнике.",
    "🕒 Последнее время успешного копирования видно под именем каждого профиля.",
  ];
  
  let hintIndex = 0;
  const hintEl = hintsBlock.querySelector(".bk-hint-text");
  const showHint = () => {
    hintEl.style.opacity = 0;
    setTimeout(() => {
      hintEl.textContent = hints[hintIndex];
      hintEl.style.opacity = 1;
      hintIndex = (hintIndex + 1) % hints.length;
    }, 400);
  };
  
  showHint();
  setInterval(showHint, 10000);

  // Autofocus search when opening the tab
  queueMicrotask(() => {
    const s = wrapper.querySelector("#bk-filter");
    s && s.focus();
  });

  /**
   * Shorthand DOM query inside the Backup view wrapper.
   * @template {Element} T
   * @param {string} sel
   * @param {ParentNode} [root]
   * @returns {T|null}
   */
  const getEl = (sel, root = wrapper) => root.querySelector(sel);
  
  const logBox = getEl("#bk-log");
  
  // Restore logBox content from localStorage if present
  if (logBox) {
    try {
      const logData = localStorage.getItem("backupLog");
      if (logData) {
        logBox.innerHTML = logData;
      }
    } catch {}
  }

  /**
   * Show error notification in the UI
   * @param {string} message - Error message
   * @param {string} details - Additional details
   */
  function showError(message, details = "") {
    showToast(`${message}${details ? ": " + details : ""}`, "error");
  }

  /**
   * Show skeleton loading state
   */
  function renderSkeleton() {
    const root = getEl("#bk-list");
    root.innerHTML = "";

    for (let i = 0; i < 3; i++) {
      const skeleton = document.createElement("div");
      skeleton.className = "bk-row bk-skeleton";
      skeleton.innerHTML = `
        <div style="display: flex; align-items: center; gap: 12px; width: 100%;">
          <div style="width: 18px; height: 18px; border-radius: 4px;"></div>
          <div style="flex: 1;">
            <div style="height: 16px; width: 60%; margin-bottom: 8px; border-radius: 4px;"></div>
            <div style="height: 12px; width: 80%; margin-bottom: 4px; border-radius: 3px;"></div>
            <div style="height: 12px; width: 40%; border-radius: 3px;"></div>
          </div>
        </div>
      `;
      root.appendChild(skeleton);
    }
  }

  /**
   * Smart scroll management for log box
   * Maintains user's scroll position unless they're at the bottom
   */
  function manageLogScroll() {
    if (!logBox) return { wasScrolledToBottom: false, restoreScrollPosition: () => {} };
    
    const threshold = 50;
    const isNearBottom = logBox.scrollHeight - logBox.clientHeight - logBox.scrollTop <= threshold;
    
    return {
      wasScrolledToBottom: isNearBottom,
      restoreScrollPosition: () => {
        if (isNearBottom) {
          logBox.scrollTop = logBox.scrollHeight - logBox.clientHeight;
        }
      }
    };
  }

  /**
   * Append a timestamped message to the log area.
   * Respects autoscroll or keeps viewport when user is scrolled up.
   * Adds color coding for log lines.
   * Saves log content to localStorage.
   * @param {string} msg
   * @returns {void}
   */
  const log = (msg) => {
    if (!logBox) return;
    
    const scrollManager = manageLogScroll();
    
    const line = document.createElement("div");
    line.className = "log-line";
    
    // Color coding based on message content
    if (/✔|успех|success/i.test(msg)) line.classList.add("log-success");
    else if (/✖|ошибка|error/i.test(msg)) line.classList.add("log-error");
    else if (/предупреждение|warn/i.test(msg)) line.classList.add("log-warn");
    else line.classList.add("log-info");
    
    // Format timestamp
    const now = new Date();
    const date = now.toLocaleDateString('ru-RU').replace(/\./g, '-');
    const time = now.toLocaleTimeString('ru-RU');
    
    const span = document.createElement('span');
    span.className = 'log-date';
    span.textContent = `[${date} ${time}]`;
    line.appendChild(span);
    line.append(` ${msg}`);
    
    // Add to log (append to maintain chronological order)
    logBox.appendChild(line);
    
    // Restore scroll position
    scrollManager.restoreScrollPosition();
    
    // Copy line text on click
    line.addEventListener('click', () => {
      navigator.clipboard.writeText(line.textContent.trim()).then(() => {
        line.classList.add('copied');
        setTimeout(() => line.classList.remove('copied'), 500);
        showToast("Строка скопирована в буфер", "success");
      });
    });
    
    // Save log to localStorage
    try {
      localStorage.setItem("backupLog", logBox.innerHTML);
    } catch {}
  };

  const toast = (m, t = "success") => showToast(m, t);

  /** @type {BackupState} */
  const state = {
    programs: [],
    lastTimes: {},
    filter: "",
    autoscroll: (() => {
      try {
        return JSON.parse(localStorage.getItem("bk_log_autoscroll") || "true");
      } catch {
        return true;
      }
    })(),
    mono: (() => {
      try {
        return JSON.parse(localStorage.getItem("bk_log_mono") || "true");
      } catch {
        return true;
      }
    })(),
  };
  
  const actions = () => ({
    del: getEl("#bk-del"),
    runSel: getEl("#bk-run-selected"),
  });

  /**
   * Update toolbar actions availability, titles, badges and select-all state.
   * @returns {void}
   */
  function updateActionsState() {
    const bkList = getEl("#bk-list");
    if (!bkList) return;
    
    const visibleCheckboxes = Array.from(
      bkList.querySelectorAll(".bk-chk"),
    ).filter((chk) => chk.offsetParent !== null);
    
    const checkedVisibleCheckboxes = visibleCheckboxes.filter(
      (chk) => chk.checked,
    );
    
    const count = checkedVisibleCheckboxes.length;
    const total = visibleCheckboxes.length;
    const { del, runSel } = actions();
    
    if (del) del.disabled = count === 0;
    if (runSel) runSel.disabled = count === 0;
    if (runSel) runSel.title = `Запустить для выбранных (${count})`;
    if (del) del.title = `Удалить выбранные (${count})`;
    
    // Update Bootstrap tooltips
    const updateTooltip = (el, text) => {
      if (!el) return;
      try {
        const TT = window.bootstrap && window.bootstrap.Tooltip;
        if (!TT) return;
        const inst = TT.getInstance(el);
        if (inst && typeof inst.setContent === "function") {
          inst.setContent({ ".tooltip-inner": text });
        } else if (inst) {
          inst.dispose();
          new TT(el, { title: text, trigger: "hover focus" });
        }
      } catch (_) {}
    };
    
    updateTooltip(runSel, runSel ? runSel.title : "");
    updateTooltip(del, del ? del.title : "");
    
    // Update badges
    const delBadge = getEl("#bk-del-count");
    const runBadge = getEl("#bk-run-count");
    
    if (delBadge) {
      delBadge.textContent = String(count);
      delBadge.style.display = count ? "" : "none";
    }
    
    if (runBadge) {
      runBadge.textContent = String(count);
      runBadge.style.display = count ? "" : "none";
    }
    
    const selAll = getEl("#bk-select-all");
    if (selAll) {
      selAll.indeterminate = count > 0 && count < total;
      selAll.checked = total > 0 && count === total;
    }
  }

  /**
   * Format a timestamp into a relative short Russian label.
   * @param {number|undefined|null} ts
   * @returns {string}
   */
  function formatLast(ts) {
    if (!ts) return "—";
    const diff = Math.max(0, Date.now() - Number(ts));
    const s = Math.floor(diff / 1000);
    if (s < 60) return `${s}s назад`;
    const m = Math.floor(s / 60);
    if (m < 60) return `${m} мин. назад`;
    const h = Math.floor(m / 60);
    if (h < 24) return `${h} ч. назад`;
    const d = Math.floor(h / 24);
    return `${d} дн. назад`;
  }

  /**
   * Produce a label object for "Последняя копия" chip based on freshness.
   * @param {number|undefined|null} ts
   * @returns {{text:string, cls:string}}
   */
  function lastLabel(ts) {
    if (!ts) return { text: "не выполнялась", cls: "is-none" };
    const diff = Math.max(0, Date.now() - Number(ts));
    const s = Math.floor(diff / 1000);
    if (s < 60 * 60 * 24) return { text: "сегодня", cls: "is-fresh" };
    if (s < 60 * 60 * 24 * 7) return { text: formatLast(ts), cls: "is-recent" };
    return { text: formatLast(ts), cls: "is-stale" };
  }

  /**
   * Load presets and last run times from the main process into state, then render the list.
   * @returns {Promise<void>}
   */
  const load = async () => {
    renderSkeleton();
    try {
      const res = await invoke("backup:getPrograms");
      if (!res?.success) throw new Error(res?.error || "load failed");
      state.programs = res.programs || [];
      const t = await invoke("backup:getLastTimes");
      state.lastTimes = t?.success ? t.map || {} : {};
      renderList();
    } catch (error) {
      console.error("Failed to load backup programs:", error);
      toast("Не удалось загрузить профили: " + error.message, "error");
      renderList();
    }
  };

  /**
   * Persist current programs array to the main process.
   * @returns {Promise<void>}
   */
  const save = async () => {
    const res = await invoke("backup:savePrograms", state.programs);
    if (!res?.success) throw new Error(res?.error || "save failed");
  };

  /**
   * Render the visible list of presets with current filter applied.
   * @returns {void}
   */
  function renderList() {
    const root = getEl("#bk-list");
    root.innerHTML = "";
    
    const filtered = state.filter
      ? state.programs.filter((p) => {
          const q = state.filter.toLowerCase();
          return (
            (p.name || "").toLowerCase().includes(q) ||
            (p.source_path || "").toLowerCase().includes(q) ||
            (p.backup_path || "").toLowerCase().includes(q)
          );
        })
      : state.programs;

    // Update counts badge
    const cnt = getEl("#bk-count");
    if (cnt) cnt.textContent = `${filtered.length}/${state.programs.length}`;
    
    // Toggle select-all visibility
    const selWrap = getEl("#bk-select-all")?.closest(".checkbox-label");
    if (selWrap) {
      selWrap.style.display = state.programs.length ? "inline-flex" : "none";
    }

    const sinfo = getEl("#bk-search-info");
    if (sinfo) {
      sinfo.textContent = state.filter ? `найдено: ${filtered.length}` : "";
    }

    // Handle empty state
    if (!filtered.length) {
      root.innerHTML = `
        <div class="wg-alert is-muted">
          <div class="wg-alert-icon"><i class="fa-solid fa-circle-info"></i></div>
          <div class="wg-alert-content">Нет профиля — добавьте первый.</div>
          <div class="wg-alert-actions">
            <button id="bk-create-first" class="btn btn-primary btn-sm">
              <i class="fa-solid fa-plus" style="margin-right:6px"></i>Создать
            </button>
          </div>
        </div>`;
      
      const { del, runSel } = actions();
      if (del) del.disabled = true;
      if (runSel) runSel.disabled = true;
      
      const addBtn = root.querySelector("#bk-create-first");
      addBtn?.addEventListener("click", () => showEditForm(-1));
      return;
    }

    // Render filtered items
    const selAll = getEl("#bk-select-all");
    if (selAll) {
      selAll.checked = false;
      selAll.indeterminate = false;
    }
    
    filtered.forEach((p, index) => {
      const idx = state.programs.indexOf(p);
      const row = document.createElement("div");
      row.className = "bk-row wg-card";
      row.style.animationDelay = `${index * 0.05}s`;
      
      const lbl = lastLabel(state.lastTimes[p.name]);
      const patterns = Array.isArray(p.config_patterns) && p.config_patterns.length
        ? p.config_patterns.join(", ")
        : "все файлы";
        
      row.innerHTML = `
        <input type="checkbox" class="bk-chk" data-i="${idx}" aria-label="Выбрать профиль ${p.name}" />
        <div class="bk-row-content min-w-0">
          <div class="font-semibold truncate">${p.name}</div>
          <div class="back-path" data-bs-toggle="tooltip" data-bs-placement="top" title="${p.source_path} → ${p.backup_path}">${p.source_path} → ${p.backup_path}</div>
          <div class="back-filter">Фильтры: ${patterns}</div>
          <div class="text-xs text-muted">Последняя копия: <span class="bk-chip ${lbl.cls}" data-bs-toggle="tooltip" data-bs-placement="top" title="${state.lastTimes[p.name] ? new Date(state.lastTimes[p.name]).toLocaleString() : ""}">${lbl.text}</span></div>
        </div>
        <div class="bk-row-actions">
          <button class="btn btn-sm bk-edit" data-i="${idx}" data-bs-toggle="tooltip" data-bs-placement="top" title="Редактировать"><i class="fa-solid fa-pen"></i></button>
          <button class="btn btn-sm bk-open-src" data-i="${idx}" data-bs-toggle="tooltip" data-bs-placement="top" title="Открыть исходник"><i class="fa-regular fa-folder-open"></i></button>
          <button class="btn btn-sm bk-open" data-i="${idx}" data-bs-toggle="tooltip" data-bs-placement="top" title="Открыть папку назначения"><i class="fa-solid fa-folder-open"></i></button>
          <button class="btn btn-sm bk-run" data-i="${idx}" data-bs-toggle="tooltip" data-bs-placement="top" title="Запустить"><i class="fa-solid fa-play"></i></button>
        </div>
      `;
      
      // Enable editing via double-click
      row.addEventListener("dblclick", () => showEditForm(idx));
      root.appendChild(row);
      
      row.setAttribute(
        "aria-label",
        `${p.name}: ${p.source_path} → ${p.backup_path}`,
      );
    });
    
    // Update actions state and attach event listeners
    root.querySelectorAll(".bk-chk").forEach((c) => {
      c.addEventListener("change", updateActionsState);
    });
    
    updateActionsState();
    queueMicrotask(() => initTooltips());
  }

  /**
   * Parse comma-separated patterns string into a normalized string array.
   * @param {string} input
   * @returns {string[]}
   */
  function parsePatterns(input) {
    if (!input) return [];
    return input
      .split(",")
      .map((s) => s.trim())
      .filter(Boolean);
  }

  /**
   * Ask the main process to pick a directory and return its absolute path.
   * @returns {Promise<string|null>}
   */
  async function pickDir() {
    const res = await invoke("backup:chooseDir");
    if (res?.success) return res.path;
    return null;
  }

  /**
   * Render a field for the backup modal form.
   * @param {string} labelText
   * @param {string} id
   * @param {string} value
   * @param {string} hint
   * @param {boolean} required
   * @param {boolean} hasPick
   * @returns {string}
   */
  function renderField(labelText, id, value, hint, required = false, hasPick = false) {
    return `
      <label class="wg-field flex flex-col gap-1 relative" data-hint="${hint}">
        <span class="text-sm">${labelText}</span>
        <div class="filter-clear-container input-container">
          <input id="${id}" class="input" type="text" placeholder="${hint}" value="${value}" ${required ? "required" : ""} aria-describedby="${id}-hint ${id}-err"/>
          <div class="input-actions">
            ${hasPick ? `<button type="button" class="pick-folder-btn history-action-button" data-pick="#${id}" title="Выбрать папку" data-bs-toggle="tooltip" data-bs-placement="top"><i class="fa-regular fa-folder-open"></i></button>` : ""}
            <button type="button" class="clear-field-btn history-action-button" data-target="#${id}" title="Очистить" data-bs-toggle="tooltip" data-bs-placement="top"><i class="fa-solid fa-times-circle"></i></button>
          </div>
        </div>
      </label>`;
  }

  /**
   * Open modal editor for creating or editing a backup preset.
   * @param {number} [idx=-1] - Index in state.programs, or -1 to create a new preset.
   * @returns {void}
   */
  function showEditForm(idx = -1) {
    const isNew = idx === -1;
    const init = isNew
      ? {
          name: "",
          source_path: "",
          backup_path: "",
          profile_path: "",
          config_patterns: [],
        }
      : JSON.parse(JSON.stringify(state.programs[idx]));
    
    const nameFieldHTML = renderField(
      "Название *",
      "f-name",
      init.name || "",
      "Имя профиля и создаваемого архива",
      true,
    );

    const overlay = document.createElement("div");
    overlay.className = "modal-overlay";
    overlay.innerHTML = `
      <div class="modal-content bk-modal">
        <div class="modal-header">
          <h2><i class="fa-solid fa-box-archive"></i> ${isNew ? "Создание профиля" : `Редактирование профиля - ${init.name}`}</h2>
          <button class="close-modal bk-close" aria-label="Закрыть" data-bs-toggle="tooltip" data-bs-placement="top" title="Закрыть">&times;</button>
        </div>
        <div class="modal-body bk-form-grid">
          ${nameFieldHTML}
          ${renderField("Исходная папка *", "f-src", init.source_path || "", "Укажите путь к папке резервного копирования", true, true)}
          ${renderField("Папка бэкапа *", "f-dst", init.backup_path || "", "Путь, где будет храниться резервная копия", true, true)}
          ${renderField("Папка настроек", "f-prof", init.profile_path || "", "Будет создан подкаталог «Profiles»", false, true)}
          ${renderField("Фильтры файлов", "f-pats", (init.config_patterns || []).join(","), "Поддерживаются * и ? (по имени файла)", false)}
          <div class="bk-preview-card">
            <div class="text-xs text-muted" style="padding: 4px 0;font-weight:600;"><strong>Предпросмотр</strong></div>
            <div id="bk-preview" class="text-sm bk-preview"></div>
          </div>
        </div>
        <div class="modal-footer flex gap-3">
          <label class="checkbox-label" style="margin-right:auto; gap:.5rem">
            <input type="checkbox" id="bk-save-run" />
            <i class="fa-solid fa-play"></i>
            <span class="text-xs text-muted">Запустить</span>
          </label>
          <button class="btn btn-sm btn-secondary bk-close">Отмена</button>
          <button id="bk-save" class="btn btn-sm btn-primary">Сохранить</button>
        </div>
      </div>
      `;
    
    // Show modal
    const _docEl = document.documentElement;
    const _prevOverflow = _docEl.style.overflow;
    _docEl.style.overflow = "hidden";
    overlay.style.display = "flex";
    wrapper.appendChild(overlay);
    
    const q = (s) => overlay.querySelector(s);

    // Name input field
    const nameInput = overlay.querySelector("#f-name");

    // Add profile list button
    queueMicrotask(() => {
      if (!nameInput) return;
      const inputContainer = nameInput.closest(".input-container");
      if (!inputContainer) return;
      const inputActions = inputContainer.querySelector(".input-actions");
      
      if (state.programs.length > 0 && inputActions && !inputActions.querySelector(".name-list-btn")) {
        const btnList = document.createElement("button");
        btnList.type = "button";
        btnList.className = "history-action-button name-list-btn";
        btnList.title = "Использовать профиль";
        btnList.setAttribute("data-bs-toggle", "tooltip");
        btnList.setAttribute("data-bs-placement", "top");
        btnList.innerHTML = '<i class="fa-solid fa-list"></i>';
        inputActions.appendChild(btnList);

        btnList.addEventListener("click", () => {
          let listBox = overlay.querySelector(".name-list-popup");
          if (!listBox) {
            listBox = document.createElement("div");
            listBox.className = "name-list-popup";
            inputContainer.style.position = "relative";
            listBox.style.position = "absolute";
            listBox.style.top = "100%";
            listBox.style.left = "0";
            listBox.style.width = "100%";
            listBox.style.maxHeight = "200px";
            listBox.style.overflowY = "auto";
            listBox.style.background = "rgba(32,32,40,0.95)";
            listBox.style.border = "1px solid rgba(255,255,255,0.1)";
            listBox.style.borderRadius = "8px";
            listBox.style.zIndex = "999";
            listBox.style.padding = "4px 0";
            inputContainer.appendChild(listBox);

            // Populate with existing profiles
            state.programs.forEach((p) => {
              const item = document.createElement("div");
              item.className = "name-list-item";
              item.textContent = p.name;
              item.style.padding = "6px 10px";
              item.style.cursor = "pointer";
              
              item.addEventListener("mouseenter", () => {
                item.style.background = "rgba(120,180,255,0.2)";
              });
              
              item.addEventListener("mouseleave", () => {
                item.style.background = "transparent";
              });
              
              item.addEventListener("click", () => {
                nameInput.value = p.name;
                overlay.querySelector("#f-src").value = p.source_path || "";
                overlay.querySelector("#f-dst").value = p.backup_path || "";
                overlay.querySelector("#f-prof").value = p.profile_path || "";
                overlay.querySelector("#f-pats").value = (p.config_patterns || []).join(",");
                updatePreview();
                _debouncedUpdateSave();
                listBox.remove();
              });
              
              listBox.appendChild(item);
            });

            // Close on outside click
            setTimeout(() => {
              const closePopup = (e) => {
                if (!listBox.contains(e.target) && e.target !== btnList) {
                  listBox.remove();
                  document.removeEventListener("mousedown", closePopup, true);
                }
              };
              document.addEventListener("mousedown", closePopup, true);
            }, 0);
          } else {
            listBox.remove();
          }
        });
      }
    });

    // Autofocus first empty required field
    queueMicrotask(() => {
      const fields = ["#f-name", "#f-src", "#f-dst"];
      for (const sel of fields) {
        const el = q(sel);
        if (el && el.offsetParent !== null && !el.value.trim()) {
          el.focus();
          break;
        }
      }
    });

    function updateSaveState() {
      const name = q("#f-name")?.value?.trim();
      const src = q("#f-src")?.value?.trim();
      const dst = q("#f-dst")?.value?.trim();
      const hasErrors = !!overlay.querySelector(".field-error:not(:empty)");
      const ok = !!name && !!src && !!dst && !hasErrors;
      const btn = q("#bk-save");
      
      if (btn) {
        btn.disabled = !ok;
        btn.title = ok ? "Сохранить" : "Заполните обязательные поля";
      }
    }
    
    const _debouncedUpdateSave = ((fn) => {
      let t;
      return () => {
        clearTimeout(t);
        t = setTimeout(fn, 120);
      };
    })(updateSaveState);

    // Field error handling
    function markFieldError(id, hasError, message) {
      const inp = q(`#${id}`);
      const box = overlay.querySelector(`.field-error[data-error-for="${id}"]`);
      if (!inp || !box) return;
      
      if (hasError) {
        inp.classList.add("input-error");
        void inp.offsetWidth; // Force reflow
      } else {
        inp.classList.remove("input-error");
      }
      
      box.textContent = hasError ? message || "" : "";
      if (hasError) box.classList.add("field-error-icon");
      else box.classList.remove("field-error-icon");
      
      _debouncedUpdateSave();
    }

    // Wire up pick/clear buttons
    overlay.querySelectorAll(".pick-folder-btn").forEach((btn) => {
      btn.addEventListener("click", async () => {
        const targetSel = btn.getAttribute("data-pick");
        const input = targetSel ? q(targetSel) : null;
        const p = await pickDir();
        if (p && input) input.value = p;
        updatePreview();
      });
    });
    
    overlay.querySelectorAll(".clear-field-btn").forEach((btn) => {
      const sel = btn.getAttribute("data-target");
      const input = sel ? q(sel) : null;
      if (!input) return;

      const updateVisibility = () => {
        btn.style.display = input.value.trim() ? "" : "none";
      };

      updateVisibility();
      input.addEventListener("input", updateVisibility);

      btn.addEventListener("click", () => {
        input.value = "";
        updateVisibility();
        updatePreview();
      });
    });

    // Field validation
    ["f-name", "f-src", "f-dst"].forEach((fid) => {
      const el = q(`#${fid}`);
      el?.addEventListener("input", () => {
        markFieldError(fid, false, "");
        updatePreview();
        _debouncedUpdateSave();
      });
      
      el?.addEventListener("change", () => {
        markFieldError(fid, false, "");
        updatePreview();
        _debouncedUpdateSave();
      });
    });

    ["#f-prof", "#f-pats"].forEach((fid) => {
      const el = q(fid);
      el?.addEventListener("input", () => {
        updatePreview();
        _debouncedUpdateSave();
      });
    });

    // Drag & Drop support
    ["#f-src", "#f-dst", "#f-prof"].forEach((sel) => {
      const field = q(sel);
      if (!field) return;
      const box = field.closest(".input-container");
      if (!box) return;

      const addHL = () => box.classList.add("is-drop");
      const rmHL = () => box.classList.remove("is-drop");

      ["dragenter", "dragover"].forEach((ev) => {
        box.addEventListener(ev, (e) => {
          e.preventDefault();
          e.stopPropagation();
          addHL();
        });
      });

      ["dragleave", "drop"].forEach((ev) => {
        box.addEventListener(ev, (e) => {
          e.preventDefault();
          e.stopPropagation();
          rmHL();
        });
      });

      box.addEventListener("drop", (e) => {
        const file = e.dataTransfer?.files?.[0];
        if (file && file.path) {
          field.value = file.path;
          if (sel === "#f-src") {
            const nameEl = q("#f-name");
            if (nameEl && !nameEl.value.trim()) {
              const bn = baseName(file.path);
              if (bn) nameEl.value = bn;
            }
          }
          updatePreview();
          if (sel === "#f-src") validatePath("f-src", true);
          else if (sel === "#f-dst") validatePath("f-dst", true);
          else validatePath("f-prof", false);
          _debouncedUpdateSave();
        }
      });
    });

    // Path validation helpers
    const baseName = (p) => {
      if (!p) return "";
      const norm = String(p).replace(/\\+/g, "/");
      const parts = norm.split("/").filter(Boolean);
      return parts[parts.length - 1] || "";
    };
    
    function setValid(id, ok) {
      const el = q(`#${id}`);
      if (!el) return;
      el.classList.toggle("input-valid", !!ok);
    }
    
    async function validatePath(id, required) {
      const val = q(`#${id}`)?.value?.trim();
      if (!val) {
        setValid(id, false);
        if (required) markFieldError(id, true, "Поле обязательно");
        return;
      }
      
      try {
        const exists = await invoke("check-file-exists", val);
        setValid(id, exists);
        if (required && !exists) markFieldError(id, true, "Путь не найден");
        else markFieldError(id, false, "");
      } catch {
        // Ignore validation errors
      }
    }

    // Path validation events
    q("#f-src")?.addEventListener("change", async () => {
      const nameEl = q("#f-name");
      if (nameEl && !nameEl.value.trim()) {
        const bn = baseName(q("#f-src")?.value || "");
        if (bn) {
          nameEl.value = bn;
          const hintEl = q("#f-name-hint");
          if (hintEl) hintEl.textContent = `Автопредложение имени: ${bn}`;
        }
      }
      await validatePath("f-src", true);
      _debouncedUpdateSave();
    });
    
    q("#f-dst")?.addEventListener("change", async () => {
      await validatePath("f-dst", true);
      _debouncedUpdateSave();
    });
    
    q("#f-prof")?.addEventListener("change", () => validatePath("f-prof", false));

    // Initial validation
    validatePath("f-src", !!init.source_path);
    validatePath("f-dst", !!init.backup_path);
    _debouncedUpdateSave();

    function updatePreview() {
      const name = q("#f-name")?.value?.trim() || "Имя профиля";
      const src = q("#f-src")?.value?.trim() || "";
      const dst = q("#f-dst")?.value?.trim() || "";
      const prof = q("#f-prof")?.value?.trim();
      const pats = q("#f-pats")?.value?.trim() || "все файлы";

      const checkPathClass = (val, required) => {
        if (!val) return required ? "invalid-path" : "optional-path";
        return "valid-path";
      };

      const lines = [
        `
        <div>
          «<strong>${name}</strong>»<hr />
          <span class="path-line ${checkPathClass(src, true)}">${src || "—"}</span><br> →
          <span class="path-line ${checkPathClass(dst, true)}">${dst || "—"}</span>
        </div><hr />
        `,
        `<div><strong>Папка настроек</strong>: <span class="path-line ${checkPathClass(prof, false)}">${prof || "—"}</span></div>`,
        `<div><strong>Фильтр</strong>: ${pats}</div>`,
      ];

      const box = q("#bk-preview");
      if (box) {
        box.innerHTML = lines.join("");
        box.classList.remove("flash");
        void box.offsetWidth;
        box.classList.add("flash");
        setTimeout(() => box.classList.remove("flash"), 350);
      }
    }
    
    updatePreview();

    const closeOverlay = () => {
      overlay.remove();
      window.removeEventListener("keydown", onEsc);
      _docEl.style.overflow = _prevOverflow;
    };
    
    overlay.querySelectorAll(".bk-close").forEach((b) => {
      b.addEventListener("click", closeOverlay);
    });
    
    overlay.addEventListener("mousedown", (e) => {
      if (e.target === overlay) closeOverlay();
    });
    
    const onEsc = (e) => {
      if (e.key === "Escape") {
        closeOverlay();
      } else if (e.key === "Enter") {
        e.preventDefault();
        if (e.metaKey || e.ctrlKey) {
          const run = q("#bk-save-run");
          if (run) run.checked = true;
        }
        q("#bk-save")?.click();
      }
    };
    
    window.addEventListener("keydown", onEsc);
    
    // Save handler
    q("#bk-save").addEventListener("click", async () => {
      const name = q("#f-name")?.value?.trim();
      const source_path = q("#f-src").value.trim();
      const backup_path = q("#f-dst").value.trim();
      const profile_path = q("#f-prof").value.trim();
      const config_patterns = parsePatterns(q("#f-pats").value);
      
      const saveBtn = q("#bk-save");
      if (saveBtn) {
        saveBtn.classList.add("is-loading");
        saveBtn.setAttribute("disabled", "true");
      }
      
      // Validation
      let err = false;
      if (!name) {
        markFieldError("f-name", true, "Укажите имя");
        err = true;
      }
      if (!source_path) {
        markFieldError("f-src", true, "Укажите исходный путь");
        err = true;
      }
      if (!backup_path) {
        markFieldError("f-dst", true, "Укажите папку бэкапа");
        err = true;
      }
      
      if (err) {
        toast("Заполните обязательные поля", "error");
        const firstInvalid = overlay.querySelector(
          '.input.input-error, .input:not(.input-valid)[id="f-src"], .input:not(.input-valid)[id="f-dst"]',
        );
        if (firstInvalid) firstInvalid.focus();
        if (saveBtn) {
          saveBtn.classList.remove("is-loading");
          saveBtn.removeAttribute("disabled");
        }
        return;
      }
      
      // Check for duplicate name
      const existingIndex = state.programs.findIndex(
        (p) => p.name === name && (isNew || p !== state.programs[idx]),
      );
      
      if (existingIndex >= 0) {
        markFieldError("f-name", true, "Профиль с таким именем уже существует");
        toast("Нельзя создать профиль с одинаковым именем", "error");
        if (saveBtn) {
          saveBtn.classList.remove("is-loading");
          saveBtn.removeAttribute("disabled");
        }
        return;
      }
      
      const payload = {
        name,
        source_path,
        backup_path,
        profile_path,
        config_patterns,
      };
      
      if (isNew) {
        state.programs.unshift(payload);
        log(`Создан новый профиль: ${name}`);
      } else {
        state.programs[idx] = payload;
        log(`Профиль обновлён: ${name}`);
      }
      
      try {
        await save();
        await load();
        toast("Сохранено");
        
        const runAfter = !!q("#bk-save-run")?.checked;
        closeOverlay();
        
        if (runAfter) {
          let i = state.programs.findIndex(
            (p) => p.name === payload.name && p.backup_path === payload.backup_path,
          );
          if (i < 0) i = state.programs.length - 1;
          if (i >= 0) await runForIndices([i]);
        }
      } catch (e) {
        toast(e.message || "Ошибка", "error");
      } finally {
        if (saveBtn && saveBtn.removeAttribute) {
          saveBtn.classList.remove("is-loading");
          saveBtn.removeAttribute("disabled");
        }
      }
    });

    // Initialize tooltips
    queueMicrotask(() => initTooltips());
  }

  /**
   * Run backup for a subset of presets by indices.
   * @param {number[]} indices
   * @returns {Promise<void>}
   */
  async function runForIndices(indices) {
    if (!indices.length) {
      toast("Не выбрано ни одного профиля", "warning");
      return;
    }

    const list = indices.map((i) => state.programs[i]).filter(Boolean);

    if (!list.length) {
      toast("Нет доступных профилей для запуска", "warning");
      log("⚠ Нет доступных профилей для запуска");
      return;
    }

    toast(`Запуск Backup для ${list.length} профилей...`, "info");

    // Highlight running rows
    const rows = indices
      .map((i) => {
        const chk = wrapper.querySelector(`.bk-chk[data-i="${i}"]`);
        return chk ? chk.closest(".bk-row") : null;
      })
      .filter(Boolean);
      
    rows.forEach((r) => r.classList.add("is-running"));

    // Progress bar
    const progressEl = getEl("#bk-batch-progress") || (() => {
      const bar = document.createElement("div");
      bar.id = "bk-batch-progress";
      bar.className = "bk-progress";
      wrapper.querySelector(".wg-header")?.appendChild(bar);
      return bar;
    })();
    
    let done = 0;
    progressEl.style.width = "0%";
    progressEl.style.display = "block";

    log(`Запуск резервного копирования для ${list.length} выбранного(ых) профиля(ей)…`);

    const res = await invoke("backup:run", list);
    if (!res?.success) {
      toast(res?.error || "Ошибка запуска", "error");
      log(`Ошибка: ${res?.error || "unknown"}`);
      rows.forEach((r) => r.classList.remove("is-running"));
      setTimeout(() => (progressEl.style.display = "none"), 1200);
      toast("Ошибка при выполнении backup", "error");
      expandAndScrollLog();
      return;
    }

    // Process results
    res.results.filter(Boolean).forEach((r) => {
      const name = r.name || "Без имени";
      if (r.success) {
        log(`✔ ${name}: ${r.zipPath || ""}`);
      } else {
        log(`✖ ${name}: ${r.error || "неизвестная ошибка"}`);
      }
      done += 1;
      const percent = Math.round((done / list.length) * 100);
      progressEl.style.width = percent + "%";
    });

    await load();

    const successCount = res.results.filter((r) => r?.success).length;
    if (successCount === list.length) {
      toast(`Backup успешно завершен для всех ${successCount} профилей`, "success");
    } else {
      toast(`Backup завершен: ${successCount} успешно, ${list.length - successCount} с ошибками`, "error");
    }

    expandAndScrollLog();

    rows.forEach((r) => r.classList.remove("is-running"));
    setTimeout(() => (progressEl.style.display = "none"), 1200);
  }

  /**
   * Expand and scroll the log to bottom
   */
  function expandAndScrollLog() {
    if (!logBox) return;
    const details = logBox.closest("details");
    if (details && !details.hasAttribute("open")) {
      details.setAttribute("open", "");
    }
    logBox.style.maxHeight = "400px";
    logBox.classList.add("expanded");
    logBox.scrollTo({ top: logBox.scrollHeight, behavior: "smooth" });
  }

  // Event handlers
  getEl("#bk-add").addEventListener("click", () => showEditForm(-1));
  
  getEl("#bk-del").addEventListener("click", async () => {
    const indices = Array.from(wrapper.querySelectorAll(".bk-chk:checked")).map(
      (c) => Number(c.dataset.i),
    );
    
    if (!indices.length) {
      toast("Не выбрано ни одного профиля", "warning");
      return;
    }
    
    const names = indices
      .map((i) => state.programs[i]?.name)
      .filter(Boolean)
      .join(", ");
      
    showConfirmationDialog(
      `Вы уверены, что хотите удалить профиль: <b>${names}</b>?`,
      async () => {
        state.programs = state.programs.filter((_, i) => !indices.includes(i));
        try {
          await save();
          await load();
          toast("Удалено");
        } catch (e) {
          toast(e.message || "Ошибка", "error");
        }
        log(`Профили удалены: ${names}`);
      },
    );
  });
  
  getEl("#bk-run-selected")?.addEventListener("click", async () => {
    const indices = Array.from(wrapper.querySelectorAll(".bk-chk:checked")).map(
      (c) => Number(c.dataset.i),
    );
    
    if (!indices.length) return;

    const btn = getEl("#bk-run-selected");
    if (btn) btn.classList.add("is-loading");

    try {
      await runForIndices(indices);
    } finally {
      try {
        const btnFinal = getEl("#bk-run-selected");
        if (btnFinal) btnFinal.classList.remove("is-loading");
      } catch (_) {}
    }
  });
  
  const selAll = getEl("#bk-select-all");
  if (selAll) {
    selAll.addEventListener("change", () => {
      const all = wrapper.querySelectorAll(".bk-chk");
      all.forEach((cb) => (cb.checked = selAll.checked));
      updateActionsState();
    });
  }
  
  getEl("#bk-log-clear").addEventListener("click", () => {
    if (logBox) logBox.textContent = "";
    try {
      localStorage.removeItem("backupLog");
    } catch {}
  });
  
  const logCopyBtn = getEl("#bk-log-copy");
  logCopyBtn?.addEventListener("click", async () => {
    const text = logBox?.textContent || "";
    try {
      await navigator.clipboard.writeText(text);
      toast("Лог скопирован");
    } catch {
      toast("Не удалось скопировать", "error");
    }
  });

  // Export log to file
  const logExportBtn = getEl("#bk-log-export");
  logExportBtn?.addEventListener("click", () => {
    const text = logBox?.textContent || "";
    const stamp = new Date();
    const pad = (n) => String(n).padStart(2, "0");
    const fname = `backup-log_${stamp.getFullYear()}-${pad(stamp.getMonth() + 1)}-${pad(stamp.getDate())}_${pad(stamp.getHours())}-${pad(stamp.getMinutes())}-${pad(stamp.getSeconds())}.txt`;
    
    try {
      const blob = new Blob([text], { type: "text/plain;charset=utf-8" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = fname;
      a.style.display = "none";
      document.body.appendChild(a);
      a.click();
      setTimeout(() => {
        URL.revokeObjectURL(url);
        a.remove();
      }, 0);
      toast("Файл лога сохранён");
    } catch (e) {
      toast("Не удалось сохранить файл", "error");
    }
  });

  // Search filter clear button visibility
  function updateClearVisibility() {
    if (!clearFilterBtn) return;
    const has = !!(filterInput && filterInput.value.trim());
    clearFilterBtn.style.display = has ? "" : "none";
    clearFilterBtn.setAttribute("aria-hidden", has ? "false" : "true");
  }

  if (filterInput) {
    const onFilterInput = debounce(() => {
      state.filter = filterInput.value.trim();
      renderList();
    }, 120);
    
    filterInput.addEventListener("input", () => {
      updateClearVisibility();
      onFilterInput();
    });
    
    updateClearVisibility();
  }

  if (clearFilterBtn) {
    clearFilterBtn.addEventListener("click", () => {
      if (filterInput) filterInput.value = "";
      state.filter = "";
      updateClearVisibility();
      renderList();
      if (filterInput) filterInput.focus();
    });
  }

  // Row action handlers
  wrapper.addEventListener("click", async (e) => {
    const t = e.target.closest("button");
    if (!t) return;
    
    if (t.classList.contains("bk-edit")) {
      showEditForm(Number(t.dataset.i));
    } else if (t.classList.contains("bk-open-src")) {
      const p = state.programs[Number(t.dataset.i)];
      if (p?.source_path) await invoke("backup:openPath", p.source_path);
    } else if (t.classList.contains("bk-open")) {
      const p = state.programs[Number(t.dataset.i)];
      if (p?.backup_path) await invoke("backup:openPath", p.backup_path);
    } else if (t.classList.contains("bk-run")) {
      const i = Number(t.dataset.i);
      const btn = t;
      btn.classList.add("is-loading");
      btn.setAttribute("disabled", "true");
      
      try {
        await runForIndices([i]);
      } finally {
        if (btn && btn.removeAttribute) {
          btn.classList.remove("is-loading");
          btn.removeAttribute("disabled");
        }
      }
    }
  });

  // Keyboard shortcuts
  wrapper.addEventListener("keydown", async (e) => {
    const tag = (e.target.tagName || "").toLowerCase();
    const isTyping = tag === "input" || tag === "textarea" || e.target.isContentEditable;

    // Cmd/Ctrl + F → focus search
    if (e.key === "f" && (e.metaKey || e.ctrlKey)) {
      e.preventDefault();
      const s = wrapper.querySelector("#bk-filter");
      if (s) {
        s.focus();
        s.select?.();
      }
      return;
    }
    
    // Cmd/Ctrl + A → select all presets
    if (e.key === "a" && (e.metaKey || e.ctrlKey) && !isTyping) {
      e.preventDefault();
      const all = wrapper.querySelectorAll(".bk-chk");
      all.forEach((cb) => (cb.checked = true));
      updateActionsState();
      return;
    }
    
    // Delete / Backspace → delete selected
    if ((e.key === "Delete" || e.key === "Backspace") && !isTyping) {
      e.preventDefault();
      const delBtn = wrapper.querySelector("#bk-del");
      if (delBtn && !delBtn.disabled) delBtn.click();
      return;
    }
    
    // Cmd/Ctrl + Enter → run selected
    if (e.key === "Enter" && (e.metaKey || e.ctrlKey) && !isTyping) {
      e.preventDefault();
      const runBtn = wrapper.querySelector("#bk-run-selected");
      if (runBtn && !runBtn.disabled) runBtn.click();
      return;
    }
  });

  // Initial load
  load().catch((e) => {
    console.error(e);
    showError("Не удалось загрузить профили", e.message);
  });

  // Initialize tooltips
  queueMicrotask(() => initTooltips());

  return wrapper;
}