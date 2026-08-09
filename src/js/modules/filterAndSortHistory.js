import { getHistoryData, state } from "./state.js";
import { renderHistory } from "./history.js";
import { selectHistoryEntries } from "./features/history/selectors.js";

let lastRenderedKey = "";
let lastQuery = "";
const normalizePageSize = (value) => {
  const number = Number(value);
  if (!Number.isFinite(number) || number <= 0) return 20;
  return Math.max(4, Math.min(200, Math.floor(number)));
};

function filterAndSortHistory(query, sortOrder = "desc", forceRender = false) {
  const normalizedQuery = String(query || "")
    .trim()
    .toLowerCase();
  if (normalizedQuery !== lastQuery) {
    lastQuery = normalizedQuery;
    state.historyPage = 1;
  }
  state.historyPageSize = normalizePageSize(state.historyPageSize);
  try {
    localStorage.setItem("historyPageSize", String(state.historyPageSize));
  } catch {}
  const sorted = selectHistoryEntries(getHistoryData(), {
    query: normalizedQuery,
    source: state.historySourceFilter,
    mode: state.currentSortMode,
    sortKey: state.currentSortKey,
    sortOrder,
  });
  const totalEntries = sorted.length;
  const totalPages = Math.max(
    1,
    Math.ceil(totalEntries / state.historyPageSize),
  );
  state.historyPage = Math.max(1, Math.min(state.historyPage, totalPages));
  const renderKey = `${sorted.map((entry) => `${entry.id}|${entry.timestamp}`).join(",")}|p${state.historyPage}|s${state.historyPageSize}|q${normalizedQuery}|src${state.historySourceFilter}|k${state.currentSortKey}|o${sortOrder}|m${state.currentSortMode}`;
  if (!forceRender && renderKey === lastRenderedKey) return;
  lastRenderedKey = renderKey;
  const start = (state.historyPage - 1) * state.historyPageSize;
  renderHistory(sorted.slice(start, start + state.historyPageSize), {
    page: state.historyPage,
    pageSize: state.historyPageSize,
    totalEntries,
    totalPages,
    paged: true,
    fullEntries: sorted,
  });
}

export { filterAndSortHistory };
