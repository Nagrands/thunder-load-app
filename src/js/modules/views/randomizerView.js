// src/js/modules/views/randomizerView.js

import { showToast } from "../toast.js";
import { initTooltips } from "../tooltipInitializer.js";

const STORAGE_KEYS = {
  ITEMS: "randomizerItems",
  HISTORY: "randomizerHistory",
  SETTINGS: "randomizerSettings",
  POOL: "randomizerPool",
};

const DEFAULT_ITEMS = [
  "Новый ролик с YouTube",
  "Клип с Twitch",
  "Видео из VK",
  "Музыкальный трек",
  "Файл для резервной копии",
];

const MAX_HISTORY = 15;
const WEIGHT_MIN = 1;
const WEIGHT_MAX = 10;
const DEFAULT_WEIGHT = 1;
const MAX_ITEM_LENGTH = 160;

const cloneValue = (value) =>
  Array.isArray(value)
    ? value.slice()
    : typeof value === "object" && value !== null
      ? { ...value }
      : value;

const readJson = (key, fallback) => {
  try {
    const raw = localStorage.getItem(key);
    if (!raw) return cloneValue(fallback);
    const parsed = JSON.parse(raw);
    return Array.isArray(fallback)
      ? Array.isArray(parsed)
        ? parsed
        : cloneValue(fallback)
      : { ...cloneValue(fallback), ...(parsed || {}) };
  } catch {
    return cloneValue(fallback);
  }
};

const saveJson = (key, value) => {
  try {
    localStorage.setItem(key, JSON.stringify(value));
  } catch (error) {
    console.warn("[Randomizer] Unable to persist", key, error);
  }
};

const clampWeight = (raw) => {
  const n = Number(raw);
  if (!Number.isFinite(n)) return DEFAULT_WEIGHT;
  return Math.min(WEIGHT_MAX, Math.max(WEIGHT_MIN, Math.round(n)));
};

const normalizeItems = (rawItems) => {
  const list = Array.isArray(rawItems) ? rawItems : [];
  const seen = new Set();
  const normalized = [];

  list.forEach((entry) => {
    const rawValue =
      typeof entry === "string" ? entry : typeof entry?.value === "string" ? entry.value : "";
    const value = rawValue.trim();
    if (!value) return;
    const key = value.toLowerCase();
    if (seen.has(key)) return;
    seen.add(key);
    const weight = clampWeight(
      typeof entry === "object" && entry !== null ? entry.weight : DEFAULT_WEIGHT,
    );
    normalized.push({ value, weight });
  });

  if (!normalized.length) {
    return DEFAULT_ITEMS.map((value) => ({ value, weight: DEFAULT_WEIGHT }));
  }

  return normalized;
};

export default function renderRandomizerView() {
  let items = normalizeItems(readJson(STORAGE_KEYS.ITEMS, DEFAULT_ITEMS));
  let history = readJson(STORAGE_KEYS.HISTORY, []);
  let settings = readJson(STORAGE_KEYS.SETTINGS, {
    noRepeat: true,
  });
  let pool = readJson(STORAGE_KEYS.POOL, []);
  let selectedItems = new Set();
  if (!Array.isArray(pool)) pool = [];
  else
    pool = pool.filter((entry) =>
      items.some((item) => item.value === entry),
    );
  if (!pool.length) pool = items.map((item) => item.value);

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
        <div class="randomizer-add-row">
          <input
            type="text"
            id="randomizer-input"
            placeholder="Например, &quot;Плейлист с YouTube&quot;"
            maxlength="160"
          />
          <button type="button" class="btn btn-primary" id="randomizer-add">
            <i class="fa-solid fa-plus"></i>
            <span>Добавить</span>
          </button>
        </div>
        <div class="randomizer-editor-actions">
          <button type="button" class="btn btn-ghost" id="randomizer-paste">
            <i class="fa-solid fa-paste"></i>
            <span>Вставить список</span>
          </button>
          <button type="button" class="btn btn-ghost" id="randomizer-sample">
            <i class="fa-solid fa-list-check"></i>
            <span>Пример</span>
          </button>
          <button type="button" class="btn btn-ghost danger" id="randomizer-clear">
            <i class="fa-solid fa-broom"></i>
            <span>Очистить</span>
          </button>
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
        <div id="randomizer-list" class="randomizer-list" aria-live="polite"></div>
      </section>

      <section class="randomizer-card randomizer-result-card">
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
      </section>

      <section class="randomizer-card randomizer-history-card">
        <header>
          <p class="eyebrow">История</p>
          <h3>Последние результаты</h3>
        </header>
        <div id="randomizer-history" class="randomizer-history">
          <p id="randomizer-history-empty" class="placeholder">Ещё ничего не выбрано.</p>
          <ul id="randomizer-history-list"></ul>
        </div>
        <div class="randomizer-history-actions">
          <button type="button" class="btn btn-ghost" id="randomizer-history-clear">
            <i class="fa-solid fa-trash"></i>
            <span>Очистить историю</span>
          </button>
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

  const savePool = () => {
    saveJson(STORAGE_KEYS.POOL, pool);
  };

  const normalizePool = () => {
    pool = (Array.isArray(pool) ? pool : []).filter((value) =>
      items.some((item) => item.value === value),
    );
    if (!pool.length) {
      pool = items.map((item) => item.value);
    }
    savePool();
  };

  const resetPool = () => {
    pool = items.map((item) => item.value);
    savePool();
  };

  const persistItems = (options = {}) => {
    const { resetPool: shouldResetPool = false } = options;
    saveJson(STORAGE_KEYS.ITEMS, items);
    if (shouldResetPool) resetPool();
    else savePool();
  };

  const persistHistory = () => {
    saveJson(STORAGE_KEYS.HISTORY, history);
  };

  const persistSettings = () => {
    saveJson(STORAGE_KEYS.SETTINGS, settings);
  };

  normalizePool();

  const pruneSelection = () => {
    selectedItems = new Set(
      [...selectedItems].filter((value) =>
        items.some((item) => item.value === value),
      ),
    );
  };

  const updateBulkActions = () => {
    pruneSelection();
    if (bulkDeleteButton) {
      bulkDeleteButton.disabled = selectedItems.size === 0;
      bulkDeleteButton.classList.toggle("hidden", items.length === 0);
      const label = bulkDeleteButton.querySelector("span");
      if (label) {
        label.textContent =
          selectedItems.size > 0
            ? `Удалить (${selectedItems.size})`
            : "Удалить выбранные";
      }
    }
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
    const idx = items.findIndex((entry) => entry.value === oldValue);
    if (idx === -1) return false;
    const current = items[idx];
    items.splice(idx, 1, { ...current, value: trimmed });

    pool = pool.map((value) => (value === oldValue ? trimmed : value));

    if (selectedItems.has(oldValue)) {
      selectedItems.delete(oldValue);
      selectedItems.add(trimmed);
    }
    persistItems({ resetPool: false });
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
    if (!fromValue || !toValue || fromValue === toValue) return;
    const fromIndex = items.findIndex((entry) => entry.value === fromValue);
    const toIndex = items.findIndex((entry) => entry.value === toValue);
    if (fromIndex === -1 || toIndex === -1) return;
    const [moved] = items.splice(fromIndex, 1);
    items.splice(toIndex, 0, moved);
    persistItems({ resetPool: false });
    renderItems();
  };

  const renderItems = () => {
    pruneSelection();
    listEl.innerHTML = "";
    if (!items.length) {
      const empty = document.createElement("p");
      empty.className = "placeholder";
      empty.textContent = "Пока нет вариантов. Добавьте несколько элементов.";
      listEl.appendChild(empty);
      setCountLabel();
      updateBulkActions();
      return;
    }

    const fragment = document.createDocumentFragment();
    let dragSource = null;

    items.forEach((item) => {
      const chip = document.createElement("div");
      chip.className = "randomizer-chip";
      chip.draggable = true;
      chip.dataset.value = item.value;

      const text = document.createElement("span");
      text.className = "text";
      text.textContent = item.value;

      const weightWrap = document.createElement("div");
      weightWrap.className = "chip-weight";
      const weightSlider = document.createElement("input");
      weightSlider.type = "range";
      weightSlider.min = WEIGHT_MIN;
      weightSlider.max = WEIGHT_MAX;
      weightSlider.step = 1;
      weightSlider.value = getItemWeight(item);
      weightSlider.className = "chip-weight-slider";

      const weightNumber = document.createElement("input");
      weightNumber.type = "number";
      weightNumber.min = WEIGHT_MIN;
      weightNumber.max = WEIGHT_MAX;
      weightNumber.step = 1;
      weightNumber.value = getItemWeight(item);
      weightNumber.className = "chip-weight-number";

      const weightLabel = document.createElement("span");
      weightLabel.className = "chip-weight-label";
      weightLabel.textContent = `x${getItemWeight(item)}`;

      const syncWeight = (nextWeight) => {
        const sanitized = clampWeight(nextWeight);
        if (sanitized === getItemWeight(item)) {
          weightSlider.value = sanitized;
          weightNumber.value = sanitized;
          weightLabel.textContent = `x${sanitized}`;
          return;
        }
        item.weight = sanitized;
        weightSlider.value = sanitized;
        weightNumber.value = sanitized;
        weightLabel.textContent = `x${sanitized}`;
        persistItems({ resetPool: false });
        renderItems();
      };

      const stopChipEvent = (event) => event.stopPropagation();
      weightSlider.addEventListener("click", stopChipEvent);
      weightSlider.addEventListener("input", (event) => {
        event.stopPropagation();
        syncWeight(event.target.value);
      });
      weightNumber.addEventListener("click", stopChipEvent);
      weightNumber.addEventListener("input", (event) => {
        event.stopPropagation();
        syncWeight(event.target.value);
      });
      weightLabel.addEventListener("click", stopChipEvent);
      weightWrap.append(weightSlider, weightNumber, weightLabel);

      const remove = document.createElement("button");
      remove.type = "button";
      remove.className = "chip-remove";
      remove.setAttribute("aria-label", `Удалить ${item.value}`);
      remove.innerHTML = '<i class="fa-solid fa-xmark"></i>';
      remove.addEventListener("click", () => {
        items = items.filter((entry) => entry.value !== item.value);
        selectedItems.delete(item.value);
        pool = pool.filter((entry) => entry !== item.value);
        persistItems({ resetPool: false });
        renderItems();
      });

      chip.append(text, weightWrap, remove);

      chip.addEventListener("click", (event) => {
        if (event.detail > 1) return;
        if (event.target.closest(".chip-remove")) return;
        if (event.target.classList.contains("chip-edit-input")) return;
        toggleSelection(item.value, chip);
      });

      chip.addEventListener("dblclick", () => startInlineEdit(chip, item.value));

      chip.addEventListener("dragstart", (event) => {
        dragSource = item.value;
        chip.classList.add("dragging");
        event.dataTransfer?.setData("text/plain", item.value);
        event.dataTransfer?.setDragImage(chip, 10, 10);
      });

      chip.addEventListener("dragend", () => {
        dragSource = null;
        chip.classList.remove("dragging");
        chip.classList.remove("drop-target");
      });

      chip.addEventListener("dragover", (event) => {
        if (!dragSource || dragSource === item) return;
        event.preventDefault();
        chip.classList.add("drop-target");
      });

      chip.addEventListener("dragleave", () => {
        chip.classList.remove("drop-target");
      });

      chip.addEventListener("drop", (event) => {
        event.preventDefault();
        chip.classList.remove("drop-target");
        if (!dragSource || dragSource === item.value) return;
        moveItem(dragSource, item.value);
      });

      if (selectedItems.has(item.value)) chip.classList.add("selected");
      fragment.appendChild(chip);
    });

    listEl.appendChild(fragment);
    setCountLabel();
    updateBulkActions();
  };

  const renderHistory = () => {
    historyList.innerHTML = "";
    if (!history.length) {
      historyEmpty.classList.remove("hidden");
      return;
    }
    historyEmpty.classList.add("hidden");
    const fragment = document.createDocumentFragment();
    history.forEach((entry) => {
      const li = document.createElement("li");
      const button = document.createElement("button");
      button.type = "button";
      button.className = "history-entry";
      button.dataset.value = entry.value;
      button.innerHTML = `
        <span class="text">${escapeHtml(entry.value)}</span>
        <span class="time">${new Intl.DateTimeFormat("ru-RU", {
          hour: "2-digit",
          minute: "2-digit",
        }).format(entry.ts)}</span>
      `;
      button.addEventListener("click", () => {
        resultText.textContent = entry.value;
        resultMeta.textContent = "Выбрано ранее";
        activateResultCard();
      });
      li.appendChild(button);
      fragment.appendChild(li);
    });
    historyList.appendChild(fragment);
  };

  const activateResultCard = () => {
    resultCard.classList.add("active");
    resultContainer.classList.add("has-result");
  };

  const clearResult = () => {
    resultText.textContent = "";
    resultMeta.textContent = "";
    resultCard.classList.remove("active");
    resultContainer.classList.remove("has-result");
  };

  const addHistoryEntry = (value) => {
    history.unshift({ value, ts: Date.now() });
    history = history.slice(0, MAX_HISTORY);
    persistHistory();
    renderHistory();
  };

  const getItemWeight = (item) => clampWeight(item?.weight ?? DEFAULT_WEIGHT);

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
    const newItem = { value: normalized, weight: DEFAULT_WEIGHT };
    items.push(newItem);
    pool.push(newItem.value);
    persistItems({ resetPool: false });
    renderItems();
  };

  const bulkAdd = (values) => {
    let added = 0;
    values.forEach((value) => {
      const before = items.length;
      addItem(value, true);
      if (items.length > before) added += 1;
    });
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
      return;
    }
    resultCard.classList.add("rolling");
    setTimeout(() => {
      resultCard.classList.remove("rolling");
      const picked = pickWeightedItem(candidates);
      if (!picked) {
        showToast("Нет доступных вариантов", "info");
        return;
      }

      const value = picked.value;
      if (settings.noRepeat) {
        pool = pool.filter((entry) => entry !== value);
        savePool();
      }

      resultText.textContent = value;
      resultMeta.textContent = new Intl.DateTimeFormat("ru-RU", {
        hour: "2-digit",
        minute: "2-digit",
        second: "2-digit",
      }).format(Date.now());
      activateResultCard();
      addHistoryEntry(value);
    }, 350);
  };

  wrapper
    .querySelectorAll(".randomizer-roll")
    .forEach((btn) => btn.addEventListener("click", roll));

  wrapper
    .querySelectorAll("#randomizer-roll, #randomizer-roll-hero")
    .forEach((btn) =>
      btn.addEventListener("keyup", (e) => {
        if (e.key === "Enter" || e.key === " ") {
          e.preventDefault();
          roll();
        }
      }),
    );

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

  wrapper.querySelector("#randomizer-clear")?.addEventListener("click", () => {
    if (!items.length) return;
    if (confirm("Очистить все варианты? Действие нельзя отменить.")) {
      items = [];
      selectedItems.clear();
      pool = [];
      persistItems({ resetPool: false });
      renderItems();
      clearResult();
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
      history = [];
      persistHistory();
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

  bulkDeleteButton?.addEventListener("click", () => {
    if (!selectedItems.size) {
      showToast("Не выбрано ни одного варианта", "info");
      return;
    }
    if (
      !confirm(
        `Удалить ${selectedItems.size} ${declOfNum(selectedItems.size, [
          "вариант",
          "варианта",
          "вариантов",
        ])}?`,
      )
    )
      return;
    items = items.filter((item) => !selectedItems.has(item.value));
    pool = pool.filter((value) => !selectedItems.has(value));
    selectedItems.clear();
    persistItems({ resetPool: false });
    renderItems();
    clearResult();
    showToast("Выбранные варианты удалены", "success");
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

function declOfNum(n, titles) {
  const cases = [2, 0, 1, 1, 1, 2];
  return titles[
    n % 100 > 4 && n % 100 < 20 ? 2 : cases[n % 10 < 5 ? n % 10 : 5]
  ];
}

function escapeHtml(str) {
  const div = document.createElement("div");
  div.textContent = str;
  return div.innerHTML;
}
