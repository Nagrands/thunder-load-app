const getHistorySourceHost = (url = "") => {
  try {
    return new URL(url).hostname.replace(/^www\./, "").toLowerCase();
  } catch {
    return "";
  }
};

const isAudioHistoryEntry = (entry) => {
  const quality = entry?.quality || entry?.resolution || entry?.format || "";
  return /audio/i.test(String(quality));
};

const isFailedHistoryEntry = (entry) =>
  entry?.downloadStatus === "failed" ||
  entry?.status === "failed" ||
  entry?.status === "error" ||
  entry?.error === true;

const matchesHistoryStatus = (entry, status = "all") => {
  if (status === "missing") {
    return Boolean(entry?.isMissing) && !isFailedHistoryEntry(entry);
  }
  if (status === "error") return isFailedHistoryEntry(entry);
  if (status === "available") {
    return !entry?.isMissing && !isFailedHistoryEntry(entry);
  }
  return true;
};

const selectHistoryEntriesByStatus = (entries, status = "all") =>
  entries.filter((entry) => matchesHistoryStatus(entry, status));

const selectHistoryEntriesByIds = (entries, ids = []) => {
  const selectedIds = new Set(ids.map(String));
  return entries.filter((entry) => selectedIds.has(String(entry?.id)));
};

const parseHistorySize = (entry) => {
  if (Number.isFinite(entry?.sizeBytes)) return Number(entry.sizeBytes);
  if (Number.isFinite(entry?.size)) return Number(entry.size);
  const match = String(entry?.formattedSize || entry?.size || "")
    .trim()
    .replace(/,/g, ".")
    .match(/([0-9.]+)\s*(b|kb|mb|gb|tb)/i);
  if (!match) return NaN;
  const multipliers = {
    b: 1,
    kb: 1024,
    mb: 1024 ** 2,
    gb: 1024 ** 3,
    tb: 1024 ** 4,
  };
  return Number(match[1]) * multipliers[match[2].toLowerCase()];
};

const parseHistoryQuality = (entry) => {
  const quality = String(
    entry?.quality || entry?.resolution || "",
  ).toLowerCase();
  const audio = quality.match(/(\d{2,4})\s*k(?:bps)?/);
  if (quality.includes("audio")) return audio ? Number(audio[1]) : 0;
  const resolution =
    quality.match(/\d{3,4}x(\d{3,4})/) || quality.match(/(\d{3,4})\s*p/);
  if (resolution) return Number(resolution[1]);
  if (quality.includes("8k")) return 4320;
  if (quality.includes("5k")) return 2880;
  if (quality.includes("4k") || quality.includes("uhd")) return 2160;
  if (quality.includes("qhd") || quality.includes("1440")) return 1440;
  if (quality.includes("fhd") || quality.includes("1080")) return 1080;
  if (quality.includes("hd") || quality.includes("720")) return 720;
  return Number(quality.match(/(\d{3,4})/)?.[1]) || NaN;
};

const compareHistoryValues = (left, right, order = "desc") => {
  const leftMissing =
    left === null || left === undefined || left === "" || Number.isNaN(left);
  const rightMissing =
    right === null ||
    right === undefined ||
    right === "" ||
    Number.isNaN(right);
  if (leftMissing && rightMissing) return 0;
  if (leftMissing) return 1;
  if (rightMissing) return -1;
  const comparison =
    typeof left === "string" || typeof right === "string"
      ? String(left).localeCompare(String(right), undefined, {
          numeric: true,
          sensitivity: "base",
        })
      : Number(left) - Number(right);
  return order === "asc" ? comparison : -comparison;
};

const matchesHistorySearch = (entry, query) =>
  [
    entry.fileName,
    entry.sourceUrl,
    entry.dateText,
    entry.quality,
    entry.formattedSize,
  ].some((value) =>
    String(value || "")
      .toLowerCase()
      .includes(query),
  );

function selectHistoryEntries(entries, options = {}) {
  const query = String(options.query || "")
    .trim()
    .toLowerCase();
  const source = String(options.source || "").toLowerCase();
  const status = options.status || "all";
  const mode = options.mode || "mixed";
  const sortKey = options.sortKey || "date";
  const sortOrder = options.sortOrder || "desc";
  return entries
    .filter((entry) => !query || matchesHistorySearch(entry, query))
    .filter(
      (entry) => !source || getHistorySourceHost(entry.sourceUrl) === source,
    )
    .filter((entry) => matchesHistoryStatus(entry, status))
    .filter((entry) => {
      if (mode === "audio") return isAudioHistoryEntry(entry);
      if (mode === "video") return !isAudioHistoryEntry(entry);
      return true;
    })
    .map((entry, index) => ({ entry, index }))
    .sort((left, right) => {
      const a = left.entry;
      const b = right.entry;
      let comparison = 0;
      if (sortKey === "size") {
        comparison = compareHistoryValues(
          parseHistorySize(a),
          parseHistorySize(b),
          sortOrder,
        );
      } else if (sortKey === "quality") {
        comparison = compareHistoryValues(
          parseHistoryQuality(a),
          parseHistoryQuality(b),
          sortOrder,
        );
      } else if (sortKey === "source") {
        comparison = compareHistoryValues(
          getHistorySourceHost(a.sourceUrl),
          getHistorySourceHost(b.sourceUrl),
          sortOrder,
        );
        if (!comparison)
          comparison = compareHistoryValues(
            a.fileName || "",
            b.fileName || "",
            "asc",
          );
      } else {
        comparison = compareHistoryValues(
          new Date(a.timestamp).getTime(),
          new Date(b.timestamp).getTime(),
          sortOrder,
        );
      }
      if (
        !comparison &&
        (sortKey === "size" || sortKey === "quality" || sortKey === "source")
      ) {
        comparison = compareHistoryValues(
          new Date(a.timestamp).getTime(),
          new Date(b.timestamp).getTime(),
          sortOrder,
        );
      }
      return comparison || left.index - right.index;
    })
    .map(({ entry }) => entry);
}

export {
  getHistorySourceHost,
  isAudioHistoryEntry,
  isFailedHistoryEntry,
  matchesHistoryStatus,
  selectHistoryEntries,
  selectHistoryEntriesByIds,
  selectHistoryEntriesByStatus,
};
