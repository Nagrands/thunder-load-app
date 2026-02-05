// src/js/modules/randomizer/ui/listActions.js

import { t } from "../../i18n.js";

export function wireListActions({
  listActions: _listActions,
  exportButton,
  bulkDeleteButton,
  clearButton,
  getItems,
  getSelected,
  onExport: _onExport,
  onBulkDelete,
  onClear,
  showToast,
}) {
  if (exportButton) {
    exportButton.addEventListener("click", async () => {
      const items = getItems();
      if (!items.length) {
        showToast(t("randomizer.list.empty"), "info");
        return;
      }
      try {
        await navigator.clipboard.writeText(
          items.map((item) => item.value).join("\n"),
        );
        showToast(t("randomizer.list.copied"), "success");
      } catch {
        showToast(t("randomizer.list.copyError"), "error");
      }
    });
  }

  if (clearButton) {
    clearButton.addEventListener("click", () => {
      const items = getItems();
      if (!items.length) return;
      if (confirm(t("randomizer.list.clearConfirm"))) {
        onClear();
      }
    });
  }

  if (bulkDeleteButton) {
    bulkDeleteButton.addEventListener("click", () => {
      const selected = getSelected();
      if (!selected.size) {
        showToast(t("randomizer.list.noneSelected"), "info");
        return;
      }
      if (!confirm(t("randomizer.list.deleteConfirm", { count: selected.size })))
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
          selectedCount > 0
            ? t("randomizer.list.deleteSelectedCount", {
                count: selectedCount,
              })
            : t("randomizer.list.deleteSelected");
      }
    },
  };
}
