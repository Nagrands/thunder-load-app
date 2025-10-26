// src/js/modules/views/wireguardView.js

import { showToast } from "../toast.js";
import { showConfirmationDialog } from "../modals.js";
import { initTooltips } from "../tooltipInitializer.js";

export default function renderWireGuard() {
  // Guard: если вкладка WG Unlock отключена — не инициализируем UI
  const _isWgDisabled = () => {
    try {
      const raw = localStorage.getItem("wgUnlockDisabled");
      if (raw === null) return true;
      return JSON.parse(raw) === true;
    } catch {
      return true;
    }
  };
  
  if (_isWgDisabled()) {
    const placeholder = document.createElement("div");
    placeholder.id = "wireguard-view";
    placeholder.className = "wireguard-view tab-content";
    placeholder.style.display = "none";
    return placeholder;
  }

  const T0 = performance.now();

  // Ensure WG background is preloaded to prevent layout jump on first render
  if (!document.querySelector(".wg-bg-preload")) {
    const bgPreload = document.createElement("div");
    bgPreload.className = "wg-bg-preload";
    document.body.appendChild(bgPreload);
  }

  const getEl = (id, root = document) => root.querySelector(`#${id}`);
  const isValidIp = (ip) => {
    return /^((25[0-5]|2[0-4]\d|1?\d{1,2})(\.|$)){4}$/.test(ip.trim());
  };

  // Проверяем доступность Electron API
  if (!window.electron?.ipcRenderer) {
    const container = document.createElement("div");
    container.className = "wg-center";
    container.innerHTML = `<div class="wg-card"><p class="error">Electron API недоступен</p></div>`;
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
      icon: "fa-network-wired"
    },
    {
      id: "wg-port-remote",
      label: "Удалённый порт",
      key: "rPort",
      type: "number",
      placeholder: "51820",
      hint: "Порт на удалённом хосте",
      icon: "fa-signal"
    },
    {
      id: "wg-port-local",
      label: "Локальный порт", 
      key: "lPort",
      type: "number",
      placeholder: "56132",
      hint: "Порт исходящего сокета",
      icon: "fa-plug"
    },
  ];

  const toast = (msg, success = true) =>
    showToast(msg, success ? "success" : "error");

  const isValidPort = (val) => val >= 1 && val <= 65535;

  const container = document.createElement("div");
  container.className = "wg-center";

  const view = document.createElement("div");
  view.id = "wireguard-view";
  view.className = "wireguard-view";

  let currentMsg = ")";
  let lastSendTime = null;
  let shutdownTicker = null;
  let shutdownDeadlineTs = null;
  let lastLoggedRemaining = null;

  // =============================================
  // ВСПОМОГАТЕЛЬНЫЕ ФУНКЦИИ
  // =============================================

  const getPayload = () => {
    const payload = fields.reduce((acc, f) => {
      const val = getEl(f.id, view)?.value || '';
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
    <div class="wg-field">
      <label class="label">
        <i class="fa-solid ${f.icon}"></i>
        ${f.label}
      </label>
      <div class="input-with-clear">
        <input 
          id="${f.id}" 
          class="input" 
          type="${f.type}" 
          placeholder="${f.placeholder || ''}" 
          aria-label="${f.label}"
        />
        <button
          type="button"
          class="clear-field-btn"
          data-target="#${f.id}"
          data-bs-toggle="tooltip"
          data-bs-placement="top"
          title="Очистить"
        >
          <i class="fa-solid fa-times"></i>
        </button>
      </div>
      <div class="field-hint">${f.hint || ''}</div>
      <div class="field-error" data-error-for="${f.id}"></div>
    </div>
  `;
  }

  const updateLastSendTime = () => {
    const timeEl = getEl('wg-last-send-time', view);
    if (timeEl) {
      lastSendTime = new Date();
      timeEl.textContent = lastSendTime.toLocaleTimeString();
    }
  };

  const updateConnectionStatus = (status, isError = false) => {
    const statusEl = getEl('wg-connection-status', view);
    if (statusEl) {
      statusEl.textContent = status;
      statusEl.className = isError ? 'status-error' : 'status-success';
    }
  };

  const markFieldError = (id, hasError = true, message = "") => {
    const el = getEl(id, view);
    const errBox = view.querySelector(`.field-error[data-error-for="${id}"]`);
    if (!el || !errBox) return;
    el.classList.toggle("input-error", hasError);
    errBox.textContent = hasError ? message : "";
    if (hasError) el.focus();
  };

  const log = (text, error = false) => {
    // Всегда показывать ошибки, независимо от режима отладки
    const debugToggle = getEl("debug-toggle", view);
    const debugEnabled = debugToggle ? debugToggle.classList.contains("is-active") : false;
    
    if (!debugEnabled && !error) return;
    
    const pre = getEl("wg-log", view);
    if (pre) {
      const timestamp = new Date().toLocaleTimeString();
      // Убедимся, что добавляем текст, а не заменяем
      const currentContent = pre.textContent || '';
      pre.textContent = currentContent + (currentContent ? '\n' : '') + `${timestamp} › ${text}`;

      // Ограничиваем лог последними 300 строками
      const lines = pre.textContent.split('\n');
      if (lines.length > 300) {
        pre.textContent = lines.slice(-300).join('\n');
      }
      
      if (error) {
        pre.classList.add("error-log");
      } else {
        pre.classList.remove("error-log");
      }
      
      // Автопрокрутка к новому сообщению
      pre.scrollTop = pre.scrollHeight;
      
      // Автоматически раскрывать details при новых сообщениях
      const details = pre.closest('details');
      if (details && !details.open) {
        details.open = true;
      }
    }
  };

  const withTimeout = (promise, ms = 5000) => {
    let timer;
    return Promise.race([
      promise,
      new Promise((_, reject) => {
        timer = setTimeout(
          () => reject(new Error("Таймаут ожидания ответа")),
          ms
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

  // =============================================
  // ФУНКЦИИ АВТО-ЗАКРЫТИЯ
  // =============================================

  const stopCountdown = () => {
    log("[Авто-закрытие] Таймер остановлен");
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

    tick();
    shutdownTicker = setInterval(tick, 1000);
  };

  const startCountdownFromSeconds = (secs) => {
    const s = Number(secs);
    const safeSecs = Number.isFinite(s) ? s : 30;
    const deadline = Date.now() + safeSecs * 1000;
    startCountdownWithDeadline(deadline);
  };

  const initAutoShutdown = async () => {
    try {
      const [enabled, seconds] = await Promise.all([
        window.electron.ipcRenderer.invoke("get-auto-shutdown-status"),
        window.electron.ipcRenderer.invoke("get-auto-shutdown-seconds"),
      ]);

      let deadline = null;
      try {
        deadline = await window.electron.ipcRenderer.invoke("get-auto-shutdown-deadline");
      } catch (_) {}

      if (enabled) {
        if (deadline && Number.isFinite(Number(deadline))) {
          startCountdownWithDeadline(Number(deadline));
          const eta = new Date(Number(deadline)).toLocaleTimeString();
          log(`[Авто-закрытие] Загружено: включено, завершение в ${eta}`);
        } else {
          startCountdownFromSeconds(seconds);
          log(`[Авто-закрытие] Загружено: включено, ${Number(seconds) || 30} с`);
        }
      } else {
        log(`[Авто-закрытие] Загружено: выключено, ${Number(seconds) || 30} с`);
      }
    } catch (e) {
      console.error("auto-shutdown init error:", e);
      log(`[Авто-закрытие] Ошибка инициализации: ${e.message}`, true);
    }
  };

  // =============================================
  // ОСНОВНОЙ HTML
  // =============================================

  const fieldsHtml = fields.map(createInputField).join("");

  view.innerHTML = `
    <div class="wg-main-container">
      <div class="wg-content">
        <div class="wg-glass">
          <div class="wg-header">
            <div class="title">
              <i class="fa-solid fa-lock-open"></i>
              <div class="title-content">
                <h1 class="wg-text-gradient">WG Unlock</h1>
                <p class="subtitle">UDP‑разблокировка WireGuard.</p>
              </div>
            </div>
            
            <!-- Исправленный переключатель отладки -->
            <div class="debug-toggle" id="debug-toggle">
              <div class="toggle-track"></div>
              <span class="toggle-label">Лог активности</span>
            </div>
          </div>

          <div class="wg-section">
            <h2 class="section-heading">Сетевые параметры</h2>
            <div class="wg-grid">
              ${fieldsHtml}
            </div>
          </div>

          <div class="wg-section">
            <h2 class="section-heading">Управление</h2>
            <div class="buttons">
              <button id="wg-send" class="large-button">
                <i class="fa-solid fa-paper-plane"></i>
                <span>Отправить</span>
              </button>
              <button id="wg-reset" class="small-button" data-bs-toggle="tooltip" data-bs-placement="top" title="Сброс">
                <i class="fa-solid fa-rotate-left"></i>
              </button>
              <button id="wg-open-config-folder" class="small-button" data-bs-toggle="tooltip" data-bs-placement="top" title="Папка настроек">
                <i class="fa-solid fa-folder-open"></i>
              </button>
            </div>
            <div id="wg-status-indicator" class="hidden" role="status" aria-live="polite"></div>
          </div>
        </div>
      </div>

      <div class="wg-side-panel">
        <div class="info-card">
          <h3><i class="fa-solid fa-circle-info"></i> Информация</h3>
          <p>Эта функция отправляет UDP-пакет с указанными параметрами для разблокировки WireGuard.</p>
        </div>
        
        <div class="info-card">
          <h3><i class="fa-solid fa-clock"></i> Последняя отправка</h3>
          <p id="wg-last-send-time">Никогда</p>
        </div>
        
        <div class="info-card">
          <h3><i class="fa-solid fa-gauge"></i> Статус</h3>
          <p id="wg-connection-status">Неактивно</p>
        </div>

        <div class="wg-section">
            <details class="wg-log-block">
              <summary>
                <i class="fa-solid fa-terminal"></i>
                Лог активности
                <span class="ml-auto">
                  <button id="wg-log-clear" type="button" class="small-button" 
                    data-bs-toggle="tooltip" data-bs-placement="top" title="Очистить лог">
                    <i class="fa-solid fa-trash"></i>
                  </button>
                </span>
              </summary>
              <pre id="wg-log" class="wg-status console"></pre>
            </details>
        </div>
        
        <div class="info-card">
          <h3><i class="fa-solid fa-lightbulb"></i> Советы</h3>
          <p>• Используйте режим отладки для подробного лога<br>
             • Проверьте настройки брандмауэра<br>
             • Убедитесь, что удаленный хост доступен</p>
        </div>
      </div>
    </div>
  `;

  container.appendChild(view);

  // =============================================
  // ИНИЦИАЛИЗАЦИЯ ПОЛЕЙ И КОНФИГУРАЦИИ
  // =============================================

  const loadConfiguration = async () => {
    try {
      const cfg = await window.electron.ipcRenderer.invoke("wg-get-config");
      log("[Настройки] Конфигурация загружена");
      
      currentMsg = cfg.msg ?? ")";
      fields.forEach((f) => {
        const el = getEl(f.id, view);
        if (el) el.value = cfg[f.key] ?? "";
      });
      
      log(`[Настройки] Поля восстановлены (${fields.length})`);
      
      // Инициализация кнопок очистки после загрузки данных
      setTimeout(() => {
        fields.forEach((f) => {
          const input = getEl(f.id, view);
          const btn = view.querySelector(`.clear-field-btn[data-target="#${f.id}"]`);
          if (input && btn) {
            const hasValue = input.value.length > 0;
            if (hasValue) {
              btn.classList.add('has-value');
              btn.style.opacity = '1';
              btn.style.visibility = 'visible';
            }
          }
        });
      }, 100);
      
      getEl(fields[0].id, view)?.focus();
      
      // Загрузка состояния отладки
      const debugToggle = getEl("debug-toggle", view);
      if (debugToggle && cfg.debug) {
        debugToggle.classList.add("is-active");
        // Принудительно добавить сообщение при загрузке с включенной отладкой
        setTimeout(() => {
          log("[Система] WireGuard Unlock инициализирован с включенной отладкой");
        }, 100);
      }
      
      if (cfg.autosend) {
        log("[Отправка] Планирую автоотправку через 50 мс");
        setTimeout(() => getEl("wg-send", view)?.click(), 50);
      }

    } catch (err) {
      toast("Не удалось загрузить настройки", false);
      console.error(err);
      log(`[Ошибка] Загрузка конфигурации: ${err.message}`, true);
    }
  };

  const setupFieldEvents = () => {
    fields.forEach((f) => {
      const input = getEl(f.id, view);
      const btn = view.querySelector(`.clear-field-btn[data-target="#${f.id}"]`);

      if (!input || !btn) return;

      const updateClearButton = () => {
        const hasValue = input.value.length > 0;
        
        // Управление видимостью через класс
        if (hasValue) {
          btn.classList.add('has-value');
          btn.style.opacity = '1';
          btn.style.visibility = 'visible';
        } else {
          btn.classList.remove('has-value');
          btn.style.opacity = '0';
          btn.style.visibility = 'hidden';
        }
      };

      // События для обновления состояния кнопки
      ['focus', 'input', 'blur', 'change'].forEach((eventType) => {
        input.addEventListener(eventType, updateClearButton);
      });

      // Инициализация при загрузке
      updateClearButton();

      // Обработчик клика на кнопку очистки
      btn.addEventListener('click', (e) => {
        e.preventDefault();
        if (input.value) {
          input.value = '';
          saveConfig(f.key, '');
          markFieldError(f.id, false);
          updateClearButton(); // Обновляем состояние после очистки
          input.focus(); // Возвращаем фокус на поле
        }
      });

      // Сохранение значения при изменении
      input.addEventListener('change', () => {
        const val = f.type === 'number' ? Number(input.value) : input.value;
        saveConfig(f.key, val);
        markFieldError(f.id, false);
        updateClearButton(); // Обновляем кнопку
      });
      
      input.addEventListener('input', () => {
        markFieldError(f.id, false);
        updateClearButton(); // Обновляем кнопку при вводе
      });
    });
  };

  const setupEasterEgg = () => {
    const ipInput = getEl("wg-ip", view);
    if (!ipInput) return;

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
              status.textContent = "⏳ Отправка специального запроса...";
              status.className = "loading";
              
              const hideLater = () =>
                setTimeout(() => status.classList.add("hidden"), 500);
                
              window.electron.ipcRenderer
                .invoke("wg-send-udp", payload)
                .then(() => {
                  toast(`Специальный запрос отправлен на ${payload.ip}:${payload.rPort}`);
                  log(`Запрос (kvn) отправлен успешно на ${payload.ip}:${payload.rPort}`);
                  updateLastSendTime();
                  updateConnectionStatus("Успешно");
                  hideLater();
                })
                .catch((err) => {
                  const msg = err.message || err.toString();
                  if (!msg.includes("EADDRINUSE")) {
                    toast(msg, false);
                  }
                  log(msg, true);
                  updateConnectionStatus("Ошибка", true);
                  hideLater();
                });
            }
          }
        );
      }
    });
  };

  // =============================================
  // ОБРАБОТЧИКИ СОБЫТИЙ
  // =============================================

  const setupEventHandlers = () => {
    // Отправка по Enter и Ctrl/Cmd+Enter
    view.addEventListener("keydown", (e) => {
      if (e.key !== "Enter") return;
      if (e.metaKey || e.ctrlKey) {
        e.preventDefault();
        const send = getEl("wg-send", view);
        if (send && !send.disabled) send.click();
        return;
      }
      e.preventDefault();
      const send = getEl("wg-send", view);
      if (send && !send.disabled) send.click();
    });

    // Очистка лога
    const clearLogBtn = getEl("wg-log-clear", view);
    clearLogBtn?.addEventListener("click", () => {
      const pre = getEl("wg-log", view);
      if (pre) {
        const debugToggle = getEl("debug-toggle", view);
        const debugEnabled = debugToggle ? debugToggle.classList.contains("is-active") : false;
        
        pre.textContent = debugEnabled 
          ? "[Лог] Очищен пользователем" 
          : "Лог активности. Включите режим отладки для подробного вывода.";
        
        log("[Лог] Очищен пользователем");
      }
    });

    // Отправка UDP-пакета
    getEl("wg-send", view)?.addEventListener("click", handleSend);

    // Открыть папку настроек
    const openConfigBtn = getEl("wg-open-config-folder", view);
    openConfigBtn?.addEventListener("click", () => {
      log("[Действие] Открыть папку настроек");
      window.electron.ipcRenderer.send("wg-open-config-folder");
    });

    // Сброс настроек
    getEl("wg-reset", view)?.addEventListener("click", handleReset);

    // Переключатель отладки
    const debugToggle = getEl("debug-toggle", view);
    debugToggle?.addEventListener("click", handleDebugToggle);
  };

  const handleSend = () => {
    // Автоматически показывать лог при отправке
    const logDetails = view.querySelector('.wg-log-block');
    if (logDetails && !logDetails.open) {
      logDetails.open = true;
    }

    const payload = getPayload();
    log(`[Отправка] Подготовка payload: ${JSON.stringify(payload)}`);

    let hasError = false;

    if (!isValidIp(payload.ip)) {
      markFieldError("wg-ip", true, "Некорректный IP‑адрес");
      hasError = true;
      log("[Валидация] Некорректный IP-адрес", true);
    }

    if (!isValidPort(payload.rPort)) {
      markFieldError("wg-port-remote", true, "Порт должен быть от 1 до 65535");
      hasError = true;
      log("[Валидация] Некорректный удалённый порт", true);
    }

    if (payload.lPort && !isValidPort(payload.lPort)) {
      markFieldError("wg-port-local", true, "Порт должен быть от 1 до 65535");
      hasError = true;
      log("[Валидация] Некорректный локальный порт", true);
    }

    const status = getEl("wg-status-indicator", view);
    if (!status) return;
    
    status.classList.remove("hidden");
    status.textContent = "⏳ Отправка запроса...";
    status.className = "loading";

    if (hasError) {
      log("[Отправка] Прервана из-за ошибок валидации", true);
      status.textContent = "❌ Ошибки валидации";
      status.className = "error";
      setTimeout(() => status.classList.add("hidden"), 3000);
      return;
    }

    const sendBtn = getEl("wg-send", view);
    const hideLater = () =>
      setTimeout(() => status.classList.add("hidden"), 500);
      
    sendBtn.disabled = true;
    sendBtn.classList.add("is-loading");

    log("[Отправка] Запрос IPC: wg-send-udp (таймаут 5000 мс)");
    
    withTimeout(
      window.electron.ipcRenderer.invoke("wg-send-udp", payload),
      5000
    )
      .then(() => {
        log("[Отправка] Успех: ответ получен от main");
        toast(`Отправлено на ${payload.ip}:${payload.rPort}`);
        log(`Запрос отправлен успешно на ${payload.ip}:${payload.rPort}`);
        
        updateLastSendTime();
        updateConnectionStatus("Успешно отправлено");
        status.textContent = "✅ Успешно отправлено";
        status.className = "success";
        
        view.classList.add("wg-success-pulse");
        setTimeout(() => view.classList.remove("wg-success-pulse"), 2000);
        
        sendBtn.disabled = false;
        sendBtn.classList.remove("is-loading");
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
        updateConnectionStatus("Ошибка отправки", true);
        status.textContent = "❌ Ошибка отправки";
        status.className = "error";
        
        sendBtn.disabled = false;
        sendBtn.classList.remove("is-loading");
        setTimeout(() => status.classList.add("hidden"), 5000);
      });
  };

  const handleReset = () => {
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
            log("[Настройки] Конфигурация загружена");
            fields.forEach((f) => {
              getEl(f.id, view).value = cfg[f.key] ?? "";
              markFieldError(f.id, false);
            });
            log(`[Настройки] Поля восстановлены (${fields.length})`);
            
            // При сбросе устанавливаем начальное сообщение в лог
            const pre = getEl("wg-log", view);
            const debugToggle = getEl("debug-toggle", view);
            const debugEnabled = debugToggle ? debugToggle.classList.contains("is-active") : false;
            
            if (pre && !debugEnabled) {
              pre.textContent = "Лог активности. Включите режим отладки для подробного вывода.";
            }
            
            currentMsg = ")";
            updateConnectionStatus("Сброшено");
          })
          .catch((err) => {
            toast("Не удалось сбросить/обновить настройки", false);
            console.error(err);
            log(`[Ошибка] Сброс настроек: ${err.message}`, true);
          });
      }
    );
  };

  const handleDebugToggle = () => {
    const debugToggle = getEl("debug-toggle", view);
    const enabled = !debugToggle.classList.contains("is-active");
    
    if (enabled) {
      debugToggle.classList.add("is-active", "pulse");
      setTimeout(() => debugToggle.classList.remove("pulse"), 600);
      
      // При включении отладки добавляем информационное сообщение
      log("[Режим отладки] Включён - начата запись событий");
      
      // Показываем текущее состояние
      const status = getEl("wg-connection-status", view)?.textContent || "Неактивно";
      log(`[Текущий статус] ${status}`);
      
    } else {
      debugToggle.classList.remove("is-active");
      log("[Режим отладки] Выключен - запись событий приостановлена");
    }
    
    window.electron.ipcRenderer.send("wg-set-config", {
      key: "debug",
      val: enabled,
    });
  };

  // =============================================
  // ИНИЦИАЛИЗАЦИЯ
  // =============================================

  const initialize = async () => {
    try {
      // Сначала устанавливаем начальное сообщение в лог
      const pre = getEl("wg-log", view);
      if (pre && !pre.textContent.trim()) {
        pre.textContent = "Лог активности. Включите режим отладки для подробного вывода.";
      }

      await loadConfiguration();
      setupFieldEvents();
      setupEasterEgg();
      setupEventHandlers();
      await initAutoShutdown();

      // Анимация и автосмена советов
      const initTipsRotation = async () => {
        const tipsCard = view.querySelector('.info-card h3 i.fa-lightbulb')?.closest('.info-card');
        if (!tipsCard) return;

        const p = tipsCard.querySelector('p');
        if (!p) return;

        try {
          const response = await fetch("info/tips.json");
          const data = await response.json();
          const tips = data.tips || [];
          if (!tips.length) return;

          let index = 0;
          p.textContent = tips[index];

          setInterval(() => {
            index = (index + 1) % tips.length;
            p.classList.add("fade-out");
            setTimeout(() => {
              p.textContent = tips[index];
              p.classList.remove("fade-out");
              p.classList.add("fade-in");
              setTimeout(() => p.classList.remove("fade-in"), 800);
            }, 400);
          }, 8000);
        } catch (err) {
          console.error("Не удалось загрузить советы:", err);
        }
      };
      await initTipsRotation();
      
      // Инициализация тултипов
      queueMicrotask(() => {
        initTooltips();
        log("[UI] Тултипы инициализированы");
      });

      const dt = Math.round(performance.now() - T0);
      
      // Добавляем отладочную информацию если отладка включена
      const debugToggle = getEl("debug-toggle", view);
      const debugEnabled = debugToggle ? debugToggle.classList.contains("is-active") : false;
      
      if (debugEnabled) {
        log(`[Инициализация] Разметка и подготовка за ${dt} мс`);
        const ua = navigator.userAgent || "";
        log(`[Среда] UA: ${ua.split(")")[0]})`);
        log("[Лог] Режим отладки активен - все события будут записываться");
      }

    } catch (error) {
      console.error("Ошибка инициализации WireGuard:", error);
      log(`[Ошибка] Инициализация: ${error.message}`, true);
    }
  };

  // Обработчик обновления авто-закрытия
  window.electron.ipcRenderer.on("wg-auto-shutdown-updated", (payload) => {
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
      log(`[Ошибка] Обновление авто-закрытия: ${err.message}`, true);
    }
  });

  // Запускаем инициализацию
  initialize();

  return container;
}