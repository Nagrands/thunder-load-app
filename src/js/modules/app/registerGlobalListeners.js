import { applyI18n, t } from "../i18n.js";

export function registerI18nListeners(tabs) {
  const onChanged = () => {
    applyI18n(document);
    document.title = t("app.title");
    tabs.setTabLabel("download", t("tabs.download"));
    tabs.setTabLabel("wireguard", t("tabs.tools"));
    tabs.setTabLabel("products", t("tabs.products"));
    tabs.setTabLabel("now-playing", t("tabs.nowPlaying"));
  };
  window.addEventListener("i18n:changed", onChanged);
  return () => window.removeEventListener("i18n:changed", onChanged);
}

export function registerStatusMessageListener() {
  return window.electron.receive("status-message", (message) => {
    let el = document.getElementById("startup-status");
    if (!el) {
      el = document.createElement("div");
      el.id = "startup-status";
      el.className = "spinner-message";
      el.setAttribute("role", "status");
      el.setAttribute("aria-live", "polite");
      document.body.prepend(el);
    }

    el.innerHTML = `
      <div class="spinner"></div>
      <span>${message}</span>
    `;

    if (/установлены|ошибка/i.test(message)) {
      setTimeout(() => el.remove(), 3000);
    }
  });
}
