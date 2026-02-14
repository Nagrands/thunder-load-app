export const clampAutoInterval = (value) =>
  Math.min(3600, Math.max(1, Math.round(Number(value ?? 5))));

export const clampAutoStopCount = (value) =>
  Math.min(9999, Math.max(1, Math.round(Number(value ?? 5))));

export const normalizeStopMode = (raw) =>
  ["none", "count", "match"].includes(raw) ? raw : "none";

export const sanitizeStopMatch = (value = "") =>
  (value ?? "").toString().slice(0, 120).trim();

export const matchesStopText = (value, matchText) => {
  const needle = sanitizeStopMatch(matchText);
  if (!needle) return false;
  return (value || "")
    .toString()
    .toLowerCase()
    .includes(needle.toLowerCase());
};

export const getAutoStopReason = ({
  result,
  settings,
  autoRuns,
  poolSize,
  itemsCount,
  t,
}) => {
  if (!result) return t("randomizer.auto.stopReason.noItems");

  if (
    settings.autoStopMode === "count" &&
    autoRuns >= clampAutoStopCount(settings.autoStopCount)
  ) {
    return t("randomizer.auto.stopReason.count", {
      count: clampAutoStopCount(settings.autoStopCount),
    });
  }

  if (
    settings.autoStopMode === "match" &&
    settings.autoStopMatch &&
    matchesStopText(result.value, settings.autoStopMatch)
  ) {
    return t("randomizer.auto.stopReason.match", {
      text: settings.autoStopMatch,
    });
  }

  if (
    settings.autoStopOnPoolDepletion &&
    settings.noRepeat &&
    itemsCount > 0 &&
    poolSize === 0
  ) {
    return t("randomizer.auto.stopReason.poolEmpty");
  }

  return "";
};
