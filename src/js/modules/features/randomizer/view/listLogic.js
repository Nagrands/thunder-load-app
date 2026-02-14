export const normalizeSortMode = (value) =>
  ["order", "alpha", "weight", "rare"].includes(value) ? value : "order";

export const applySearchFilter = (list, searchQuery) => {
  const query = (searchQuery || "").trim().toLowerCase();
  if (!query) return list;
  return list.filter((item) => (item.value || "").toLowerCase().includes(query));
};

export const sortByMode = (list, sortMode, { clampWeight, clampMisses }) => {
  const copy = list.slice();
  switch (sortMode) {
    case "alpha":
      return copy.sort((a, b) =>
        (a.value || "").localeCompare(b.value || "", "ru", {
          sensitivity: "base",
        }),
      );
    case "weight":
      return copy.sort(
        (a, b) => clampWeight(b.weight) - clampWeight(a.weight),
      );
    case "rare":
      return copy.sort(
        (a, b) => clampMisses(b.misses || 0) - clampMisses(a.misses || 0),
      );
    default:
      return copy;
  }
};

export const buildCountLabel = ({
  visibleCount,
  baseCount,
  totalCount,
  favoritesOnly,
  searchActive,
  isEn,
  t,
  declOfNum,
}) => {
  const isEmpty = visibleCount === 0;
  const baseLabel = isEmpty
    ? favoritesOnly
      ? t("randomizer.count.emptyFavorites")
      : t("randomizer.count.empty")
    : isEn
      ? t("randomizer.count.en", { count: visibleCount })
      : `${visibleCount} ${declOfNum(visibleCount, ["вариант", "варианта", "вариантов"])}`;

  const comparisonCount = favoritesOnly ? totalCount : baseCount;
  const showExtra =
    (favoritesOnly && visibleCount !== totalCount) ||
    (searchActive && visibleCount !== baseCount);

  if (!showExtra) return baseLabel;

  return `${baseLabel}${
    isEn
      ? t("randomizer.count.of", { count: comparisonCount })
      : ` из ${comparisonCount}`
  }`;
};
