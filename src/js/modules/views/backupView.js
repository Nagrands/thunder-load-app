// src/js/modules/views/backupView.js

import { showToast } from "../toast.js";
import { showConfirmationDialog } from "../modals.js";
import { applyI18n, t } from "../i18n.js";

/**
 * @typedef {Object} BackupProgram
 * @property {string} name               - Short human-friendly preset name.
 * @property {string} source_path        - Absolute source path to backup from.
 * @property {string} backup_path        - Absolute destination folder for archives.
 * @property {string} [profile_path]     - Optional profile folder to include (placed into "Profiles").
 * @property {string[]} [config_patterns]- Optional list of filename masks (e.g. ['*.ini','*.cfg']). Empty → all files.
 * @property {string} [archive_type]     - Archive type: 'zip' or 'tar.gz'. Default: 'zip'.
 */

/**
 * @typedef {Object} BackupState
 * @property {BackupProgram[]} programs          - Current list of backup presets.
 * @property {Record<string, number>} lastTimes  - Map: preset name → timestamp (ms) of last successful backup.
 * @property {string} filter                     - Text filter (applied to name/source/destination).
 * @property {"all"|"zip"|"tar.gz"} archiveFilter - Archive type filter.
 * @property {number} page                      - Current page for pagination.
 * @property {number} pageSize                  - Page size for pagination.
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
  const tb = (key, vars) => t(`backup.${key}`, vars);

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

  let activeBackupRuns = 0;
  const toggleReloadShortcut = async (shouldBlock) => {
    try {
      await invoke("backup:toggleReloadBlock", shouldBlock);
    } catch (error) {
      console.error(
        "[backupView] Не удалось переключить горячую клавишу Ctrl+R:",
        error,
      );
    }
  };

  const acquireReloadShortcutBlock = () => {
    activeBackupRuns += 1;
    if (activeBackupRuns === 1) {
      void toggleReloadShortcut(true);
    }
  };

  const releaseReloadShortcutBlock = () => {
    if (activeBackupRuns === 0) return;
    activeBackupRuns -= 1;
    if (activeBackupRuns === 0) {
      void toggleReloadShortcut(false);
    }
  };

  const wrapper = document.createElement("div");
  wrapper.id = "backup-view";
  wrapper.className = "backup-view tab-content p-4 space-y-4";

  const container = document.createElement("div");
  container.className = "backup-center";

  const html = `
      <header class="backup-shell-header">
        <div class="title">
          <i class="fa-solid fa-database"></i>
          <div class="title-content">
            <h1 class="wg-text-gradient" data-i18n="backup.title">Backup Manager</h1>
            <p class="subtitle" data-i18n="backup.subtitle">Резервное копирование файлов и папок</p>
          </div>
        </div>
      </header>
      <div class="backup-header-extra" id="backup-header-extra"></div>
      <div class="wg-glass">

      <div id="bk-toolbar" class="wg-block" aria-label="Управление профилями" data-i18n-aria="backup.toolbar.aria">
        <div id="bk-progress-container" class="bk-progress-container">
          <div class="bk-progress">
            <div class="bk-progress-bar" style="width: 0%"></div>
            <div class="bk-progress-content">
              <span class="bk-progress-text primary" data-i18n="backup.progress.running">Выполнение резервного копирования...</span>
              <div class="bk-progress-stats">
                <span class="stat">
                  <i class="fa-solid fa-play-circle"></i>
                  <span class="bk-progress-text" id="bk-progress-current">0</span>
                </span>
                <span class="stat">
                  <i class="fa-solid fa-list-ol"></i>
                  <span class="bk-progress-text" id="bk-progress-total">0</span>
                </span>
                <span class="stat">
                  <i class="fa-solid fa-database"></i>
                  <span class="bk-progress-text" id="bk-progress-size">—</span>
                </span>
                <span class="stat">
                  <i class="fa-solid fa-gauge-high"></i>
                  <span class="bk-progress-text" id="bk-progress-speed">—</span>
                </span>
                <span class="bk-progress-text percentage" id="bk-progress-percent">0%</span>
              </div>
            </div>
          </div>
        </div>

        <div id="bk-preflight" class="bk-preflight" style="display:none;"></div>

        <h1 class="section-heading">
          <div class="bk-heading-control">
            <button id="bk-open-delete-modal" class="btn btn-sm" data-bs-toggle="tooltip" data-bs-placement="top" title="Управление профилями" data-i18n-title="backup.manage.title">
              <i class="fa-solid fa-list-check"></i>
            </button>
          </div>

          <div class="bk-heading-search">
            <div class="bk-search-container">
              <i class="fa-solid fa-magnifying-glass bk-search-icon"></i>
              <input type="text" id="bk-filter" placeholder="Поиск профиля, тега, пути..." class="input" data-i18n-placeholder="backup.search.placeholder" />
              <button type="button" id="bk-clear-filter" class="history-action-button" data-bs-toggle="tooltip" data-bs-placement="top" title="Очистить поиск" data-i18n-title="backup.search.clear">
                <i class="fa-solid fa-times"></i>
              </button>
            </div>
            <span id="bk-search-info" class="text-xs text-muted"></span>
          </div>

          <div class="bk-actions">
            <button id="bk-add" class="btn btn-sm" data-bs-toggle="tooltip" data-bs-placement="top" title="Создать профиль" data-i18n-title="backup.action.create">
              <i class="fa-solid fa-plus"></i>
            </button>
            <button id="bk-run-selected" class="btn btn-sm" data-bs-toggle="tooltip" data-bs-placement="top" title="Запустить для выбранных" data-i18n-title="backup.action.runSelected" disabled style="display:none;">
              <i class="fa-solid fa-play"></i>
              <span class="bk-badge" id="bk-run-count" style="display:none">0</span>
            </button>
            <button id="bk-del" class="btn btn-sm" data-bs-toggle="tooltip" data-bs-placement="top" title="Удалить выбранные" data-i18n-title="backup.action.deleteSelected" disabled>
              <i class="fa-solid fa-trash"></i>
              <span class="bk-badge" id="bk-del-count" style="display:none">0</span>
            </button>
          </div>

          <span id="bk-count" class="bk-count" data-bs-toggle="tooltip" data-bs-placement="top" title="Отфильтровано / всего" data-i18n-title="backup.count.title">0/0</span>
        </h1>

        <div class="bk-filters-advanced">
          <label class="bk-filter-control">
            <span class="label" data-i18n="backup.filter.archive.label">Тип архива</span>
            <select id="bk-filter-archive" class="input input-sm">
              <option value="all" data-i18n="backup.filter.archive.all">Все</option>
              <option value="zip">ZIP</option>
              <option value="tar.gz">TAR.GZ</option>
            </select>
          </label>
          <div class="bk-pagination">
            <button id="bk-page-prev" class="history-action-button" title="Предыдущая страница" data-i18n-title="backup.pagination.prev">
              <i class="fa-solid fa-chevron-left"></i>
            </button>
            <span id="bk-page-info" class="text-xs muted">1 / 1</span>
            <button id="bk-page-next" class="history-action-button" title="Следующая страница" data-i18n-title="backup.pagination.next">
              <i class="fa-solid fa-chevron-right"></i>
            </button>
            <select id="bk-page-size" class="input input-sm bk-page-size">
              <option value="3">3</option>
              <option value="5">5</option>
              <option value="10" selected>10</option>
              <option value="25">25</option>
            </select>
          </div>
        </div>
          
        <div id="bk-list" class="bk-list space-y-2"></div>

        <details class="wg-log-block">
          <summary>
            <i class="fa-solid fa-terminal"></i>
            <span data-i18n="backup.log.title">Лог активности</span>
          </summary>
          <div class="log-actions" aria-label="Действия с логом" data-i18n-aria="backup.log.actions.aria">
            <button id="bk-log-copy" type="button" class="log-action-btn" data-bs-toggle="tooltip" data-bs-placement="top" title="Скопировать лог" data-i18n-title="backup.log.copy">
              <i class="fa-solid fa-copy"></i>
            </button>
            <button id="bk-log-export" type="button" class="log-action-btn" data-bs-toggle="tooltip" data-bs-placement="top" title="Экспортировать лог в файл" data-i18n-title="backup.log.export">
              <i class="fa-solid fa-download"></i>
            </button>
            <button id="bk-log-clear" type="button" class="log-action-btn" data-bs-toggle="tooltip" data-bs-placement="top" title="Очистить лог" data-i18n-title="backup.log.clear">
              <i class="fa-solid fa-trash"></i>
            </button>
          </div>
          <pre id="bk-log" class="wg-status console"></pre>
        </details>
      </div>
    </div>
  `;

  container.innerHTML = html;
  applyI18n(container);
  wrapper.appendChild(container);
  window.addEventListener("i18n:changed", () => applyI18n(wrapper));

  const VIEW_MODE_KEY = "bk_view_mode";
  const LOG_VISIBLE_KEY = "bk_log_visible";

  const readViewMode = () => {
    try {
      const raw = localStorage.getItem(VIEW_MODE_KEY);
      const parsed = raw ? JSON.parse(raw) : "full";
      return parsed === "compact" ? "compact" : "full";
    } catch {
      return "full";
    }
  };

  const readLogVisible = () => {
    try {
      const raw = localStorage.getItem(LOG_VISIBLE_KEY);
      if (raw === null) return true;
      return JSON.parse(raw) !== false;
    } catch {
      return true;
    }
  };

  let viewMode = readViewMode();
  let logVisible = readLogVisible();

  const logBlock = container.querySelector(".wg-log-block");
  const applyLogVisibility = (visible) => {
    if (logBlock) {
      logBlock.style.display = visible ? "" : "none";
    }
  };
  applyLogVisibility(logVisible);

  function updateViewToggleIcon(targetMode = viewMode) {
    const icon = wrapper.querySelector("#bk-toggle-view i");
    if (!icon) return;
    icon.className =
      targetMode === "full" ? "fa-solid fa-bars" : "fa-solid fa-list";
  }

  // Функция поиска элемента внутри wrapper
  /**
   * Shorthand DOM query inside the Backup view wrapper.
   * @template {Element} T
   * @param {string} sel
   * @param {ParentNode} [root]
   * @returns {T|null}
   */
  const getEl = (sel, root = wrapper) => root.querySelector(sel);
  let hasRenderedListOnce = false;
  let hintsTimer = null;
  let clearVirtualization = null;
  let currentVisibleKeys = new Set();
  const VIRTUALIZATION_MIN_ITEMS = 20;
  const VIRTUALIZATION_OVERSCAN = 6;
  const VIRTUAL_ROW_HEIGHT = {
    compact: 94,
    full: 122,
  };

  // Кнопка с иконкой «минус» вместо счётчика открывает модальное окно
  const minusBtn = getEl("#bk-open-delete-modal");
  if (minusBtn) {
    minusBtn.addEventListener("click", () => {
      if (typeof openBackupDeleteModal === "function") {
        openBackupDeleteModal();
      }
    });
  }

  const ensureTooltip = (el, text = "") => {
    if (!el || !bootstrap?.Tooltip) return;
    const title = String(text || el.getAttribute("title") || "").trim();
    const prev = el.dataset.bkTooltipTitle || "";
    const instance = bootstrap.Tooltip.getInstance(el);

    if (!title) {
      if (instance) instance.dispose();
      delete el.dataset.bkTooltipTitle;
      return;
    }

    if (prev === title && instance) return;

    if (instance && prev !== title) {
      instance.dispose();
    }
    el.setAttribute("title", title);
    bootstrap.Tooltip.getOrCreateInstance(el, {
      boundary: wrapper,
    });
    el.dataset.bkTooltipTitle = title;
  };

  // Ленивая инициализация тултипов: только создание отсутствующих экземпляров
  const initBackupTooltips = (root = wrapper) => {
    if (!root || !bootstrap?.Tooltip) return;
    const tooltipTriggerList = root.querySelectorAll('[data-bs-toggle="tooltip"]');
    tooltipTriggerList.forEach((tooltipTriggerEl) => {
      ensureTooltip(tooltipTriggerEl);
    });
  };

  // --- Модальное окно удаления/выбора профилей (единый стиль с редактированием) ---
  function openBackupDeleteModal() {
    const overlay = document.createElement("div");
    overlay.className = "modal-overlay";
    overlay.innerHTML = `
    <div class="modal-content bk-modal bk-manage-modal">
      <div class="modal-header">
        <div>
          <h2><i class="fa-solid fa-list-check"></i> <span data-i18n="backup.manage.title">Управление профилями</span></h2>
          <p class="modal-subtitle" data-i18n="backup.manage.subtitle">Переключайте профили, чтобы удалить или запустить несколько за раз.</p>
        </div>
        <button class="close-modal bk-close" aria-label="Закрыть" data-i18n-aria="backup.common.close">&times;</button>
      </div>
      <div class="modal-body">
        <div class="bk-manage-toolbar">
          <label class="checkbox-label" style="gap:.5rem">
            <input type="checkbox" id="bk-del-select-all">
            <span data-i18n="backup.manage.selectAll">Выбрать все</span>
          </label>
          <span id="bk-manage-counter" class="muted">0 выбрано</span>
        </div>
        <div id="bk-delete-list" class="delete-list"></div>
      </div>
      <div class="modal-footer">
        <div class="modal-footer-actions">
          <button type="button" id="bk-confirm-run" class="btn btn-primary" disabled>
            <i class="fa-solid fa-play"></i> <span data-i18n="backup.manage.runSelected">Запустить выбранные</span>
          </button>
          <button type="button" id="bk-confirm-delete" class="btn btn-danger" disabled>
            <i class="fa-solid fa-trash"></i> <span data-i18n="backup.manage.deleteSelected">Удалить выбранные</span>
          </button>
        </div>
      </div>
    </div>
  `;

    // Показ оверлея, блокируем прокрутку
    const _docEl = document.documentElement;
    const _prevOverflow = _docEl.style.overflow;
    _docEl.style.overflow = "hidden";
    overlay.style.display = "flex";
    wrapper.appendChild(overlay);
    applyI18n(overlay);

    const q = (s) => overlay.querySelector(s);
    const listEl = q("#bk-delete-list");
    const selectAll = q("#bk-del-select-all");
    const deleteBtn = q("#bk-confirm-delete");
    const runBtn = q("#bk-confirm-run");
    const counterEl = q("#bk-manage-counter");

    // Вычисляем уже выделенные профили по текущему состоянию выбора
    const selectedIndices = getSelectedIndices();
    applyI18n(overlay);

    // Генерация списка профилей из состояния
    listEl.innerHTML = state.programs
      .map((p, idx) => {
        const checked = selectedIndices.includes(idx) ? "checked" : "";
        const name = p.name || tb("profile.fallbackName", { index: idx + 1 });
        const key = profileKey(p);
        const locked = lockedProfiles.has(key);
        const checkedAttr = locked ? "" : checked;
        return `
      <div class="form-check">
        <input class="form-check-input bk-del-chk" type="checkbox" data-index="${idx}" ${checkedAttr} ${locked ? "disabled" : ""}>
        <label class="form-check-label">${name}${locked ? ` <span class="locked-badge">${tb("profile.locked")}</span>` : ""}</label>
      </div>`;
      })
      .join("");

    const getCheckedChks = () =>
      Array.from(listEl.querySelectorAll(".bk-del-chk:not(:disabled)")).filter(
        (c) => c.checked,
      );

    const updateModalActionsState = () => {
      const all = listEl.querySelectorAll(".bk-del-chk:not(:disabled)");
      const checked = getCheckedChks();
      if (selectAll) {
        selectAll.indeterminate =
          checked.length > 0 && checked.length < all.length;
        selectAll.checked = all.length > 0 && checked.length === all.length;
      }
      const any = checked.length > 0;
      if (deleteBtn) deleteBtn.disabled = !any;
      if (runBtn) runBtn.disabled = !any;
      if (counterEl)
        counterEl.textContent = tb("manage.selectedCount", {
          count: checked.length,
        });
    };

    const onItemChange = (chk) => {
      const idx = Number(chk.dataset.index);
      const program = state.programs[idx];
      const key = profileKey(program);
      setSelectionForKey(key, chk.checked);
      updateModalActionsState();
      if (typeof updateActionsState === "function") updateActionsState();
    };

    // Синхронизация чекбоксов между модалкой и основным списком
    listEl.querySelectorAll(".bk-del-chk").forEach((chk) => {
      chk.addEventListener("change", () => onItemChange(chk));
    });

    // Обработка чекбокса "Выбрать все"
    const totalProfiles = state.programs.length;
    const initiallySelected = selectedIndices.length;
    if (selectAll) {
      selectAll.checked =
        initiallySelected && initiallySelected === totalProfiles;
      selectAll.addEventListener("change", () => {
        const all = listEl.querySelectorAll(".bk-del-chk");
        const want = !!selectAll.checked;
        all.forEach((chk) => {
          chk.checked = want;
          onItemChange(chk);
        });
        updateModalActionsState();
      });
    }
    updateModalActionsState();

    // Закрытие как в редакторе профиля
    const closeOverlay = () => {
      overlay.remove();
      window.removeEventListener("keydown", onEsc);
      _docEl.style.overflow = _prevOverflow;
      if (typeof updateActionsState === "function") updateActionsState();
    };
    overlay
      .querySelectorAll(".bk-close")
      .forEach((b) => b.addEventListener("click", closeOverlay));
    overlay.addEventListener("mousedown", (e) => {
      if (e.target === overlay) closeOverlay();
    });
    const onEsc = (e) => {
      if (e.key === "Escape") closeOverlay();
    };
    window.addEventListener("keydown", onEsc);

    // Подтверждение удаления
    deleteBtn.onclick = () => {
      closeOverlay();
      const delBtn = getEl("#bk-del");
      if (delBtn && !delBtn.disabled) delBtn.click();
    };

    runBtn.onclick = async () => {
      const indices = getCheckedChks().map((chk) => Number(chk.dataset.index));
      if (!indices.length) return;
      closeOverlay();
      await runForIndices(indices);
    };
  }

  // Добавляем кнопку переключения вида профилей (Full / Compact)
  const toolbarActions = container.querySelector("#bk-toolbar .bk-actions");
  if (toolbarActions) {
    const toggleViewBtn = document.createElement("button");
    toggleViewBtn.id = "bk-toggle-view";
    toggleViewBtn.className = "btn btn-sm";
    toggleViewBtn.innerHTML = '<i class="fa-solid fa-bars"></i>';
    toggleViewBtn.title = tb("action.toggleView");
    toggleViewBtn.setAttribute("data-i18n-title", "backup.action.toggleView");
    toggleViewBtn.setAttribute("data-bs-toggle", "tooltip");
    toggleViewBtn.setAttribute("data-bs-placement", "top");

    const runSelectedBtn = toolbarActions.querySelector("#bk-run-selected");
    if (runSelectedBtn) {
      toolbarActions.insertBefore(toggleViewBtn, runSelectedBtn);
    } else {
      toolbarActions.appendChild(toggleViewBtn);
    }

    toggleViewBtn.addEventListener("click", () => {
      viewMode = viewMode === "full" ? "compact" : "full";
      try {
        localStorage.setItem(VIEW_MODE_KEY, JSON.stringify(viewMode));
      } catch {}
      renderList();

      updateActionsState();
      updateViewToggleIcon();
      window.dispatchEvent(
        new CustomEvent("backup:viewMode", {
          detail: { mode: viewMode, source: "backupView" },
        }),
      );
    });
    updateViewToggleIcon();
  }

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
  const archiveFilterSelect = container.querySelector("#bk-filter-archive");
  const pagePrevBtn = container.querySelector("#bk-page-prev");
  const pageNextBtn = container.querySelector("#bk-page-next");
  const pageSizeSelect = container.querySelector("#bk-page-size");
  let archiveTypeSelectUI = null;

  // Единый стиль кастомных селектов (архив/пагинация)
  const enhanceSelect = (selectEl) => {
    if (!selectEl || selectEl.dataset.enhanced) return null;
    selectEl.dataset.enhanced = "true";

    const wrapper = document.createElement("div");
    wrapper.className = "bk-select-wrapper";
    if (selectEl?.id) wrapper.dataset.kind = selectEl.id;
    const trigger = document.createElement("button");
    trigger.type = "button";
    trigger.className = "bk-select-trigger";
    const label = document.createElement("span");
    label.className = "bk-select-label";
    const icon = document.createElement("i");
    icon.className = "fa-solid fa-chevron-down";
    trigger.append(label, icon);

    const menu = document.createElement("div");
    menu.className = "bk-select-menu";
    menu.hidden = true;

    const updateLabel = () => {
      const opt =
        selectEl.selectedOptions && selectEl.selectedOptions[0]
          ? selectEl.selectedOptions[0]
          : selectEl.options[selectEl.selectedIndex];
      label.textContent = opt ? opt.textContent : "";
      menu
        .querySelectorAll(".bk-select-option")
        .forEach((item) =>
          item.classList.toggle(
            "is-active",
            item.dataset.value === selectEl.value,
          ),
        );
    };

    Array.from(selectEl.options).forEach((opt) => {
      const item = document.createElement("button");
      item.type = "button";
      item.className = "bk-select-option";
      item.dataset.value = opt.value;
      item.textContent = opt.textContent;
      item.addEventListener("click", () => {
        if (selectEl.value !== opt.value) {
          selectEl.value = opt.value;
          selectEl.dispatchEvent(new Event("change", { bubbles: true }));
        }
        updateLabel();
        menu.hidden = true;
        wrapper.classList.remove("is-open");
      });
      menu.appendChild(item);
    });

    const toggleMenu = () => {
      const willOpen = menu.hidden;
      document.querySelectorAll(".bk-select-menu").forEach((m) => {
        m.hidden = true;
        m.parentElement?.classList.remove("is-open");
      });
      if (willOpen) {
        menu.hidden = false;
        wrapper.classList.add("is-open");
      }
    };

    trigger.addEventListener("click", (e) => {
      e.stopPropagation();
      toggleMenu();
    });

    const closeOnOutside = (e) => {
      if (!wrapper.contains(e.target)) {
        menu.hidden = true;
        wrapper.classList.remove("is-open");
      }
    };
    document.addEventListener("mousedown", closeOnOutside);
    document.addEventListener("focusin", closeOnOutside);
    trigger.addEventListener("keydown", (e) => {
      if (e.key === "Escape") {
        menu.hidden = true;
        wrapper.classList.remove("is-open");
      }
      if (e.key === "ArrowDown" || e.key === "ArrowUp") {
        e.preventDefault();
        toggleMenu();
      }
    });

    selectEl.classList.add("bk-select-hidden");
    selectEl.parentNode.insertBefore(wrapper, selectEl);
    wrapper.append(trigger, selectEl, menu);
    updateLabel();

    selectEl.addEventListener("change", updateLabel);
    return { updateLabel };
  };

  const archiveSelectUI = enhanceSelect(archiveFilterSelect);
  const _pageSizeSelectUI = enhanceSelect(pageSizeSelect);

  if (filterInput) {
    filterInput.addEventListener(
      "input",
      debounce(() => {
        state.filter = filterInput.value.trim();
        state.page = 1;
        renderList();
      }, 150),
    );
  }

  if (clearFilterBtn && filterInput) {
    clearFilterBtn.addEventListener("click", () => {
      filterInput.value = "";
      state.filter = "";
      state.page = 1;
      renderList();
      filterInput.focus();
    });
  }

  if (archiveFilterSelect) {
    archiveFilterSelect.addEventListener("change", () => {
      state.archiveFilter = archiveFilterSelect.value || "all";
      state.page = 1;
      renderList();
    });
  }

  if (pagePrevBtn) {
    pagePrevBtn.addEventListener("click", () => {
      if (state.page > 1) {
        state.page -= 1;
        renderList();
      }
    });
  }

  if (pageNextBtn) {
    pageNextBtn.addEventListener("click", () => {
      state.page += 1;
      renderList();
    });
  }

  if (pageSizeSelect) {
    pageSizeSelect.addEventListener("change", () => {
      const size = Math.max(3, Number(pageSizeSelect.value) || 10);
      state.pageSize = size;
      state.page = 1;
      renderList();
    });
  }

  // Backup Hints Block
  const subtitle = container.querySelector("#backup-header-extra");
  const hintsBlock = document.createElement("div");
  hintsBlock.className = "info-card bk-hints";
  hintsBlock.innerHTML = `
    <h3><i class="fa-solid fa-lightbulb"></i> <span data-i18n="backup.hints.title">Советы</span></h3>
    <p class="bk-hint-text"></p>
  `;
  subtitle?.appendChild(hintsBlock);
  applyI18n(hintsBlock);

  const hints = [
    tb("hints.1"),
    tb("hints.2"),
    tb("hints.3"),
    tb("hints.4"),
    tb("hints.5"),
  ];

  let hintIndex = 0;
  const hintEl = hintsBlock.querySelector(".bk-hint-text");
  const showHint = () => {
    if (!hintEl) return;
    hintEl.style.opacity = 0;
    setTimeout(() => {
      hintEl.textContent = hints[hintIndex];
      hintEl.style.opacity = 1;
      hintIndex = (hintIndex + 1) % hints.length;
    }, 400);
  };
  const isBackupTabActive = () =>
    document.querySelector(".group-menu .menu-item.active")?.dataset.menu ===
    "backup";
  const canRunHints = () =>
    wrapper.isConnected && !document.hidden && isBackupTabActive();
  const stopHintsRotation = () => {
    if (hintsTimer) {
      clearInterval(hintsTimer);
      hintsTimer = null;
    }
  };
  const startHintsRotation = () => {
    if (hintsTimer || !canRunHints()) return;
    hintsTimer = setInterval(showHint, 10000);
  };
  const syncHintsRotation = () => {
    if (canRunHints()) {
      startHintsRotation();
      return;
    }
    stopHintsRotation();
  };
  const onTabsActivated = (event) => {
    const activeTab = event?.detail?.id || "";
    if (activeTab && activeTab !== "backup") {
      stopHintsRotation();
      return;
    }
    syncHintsRotation();
  };

  showHint();
  window.addEventListener("tabs:activated", onTabsActivated);
  document.addEventListener("visibilitychange", syncHintsRotation);
  syncHintsRotation();

  // Autofocus search when opening the tab
  queueMicrotask(() => {
    const s = wrapper.querySelector("#bk-filter");
    s && s.focus();
  });

  const logBox = getEl("#bk-log");
  const preflightBox = getEl("#bk-preflight");

  const getLogPlainText = () => {
    if (!logBox) return "";
    const lines = Array.from(logBox.querySelectorAll(".log-line"));
    if (!lines.length) return logBox.textContent?.trim() || "";
    return lines.map((line) => line.textContent.trim()).join("\n");
  };

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
          <div style="width: 6px; height: 44px; border-radius: 4px;"></div>
          <div style="flex: 1; display: flex; flex-direction: column; gap: 6px;">
            <div style="height: 14px; width: 60%; border-radius: 6px;"></div>
            <div style="height: 12px; width: 80%; border-radius: 6px;"></div>
            <div style="height: 12px; width: 48%; border-radius: 6px;"></div>
          </div>
          <div style="width: 68px; height: 26px; border-radius: 10px;"></div>
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
    if (!logBox)
      return { wasScrolledToBottom: false, restoreScrollPosition: () => {} };

    const threshold = 50;
    const isNearBottom =
      logBox.scrollHeight - logBox.clientHeight - logBox.scrollTop <= threshold;

    return {
      wasScrolledToBottom: isNearBottom,
      restoreScrollPosition: () => {
        if (isNearBottom) {
          logBox.scrollTop = logBox.scrollHeight - logBox.clientHeight;
        }
      },
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
    const date = now.toLocaleDateString("ru-RU").replace(/\./g, "-");
    const time = now.toLocaleTimeString("ru-RU");

    const span = document.createElement("span");
    span.className = "log-date";
    span.textContent = `[${date} ${time}]`;
    line.appendChild(span);
    line.append(` ${msg}`);

    // Add to log (append to maintain chronological order)
    logBox.appendChild(line);

    // Restore scroll position
    scrollManager.restoreScrollPosition();

    // Copy line text on click
    line.addEventListener("click", () => {
      navigator.clipboard.writeText(line.textContent.trim()).then(() => {
        line.classList.add("copied");
        setTimeout(() => line.classList.remove("copied"), 500);
        showToast(tb("log.lineCopied"), "success");
      });
    });

    // Save log to localStorage
    try {
      localStorage.setItem("backupLog", logBox.innerHTML);
    } catch {}
  };

  const toast = (m, t = "success") => showToast(m, t);

  const clearPreflightSummary = () => {
    if (!preflightBox) return;
    preflightBox.innerHTML = "";
    preflightBox.style.display = "none";
    preflightBox.dataset.state = "";
    preflightBox.classList.remove("is-error", "is-warn", "is-ok");
  };

  const renderPreflightSummary = (results) => {
    if (!preflightBox) return;
    if (!Array.isArray(results) || !results.length) {
      clearPreflightSummary();
      return;
    }

    const errors = [];
    const warnings = [];
    const oks = [];

    results.forEach((r) => {
      const name = r?.name || tb("profile.unnamed");
      if (Array.isArray(r?.errors) && r.errors.length) {
        r.errors.forEach((e) => errors.push({ ...e, name, severity: "error" }));
      }
      if (Array.isArray(r?.warnings) && r.warnings.length) {
        r.warnings.forEach((w) =>
          warnings.push({ ...w, name, severity: "warning" }),
        );
      }
      if (
        (!r?.errors || r.errors.length === 0) &&
        (!r?.warnings || r.warnings.length === 0)
      ) {
        oks.push(name);
      }
    });

    const hasErrors = errors.length > 0;
    const hasWarnings = warnings.length > 0;

    const statusClass = hasErrors
      ? "is-error"
      : hasWarnings
        ? "is-warn"
        : "is-ok";
    const icon = hasErrors
      ? "fa-circle-xmark"
      : hasWarnings
        ? "fa-circle-exclamation"
        : "fa-circle-check";
    const summaryText = hasErrors
      ? tb("preflight.summary.errors", {
          errors: errors.length,
          warnings: warnings.length,
        })
      : hasWarnings
        ? tb("preflight.summary.warnings", { warnings: warnings.length })
        : tb("preflight.summary.ok", { count: results.length });

    const items = [];
    errors.forEach((issue) => {
      items.push(
        `<li class="pf-issue pf-error">
          <div class="pf-title"><i class="fa-solid fa-circle-xmark"></i> ${issue.name}: ${issue.message}</div>
          ${issue.hint ? `<div class="pf-hint">🔧 ${issue.hint}</div>` : ""}
        </li>`,
      );
    });
    warnings.forEach((issue) => {
      items.push(
        `<li class="pf-issue pf-warn">
          <div class="pf-title"><i class="fa-solid fa-triangle-exclamation"></i> ${issue.name}: ${issue.message}</div>
          ${issue.hint ? `<div class="pf-hint">💡 ${issue.hint}</div>` : ""}
        </li>`,
      );
    });
    if (!items.length) {
      items.push(
        `<li class="pf-issue pf-ok">
          <div class="pf-title"><i class="fa-solid fa-circle-check"></i> ${tb("preflight.checkPassed", { count: oks.length || results.length })}</div>
        </li>`,
      );
    }

    preflightBox.innerHTML = `
      <div class="pf-head ${statusClass}">
        <div class="pf-status">
          <i class="fa-solid ${icon}"></i>
          <span>${summaryText}</span>
        </div>
        <div class="pf-actions">
          <button type="button" class="history-action-button pf-hide" title="Скрыть" data-i18n-title="backup.common.hide">
            <i class="fa-solid fa-xmark"></i>
          </button>
        </div>
      </div>
      <ul class="pf-list">${items.join("")}</ul>
    `;
    applyI18n(preflightBox);
    preflightBox.style.display = "";
    preflightBox.dataset.state = statusClass;
    preflightBox.classList.remove("is-error", "is-warn", "is-ok");
    preflightBox.classList.add(statusClass);
    preflightBox
      .querySelector(".pf-hide")
      ?.addEventListener("click", clearPreflightSummary);
  };

  const lockedProfiles = new Set();
  const selectedKeys = new Set();
  const escapeSelector = (value) =>
    window.CSS && typeof window.CSS.escape === "function"
      ? window.CSS.escape(value)
      : value.replace(/"/g, '\\"');
  const profileKey = (program) =>
    [
      program?.name || "",
      program?.source_path || "",
      program?.backup_path || "",
    ]
      .map((part) => part ?? "")
      .join("::");
  const applyLockToRow = (row, locked) => {
    if (!row) return;
    const key = row.dataset.profileKey;
    row.classList.toggle("is-locked", !!locked);
    if (locked && key) {
      clearSelectionForKey(key);
    }
    row
      .querySelectorAll(
        '[data-lockable="true"], .bk-edit, .bk-open-src, .bk-open, .bk-run, .bk-open-profile',
      )
      .forEach((btn) => {
        btn.disabled = !!locked;
        btn.setAttribute("aria-disabled", locked ? "true" : "false");
      });
  };
  const applyLockVisuals = (key, locked) => {
    if (!key) return;
    const rows = wrapper.querySelectorAll(
      `.bk-row[data-profile-key="${escapeSelector(key)}"]`,
    );
    rows.forEach((row) => applyLockToRow(row, locked));
  };
  const setProfileLocked = (key, locked) => {
    if (!key) return;
    if (locked) lockedProfiles.add(key);
    else lockedProfiles.delete(key);
    applyLockVisuals(key, locked);
    updateActionsState();
  };

  /** @type {BackupState} */
  const state = {
    programs: [],
    lastTimes: {},
    filter: "",
    archiveFilter: "all",
    page: 1,
    pageSize: 10,
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

  const findIndexByKey = (key) =>
    state.programs.findIndex((p) => profileKey(p) === key);

  function clearSelectionForKey(key) {
    if (!key || !selectedKeys.has(key)) return;
    selectedKeys.delete(key);
    const rows = wrapper.querySelectorAll(
      `.bk-row[data-profile-key="${escapeSelector(key)}"]`,
    );
    rows.forEach((row) => {
      row.classList.remove("is-selected");
      row.setAttribute("aria-pressed", "false");
    });
  }

  function setSelectionForKey(key, selected) {
    if (!key) return;
    if (selected && lockedProfiles.has(key)) return;
    if (selected) selectedKeys.add(key);
    else selectedKeys.delete(key);

    const rows = wrapper.querySelectorAll(
      `.bk-row[data-profile-key="${escapeSelector(key)}"]`,
    );
    rows.forEach((row) => {
      row.classList.toggle("is-selected", selected);
      row.setAttribute("aria-pressed", selected ? "true" : "false");
    });
  }

  function toggleRowSelection(row) {
    if (!row || row.classList.contains("is-locked")) return;
    const key = row.dataset.profileKey;
    if (!key) return;
    const shouldSelect = !selectedKeys.has(key);
    if (shouldSelect) {
      setSelectionForKey(key, true);
    } else {
      clearSelectionForKey(key);
    }
    updateActionsState();
  }

  function getSelectedIndices() {
    return Array.from(selectedKeys)
      .map((key) => findIndexByKey(key))
      .filter((i) => i >= 0);
  }

  function selectAllVisible() {
    currentVisibleKeys.forEach((key) => setSelectionForKey(key, true));
    updateActionsState();
  }

  function pruneSelection(allowedKeys) {
    if (!allowedKeys) return;
    let changed = false;
    selectedKeys.forEach((key) => {
      if (!allowedKeys.has(key)) {
        clearSelectionForKey(key);
        changed = true;
      }
    });
    if (changed) updateActionsState();
  }

  /**
   * Update toolbar actions availability, titles, badges and select-all state.
   * @returns {void}
   */
  function updateActionsState() {
    const bkList = getEl("#bk-list");
    if (!bkList) return;

    // Синхронизируем выбранные ключи с существующими программами
    const programKeys = new Set(
      state.programs.map((p) => profileKey(p)).filter(Boolean),
    );
    let removedStale = false;
    selectedKeys.forEach((key) => {
      if (!programKeys.has(key)) {
        selectedKeys.delete(key);
        removedStale = true;
      }
    });

    const visibleKeys = new Set(currentVisibleKeys);

    const selectedVisible = Array.from(selectedKeys).filter((key) =>
      visibleKeys.has(key),
    );

    const totalSelected = Array.from(selectedKeys).filter((key) =>
      programKeys.has(key),
    ).length;
    const count = totalSelected;
    const total = visibleKeys.size;
    const { del, runSel } = actions();

    if (del) del.disabled = count === 0;
    if (runSel) runSel.disabled = count === 0;
    if (runSel) runSel.title = tb("action.runSelectedCount", { count: count });
    if (del) del.title = tb("action.deleteSelectedCount", { count: count });

    // Update Bootstrap tooltips
    const updateTooltip = (el, text) => {
      ensureTooltip(el, text);
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
      const visibleCount = selectedVisible.length;
      selAll.indeterminate = visibleCount > 0 && visibleCount < total;
      selAll.checked = total > 0 && visibleCount === total;
    }

    // Переключение кнопок "Создать профиль" ↔ "Запустить для выбранных"
    const addBtn = getEl("#bk-add");
    if (addBtn && runSel) {
      if (count > 0) {
        addBtn.style.display = "none";
        runSel.style.display = "";
      } else {
        addBtn.style.display = "";
        runSel.style.display = "none";
      }
    }

    if (removedStale) {
      // Обновляем состояние виджетов, если удалили устаревшие выборы
      const delBtn = getEl("#bk-del");
      const runBtn = getEl("#bk-run-selected");
      delBtn?.classList.toggle("is-loading", false);
      runBtn?.classList.toggle("is-loading", false);
    }
  }

  /**
   * Format a timestamp into a relative short Russian label.
   * @param {number|undefined|null} ts
   * @returns {string}
   */
  function formatLast(ts) {
    if (!ts) return tb("time.never");
    const diff = Math.max(0, Date.now() - Number(ts));
    const s = Math.floor(diff / 1000);
    if (s < 60) return tb("time.secondsAgo", { count: s });
    const m = Math.floor(s / 60);
    if (m < 60) return tb("time.minutesAgo", { count: m });
    const h = Math.floor(m / 60);
    if (h < 24) return tb("time.hoursAgo", { count: h });
    const d = Math.floor(h / 24);
    return tb("time.daysAgo", { count: d });
  }

  /**
   * Produce a label object for "Последняя копия" chip based on freshness.
   * @param {number|undefined|null} ts
   * @returns {{text:string, cls:string}}
   */
  function lastLabel(ts) {
    if (!ts) return { text: tb("time.neverRan"), cls: "is-none" };
    const diff = Math.max(0, Date.now() - Number(ts));
    const s = Math.floor(diff / 1000);
    if (s < 60 * 60 * 24) return { text: tb("time.today"), cls: "is-fresh" };
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
      state.programs = (res.programs || []).map((p) => ({
        ...p,
        tags: Array.isArray(p?.tags)
          ? p.tags.filter(Boolean)
          : parseTags(p?.tags || ""),
      }));
      const t = await invoke("backup:getLastTimes");
      state.lastTimes = t?.success ? t.map || t.data || {} : {};
      renderList();
    } catch (error) {
      console.error("Failed to load backup programs:", error);
      toast(tb("load.errorWithReason", { reason: error.message }), "error");
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

  const createProgramRow = (entry, pageIndex, root) => {
    const p = entry.program;
    const idx = entry.idx;
    const key = profileKey(p);
    const locked = lockedProfiles.has(key);
    const isSelected = selectedKeys.has(key);
    const tags = Array.isArray(p.tags) ? p.tags.filter(Boolean) : [];

    if (viewMode === "compact") {
      const row = document.createElement("div");
      row.className = "bk-row bk-row-compact wg-card";
      row.style.animationDelay = `${pageIndex * 0.04}s`;
      row.dataset.profileKey = key;
      row.dataset.index = String(idx);
      row.dataset.i = String(idx);
      row.tabIndex = 0;
      row.setAttribute("role", "button");
      row.setAttribute("aria-pressed", isSelected ? "true" : "false");
      if (isSelected) row.classList.add("is-selected");
      row.innerHTML = `
    <div class="bk-row-content">
      <div class="bk-row-main">
        <i class="fa-solid fa-database"></i>
        <span class="bk-name">${p.name}</span>
      </div>
      <div class="bk-row-meta" title="${p.source_path}">${p.source_path}</div>
      ${
        tags.length
          ? `<div class="bk-tags" aria-label="${tb("tags.aria")}">${tags
              .map((t) => `<span class="bk-tag">${t}</span>`)
              .join("")}</div>`
          : ""
      }
    </div>
    <div class="bk-row-actions">
      <button class="btn bk-open" data-i="${idx}" data-lockable="true"><i class="fa-solid fa-folder-open"></i></button>
      <button class="btn bk-run" data-i="${idx}" data-lockable="true"><i class="fa-solid fa-play"></i></button>
    </div>`;
      row.addEventListener("dblclick", () => showEditForm(idx));
      row.addEventListener("click", (event) => {
        if (
          event.target.closest(".bk-row-actions") ||
          event.target.closest("button")
        ) {
          return;
        }
        toggleRowSelection(row);
      });
      row.addEventListener("keydown", (event) => {
        if (event.key === " " || event.key === "Enter") {
          event.preventDefault();
          toggleRowSelection(row);
        }
      });
      root.appendChild(row);
      applyLockToRow(row, locked);
      return row;
    }

    const row = document.createElement("div");
    row.className = "bk-row";
    row.style.animationDelay = `${pageIndex * 0.05}s`;
    row.dataset.profileKey = key;
    row.dataset.index = String(idx);
    row.dataset.i = String(idx);

    const lbl = lastLabel(state.lastTimes[p.name]);
    const patterns =
      Array.isArray(p.config_patterns) && p.config_patterns.length
        ? p.config_patterns.join(", ")
        : tb("filter.allFiles");

    row.innerHTML = `
    <div class="bk-row-content min-w-0">
      <div class="font-semibold truncate">${p.name}</div>
      <div class="back-path" data-bs-toggle="tooltip" data-bs-placement="top" title="${p.source_path} → ${p.backup_path}">${p.source_path} → ${p.backup_path}</div>
      <div class="back-filter">${tb("filter.label")} ${patterns}</div>
      ${
        tags.length
          ? `<div class="bk-tags" aria-label="${tb("tags.aria")}">${tags
              .map((t) => `<span class="bk-tag">${t}</span>`)
              .join("")}</div>`
          : ""
      }
      <div class="text-xs text-muted">${tb("lastCopy.label")} <span class="bk-chip ${lbl.cls}" data-bs-toggle="tooltip" data-bs-placement="top" title="${state.lastTimes[p.name] ? new Date(state.lastTimes[p.name]).toLocaleString([], { dateStyle: "short", timeStyle: "short" }) : ""}">${lbl.text}</span></div>
    </div>
    <div class="bk-row-actions">
      <button class="btn btn-sm bk-edit" data-i="${idx}" data-lockable="true" data-bs-toggle="tooltip" data-bs-placement="top" title="${tb("action.edit")}"><i class="fa-solid fa-pen"></i></button>
      <button class="btn btn-sm bk-open-src" data-i="${idx}" data-lockable="true" data-bs-toggle="tooltip" data-bs-placement="top" title="${tb("action.openSource")}"><i class="fa-regular fa-folder-open"></i></button>
      <button class="btn btn-sm bk-open" data-i="${idx}" data-lockable="true" data-bs-toggle="tooltip" data-bs-placement="top" title="${tb("action.openDestination")}"><i class="fa-solid fa-folder-open"></i></button>
      <button class="btn btn-sm bk-run" data-i="${idx}" data-lockable="true" data-bs-toggle="tooltip" data-bs-placement="top" title="${tb("action.run")}"><i class="fa-solid fa-play"></i></button>
    </div>
  `;

    row.addEventListener("dblclick", () => showEditForm(idx));
    row.addEventListener("click", (event) => {
      if (
        event.target.closest(".bk-row-actions") ||
        event.target.closest("button")
      ) {
        return;
      }
      toggleRowSelection(row);
    });
    row.addEventListener("keydown", (event) => {
      if (event.key === " " || event.key === "Enter") {
        event.preventDefault();
        toggleRowSelection(row);
      }
    });
    row.classList.toggle("is-selected", isSelected);
    row.setAttribute("aria-pressed", isSelected ? "true" : "false");
    row.tabIndex = 0;
    row.setAttribute("role", "button");
    row.setAttribute("aria-label", `${p.name}: ${p.source_path} → ${p.backup_path}`);
    root.appendChild(row);
    applyLockToRow(row, locked);
    return row;
  };

  const renderVirtualizedRows = (root, entries) => {
    const rowHeight =
      viewMode === "compact"
        ? VIRTUAL_ROW_HEIGHT.compact
        : VIRTUAL_ROW_HEIGHT.full;

    let lastStart = -1;
    let lastEnd = -1;
    let rafId = null;

    const renderWindow = () => {
      const viewportHeight = Math.max(1, root.clientHeight);
      const scrollTop = root.scrollTop;
      const total = entries.length;

      const start = Math.max(
        0,
        Math.floor(scrollTop / rowHeight) - VIRTUALIZATION_OVERSCAN,
      );
      const end = Math.min(
        total - 1,
        Math.ceil((scrollTop + viewportHeight) / rowHeight) +
          VIRTUALIZATION_OVERSCAN,
      );

      if (start === lastStart && end === lastEnd) return;
      lastStart = start;
      lastEnd = end;

      const topPad = document.createElement("div");
      topPad.style.height = `${start * rowHeight}px`;
      const bottomPad = document.createElement("div");
      bottomPad.style.height = `${Math.max(0, total - end - 1) * rowHeight}px`;

      const fragment = document.createDocumentFragment();
      fragment.appendChild(topPad);
      for (let i = start; i <= end; i += 1) {
        createProgramRow(entries[i], i, fragment);
      }
      fragment.appendChild(bottomPad);

      root.innerHTML = "";
      root.appendChild(fragment);
      queueMicrotask(() => initBackupTooltips(root));
    };

    const onScroll = () => {
      if (rafId) return;
      rafId = requestAnimationFrame(() => {
        rafId = null;
        renderWindow();
      });
    };

    root.addEventListener("scroll", onScroll, { passive: true });
    renderWindow();

    return () => {
      root.removeEventListener("scroll", onScroll);
      if (rafId) {
        cancelAnimationFrame(rafId);
      }
    };
  };

  /**
   * Render the visible list of presets with current filter applied.
   * @returns {void}
   */
  // TODO: рассмотреть виртуализацию списка при большом количестве профилей
  function renderList() {
    const root = getEl("#bk-list");
    if (!root || !state.programs) return;
    if (clearVirtualization) {
      clearVirtualization();
      clearVirtualization = null;
    }
    root.innerHTML = "";

    // Если выбран тип архива, которого больше нет, сбрасываем фильтр на "all"
    const availableArchiveTypes = new Set(
      state.programs
        .map((p) => (p.archive_type || "zip").toLowerCase())
        .filter(Boolean),
    );
    const desiredArchive = (state.archiveFilter || "all").toLowerCase();
    if (
      desiredArchive !== "all" &&
      !availableArchiveTypes.has(desiredArchive)
    ) {
      state.archiveFilter = "all";
      if (archiveFilterSelect) archiveFilterSelect.value = "all";
      archiveSelectUI?.updateLabel?.();
    }

    const matchesArchive =
      state.archiveFilter === "all"
        ? () => true
        : (p) =>
            (p.archive_type || "zip").toLowerCase() ===
            state.archiveFilter.toLowerCase();

    const filtered = state.programs.filter((p) => {
      const q = state.filter.toLowerCase();
      const normalizeTags = (tags) =>
        (Array.isArray(tags) ? tags : parseTags(tags || "")).map((t) =>
          t.toLowerCase(),
        );
      const matchesSearch = q
        ? (p.name || "").toLowerCase().includes(q) ||
          (p.source_path || "").toLowerCase().includes(q) ||
          (p.backup_path || "").toLowerCase().includes(q) ||
          normalizeTags(p.tags).some((t) => t.includes(q))
        : true;
      return matchesSearch && matchesArchive(p);
    });

    pruneSelection(new Set(filtered.map((item) => profileKey(item))));

    const pageSize = Math.max(3, Number(state.pageSize) || 10);
    const totalPages = Math.max(1, Math.ceil(filtered.length / pageSize));
    if (state.page > totalPages) state.page = totalPages;
    if (state.page < 1) state.page = 1;
    const start = (state.page - 1) * pageSize;
    const paged = filtered.slice(start, start + pageSize);
    const disableRowsAnimation = hasRenderedListOnce || filtered.length > 20;
    root.classList.toggle("bk-list-no-anim", disableRowsAnimation);

    const pageInfo = getEl("#bk-page-info");
    if (pageInfo) pageInfo.textContent = `${state.page} / ${totalPages}`;
    const prevBtn = getEl("#bk-page-prev");
    const nextBtn = getEl("#bk-page-next");
    if (prevBtn) prevBtn.disabled = state.page <= 1;
    if (nextBtn) nextBtn.disabled = state.page >= totalPages;
    const sizeSel = getEl("#bk-page-size");
    if (sizeSel && sizeSel.value !== String(pageSize)) {
      sizeSel.value = String(pageSize);
    }

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
      const anyFilter = state.filter || state.archiveFilter !== "all";
      sinfo.textContent = anyFilter
        ? tb("search.found", { count: filtered.length })
        : "";
    }

    const resetFilters = () => {
      if (filterInput) filterInput.value = "";
      state.filter = "";
      state.archiveFilter = "all";
      if (archiveFilterSelect) archiveFilterSelect.value = "all";
      archiveSelectUI?.updateLabel?.();
      state.page = 1;
      renderList();
      filterInput?.focus();
    };

    // Handle empty state
    if (!filtered.length) {
      currentVisibleKeys = new Set();
      const hasPrograms = state.programs.length > 0;
      root.innerHTML = `
        <div class="wg-alert is-muted">
          <div class="wg-alert-icon"><i class="fa-solid fa-circle-info"></i></div>
          <div class="wg-alert-content">
            ${hasPrograms ? tb("empty.filtered") : tb("empty.none")}
          </div>
          <div class="wg-alert-actions">
            ${
              hasPrograms
                ? `<button id="bk-reset-filters" class="btn btn-sm">
                    <i class="fa-solid fa-rotate-left" style="margin-right:6px"></i>${tb("action.resetFilters")}
                  </button>`
                : `<button id="bk-create-first" class="btn btn-primary btn-sm">
                    <i class="fa-solid fa-plus" style="margin-right:6px"></i>${tb("action.createFirst")}
                  </button>`
            }
          </div>
        </div>`;

      const { del, runSel } = actions();
      if (del) del.disabled = true;
      if (runSel) runSel.disabled = true;

      if (hasPrograms) {
        root
          .querySelector("#bk-reset-filters")
          ?.addEventListener("click", resetFilters);
      } else {
        root
            .querySelector("#bk-create-first")
            ?.addEventListener("click", () => showEditForm(-1));
      }
      hasRenderedListOnce = true;
      return;
    }

    // Render filtered items
    const selAll = getEl("#bk-select-all");
    if (selAll) {
      selAll.checked = false;
      selAll.indeterminate = false;
    }

    const visibleKeys = new Set(paged.map((item) => profileKey(item)));
    pruneSelection(visibleKeys);
    currentVisibleKeys = new Set(
      paged
        .map((item) => profileKey(item))
        .filter((key) => key && !lockedProfiles.has(key)),
    );

    const indexedPaged = paged.map((program, pageIndex) => ({
      program,
      pageIndex,
      idx: state.programs.indexOf(program),
    }));

    if (clearVirtualization) {
      clearVirtualization();
      clearVirtualization = null;
    }

    if (indexedPaged.length >= VIRTUALIZATION_MIN_ITEMS) {
      clearVirtualization = renderVirtualizedRows(root, indexedPaged);
    } else {
      indexedPaged.forEach((entry) => createProgramRow(entry, entry.pageIndex, root));
      queueMicrotask(() => initBackupTooltips(root));
    }

    updateActionsState();
    if (!clearVirtualization) {
      // Сбросить прокрутку списка после фильтрации только для обычного режима
      root.scrollTop = 0;
    }
    hasRenderedListOnce = true;
  }

  // Функция запуска профиля по индексу (используется в компактном режиме)
  function _runProfile(idx) {
    runForIndices([idx]);
  }

  /**
   * Parse comma/semicolon-separated tags into normalized array.
   * @param {string} input
   * @returns {string[]}
   */
  function parseTags(input) {
    if (!input) return [];
    return input
      .split(/[,;]+/)
      .map((s) => s.trim())
      .filter(Boolean);
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
  function renderField(
    labelText,
    id,
    value,
    hint,
    required = false,
    hasPick = false,
  ) {
    return `
      <label class="wg-field flex flex-col gap-1 relative" data-hint="${hint}">
        <span class="text-sm">${labelText}</span>
        <div class="filter-clear-container input-container">
          <input id="${id}" class="input" type="text" placeholder="${hint}" value="${value}" ${required ? "required" : ""} aria-describedby="${id}-hint ${id}-err"/>
          <div class="input-actions">
            ${hasPick ? `<button type="button" class="pick-folder-btn history-action-button" data-pick="#${id}" title="${tb("action.pickFolder")}" data-bs-toggle="tooltip" data-bs-placement="top"><i class="fa-regular fa-folder-open"></i></button>` : ""}
            <button type="button" class="clear-field-btn history-action-button" data-target="#${id}" title="${tb("action.clear")}" data-bs-toggle="tooltip" data-bs-placement="top"><i class="fa-solid fa-times-circle"></i></button>
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
          tags: [],
        }
      : JSON.parse(JSON.stringify(state.programs[idx]));

    if (!Array.isArray(init.tags)) {
      init.tags = parseTags(init.tags || "");
    }

    if (!isNew) {
      const key = profileKey(init);
      if (lockedProfiles.has(key)) {
        toast(tb("profile.busy"), "warning");
        return;
      }
    }

    const nameFieldHTML = renderField(
      tb("field.name.label"),
      "f-name",
      init.name || "",
      tb("field.name.hint"),
      true,
    );

    const overlay = document.createElement("div");
    overlay.className = "modal-overlay";
    overlay.innerHTML = `
      <div class="modal-content bk-modal">
        <div class="modal-header">
          <h2><i class="fa-solid fa-box-archive"></i> ${isNew ? tb("modal.create.title") : `${tb("modal.edit.titlePrefix")} ${init.name}`}</h2>
          <button class="close-modal bk-close" aria-label="${tb("common.close")}" title="${tb("common.close")}">&times;</button>
        </div>
        <div class="modal-body bk-form-grid bk-form-split" data-preview-visible="true">
          <div class="bk-form-main">
            ${nameFieldHTML}
            ${renderField(tb("field.source.label"), "f-src", init.source_path || "", tb("field.source.hint"), true, true)}
            ${renderField(tb("field.destination.label"), "f-dst", init.backup_path || "", tb("field.destination.hint"), true, true)}
            <label class="wg-field flex flex-col gap-1">
                <span class="text-sm">${tb("field.archiveType.label")}</span>
                <select id="f-archive-type" class="input">
                  <option value="zip" ${(init.archive_type || "zip") === "zip" ? "selected" : ""}>ZIP</option>
                  <option value="tar.gz" ${(init.archive_type || "zip") === "tar.gz" ? "selected" : ""}>TAR.GZ</option>
                </select>
            </label>
            ${renderField(tb("field.filters.label"), "f-pats", (init.config_patterns || []).join(","), tb("field.filters.hint"), false)}
            ${renderField(tb("field.tags.label"), "f-tags", (init.tags || []).join(","), tb("field.tags.hint"), false)}
            ${renderField(tb("field.profile.label"), "f-prof", init.profile_path || "", tb("field.profile.hint"), false, true)}
          </div>
          <div class="bk-preview-card">
            <div class="text-xs text-muted" style="padding: 4px 0;font-weight:600;"><strong>${tb("preview.title")}</strong></div>
            <div id="bk-preview" class="text-sm bk-preview"></div>
          </div>
        </div>
        <div class="modal-footer flex gap-3">
          <div class="bk-footer-left">
            <label class="checkbox-label bk-run-checkbox">
              <input type="checkbox" id="bk-save-run" />
              <i class="fa-solid fa-play"></i>
              <span class="text-xs text-muted">${tb("action.run")}</span>
            </label>
            </div>
          <button class="bk-preview-toggle" id="bk-preview-toggle" data-bs-toggle="tooltip" data-bs-placement="top" aria-label="${tb("preview.hide")}" title="${tb("preview.hide")}" data-hint="${tb("preview.toggleHint")}">
              <i class="fa-regular fa-eye-slash"></i>
          </button>
          <button class="btn btn-sm btn-secondary bk-close">${tb("common.cancel")}</button>
          <button id="bk-save" class="btn btn-sm btn-primary">${tb("common.save")}</button>
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

    // Handle preview toggle
    (function initPreviewToggle() {
      const modalBody = q(".bk-form-grid");
      const previewCard = q(".bk-preview-card");
      const toggleBtn = q("#bk-preview-toggle");
      const ICON_SHOW = "fa-regular fa-eye";
      const ICON_HIDE = "fa-regular fa-eye-slash";
      const LS_KEY = "backupPreviewHidden";
      const readHidden = () => {
        try {
          return JSON.parse(localStorage.getItem(LS_KEY)) === true;
        } catch {
          return false;
        }
      };
      const writeHidden = (v) => {
        try {
          localStorage.setItem(LS_KEY, JSON.stringify(!!v));
        } catch {}
      };
      const apply = (hidden) => {
        if (!modalBody || !previewCard || !toggleBtn) return;
        modalBody.setAttribute(
          "data-preview-visible",
          hidden ? "false" : "true",
        );
        previewCard.style.display = hidden ? "none" : "";
        const icon = toggleBtn.querySelector("i");
        if (icon) icon.className = hidden ? ICON_SHOW : ICON_HIDE;
        toggleBtn.setAttribute(
          "aria-label",
          hidden ? tb("preview.show") : tb("preview.hide"),
        );
        toggleBtn.title = hidden ? tb("preview.show") : tb("preview.hide");
      };
      const hidden = readHidden();
      apply(hidden);
      toggleBtn?.addEventListener("click", () => {
        const next =
          modalBody?.getAttribute("data-preview-visible") !== "false";
        apply(next);
        writeHidden(next);
      });
    })();

    // Name input field
    const nameInput = overlay.querySelector("#f-name");

    // Add profile list button
    queueMicrotask(() => {
      if (!nameInput) return;
      const inputContainer = nameInput.closest(".input-container");
      if (!inputContainer) return;
      const inputActions = inputContainer.querySelector(".input-actions");

      if (
        state.programs.length > 0 &&
        inputActions &&
        !inputActions.querySelector(".name-list-btn")
      ) {
        const btnList = document.createElement("button");
        btnList.type = "button";
        btnList.className = "history-action-button name-list-btn";
        btnList.title = tb("action.useProfile");
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
                overlay.querySelector("#f-pats").value = (
                  p.config_patterns || []
                ).join(",");
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

    // File Filter Button
    queueMicrotask(() => {
      const patsField = overlay.querySelector("#f-pats");
      if (!patsField) return;

      const inputContainer = patsField.closest(".input-container");
      if (!inputContainer) return;

      if (!inputContainer.querySelector(".file-filter-btn")) {
        const btn = document.createElement("button");
        btn.type = "button";
        btn.className = "history-action-button file-filter-btn";
        btn.title = tb("action.chooseFileType");
        btn.setAttribute("data-bs-toggle", "tooltip");
        btn.setAttribute("data-bs-placement", "top");
        btn.innerHTML = '<i class="fa-solid fa-filter"></i>';
        inputContainer.querySelector(".input-actions").appendChild(btn);

        btn.addEventListener("click", () => {
          let listBox = overlay.querySelector(".file-filter-popup");
          if (!listBox) {
            listBox = document.createElement("div");
            listBox.className = "file-filter-popup";
            inputContainer.style.position = "relative";
            listBox.style.position = "absolute";
            listBox.style.top = "100%";
            listBox.style.left = "0";
            listBox.style.width = "100%";
            listBox.style.maxHeight = "260px";
            listBox.style.overflowY = "auto";
            listBox.style.background = "rgba(32,32,40,0.97)";
            listBox.style.border = "1px solid rgba(255,255,255,0.1)";
            listBox.style.borderRadius = "8px";
            listBox.style.zIndex = "999";
            listBox.style.padding = "8px 12px";
            listBox.style.color = "#fff";
            inputContainer.appendChild(listBox);

            const categories = [
              {
                label: tb("filters.category.configs"),
                exts: [
                  "*.ini",
                  "*.cfg",
                  "*.conf",
                  "*.json",
                  "*.yaml",
                  "*.yml",
                  "*.xml",
                ],
              },
              {
                label: tb("filters.category.scripts"),
                exts: [
                  "*.bat",
                  "*.cmd",
                  "*.ps1",
                  "*.sh",
                  "*.exe",
                  "*.msi",
                  "*.jar",
                  "*.py",
                ],
              },
              {
                label: tb("filters.category.docs"),
                exts: [
                  "*.txt",
                  "*.pdf",
                  "*.rtf",
                  "*.doc",
                  "*.docx",
                  "*.xls",
                  "*.xlsx",
                  "*.csv",
                  "*.odt",
                ],
              },
              {
                label: tb("filters.category.images"),
                exts: [
                  "*.png",
                  "*.jpg",
                  "*.jpeg",
                  "*.gif",
                  "*.bmp",
                  "*.webp",
                  "*.svg",
                ],
              },
              {
                label: tb("filters.category.media"),
                exts: [
                  "*.mp3",
                  "*.wav",
                  "*.flac",
                  "*.ogg",
                  "*.mp4",
                  "*.mkv",
                  "*.avi",
                  "*.mov",
                  "*.webm",
                ],
              },
              {
                label: tb("filters.category.other"),
                exts: ["*.dat", "*.log", "*.bak", "*.tmp", "*.sii"],
              },
            ];

            const selected = new Set(
              patsField.value
                .split(",")
                .map((s) => s.trim())
                .filter(Boolean),
            );

            for (const { label: cat, exts } of categories) {
              const catBox = document.createElement("fieldset");
              catBox.className = "filter-category";
              catBox.style.border = "none";
              catBox.style.marginBottom = "8px";
              catBox.innerHTML = `<legend style='font-size:0.8rem;opacity:0.8;margin-bottom:4px;'>${cat}</legend>`;
              exts.forEach((ext) => {
                const id = `chk-${ext.replace(/[^a-z0-9]/gi, "")}`;
                const label = document.createElement("label");
                label.style.display = "flex";
                label.style.alignItems = "center";
                label.style.gap = "6px";
                label.style.cursor = "pointer";
                label.style.padding = "2px 0";
                const chk = document.createElement("input");
                chk.type = "checkbox";
                chk.id = id;
                chk.checked = selected.has(ext);
                // Автоматическое обновление поля фильтра при изменении чекбокса
                chk.addEventListener("change", () => {
                  if (chk.checked) {
                    selected.add(ext);
                  } else {
                    selected.delete(ext);
                  }

                  // Обновляем значение поля
                  patsField.value = Array.from(selected).join(",");

                  // Принудительно показать кнопку очистки, если поле заполнено
                  const clearBtn = document.querySelector(
                    `.clear-field-btn[data-target="#${patsField.id}"]`,
                  );
                  if (clearBtn) {
                    clearBtn.style.display = patsField.value.trim()
                      ? ""
                      : "none";
                  }

                  // Обновить предпросмотр после изменения
                  updatePreview();
                });
                label.appendChild(chk);
                const span = document.createElement("span");
                span.textContent = ext;
                label.appendChild(span);
                catBox.appendChild(label);
              });
              listBox.appendChild(catBox);
            }

            setTimeout(() => {
              const closePopup = (e) => {
                if (!listBox.contains(e.target) && e.target !== btn) {
                  if (listBox) {
                    listBox.classList.add("closing");
                    setTimeout(() => listBox.remove(), 180);
                  }
                  document.removeEventListener("mousedown", closePopup, true);
                }
              };
              document.addEventListener("mousedown", closePopup, true);
            }, 0);
          } else {
            if (listBox) {
              listBox.classList.add("closing");
              setTimeout(() => listBox.remove(), 180);
            }
          }
        });
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
        btn.title = ok ? tb("common.save") : tb("validation.fillRequired");
      }
    }

    const _debouncedUpdateSave = debounce(updateSaveState, 120);

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

    ["#f-prof", "#f-pats", "#f-tags"].forEach((fid) => {
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
        if (required) markFieldError(id, true, tb("validation.required"));
        return;
      }

      try {
        const exists = await invoke("check-file-exists", val);
        setValid(id, exists);
        if (required && !exists)
          markFieldError(id, true, tb("validation.pathNotFound"));
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
          if (hintEl)
            hintEl.textContent = tb("field.name.suggested", { name: bn });
        }
      }
      await validatePath("f-src", true);
      _debouncedUpdateSave();
    });

    q("#f-dst")?.addEventListener("change", async () => {
      await validatePath("f-dst", true);
      _debouncedUpdateSave();
    });

    q("#f-prof")?.addEventListener("change", () =>
      validatePath("f-prof", false),
    );

    const archiveSelect = q("#f-archive-type");
    if (archiveSelect && !archiveTypeSelectUI) {
      archiveTypeSelectUI = enhanceSelect(archiveSelect);
    }

    q("#f-archive-type")?.addEventListener("change", () => {
      if (archiveTypeSelectUI?.updateLabel) archiveTypeSelectUI.updateLabel();
      updatePreview();
      _debouncedUpdateSave();
    });

    // Initial validation
    validatePath("f-src", !!init.source_path);
    validatePath("f-dst", !!init.backup_path);
    _debouncedUpdateSave();

    function updatePreview() {
      const name = q("#f-name")?.value?.trim();
      const src = q("#f-src")?.value?.trim();
      const dst = q("#f-dst")?.value?.trim();
      const prof = q("#f-prof")?.value?.trim();
      const pats = q("#f-pats")?.value?.trim();
      const archiveType = q("#f-archive-type")?.value;
      const tags = parseTags(q("#f-tags")?.value);

      const checkPathClass = (val, required) => {
        if (!val) return required ? "invalid-path" : "optional-path";
        return "valid-path";
      };

      const lines = [];

      if (name || src || dst) {
        lines.push(`
          <div>
            ${name ? `<strong>${tb("preview.profileName")}</strong>: ${name}<hr />` : ""}
            ${src ? `<span class="path-line ${checkPathClass(src, true)}">${src}</span>` : ""}
            ${src && dst ? "<br> → " : ""}
            ${dst ? `<span class="path-line ${checkPathClass(dst, true)}">${dst}</span>` : ""}
          </div>
        `);
      }

      if (prof) {
        lines.push(
          `<div><strong>${tb("field.profile.label")}</strong>: <span class="path-line ${checkPathClass(prof, false)}">${prof}</span></div>`,
        );
      }

      if (pats) {
        lines.push(
          `<div><strong>${tb("field.filters.label")}</strong>: ${pats}</div>`,
        );
      }

      if (tags && tags.length) {
        lines.push(
          `<div><strong>${tb("field.tags.label")}</strong>: ${tags.join(", ")}</div>`,
        );
      }

      if (archiveType) {
        lines.push(
          `<div><strong>${tb("field.archiveType.label")}</strong>: ${archiveType.toUpperCase()}</div>`,
        );
      }

      const box = q("#bk-preview");
      if (box) {
        box.innerHTML = lines.join("");
        box.classList.remove("flash");
        void box.offsetWidth;
        if (lines.length) box.classList.add("flash");
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
      const archive_type = q("#f-archive-type").value;
      const tags = parseTags(q("#f-tags").value);

      const saveBtn = q("#bk-save");
      if (saveBtn) {
        saveBtn.classList.add("is-loading");
        saveBtn.setAttribute("disabled", "true");
      }

      // Validation
      let err = false;
      if (!name) {
        markFieldError("f-name", true, tb("validation.nameRequired"));
        err = true;
      }
      if (!source_path) {
        markFieldError("f-src", true, tb("validation.sourceRequired"));
        err = true;
      }
      if (!backup_path) {
        markFieldError("f-dst", true, tb("validation.destinationRequired"));
        err = true;
      }

      if (err) {
        toast(tb("validation.fillRequired"), "error");
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
        markFieldError("f-name", true, tb("validation.nameExists"));
        toast(tb("validation.nameExistsToast"), "error");
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
        archive_type,
        tags,
      };

      if (isNew) {
        state.programs.unshift(payload);
        log(tb("log.profileCreated", { name }));
      } else {
        state.programs[idx] = payload;
        log(tb("log.profileUpdated", { name }));
      }

      try {
        await save();
        await load();
        toast(tb("common.saved"));

        const runAfter = !!q("#bk-save-run")?.checked;
        closeOverlay();

        if (runAfter) {
          let i = state.programs.findIndex(
            (p) =>
              p.name === payload.name && p.backup_path === payload.backup_path,
          );
          if (i < 0) i = state.programs.length - 1;
          if (i >= 0) await runForIndices([i]);
        }
      } catch (e) {
        toast(e.message || tb("common.error"), "error");
      } finally {
        if (saveBtn && saveBtn.removeAttribute) {
          saveBtn.classList.remove("is-loading");
          saveBtn.removeAttribute("disabled");
        }
      }
    });

    // Initialize tooltips
    queueMicrotask(() => initBackupTooltips());
  }

  const formatBytes = (bytes) => {
    const value = Number(bytes);
    if (!Number.isFinite(value) || value < 0) return "—";
    if (value === 0) return "0 B";
    const units = ["B", "KB", "MB", "GB", "TB"];
    const idx = Math.min(
      Math.floor(Math.log(value) / Math.log(1024)),
      units.length - 1,
    );
    const num = value / 1024 ** idx;
    const rounded = num >= 10 ? num.toFixed(0) : num.toFixed(1);
    return `${rounded} ${units[idx]}`;
  };

  const formatDuration = (ms) => {
    const value = Number(ms);
    if (!Number.isFinite(value) || value < 0) return "—";
    if (value < 1000) return tb("time.msShort", { count: Math.round(value) });
    const totalSec = value / 1000;
    if (totalSec < 60) {
      const rounded =
        totalSec >= 10 ? totalSec.toFixed(0) : totalSec.toFixed(1);
      return tb("time.secShort", { count: rounded });
    }
    const minutes = Math.floor(totalSec / 60);
    const seconds = Math.round(totalSec % 60);
    return tb("time.minSec", {
      minutes,
      seconds: String(seconds).padStart(2, "0"),
    });
  };

  const formatSpeed = (bytes, ms) => {
    const b = Number(bytes);
    const t = Number(ms);
    if (!Number.isFinite(b) || b <= 0) return "—";
    if (!Number.isFinite(t) || t <= 0) return "—";
    const perSec = b / (t / 1000);
    if (!Number.isFinite(perSec) || perSec <= 0) return "—";
    return `${formatBytes(perSec)}/s`;
  };

  /**
   * Run backup for a subset of presets by indices.
   * @param {number[]} indices
   * @returns {Promise<void>}
   */
  async function runForIndices(indices) {
    if (!indices.length) {
      toast(tb("toast.noneSelected"), "warning");
      return;
    }

    const list = indices.map((i) => state.programs[i]).filter(Boolean);

    if (!list.length) {
      toast(tb("toast.noProfilesToRun"), "warning");
      log(tb("log.noProfilesToRun"));
      return;
    }

    clearPreflightSummary();
    let preflight;
    try {
      preflight = await invoke("backup:preflight", list);
    } catch (error) {
      toast(tb("preflight.runError"), "error");
      log(tb("log.preflightFailed", { reason: error?.message || error }));
      expandAndScrollLog();
      return;
    }

    if (!preflight?.success) {
      toast(preflight?.error || tb("preflight.error"), "error");
      log(tb("log.preflightFailed", { reason: preflight?.error || "unknown" }));
      expandAndScrollLog();
      return;
    }

    renderPreflightSummary(preflight.results || []);

    const hasPreflightErrors = (preflight.results || []).some(
      (r) => Array.isArray(r?.errors) && r.errors.length,
    );
    const hasPreflightWarnings = (preflight.results || []).some(
      (r) => Array.isArray(r?.warnings) && r.warnings.length,
    );

    if (hasPreflightErrors) {
      toast(tb("preflight.failed"), "error");
      log(tb("log.preflightFixHints"));
      expandAndScrollLog();
      return;
    }

    if (hasPreflightWarnings) {
      toast(tb("preflight.warnings"), "warning");
    } else {
      toast(tb("preflight.passed", { count: list.length }), "success");
    }

    toast(tb("run.start", { count: list.length }), "info");

    // Получаем элементы прогресс-бара
    const progressContainer = getEl("#bk-progress-container");
    const progressBar = getEl(".bk-progress-bar");
    const progressCurrent = getEl("#bk-progress-current");
    const progressTotal = getEl("#bk-progress-total");
    const progressPercent = getEl("#bk-progress-percent");
    const progressSize = getEl("#bk-progress-size");
    const progressSpeed = getEl("#bk-progress-speed");

    let bytesDone = 0;
    let durationDone = 0;

    const resetProgressStats = () => {
      if (progressSize) progressSize.textContent = "—";
      if (progressSpeed) progressSpeed.textContent = "—";
    };

    const updateProgressStats = (result) => {
      if (result?.success && Number(result.sizeBytes) > 0) {
        bytesDone += Number(result.sizeBytes);
      }
      if (result?.success && Number(result.durationMs) > 0) {
        durationDone += Number(result.durationMs);
      }
      if (progressSize) {
        progressSize.textContent = bytesDone > 0 ? formatBytes(bytesDone) : "—";
      }
      if (progressSpeed) {
        const avgSpeed =
          bytesDone > 0 && durationDone > 0
            ? `${formatBytes(bytesDone / (durationDone / 1000))}/s`
            : "—";
        progressSpeed.textContent = avgSpeed;
      }
    };

    // Показываем и инициализируем прогресс-бар
    if (
      progressContainer &&
      progressBar &&
      progressCurrent &&
      progressTotal &&
      progressPercent
    ) {
      progressContainer.classList.add("active");
      progressCurrent.textContent = "0";
      progressTotal.textContent = String(list.length);
      progressPercent.textContent = "0%";
      progressBar.style.width = "0%";
      resetProgressStats();
    }

    // Highlight running rows
    const rows = indices
      .map((i) => wrapper.querySelector(`.bk-row[data-index="${i}"]`))
      .filter(Boolean);

    rows.forEach((r) => r.classList.add("is-running"));

    log(tb("log.runStart", { count: list.length }));

    const lockedKeys = list.map((program) => profileKey(program));
    lockedKeys.forEach((key) => setProfileLocked(key, true));

    acquireReloadShortcutBlock();
    try {
      let res;
      try {
        res = await invoke("backup:run", list);
      } catch (invokeError) {
        lockedKeys.forEach((key) => setProfileLocked(key, false));
        rows.forEach((r) => r.classList.remove("is-running"));
        if (progressContainer) {
          progressContainer.classList.remove("active");
        }
        toast(invokeError?.message || tb("run.startError"), "error");
        log(
          tb("log.error", {
            reason: invokeError?.message || invokeError || "unknown",
          }),
        );
        expandAndScrollLog();
        return;
      }
      if (!res?.success) {
        toast(res?.error || tb("run.startErrorGeneric"), "error");
        log(tb("log.error", { reason: res?.error || "unknown" }));
        rows.forEach((r) => r.classList.remove("is-running"));
        lockedKeys.forEach((key) => setProfileLocked(key, false));

        // Скрываем прогресс-бар при ошибке
        if (progressContainer) {
          progressContainer.classList.remove("active");
        }

        toast(tb("run.executeError"), "error");
        expandAndScrollLog();
        return;
      }

      // Process results
      let done = 0;
      const results = Array.isArray(res.results)
        ? res.results.filter(Boolean)
        : [];
      results.forEach((r) => {
        const name = r.name || tb("profile.unnamed");
        if (r.success) {
          const sizeLabel = formatBytes(r.sizeBytes);
          const durationLabel = formatDuration(r.durationMs);
          const speedLabel = formatSpeed(r.sizeBytes, r.durationMs);
          log(
            tb("log.runSuccess", {
              name,
              size: sizeLabel,
              duration: durationLabel,
              speed: speedLabel,
              path: r.zipPath || tb("log.archiveSaved"),
            }),
          );
        } else {
          log(
            tb("log.runFailed", {
              name,
              error: r.error || tb("common.unknownError"),
            }),
          );
        }
        done += 1;
        const percent = Math.round((done / list.length) * 100);

        // Обновляем прогресс-бар
        if (progressBar && progressCurrent && progressPercent) {
          progressBar.style.width = percent + "%";
          progressCurrent.textContent = String(done);
          progressPercent.textContent = percent + "%";
        }
        updateProgressStats(r);
      });

      if (bytesDone > 0) {
        const totalDurationLabel = formatDuration(durationDone);
        const avgSpeedLabel = formatSpeed(bytesDone, durationDone);
        log(
          tb("log.summary", {
            size: formatBytes(bytesDone),
            duration: totalDurationLabel,
            speed: avgSpeedLabel,
          }),
        );
      }

      await load();

      const successCount = results.filter((r) => r?.success).length;
      const failedCount = Math.max(0, list.length - successCount);
      if (successCount === list.length) {
        toast(tb("run.completedAll", { count: successCount }), "success");
      } else {
        toast(
          tb("run.completedWithErrors", {
            success: successCount,
            failed: failedCount,
          }),
          "error",
        );
      }

      expandAndScrollLog();

      rows.forEach((r) => r.classList.remove("is-running"));

      // Скрываем прогресс-бар с задержкой для плавного завершения
      setTimeout(() => {
        if (progressContainer) {
          progressContainer.classList.remove("active");
        }
      }, 1500);

      lockedKeys.forEach((key) => setProfileLocked(key, false));
    } finally {
      releaseReloadShortcutBlock();
    }
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
    const indices = getSelectedIndices();

    if (!indices.length) {
      toast(tb("toast.noneSelected"), "warning");
      return;
    }

    const names = indices
      .map((i) => state.programs[i]?.name)
      .filter(Boolean)
      .join(", ");

    showConfirmationDialog(tb("confirm.deleteProfile", { names }), async () => {
      state.programs = state.programs.filter((_, i) => !indices.includes(i));
      try {
        await save();
        await load();
        toast(tb("toast.deleted"));
      } catch (e) {
        toast(e.message || tb("common.error"), "error");
      }
      log(tb("log.profilesDeleted", { names }));
    });
  });

  getEl("#bk-run-selected")?.addEventListener("click", async () => {
    const indices = getSelectedIndices();

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
      if (selAll.checked) {
        selectAllVisible();
      } else {
        currentVisibleKeys.forEach((key) => clearSelectionForKey(key));
      }
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
    const text = getLogPlainText();
    if (!text) {
      toast(tb("log.empty"), "warning");
      return;
    }
    try {
      await navigator.clipboard.writeText(text);
      toast(tb("log.copied"));
    } catch {
      toast(tb("log.copyError"), "error");
    }
  });

  // Export log to file
  const logExportBtn = getEl("#bk-log-export");
  logExportBtn?.addEventListener("click", () => {
    const text = getLogPlainText();
    if (!text) {
      toast(tb("log.empty"), "warning");
      return;
    }
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
      toast(tb("log.fileSaved"));
    } catch (_e) {
      toast(tb("log.fileSaveError"), "error");
    }
  });

  // Search filter clear button visibility
  function updateClearVisibility() {
    if (!clearFilterBtn) return;
    const has = !!(filterInput && filterInput.value.trim());
    // Уничтожить tooltip при скрытии кнопки
    const tip = window.bootstrap?.Tooltip?.getInstance(clearFilterBtn);
    if (tip) tip.dispose();
    clearFilterBtn.style.display = has ? "" : "none";
    clearFilterBtn.setAttribute("aria-hidden", has ? "false" : "true");
  }

  if (filterInput) {
    const onFilterInput = debounce(() => {
      state.filter = filterInput.value.trim();
      state.page = 1;
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
      if (p?.source_path) {
        await invoke("backup:openPath", {
          folder: p.source_path,
          profileName: p.name,
        });
      }
    } else if (t.classList.contains("bk-open")) {
      const p = state.programs[Number(t.dataset.i)];
      if (p?.backup_path) {
        await invoke("backup:openPath", {
          folder: p.backup_path,
          profileName: p.name,
        });
      }
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
    const isTyping =
      tag === "input" || tag === "textarea" || e.target.isContentEditable;

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
      selectAllVisible();
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

  window.addEventListener("backup:viewMode", (event) => {
    if (event?.detail?.source === "backupView") return;
    const mode = event?.detail?.mode;
    if (!mode) return;
    const normalized = mode === "compact" ? "compact" : "full";
    if (normalized === viewMode) return;
    viewMode = normalized;
    try {
      localStorage.setItem(VIEW_MODE_KEY, JSON.stringify(viewMode));
    } catch {}
    renderList();
    updateViewToggleIcon();
  });

  window.addEventListener("backup:logVisible", (event) => {
    if (event?.detail?.source === "backupView") return;
    const visible = event?.detail?.visible !== false;
    if (visible === logVisible) return;
    logVisible = visible;
    try {
      localStorage.setItem(LOG_VISIBLE_KEY, JSON.stringify(visible));
    } catch {}
    applyLogVisibility(visible);
  });

  queueMicrotask(() => {
    window.dispatchEvent(
      new CustomEvent("backup:viewMode", {
        detail: { mode: viewMode, source: "backupView" },
      }),
    );
    window.dispatchEvent(
      new CustomEvent("backup:logVisible", {
        detail: { visible: logVisible, source: "backupView" },
      }),
    );
  });

  // Initial load
  load().catch((e) => {
    console.error(e);
    showError(tb("load.error"), e.message);
  });

  // Initialize tooltips
  queueMicrotask(() => initBackupTooltips());

  const destroyViewResources = () => {
    stopHintsRotation();
    if (clearVirtualization) {
      clearVirtualization();
      clearVirtualization = null;
    }
    window.removeEventListener("tabs:activated", onTabsActivated);
    document.removeEventListener("visibilitychange", syncHintsRotation);
  };
  const disconnectObserver = new MutationObserver(() => {
    if (!wrapper.isConnected) {
      destroyViewResources();
      disconnectObserver.disconnect();
    }
  });
  if (document.body) {
    disconnectObserver.observe(document.body, {
      childList: true,
      subtree: true,
    });
  }

  return wrapper;
}
