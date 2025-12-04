// src/js/modules/views/randomizerView.js

import { showToast } from "../toast.js";
import { initTooltips } from "../tooltipInitializer.js";
import {
  DEFAULT_ITEMS,
  DEFAULT_WEIGHT,
  MAX_ITEM_LENGTH,
  readJson,
  saveJson,
  clampWeight,
  clampHits,
  declOfNum,
} from "../randomizer/helpers.js";
import { createRandomizerState } from "../randomizer/state.js";
import { createSummary } from "../randomizer/ui/summary.js";
import { createHistoryRenderer } from "../randomizer/ui/history.js";
import { createItemsRenderer } from "../randomizer/ui/items.js";
import { createResultUI } from "../randomizer/ui/result.js";
import { createPresetsUI } from "../randomizer/ui/presets.js";
import { wireRollControls } from "../randomizer/ui/controls.js";
import { wireListActions } from "../randomizer/ui/listActions.js";

export default function renderRandomizerView() {
  const storage = {
    readJson,
    saveJson,
    hasKey: (key) => localStorage.getItem(key) !== null,
    readText: (key) => localStorage.getItem(key) || "",
    setItem: (key, value) => localStorage.setItem(key, value),
  };

  const state = createRandomizerState(storage);
  let items;
  let presets;
  let history;
  let settings;
  let pool;
  let currentPresetName;
  let defaultPresetName;
  let selectedItems = new Set();

  const syncState = () => {
    ({
      items,
      presets,
      history,
      settings,
      pool,
      currentPresetName,
      defaultPresetName,
    } = state.getState());
  };

  syncState();
  state.normalizePool();
  syncState();

  const wrapper = document.createElement("div");
  wrapper.id = "randomizer-view";
  wrapper.className = "randomizer-view tab-content p-4";
  wrapper.innerHTML = `
    <div class="randomizer-hero">
      <div class="randomizer-heading">
        <div class="icon">
          <i class="fa-solid fa-shuffle"></i>
        </div>
        <div class="text">
          <h2>Randomizer</h2>
          <p>Перемешайте идеи, ссылки и задачи — приложение выберет случайный вариант.</p>
        </div>
      </div>
      <div class="randomizer-hero-actions">
        <button type="button" class="btn btn-primary randomizer-roll" id="randomizer-roll-hero">
          <i class="fa-solid fa-dice"></i>
          <span>Запустить</span>
        </button>
        <button type="button" class="btn btn-ghost" id="randomizer-reset-pool" data-bs-toggle="tooltip" data-bs-placement="bottom" title="Очистить пул без повторов">
          <i class="fa-solid fa-arrows-rotate"></i>
        </button>
      </div>
    </div>

    <div class="randomizer-summary" id="randomizer-summary">
      <div class="summary-item">
        <span class="label">Варианты</span>
        <strong id="randomizer-summary-count">0</strong>
      </div>
      <div class="summary-item">
        <span class="label">Шаблон</span>
        <strong id="randomizer-summary-preset">—</strong>
      </div>
      <div class="summary-item">
        <span class="label">Режим</span>
        <strong id="randomizer-summary-mode">—</strong>
      </div>
      <div class="summary-item">
        <span class="label">В пуле</span>
        <strong id="randomizer-summary-pool">—</strong>
      </div>
    </div>

    <div class="randomizer-grid">
      <section class="randomizer-card randomizer-editor">
        <header>
          <div>
            <p class="eyebrow">Список вариантов</p>
            <h3>Что будем перемешивать?</h3>
          </div>
          <label class="randomizer-toggle" data-bs-toggle="tooltip" data-bs-placement="top" title="При включении каждый элемент выпадет один раз до полного обновления пула.">
            <input type="checkbox" id="randomizer-no-repeat" />
            <span>Без повторов</span>
          </label>
        </header>
        <p class="hint">Добавляйте идеи по одной или вставьте целый список через буфер обмена.</p>
        <div class="randomizer-presets">
          <label for="randomizer-preset-select" class="preset-label">Шаблоны:</label>
          <select id="randomizer-preset-select" class="preset-select"></select>
          <button type="button" class="btn btn-sm btn-ghost" id="randomizer-preset-save" data-bs-toggle="tooltip" data-bs-placement="top" title="Сохранить текущий шаблон">
            <i class="fa-solid fa-floppy-disk"></i>
          </button>
          <button type="button" class="btn btn-sm btn-ghost" id="randomizer-preset-new" data-bs-toggle="tooltip" data-bs-placement="top" title="Создать новый пустой шаблон">
            <i class="fa-solid fa-file-circle-plus"></i>
          </button>
          <button type="button" class="btn btn-sm btn-ghost" id="randomizer-preset-default" data-bs-toggle="tooltip" data-bs-placement="top" title="Сделать шаблон стартовым">
            <i class="fa-solid fa-star"></i>
          </button>
          <button type="button" class="btn btn-sm btn-ghost" id="randomizer-preset-save-as" data-bs-toggle="tooltip" data-bs-placement="top" title="Сохранить как новый шаблон">
            <i class="fa-solid fa-copy"></i>
          </button>
          <button type="button" class="btn btn-sm btn-ghost danger" id="randomizer-preset-delete" data-bs-toggle="tooltip" data-bs-placement="top" title="Удалить выбранный шаблон">
            <i class="fa-solid fa-trash"></i>
          </button>
        </div>
        <div class="randomizer-add-row">
          <input
            type="text"
            id="randomizer-input"
            placeholder="Например, &quot;Плейлист с YouTube&quot;"
            maxlength="160"
          />
          <button type="button" class="btn btn-primary" id="randomizer-add">
            <i class="fa-solid fa-plus"></i>
          </button>
          <div class="randomizer-editor-actions">
            <button type="button" class="btn btn-ghost" id="randomizer-paste" data-bs-toggle="tooltip" data-bs-placement="top" title="Вставить список">
              <i class="fa-solid fa-paste"></i>
            </button>
            <button type="button" class="btn btn-ghost" id="randomizer-sample" data-bs-toggle="tooltip" data-bs-placement="top" title="Пример">
              <i class="fa-solid fa-list-check"></i>
            </button>
            <button type="button" class="btn btn-ghost danger" id="randomizer-clear" data-bs-toggle="tooltip" data-bs-placement="top" title="Очистить">
              <i class="fa-solid fa-broom"></i>
            </button>
          </div>
        </div>
        <div class="randomizer-divider"></div>
        <div class="randomizer-list-header">
          <span id="randomizer-count">0 вариантов</span>
          <div class="randomizer-list-actions">
            <button type="button" class="btn btn-sm btn-ghost" id="randomizer-export" data-bs-toggle="tooltip" data-bs-placement="left" title="Скопировать все элементы в буфер">
              <i class="fa-solid fa-copy"></i>
            </button>
            <button type="button" class="btn btn-sm btn-ghost danger" id="randomizer-delete-selected" data-bs-toggle="tooltip" data-bs-placement="left" title="Удалить выбранные варианты">
              <i class="fa-solid fa-trash"></i>
              <span>Удалить выбранные</span>
            </button>
          </div>
        </div>
        <div id="randomizer-pool-hint" class="randomizer-pool-hint hidden">
          <div class="text">
            <i class="fa-solid fa-circle-exclamation"></i>
            <span>Пул без повторов пуст. Обновите его, чтобы продолжить.</span>
          </div>
          <button type="button" class="btn btn-sm btn-ghost" id="randomizer-pool-refresh">
            <i class="fa-solid fa-arrows-rotate"></i>
            <span>Обновить пул</span>
          </button>
        </div>
        <div id="randomizer-list" class="randomizer-list" aria-live="polite"></div>
      </section>

      <section class="randomizer-card randomizer-result-card randomizer-outcome-card">
        <div class="outcome-section">
          <header>
            <p class="eyebrow">Результат</p>
            <h3>Случайный выбор</h3>
          </header>
          <div class="randomizer-result" id="randomizer-result">
            <div class="placeholder">
              <i class="fa-solid fa-dice"></i>
              <p>Добавьте варианты и нажмите «Запустить»</p>
            </div>
            <div class="result-value" id="randomizer-result-text"></div>
            <p class="result-meta" id="randomizer-result-meta"></p>
          </div>
          <div class="randomizer-result-actions">
            <button type="button" class="btn btn-primary randomizer-roll" id="randomizer-roll">
              <i class="fa-solid fa-play"></i>
              <span>Ещё раз</span>
            </button>
            <button type="button" class="btn btn-ghost" id="randomizer-copy" data-bs-toggle="tooltip" data-bs-placement="top" title="Скопировать результат">
              <i class="fa-solid fa-copy"></i>
            </button>
          </div>
        </div>

        <div class="outcome-divider"></div>

        <div class="randomizer-history-card">
          <header>
            <p class="eyebrow">История</p>
            <h3>Последние результаты</h3>
          </header>
          <div id="randomizer-history" class="randomizer-history">
            <div id="randomizer-history-empty" class="placeholder">
              <span>Ещё ничего не выбрано.</span>
              <button type="button" class="btn btn-sm btn-primary" id="randomizer-history-run">
                <i class="fa-solid fa-dice"></i>
                <span>Запустить</span>
              </button>
            </div>
            <ul id="randomizer-history-list"></ul>
          </div>
          <div class="randomizer-history-actions">
            <button type="button" class="btn btn-ghost" id="randomizer-history-clear">
              <i class="fa-solid fa-trash"></i>
              <span>Очистить историю</span>
            </button>
          </div>
        </div>
      </section>
    </div>
  `;

  const listEl = wrapper.querySelector("#randomizer-list");
  const inputEl = wrapper.querySelector("#randomizer-input");
  const countEl = wrapper.querySelector("#randomizer-count");
  const noRepeatToggle = wrapper.querySelector("#randomizer-no-repeat");
  const historyList = wrapper.querySelector("#randomizer-history-list");
  const historyEmpty = wrapper.querySelector("#randomizer-history-empty");
  const resultText = wrapper.querySelector("#randomizer-result-text");
  const resultMeta = wrapper.querySelector("#randomizer-result-meta");
  const resultCard = wrapper.querySelector(".randomizer-result-card");
  const resultContainer = wrapper.querySelector("#randomizer-result");
  const bulkDeleteButton = wrapper.querySelector("#randomizer-delete-selected");
  const exportButton = wrapper.querySelector("#randomizer-export");
  const rollButtons = wrapper.querySelectorAll(".randomizer-roll");
  const presetSelect = wrapper.querySelector("#randomizer-preset-select");
  const poolHintEl = wrapper.querySelector("#randomizer-pool-hint");
  const poolRefreshBtn = wrapper.querySelector("#randomizer-pool-refresh");
  const summaryCountEl = wrapper.querySelector("#randomizer-summary-count");
  const summaryPresetEl = wrapper.querySelector("#randomizer-summary-preset");
  const summaryModeEl = wrapper.querySelector("#randomizer-summary-mode");
  const summaryPoolEl = wrapper.querySelector("#randomizer-summary-pool");
  const presetSaveBtn = wrapper.querySelector("#randomizer-preset-save");
  const presetNewBtn = wrapper.querySelector("#randomizer-preset-new");
  const presetSaveAsBtn = wrapper.querySelector("#randomizer-preset-save-as");
  const presetDeleteBtn = wrapper.querySelector("#randomizer-preset-delete");
  const presetDefaultBtn = wrapper.querySelector("#randomizer-preset-default");
  let presetPromptEl = null;
  const historyRunBtn = wrapper.querySelector("#randomizer-history-run");
  let listActionsUI = null;

  const setCountLabel = () => {
    countEl.textContent =
      items.length === 1
        ? "1 вариант"
        : `${items.length} ${declOfNum(items.length, [
            "вариант",
            "варианта",
            "вариантов",
          ])}`;
  };

  // Универсальный кастомный селект (общий с Backup)
  const { updateSummary, updatePoolHint, pulsePool } = createSummary({
    getState: () => state.getState(),
    elements: {
      summaryCountEl,
      summaryPresetEl,
      summaryModeEl,
      summaryPoolEl,
      poolHintEl,
    },
  });
  const setRollDisabled = (disabled) => {
    rollButtons.forEach((btn) => {
      btn.disabled = disabled;
      btn.classList.toggle("is-disabled", disabled);
    });
  };
  const updateRollAvailability = () => {
    const { items, pool, settings } = state.getState();
    const disabled =
      settings.noRepeat &&
      items.length > 0 &&
      (!Array.isArray(pool) || pool.length === 0);
    setRollDisabled(disabled);
  };

  const applyPreset = (name) => {
    const applied = state.applyPreset(name);
    syncState();
    if (!applied) return false;
    selectedItems.clear();
    resetPool();
    renderItems();
    setCountLabel();
    updateBulkActions();
    return true;
  };

  const syncCurrentPresetItems = () => {
    state.syncCurrentPresetItems();
    syncState();
    state.savePresets();
    presetsUI?.refreshPresetSelect?.();
  };

  const normalizePool = () => {
    state.normalizePool();
    syncState();
    updatePoolHint();
    updateSummary();
    updateRollAvailability();
  };

  const resetPool = () => {
    state.resetPool();
    syncState();
    updatePoolHint();
    updateSummary();
    pulsePool();
    updateRollAvailability();
  };

  const persistItems = (options = {}) => {
    state.persistItems(options);
    syncState();
  };

  const persistHistory = () => {
    state.persistHistory();
    syncState();
  };

  const persistSettings = () => {
    state.persistSettings();
    syncState();
  };

  const ensurePresetExists = () => {
    state.ensurePresetExists();
    syncState();
    updateSummary();
  };

  const createPreset = (name, sourceItems = items) => {
    const trimmed = (name || "").trim();
    if (!trimmed) return;
    const exists = presets.some(
      (p) => p.name.toLowerCase() === trimmed.toLowerCase(),
    );
    if (exists) {
      const replace = confirm(
        "Шаблон с таким именем уже есть. Перезаписать его текущим списком?",
      );
      if (!replace) return;
    }
    state.createPreset(trimmed, sourceItems);
    syncState();
    state.savePresets();
  };

  const ensurePresetPrompt = () => {
    if (presetPromptEl) return presetPromptEl;
    const overlay = document.createElement("div");
    overlay.className = "preset-prompt-overlay hidden";
    overlay.innerHTML = `
      <div class="preset-prompt">
        <h4>Название шаблона</h4>
        <input type="text" class="preset-prompt-input" maxlength="80" />
        <div class="preset-prompt-actions">
          <button type="button" class="btn btn-ghost" data-action="cancel">Отмена</button>
          <button type="button" class="btn btn-primary" data-action="ok">Сохранить</button>
        </div>
      </div>
    `;
    document.body.appendChild(overlay);
    presetPromptEl = overlay;
    return presetPromptEl;
  };

  const askPresetName = (initialValue = "") =>
    new Promise((resolve) => {
      const overlay = ensurePresetPrompt();
      const input = overlay.querySelector(".preset-prompt-input");
      const btnOk = overlay.querySelector('[data-action="ok"]');
      const btnCancel = overlay.querySelector('[data-action="cancel"]');

      const cleanup = (result = null) => {
        overlay.classList.add("hidden");
        overlay.setAttribute("aria-hidden", "true");
        btnOk.removeEventListener("click", onOk);
        btnCancel.removeEventListener("click", onCancel);
        overlay.removeEventListener("click", onBackdrop);
        input.removeEventListener("keydown", onKey);
        resolve(result);
      };

      const onOk = () => {
        const value = input.value.trim();
        if (!value) {
          showToast("Введите название шаблона", "warning");
          return;
        }
        cleanup(value);
      };

      const onCancel = () => cleanup(null);
      const onBackdrop = (event) => {
        if (event.target === overlay) cleanup(null);
      };
      const onKey = (event) => {
        if (event.key === "Enter") {
          event.preventDefault();
          onOk();
        } else if (event.key === "Escape") {
          event.preventDefault();
          onCancel();
        }
      };

      overlay.classList.remove("hidden");
      overlay.setAttribute("aria-hidden", "false");
      input.value = initialValue;
      input.focus();
      input.select();

      btnOk.addEventListener("click", onOk);
      btnCancel.addEventListener("click", onCancel);
      overlay.addEventListener("click", onBackdrop);
      input.addEventListener("keydown", onKey);
    });

  // Native prompt fallback for test env where modal isn't interacted with
  const promptPresetNameFallback = (initialValue = "") => {
    if (
      typeof process !== "undefined" &&
      process.env?.NODE_ENV === "test" &&
      typeof prompt === "function"
    ) {
      return prompt("Название шаблона", initialValue);
    }
    return undefined;
  };

  const deletePreset = (name) => {
    state.deletePreset(name);
    syncState();
    presetsUI?.refreshPresetSelect?.();
    renderItems();
  };

  const presetsUI = createPresetsUI({
    presetSelect,
    presetSaveBtn,
    presetNewBtn,
    presetSaveAsBtn,
    presetDeleteBtn,
    presetDefaultBtn,
    askPresetName,
    promptPresetNameFallback,
    createPreset,
    applyPreset,
    refreshPresets: syncCurrentPresetItems,
    deletePreset,
    setDefault: (name) => {
      defaultPresetName = name;
      state.savePresets();
      syncState();
      updateSummary();
    },
    showToast,
    getState: () => state.getState(),
  });

  const pruneSelection = () => {
    selectedItems = new Set(
      [...selectedItems].filter((value) =>
        items.some((item) => item.value === value),
      ),
    );
  };

  const updateBulkActions = () => {
    pruneSelection();
    listActionsUI?.updateBulkButton?.(selectedItems.size);
  };

  const toggleSelection = (value, chipEl) => {
    if (selectedItems.has(value)) {
      selectedItems.delete(value);
      chipEl?.classList.remove("selected");
    } else {
      selectedItems.add(value);
      chipEl?.classList.add("selected");
    }
    updateBulkActions();
  };

  const replaceItemValue = (oldValue, newValue) => {
    const trimmed = newValue.trim();
    if (!trimmed) {
      showToast("Текст не может быть пустым", "warning");
      return false;
    }
    if (trimmed.length > MAX_ITEM_LENGTH) {
      showToast("Слишком длинный текст", "warning");
      return false;
    }
    const duplicate = items.some(
      (entry) =>
        entry.value.toLowerCase() === trimmed.toLowerCase() &&
        entry.value.toLowerCase() !== oldValue.toLowerCase(),
    );
    if (duplicate) {
      showToast("Такой вариант уже есть", "info");
      return false;
    }
    const ok = state.updateItem(oldValue, trimmed, { resetPool: false });
    if (!ok) return false;
    syncState();
    if (selectedItems.has(oldValue)) {
      selectedItems.delete(oldValue);
      selectedItems.add(trimmed);
    }
    renderItems();
    return true;
  };

  const startInlineEdit = (chipEl, value) => {
    if (!chipEl || chipEl.dataset.editing === "1") return;
    chipEl.dataset.editing = "1";
    const textEl = chipEl.querySelector(".text");
    if (!textEl) return;

    const input = document.createElement("input");
    input.type = "text";
    input.className = "chip-edit-input";
    input.value = value;
    input.maxLength = MAX_ITEM_LENGTH;
    chipEl.classList.add("editing");
    textEl.replaceWith(input);
    input.focus();
    input.select();

    const finish = (commit) => {
      chipEl.classList.remove("editing");
      chipEl.dataset.editing = "0";
      if (commit) {
        const ok = replaceItemValue(value, input.value);
        if (ok) return;
      }
      const newText = document.createElement("span");
      newText.className = "text";
      newText.textContent = value;
      input.replaceWith(newText);
    };

    input.addEventListener("keydown", (event) => {
      if (event.key === "Enter") {
        event.preventDefault();
        finish(true);
      } else if (event.key === "Escape") {
        event.preventDefault();
        finish(false);
      }
    });

    input.addEventListener("blur", () => finish(true));
  };

  const moveItem = (fromValue, toValue) => {
    const ok = state.moveItem(fromValue, toValue);
    if (!ok) return;
    syncState();
    renderItems();
  };

  const getItemWeight = (item) => clampWeight(item?.weight ?? DEFAULT_WEIGHT);
  const getItemHits = (item) => clampHits(item?.hits ?? 0);

  const pickWeightedItem = (candidates) => {
    const totalWeight = candidates.reduce(
      (sum, item) => sum + getItemWeight(item),
      0,
    );
    if (totalWeight <= 0) return null;
    let rollValue = Math.random() * totalWeight;
    for (const item of candidates) {
      rollValue -= getItemWeight(item);
      if (rollValue <= 0) return item;
    }
    return candidates[candidates.length - 1] || null;
  };

  const renderItemsImpl = createItemsRenderer({
    getState: () => state.getState(),
    listEl,
    getSelected: () => selectedItems,
    onUpdateCount: setCountLabel,
    onUpdateBulk: updateBulkActions,
    onUpdatePoolHint: updatePoolHint,
    onUpdateSummary: updateSummary,
    onSelectToggle: toggleSelection,
    onRemoveSelected: (toRemove, { silent } = {}) => {
      state.removeItems(toRemove);
      syncState();
      toRemove.forEach((v) => selectedItems.delete(v));
      renderItems();
      clearResult();
      if (!silent) showToast("Выбранные варианты удалены", "success");
    },
    onReplaceItem: replaceItemValue,
    onMoveItem: (from, to) => {
      moveItem(from, to);
    },
    onSyncWeight: {
      clamp: clampWeight,
      clampHits,
      set: (value, weight) => {
        state.setWeight(value, weight);
        syncState();
      },
    },
    onStartInlineEdit: (chip, value) => startInlineEdit(chip, value),
  });

  const renderItems = () => {
    syncState();
    pruneSelection();
    renderItemsImpl();
    updateRollAvailability();
  };

  ensurePresetExists();
  const initialPresetName =
    defaultPresetName && presets.some((p) => p.name === defaultPresetName)
      ? defaultPresetName
      : currentPresetName;
  if (initialPresetName) applyPreset(initialPresetName);
  presetsUI.refreshPresetSelect();
  normalizePool();
  updateSummary();

  const resultUI = createResultUI({
    resultCard,
    resultContainer,
    resultText,
    resultMeta,
  });
  const { clear: clearResult } = resultUI;

  const renderHistory = createHistoryRenderer({
    getState: () => state.getState(),
    historyList,
    historyEmpty,
    onSelectEntry: (value) => {
      resultUI.setResult(value, "Выбрано ранее");
    },
  });

  const addHistoryEntry = (value) => {
    state.addHistoryEntry(value);
    syncState();
    renderHistory();
  };

  const addItem = (value, silent = false) => {
    const normalized = value.trim();
    if (!normalized) {
      if (!silent) showToast("Введите текст варианта", "warning");
      return;
    }
    if (normalized.length > MAX_ITEM_LENGTH) {
      if (!silent) showToast("Слишком длинный вариант", "warning");
      return;
    }
    const exists = items.some(
      (item) => item.value.toLowerCase() === normalized.toLowerCase(),
    );
    if (exists) {
      if (!silent) showToast("Такой вариант уже есть", "info");
      return;
    }
    state.addItem(normalized);
    syncState();
    renderItems();
  };

  const bulkAdd = (values) => {
    const added = state.bulkAdd(values);
    syncState();
    renderItems();
    if (added) {
      showToast(
        `Добавлено ${added} ${declOfNum(added, ["элемент", "элемента", "элементов"])}`,
        "success",
      );
    } else {
      showToast("Новых элементов нет", "info");
    }
  };

  const roll = () => {
    if (!items.length) {
      showToast("Сначала добавьте варианты", "warning");
      return;
    }
    normalizePool();
    const candidates = settings.noRepeat
      ? items.filter((item) => pool.includes(item.value))
      : items;
    if (!candidates.length) {
      showToast("Нет доступных вариантов", "info");
      updatePoolHint();
      updateRollAvailability();
      return;
    }
    updateRollAvailability();
    resultCard.classList.add("rolling");
    setTimeout(() => {
      resultCard.classList.remove("rolling");
      const picked = pickWeightedItem(candidates);
      if (!picked) {
        showToast("Нет доступных вариантов", "info");
        return;
      }

      const value = picked.value;
      picked.hits = getItemHits(picked) + 1;
      persistItems({ resetPool: false });
      if (settings.noRepeat) {
        state.consumeFromPool(value);
        syncState();
        updateSummary();
        updatePoolHint();
      }

      resultUI.setResult(
        value,
        new Intl.DateTimeFormat("ru-RU", {
          hour: "2-digit",
          minute: "2-digit",
          second: "2-digit",
        }).format(Date.now()),
      );
      resultUI.pulse();
      addHistoryEntry(value);
      renderItems();
    }, 350);
  };

  wireRollControls(wrapper, roll);

  wrapper.querySelector("#randomizer-add")?.addEventListener("click", () => {
    addItem(inputEl.value);
    if (inputEl.value.trim()) {
      showToast("Вариант добавлен", "success");
    }
    inputEl.value = "";
    inputEl.focus();
  });

  inputEl?.addEventListener("keydown", (event) => {
    if (event.key === "Enter") {
      event.preventDefault();
      addItem(inputEl.value);
      if (inputEl.value.trim()) {
        showToast("Вариант добавлен", "success");
      }
      inputEl.value = "";
    }
  });

  wrapper
    .querySelector("#randomizer-paste")
    ?.addEventListener("click", async () => {
      try {
        const text = await navigator.clipboard.readText();
        const entries = text
          .split(/[\n;,]/)
          .map((value) => value.trim())
          .filter(Boolean);
        if (!entries.length) {
          showToast("Буфер обмена пуст", "info");
          return;
        }
        const preview = entries.slice(0, 5).join("\n");
        const confirmText =
          entries.length > 5
            ? `${preview}\n...и ещё ${entries.length - 5} строк. Добавить?`
            : `${preview}\nДобавить эти строки?`;
        if (!confirm(confirmText)) return;
        bulkAdd(entries);
      } catch {
        showToast("Не удалось прочитать буфер обмена", "error");
      }
    });

  wrapper.querySelector("#randomizer-sample")?.addEventListener("click", () => {
    bulkAdd(DEFAULT_ITEMS);
  });

  wrapper
    .querySelector("#randomizer-copy")
    ?.addEventListener("click", async () => {
      if (!resultText.textContent) {
        showToast("Пока нечего копировать", "info");
        return;
      }
      try {
        await navigator.clipboard.writeText(resultText.textContent);
        showToast("Результат скопирован", "success");
      } catch {
        showToast("Не удалось скопировать результат", "error");
      }
    });

  wrapper
    .querySelector("#randomizer-history-clear")
    ?.addEventListener("click", () => {
      state.clearHistory();
      syncState();
      renderHistory();
    });

  wrapper
    .querySelector("#randomizer-export")
    ?.addEventListener("click", async () => {
      if (!items.length) {
        showToast("Список пуст", "info");
        return;
      }
      try {
        await navigator.clipboard.writeText(
          items.map((item) => item.value).join("\n"),
        );
        showToast("Список скопирован", "success");
      } catch {
        showToast("Не удалось скопировать список", "error");
      }
    });

  wrapper
    .querySelector("#randomizer-reset-pool")
    ?.addEventListener("click", () => {
      resetPool();
      showToast("Пул без повторов обновлён", "success");
    });

  poolRefreshBtn?.addEventListener("click", () => {
    resetPool();
    showToast("Пул без повторов обновлён", "success");
  });

  historyRunBtn?.addEventListener("click", roll);

  presetsUI.wire();

  listActionsUI = wireListActions({
    listActions: wrapper.querySelector(".randomizer-list-actions"),
    exportButton,
    bulkDeleteButton,
    clearButton: wrapper.querySelector("#randomizer-clear"),
    getItems: () => state.getState().items,
    getSelected: () => selectedItems,
    onExport: () => {},
    onBulkDelete: (selected) => {
      state.removeItems(selected);
      syncState();
      selectedItems.clear();
      renderItems();
      clearResult();
      showToast("Выбранные варианты удалены", "success");
    },
    onClear: () => {
      state.removeItems(
        new Set(state.getState().items.map((item) => item.value)),
      );
      syncState();
      selectedItems.clear();
      renderItems();
      clearResult();
      showToast("Список очищен", "success");
    },
    showToast,
  });

  noRepeatToggle.checked = !!settings.noRepeat;
  noRepeatToggle.addEventListener("change", () => {
    settings.noRepeat = noRepeatToggle.checked;
    persistSettings();
    resetPool();
  });

  renderItems();
  renderHistory();
  setTimeout(() => initTooltips(), 0);

  return wrapper;
}
