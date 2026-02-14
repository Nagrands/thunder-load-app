import { applyI18n, t } from "../i18n.js";

export function registerI18nListeners(tabs) {
  window.addEventListener("i18n:changed", () => {
    applyI18n(document);
    document.title = t("app.title");
    tabs.setTabLabel("download", t("tabs.download"));
    tabs.setTabLabel("wireguard", t("tabs.wireguard"));
    tabs.setTabLabel("backup", t("tabs.backup"));
    tabs.setTabLabel("randomizer", t("tabs.randomizer"));
  });
}

export function registerWgControls() {
  const wgAutosendCheckbox = document.getElementById("wg-autosend");
  if (wgAutosendCheckbox) {
    window.electron.ipcRenderer.invoke("wg-get-config").then((cfg) => {
      wgAutosendCheckbox.checked = !!cfg.autosend;
    });

    wgAutosendCheckbox.addEventListener("change", () => {
      window.electron.ipcRenderer.send("wg-set-config", {
        key: "autosend",
        val: wgAutosendCheckbox.checked,
      });
    });
  }

  const wgSendBtn = document.getElementById("wg-send");
  if (wgSendBtn) {
    wgSendBtn.addEventListener("click", () => {
      const status = document.getElementById("wg-send-status");
      if (!status) return;

      status.classList.remove("hidden");
      const hideLater = () => setTimeout(() => status.classList.add("hidden"), 500);

      window.electron.ipcRenderer
        .invoke("wg-send-command")
        .then(() => {
          hideLater();
        })
        .catch(() => {
          hideLater();
        });
    });
  }

  const kvnBtn = document.getElementById("kvn-button");
  if (kvnBtn) {
    kvnBtn.addEventListener("click", () => {
      const status = document.getElementById("kvn-status");
      if (!status) return;

      status.classList.remove("hidden");
      const hideLater = () => setTimeout(() => status.classList.add("hidden"), 500);

      requestAnimationFrame(() => {
        window.electron.ipcRenderer
          .invoke("kvn-command")
          .then(() => {
            hideLater();
          })
          .catch(() => {
            hideLater();
          });
      });
    });
  }
}

export function registerStatusMessageListener() {
  window.electron.receive("status-message", (message) => {
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
