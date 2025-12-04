// src/js/modules/wgAutoShutdownNotifier.js

import { toastContainer } from "./domElements.js";
import { showToast } from "./toast.js";

let activeToast = null;
let countdownTimer = null;
let countdownValueEl = null;
let progressEl = null;
let deadlineTs = null;
let totalSeconds = 0;
let autosendEnabled = false;
let initialized = false;
let autoShutdownWasEnabled = null; // track initial auto-shutdown flag to roll back if we enable temporarily
let startedAtMs = null;
let lastDeadlineMs = null;
let lastSeconds = null;

const isValidDeadline = (val) => {
  const num = Number(val);
  if (!Number.isFinite(num)) return false;
  // Считаем валидным только дедлайн в будущем
  return num > Date.now();
};

const getContainer = () => {
  if (toastContainer) return toastContainer;
  const byId = document.getElementById("toast-container");
  if (byId) return byId;
  const existing = document.querySelector(".toast-container");
  if (existing) return existing;
  if (document?.body) {
    const created = document.createElement("div");
    created.id = "toast-container";
    created.className = "toast-container";
    document.body.appendChild(created);
    return created;
  }
  return null;
};

const hideToast = () => {
  if (countdownTimer) {
    clearInterval(countdownTimer);
    countdownTimer = null;
  }

  deadlineTs = null;
  totalSeconds = 0;

  if (activeToast) {
    const container = getContainer();
    if (container && activeToast.parentNode === container) {
      container.removeChild(activeToast);
    }
  }
  activeToast = null;
  countdownValueEl = null;
  progressEl = null;
};

const formatSeconds = (secs) => {
  const safe = Math.max(0, Math.round(secs));
  const m = Math.floor(safe / 60);
  const s = String(safe % 60).padStart(2, "0");
  return `${String(m).padStart(2, "0")}:${s}`;
};

const updateCountdown = () => {
  if (!activeToast || !totalSeconds) return;

  const now = Date.now();
  const target = Number.isFinite(deadlineTs)
    ? deadlineTs
    : startedAtMs
      ? startedAtMs + totalSeconds * 1000
      : now + totalSeconds * 1000;

  const remainingMs = target - now;
  const remainingSec = Math.max(0, Math.ceil(remainingMs / 1000));

  if (countdownValueEl)
    countdownValueEl.textContent = formatSeconds(remainingSec);

  if (progressEl) {
    const ratio = Math.min(1, Math.max(0, remainingMs / (totalSeconds * 1000)));
    progressEl.style.transform = `scaleX(${ratio})`;
  }

  if (remainingSec <= 0) {
    // Если дедлайн в прошлом (например, не успел прийти валидный дедлайн от main)
    // и мы только что запустили таймер — перезапустим с текущими totalSeconds, чтобы не мигал тост.
    const justStarted = startedAtMs && Date.now() - startedAtMs < 1500;
    if (justStarted) {
      deadlineTs = Date.now() + totalSeconds * 1000;
      updateCountdown();
      return;
    }
    hideToast();
  }
};

const createToast = () => {
  const container = getContainer();
  if (!container) return;

  // Удаляем предыдущие авто‑закрытие тосты, чтобы не копились
  Array.from(container.querySelectorAll(".toast-autoshutdown")).forEach(
    (node) => {
      try {
        container.removeChild(node);
      } catch (_) {}
    },
  );

  const toast = document.createElement("div");
  toast.className = "toast toast-warning toast-compact toast-autoshutdown";
  toast.innerHTML = `
    <i class="toast-icon fa-solid fa-clock"></i>
    <div class="toast-content">
      <div class="toast-title">Авто‑закрытие</div>
      <div class="toast-countdown-row">
        <div class="toast-message">
          Приложение закроется через <span class="toast-countdown-value">—</span>
        </div>
        <button class="toast-action-btn" type="button">
          Отменить закрытие
        </button>
      </div>
    </div>
    <button class="toast-close" aria-label="Закрыть уведомление">
      <i class="fas fa-times"></i>
    </button>
    <div class="toast-progress"></div>
  `;

  container.appendChild(toast);
  requestAnimationFrame(() => toast.classList.add("show"));
  activeToast = toast;
  countdownValueEl = toast.querySelector(".toast-countdown-value");
  progressEl = toast.querySelector(".toast-progress");

  if (progressEl) {
    progressEl.style.animation = "none";
    progressEl.style.transformOrigin = "left";
  }

  const closeBtn = toast.querySelector(".toast-close");
  closeBtn?.addEventListener("click", (e) => {
    e.preventDefault();
    e.stopPropagation();
    hideToast();
  });

  const cancelBtn = toast.querySelector(".toast-action-btn");
  cancelBtn?.addEventListener("click", async (e) => {
    e.preventDefault();
    e.stopPropagation();

    if (!window.electron?.invoke) {
      hideToast();
      return;
    }

    cancelBtn.disabled = true;
    try {
      await window.electron.invoke("set-auto-shutdown-status", false);
      showToast("Авто‑закрытие отменено", "success");
    } catch (error) {
      console.error("[wg-autoshutdown] cancel error:", error);
      showToast("Не удалось отменить авто‑закрытие", "error");
      cancelBtn.disabled = false;
      return;
    }
    hideToast();
  });
};

const ensureToast = () => {
  const container = getContainer();
  if (!container) return false;
  if (!activeToast) {
    createToast();
  }
  return !!activeToast;
};

const startCountdown = (deadlineMs, seconds) => {
  if (countdownTimer) {
    clearInterval(countdownTimer);
    countdownTimer = null;
  }

  // Если уже бежит таймер с теми же параметрами — не мигать тостом повторно
  const newSeconds = Math.max(1, Number(seconds) || 30);
  const dl = isValidDeadline(deadlineMs) ? Number(deadlineMs) : null;
  const newDeadline = Number.isFinite(dl) ? dl : null;
  const now = Date.now();
  if (
    activeToast &&
    countdownTimer &&
    lastSeconds === newSeconds &&
    lastDeadlineMs &&
    newDeadline &&
    Math.abs(lastDeadlineMs - newDeadline) < 1500
  ) {
    // просто обновим текущие поля и не будем пересоздавать тост
    totalSeconds = newSeconds;
    deadlineTs = newDeadline;
    startedAtMs = now;
    lastDeadlineMs = newDeadline;
    updateCountdown();
    return;
  }

  if (!ensureToast()) return;

  totalSeconds = newSeconds;
  startedAtMs = now;
  deadlineTs = Number.isFinite(dl) ? dl : Date.now() + totalSeconds * 1000;
  lastDeadlineMs = deadlineTs;
  lastSeconds = totalSeconds;

  createToast();
  updateCountdown();

  if (countdownTimer) clearInterval(countdownTimer);
  countdownTimer = setInterval(updateCountdown, 1000);
};

const handleUpdate = ({ enabled, seconds, deadline }) => {
  const secs = Number(seconds) || 30;
  const dl = isValidDeadline(deadline) ? Number(deadline) : null;
  const shouldRun = autosendEnabled || enabled === true;

  if (shouldRun) {
    startCountdown(Number.isFinite(dl) ? dl : Date.now() + secs * 1000, secs);
    return;
  }

  // Явное отключение авто‑закрытия при отсутствии автосенда
  if (enabled === false && !autosendEnabled) {
    hideToast();
  }
};

const syncFromMain = async () => {
  if (!window.electron?.invoke) return;
  try {
    const [enabled, seconds, deadline] = await Promise.all([
      window.electron.invoke("get-auto-shutdown-status"),
      window.electron.invoke("get-auto-shutdown-seconds"),
      window.electron.invoke("get-auto-shutdown-deadline").catch(() => null),
    ]);

    const secs = Number(seconds) || 30;
    const shouldShow = autosendEnabled || enabled === true;

    if (autoShutdownWasEnabled === null) {
      autoShutdownWasEnabled = !!enabled;
    }

    if (!enabled && autosendEnabled) {
      // If autosend is on but auto-shutdown is off — enable it for this session so the timer and toast appear.
      autoShutdownWasEnabled = false;
      await window.electron.invoke("set-auto-shutdown-status", true);
      const dlRaw = await window.electron
        .invoke("get-auto-shutdown-deadline")
        .catch(() => null);
      const dl = isValidDeadline(dlRaw)
        ? Number(dlRaw)
        : Date.now() + secs * 1000;
      startCountdown(dl, secs);
      return;
    }

    if (!shouldShow && enabled === false) {
      hideToast();
      return;
    }

    if (!shouldShow) return; // не трогаем тост, если нет явного запроса показывать

    const dl = isValidDeadline(deadline) ? Number(deadline) : null;
    startCountdown(Number.isFinite(dl) ? dl : Date.now() + secs * 1000, secs);
  } catch (error) {
    console.error("[wg-autoshutdown] toast init error:", error);
  }
};

export function initWgAutoShutdownNotifier({ autosend } = {}) {
  autosendEnabled = !!autosend;
  if (!window.electron?.invoke) return;

  if (!initialized) {
    initialized = true;
    const autosendCheckbox = document.getElementById("wg-autosend");

    const syncAutosendFlag = () => {
      if (autosendCheckbox && typeof autosendCheckbox.checked === "boolean") {
        autosendEnabled = !!autosendCheckbox.checked;
      }
    };

    // Синхронизируем актуальное состояние чекбокса при старте (если DOM уже готов)
    syncAutosendFlag();

    autosendCheckbox?.addEventListener("change", (e) => {
      autosendEnabled = !!e.target.checked;
      if (autosendEnabled) {
        syncFromMain();
      } else {
        if (autoShutdownWasEnabled === false) {
          window.electron
            ?.invoke?.("set-auto-shutdown-status", false)
            .catch(() => {});
        }
        hideToast();
        autoShutdownWasEnabled = null;
      }
    });

    window.electron.on?.("wg-auto-shutdown-updated", (payload) => {
      handleUpdate(payload || {});
    });

    // Подстрахуемся логированием в консоль для отладки редких стартовых гонок
    console.debug?.("[wg-autoshutdown] notifier initialized", {
      autosendEnabled,
    });
  }

  // Всегда пробуем синхронизироваться на старте (даже если autosend off — тост нужен при включённом авто-закрытии)
  syncFromMain();
  // Повторный запуск чуть позже — на случай, если preload/DOM не успели
  setTimeout(syncFromMain, 400);
  setTimeout(syncFromMain, 1200);
}
