// src/js/modules/randomizer/ui/history.js

import {
  escapeHtml,
  clampHits,
  clampMisses,
  clampRareThreshold,
  RARE_STREAK,
} from "../helpers.js";

export function createHistoryRenderer({
  getState,
  historyList,
  historyEmpty,
  onSelectEntry,
  statsTable,
  getRareOnly = () => false,
  getRareThreshold = () => RARE_STREAK,
  getSort = () => ({ key: "misses", dir: "desc" }),
  onChangeSort,
  onStatsToggle,
  onExportStats,
  initTooltips,
}) {
  const getThreshold = () =>
    clampRareThreshold(getRareThreshold ? getRareThreshold() : RARE_STREAK);

  const sortRows = (rows) => {
    const { key, dir } = getSort?.() || { key: "misses", dir: "desc" };
    const mul = dir === "asc" ? 1 : -1;
    const safeKey = ["value", "hits", "misses"].includes(key) ? key : "misses";
    return rows.sort((a, b) => {
      const lhs =
        safeKey === "value"
          ? a.value.toLowerCase()
          : safeKey === "hits"
            ? clampHits(a.hits || 0)
            : clampMisses(a.misses || 0);
      const rhs =
        safeKey === "value"
          ? b.value.toLowerCase()
          : safeKey === "hits"
            ? clampHits(b.hits || 0)
            : clampMisses(b.misses || 0);

      if (lhs === rhs) return 0;
      if (lhs > rhs) return 1 * mul;
      return -1 * mul;
    });
  };

  const buildSortButton = (label, key) => {
    const { key: activeKey, dir } = getSort?.() || {};
    const isActive = activeKey === key;
    const button = document.createElement("button");
    button.type = "button";
    button.className = "stats-sort";
    button.dataset.key = key;
    button.dataset.dir = isActive ? dir || "desc" : "desc";
    if (isActive) button.classList.add("is-active");
    button.innerHTML = `
      <span>${label}</span>
      <i class="fa-solid fa-arrow-${
        button.dataset.dir === "asc" ? "up" : "down"
      }-short-wide"></i>
    `;
    button.addEventListener("click", () => {
      const nextDir =
        isActive && button.dataset.dir === "desc" ? "asc" : "desc";
      onChangeSort?.({ key, dir: nextDir });
    });
    return button;
  };

  const renderStats = () => {
    if (!statsTable) return;
    const { items } = getState();
    const rareThreshold = getThreshold();
    const rows = items
      .slice()
      .filter(
        (item) =>
          !getRareOnly() ||
          clampMisses(item.misses || 0) >= clampRareThreshold(rareThreshold),
      );
    sortRows(rows);
    statsTable.innerHTML = "";
    if (!rows.length) {
      const empty = document.createElement("div");
      empty.className = "stats-empty";
      empty.textContent = getRareOnly()
        ? "Нет редких вариантов."
        : "Статистика пока пуста.";
      statsTable.appendChild(empty);
      return;
    }
    const header = document.createElement("div");
    header.className = "stats-row stats-head";
    const textHead = document.createElement("div");
    textHead.appendChild(buildSortButton("Вариант", "value"));
    const missHead = document.createElement("div");
      missHead.appendChild(buildSortButton("Промахи", "misses"));
      const hitHead = document.createElement("div");
      hitHead.appendChild(buildSortButton("Выпадения", "hits"));
      header.append(textHead, missHead, hitHead);
      statsTable.appendChild(header);

    const ensureTooltips = () => {
      if (typeof initTooltips === "function") {
        setTimeout(() => initTooltips(), 0);
      }
    };

    rows.slice(0, 30).forEach((item) => {
      const row = document.createElement("div");
      row.className = "stats-row";
      const valueText = escapeHtml(item.value);
      row.innerHTML = `
        <span class="stat-text" title="${valueText}" data-bs-toggle="tooltip" data-bs-placement="top">${valueText}</span>
        <span class="stat-miss">${clampMisses(item.misses || 0)}</span>
        <span class="stat-hit">${clampHits(item.hits || 0)}</span>
      `;
      if (clampMisses(item.misses || 0) >= rareThreshold) {
        row.classList.add("is-rare");
      }
      statsTable.appendChild(row);
    });
    ensureTooltips();
  };

  const makeExportText = (rareOnlyItems = false) => {
    const { items } = getState();
    const rareThreshold = getThreshold();
    const rows = items
      .slice()
      .filter(
        (item) =>
          !rareOnlyItems || clampMisses(item.misses || 0) >= rareThreshold,
      );
    sortRows(rows);
    const lines = rows.map(
      (item) =>
        `${item.value}\tmisses:${clampMisses(item.misses || 0)}\thits:${clampHits(item.hits || 0)}`,
    );
    return lines.join("\n");
  };

  let exportWired = false;

  return function renderHistory() {
    const { history } = getState();
    historyList.innerHTML = "";
    if (!history.length) {
      historyEmpty.classList.remove("hidden");
    } else {
      historyEmpty.classList.add("hidden");
      const fragment = document.createDocumentFragment();
      history.forEach((entry) => {
        const li = document.createElement("li");
        const button = document.createElement("button");
        button.type = "button";
        button.className = "history-entry";
        button.dataset.value = entry.value;
        const presetLabel = entry.preset ? escapeHtml(entry.preset) : "—";
        button.innerHTML = `
          <span class="text">${escapeHtml(entry.value)}</span>
          <span class="meta">
            <span class="preset" title="Шаблон">${presetLabel}</span>
            <span class="time">${new Intl.DateTimeFormat("ru-RU", {
              hour: "2-digit",
              minute: "2-digit",
            }).format(entry.ts)}</span>
          </span>
        `;
        button.addEventListener("click", () => {
          onSelectEntry(entry.value);
        });
        li.appendChild(button);
        fragment.appendChild(li);
      });
      historyList.appendChild(fragment);
    }
    renderStats();
    onStatsToggle?.(getRareOnly());
    if (!exportWired) {
      onExportStats?.((rareOnlyItems) => makeExportText(rareOnlyItems));
      exportWired = true;
    }
  };
}
