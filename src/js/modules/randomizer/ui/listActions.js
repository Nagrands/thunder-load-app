// src/js/modules/randomizer/ui/listActions.js

export function wireListActions({
  listActions,
  exportButton,
  bulkDeleteButton,
  clearButton,
  getItems,
  getSelected,
  onExport,
  onBulkDelete,
  onClear,
  showToast,
}) {
  if (exportButton) {
    exportButton.addEventListener("click", async () => {
      const items = getItems();
      if (!items.length) {
        showToast("Список пуст", "info");
        return;
      }
      try {
        await navigator.clipboard.writeText(items.map((item) => item.value).join("\n"));
        showToast("Список скопирован", "success");
      } catch {
        showToast("Не удалось скопировать список", "error");
      }
    });
  }

  if (clearButton) {
    clearButton.addEventListener("click", () => {
      const items = getItems();
      if (!items.length) return;
      if (confirm("Очистить все варианты? Действие нельзя отменить.")) {
        onClear();
      }
    });
  }

  if (bulkDeleteButton) {
    bulkDeleteButton.addEventListener("click", () => {
      const selected = getSelected();
      if (!selected.size) {
        showToast("Не выбрано ни одного варианта", "info");
        return;
      }
      if (
        !confirm(
          `Удалить ${selected.size} вариантов?`,
        )
      )
        return;
      onBulkDelete(selected);
    });
  }

  return {
    updateBulkButton(selectedCount) {
      if (!bulkDeleteButton) return;
      bulkDeleteButton.disabled = selectedCount === 0;
      bulkDeleteButton.classList.toggle("hidden", getItems().length === 0);
      const label = bulkDeleteButton.querySelector("span");
      if (label) {
        label.textContent =
          selectedCount > 0 ? `Удалить (${selectedCount})` : "Удалить выбранные";
      }
    },
  };
}
