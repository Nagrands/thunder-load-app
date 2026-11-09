import renderProductFormatterView from "./views/productFormatterView.js";
import { initI18n, t } from "./i18n.js";
import { initializeTheme } from "./themeManager.js";
import { initializeFontSize } from "./fontSizeManager.js";

function initializeFormatWindow() {
  initI18n();
  initializeTheme();
  document.title = `${t("tabs.products")} — Thunder`;

  const root = document.getElementById("format-window-root");
  if (!root) return;

  renderProductFormatterView(root);
  void initializeFontSize().catch((error) => {
    console.warn("[Format] Failed to initialize font size:", error);
  });
}

if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", initializeFormatWindow, {
    once: true,
  });
} else {
  initializeFormatWindow();
}
