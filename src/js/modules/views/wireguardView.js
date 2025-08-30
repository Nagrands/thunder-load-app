// src/js/modules/views/wireguardView.js

import { showToast } from "../toast.js";
import { showConfirmationDialog } from "../modals.js";
import { initTooltips } from "../tooltipInitializer.js";

export default function renderWireGuard() {
  // Guard: если вкладка WG Unlock отключена — не инициализируем UI
  const _isWgDisabled = () => {
    try {
      const raw = localStorage.getItem('wgUnlockDisabled');
      // По умолчанию вкладка отключена, если ключ отсутствует
      if (raw === null) return true;
      return JSON.parse(raw) === true;
    } catch {
      return true;
    }
  };
  if (_isWgDisabled()) {
    // возвращаем скрытый контейнер, чтобы tabSystem мог управлять отображением
    const placeholder = document.createElement('div');
    placeholder.id = 'wireguard-view';
    placeholder.className = 'wireguard-view tab-content p-4 space-y-4';
    placeholder.style.display = 'none';
    return placeholder;
  }
  const T0 = performance.now();
  // Ensure WG background is preloaded to prevent layout jump on first render
  if (!document.querySelector('.wg-bg-preload')) {
    const bgPreload = document.createElement('div');
    bgPreload.className = 'wg-bg-preload';
    document.body.appendChild(bgPreload);
  }
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
    {
      id: "wg-ip",
      label: "IP‑адрес",
      key: "ip",
      type: "text",
      placeholder: "например: 192.168.0.10",
      hint: "IPv4 адрес получателя",
    },
    {
      id: "wg-port-remote",
      label: "Удалённый порт",
      key: "rPort",
      type: "number",
      placeholder: "51820",
      hint: "Порт на удалённом хосте",
    },
    {
      id: "wg-port-local",
      label: "Локальный порт",
      key: "lPort",
      type: "number",
      placeholder: "56132",
      hint: "Порт исходящего сокета",
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

  // Параллакс фона: связываем скролл с CSS‑переменной
  const _wgParallaxUpdate = () => {
    const y = window.scrollY || document.documentElement.scrollTop || 0;
    view.style.setProperty("--wg-parallax-offset", `${y}`);
  };
  _wgParallaxUpdate();
  window.addEventListener("scroll", _wgParallaxUpdate, { passive: true });

  const _wgVisHandler = (src) => {
    _wgParallaxUpdate();
    try { console.debug('[WG Unlock] Parallax sync on', src || 'focus/visibility'); } catch (_) {}
  };
  window.addEventListener('focus', () => _wgVisHandler('focus'));
  document.addEventListener('visibilitychange', () => _wgVisHandler('visibilitychange'));

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
    <label class="wg-field flex flex-col gap-1 relative" data-hint="${(f.hint || "").replace(/\"/g, "&quot;")}">
      <span class="text-sm">${f.label}</span>
      <div class="filter-clear-container input-container">
        <input id="${f.id}" class="input" type="${f.type}" placeholder="${f.placeholder || ""}" />
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
      <div class="field-hint text-xs text-muted">${f.hint || ""}</div>
      <div class="field-error text-xs text-red-500" data-error-for="${f.id}"></div>
    </label>
  `;
  }

  const fieldsHtml = fields.map(createInputField).join("");

  view.innerHTML = `
    <div class="wg-glass">
      <div class="wg-header">
        <div class="title">
          <i class="fa-solid fa-lock-open"></i>
          <div class="text">
            <h1>WG Unlock</h1>
            <p class="subtitle text-muted">UDP‑разблокировка WireGuard. Укажите адрес и порты, затем отправьте.</p>
          </div>
          <div class="header-actions">
          <label class="switch">
            <input type="checkbox" id="wg-debug-mode" />
            <span class="slider"></span>
            <span class="switch-label">Отладка</span>
          </label>
        </div>
        </div>
      </div>

      <h2 class="section-heading">Сетевые параметры</h2>
      <div class="wg-block wg-grid">
        ${fieldsHtml}
      </div>

      <details class="wg-log-block" open>
        <summary class="text-sm text-muted flex items-center gap-2">
          Лог активности
          <button id="wg-log-clear" type="button" class="ml-auto small-button btn btn-sm btn-ghost" data-bs-toggle="tooltip" data-bs-placement="top" title="Очистить лог">
            <i class="fa-solid fa-trash"></i>
          </button>
        </summary>
        <pre id="wg-log" class="wg-status console mt-2 p-2 rounded text-xs overflow-auto"></pre>
      </details>

      <h2 class="section-heading mt">Управление</h2>
      <div class="buttons" role="group" aria-label="Управление отправкой">
        <button id="wg-send" class="large-button btn btn-lg btn-primary" data-bs-toggle="tooltip" data-bs-placement="top" title="Отправить сообщение">
          <i class="fa-solid fa-paper-plane"></i>
          <span>Отправить</span>
        </button>
        <button id="wg-reset" class="small-button btn btn-sm btn-secondary" data-bs-toggle="tooltip" data-bs-placement="top" title="Сбросить поля">
          <i class="fa-solid fa-rotate"></i>
          <span></span>
        </button>
        <button id="wg-open-config-folder" class="small-button btn btn-sm btn-secondary" data-bs-toggle="tooltip" data-bs-placement="top" title="Открыть папку настроек">
          <i class="fa-solid fa-folder-open"></i>
          <span></span>
        </button>
        <div id="wg-status-indicator" class="text-xs text-muted hidden" role="status" aria-live="polite">⏳ Отправка запроса…</div>
      </div>
    </div>

  `;

  container.appendChild(view);

  // Отправка по Enter и Ctrl/Cmd+Enter
  view.addEventListener("keydown", (e) => {
    if (e.key !== "Enter") return;
    // Ctrl/Cmd+Enter — всегда отправлять
    if (e.metaKey || e.ctrlKey) {
      e.preventDefault();
      const send = view.querySelector("#wg-send");
      if (send && !send.disabled) send.click();
      return;
    }
    // Просто Enter — как раньше
    e.preventDefault();
    const send = view.querySelector("#wg-send");
    if (send && !send.disabled) send.click();
  });

  const markFieldError = (id, hasError = true, message = "") => {
    const el = getEl(id, view);
    const errBox = view.querySelector(`.field-error[data-error-for="${id}"]`);
    if (!el || !errBox) return;
    el.classList.toggle("input-error", hasError);
    errBox.textContent = hasError ? message : "";
    if (hasError) el.focus();
  };

  // Загрузка конфигурации
  window.electron.ipcRenderer
    .invoke("wg-get-config")
    .then((cfg) => {
      log('[Настройки] Конфигурация загружена');
      currentMsg = cfg.msg ?? ")";
      fields.forEach((f) => {
        const el = getEl(f.id, view);
        el.value = cfg[f.key] ?? "";
      });
      log(`[Настройки] Поля восстановлены (${fields.length})`);
      getEl(fields[0].id, view)?.focus();
      log(`[Настройки] Автоотправка: ${!!cfg.autosend ? 'включена' : 'выключена'}`);
      if (cfg.autosend) {
        log('[Отправка] Планирую автоотправку через 50 мс');
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
                const hideLater = () =>
                  setTimeout(() => status.classList.add("hidden"), 500);
                requestAnimationFrame(() => {
                  window.electron.ipcRenderer
                    .invoke("wg-send-udp", payload)
                    .then(() => {
                      toast(`Отправлено на ${payload.ip}:${payload.rPort}`);
                      log(
                        `Запрос (kvn) отправлен успешно на ${payload.ip}:${payload.rPort}`,
                      );
                      log(`Данные (kvn): ${JSON.stringify(payload)}`);
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

  try {
    const dt = Math.round(performance.now() - T0);
    log(`[Инициализация] Разметка и подготовка за ${dt} мс`);
    const ua = navigator.userAgent || '';
    log(`[Среда] UA: ${ua.split(')')[0]})`);
  } catch (_) {}

  // Очистка лога
  const clearLogBtn = getEl("wg-log-clear", view);
  if (clearLogBtn) {
    clearLogBtn.addEventListener("click", () => {
      log('[Лог] Очищен пользователем');
      const logEl = getEl("wg-log", view);
      if (logEl) logEl.textContent = "";
    });
  }

  // Вспомогательные утилиты
  const withTimeout = (promise, ms = 5000) => {
    let timer;
    return Promise.race([
      promise,
      new Promise((_, reject) => {
        timer = setTimeout(
          () => reject(new Error("Таймаут ожидания ответа")),
          ms,
        );
      }),
    ]).finally(() => clearTimeout(timer));
  };

  const humanizeError = (msg) => {
    if (!msg) return "Неизвестная ошибка";
    if (msg.includes("EADDRINUSE"))
      return "Порт уже используется. Выберите другой локальный порт.";
    if (msg.includes("ENETUNREACH"))
      return "Сеть недоступна. Проверьте подключение к интернету.";
    if (msg.includes("ECONNREFUSED"))
      return "Соединение отклонено удалённой стороной.";
    if (msg.toLowerCase().includes("timeout")) return "Время ожидания истекло.";
    return msg;
  };

  getEl("wg-send", view).addEventListener("click", () => {
    const payload = getPayload();
    log(`[Отправка] Подготовка payload: ${JSON.stringify(payload)}`);

    let hasError = false;

    if (!isValidIp(payload.ip)) {
      markFieldError("wg-ip", true, "Некорректный IP‑адрес");
      hasError = true;
      log('[Валидация] Некорректный IP-адрес');
    }

    if (!isValidPort(payload.rPort)) {
      markFieldError("wg-port-remote", true, "Порт должен быть от 1 до 65535");
      hasError = true;
      log('[Валидация] Некорректный удалённый порт');
    }

    if (payload.lPort && !isValidPort(payload.lPort)) {
      markFieldError("wg-port-local", true, "Порт должен быть от 1 до 65535");
      hasError = true;
      log('[Валидация] Некорректный локальный порт');
    }

    const status = getEl("wg-status-indicator", view);
    if (!status) return;
    status.classList.remove("hidden");

    if (hasError) {
      log('[Отправка] Прервана из-за ошибок валидации', true);
      return;
    }

    const sendBtn = getEl("wg-send", view);
    const hideLater = () =>
      setTimeout(() => status.classList.add("hidden"), 500);
    sendBtn.disabled = true;
    const sendBtnLabel = sendBtn.querySelector("span");
    const prevLabel = sendBtnLabel ? sendBtnLabel.textContent : "";
    sendBtn.setAttribute("aria-busy", "true");
    if (sendBtnLabel) sendBtnLabel.textContent = "Отправка…";

    log('[Отправка] Запрос IPC: wg-send-udp (таймаут 5000 мс)');
    withTimeout(
      window.electron.ipcRenderer.invoke("wg-send-udp", payload),
      5000,
    )
      .then(() => {
        log('[Отправка] Успех: ответ получен от main');
        toast(`Отправлено на ${payload.ip}:${payload.rPort}`);
        log(`Запрос отправлен успешно на ${payload.ip}:${payload.rPort}`);
        log(`Данные: ${JSON.stringify(payload)}`);
        // Анимация успешной отправки лога
        const logEl = getEl("wg-log", container);
        logEl?.classList.add("wg-status-flash");
        setTimeout(() => logEl?.classList.remove("wg-status-flash"), 400);
        sendBtn.disabled = false;
        sendBtn.removeAttribute("aria-busy");
        if (sendBtnLabel) sendBtnLabel.textContent = prevLabel;
        hideLater();
      })
      .catch((err) => {
        log(`[Отправка] Ошибка IPC: ${err && (err.message || String(err))}`, true);
        const raw = err && (err.message || String(err));
        const msg = humanizeError(raw);
        if (!raw?.includes("EADDRINUSE")) {
          toast(msg, false);
        }
        log(msg, true);
        sendBtn.disabled = false;
        sendBtn.removeAttribute("aria-busy");
        if (sendBtnLabel) sendBtnLabel.textContent = prevLabel;
        hideLater();
      });
  });

  // Открыть папку настроек WG Unlock
  const openConfigBtn = getEl("wg-open-config-folder", view);
  if (openConfigBtn) {
    openConfigBtn.addEventListener("click", () => {
      log('[Действие] Открыть папку настроек');
      window.electron.ipcRenderer.send("wg-open-config-folder");
    });
  }

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
            log('[Настройки] Конфигурация загружена');
            fields.forEach((f) => {
              getEl(f.id, view).value = cfg[f.key] ?? "";
              markFieldError(f.id, false);
            });
            log(`[Настройки] Поля восстановлены (${fields.length})`);
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

  queueMicrotask(() => { initTooltips(); try { log('[UI] Тултипы инициализированы'); } catch (_) {} });

  // Debug mode checkbox logic
  const debugCheckbox = getEl("wg-debug-mode", view);
  if (debugCheckbox) {
    debugCheckbox.addEventListener("change", () => {
      const enabled = debugCheckbox.checked;
      log(`[Режим отладки] ${enabled ? 'Включён' : 'Выключен'}`);
      window.electron.ipcRenderer.send("wg-set-config", {
        key: "debug",
        val: enabled,
      });
      // Show/hide log activity block
      const logBlock = view.querySelector(".wg-log-block");
      if (logBlock) {
        logBlock.style.display = enabled ? "" : "none";
      }
    });

    window.electron.ipcRenderer.invoke("wg-get-config").then((cfg) => {
      debugCheckbox.checked = !!cfg.debug;
      // Show/hide log activity block on initial load
      const logBlock = view.querySelector(".wg-log-block");
      if (logBlock) {
        logBlock.style.display = cfg.debug ? "" : "none";
      }
    });
  }

  // WG Unlock: авто‑закрытие — лог обратного отсчёта (deadline‑based)
  // Единый источник правды — timestamp дедлайна, при его наличии. Иначе — fallback: now + seconds.
  let shutdownTicker = null;
  let shutdownDeadlineTs = null; // ms since epoch
  let lastLoggedRemaining = null;

  const stopCountdown = () => {
    log('[Авто-закрытие] Таймер остановлен');
    if (shutdownTicker) {
      clearInterval(shutdownTicker);
      shutdownTicker = null;
    }
    shutdownDeadlineTs = null;
    lastLoggedRemaining = null;
  };

  const startCountdownWithDeadline = (deadlineMs) => {
    stopCountdown();
    shutdownDeadlineTs = Number(deadlineMs);
    log(`[Авто-закрытие] Таймер запущен до ${new Date(shutdownDeadlineTs).toLocaleTimeString()}`);
    if (!Number.isFinite(shutdownDeadlineTs)) return;

    const tick = () => {
      const now = Date.now();
      let remaining = Math.ceil((shutdownDeadlineTs - now) / 1000);
      if (remaining < 0) remaining = 0;
      if (lastLoggedRemaining !== remaining) {
        log(`[Авто-закрытие] Осталось: ${remaining} с`);
        lastLoggedRemaining = remaining;
      }
      if (remaining <= 0) {
        stopCountdown();
      }
    };

    // Лог сразу и затем каждую секунду
    tick();
    shutdownTicker = setInterval(tick, 1000);
  };

  const startCountdownFromSeconds = (secs) => {
    const s = Number(secs);
    const safeSecs = Number.isFinite(s) ? s : 30;
    const deadline = Date.now() + safeSecs * 1000;
    startCountdownWithDeadline(deadline);
  };

  // Первичная инициализация: пробуем получить deadline из main; если нет — используем seconds
  (async () => {
    try {
      const [enabled, seconds] = await Promise.all([
        window.electron.invoke("get-auto-shutdown-status"),
        window.electron.invoke("get-auto-shutdown-seconds"),
      ]);

      let deadline = null;
      try {
        // Этот канал может отсутствовать — обернули в try/catch
        deadline = await window.electron.invoke("get-auto-shutdown-deadline");
      } catch (_) {
        /* ignore */
      }

      if (enabled) {
        if (deadline && Number.isFinite(Number(deadline))) {
          startCountdownWithDeadline(Number(deadline));
          const eta = new Date(Number(deadline)).toLocaleTimeString();
          log(`[Авто-закрытие] Загружено: включено, завершение в ${eta}`);
        } else {
          startCountdownFromSeconds(seconds);
          log(
            `[Авто-закрытие] Загружено: включено, ${Number(seconds) || 30} с (канал дедлайна недоступен)`,
          );
        }
      } else {
        log(`[Авто-закрытие] Загружено: выключено, ${Number(seconds) || 30} с`);
      }
    } catch (e) {
      console.error("auto-shutdown init error:", e);
    }
  })();

  // Реагируем на изменения из модалки/главного процесса
  window.electron.on("wg-auto-shutdown-updated", (payload) => {
    try {
      const { enabled, seconds, deadline } = payload || {};
      if (enabled) {
        if (deadline && Number.isFinite(Number(deadline))) {
          startCountdownWithDeadline(Number(deadline));
          const eta = new Date(Number(deadline)).toLocaleTimeString();
          log(`[Авто-закрытие] Включено; завершение в ${eta}`);
        } else {
          startCountdownFromSeconds(seconds);
          log(`[Авто-закрытие] Включено; ${Number(seconds) || 30} с`);
        }
      } else {
        stopCountdown();
        log(`[Авто-закрытие] Выключено; обратный отсчёт остановлен`);
      }
    } catch (err) {
      console.error("wg-auto-shutdown-updated handler error:", err);
    }
  });

  return container;
}
