/**
 * @file updateHandler.js
 * @description
 * Manages application update notifications and progress UI for Thunder Load.
 * Handles communication with the Electron main process via contextBridge.
 *
 * Responsibilities:
 *  - Listen for update-related IPC events from main process
 *      • update-available
 *      • update-progress
 *      • update-error
 *      • update-downloaded
 *  - Display modals for available updates and downloaded updates
 *  - Update progress bar during download
 *  - Display error notifications when update fails
 *  - Handle modal close actions and cleanup UI elements
 *  - Provide utility to hide or update progress bar
 *
 * Exports:
 *  - initUpdateHandler — initializes event listeners and modals
 *  - updateProgressBar — updates progress bar and progress text
 */

// src/js/modules/updateHandler.js

// Используем методы, предоставленные через contextBridge
const { electron } = window;

// ---------- In-app flyover anchored to version label ----------
let _updFly = null;
let _updStyleInjected = true; // стили теперь в SCSS; инлайн‑вставка выключена
let _updInfo = { current: null, next: null };
function _getNumberSetting(key, def) {
  try {
    const raw = localStorage.getItem(key);
    if (raw === null || raw === undefined) return def;
    const n = Number(raw);
    return Number.isFinite(n) ? n : def;
  } catch { return def; }
}

function getTailShiftPx() {
  // Настройка: updFlyoverTailShiftPx (пиксели), смещение хвостика по X; по умолчанию 0
  return _getNumberSetting('updFlyoverTailShiftPx', 0);
}

function getFlyoverXOffset() {
  // Настройка: updFlyoverXOffsetPx — базовый сдвиг всей карточки по X; по умолчанию -8
  return _getNumberSetting('updFlyoverXOffsetPx', -8);
}

function ensureStyleOnce() { /* стили поставляются из SCSS */ }

function positionFlyover() {
  const anchor = document.getElementById("app-version-label");
  if (!anchor || !_updFly) return;
  const r = anchor.getBoundingClientRect();
  const top = r.bottom + 8;
  const left = Math.max(12, r.left + getFlyoverXOffset());
  _updFly.style.top = `${Math.round(top)}px`;
  _updFly.style.left = `${Math.round(left)}px`;
  // выравниваем «хвостик» относительно центра бейджа версии
  try {
    const flyRect = _updFly.getBoundingClientRect();
    const tailLeft = Math.max(
      12,
      Math.min((r.left + r.width / 2) - left - 6 + getTailShiftPx(), flyRect.width - 24)
    );
    _updFly.style.setProperty('--tail-left', `${Math.round(tailLeft)}px`);
  } catch {}
}

function ensureFlyover() {
  ensureStyleOnce();
  if (_updFly) return _updFly;
  const wrap = document.createElement("div");
  wrap.className = "upd-flyover";
  wrap.style.display = "none";
  wrap.innerHTML = `
    <button id=\"upd-close\" class=\"upd-close\" aria-label=\"Закрыть\">&times;</button>
    <div class="state state-available">
      <h3 class="hdr">Доступно обновление!</h3>
      <div class="ver">Текущая: <span class="cur" id="upd-cur">—</span> · Новая: <span class="next" id="upd-next">—</span></div>
      <div class="row">
        <button id="upd-start" class="btn btn-sm btn-primary">Обновить</button>
      </div>
    </div>
    <div class="state state-progress" style="display:none">
      <h3 class="hdr">Загрузка обновления…</h3>
      <div class="ver muted">Версия: <span id="upd-next-p">—</span></div>
      <progress id="upd-bar" value="0" max="100"></progress>
      <div class="muted" id="upd-label">0%</div>
    </div>
    <div class="state state-done" style="display:none">
      <h3 class="hdr">Обновление загружено</h3>
      <div class="muted">Перезапустите приложение для установки.</div>
      <div class="row" style="margin-top:8px">
        <button id="upd-restart" class="btn btn-sm btn-primary">Перезапуск</button>
      </div>
    </div>
    <div class="state state-error" style="display:none">
      <h3 class="hdr">Ошибка обновления</h3>
      <div class="muted" id="upd-err">Произошла ошибка</div>
    </div>`;
  document.body.appendChild(wrap);
  _updFly = wrap;

  const hide = () => (_updFly.style.display = "none");
  _updFly.querySelector("#upd-close")?.addEventListener("click", hide);
  _updFly.querySelector("#upd-start")?.addEventListener("click", () => {
    window.electron?.invoke && window.electron.invoke("download-update");
    showProgressPanel(0);
    // Уберём индикатор у бейджа версии сразу после старта
    try {
      const badge = document.querySelector('.version-container') || document.getElementById('app-version-label');
      badge?.querySelector('.update-indicator')?.remove();
    } catch {}
  });
  _updFly.querySelector("#upd-restart")?.addEventListener("click", () => {
    window.electron?.invoke && window.electron.invoke("restart-app");
  });
  
  window.addEventListener("resize", positionFlyover);
  return _updFly;
}

function switchState(name) {
  if (!_updFly) return;
  _updFly.querySelectorAll(".state").forEach((el) => (el.style.display = "none"));
  const el = _updFly.querySelector(`.state-${name}`);
  if (el) el.style.display = "block";
}

function showAvailable(message) {
  const fly = ensureFlyover();
  fly.style.display = "block";
  requestAnimationFrame(() => fly.classList.add('is-visible'));
  positionFlyover();
  // маленький индикатор возле бейджа версии
  try {
    const badge = document.querySelector('.version-container') || document.getElementById('app-version-label');
    if (badge && !badge.querySelector('.update-indicator')) {
      const dot = document.createElement('span');
      dot.className = 'update-indicator';
      (badge).appendChild(dot);
    }
  } catch {}
  switchState("available");
  const curEl = fly.querySelector("#upd-cur");
  const nextEl = fly.querySelector("#upd-next");
  const nextP = fly.querySelector("#upd-next-p");
  if (curEl && _updInfo.current) curEl.textContent = _updInfo.current;
  if (nextEl && _updInfo.next) nextEl.textContent = _updInfo.next;
  if (nextP && _updInfo.next) nextP.textContent = _updInfo.next;
}

function showProgressPanel(progress) {
  const fly = ensureFlyover();
  fly.style.display = "block";
  requestAnimationFrame(() => fly.classList.add('is-visible'));
  positionFlyover();
  switchState("progress");
  const bar = fly.querySelector("#upd-bar");
  const lab = fly.querySelector("#upd-label");
  const nextP = fly.querySelector("#upd-next-p");
  let percent = progress;
  let bps = null, transferred = null, total = null;
  if (typeof progress === 'object' && progress) {
    percent = progress.percent;
    bps = Number(progress.bytesPerSecond || 0);
    transferred = Number(progress.transferred || 0);
    total = Number(progress.total || 0);
  }
  const p = Math.max(0, Math.min(100, Number(percent) || 0));
  if (bar) bar.value = p;
  if (lab) {
    const parts = [`${Math.round(p)}%`];
    if (bps && bps > 0) {
      const fmt = (n) => {
        const units = ['B/s','KB/s','MB/s','GB/s'];
        let u = 0; let v = n;
        while (v >= 1024 && u < units.length-1) { v /= 1024; u++; }
        return `${v.toFixed(v>=100?0: v>=10?1:2)} ${units[u]}`;
      };
      parts.push(fmt(bps));
    }
    if (bps && bps > 0 && total && transferred >= 0 && total > transferred) {
      const remain = (total - transferred) / bps;
      const eta = Math.max(0, Math.round(remain));
      const mm = String(Math.floor(eta/60)).padStart(2,'0');
      const ss = String(eta%60).padStart(2,'0');
      parts.push(`~${mm}:${ss}`);
    }
    lab.textContent = parts.join(' • ');
  }
  if (nextP && _updInfo.next) nextP.textContent = _updInfo.next;
  // На прогрессе индикатор больше не нужен
  try {
    const badge = document.querySelector('.version-container') || document.getElementById('app-version-label');
    badge?.querySelector('.update-indicator')?.remove();
  } catch {}
}

function showDownloadedPanel() {
  const fly = ensureFlyover();
  fly.style.display = "block";
  requestAnimationFrame(() => fly.classList.add('is-visible'));
  positionFlyover();
  switchState("done");
  // На этапе «загружено» индикатор также удаляем
  try {
    const badge = document.querySelector('.version-container') || document.getElementById('app-version-label');
    badge?.querySelector('.update-indicator')?.remove();
  } catch {}
}

function showErrorPanel(error) {
  const fly = ensureFlyover();
  fly.style.display = "block";
  requestAnimationFrame(() => fly.classList.add('is-visible'));
  positionFlyover();
  switchState("error");
  const e = fly.querySelector("#upd-err");
  if (e) e.textContent = String(error || "Ошибка обновления");
}

function hideUpdateProgressBar() {
  const container = document.getElementById("update-progress-container");
  if (container) container.style.display = "none";
}

function initUpdateHandler() {
  hideUpdateProgressBar();
  electron.on("update-available", (message) => {
    showAvailable(message);
  });
  electron.on("update-available-info", (payload) => {
    try {
      _updInfo = { current: payload?.current || null, next: payload?.next || null };
      if (_updFly && _updFly.style.display !== 'none') {
        const curEl = _updFly.querySelector('#upd-cur');
        const nextEl = _updFly.querySelector('#upd-next');
        const nextP = _updFly.querySelector('#upd-next-p');
        if (curEl && _updInfo.current) curEl.textContent = _updInfo.current;
        if (nextEl && _updInfo.next) nextEl.textContent = _updInfo.next;
        if (nextP && _updInfo.next) nextP.textContent = _updInfo.next;
      }
    } catch {}
  });
  electron.on("update-progress", (progress) => {
    showProgressPanel(progress);
  });
  electron.on("update-error", (error) => {
    showErrorPanel(error);
  });
  electron.on("update-downloaded", () => {
    showDownloadedPanel();
  });

  // Подстраховка: закрытие старых модалок при любых кликах на их крестики
  document.querySelectorAll(".close-modal").forEach((button) => {
    button.addEventListener("click", (event) => {
      const modal = button.closest(".modal-overlay");
      if (modal) {
        hideUpdateProgressBar();
        modal.style.display = "none";
      }
    });
  });

  const closeErrorNotificationBtn = document.getElementById("close-error-notification");
  if (closeErrorNotificationBtn) {
    closeErrorNotificationBtn.addEventListener("click", () => {
      closeModal("update-error-modal");
    });
  }
}

// (автозакрытие отключено по требованию)

/**
 * Функция для отображения модального окна с предложением загрузить обновление.
 * @param {string} message - Сообщение для пользователя.
 */
function showUpdateAvailableModal(message) {
  const modal = document.getElementById("update-available-modal");
  if (modal) {
    const modalBody = modal.querySelector(".modal-body p");
    if (modalBody) {
      modalBody.textContent = message;
    }
    modal.style.display = "flex";
    modal.style.flexDirection = "row";
    modal.style.justifyContent = "center";
    modal.style.alignItems = "center";

    // Обработчики кнопок
    const downloadBtn = document.getElementById("download-update-btn");
    const laterBtn = document.getElementById("later-update-btn");

    if (downloadBtn) {
      downloadBtn.onclick = () => {
        electron.invoke("download-update");
        closeModal("update-available-modal");
      };
    }

    if (laterBtn) {
      laterBtn.onclick = () => {
        closeModal("update-available-modal");
      };
    }
  }
}

/**
 * Функция для отображения модального окна после загрузки обновления.
 */
function showUpdateDownloadedModal() {
  const modal = document.getElementById("update-downloaded-modal");
  if (modal) {
    hideUpdateProgressBar();
    modal.style.display = "flex";
    modal.style.flexDirection = "row";
    modal.style.justifyContent = "center";
    modal.style.alignItems = "center";

    // Обработчики кнопок
    const restartBtn = document.getElementById("restart-app-btn");
    const laterRestartBtn = document.getElementById("later-restart-btn");

    if (restartBtn) {
      restartBtn.onclick = () => {
        electron.invoke("restart-app");
        closeModal("update-downloaded-modal");
      };
    }

    if (laterRestartBtn) {
      laterRestartBtn.onclick = () => {
        closeModal("update-downloaded-modal");
      };
    }
  }
}

/**
 * Функция для обновления прогресс-бара.
 * @param {number} percent - Процент загрузки обновления.
 */
function updateProgressBar(percent) {
  const progressContainer = document.getElementById(
    "update-progress-container",
  );
  const progressBar = document.getElementById("update-progress-bar");
  const progressText = document.getElementById("update-progress-text");

  if (progressContainer && progressBar && progressText) {
    progressContainer.style.display = "flex";
    progressContainer.style.flexDirection = "column";
    progressContainer.style.justifyContent = "center";
    progressContainer.style.alignItems = "center";

    progressBar.value = percent;
    if (typeof percent === "number") {
      progressText.textContent = `Загрузка обновления... ${percent.toFixed(2)}%`;
    } else {
      progressText.textContent = "Загрузка обновления...";
    }
  }
}

/**
 * Функция для отображения уведомления об ошибке.
 * @param {string} error - Сообщение об ошибке.
 */
function showErrorNotification(error) {
  const modal = document.getElementById("update-error-modal");
  const errorMessage = document.getElementById("update-error-message");

  if (modal && errorMessage) {
    hideUpdateProgressBar();
    errorMessage.textContent = `Ошибка обновления: ${error}`;
    modal.style.display = "flex";
    modal.style.flexDirection = "row";
    modal.style.justifyContent = "center";
    modal.style.alignItems = "center";
  }
}

/**
 * Функция для закрытия модального окна по его ID.
 * @param {string} modalId - ID модального окна.
 */
function closeModal(modalId) {
  const modal = document.getElementById(modalId);
  if (modal) {
    modal.style.display = "none";
  }
}

export { initUpdateHandler, updateProgressBar };
