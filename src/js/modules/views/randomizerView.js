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
  clampMisses,
  declOfNum,
  clampRareThreshold,
  RARE_STREAK,
} from "../randomizer/helpers.js";
import { createRandomizerState } from "../randomizer/state.js";
import { createSummary } from "../randomizer/ui/summary.js";
import { createHistoryRenderer } from "../randomizer/ui/history.js";
import { createItemsRenderer } from "../randomizer/ui/items.js";
import { createResultUI } from "../randomizer/ui/result.js";
import { createPresetsUI } from "../randomizer/ui/presets.js";
import { wireRollControls } from "../randomizer/ui/controls.js";
import { wireListActions } from "../randomizer/ui/listActions.js";

// NOTE: функция навешивает document-level listeners.
// Используется один раз на view, при размонтировании потребуется cleanup.
// Lightweight clone of backup select styling
const enhanceSelect = (selectEl) => {
  if (!selectEl || selectEl.dataset.enhanced === "true") return null;
  selectEl.dataset.enhanced = "true";

  const wrapper = document.createElement("div");
  wrapper.className = "bk-select-wrapper";
  const trigger = document.createElement("button");
  trigger.type = "button";
  trigger.className = "bk-select-trigger";
  const labelEl = document.createElement("span");
  labelEl.className = "bk-select-label";
  const icon = document.createElement("i");
  icon.className = "fa-solid fa-chevron-down";
  trigger.append(labelEl, icon);

  const menu = document.createElement("div");
  menu.className = "bk-select-menu";
  menu.hidden = true;

  const updateLabel = () => {
    const opt =
      selectEl.selectedOptions && selectEl.selectedOptions[0]
        ? selectEl.selectedOptions[0]
        : selectEl.options[selectEl.selectedIndex];
    labelEl.textContent = opt ? opt.textContent : "";
    menu
      .querySelectorAll(".bk-select-option")
      .forEach((item) =>
        item.classList.toggle(
          "is-active",
          item.dataset.value === selectEl.value,
        ),
      );
  };

  const rebuild = () => {
    menu.innerHTML = "";
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
    updateLabel();
  };

  const closeAll = (e) => {
    if (e && wrapper.contains(e.target)) return;
    menu.hidden = true;
    wrapper.classList.remove("is-open");
  };

  trigger.addEventListener("click", (e) => {
    e.stopPropagation();
    const willOpen = menu.hidden;
    document
      .querySelectorAll(".bk-select-wrapper.is-open .bk-select-menu")
      .forEach((m) => {
        m.hidden = true;
        m.parentElement?.classList.remove("is-open");
      });
    if (willOpen) {
      menu.hidden = false;
      wrapper.classList.add("is-open");
    } else {
      closeAll();
    }
  });

  document.addEventListener("mousedown", closeAll);
  document.addEventListener("focusin", closeAll);
  trigger.addEventListener("keydown", (e) => {
    if (e.key === "Escape") closeAll();
    if (e.key === "ArrowDown" || e.key === "ArrowUp") {
      e.preventDefault();
      menu.hidden = false;
      wrapper.classList.add("is-open");
    }
  });

  selectEl.classList.add("bk-select-hidden");
  selectEl.parentNode.insertBefore(wrapper, selectEl);
  wrapper.append(trigger, selectEl, menu);
  rebuild();

  return { rebuild, updateLabel };
};

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
  let favoritesOnly = false;
  let rareOnly = false;
  let searchQuery = "";
  let sortMode = "order";

  const sortByMode = (list) => {
    const itemsCopy = list.slice();
    switch (sortMode) {
      case "alpha":
        return itemsCopy.sort((a, b) =>
          a.value.localeCompare(b.value, "ru", { sensitivity: "base" }),
        );
      case "weight":
        return itemsCopy.sort(
          (a, b) => clampWeight(b.weight) - clampWeight(a.weight),
        );
      case "rare":
        return itemsCopy.sort(
          (a, b) => clampMisses(b.misses || 0) - clampMisses(a.misses || 0),
        );
      default:
        return itemsCopy;
    }
  };
  let renderHistory = () => {};
  const getRareThreshold = () =>
    clampRareThreshold(settings?.rareThreshold ?? RARE_STREAK);
  const normalizeSortMode = (value) =>
    ["order", "alpha", "weight", "rare"].includes(value) ? value : "order";
  const isSearchActive = () => (searchQuery || "").trim().length > 0;

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
  state.normalizePool(); // normalizePool мутирует state, поэтому перечитываем значения
  syncState();
  settings.rareThreshold = getRareThreshold();
  favoritesOnly = !!settings.favoritesOnly;
  rareOnly = !!settings.rareOnly;
  settings.statsTab =
    settings.statsTab === "history" || settings.statsTab === "stats"
      ? settings.statsTab
      : "stats";

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
        <div class="randomizer-hero-meta">
          <div class="randomizer-auto-chip" id="randomizer-auto-chip">
            <div class="chip-label">Авто</div>
            <div class="chip-value" id="randomizer-auto-status-mini">Авто выключен</div>
            <div class="chip-sub">
              Следующий через <span id="randomizer-auto-countdown-mini">—</span>
            </div>
            <button type="button" class="btn btn-sm btn-ghost" id="randomizer-auto-toggle-hero">
              <i class="fa-solid fa-clock-rotate-left"></i>
              <span>Старт</span>
            </button>
          </div>
          <div class="randomizer-hero-actions">
            <button type="button" class="btn btn-primary randomizer-roll" id="randomizer-roll-hero">
              <i class="fa-solid fa-dice"></i>
              <span class="btn-spinner" aria-hidden="true"></span>
              <span>Запустить</span>
            </button>
            <button type="button" class="btn btn-ghost" id="randomizer-reset-pool" data-bs-toggle="tooltip" data-bs-placement="bottom" title="Очистить пул без повторов">
              <i class="fa-solid fa-arrows-rotate"></i>
              <span>Сбросить пул</span>
            </button>
            <button type="button" class="btn btn-ghost mobile-only" id="randomizer-toggle-list" data-state="shown">
              <i class="fa-solid fa-list"></i>
              <span>Скрыть список</span>
            </button>
          </div>
        </div>
      </div>

    <div class="randomizer-summary" id="randomizer-summary">
      <div class="summary-item">
        <span class="label">Шаблон</span>
        <div class="summary-main">
          <strong id="randomizer-summary-preset">—</strong>
          <span class="summary-pill hidden" id="randomizer-summary-default-badge">По умолчанию</span>
        </div>
      </div>
      <div class="summary-item">
        <span class="label">Варианты</span>
        <strong id="randomizer-summary-count">0</strong>
      </div>
      <div class="summary-item">
        <span class="label">Таймер / Авто</span>
        <label
          class="spin-control"
          data-bs-toggle="tooltip"
          data-bs-placement="bottom"
          title="Длительность анимации перед выбором и интервал автозапуска (до 60 секунд)"
        >
          <span class="spin-input">
            <input type="number" id="randomizer-spin-seconds" min="0" max="60" step="0.1" />
            <span class="unit">сек</span>
          </span>
          <span
            class="spin-countdown"
            id="randomizer-spin-countdown"
            aria-live="polite"
            aria-label="Обратный отсчёт"
          >
            <i class="fa-solid fa-clock"></i>
            <span class="value">—</span>
          </span>
        </label>
      </div>
    </div>

    <div class="randomizer-visuals" id="randomizer-visuals">
      <div class="visual-card">
        <div class="visual-header">
          <span class="label">Пул</span>
          <span class="value" id="randomizer-pool-progress-value">—</span>
        </div>
        <div class="pool-progress">
          <div class="pool-progress-bar">
            <span class="fill" id="randomizer-pool-progress"></span>
          </div>
        </div>
      </div>
      <div class="visual-card">
        <div class="visual-header">
          <span class="label">Редкость</span>
          <span class="value">Промахи</span>
        </div>
        <div class="sparkline" id="randomizer-sparkline" aria-label="Спарклайн промахов по вариантам"></div>
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
        <div class="preset-actions">
          <div class="preset-primary">
            <button type="button" class="btn btn-sm btn-primary" id="randomizer-preset-save" data-bs-toggle="tooltip" data-bs-placement="top" title="Сохранить текущий шаблон">
              <i class="fa-solid fa-floppy-disk"></i>
              <span>Сохранить</span>
            </button>
            <button type="button" class="btn btn-sm btn-ghost" id="randomizer-preset-new" data-bs-toggle="tooltip" data-bs-placement="top" title="Создать новый пустой шаблон">
              <i class="fa-solid fa-file-circle-plus"></i>
              <span>Новый</span>
            </button>
          </div>
          <div class="preset-secondary">
            <button type="button" class="btn btn-sm btn-ghost" id="randomizer-preset-default" data-bs-toggle="tooltip" data-bs-placement="top" title="Сделать шаблон стартовым">
              <i class="fa-solid fa-star"></i>
              <span>По умолчанию</span>
            </button>
            <button type="button" class="btn btn-sm btn-ghost" id="randomizer-preset-save-as" data-bs-toggle="tooltip" data-bs-placement="top" title="Сохранить как новый шаблон">
              <i class="fa-solid fa-copy"></i>
              <span>Сохранить как</span>
            </button>
            <button type="button" class="btn btn-sm btn-ghost danger" id="randomizer-preset-delete" data-bs-toggle="tooltip" data-bs-placement="top" title="Удалить выбранный шаблон">
              <i class="fa-solid fa-trash"></i>
              <span>Удалить</span>
            </button>
          </div>
        </div>
        </div>
        <div class="randomizer-toolbar">
          <label class="randomizer-search">
            <i class="fa-solid fa-magnifying-glass"></i>
            <input
              type="search"
              id="randomizer-search"
              placeholder="Поиск по вариантам"
              autocomplete="off"
            />
          </label>
          <label class="randomizer-sort">
            <span>Сортировка</span>
            <select id="randomizer-sort">
              <option value="order">По порядку</option>
              <option value="alpha">А–Я</option>
              <option value="weight">По весу</option>
              <option value="rare">Редкие</option>
            </select>
          </label>
        </div>
        <div class="randomizer-add-row">
          <textarea
            id="randomizer-input"
            placeholder="Добавляйте свои варианты. Каждый новый вариант — это отдельная строка. Можно использовать точку с запятой для разделения.
"
            rows="3"
          ></textarea>
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
          <div class="randomizer-list-heading">
            <span id="randomizer-count">0 вариантов</span>
            <span class="list-sub">Фильтры и действия ниже</span>
          </div>
          <div class="randomizer-list-actions">
            <div class="list-actions-group">
              <span class="group-label">Фильтры</span>
              <label class="stat-threshold" title="Порог редкости (промахи)">
                <span>Порог:</span>
                <input type="number" id="randomizer-rare-threshold" min="1" max="9999" />
              </label>
              <button type="button" class="btn btn-sm btn-ghost" id="randomizer-fav-filter" data-state="all" data-bs-toggle="tooltip" data-bs-placement="left" title="Показывать только избранные варианты">
                <i class="fa-solid fa-star"></i>
                <span>Все</span>
              </button>
            </div>
            <div class="list-actions-group">
              <span class="group-label">Действия</span>
              <button type="button" class="btn btn-sm btn-ghost" id="randomizer-export" data-bs-toggle="tooltip" data-bs-placement="left" title="Скопировать все элементы в буфер">
                <i class="fa-solid fa-copy"></i>
              </button>
              <button type="button" class="btn btn-sm btn-ghost" id="randomizer-clear-favorites" data-bs-toggle="tooltip" data-bs-placement="left" title="Снять отметку избранного со всех вариантов">
                <i class="fa-solid fa-star-half-stroke"></i>
              </button>
              <button type="button" class="btn btn-sm btn-ghost" id="randomizer-clear-excluded" data-bs-toggle="tooltip" data-bs-placement="left" title="Вернуть исключённые варианты в пул">
                <i class="fa-solid fa-eye"></i>
              </button>
              <button type="button" class="btn btn-sm btn-ghost danger" id="randomizer-delete-selected" data-bs-toggle="tooltip" data-bs-placement="left" title="Удалить выбранные варианты">
                <i class="fa-solid fa-trash"></i>
                <span></span>
              </button>
            </div>
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
          </header>
          <div class="randomizer-result-actions">
            <button type="button" class="btn btn-primary randomizer-roll" id="randomizer-roll">
              <i class="fa-solid fa-dice"></i>
              <span class="btn-spinner" aria-hidden="true"></span>
              <span>Запустить</span>
            </button>
            <button type="button" class="btn btn-ghost" id="randomizer-copy" data-bs-toggle="tooltip" data-bs-placement="top" title="Скопировать результат">
              <i class="fa-solid fa-copy"></i>
            </button>
          </div>
          <div class="randomizer-result" id="randomizer-result">
            <div class="placeholder">
              <i class="fa-solid fa-dice"></i>
              <p>Добавьте варианты и нажмите «Запустить»</p>
            </div>
            <div class="result-value" id="randomizer-result-text"></div>
            <p class="result-meta" id="randomizer-result-meta"></p>
          </div>
        </div>

        <div class="randomizer-auto-card" id="randomizer-auto-card">
          <header>
            <div>
              <p class="eyebrow">Авто-запуск</p>
            </div>
            <div class="auto-status" id="randomizer-auto-status">Авто-ролл выключен</div>
          </header>
          <div class="randomizer-auto-grid">
            <label class="auto-field">
              <span class="label">Стоп-условие</span>
              <select id="randomizer-auto-stop-mode">
                <option value="none">Только вручную</option>
                <option value="count">После N запусков</option>
                <option value="match">При совпадении текста</option>
              </select>
            </label>
            <label class="auto-field stop-extra" data-stop-extra="count">
              <span class="label">Количество</span>
              <input type="number" id="randomizer-auto-stop-count" min="1" max="9999" step="1" />
            </label>
            <label class="auto-field stop-extra" data-stop-extra="match">
              <span class="label">Искомый фрагмент</span>
              <input type="text" id="randomizer-auto-stop-text" maxlength="120" placeholder="Например, стрим" />
            </label>
            <label class="auto-toggle">
              <input type="checkbox" id="randomizer-auto-stop-pool" />
              <span>Стоп при пустом пуле</span>
            </label>
            <label class="auto-toggle">
              <input type="checkbox" id="randomizer-auto-notify-sound" />
              <span>Звук результата</span>
            </label>
            <label class="auto-toggle">
              <input type="checkbox" id="randomizer-auto-notify-flash" />
              <span>Визуальная вспышка</span>
            </label>
          </div>
          <div class="randomizer-auto-actions">
            <button type="button" class="btn btn-primary" id="randomizer-auto-toggle">
              <i class="fa-solid fa-clock-rotate-left"></i>
              <span>Старт таймера</span>
            </button>
            <button type="button" class="btn btn-ghost" id="randomizer-auto-run-once" data-bs-toggle="tooltip" data-bs-placement="top" title="Запустить сейчас">
              <i class="fa-solid fa-bolt"></i>
            </button>
          </div>
        </div>

        <div class="outcome-divider"></div>

        <div class="randomizer-history-card">
          <header>
            <div>
              <p class="eyebrow">История</p>
              <h3>Последние результаты</h3>
            </div>
            <div class="history-tabs">
              <button type="button" class="btn btn-sm btn-ghost is-active" id="randomizer-tab-history" data-target="history" data-bs-toggle="tooltip" data-bs-placement="top" title="История">
                <i class="fa-solid fa-clock-rotate-left"></i>
                <span>История</span>
              </button>
              <button type="button" class="btn btn-sm btn-ghost" id="randomizer-tab-stats" data-target="stats" data-bs-toggle="tooltip" data-bs-placement="top" title="Статистика">
                <i class="fa-solid fa-chart-line"></i>
                <span>Статистика</span>
              </button>
            </div>
          </header>
          <div class="history-panel hidden" id="randomizer-history-panel" data-tab="history">
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
        <div class="history-panel" id="randomizer-stats-panel" data-tab="stats">
          <div class="history-controls">
            <button type="button" class="btn btn-sm btn-ghost" id="randomizer-history-rare-toggle" data-state="all" data-bs-toggle="tooltip" data-bs-placement="top" title="Показать только редкие (долго не выпадали)">
              <i class="fa-solid fa-star-half-stroke"></i>
              <span>Все</span>
            </button>
            <button type="button" class="btn btn-sm btn-ghost" id="randomizer-stats-export" data-bs-toggle="tooltip" data-bs-placement="top" title="Скопировать статистику в буфер">
              <i class="fa-solid fa-file-export"></i>
            </button>
            <button type="button" class="btn btn-sm btn-ghost danger" id="randomizer-stats-reset" data-bs-toggle="tooltip" data-bs-placement="top" title="Сбросить счётчики выпадений и промахов">
              <i class="fa-solid fa-eraser"></i>
            </button>
          </div>
          <div class="randomizer-stats" id="randomizer-stats"></div>
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
  const statsTable = wrapper.querySelector("#randomizer-stats");
  const rareToggleBtn = wrapper.querySelector(
    "#randomizer-history-rare-toggle",
  );
  const rareThresholdInput = wrapper.querySelector(
    "#randomizer-rare-threshold",
  );
  const statsExportBtn = wrapper.querySelector("#randomizer-stats-export");
  const statsResetBtn = wrapper.querySelector("#randomizer-stats-reset");
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
  const summaryPoolEl = wrapper.querySelector("#randomizer-summary-pool");
  const summaryPoolModeEl = wrapper.querySelector(
    "#randomizer-summary-pool-mode",
  );
  const summaryDefaultBadgeEl = wrapper.querySelector(
    "#randomizer-summary-default-badge",
  );
  const poolProgressFill = wrapper.querySelector("#randomizer-pool-progress");
  const poolProgressValue = wrapper.querySelector(
    "#randomizer-pool-progress-value",
  );
  const sparklineEl = wrapper.querySelector("#randomizer-sparkline");
  const presetSaveBtn = wrapper.querySelector("#randomizer-preset-save");
  const presetNewBtn = wrapper.querySelector("#randomizer-preset-new");
  const presetSaveAsBtn = wrapper.querySelector("#randomizer-preset-save-as");
  const presetDeleteBtn = wrapper.querySelector("#randomizer-preset-delete");
  const presetDefaultBtn = wrapper.querySelector("#randomizer-preset-default");
  const favFilterBtn = wrapper.querySelector("#randomizer-fav-filter");
  const clearFavoritesBtn = wrapper.querySelector(
    "#randomizer-clear-favorites",
  );
  const clearExcludedBtn = wrapper.querySelector("#randomizer-clear-excluded");
  const historyTabs = {
    history: wrapper.querySelector("#randomizer-tab-history"),
    stats: wrapper.querySelector("#randomizer-tab-stats"),
  };
  const historyPanels = {
    history: wrapper.querySelector("#randomizer-history-panel"),
    stats: wrapper.querySelector("#randomizer-stats-panel"),
  };
  let presetPromptEl = null;
  const historyRunBtn = wrapper.querySelector("#randomizer-history-run");
  let listActionsUI = null;
  let carouselTimer = null;
  const spinDurationInput = wrapper.querySelector("#randomizer-spin-seconds");
  const spinCountdownEl = wrapper.querySelector("#randomizer-spin-countdown");
  const spinCountdownValueEl = spinCountdownEl?.querySelector(".value");
  let spinCountdownTimer = null;
  const autoToggleBtn = wrapper.querySelector("#randomizer-auto-toggle");
  const autoToggleHeroBtn = wrapper.querySelector(
    "#randomizer-auto-toggle-hero",
  );
  const autoRunOnceBtn = wrapper.querySelector("#randomizer-auto-run-once");
  const autoStatusEl = wrapper.querySelector("#randomizer-auto-status");
  const autoChipEl = wrapper.querySelector("#randomizer-auto-chip");
  const autoStatusMiniEl = wrapper.querySelector(
    "#randomizer-auto-status-mini",
  );
  const autoCountdownMiniEl = wrapper.querySelector(
    "#randomizer-auto-countdown-mini",
  );
  const autoStopModeSelect = wrapper.querySelector(
    "#randomizer-auto-stop-mode",
  );
  const autoStopCountInput = wrapper.querySelector(
    "#randomizer-auto-stop-count",
  );
  const autoStopTextInput = wrapper.querySelector("#randomizer-auto-stop-text");
  const autoStopPoolToggle = wrapper.querySelector(
    "#randomizer-auto-stop-pool",
  );
  const autoNotifySoundToggle = wrapper.querySelector(
    "#randomizer-auto-notify-sound",
  );
  const autoNotifyFlashToggle = wrapper.querySelector(
    "#randomizer-auto-notify-flash",
  );
  const autoStopExtras = wrapper.querySelectorAll(".stop-extra");
  const autoStopSelectUI = enhanceSelect(autoStopModeSelect);
  const toggleListBtn = wrapper.querySelector("#randomizer-toggle-list");
  const searchInput = wrapper.querySelector("#randomizer-search");
  const sortSelect = wrapper.querySelector("#randomizer-sort");
  const sortSelectUI = enhanceSelect(sortSelect);
  let autoTimer = null;
  let autoRuns = 0;
  let autoStatusTimer = null;
  let lastResultValue = "";
  let autoEnabled = false;
  let autoNextAt = null;
  let isRolling = false;
  let flashTimer = null;
  let audioContext = null;
  let isListHidden = false;

  const getBaseVisibleItems = () =>
    favoritesOnly ? items.filter((item) => item.favorite) : items;
  const applySearchFilter = (list) => {
    if (!isSearchActive()) return list;
    const needle = searchQuery.trim().toLowerCase();
    return list.filter((item) => item.value.toLowerCase().includes(needle));
  };
  const getDisplayItems = () =>
    sortByMode(applySearchFilter(getBaseVisibleItems()));
  const setCountLabel = () => {
    const base = getBaseVisibleItems();
    const visible = getDisplayItems();
    const isEmpty = visible.length === 0;
    const baseLabel = isEmpty
      ? favoritesOnly
        ? "Избранных нет"
        : "Список пуст"
      : visible.length === 1
        ? "1 вариант"
        : `${visible.length} ${declOfNum(visible.length, [
            "вариант",
            "варианта",
            "вариантов",
          ])}`;
    const extra =
      (favoritesOnly && visible.length !== items.length) ||
      (isSearchActive() && visible.length !== base.length)
        ? ` из ${favoritesOnly ? items.length : base.length}`
        : "";
    countEl.textContent = `${baseLabel}${extra}`;
    exportButton.classList.toggle("hidden", isEmpty);
  };

  // Универсальный кастомный селект (общий с Backup)
  const { updateSummary, updatePoolHint, pulsePool } = createSummary({
    getState: () => state.getState(),
    elements: {
      summaryCountEl,
      summaryPresetEl,
      summaryPoolEl,
      summaryPoolModeEl,
      summaryDefaultBadgeEl,
      poolHintEl,
    },
  });
  const setRollDisabled = (disabled) => {
    rollButtons.forEach((btn) => {
      btn.disabled = disabled;
      btn.classList.toggle("is-disabled", disabled);
    });
  };
  const clampSpinSeconds = (value) =>
    Math.min(60, Math.max(0, Number(value ?? 0.4)));
  const clampAutoInterval = (value) =>
    Math.min(3600, Math.max(1, Math.round(Number(value ?? 5))));
  const clampAutoStopCount = (value) =>
    Math.min(9999, Math.max(1, Math.round(Number(value ?? 5))));
  const normalizeStopMode = (raw) =>
    ["none", "count", "match"].includes(raw) ? raw : "none";
  const sanitizeStopMatch = (value = "") =>
    (value ?? "").toString().slice(0, 120).trim();
  const updateListVisibility = (hidden) => {
    isListHidden = hidden;
    wrapper.classList.toggle("is-list-hidden", hidden);
    if (toggleListBtn) {
      const span = toggleListBtn.querySelector("span");
      const icon = toggleListBtn.querySelector("i");
      toggleListBtn.dataset.state = hidden ? "hidden" : "shown";
      if (span) span.textContent = hidden ? "Показать список" : "Скрыть список";
      if (icon)
        icon.className = hidden ? "fa-solid fa-list" : "fa-solid fa-list-check";
    }
  };
  const updateFavFilterUi = () => {
    if (!favFilterBtn) return;
    favFilterBtn.dataset.state = favoritesOnly ? "favorites" : "all";
    const span = favFilterBtn.querySelector("span");
    if (span) span.textContent = favoritesOnly ? "Избранные" : "Все";
    favFilterBtn.classList.toggle("is-active", favoritesOnly);
  };
  const getStatsSort = () => ({
    key:
      ["value", "hits", "misses"].includes(settings?.statsSortKey) &&
      settings?.statsSortKey
        ? settings.statsSortKey
        : "misses",
    dir: settings?.statsSortDir === "asc" ? "asc" : "desc",
  });
  const setStatsSort = ({ key, dir }) => {
    const nextKey = ["value", "hits", "misses"].includes(key) ? key : "misses";
    const nextDir = dir === "asc" ? "asc" : "desc";
    settings.statsSortKey = nextKey;
    settings.statsSortDir = nextDir;
    persistSettings();
    renderHistory();
  };
  const setHistoryTab = (tab, { persist = false } = {}) => {
    const target = tab === "history" ? "history" : "stats";
    const keys = Object.keys(historyPanels);
    keys.forEach((key) => {
      historyTabs[key]?.classList.toggle("is-active", key === target);
      historyPanels[key]?.classList.toggle("hidden", key !== target);
    });
    if (persist) {
      settings.statsTab = target;
      persistSettings();
    }
  };
  const clearSpinCountdown = () => {
    if (spinCountdownTimer) {
      clearInterval(spinCountdownTimer);
      spinCountdownTimer = null;
    }
    if (spinCountdownValueEl) spinCountdownValueEl.textContent = "—";
  };
  const startSpinCountdown = (ms) => {
    if (!spinCountdownValueEl || !ms) return;
    clearSpinCountdown();
    const endAt = Date.now() + ms;
    const tick = () => {
      const left = Math.max(0, endAt - Date.now());
      spinCountdownValueEl.textContent = `${(left / 1000).toFixed(1)}с`;
      if (left <= 0) clearSpinCountdown();
    };
    tick();
    spinCountdownTimer = setInterval(tick, 80);
  };
  const updateRollAvailability = () => {
    const { items, pool, settings } = state.getState();
    const activeItems = items.filter((item) => !item.excluded);
    const visibleItems = favoritesOnly
      ? activeItems.filter((item) => item.favorite)
      : activeItems;
    const poolSet = new Set(pool || []);
    const poolHasVisible =
      !settings.noRepeat ||
      visibleItems.some((item) => poolSet.has(item.value));
    const disabled =
      !visibleItems.length || !poolHasVisible || isRolling || autoEnabled;
    setRollDisabled(disabled);
  };
  const updatePoolProgress = () => {
    if (!poolProgressFill || !poolProgressValue) return;
    const { items, pool, settings } = state.getState();
    if (!items.length) {
      poolProgressFill.style.width = "0%";
      poolProgressValue.textContent = "—";
      poolProgressFill.classList.remove("is-warning");
      return;
    }
    const total = items.length || 1;
    const current = settings.noRepeat ? pool.length : total;
    const ratio = Math.max(
      0,
      Math.min(1, settings.noRepeat ? current / total : 1),
    );
    poolProgressFill.style.width = `${(ratio * 100).toFixed(0)}%`;
    poolProgressValue.textContent = settings.noRepeat
      ? `${current}/${total}`
      : "∞";
    poolProgressFill.classList.toggle("is-warning", ratio < 0.35);
  };
  const renderSparkline = () => {
    if (!sparklineEl) return;
    const { items, settings } = state.getState();
    const rareThreshold = clampRareThreshold(
      settings?.rareThreshold ?? RARE_STREAK,
    );
    const activeItems = items.filter((item) => !item.excluded);
    sparklineEl.innerHTML = "";
    if (!activeItems.length) return;
    const sorted = activeItems
      .slice()
      .sort((a, b) => clampMisses(b.misses || 0) - clampMisses(a.misses || 0))
      .slice(0, 14);
    const maxMiss = Math.max(
      1,
      ...sorted.map((item) => clampMisses(item.misses || 0)),
    );
    sorted.forEach((item) => {
      const miss = clampMisses(item.misses || 0);
      const hit = clampHits(item.hits || 0);
      const bar = document.createElement("div");
      bar.className = "spark-bar";
      bar.style.setProperty("--h", `${Math.max(6, (miss / maxMiss) * 100)}%`);
      const missLabel = declOfNum(miss, ["промах", "промаха", "промахов"]);
      const hitLabel = declOfNum(hit, ["попадание", "попадания", "попаданий"]);
      const tooltip = `${item.value}: ${miss} ${missLabel}, ${hit} ${hitLabel}`;
      bar.title = tooltip;
      bar.dataset.bsToggle = "tooltip";
      bar.dataset.bsPlacement = "top";
      bar.setAttribute("aria-label", tooltip);
      bar.classList.toggle("is-rare", miss >= rareThreshold);
      bar.classList.toggle("is-empty", miss === 0);
      sparklineEl.appendChild(bar);
    });
    setTimeout(() => initTooltips(), 0);
  };
  const updateVisuals = () => {
    updatePoolProgress();
    renderSparkline();
  };
  const setRolling = (value) => {
    isRolling = value;
    wrapper.classList.toggle("is-rolling", value);
    rollButtons.forEach((btn) => btn.classList.toggle("is-busy", value));
    updateRollAvailability();
  };
  const updateAutoStopExtraVisibility = () => {
    const mode = normalizeStopMode(autoStopModeSelect?.value);
    autoStopExtras?.forEach((el) =>
      el.classList.toggle("hidden", el.dataset.stopExtra !== mode),
    );
  };
  const stopAutoStatusTicker = () => {
    if (autoStatusTimer) {
      clearInterval(autoStatusTimer);
      autoStatusTimer = null;
    }
  };
  const startAutoStatusTicker = () => {
    if (autoStatusTimer) return;
    autoStatusTimer = setInterval(() => refreshAutoStatus(), 200);
  };
  const refreshAutoStatus = (overrideText) => {
    const idleText = overrideText || "Авто-ролл выключен";
    const setCountdown = (text) => {
      if (autoCountdownMiniEl) autoCountdownMiniEl.textContent = text;
    };
    if (!autoEnabled) {
      if (autoStatusEl) {
        autoStatusEl.textContent = idleText;
        autoStatusEl.dataset.state = "idle";
      }
      if (autoStatusMiniEl) autoStatusMiniEl.textContent = idleText;
      if (autoChipEl) autoChipEl.dataset.state = "idle";
      setCountdown("—");
      return;
    }
    const now = Date.now();
    const secondsLeft =
      autoNextAt && autoNextAt > now
        ? Math.max(0, ((autoNextAt - now) / 1000).toFixed(1))
        : "0.0";
    const limitLabel =
      settings.autoStopMode === "count"
        ? `до стопа: ${Math.max(
            0,
            clampAutoStopCount(settings.autoStopCount) - autoRuns,
          )}`
        : settings.autoStopMode === "match" && settings.autoStopMatch
          ? `ищем «${settings.autoStopMatch}»`
          : "стоп вручную";
    const lastLabel = lastResultValue ? ` · было: ${lastResultValue}` : "";
    const text =
      overrideText ||
      `Авто · каждые ${settings.autoRollInterval}с · ${limitLabel} · следующий через ${secondsLeft}с${lastLabel}`;
    if (autoStatusEl) {
      autoStatusEl.textContent = text;
      autoStatusEl.dataset.state = "running";
    }
    if (autoStatusMiniEl) autoStatusMiniEl.textContent = text;
    if (autoChipEl) autoChipEl.dataset.state = "running";
    setCountdown(`${secondsLeft}с`);
  };
  const updateAutoToggleUi = () => {
    const textEl = autoToggleBtn?.querySelector("span");
    const iconEl = autoToggleBtn?.querySelector("i");
    autoToggleBtn?.classList.toggle("is-active", autoEnabled);
    if (textEl)
      textEl.textContent = autoEnabled ? "Остановить" : "Старт таймера";
    if (iconEl)
      iconEl.className = autoEnabled
        ? "fa-solid fa-stop"
        : "fa-solid fa-clock-rotate-left";

    const miniText = autoToggleHeroBtn?.querySelector("span");
    const miniIcon = autoToggleHeroBtn?.querySelector("i");
    autoToggleHeroBtn?.classList.toggle("is-active", autoEnabled);
    if (miniText) miniText.textContent = autoEnabled ? "Стоп" : "Старт";
    if (miniIcon)
      miniIcon.className = autoEnabled
        ? "fa-solid fa-stop"
        : "fa-solid fa-clock-rotate-left";
  };
  const stopAutoRoll = (reason) => {
    autoEnabled = false;
    if (autoTimer) {
      clearTimeout(autoTimer);
      autoTimer = null;
    }
    autoNextAt = null;
    stopAutoStatusTicker();
    updateRollAvailability();
    updateAutoToggleUi();
    if (reason) showToast(`Авто-ролл остановлен: ${reason}`, "info");
    refreshAutoStatus(reason ? `Остановлено: ${reason}` : undefined);
  };
  const scheduleAutoRoll = ({ immediate = false } = {}) => {
    if (!autoEnabled) return;
    if (autoTimer) clearTimeout(autoTimer);
    const delayMs =
      (immediate ? 0 : clampAutoInterval(settings.autoRollInterval)) * 1000;
    autoNextAt = Date.now() + delayMs;
    autoTimer = setTimeout(runAutoRoll, delayMs);
    startAutoStatusTicker();
    refreshAutoStatus();
  };
  const matchesStopText = (value) => {
    const needle = sanitizeStopMatch(settings.autoStopMatch);
    if (!needle) return false;
    return (value || "")
      .toString()
      .toLowerCase()
      .includes(needle.toLowerCase());
  };
  const getAutoStopReason = (result) => {
    if (!result) return "нет доступных вариантов";
    if (
      settings.autoStopMode === "count" &&
      autoRuns >= clampAutoStopCount(settings.autoStopCount)
    ) {
      return `лимит ${clampAutoStopCount(settings.autoStopCount)} запусков`;
    }
    if (
      settings.autoStopMode === "match" &&
      settings.autoStopMatch &&
      matchesStopText(result.value)
    ) {
      return `совпадение: «${settings.autoStopMatch}»`;
    }
    const poolSize = state.getState().pool?.length || 0;
    if (
      settings.autoStopOnPoolDepletion &&
      settings.noRepeat &&
      items.length > 0 &&
      poolSize === 0
    ) {
      return "пул без повторов пуст";
    }
    return "";
  };
  const runAutoRoll = async () => {
    if (!autoEnabled) return;
    if (autoTimer) {
      clearTimeout(autoTimer);
      autoTimer = null;
    }
    autoNextAt = null;
    stopAutoStatusTicker();
    if (isRolling) {
      scheduleAutoRoll();
      return;
    }
    autoRuns += 1;
    refreshAutoStatus(`Запуск #${autoRuns}…`);
    const result = await roll({
      source: "auto",
      metaLabel: `Авто #${autoRuns}`,
    });
    if (!autoEnabled) return;
    const stopReason = getAutoStopReason(result);
    if (stopReason) {
      stopAutoRoll(stopReason);
      return;
    }
    scheduleAutoRoll();
  };
  const syncAutoControls = () => {
    if (autoStopModeSelect) {
      settings.autoStopMode = normalizeStopMode(settings.autoStopMode);
      autoStopModeSelect.value = settings.autoStopMode;
      autoStopSelectUI?.updateLabel?.();
    }
    if (autoStopCountInput) {
      settings.autoStopCount = clampAutoStopCount(settings.autoStopCount);
      autoStopCountInput.value = settings.autoStopCount;
    }
    if (autoStopTextInput) {
      settings.autoStopMatch = sanitizeStopMatch(settings.autoStopMatch);
      autoStopTextInput.value = settings.autoStopMatch;
    }
    if (autoStopPoolToggle)
      autoStopPoolToggle.checked = !!settings.autoStopOnPoolDepletion;
    if (autoNotifySoundToggle)
      autoNotifySoundToggle.checked = settings.autoNotifySound !== false;
    if (autoNotifyFlashToggle)
      autoNotifyFlashToggle.checked = settings.autoNotifyFlash !== false;
    updateAutoStopExtraVisibility();
    refreshAutoStatus();
  };
  const restartAutoIfRunning = () => {
    if (!autoEnabled) return;
    scheduleAutoRoll();
    refreshAutoStatus();
  };
  const startAutoRoll = ({ immediate = false } = {}) => {
    if (autoEnabled) return;
    if (isRolling) {
      showToast("Дождитесь завершения текущего запуска", "info");
      return;
    }
    normalizePool();
    if (!items.length) {
      showToast("Добавьте варианты перед автозапуском", "warning");
      return;
    }
    if (settings.noRepeat && (!Array.isArray(pool) || pool.length === 0)) {
      showToast("Пул пуст — обновите его или отключите «Без повторов»", "info");
      return;
    }
    autoRuns = 0;
    lastResultValue = "";
    autoEnabled = true;
    updateAutoToggleUi();
    updateRollAvailability();
    refreshAutoStatus();
    scheduleAutoRoll({ immediate });
    showToast("Авто-ролл запущен", "success");
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
    updateVisuals();
  };

  const resetPool = () => {
    state.resetPool();
    syncState();
    updatePoolHint();
    updateSummary();
    pulsePool();
    updateRollAvailability();
    updateVisuals();
  };

  const persistItems = (options = {}) => {
    state.persistItems(options);
    syncState();
    updateVisuals();
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
    updateVisuals();
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
    updateVisuals();
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
    updateVisuals();
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
      state.setDefaultPreset(name);
      syncState();
      updateSummary();
      renderHistory();
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
  const resetStats = () => {
    state.persistItems({ resetPool: false });
    items.forEach((item) => {
      item.hits = 0;
      item.misses = 0;
    });
    persistItems({ resetPool: false });
    renderItems();
    renderHistory();
    showToast("Статистика сброшена", "success");
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
  const getItemMisses = (item) => clampMisses(item?.misses ?? 0);

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
    onUpdateVisuals: updateVisuals,
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
    onToggleFavorite: (value) => state.toggleFavorite(value),
    onToggleExclude: (value) => state.toggleExclude(value),
    getRareThreshold: () => getRareThreshold(),
    favoritesOnly: () => favoritesOnly,
    getSearchQuery: () => searchQuery,
    prepareItems: (list) => sortByMode(applySearchFilter(list)),
    canDrag: () => sortMode === "order",
    onRequestSample: () => bulkAdd(DEFAULT_ITEMS),
    onRequestPaste: async () => {
      try {
        const text = await navigator.clipboard.readText();
        const entries = parseEntries(text);
        if (!entries.length) {
          showToast("Буфер обмена пуст", "info");
          return;
        }
        bulkAdd(entries);
      } catch {
        showToast("Не удалось прочитать буфер обмена", "error");
      }
    },
  });

  const renderItems = () => {
    syncState();
    pruneSelection();
    renderItemsImpl();
    updateRollAvailability();
    updateVisuals();
    renderHistory();
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

  if (spinDurationInput) {
    const timerValue = clampSpinSeconds(
      settings.spinSeconds || settings.autoRollInterval,
    );
    settings.spinSeconds = timerValue;
    settings.autoRollInterval = clampAutoInterval(timerValue);
    spinDurationInput.value = timerValue.toFixed(1);
    spinDurationInput.addEventListener("change", () => {
      const nextSpin = clampSpinSeconds(spinDurationInput.value);
      const nextInterval = clampAutoInterval(nextSpin);
      settings.spinSeconds = nextSpin;
      settings.autoRollInterval = nextInterval;
      spinDurationInput.value = nextSpin.toFixed(1);
      persistSettings();
      refreshAutoStatus();
      restartAutoIfRunning();
    });
  }

  if (rareThresholdInput) {
    const thresholdValue = getRareThreshold();
    settings.rareThreshold = thresholdValue;
    rareThresholdInput.value = thresholdValue;
    rareThresholdInput.addEventListener("change", () => {
      const next = clampRareThreshold(rareThresholdInput.value);
      settings.rareThreshold = next;
      rareThresholdInput.value = next;
      persistSettings();
      renderItems();
      renderHistory();
      updateVisuals();
    });
  }

  syncAutoControls();
  updateAutoToggleUi();
  updateListVisibility(false);
  updateFavFilterUi();
  setHistoryTab(settings.statsTab || "history");
  if (searchInput) {
    searchInput.value = searchQuery;
    searchInput.addEventListener("input", () => {
      searchQuery = searchInput.value || "";
      renderItems();
    });
  }
  if (sortSelect) {
    sortMode = normalizeSortMode(sortSelect.value);
    sortSelect.value = sortMode;
    sortSelect.addEventListener("change", () => {
      sortMode = normalizeSortMode(sortSelect.value);
      sortSelect.value = sortMode;
      renderItems();
    });
    sortSelectUI?.rebuild?.();
    sortSelectUI?.updateLabel?.();
  }

  const resultUI = createResultUI({
    resultCard,
    resultContainer,
    resultText,
    resultMeta,
  });
  const playChime = () => {
    if (!settings.autoNotifySound) return;
    const AudioCtx =
      typeof window !== "undefined"
        ? window.AudioContext || window.webkitAudioContext
        : null;
    if (!AudioCtx) return;
    try {
      if (!audioContext) audioContext = new AudioCtx();
      const ctx = audioContext;
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = "triangle";
      osc.frequency.value = 880;
      gain.gain.value = 0.08;
      osc.connect(gain).connect(ctx.destination);
      osc.start();
      osc.stop(ctx.currentTime + 0.22);
    } catch {
      /* ignore audio errors */
    }
  };
  const flashResult = () => {
    if (!settings.autoNotifyFlash || !resultCard) return;
    resultCard.classList.remove("flash");
    if (flashTimer) clearTimeout(flashTimer);
    // force reflow
    void resultCard.offsetWidth;
    resultCard.classList.add("flash");
    flashTimer = setTimeout(() => resultCard.classList.remove("flash"), 720);
  };
  const notifyResult = () => {
    playChime();
    flashResult();
  };
  const stopCarousel = () => {
    if (carouselTimer) {
      clearInterval(carouselTimer);
      carouselTimer = null;
    }
    resultContainer.classList.remove("carousel");
  };

  const startCarousel = (values) => {
    stopCarousel();
    if (!values?.length) return;
    const queue = values.map((item) => item.value);
    let index = 0;
    resultContainer.classList.add("carousel");
    carouselTimer = setInterval(() => {
      resultUI.setResult(queue[index % queue.length], "Перемешиваем…");
      index += 1;
    }, 160);
  };

  const { clear: clearResultBase } = resultUI;
  const clearResult = () => {
    stopCarousel();
    clearResultBase();
  };

  renderHistory = createHistoryRenderer({
    getState: () => state.getState(),
    historyList,
    historyEmpty,
    onSelectEntry: (value) => {
      resultUI.setResult(value, "Выбрано ранее");
    },
    statsTable,
    getRareOnly: () => rareOnly,
    getRareThreshold: () => getRareThreshold(),
    getSort: () => getStatsSort(),
    onChangeSort: (sort) => setStatsSort(sort),
    initTooltips,
    onStatsToggle: (rare) => {
      if (!rareToggleBtn) return;
      rareToggleBtn.dataset.state = rare ? "rare" : "all";
      const span = rareToggleBtn.querySelector("span");
      if (span) span.textContent = rare ? "Редкие" : "Все";
      rareToggleBtn.classList.toggle("is-active", rare);
    },
    onExportStats: (getText) => {
      if (!statsExportBtn || statsExportBtn.dataset.wired === "1") return;
      statsExportBtn.dataset.wired = "1";
      statsExportBtn.addEventListener("click", async () => {
        const data = getText(rareToggleBtn?.dataset.state === "rare");
        if (!data) {
          showToast("Статистика пуста", "info");
          return;
        }
        try {
          await navigator.clipboard.writeText(data);
          showToast("Статистика скопирована", "success");
        } catch {
          showToast("Не удалось скопировать", "error");
        }
      });
    },
  });

  const addHistoryEntry = (value) => {
    state.addHistoryEntry(value, currentPresetName);
    syncState();
    renderHistory();
  };

  const parseEntries = (raw) =>
    (raw || "")
      .split(/[\n;,]/)
      .map((value) => value.trim())
      .filter(Boolean);

  const addItem = (value, silent = false) => {
    const normalized = value.trim();
    if (!normalized) {
      if (!silent) showToast("Введите текст варианта", "warning");
      return false;
    }
    if (normalized.length > MAX_ITEM_LENGTH) {
      if (!silent) showToast("Слишком длинный вариант", "warning");
      return false;
    }
    const exists = items.some(
      (item) => item.value.toLowerCase() === normalized.toLowerCase(),
    );
    if (exists) {
      if (!silent) showToast("Такой вариант уже есть", "info");
      return false;
    }
    state.addItem(normalized);
    syncState();
    renderItems();
    return true;
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

  const roll = ({ source = "manual", metaLabel } = {}) => {
    if (isRolling) return Promise.resolve(null);
    clearSpinCountdown();
    if (!items.length) {
      showToast("Сначала добавьте варианты", "warning");
      return Promise.resolve(null);
    }
    const sourceItems = favoritesOnly
      ? items.filter((item) => item.favorite)
      : items;
    if (!sourceItems.length) {
      showToast("Отметьте избранные варианты или отключите фильтр", "info");
      return Promise.resolve(null);
    }
    normalizePool();
    const candidates = settings.noRepeat
      ? sourceItems.filter((item) => pool.includes(item.value))
      : sourceItems;
    if (!candidates.length) {
      showToast("Нет доступных вариантов", "info");
      updatePoolHint();
      updateRollAvailability();
      stopCarousel();
      clearSpinCountdown();
      return Promise.resolve(null);
    }
    const candidateValues = new Set(candidates.map((item) => item.value));
    const spinMs = Math.min(
      60000,
      Math.max(0, Number(settings.spinSeconds ?? 0.4) * 1000),
    );
    setRolling(true);
    resultCard.classList.add("rolling");
    if (spinMs > 0) {
      startCarousel(candidates);
      startSpinCountdown(spinMs);
    }
    return new Promise((resolve) => {
      const finish = (result) => {
        stopCarousel();
        clearSpinCountdown();
        resultCard.classList.remove("rolling");
        setRolling(false);
        resolve(result);
      };
      setTimeout(
        () => {
          const picked = pickWeightedItem(candidates);
          if (!picked) {
            showToast("Нет доступных вариантов", "info");
            finish(null);
            return;
          }

          const value = picked.value;
          items.forEach((item) => {
            if (item.value === value) {
              item.hits = getItemHits(item) + 1;
              item.misses = 0;
            } else if (candidateValues.has(item.value)) {
              item.misses = clampMisses(getItemMisses(item) + 1);
            }
          });
          persistItems({ resetPool: false });
          if (settings.noRepeat) {
            state.consumeFromPool(value);
            syncState();
            updateSummary();
            updatePoolHint();
          }

          const timeLabel = new Intl.DateTimeFormat("ru-RU", {
            hour: "2-digit",
            minute: "2-digit",
            second: "2-digit",
          }).format(Date.now());
          const meta = metaLabel ? `${metaLabel} • ${timeLabel}` : timeLabel;
          resultUI.setResult(value, meta);
          resultUI.pulse();
          notifyResult();
          addHistoryEntry(value);
          renderItems();
          updateRollAvailability();
          updateVisuals();
          lastResultValue = value;
          finish({ value, meta, source });
        },
        Math.max(0, spinMs || 0),
      );
    });
  };

  autoStopModeSelect?.addEventListener("change", () => {
    settings.autoStopMode = normalizeStopMode(autoStopModeSelect.value);
    autoRuns = 0;
    updateAutoStopExtraVisibility();
    autoStopSelectUI?.updateLabel?.();
    persistSettings();
    refreshAutoStatus();
    restartAutoIfRunning();
  });

  autoStopCountInput?.addEventListener("change", () => {
    const next = clampAutoStopCount(autoStopCountInput.value);
    settings.autoStopCount = next;
    autoStopCountInput.value = next;
    persistSettings();
    refreshAutoStatus();
  });

  autoStopTextInput?.addEventListener("input", () => {
    settings.autoStopMatch = sanitizeStopMatch(autoStopTextInput.value);
    autoStopTextInput.value = settings.autoStopMatch;
    persistSettings();
    refreshAutoStatus();
  });

  autoStopPoolToggle?.addEventListener("change", () => {
    settings.autoStopOnPoolDepletion = !!autoStopPoolToggle.checked;
    persistSettings();
  });

  autoNotifySoundToggle?.addEventListener("change", () => {
    settings.autoNotifySound = !!autoNotifySoundToggle.checked;
    persistSettings();
  });

  autoNotifyFlashToggle?.addEventListener("change", () => {
    settings.autoNotifyFlash = !!autoNotifyFlashToggle.checked;
    persistSettings();
  });

  autoToggleBtn?.addEventListener("click", () => {
    if (autoEnabled) {
      stopAutoRoll("остановлено вручную");
    } else {
      startAutoRoll();
    }
  });
  autoToggleHeroBtn?.addEventListener("click", () => {
    if (autoEnabled) {
      stopAutoRoll("остановлено вручную");
    } else {
      startAutoRoll();
    }
  });

  autoRunOnceBtn?.addEventListener("click", async () => {
    if (autoEnabled) {
      if (autoTimer) {
        clearTimeout(autoTimer);
        autoTimer = null;
      }
      await runAutoRoll();
      return;
    }
    startAutoRoll({ immediate: true });
  });

  toggleListBtn?.addEventListener("click", () => {
    updateListVisibility(!isListHidden);
  });

  favFilterBtn?.addEventListener("click", () => {
    favoritesOnly = !favoritesOnly;
    settings.favoritesOnly = favoritesOnly;
    updateFavFilterUi();
    renderItems();
    updateVisuals();
    persistSettings();
  });

  clearFavoritesBtn?.addEventListener("click", () => {
    const changed = state.clearFavorites();
    favoritesOnly = false;
    settings.favoritesOnly = false;
    persistSettings();
    syncState();
    updateFavFilterUi();
    renderItems();
    updateVisuals();
    showToast(
      changed ? "Избранное очищено" : "Нечего сбрасывать",
      changed ? "success" : "info",
    );
  });

  clearExcludedBtn?.addEventListener("click", () => {
    const restored = state.clearExcluded();
    syncState();
    updateSummary();
    updatePoolHint();
    renderItems();
    updateRollAvailability();
    updateVisuals();
    showToast(
      restored
        ? "Исключённые варианты возвращены в пул"
        : "Исключённых нет в списке",
      restored ? "success" : "info",
    );
  });

  wireRollControls(wrapper, () => roll());

  wrapper.querySelector("#randomizer-add")?.addEventListener("click", () => {
    const entries = parseEntries(inputEl.value);
    if (!entries.length) {
      showToast("Введите текст варианта", "warning");
      inputEl.focus();
      return;
    }
    if (entries.length === 1) {
      const ok = addItem(entries[0], true);
      if (ok) showToast("Вариант добавлен", "success");
    } else {
      bulkAdd(entries);
    }
    inputEl.value = "";
    inputEl.focus();
  });

  inputEl?.addEventListener("keydown", (event) => {
    if (event.key === "Enter" && (event.metaKey || event.ctrlKey)) {
      event.preventDefault();
      wrapper.querySelector("#randomizer-add")?.click();
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
        inputEl.value = "";
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

  rareToggleBtn?.addEventListener("click", () => {
    rareOnly = !rareOnly;
    settings.rareOnly = rareOnly;
    persistSettings();
    renderHistory();
  });

  statsResetBtn?.addEventListener("click", () => {
    if (!confirm("Сбросить счётчики выпадений и промахов для всех вариантов?"))
      return;
    resetStats();
  });

  historyTabs.history?.addEventListener("click", () =>
    setHistoryTab("history", { persist: true }),
  );
  historyTabs.stats?.addEventListener("click", () =>
    setHistoryTab("stats", { persist: true }),
  );

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
      renderItems();
      showToast("Пул без повторов обновлён", "success");
    });

  poolRefreshBtn?.addEventListener("click", () => {
    resetPool();
    renderItems();
    showToast("Пул без повторов обновлён", "success");
  });

  historyRunBtn?.addEventListener("click", () => roll());

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
    renderItems();
    refreshAutoStatus();
    restartAutoIfRunning();
  });

  renderItems();
  renderHistory();
  setTimeout(() => initTooltips(), 0);

  return wrapper;
}
