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

const isAudioEntry = (entry) => {
  const quality = entry?.quality || entry?.resolution || entry?.format || "";
  return /audio/i.test(String(quality)) || /audio only/i.test(String(quality));
};

const parseSizeBytes = (entry) => {
  if (!entry) return NaN;
  if (Number.isFinite(entry.size)) return Number(entry.size);
  const raw = entry.formattedSize || entry.size || "";
  const str = String(raw).trim().replace(/,/g, ".");
  const match = str.match(/([0-9.]+)\s*(b|kb|mb|gb|tb)/i);
  if (!match) return NaN;
  const value = Number(match[1]);
  if (!Number.isFinite(value)) return NaN;
  const unit = match[2].toLowerCase();
  const multipliers = {
    b: 1,
    kb: 1024,
    mb: 1024 ** 2,
    gb: 1024 ** 3,
    tb: 1024 ** 4,
  };
  return value * (multipliers[unit] || 1);
};

const parseQualityValue = (entry) => {
  if (!entry) return NaN;
  const q = String(entry.quality || entry.resolution || "").toLowerCase();
  if (!q) return NaN;

  // Audio: try bitrate first
  if (q.includes("audio")) {
    const kbpsMatch = q.match(/(\d{2,4})\s*kbps/);
    if (kbpsMatch) return Number(kbpsMatch[1]);
    const audioOnly = q.match(/(\d{2,4})\s*k/);
    if (audioOnly) return Number(audioOnly[1]);
    return 0;
  }

  const resMatch = q.match(/(\d{3,4})x(\d{3,4})/);
  if (resMatch) return Number(resMatch[2]);
  const pMatch = q.match(/(\d{3,4})\s*p/);
  if (pMatch) return Number(pMatch[1]);

  if (q.includes("8k")) return 4320;
  if (q.includes("5k")) return 2880;
  if (q.includes("4k") || q.includes("uhd")) return 2160;
  if (q.includes("qhd") || q.includes("1440")) return 1440;
  if (q.includes("fhd") || q.includes("1080")) return 1080;
  if (q.includes("hd") || q.includes("720")) return 720;
  if (q.includes("sd") || q.includes("480")) return 480;
  if (q.includes("360")) return 360;
  if (q.includes("240")) return 240;

  const numMatch = q.match(/(\d{3,4})/);
  return numMatch ? Number(numMatch[1]) : NaN;
};

const parseTimestampValue = (entry) => {
  if (!entry) return NaN;
  const t = new Date(entry.timestamp).getTime();
  return Number.isNaN(t) ? NaN : t;
};

const compareValues = (a, b, order = "desc") => {
  const aMissing = a === null || a === undefined || a === "" || Number.isNaN(a);
  const bMissing = b === null || b === undefined || b === "" || Number.isNaN(b);
  if (aMissing && bMissing) return 0;
  if (aMissing) return 1;
  if (bMissing) return -1;
  let cmp = 0;
  if (typeof a === "string" || typeof b === "string") {
    cmp = String(a).localeCompare(String(b), undefined, {
      numeric: true,
      sensitivity: "base",
    });
  } else {
    cmp = Number(a) - Number(b);
  }
  return order === "asc" ? cmp : -cmp;
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
  const sortKey = state.currentSortKey || "date";
  const sortMode = state.currentSortMode || "mixed";

  if (q !== lastQuery) {
    lastQuery = q;
    state.historyPage = 1;
  }

  // Сброс "зависших" фильтров, когда таких значений больше нет в данных.
  const availableHosts = new Set();
  allEntries.forEach((entry) => {
    const host = getHost(entry.sourceUrl).toLowerCase();
    if (host) availableHosts.add(host);
  });

  let filtersNormalized = false;
  if (sourceFilter && !availableHosts.has(sourceFilter)) {
    state.historySourceFilter = "";
    try {
      localStorage.removeItem("historySourceFilter");
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
    const matchesSource = !sourceFilter || host === sourceFilter;
    return matchesSource;
  });

  const filteredByType = filteredByFacet.filter((entry) => {
    if (sortMode === "audio") return isAudioEntry(entry);
    if (sortMode === "video") return !isAudioEntry(entry);
    return true;
  });

  const sorted = filteredByType
    .map((entry, index) => ({ entry, index }))
    .sort((a, b) => {
      const aEntry = a.entry;
      const bEntry = b.entry;
      let cmp = 0;
      if (sortKey === "size" || sortKey === "quality") {
        const typeA = isAudioEntry(aEntry) ? 1 : 0;
        const typeB = isAudioEntry(bEntry) ? 1 : 0;
        if (sortMode === "audio") {
          cmp = compareValues(typeA, typeB, "desc");
        } else if (sortMode === "mixed") {
          cmp = 0;
        } else {
          cmp = compareValues(typeA, typeB, "asc");
        }
        if (cmp !== 0) return cmp;
      }
      if (sortKey === "size") {
        cmp = compareValues(
          parseSizeBytes(aEntry),
          parseSizeBytes(bEntry),
          sortOrder,
        );
        if (cmp !== 0) return cmp;
        // Secondary: date
        cmp = compareValues(
          parseTimestampValue(aEntry),
          parseTimestampValue(bEntry),
          sortOrder,
        );
      } else if (sortKey === "quality") {
        cmp = compareValues(
          parseQualityValue(aEntry),
          parseQualityValue(bEntry),
          sortOrder,
        );
        if (cmp !== 0) return cmp;
        // Secondary: date
        cmp = compareValues(
          parseTimestampValue(aEntry),
          parseTimestampValue(bEntry),
          sortOrder,
        );
      } else if (sortKey === "source") {
        cmp = compareValues(
          getHost(aEntry.sourceUrl).toLowerCase(),
          getHost(bEntry.sourceUrl).toLowerCase(),
          sortOrder,
        );
        if (cmp !== 0) return cmp;
        // Secondary: file name
        cmp = compareValues(
          aEntry.fileName || "",
          bEntry.fileName || "",
          "asc",
        );
        if (cmp !== 0) return cmp;
        // Tertiary: date (newer first)
        cmp = compareValues(
          parseTimestampValue(aEntry),
          parseTimestampValue(bEntry),
          "desc",
        );
      } else {
        cmp = compareValues(
          parseTimestampValue(aEntry),
          parseTimestampValue(bEntry),
          sortOrder,
        );
      }
      if (cmp !== 0) return cmp;
      return a.index - b.index;
    })
    .map((item) => item.entry);

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
    )}|p${state.historyPage}|s${state.historyPageSize}|src${sourceFilter}|k${sortKey}|o${sortOrder}|m${sortMode}`;

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
