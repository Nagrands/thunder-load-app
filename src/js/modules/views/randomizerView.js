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

export default function renderRandomizerView() {
  let items = readJson(STORAGE_KEYS.ITEMS, DEFAULT_ITEMS);
  let history = readJson(STORAGE_KEYS.HISTORY, []);
  let settings = readJson(STORAGE_KEYS.SETTINGS, {
    noRepeat: true,
  });
  let pool = readJson(STORAGE_KEYS.POOL, []);
  if (!Array.isArray(pool)) pool = [];
  else pool = pool.filter((entry) => items.includes(entry));
  if (!pool.length) pool = [...items];

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
          <button type="button" class="btn btn-sm btn-ghost" id="randomizer-export" data-bs-toggle="tooltip" data-bs-placement="left" title="Скопировать все элементы в буфер">
            <i class="fa-solid fa-copy"></i>
          </button>
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

  const resetPool = () => {
    pool = [...items];
    saveJson(STORAGE_KEYS.POOL, pool);
  };

  const persistItems = () => {
    saveJson(STORAGE_KEYS.ITEMS, items);
    resetPool();
  };

  const persistHistory = () => {
    saveJson(STORAGE_KEYS.HISTORY, history);
  };

  const persistSettings = () => {
    saveJson(STORAGE_KEYS.SETTINGS, settings);
  };

  const renderItems = () => {
    listEl.innerHTML = "";
    if (!items.length) {
      const empty = document.createElement("p");
      empty.className = "placeholder";
      empty.textContent = "Пока нет вариантов. Добавьте несколько элементов.";
      listEl.appendChild(empty);
      setCountLabel();
      return;
    }

    const fragment = document.createDocumentFragment();
    items.forEach((item) => {
      const chip = document.createElement("div");
      chip.className = "randomizer-chip";
      const text = document.createElement("span");
      text.className = "text";
      text.textContent = item;
      const remove = document.createElement("button");
      remove.type = "button";
      remove.className = "chip-remove";
      remove.setAttribute("aria-label", `Удалить ${item}`);
      remove.innerHTML = '<i class="fa-solid fa-xmark"></i>';
      remove.addEventListener("click", () => {
        items = items.filter((value) => value !== item);
        persistItems();
        renderItems();
      });
      chip.append(text, remove);
      fragment.appendChild(chip);
    });
    listEl.appendChild(fragment);
    setCountLabel();
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

  const addItem = (value, silent = false) => {
    const normalized = value.trim();
    if (!normalized) {
      if (!silent) showToast("Введите текст варианта", "warning");
      return;
    }
    const exists = items.some(
      (item) => item.toLowerCase() === normalized.toLowerCase(),
    );
    if (exists) {
      if (!silent) showToast("Такой вариант уже есть", "info");
      return;
    }
    items.push(normalized);
    persistItems();
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
    resultCard.classList.add("rolling");
    setTimeout(() => {
      resultCard.classList.remove("rolling");
      let value;
      if (settings.noRepeat) {
        if (!pool.length) pool = [...items];
        const idx = Math.floor(Math.random() * pool.length);
        [value] = pool.splice(idx, 1);
        saveJson(STORAGE_KEYS.POOL, pool);
      } else {
        const idx = Math.floor(Math.random() * items.length);
        value = items[idx];
      }
      if (!value) return;
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
      persistItems();
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
        await navigator.clipboard.writeText(items.join("\n"));
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
