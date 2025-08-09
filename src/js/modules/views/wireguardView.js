import { showToast } from "../toast.js";
import { showConfirmationDialog } from "../modals.js";
import { initTooltips } from "../tooltipInitializer.js";

export default function renderWireGuard() {
  const getEl = (id, root = document) => root.querySelector(`#${id}`);
  const isValidIp = (ip) => {
    return /^((25[0-5]|2[0-4]\d|1?\d{1,2})(\.|$)){4}$/.test(ip.trim());
  };

  if (!window.electron?.ipcRenderer) {
    const container = document.createElement("div");
    container.className = "wg-center";
    container.innerHTML = `<p class="error">Electron API недоступен</p>`;
    return container;
  }

  const fields = [
    { id: "wg-ip", label: "IP‑адрес", key: "ip", type: "text" },
    {
      id: "wg-port-remote",
      label: "Удалённый порт",
      key: "rPort",
      type: "number",
    },
    {
      id: "wg-port-local",
      label: "Локальный порт",
      key: "lPort",
      type: "number",
    },
    // { id: "wg-message", label: "Сообщение", key: "msg", type: "text" },
  ];

  const toast = (msg, success = true) =>
    showToast(msg, success ? "success" : "error");

  const isValidPort = (val) => val >= 1 && val <= 65535;

  const container = document.createElement("div");
  container.className = "wg-center";

  const view = document.createElement("div");
  view.id = "wireguard-view";
  view.className = "wireguard-view tab-content p-4 space-y-4";

  let currentMsg = ")";

  const getPayload = () => {
    const payload = fields.reduce((acc, f) => {
      const val = getEl(f.id, view).value;
      acc[f.key] = f.type === "number" ? Number(val) : val.trim();
      return acc;
    }, {});
    payload.msg = currentMsg;
    return payload;
  };

  const saveConfig = (key, value) =>
    window.electron.ipcRenderer.send("wg-set-config", { key, val: value });

  function createInputField(f) {
    return `
    <label class="flex flex-col gap-1 relative">
      <span class="text-sm">${f.label}</span>
      <div class="filter-clear-container input-container">
        <input id="${f.id}" class="input" type="${f.type}" />
        <div class="history-action">
          <button
            type="button"
            tabindex="-1"
            class="clear-field-btn history-action-button"
            data-target="#${f.id}"
            data-bs-toggle="tooltip"
            data-bs-placement="top"
            title="Очистить"
          >
            <i class="fa-solid fa-times-circle"></i>
          </button>
        </div>
      </div>
      <div class="field-error text-xs text-red-500" data-error-for="${f.id}"></div>
    </label>
  `;
  }

  const fieldsHtml = fields.map(createInputField).join("");

  view.innerHTML = `
    <h1>WireGuard Unlock</h1>
    <p class="text-sm text-muted -mt-2 mb-4">
      Отправка UDP-сообщения
    </p>

    <h2 class="section-heading">Сетевые параметры</h2>
    <div class="wg-block">
      ${fieldsHtml}
    </div>

    <h2 class="section-heading">Управление</h2>
    <div class="wg-block">
      <div class="buttons">
        <button id="wg-send" class="large-button" data-bs-toggle="tooltip" data-bs-placement="top" title="Отправить запрос">
          <i class="fa fa-paper-plane"></i> Отправить
        </button>
        <button id="wg-reset" class="small-button" data-bs-toggle="tooltip" data-bs-placement="top" title="Настройки по умолчанию">
          <i class="fa fa-refresh"></i> Сброс
        </button>
      </div>
      <div id="wg-status-indicator" class="text-xs text-muted hidden">⏳ Отправка запроса…</div>
    </div>

    <h2 class="section-heading">Дополнительные настройки</h2>
    <div class="wg-block">
      <label class="checkbox-label">
        <input type="checkbox" id="wg-debug-mode" />
        <i class="fa fa-bug"></i> Включить режим отладки
      </label>
    </div>

    <details class="wg-log-block" open>
      <summary class="text-sm text-muted">Лог активности</summary>
      <pre id="wg-log" class="wg-status mt-2 p-2 rounded text-xs"></pre>
    </details>
  `;

  container.appendChild(view);

  const markFieldError = (id, hasError = true, message = "") => {
    const el = getEl(id);
    const errBox = container.querySelector(`.field-error[data-error-for="${id}"]`);
    if (!el || !errBox) return;
    el.classList.toggle("input-error", hasError);
    errBox.textContent = hasError ? message : "";
    if (hasError) el.focus();
  };

  // Загрузка конфигурации
  window.electron.ipcRenderer
    .invoke("wg-get-config")
    .then((cfg) => {
      currentMsg = cfg.msg ?? ")";
      fields.forEach((f) => {
        const el = getEl(f.id, view);
        el.value = cfg[f.key] ?? "";
      });
      getEl(fields[0].id, view)?.focus();
      if (cfg.autosend) {
        getEl("wg-log", view).textContent = "";
        setTimeout(() => getEl("wg-send", view)?.click(), 50);
      }
      const ipInput = getEl("wg-ip", view);
      ipInput.addEventListener("input", () => {
        const val = ipInput.value.toLowerCase().trim();
        if (val === "kvn") { 
          ipInput.value = "127.0.0.2";
          saveConfig("ip", ipInput.value);
          const rPort = getEl("wg-port-remote", view)?.value || "51820";
          showConfirmationDialog(
            `Отправить запрос на <b>${ipInput.value}:${rPort}</b>?`,
            () => {
              const payload = getPayload();
              const status = getEl("wg-status-indicator", view);
              if (status) {
                status.classList.remove("hidden");
                const hideLater = () => setTimeout(() => status.classList.add("hidden"), 500);
                requestAnimationFrame(() => {
                  window.electron.ipcRenderer
                    .invoke("wg-send-udp", payload)
                    .then(() => {
                      toast(`Отправлено на ${payload.ip}:${payload.rPort}`);
                      log(`Запрос (kvn) отправлен успешно на ${payload.ip}:${payload.rPort}`);
                      log(`Payload (kvn): ${JSON.stringify(payload)}`);
                      hideLater();
                    })
                    .catch((err) => {
                      const msg = err.message || err.toString();
                      if (!msg.includes("EADDRINUSE")) {
                        toast(msg, false);
                      }
                      log(msg, true);
                      hideLater();
                    });
                });
              }
            },
          );
        }
      });
    })
    .catch((err) => {
      toast("Не удалось загрузить настройки", false);
      console.error(err);
    });

  // Привязка событий
  fields.forEach((f) => {
    const input = getEl(f.id, view);
    const btn = view.querySelector(`.clear-field-btn[data-target="#${f.id}"]`);

    const toggleClear = () => {
      btn.style.display =
        document.activeElement === input && input.value ? "block" : "none";
    };

    ["focus", "input"].forEach((ev) => input.addEventListener(ev, toggleClear));
    input.addEventListener("blur", () => setTimeout(toggleClear, 0));
    toggleClear();

    btn.addEventListener("mousedown", (e) => {
      e.preventDefault();
      if (input.value) {
        input.value = "";
        saveConfig(f.key, "");
        markFieldError(f.id, false);
      }
      toggleClear();
    });

    input.addEventListener("change", () => {
      const val = f.type === "number" ? Number(input.value) : input.value;
      saveConfig(f.key, val);
      markFieldError(f.id, false);
    });
    input.addEventListener("input", () => {
      markFieldError(f.id, false);
    });
  });


  const log = (text, error = false) => {
    const debug = getEl("wg-debug-mode", view)?.checked;
    if (!debug && !error) return;
    const pre = getEl("wg-log", container);
    pre.textContent += `\n${new Date().toLocaleTimeString()} › ${text}`;
    if (error) pre.classList.add("error-log");
    else pre.classList.remove("error-log");
    pre.scrollTop = pre.scrollHeight;
  };

  getEl("wg-send", view).addEventListener("click", () => {
    const payload = getPayload();

    let hasError = false;

    if (!isValidIp(payload.ip)) {
      markFieldError("wg-ip", true, "Некорректный IP‑адрес");
      hasError = true;
    }

    if (!isValidPort(payload.rPort)) {
      markFieldError("wg-port-remote", true, "Порт должен быть от 1 до 65535");
      hasError = true;
    }

    if (payload.lPort && !isValidPort(payload.lPort)) {
      markFieldError("wg-port-local", true, "Порт должен быть от 1 до 65535");
      hasError = true;
    }

    if (hasError) return;

    const sendBtn = getEl("wg-send", view);
    const status = getEl("wg-status-indicator", view);
    status.classList.remove("hidden");
    const hideLater = () => setTimeout(() => status.classList.add("hidden"), 500);
    sendBtn.disabled = true;

    window.electron.ipcRenderer
      .invoke("wg-send-udp", payload)
      .then(() => {
        toast(`Отправлено на ${payload.ip}:${payload.rPort}`);
        log(`Запрос отправлен успешно на ${payload.ip}:${payload.rPort}`);
        log(`Payload: ${JSON.stringify(payload)}`);
        // Анимация успешной отправки лога
        const logEl = getEl("wg-log", container);
        logEl?.classList.add("wg-status-flash");
        setTimeout(() => logEl?.classList.remove("wg-status-flash"), 400);
        sendBtn.disabled = false;
        hideLater();
      })
      .catch((err) => {
        const msg = err.message || err.toString();
        if (!msg.includes("EADDRINUSE")) {
          toast(msg, false);
        }
        log(msg, true);
        sendBtn.disabled = false;
        hideLater();
      });
  });

  getEl("wg-reset", view).addEventListener("click", () => {
    showConfirmationDialog(
      "Вы уверены, что хотите сбросить все настройки полей к значениям по умолчанию?",
      () => {
        window.electron.ipcRenderer
          .invoke("wg-reset-config-defaults")
          .then(() => {
            toast("Поля сброшены по умолчанию");
            return window.electron.ipcRenderer.invoke("wg-get-config");
          })
          .then((cfg) => {
            fields.forEach((f) => {
              getEl(f.id, view).value = cfg[f.key] ?? "";
              markFieldError(f.id, false);
            });
            getEl("wg-log", view).textContent = "";
            currentMsg = ")";
          })
          .catch((err) => {
            toast("Не удалось сбросить/обновить настройки", false);
            console.error(err);
          });
      },
    );
  });

  queueMicrotask(() => initTooltips());

  // Debug mode checkbox logic
  const debugCheckbox = getEl("wg-debug-mode", view);
  if (debugCheckbox) {
    debugCheckbox.addEventListener("change", () => {
      const enabled = debugCheckbox.checked;
      window.electron.ipcRenderer.send("wg-set-config", {
        key: "debug",
        val: enabled,
      });
    });

    window.electron.ipcRenderer.invoke("wg-get-config").then(cfg => {
      debugCheckbox.checked = !!cfg.debug;
    });
  }

  return container;
}
