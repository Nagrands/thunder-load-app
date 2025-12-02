// src/js/modules/filterAndSortHistory.js

import { getHistoryData, state } from "./state.js";
import { renderHistory } from "./history.js";

let lastRenderedKey = "";
let lastQuery = "";

const MIN_PAGE_SIZE = 4;
const MAX_PAGE_SIZE = 200;
const DEFAULT_PAGE_SIZE = 20;

const getHost = (url = "") => {
  if (!url) return "";
  try {
    return new URL(url).hostname.replace(/^www\./, "");
  } catch {
    return "";
  }
};

const normalizePageSize = (value) => {
  const n = Number(value);
  if (!Number.isFinite(n) || n <= 0) return DEFAULT_PAGE_SIZE;
  return Math.max(MIN_PAGE_SIZE, Math.min(MAX_PAGE_SIZE, Math.floor(n)));
};

function filterAndSortHistory(
  query,
  sortOrder = "desc",
  forceRender = false,
  _isRetry = false,
) {
  const allEntries = getHistoryData();
  const q = query.trim().toLowerCase();
  const sourceFilter = (state.historySourceFilter || "").toLowerCase();
  const qualityFilter = (state.historyQualityFilter || "").toLowerCase();

  if (q !== lastQuery) {
    lastQuery = q;
    state.historyPage = 1;
  }

  // Сброс "зависших" фильтров, когда таких значений больше нет в данных.
  const availableHosts = new Set();
  const availableQualities = new Set();
  allEntries.forEach((entry) => {
    const host = getHost(entry.sourceUrl).toLowerCase();
    if (host) availableHosts.add(host);
    const quality = (entry.quality || entry.resolution || "").toLowerCase();
    if (quality) availableQualities.add(quality);
  });

  let filtersNormalized = false;
  if (sourceFilter && !availableHosts.has(sourceFilter)) {
    state.historySourceFilter = "";
    try {
      localStorage.removeItem("historySourceFilter");
    } catch {}
    filtersNormalized = true;
  }
  if (qualityFilter && !availableQualities.has(qualityFilter)) {
    state.historyQualityFilter = "";
    try {
      localStorage.removeItem("historyQualityFilter");
    } catch {}
    filtersNormalized = true;
  }

  if (filtersNormalized && !_isRetry) {
    // Повторяем фильтрацию с очищенными фильтрами, чтобы вернуть результаты.
    return filterAndSortHistory(query, sortOrder, true, true);
  }

  // Поддерживаем валидный размер страницы (с сохранением в localStorage).
  state.historyPageSize = normalizePageSize(state.historyPageSize);
  try {
    localStorage.setItem("historyPageSize", String(state.historyPageSize));
  } catch {}

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

  const filteredByFacet = filtered.filter((entry) => {
    const host = getHost(entry.sourceUrl).toLowerCase();
    const quality = (entry.quality || entry.resolution || "").toLowerCase();
    const matchesSource = !sourceFilter || host === sourceFilter;
    const matchesQuality =
      !qualityFilter ||
      quality === qualityFilter ||
      quality.includes(qualityFilter);
    return matchesSource && matchesQuality;
  });

  const sorted = filteredByFacet.sort((a, b) => {
    const aTime = new Date(a.timestamp);
    const bTime = new Date(b.timestamp);
    return sortOrder === "asc" ? aTime - bTime : bTime - aTime;
  });

  const totalEntries = sorted.length;
  const totalPages = Math.max(
    1,
    Math.ceil(totalEntries / state.historyPageSize),
  );
  if (state.historyPage > totalPages) {
    state.historyPage = totalPages;
  }
  if (state.historyPage < 1) state.historyPage = 1;

  const renderKey = `${filteredByFacet
    .map((e) => `${e.id}|${e.timestamp}`)
    .join(
      ",",
    )}|p${state.historyPage}|s${state.historyPageSize}|src${sourceFilter}|q${qualityFilter}`;

  if (!forceRender && renderKey === lastRenderedKey) {
    return;
  }

  lastRenderedKey = renderKey;
  const start = (state.historyPage - 1) * state.historyPageSize;
  const pageEntries = sorted.slice(start, start + state.historyPageSize);

  renderHistory(pageEntries, {
    page: state.historyPage,
    pageSize: state.historyPageSize,
    totalEntries,
    totalPages,
    paged: true,
    fullEntries: sorted,
  });
}

export { filterAndSortHistory };
