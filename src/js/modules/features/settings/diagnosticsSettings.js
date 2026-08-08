import { t } from "../../i18n.js";
import { showToast } from "../../toast.js";

export function initDiagnosticsSettings() {
  const toggle = document.getElementById("settings-diagnostics-debug-toggle");
  const exportButton = document.getElementById("settings-diagnostics-export");
  const api = window.electron?.diagnostics;
  if (!api || (!toggle && !exportButton)) return;

  if (toggle && toggle.dataset.initialized !== "true") {
    toggle.dataset.initialized = "true";
    void api
      .getLevel()
      .then((level) => {
        toggle.checked = level === "debug";
      })
      .catch(() => {});
    toggle.addEventListener("change", async () => {
      toggle.disabled = true;
      try {
        await api.setLevel(toggle.checked ? "debug" : "info");
        showToast(t("settings.diagnostics.levelSaved"), "success");
      } catch {
        toggle.checked = !toggle.checked;
        showToast(t("settings.diagnostics.levelError"), "error");
      } finally {
        toggle.disabled = false;
      }
    });
  }

  if (exportButton && exportButton.dataset.initialized !== "true") {
    exportButton.dataset.initialized = "true";
    exportButton.addEventListener("click", async () => {
      exportButton.disabled = true;
      try {
        const response = await api.export();
        if (!response?.ok) {
          if (response?.error?.code !== "CANCELLED") {
            showToast(t("settings.diagnostics.exportError"), "error");
          }
          return;
        }
        showToast(t("settings.diagnostics.exported"), "success");
      } catch {
        showToast(t("settings.diagnostics.exportError"), "error");
      } finally {
        exportButton.disabled = false;
      }
    });
  }
}
