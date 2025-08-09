// src\js\modules\filterAndSortHistory.js

import { getHistoryData } from "./state.js";
import { renderHistory } from "./history.js";

let lastRenderedKey = "";

/**
 * Фильтрует и сортирует записи истории.
 * @param {string} query - Текст из строки поиска.
 * @param {string} sortOrder - Порядок сортировки: "asc" или "desc".
 * @param {boolean} forceRender - Принудительно вызвать renderHistory даже при совпадении данных.
 */
function filterAndSortHistory(query, sortOrder = "desc", forceRender = false) {
  const allEntries = getHistoryData();
  const q = query.trim().toLowerCase();

  const filtered = q
    ? allEntries.filter(
        (entry) =>
          entry.fileName?.toLowerCase().includes(q) ||
          entry.sourceUrl?.toLowerCase().includes(q) ||
          entry.dateText?.toLowerCase().includes(q) ||
          entry.quality?.toLowerCase().includes(q) ||
          entry.formattedSize?.toLowerCase().includes(q),
      )
    : allEntries;

  const sorted = filtered.sort((a, b) => {
    const aTime = new Date(a.timestamp);
    const bTime = new Date(b.timestamp);
    return sortOrder === "asc" ? aTime - bTime : bTime - aTime;
  });

  const renderKey = sorted.map((e) => `${e.id}|${e.timestamp}`).join(",");

  if (!forceRender && renderKey === lastRenderedKey) {
    return;
  }

  lastRenderedKey = renderKey;
  renderHistory(sorted);
}

export { filterAndSortHistory };
