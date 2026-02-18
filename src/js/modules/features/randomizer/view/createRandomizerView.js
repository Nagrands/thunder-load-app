import { showToast } from "../../../toast.js";
import { initTooltips } from "../../../tooltipInitializer.js";
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
} from "../../../randomizer/helpers.js";
import { createRandomizerState } from "../../../randomizer/state.js";
import { createSummary } from "../../../randomizer/ui/summary.js";
import { createHistoryRenderer } from "../../../randomizer/ui/history.js";
import { createItemsRenderer } from "../../../randomizer/ui/items.js";
import { createResultUI } from "../../../randomizer/ui/result.js";
import { createPresetsUI } from "../../../randomizer/ui/presets.js";
import { wireRollControls } from "../../../randomizer/ui/controls.js";
import { wireListActions } from "../../../randomizer/ui/listActions.js";
import { applyI18n, getLanguage, t } from "../../../i18n.js";
import { createCleanupRegistry } from "./cleanup.js";
import { createRandomizerShell } from "./shell.js";
import {
  applySearchFilter,
  buildCountLabel,
  normalizeSortMode,
  sortByMode as sortItemsByMode,
} from "./listLogic.js";
import { enhanceSelect } from "./selectEnhancer.js";
import {
  clampAutoInterval,
  clampAutoStopCount,
  getAutoStopReason,
  normalizeStopMode,
  sanitizeStopMatch,
} from "./autoRollController.js";

export function createRandomizerView() {
  const lifecycle = createCleanupRegistry();
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
  let settings;
  let pool;
  let currentPresetName;
  let defaultPresetName;
  let selectedItems = new Set();
  let favoritesOnly = false;
  let rareOnly = false;
  let searchQuery = "";
  let sortMode = "order";

  const sortByMode = (list) =>
    sortItemsByMode(list, sortMode, { clampMisses, clampWeight });
  let renderHistory = () => {};
  const getRareThreshold = () =>
    clampRareThreshold(settings?.rareThreshold ?? RARE_STREAK);
  const isSearchActive = () => (searchQuery || "").trim().length > 0;

  const syncState = () => {
    ({ items, presets, settings, pool, currentPresetName, defaultPresetName } =
      state.getState());
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

  const { element: wrapper } = createRandomizerShell();
  wrapper.innerHTML = `
      <header class="randomizer-shell-header">
        <div class="randomizer-heading">
          <div class="icon">
            <i class="fa-solid fa-shuffle"></i>
          </div>
          <div class="title-content">
            <h1 class="wg-text-gradient">Randomizer</h1>
            <p class="subtitle">Перемешайте идеи, ссылки и задачи — приложение выберет случайный вариант.</p>
          </div>
        </div>
      </header>
      <div class="randomizer-hero-controls">
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
        <span class="label">Пул</span>
        <div class="summary-main">
          <strong id="randomizer-summary-pool">—</strong>
          <span class="summary-pill" id="randomizer-summary-pool-mode">Без повторов</span>
        </div>
      </div>
      <div class="summary-item summary-field">
        <span class="label">Таймер / Авто</span>
        <label
          class="spin-control summary-control"
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
      <div class="summary-item summary-field">
        <span class="label">Порог</span>
        <label class="summary-control stat-threshold" title="Порог редкости (промахи)">
          <span>Порог:</span>
          <input type="number" id="randomizer-rare-threshold" min="1" max="9999" />
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
        <div class="preset-main">
          <label for="randomizer-preset-select" class="preset-label">Шаблоны:</label>
          <select id="randomizer-preset-select" class="preset-select"></select>
        </div>
        <div class="preset-actions-compact">
          <button type="button" class="btn btn-sm btn-primary" id="randomizer-preset-save" data-bs-toggle="tooltip" data-bs-placement="top" title="Сохранить текущий шаблон">
            <i class="fa-solid fa-floppy-disk"></i>
            <span>Сохранить</span>
          </button>
          <button type="button" class="btn btn-sm btn-ghost" id="randomizer-preset-new" data-bs-toggle="tooltip" data-bs-placement="top" title="Создать новый пустой шаблон">
            <i class="fa-solid fa-file-circle-plus"></i>
            <span>Новый</span>
          </button>
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
          <div class="randomizer-input-row">
            <textarea
              id="randomizer-input"
              placeholder="Добавляйте свои варианты. Каждый новый вариант — это отдельная строка. Можно использовать точку с запятой для разделения.
"
              rows="2"
            ></textarea>
            <button type="button" class="btn btn-primary" id="randomizer-add">
              <i class="fa-solid fa-plus"></i>
            </button>
          </div>
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
          <div class="randomizer-list-row">
            <div class="randomizer-list-heading">
              <span id="randomizer-count">0 вариантов</span>
              <span class="list-sub">Фильтры и действия ниже</span>
            </div>
            <div class="list-actions-group">
              <span class="group-label">Фильтры</span>
              <button type="button" class="btn btn-sm btn-ghost" id="randomizer-fav-filter" data-state="all" data-bs-toggle="tooltip" data-bs-placement="left" title="Показывать только избранные варианты">
                <i class="fa-solid fa-star"></i>
                <span>Все</span>
              </button>
            </div>
          </div>
          <div class="randomizer-list-actions list-actions-compact">
            <div class="list-actions-group">
              <span class="group-label">Действия</span>
              <button type="button" class="btn btn-sm btn-ghost" id="randomizer-expand-all" data-state="collapsed" data-bs-toggle="tooltip" data-bs-placement="left" title="Развернуть все варианты">
                <i class="fa-solid fa-angles-down"></i>
                <span>Развернуть все</span>
              </button>
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
        <div class="result-hero">
          <div class="result-hero-header">
            <div>
              <p class="eyebrow">Результат</p>
            </div>
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

        <div class="result-panels">
          <section class="result-panel randomizer-auto-card" id="randomizer-auto-card">
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
          </section>

          <section class="result-panel randomizer-history-card">
            <header>
              <div class="history-tabs-wrap">
                <span class="history-tabs-label">Последние результаты</span>
                <div class="history-tabs" role="tablist" aria-label="Последние результаты">
                  <button type="button" class="btn btn-sm btn-ghost is-active" id="randomizer-tab-history" data-target="history" data-bs-toggle="tooltip" data-bs-placement="top" title="История" role="tab" aria-selected="true">
                    <i class="fa-solid fa-clock-rotate-left"></i>
                    <span>История</span>
                  </button>
                  <button type="button" class="btn btn-sm btn-ghost" id="randomizer-tab-stats" data-target="stats" data-bs-toggle="tooltip" data-bs-placement="top" title="Статистика" role="tab" aria-selected="false">
                    <i class="fa-solid fa-chart-line"></i>
                    <span>Статистика</span>
                  </button>
                </div>
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
      </section>
    </div>
  `;

  const localizeStatic = () => {
    const setText = (selector, key) => {
      const el = wrapper.querySelector(selector);
      if (el) el.textContent = t(key);
    };
    const setTitle = (selector, key) => {
      const el = wrapper.querySelector(selector);
      if (el) el.title = t(key);
    };
    const setPlaceholder = (selector, key) => {
      const el = wrapper.querySelector(selector);
      if (el) el.setAttribute("placeholder", t(key));
    };

    setText(".randomizer-shell-header .subtitle", "randomizer.hero.subtitle");
    setText("#randomizer-auto-chip .chip-label", "randomizer.auto.label");
    setText("#randomizer-auto-status-mini", "randomizer.auto.status.off");
    const autoNext = wrapper.querySelector(".randomizer-auto-chip .chip-sub");
    if (autoNext && autoNext.childNodes.length) {
      autoNext.childNodes[0].textContent = `${t("randomizer.auto.nextIn")} `;
    }
    setText("#randomizer-auto-toggle-hero span", "randomizer.auto.start");
    const heroRoll = wrapper.querySelector(
      "#randomizer-roll-hero span:last-child",
    );
    if (heroRoll) heroRoll.textContent = t("randomizer.action.start");
    setTitle("#randomizer-reset-pool", "randomizer.action.resetPool.title");
    setText("#randomizer-reset-pool span", "randomizer.action.resetPool");
    setText(
      "#randomizer-toggle-list span",
      "randomizer.action.toggleList.hide",
    );
    setText(
      "#randomizer-summary-default-badge",
      "randomizer.preset.defaultBadge",
    );
    const summaryLabels = wrapper.querySelectorAll(
      ".randomizer-summary .summary-item .label",
    );
    const summaryLabelKeys = [
      "randomizer.preset.label",
      "randomizer.summary.pool",
      "randomizer.summary.timer",
      "randomizer.summary.rare",
    ];
    summaryLabels.forEach((el, idx) => {
      const key = summaryLabelKeys[idx];
      if (key) el.textContent = t(key);
    });
    const summarySpin = wrapper.querySelector(".summary-control.spin-control");
    if (summarySpin) summarySpin.title = t("randomizer.summary.spin.title");
    setText(
      ".summary-control.spin-control .spin-label",
      "randomizer.summary.spin.label",
    );
    setText(
      ".summary-control.spin-control .unit",
      "randomizer.summary.spin.unit",
    );
    const spinCountdown = wrapper.querySelector("#randomizer-spin-countdown");
    if (spinCountdown)
      spinCountdown.setAttribute(
        "aria-label",
        t("randomizer.summary.spin.aria"),
      );
    const sparkline = wrapper.querySelector("#randomizer-sparkline");
    if (sparkline)
      sparkline.setAttribute(
        "aria-label",
        t("randomizer.summary.sparkline.aria"),
      );
    setText(".randomizer-editor header .eyebrow", "randomizer.list.eyebrow");
    setText(".randomizer-editor header h3", "randomizer.list.title");
    setTitle(".randomizer-toggle", "randomizer.list.noRepeat.title");
    setText(".randomizer-toggle span", "randomizer.list.noRepeat.label");
    setText(".randomizer-editor .hint", "randomizer.list.hint");
    setText(".preset-label", "randomizer.preset.labelPlural");
    setTitle("#randomizer-preset-save", "randomizer.preset.save.title");
    setText("#randomizer-preset-save span", "randomizer.preset.save");
    setTitle("#randomizer-preset-new", "randomizer.preset.new.title");
    setText("#randomizer-preset-new span", "randomizer.preset.new");
    setTitle("#randomizer-preset-default", "randomizer.preset.default.title");
    setText("#randomizer-preset-default span", "randomizer.preset.default");
    setTitle("#randomizer-preset-save-as", "randomizer.preset.saveAs.title");
    setText("#randomizer-preset-save-as span", "randomizer.preset.saveAs");
    setTitle("#randomizer-preset-delete", "randomizer.preset.delete.title");
    setText("#randomizer-preset-delete span", "randomizer.preset.delete");
    setPlaceholder("#randomizer-search", "randomizer.search.placeholder");
    setText(".randomizer-sort span", "randomizer.sort.label");
    const sortOptions = wrapper.querySelectorAll("#randomizer-sort option");
    sortOptions.forEach((opt) => {
      const key = `randomizer.sort.${opt.value}`;
      if (opt.value) opt.textContent = t(key);
    });
    setPlaceholder("#randomizer-input", "randomizer.input.placeholder");
    setTitle("#randomizer-paste", "randomizer.action.paste.title");
    setTitle("#randomizer-sample", "randomizer.action.sample.title");
    setTitle("#randomizer-clear", "randomizer.action.clear.title");
    setText(".randomizer-list-heading .list-sub", "randomizer.list.sub");
    const groupLabels = wrapper.querySelectorAll(
      ".list-actions-group .group-label",
    );
    if (groupLabels[0])
      groupLabels[0].textContent = t("randomizer.filters.label");
    if (groupLabels[1])
      groupLabels[1].textContent = t("randomizer.actions.label");
    setTitle(".stat-threshold", "randomizer.filters.threshold.title");
    setText(".stat-threshold span", "randomizer.filters.threshold.label");
    setTitle("#randomizer-fav-filter", "randomizer.filters.favorites.title");
    setText("#randomizer-fav-filter span", "randomizer.filters.favorites.all");
    setTitle("#randomizer-expand-all", "randomizer.actions.expandAll.title");
    setText("#randomizer-expand-all span", "randomizer.actions.expandAll");
    setTitle("#randomizer-export", "randomizer.actions.export.title");
    setTitle(
      "#randomizer-clear-favorites",
      "randomizer.actions.clearFavorites.title",
    );
    setTitle(
      "#randomizer-clear-excluded",
      "randomizer.actions.clearExcluded.title",
    );
    setTitle(
      "#randomizer-delete-selected",
      "randomizer.actions.deleteSelected.title",
    );
    setText("#randomizer-pool-empty span", "randomizer.pool.empty");
    setText("#randomizer-pool-refresh span", "randomizer.pool.refresh");
    setText(".result-hero .eyebrow", "randomizer.result.eyebrow");
    setTitle("#randomizer-copy", "randomizer.result.copy.title");
    setText(".randomizer-result .placeholder p", "randomizer.result.empty");
    const resultRoll = wrapper.querySelector(
      "#randomizer-roll span:last-child",
    );
    if (resultRoll) resultRoll.textContent = t("randomizer.action.start");
    setText(".randomizer-auto-card .eyebrow", "randomizer.auto.eyebrow");
    setText("#randomizer-auto-status", "randomizer.auto.status.off");
    const autoLabels = wrapper.querySelectorAll(
      ".randomizer-auto-grid .auto-field .label",
    );
    const autoLabelKeys = [
      "randomizer.auto.stop.label",
      "randomizer.auto.count.label",
      "randomizer.auto.match.label",
    ];
    autoLabels.forEach((el, idx) => {
      const key = autoLabelKeys[idx];
      if (key) el.textContent = t(key);
    });
    const autoStopOptions = wrapper.querySelectorAll(
      "#randomizer-auto-stop-mode option",
    );
    autoStopOptions.forEach((opt) => {
      const key = `randomizer.auto.stop.${opt.value}`;
      opt.textContent = t(key);
    });
    setPlaceholder(
      "#randomizer-auto-stop-text",
      "randomizer.auto.match.placeholder",
    );
    const autoToggles = wrapper.querySelectorAll(
      ".randomizer-auto-grid .auto-toggle span",
    );
    if (autoToggles[0])
      autoToggles[0].textContent = t("randomizer.auto.stop.emptyPool");
    if (autoToggles[1])
      autoToggles[1].textContent = t("randomizer.auto.notify.sound");
    if (autoToggles[2])
      autoToggles[2].textContent = t("randomizer.auto.notify.flash");
    setText("#randomizer-auto-toggle span", "randomizer.auto.startTimer");
    setTitle("#randomizer-auto-run-once", "randomizer.auto.runOnce.title");
    setTitle("#randomizer-tab-history", "randomizer.history.tab.history.title");
    setText("#randomizer-tab-history span", "randomizer.history.tab.history");
    setTitle("#randomizer-tab-stats", "randomizer.history.tab.stats.title");
    setText("#randomizer-tab-stats span", "randomizer.history.tab.stats");
    const historyTabsLabel = wrapper.querySelector(
      ".randomizer-history-card .history-tabs",
    );
    if (historyTabsLabel)
      historyTabsLabel.setAttribute(
        "aria-label",
        t("randomizer.history.title"),
      );
    const historyTabsTitle = wrapper.querySelector(
      ".randomizer-history-card .history-tabs-label",
    );
    if (historyTabsTitle)
      historyTabsTitle.textContent = t("randomizer.history.title");
    setText("#randomizer-history-empty span", "randomizer.history.empty");
    const historyRun = wrapper.querySelector("#randomizer-history-run span");
    if (historyRun) historyRun.textContent = t("randomizer.action.start");
    setText("#randomizer-history-clear span", "randomizer.history.clear");
    setTitle(
      "#randomizer-history-rare-toggle",
      "randomizer.history.rare.title",
    );
    setText(
      "#randomizer-history-rare-toggle span",
      "randomizer.history.rare.all",
    );
    setTitle("#randomizer-stats-export", "randomizer.stats.export.title");
    setTitle("#randomizer-stats-reset", "randomizer.stats.reset.title");

    applyI18n(wrapper);
  };

  localizeStatic();

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
  const expandAllBtn = wrapper.querySelector("#randomizer-expand-all");
  const exportButton = wrapper.querySelector("#randomizer-export");
  const rollButtons = wrapper.querySelectorAll(".randomizer-roll");
  const presetSelect = wrapper.querySelector("#randomizer-preset-select");
  const poolHintEl = wrapper.querySelector("#randomizer-pool-hint");
  const poolRefreshBtn = wrapper.querySelector("#randomizer-pool-refresh");
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
  const autoStopSelectUI = enhanceSelect(autoStopModeSelect, {
    addEvent: lifecycle.addEvent,
  });
  const toggleListBtn = wrapper.querySelector("#randomizer-toggle-list");
  const searchInput = wrapper.querySelector("#randomizer-search");
  const sortSelect = wrapper.querySelector("#randomizer-sort");
  const sortSelectUI = enhanceSelect(sortSelect, {
    addEvent: lifecycle.addEvent,
  });
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
  let lastSpinTickTs = 0;
  let lastAutoStatusTickTs = 0;
  let lastCarouselTickTs = 0;

  const getUiTickMs = (baseMs, hiddenMultiplier = 2) =>
    document.hidden ? baseMs * hiddenMultiplier : baseMs;

  const getBaseVisibleItems = () =>
    favoritesOnly ? items.filter((item) => item.favorite) : items;
  const getDisplayItems = () =>
    sortByMode(applySearchFilter(getBaseVisibleItems(), searchQuery));
  const setCountLabel = () => {
    const base = getBaseVisibleItems();
    const visible = getDisplayItems();
    const isEmpty = visible.length === 0;
    countEl.textContent = buildCountLabel({
      baseCount: base.length,
      declOfNum,
      favoritesOnly,
      isEn: getLanguage() === "en",
      searchActive: isSearchActive(),
      t,
      totalCount: items.length,
      visibleCount: visible.length,
    });
    exportButton.classList.toggle("hidden", isEmpty);
  };

  // Универсальный кастомный селект (общий с Backup)
  const { updateSummary, updatePoolHint, pulsePool } = createSummary({
    getState: () => state.getState(),
    elements: {
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
  const updateListVisibility = (hidden) => {
    isListHidden = hidden;
    wrapper.classList.toggle("is-list-hidden", hidden);
    if (toggleListBtn) {
      const span = toggleListBtn.querySelector("span");
      const icon = toggleListBtn.querySelector("i");
      toggleListBtn.dataset.state = hidden ? "hidden" : "shown";
      if (span)
        span.textContent = hidden
          ? t("randomizer.action.toggleList.show")
          : t("randomizer.action.toggleList.hide");
      if (icon)
        icon.className = hidden ? "fa-solid fa-list" : "fa-solid fa-list-check";
    }
  };
  const updateFavFilterUi = () => {
    if (!favFilterBtn) return;
    favFilterBtn.dataset.state = favoritesOnly ? "favorites" : "all";
    const span = favFilterBtn.querySelector("span");
    if (span)
      span.textContent = favoritesOnly
        ? t("randomizer.filters.favorites.favorites")
        : t("randomizer.filters.favorites.all");
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
      if (historyTabs[key])
        historyTabs[key].setAttribute(
          "aria-selected",
          key === target ? "true" : "false",
        );
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
    lastSpinTickTs = 0;
    if (spinCountdownValueEl)
      spinCountdownValueEl.textContent = t("randomizer.time.none");
  };
  const startSpinCountdown = (ms) => {
    if (!spinCountdownValueEl || !ms) return;
    clearSpinCountdown();
    const endAt = Date.now() + ms;
    const tick = () => {
      const left = Math.max(0, endAt - Date.now());
      const now = Date.now();
      if (left > 0 && now - lastSpinTickTs < getUiTickMs(200)) return;
      lastSpinTickTs = now;
      spinCountdownValueEl.textContent = t("randomizer.time.seconds", {
        seconds: (left / 1000).toFixed(1),
      });
      if (left <= 0) clearSpinCountdown();
    };
    tick();
    spinCountdownTimer = setInterval(tick, 200);
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
    const isEn = getLanguage() === "en";
    sorted.forEach((item) => {
      const miss = clampMisses(item.misses || 0);
      const hit = clampHits(item.hits || 0);
      const bar = document.createElement("div");
      bar.className = "spark-bar";
      bar.style.setProperty("--h", `${Math.max(6, (miss / maxMiss) * 100)}%`);
      const missLabel = isEn
        ? t("randomizer.stats.missLabel", { count: miss })
        : `${miss} ${declOfNum(miss, ["промах", "промаха", "промахов"])}`;
      const hitLabel = isEn
        ? t("randomizer.stats.hitLabel", { count: hit })
        : `${hit} ${declOfNum(hit, ["попадание", "попадания", "попаданий"])}`;
      const tooltip = t("randomizer.stats.tooltip", {
        value: item.value,
        misses: missLabel,
        hits: hitLabel,
      });
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
    lastAutoStatusTickTs = 0;
  };
  const startAutoStatusTicker = () => {
    if (autoStatusTimer) return;
    autoStatusTimer = setInterval(() => refreshAutoStatus(), 1000);
  };
  const refreshAutoStatus = (overrideText) => {
    const now = Date.now();
    if (
      !overrideText &&
      now - lastAutoStatusTickTs < getUiTickMs(1000)
    ) {
      return;
    }
    lastAutoStatusTickTs = now;

    const idleText = overrideText || t("randomizer.auto.status.off");
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
      setCountdown(t("randomizer.auto.status.countdownEmpty"));
      return;
    }
    const secondsLeft =
      autoNextAt && autoNextAt > now
        ? Math.max(0, ((autoNextAt - now) / 1000).toFixed(1))
        : "0.0";
    const limitLabel =
      settings.autoStopMode === "count"
        ? t("randomizer.auto.limit.count", {
            count: Math.max(
              0,
              clampAutoStopCount(settings.autoStopCount) - autoRuns,
            ),
          })
        : settings.autoStopMode === "match" && settings.autoStopMatch
          ? t("randomizer.auto.limit.match", { text: settings.autoStopMatch })
          : t("randomizer.auto.limit.manual");
    const lastLabel = lastResultValue
      ? t("randomizer.auto.limit.last", { value: lastResultValue })
      : "";
    const text =
      overrideText ||
      t("randomizer.auto.status.running", {
        interval: settings.autoRollInterval,
        limit: limitLabel,
        next: secondsLeft,
        last: lastLabel,
      });
    if (autoStatusEl) {
      autoStatusEl.textContent = text;
      autoStatusEl.dataset.state = "running";
    }
    if (autoStatusMiniEl) autoStatusMiniEl.textContent = text;
    if (autoChipEl) autoChipEl.dataset.state = "running";
    setCountdown(t("randomizer.auto.status.seconds", { seconds: secondsLeft }));
  };
  const updateAutoToggleUi = () => {
    const textEl = autoToggleBtn?.querySelector("span");
    const iconEl = autoToggleBtn?.querySelector("i");
    autoToggleBtn?.classList.toggle("is-active", autoEnabled);
    if (textEl)
      textEl.textContent = autoEnabled
        ? t("randomizer.auto.stopTimer")
        : t("randomizer.auto.startTimer");
    if (iconEl)
      iconEl.className = autoEnabled
        ? "fa-solid fa-stop"
        : "fa-solid fa-clock-rotate-left";

    const miniText = autoToggleHeroBtn?.querySelector("span");
    const miniIcon = autoToggleHeroBtn?.querySelector("i");
    autoToggleHeroBtn?.classList.toggle("is-active", autoEnabled);
    if (miniText)
      miniText.textContent = autoEnabled
        ? t("randomizer.auto.stop")
        : t("randomizer.auto.start");
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
    if (reason)
      showToast(t("randomizer.toast.autoStopped", { reason }), "info");
    refreshAutoStatus(
      reason ? t("randomizer.auto.status.stopped", { reason }) : undefined,
    );
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
    refreshAutoStatus(t("randomizer.auto.status.run", { count: autoRuns }));
    const result = await roll({
      source: "auto",
      metaLabel: t("randomizer.auto.metaLabel", { count: autoRuns }),
    });
    if (!autoEnabled) return;
    const stopReason = getAutoStopReason({
      autoRuns,
      itemsCount: items.length,
      poolSize: state.getState().pool?.length || 0,
      result,
      settings,
      t,
    });
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
      showToast(t("randomizer.toast.waitForRoll"), "info");
      return;
    }
    normalizePool();
    if (!items.length) {
      showToast(t("randomizer.toast.addBeforeAuto"), "warning");
      return;
    }
    if (settings.noRepeat && (!Array.isArray(pool) || pool.length === 0)) {
      showToast(t("randomizer.toast.poolEmpty"), "info");
      return;
    }
    autoRuns = 0;
    lastResultValue = "";
    autoEnabled = true;
    updateAutoToggleUi();
    updateRollAvailability();
    refreshAutoStatus();
    scheduleAutoRoll({ immediate });
    showToast(t("randomizer.toast.autoStarted"), "success");
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
      const replace = confirm(t("randomizer.preset.replaceConfirm"));
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
        <h4>${t("randomizer.preset.prompt.title")}</h4>
        <input type="text" class="preset-prompt-input" maxlength="80" />
        <div class="preset-prompt-actions">
          <button type="button" class="btn btn-ghost" data-action="cancel">${t("randomizer.preset.prompt.cancel")}</button>
          <button type="button" class="btn btn-primary" data-action="ok">${t("randomizer.preset.prompt.ok")}</button>
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
          showToast(t("randomizer.toast.enterPresetName"), "warning");
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
      return prompt(t("randomizer.preset.prompt.title"), initialValue);
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
      showToast(t("randomizer.toast.textEmpty"), "warning");
      return false;
    }
    if (trimmed.length > MAX_ITEM_LENGTH) {
      showToast(t("randomizer.toast.textTooLong"), "warning");
      return false;
    }
    const duplicate = items.some(
      (entry) =>
        entry.value.toLowerCase() === trimmed.toLowerCase() &&
        entry.value.toLowerCase() !== oldValue.toLowerCase(),
    );
    if (duplicate) {
      showToast(t("randomizer.toast.textExists"), "info");
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
    showToast(t("randomizer.toast.statsReset"), "success");
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
      if (!silent) showToast(t("randomizer.toast.deletedSelected"), "success");
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
          showToast(t("randomizer.toast.clipboardEmpty"), "info");
          return;
        }
        bulkAdd(entries);
      } catch {
        showToast(t("randomizer.toast.clipboardReadError"), "error");
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

  if (expandAllBtn) {
    expandAllBtn.addEventListener("click", () => {
      const isCollapsed = expandAllBtn.dataset.state !== "expanded";
      if (isCollapsed) {
        renderItemsImpl.expandAll?.();
        expandAllBtn.dataset.state = "expanded";
        expandAllBtn.title = t("randomizer.actions.collapseAll.title");
        const icon = expandAllBtn.querySelector("i");
        if (icon) icon.className = "fa-solid fa-angles-up";
        const label = expandAllBtn.querySelector("span");
        if (label) label.textContent = t("randomizer.actions.collapseAll");
      } else {
        renderItemsImpl.collapseAll?.();
        expandAllBtn.dataset.state = "collapsed";
        expandAllBtn.title = t("randomizer.actions.expandAll.title");
        const icon = expandAllBtn.querySelector("i");
        if (icon) icon.className = "fa-solid fa-angles-down";
        const label = expandAllBtn.querySelector("span");
        if (label) label.textContent = t("randomizer.actions.expandAll");
      }
    });
  }

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
    lastCarouselTickTs = 0;
    resultContainer.classList.remove("carousel");
  };

  const startCarousel = (values) => {
    stopCarousel();
    if (!values?.length) return;
    const queue = values.map((item) => item.value);
    let index = 0;
    resultContainer.classList.add("carousel");
    carouselTimer = setInterval(() => {
      const now = Date.now();
      if (now - lastCarouselTickTs < getUiTickMs(300)) return;
      lastCarouselTickTs = now;
      resultUI.setResult(
        queue[index % queue.length],
        t("randomizer.result.mixing"),
      );
      index += 1;
    }, 300);
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
      resultUI.setResult(value, t("randomizer.result.previous"));
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
      if (span)
        span.textContent = rare
          ? t("randomizer.history.rare.rare")
          : t("randomizer.history.rare.all");
      rareToggleBtn.classList.toggle("is-active", rare);
    },
    onExportStats: (getText) => {
      if (!statsExportBtn || statsExportBtn.dataset.wired === "1") return;
      statsExportBtn.dataset.wired = "1";
      statsExportBtn.addEventListener("click", async () => {
        const data = getText(rareToggleBtn?.dataset.state === "rare");
        if (!data) {
          showToast(t("randomizer.toast.statsEmpty"), "info");
          return;
        }
        try {
          await navigator.clipboard.writeText(data);
          showToast(t("randomizer.toast.statsCopied"), "success");
        } catch {
          showToast(t("randomizer.toast.statsCopyError"), "error");
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
      if (!silent) showToast(t("randomizer.toast.enterItemText"), "warning");
      return false;
    }
    if (normalized.length > MAX_ITEM_LENGTH) {
      if (!silent) showToast(t("randomizer.toast.itemTooLong"), "warning");
      return false;
    }
    const exists = items.some(
      (item) => item.value.toLowerCase() === normalized.toLowerCase(),
    );
    if (exists) {
      if (!silent) showToast(t("randomizer.toast.itemExists"), "info");
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
      const isEn = getLanguage() === "en";
      const message = isEn
        ? t("randomizer.toast.addedCount", { count: added })
        : `Добавлено ${added} ${declOfNum(added, ["элемент", "элемента", "элементов"])}`;
      showToast(message, "success");
    } else {
      showToast(t("randomizer.toast.noNewItems"), "info");
    }
  };

  const roll = ({ source = "manual", metaLabel } = {}) => {
    if (isRolling) return Promise.resolve(null);
    clearSpinCountdown();
    if (!items.length) {
      showToast(t("randomizer.toast.addFirst"), "warning");
      return Promise.resolve(null);
    }
    const sourceItems = favoritesOnly
      ? items.filter((item) => item.favorite)
      : items;
    if (!sourceItems.length) {
      showToast(t("randomizer.toast.markFavorites"), "info");
      return Promise.resolve(null);
    }
    normalizePool();
    const candidates = settings.noRepeat
      ? sourceItems.filter((item) => pool.includes(item.value))
      : sourceItems;
    if (!candidates.length) {
      showToast(t("randomizer.toast.noAvailableItems"), "info");
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
            showToast(t("randomizer.toast.noAvailableItems"), "info");
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

          const locale = getLanguage() === "en" ? "en-US" : "ru-RU";
          const timeLabel = new Intl.DateTimeFormat(locale, {
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
      stopAutoRoll(t("randomizer.auto.stopReason.manualStop"));
    } else {
      startAutoRoll();
    }
  });
  autoToggleHeroBtn?.addEventListener("click", () => {
    if (autoEnabled) {
      stopAutoRoll(t("randomizer.auto.stopReason.manualStop"));
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
      changed
        ? t("randomizer.toast.favoritesCleared")
        : t("randomizer.toast.favoritesNothing"),
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
        ? t("randomizer.toast.excludedReturned")
        : t("randomizer.toast.excludedNone"),
      restored ? "success" : "info",
    );
  });

  wireRollControls(wrapper, () => roll());

  wrapper.querySelector("#randomizer-add")?.addEventListener("click", () => {
    const entries = parseEntries(inputEl.value);
    if (!entries.length) {
      showToast(t("randomizer.toast.enterItemText"), "warning");
      inputEl.focus();
      return;
    }
    if (entries.length === 1) {
      const ok = addItem(entries[0], true);
      if (ok) showToast(t("randomizer.toast.itemAdded"), "success");
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
          showToast(t("randomizer.toast.clipboardEmpty"), "info");
          return;
        }
        const preview = entries.slice(0, 5).join("\n");
        const confirmText =
          entries.length > 5
            ? t("randomizer.confirm.addListMore", {
                preview,
                count: entries.length - 5,
              })
            : t("randomizer.confirm.addList", { preview });
        if (!confirm(confirmText)) return;
        bulkAdd(entries);
        inputEl.value = "";
      } catch {
        showToast(t("randomizer.toast.clipboardReadError"), "error");
      }
    });

  wrapper.querySelector("#randomizer-sample")?.addEventListener("click", () => {
    bulkAdd(DEFAULT_ITEMS);
  });

  wrapper
    .querySelector("#randomizer-copy")
    ?.addEventListener("click", async () => {
      if (!resultText.textContent) {
        showToast(t("randomizer.toast.nothingToCopy"), "info");
        return;
      }
      try {
        await navigator.clipboard.writeText(resultText.textContent);
        showToast(t("randomizer.toast.resultCopied"), "success");
      } catch {
        showToast(t("randomizer.toast.resultCopyError"), "error");
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
    if (!confirm(t("randomizer.confirm.resetStats"))) return;
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
        showToast(t("randomizer.toast.listEmpty"), "info");
        return;
      }
      try {
        await navigator.clipboard.writeText(
          items.map((item) => item.value).join("\n"),
        );
        showToast(t("randomizer.toast.listCopied"), "success");
      } catch {
        showToast(t("randomizer.toast.listCopyError"), "error");
      }
    });

  wrapper
    .querySelector("#randomizer-reset-pool")
    ?.addEventListener("click", () => {
      resetPool();
      renderItems();
      showToast(t("randomizer.toast.poolRefreshed"), "success");
    });

  poolRefreshBtn?.addEventListener("click", () => {
    resetPool();
    renderItems();
    showToast(t("randomizer.toast.poolRefreshed"), "success");
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
      showToast(t("randomizer.toast.deletedSelected"), "success");
    },
    onClear: () => {
      state.removeItems(
        new Set(state.getState().items.map((item) => item.value)),
      );
      syncState();
      selectedItems.clear();
      renderItems();
      clearResult();
      showToast(t("randomizer.toast.listCleared"), "success");
    },
    showToast,
  });

  noRepeatToggle.checked = !!settings.noRepeat;
  lifecycle.addEvent(noRepeatToggle, "change", () => {
    settings.noRepeat = noRepeatToggle.checked;
    persistSettings();
    resetPool();
    renderItems();
    refreshAutoStatus();
    restartAutoIfRunning();
  });

  renderItems();
  renderHistory();
  const initialTooltipsTimer = setTimeout(() => initTooltips(), 0);
  lifecycle.setTimer("timeout", initialTooltipsTimer);
  lifecycle.addEvent(window, "i18n:changed", () => {
    localizeStatic();
    setCountLabel();
    updateFavFilterUi();
    updateAutoToggleUi();
    refreshAutoStatus();
    renderHistory();
    renderItems();
  });
  lifecycle.addEvent(document, "visibilitychange", () => {
    if (autoEnabled) refreshAutoStatus();
  });

  const dispose = () => {
    stopAutoRoll();
    stopCarousel();
    clearSpinCountdown();
    if (flashTimer) clearTimeout(flashTimer);
    if (audioContext?.close) {
      try {
        audioContext.close();
      } catch {}
    }
    lifecycle.dispose();
  };

  return {
    dispose,
    element: wrapper,
  };
}
