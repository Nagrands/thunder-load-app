// src/js/modules/randomizer/ui/history.js

import { escapeHtml, clampHits, clampMisses, RARE_STREAK } from "../helpers.js";

export function createHistoryRenderer({
  getState,
  historyList,
  historyEmpty,
  onSelectEntry,
  statsTable,
  getRareOnly = () => false,
  onStatsToggle,
  onExportStats,
}) {
  const renderStats = () => {
    if (!statsTable) return;
    const { items } = getState();
    const rows = items
      .slice()
      .filter(
        (item) =>
          !getRareOnly() || clampMisses(item.misses || 0) >= RARE_STREAK,
      )
      .sort((a, b) => clampMisses(b.misses || 0) - clampMisses(a.misses || 0));
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
    header.innerHTML = `
      <span>Вариант</span>
      <span>Промахи</span>
      <span>Выпадения</span>
    `;
    statsTable.appendChild(header);

    rows.slice(0, 30).forEach((item) => {
      const row = document.createElement("div");
      row.className = "stats-row";
      row.innerHTML = `
        <span class="stat-text">${escapeHtml(item.value)}</span>
        <span class="stat-miss">${clampMisses(item.misses || 0)}</span>
        <span class="stat-hit">${clampHits(item.hits || 0)}</span>
      `;
      if (clampMisses(item.misses || 0) >= RARE_STREAK) {
        row.classList.add("is-rare");
      }
      statsTable.appendChild(row);
    });
  };

  return function renderHistory() {
    const { history } = getState();
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
    renderStats();
    onStatsToggle?.(getRareOnly());
    onExportStats?.((rareOnlyItems) => {
      const { items } = getState();
      const rows = items
        .slice()
        .filter(
          (item) =>
            !rareOnlyItems || clampMisses(item.misses || 0) >= RARE_STREAK,
        )
        .sort(
          (a, b) => clampMisses(b.misses || 0) - clampMisses(a.misses || 0),
        );
      const lines = rows.map(
        (item) =>
          `${item.value}\tmisses:${clampMisses(item.misses || 0)}\thits:${clampHits(item.hits || 0)}`,
      );
      return lines.join("\n");
    });
  };
}
