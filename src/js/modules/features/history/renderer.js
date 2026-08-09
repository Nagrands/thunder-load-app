const replaceHistoryRow = ({
  currentRow,
  entry,
  createRow,
  afterReplace = () => {},
}) => {
  if (!currentRow) return null;
  const wasOpen = currentRow.classList.contains("is-open");
  const groupKey = currentRow.dataset.groupKey || "unknown";
  const { el: replacement } = createRow(entry, groupKey);
  if (wasOpen) {
    replacement.classList.add("is-open");
    replacement
      .querySelector(".history-row__details")
      ?.classList.add("is-open");
    const toggle = replacement.querySelector(".history-row__toggle");
    toggle?.classList.add("is-open");
    toggle?.setAttribute("aria-expanded", "true");
  }
  currentRow.replaceWith(replacement);
  afterReplace(replacement);
  return replacement;
};

export { replaceHistoryRow };
