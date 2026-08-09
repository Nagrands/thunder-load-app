const createCompactQualityController =
  window.WebCompactQuality.createCompactQuality;
const createRouterController = window.WebControlRouter.createWebRouter;
const bindBeforeUnload = window.WebSettings.bindSettingsBeforeUnload;
const createSettingsController = window.WebSettings.createWebSettingsController;
const HISTORY_SAVE_ERROR_CODE = "HISTORY_SAVE_FAILED";

const ICONS = {
  archiveX:
    '<svg class="icon" viewBox="0 0 24 24" aria-hidden="true"><path d="M3 7h18M5 7l1 13h12l1-13M8 7V4h8v3M9 11l6 6M15 11l-6 6"/></svg>',
  check:
    '<svg class="icon" viewBox="0 0 24 24" aria-hidden="true"><path d="m20 6-11 11-5-5"/></svg>',
  external:
    '<svg class="icon" viewBox="0 0 24 24" aria-hidden="true"><path d="M14 3h7v7M10 14 21 3M21 14v5a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5"/></svg>',
  folder:
    '<svg class="icon" viewBox="0 0 24 24" aria-hidden="true"><path d="M3 7h6l2 2h10v9a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2Z"/></svg>',
  inbox:
    '<svg class="icon" viewBox="0 0 24 24" aria-hidden="true"><path d="M22 12h-6l-2 3h-4l-2-3H2M5.5 5h13L22 12v7a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2v-7Z"/></svg>',
  pause:
    '<svg class="icon" viewBox="0 0 24 24" aria-hidden="true"><path d="M8 5v14M16 5v14"/></svg>',
  play: '<svg class="icon" viewBox="0 0 24 24" aria-hidden="true"><path d="m8 5 11 7-11 7Z"/></svg>',
  more: '<svg class="icon" viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="5" r="1"/><circle cx="12" cy="12" r="1"/><circle cx="12" cy="19" r="1"/></svg>',
  refresh:
    '<svg class="icon" viewBox="0 0 24 24" aria-hidden="true"><path d="M21 12a9 9 0 1 1-2.6-6.4M21 3v6h-6"/></svg>',
  trash:
    '<svg class="icon" viewBox="0 0 24 24" aria-hidden="true"><path d="M3 6h18M8 6V4h8v2m-1 5v6M9 11v6M5 6l1 14h12l1-14"/></svg>',
  x: '<svg class="icon" viewBox="0 0 24 24" aria-hidden="true"><path d="M18 6 6 18M6 6l12 12"/></svg>',
};

const el = {
  jobSummaryTitle: document.getElementById("job-summary-title"),
  jobSummaryMeta: document.getElementById("job-summary-meta"),
  urlInput: document.getElementById("url-input"),
  clearUrl: document.getElementById("clear-url"),
  videoQuality: document.getElementById("compact-video-quality"),
  audioQuality: document.getElementById("compact-audio-quality"),
  qualityStatus: document.getElementById("quality-status"),
  queue: document.getElementById("queue-list"),
  pause: document.getElementById("pause-queue"),
  clearQueue: document.getElementById("clear-queue"),
  undoClearQueue: document.getElementById("undo-clear-queue"),
  settingsModal: document.getElementById("settings-modal"),
  settingsSaveStatus: document.getElementById("settings-save-status"),
  counts: {
    pending: document.getElementById("queue-count"),
    running: document.getElementById("queue-active-count"),
    failed: document.getElementById("queue-failed-count"),
  },
  filterCounts: {
    all: document.querySelector('[data-filter-count="all"]'),
    active: document.querySelector('[data-filter-count="active"]'),
    pending: document.querySelector('[data-filter-count="pending"]'),
    failed: document.querySelector('[data-filter-count="failed"]'),
  },
  settings: {
    downloadPath: document.getElementById("setting-download-path"),
    parallelLimit: document.getElementById("setting-parallel"),
    qualityProfile: document.getElementById("setting-quality-profile"),
    theme: document.getElementById("setting-theme"),
    language: document.getElementById("setting-language"),
    fontSize: document.getElementById("setting-font-size"),
    autoOpenQualityModal: document.getElementById("setting-auto-quality"),
    openOnCopyUrl: document.getElementById("setting-open-copy"),
    openOnDownloadComplete: document.getElementById("setting-open-complete"),
    disableCompleteModal: document.getElementById("setting-disable-complete"),
    showToolsStatus: document.getElementById("setting-tools-status"),
  },
};

let currentState = {};
let queueFilter = "all";
const queueRowsById = new Map();

function apiUrl(path) {
  return new URL(path, window.location.origin).toString();
}

async function request(path, options = {}) {
  const response = await fetch(apiUrl(path), {
    ...options,
    headers: {
      "Content-Type": "application/json",
      ...(options.headers || {}),
    },
  });
  const data = await response.json();
  if (!response.ok || data.success === false) {
    throw new Error(
      (data.error && typeof data.error === "object"
        ? data.error.message
        : data.error) || "Request failed",
    );
  }
  return data;
}

function escapeHtml(value) {
  return String(value || "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;");
}

function getStatusLabel(job = {}) {
  const labels = {
    cancelled: "Отменено",
    failed: "Ошибка",
    paused: "Пауза",
    pending: "Ожидает",
    running: "Загрузка",
  };
  return labels[job.status] || job.status || "Ожидает";
}

function getStatusClass(job = {}) {
  const status = String(job.status || "pending");
  if (status === "running") return "is-running";
  if (status === "failed") return "is-failed";
  if (status === "cancelled") return "is-cancelled";
  return "is-pending";
}

function getFilterCounts(state = {}) {
  const counts = state.counts || {};
  const active = counts.running || 0;
  const pending = counts.pending || 0;
  const failed = counts.failed || 0;
  return {
    active,
    all: active + pending + failed,
    failed,
    pending,
  };
}

function filterJobs(jobs = []) {
  if (queueFilter === "all") return jobs;
  if (queueFilter === "active") {
    return jobs.filter((job) => job.status === "running");
  }
  return jobs.filter((job) => job.status === queueFilter);
}

function renderSummary(state = {}) {
  const counts = state.counts || {};
  const filterCounts = getFilterCounts(state);
  el.counts.pending.textContent = `${counts.pending || 0} в очереди`;
  el.counts.running.textContent = `${counts.running || 0} активно`;
  el.counts.failed.textContent = `${counts.failed || 0} ошибок`;
  Object.entries(filterCounts).forEach(([key, value]) => {
    if (el.filterCounts[key]) el.filterCounts[key].textContent = String(value);
  });
  el.pause.innerHTML = state.queuePaused ? ICONS.play : ICONS.pause;
  el.pause.classList.toggle("is-active", state.queuePaused === true);
  el.pause.title = state.queuePaused
    ? "Продолжить запуск очереди"
    : "Не запускать следующие";
  el.pause.setAttribute("aria-label", el.pause.title);
  const clearableCount =
    queueFilter === "active"
      ? 0
      : queueFilter === "pending"
        ? counts.pending || 0
        : queueFilter === "failed"
          ? counts.failed || 0
          : (counts.pending || 0) + (counts.failed || 0);
  el.clearQueue.disabled = clearableCount <= 0;
  el.undoClearQueue.hidden = state.undoClearAvailable !== true;
  el.jobSummaryTitle.textContent =
    counts.running > 0
      ? "Идёт загрузка"
      : counts.pending > 0
        ? "Есть задачи в очереди"
        : "Очередь синхронизирована";
  el.jobSummaryMeta.textContent = `Активные: ${counts.running || 0}, ожидают: ${
    counts.pending || 0
  }, ошибки: ${counts.failed || 0}`;
  window.ThunderWebUiState?.apply(el.jobSummaryMeta, {
    kind:
      counts.running > 0
        ? "loading"
        : counts.failed > 0
          ? "warning"
          : counts.pending > 0
            ? "idle"
            : "success",
    operationId: counts.running > 0 ? "queue-active" : "",
  });
}

function renderEmptyQueue(filtered = false) {
  queueRowsById.clear();
  el.queue.innerHTML = `<div class="queue-empty" role="listitem">
    <span class="queue-empty-icon" aria-hidden="true">${ICONS.inbox}</span>
    <p class="queue-empty-title">${
      filtered ? "Нет задач в этом фильтре" : "Очередь пуста"
    }</p>
    <p class="queue-empty-hint">${
      filtered
        ? "Выберите другой фильтр или добавьте новую ссылку."
        : "Добавьте URL выше, чтобы начать."
    }</p>
  </div>`;
  window.ThunderWebUiState?.apply(el.queue, { kind: "empty" });
}

function renderQueueActions(job = {}, id = "") {
  const isRunning = job.status === "running";
  const isFailed = job.status === "failed";
  const isPending = job.status === "pending" || job.status === "paused";
  const isHistoryRecovery =
    isFailed &&
    job.errorCode === HISTORY_SAVE_ERROR_CODE &&
    Boolean(job.filePath);
  const actions = [
    isRunning
      ? `<button data-action="downloader:cancel" data-id="${id}" title="Отмена">${ICONS.x}<span>Отмена</span></button>`
      : "",
    isPending
      ? `<button data-action="downloader:start-one" data-id="${id}" title="Запустить эту">${ICONS.play}<span>Запустить эту</span></button>`
      : "",
    isFailed
      ? `<button data-action="downloader:retry" data-id="${id}" title="${isHistoryRecovery ? "Повторить запись в Историю" : "Повтор"}" ${job.retryable === false && !isHistoryRecovery ? "disabled" : ""}>${ICONS.refresh}<span>${isHistoryRecovery ? "В Историю" : "Повтор"}</span></button>`
      : "",
    isHistoryRecovery
      ? `<button data-action="downloader:open" data-id="${id}" title="Открыть">${ICONS.external}<span>Открыть</span></button>`
      : "",
    isHistoryRecovery
      ? `<button data-action="downloader:reveal" data-id="${id}" title="Показать в папке">${ICONS.folder}<span>Папка</span></button>`
      : "",
    !isRunning
      ? `<button data-action="downloader:remove" data-id="${id}" title="Убрать">${ICONS.archiveX}<span>Убрать</span></button>`
      : "",
  ];
  return actions.join("");
}

function renderState(state = {}) {
  currentState = state;
  renderSummary(state);
  const jobs = Array.isArray(state.jobs) ? state.jobs : [];
  const visibleJobs = filterJobs(jobs);
  if (!visibleJobs.length) {
    renderEmptyQueue(jobs.length > 0);
    return;
  }

  const nextIds = new Set(
    visibleJobs.map((job) => String(job.jobId || job.id || job.signature)),
  );
  for (const [id, row] of queueRowsById) {
    if (nextIds.has(id)) continue;
    row.remove();
    queueRowsById.delete(id);
  }
  for (const [index, job] of visibleJobs.entries()) {
    const rawId = String(job.jobId || job.id || job.signature);
    const id = escapeHtml(job.jobId || job.id || job.signature);
    const title = escapeHtml(job.title || job.url || "Без названия");
    const url = escapeHtml(job.url || "");
    const status = escapeHtml(getStatusLabel(job));
    const progress = Math.max(
      0,
      Math.min(100, Math.round(Number(job.progress) || 0)),
    );
    const qualityValue = job.quality || job.qualityMode || "source";
    const quality = escapeHtml(
      typeof qualityValue === "object"
        ? qualityValue.label || qualityValue.resolution || qualityValue.type
        : qualityValue,
    );
    const structureKey = JSON.stringify({
      index,
      id: rawId,
      status: job.status,
      title,
      url,
      quality,
      retryable: job.retryable,
      errorCode: job.errorCode,
      filePath: job.filePath,
    });
    let row = queueRowsById.get(rawId);
    if (!row || row.dataset.queueStructure !== structureKey) {
      const template = document.createElement("template");
      template.innerHTML = `<article class="queue-item ${getStatusClass(job)}" role="listitem" data-job-id="${id}">
        <span class="queue-progress-line" data-queue-progress-bar style="width:${progress}%"></span>
        <div class="queue-item-index-wrap">
          <span class="queue-item-index">${index + 1}</span>
        </div>
        <div class="queue-item-main">
          <div class="queue-item-title">${title}</div>
          <div class="queue-item-subtitle">${url}</div>
        </div>
        <div class="queue-item-right">
          <span class="queue-status-chip" data-queue-status>${status}</span>
          <span class="queue-quality-chip">${quality}</span>
          <span class="queue-stage-chip" data-queue-progress-label>${progress}%</span>
        </div>
        <div class="queue-item-actions-wrap">
          <button type="button" class="queue-item-menu-toggle" data-menu-toggle aria-haspopup="menu" aria-expanded="false" title="Действия">${ICONS.more}<span class="visually-hidden">Действия</span></button>
          <div class="queue-item-actions" role="menu" hidden>${renderQueueActions(job, id)}</div>
        </div>
      </article>`;
      const replacement = template.content.firstElementChild;
      replacement.dataset.queueStructure = structureKey;
      row?.replaceWith(replacement);
      row = replacement;
      queueRowsById.set(rawId, row);
    }
    row.querySelector("[data-queue-progress-bar]").style.width = `${progress}%`;
    row.querySelector("[data-queue-progress-label]").textContent =
      `${progress}%`;
    el.queue.appendChild(row);
  }
  window.ThunderWebUiState?.apply(el.queue, {
    kind: visibleJobs.some((job) => job.status === "running")
      ? "loading"
      : visibleJobs.some((job) => job.status === "failed")
        ? "warning"
        : "success",
  });
}

function renderQueueLoading() {
  queueRowsById.clear();
  el.queue.innerHTML = Array.from(
    { length: 3 },
    (
      _,
      index,
    ) => `<div class="queue-item queue-item-skeleton" aria-hidden="true">
      <span class="queue-skeleton-index">${index + 1}</span>
      <span class="queue-skeleton-copy"><span></span><span></span></span>
      <span class="queue-skeleton-chip"></span>
    </div>`,
  ).join("");
  window.ThunderWebUiState?.apply(el.queue, {
    kind: "loading",
    operationId: "web-control:initial-state",
  });
}

async function refreshState() {
  const { state } = await request("/api/state");
  renderState(state);
}

async function sendAction(action, payload = {}) {
  const { result } = await request("/api/action", {
    method: "POST",
    body: JSON.stringify({ action, payload }),
  });
  renderState(result);
}

function showDiscardSettingsDialog() {
  const russian = String(navigator.language || "")
    .toLowerCase()
    .startsWith("ru");
  const copy = russian
    ? {
        title: "Сбросить несохранённые изменения?",
        message: "Изменения настроек Web Control не были сохранены.",
        confirm: "Сбросить",
        cancel: "Продолжить редактирование",
      }
    : {
        title: "Discard unsaved changes?",
        message: "Your Web Control settings changes have not been saved.",
        confirm: "Discard",
        cancel: "Continue editing",
      };
  const previousFocus = document.activeElement;
  const root = document.createElement("div");
  root.className = "web-confirmation";
  root.innerHTML = `<div class="web-confirmation__backdrop"></div>
    <section class="web-confirmation__dialog" role="alertdialog" aria-modal="true" aria-labelledby="web-confirmation-title">
      <h2 id="web-confirmation-title">${copy.title}</h2>
      <p>${copy.message}</p>
      <div class="web-confirmation__actions">
        <button type="button" data-confirmation-cancel>${copy.cancel}</button>
        <button type="button" class="is-danger" data-confirmation-confirm>${copy.confirm}</button>
      </div>
    </section>`;
  document.body.appendChild(root);
  return new Promise((resolve) => {
    const finish = (confirmed) => {
      document.removeEventListener("keydown", onKeydown, true);
      root.remove();
      previousFocus?.focus?.();
      resolve(confirmed);
    };
    const onKeydown = (event) => {
      if (event.key !== "Escape") return;
      event.preventDefault();
      finish(false);
    };
    root
      .querySelector("[data-confirmation-cancel]")
      .addEventListener("click", () => finish(false), { once: true });
    root
      .querySelector("[data-confirmation-confirm]")
      .addEventListener("click", () => finish(true), { once: true });
    root
      .querySelector(".web-confirmation__backdrop")
      .addEventListener("click", () => finish(false), { once: true });
    document.addEventListener("keydown", onKeydown, true);
    root.querySelector("[data-confirmation-cancel]").focus();
  });
}

function showQueueClearDialog() {
  const russian = String(navigator.language || "")
    .toLowerCase()
    .startsWith("ru");
  const copy = russian
    ? {
        title: "Что очистить?",
        message: "Активные загрузки не будут затронуты.",
        pending: "Ожидающие",
        failed: "Ошибки",
        all: "Всё неактивное",
        cancel: "Отмена",
      }
    : {
        title: "What should be cleared?",
        message: "Active downloads will not be affected.",
        pending: "Pending jobs",
        failed: "Errors",
        all: "All inactive jobs",
        cancel: "Cancel",
      };
  const previousFocus = document.activeElement;
  const root = document.createElement("div");
  root.className = "web-confirmation";
  root.innerHTML = `<div class="web-confirmation__backdrop"></div>
    <section class="web-confirmation__dialog" role="dialog" aria-modal="true" aria-labelledby="web-queue-clear-title">
      <h2 id="web-queue-clear-title">${copy.title}</h2>
      <p>${copy.message}</p>
      <div class="web-confirmation__actions">
        <button type="button" data-clear-choice="pending">${copy.pending}</button>
        <button type="button" data-clear-choice="failed">${copy.failed}</button>
        <button type="button" class="is-danger" data-clear-choice="all">${copy.all}</button>
        <button type="button" data-clear-choice="">${copy.cancel}</button>
      </div>
    </section>`;
  document.body.appendChild(root);
  return new Promise((resolve) => {
    const finish = (choice) => {
      document.removeEventListener("keydown", onKeydown, true);
      root.remove();
      previousFocus?.focus?.();
      resolve(choice || false);
    };
    const onKeydown = (event) => {
      if (event.key !== "Escape") return;
      event.preventDefault();
      finish(false);
    };
    root.querySelectorAll("[data-clear-choice]").forEach((button) => {
      button.addEventListener(
        "click",
        () => finish(button.dataset.clearChoice),
        {
          once: true,
        },
      );
    });
    root
      .querySelector(".web-confirmation__backdrop")
      .addEventListener("click", () => finish(false), { once: true });
    document.addEventListener("keydown", onKeydown, true);
    root.querySelector('[data-clear-choice="all"]').focus();
  });
}

const settingsController = createSettingsController({
  fields: el.settings,
  saveButton: document.getElementById("save-settings"),
  status: el.settingsSaveStatus,
  request,
});

const router = createRouterController({
  modal: el.settingsModal,
  hasUnsavedChanges: settingsController.isDirty,
  confirmDiscard: showDiscardSettingsDialog,
  onDiscard: settingsController.cancel,
});

const compactQuality = createCompactQualityController({
  input: el.urlInput,
  videoSelect: el.videoQuality,
  audioSelect: el.audioQuality,
  status: el.qualityStatus,
  actions: [
    document.getElementById("download-now"),
    document.getElementById("add-queue"),
  ],
  request,
});

document.querySelectorAll("[data-settings-open]").forEach((button) => {
  button.addEventListener("click", router.openSettings);
});

document.querySelectorAll("[data-settings-close]").forEach((button) => {
  button.addEventListener("click", router.closeSettings);
});

document.querySelectorAll("[data-settings-cancel]").forEach((button) => {
  button.addEventListener("click", () => {
    settingsController.cancel();
    router.closeSettings({ force: true });
  });
});

document.querySelectorAll("[data-settings-tab]").forEach((button) => {
  button.addEventListener("click", () => {
    const tab = button.dataset.settingsTab;
    document.querySelectorAll("[data-settings-tab]").forEach((node) => {
      node.classList.toggle("is-active", node === button);
    });
    document.querySelectorAll("[data-settings-pane]").forEach((pane) => {
      pane.classList.toggle("is-active", pane.dataset.settingsPane === tab);
    });
  });
});

document.querySelectorAll("[data-filter]").forEach((button) => {
  button.addEventListener("click", () => {
    queueFilter = button.dataset.filter || "all";
    document.querySelectorAll("[data-filter]").forEach((node) => {
      const active = node === button;
      node.classList.toggle("is-active", active);
      node.setAttribute("aria-pressed", active ? "true" : "false");
    });
    renderState(currentState);
  });
});

document.getElementById("download-now").addEventListener("click", async () => {
  const payload = compactQuality.getPayload();
  if (!payload) return;
  await sendAction("downloader:start", payload);
  el.urlInput.value = "";
  compactQuality.clear();
});

document.getElementById("add-queue").addEventListener("click", async () => {
  const payload = compactQuality.getPayload();
  if (!payload) return;
  await sendAction("downloader:add", payload);
  el.urlInput.value = "";
  compactQuality.clear();
});

document.getElementById("start-queue").addEventListener("click", () => {
  void sendAction("downloader:start-pending");
});

el.pause.addEventListener("click", () => {
  const action = el.pause.classList.contains("is-active")
    ? "downloader:resume"
    : "downloader:pause";
  void sendAction(action);
});

el.clearUrl.addEventListener("click", () => {
  el.urlInput.value = "";
  compactQuality.clear();
  el.urlInput.focus();
});

el.urlInput.addEventListener("keydown", (event) => {
  if (event.key !== "Enter" || event.shiftKey) return;
  event.preventDefault();
  const payload = compactQuality.getPayload();
  if (!payload) {
    void compactQuality.analyze();
    return;
  }
  void sendAction("downloader:start", payload).then(() => {
    el.urlInput.value = "";
    compactQuality.clear();
  });
});

document.getElementById("clear-queue").addEventListener("click", async () => {
  const target =
    queueFilter === "pending"
      ? "pending"
      : queueFilter === "failed"
        ? "failed"
        : queueFilter === "active"
          ? false
          : await showQueueClearDialog();
  if (!target) return;
  await sendAction("downloader:clear", { target });
});

el.undoClearQueue.addEventListener("click", () => {
  void sendAction("downloader:undo-clear");
});

el.queue.addEventListener("click", (event) => {
  const menuToggle = event.target.closest("[data-menu-toggle]");
  if (menuToggle) {
    const actions = menuToggle.parentElement?.querySelector(
      ".queue-item-actions",
    );
    const open = actions?.hidden !== false;
    el.queue.querySelectorAll(".queue-item-actions").forEach((menu) => {
      menu.hidden = true;
      menu.parentElement
        ?.querySelector("[data-menu-toggle]")
        ?.setAttribute("aria-expanded", "false");
    });
    if (actions) actions.hidden = !open;
    menuToggle.setAttribute("aria-expanded", String(open));
    if (open) actions?.querySelector("button:not(:disabled)")?.focus();
    return;
  }
  const button = event.target.closest("[data-action]");
  if (!button) return;
  void sendAction(button.dataset.action, { jobId: button.dataset.id });
});

document.addEventListener("click", (event) => {
  if (event.target.closest?.(".queue-item-actions-wrap")) return;
  el.queue.querySelectorAll(".queue-item-actions").forEach((menu) => {
    menu.hidden = true;
    menu.parentElement
      ?.querySelector("[data-menu-toggle]")
      ?.setAttribute("aria-expanded", "false");
  });
});

document
  .getElementById("save-settings")
  .addEventListener("click", () => void settingsController.save());

document.addEventListener("keydown", (event) => {
  if (event.key === "Escape") {
    el.queue.querySelectorAll(".queue-item-actions").forEach((menu) => {
      if (menu.hidden) return;
      menu.hidden = true;
      const toggle = menu.parentElement?.querySelector("[data-menu-toggle]");
      toggle?.setAttribute("aria-expanded", "false");
      toggle?.focus();
    });
  }
  if (
    event.key === "Escape" &&
    el.settingsModal.classList.contains("is-open")
  ) {
    router.closeSettings();
  }
});

try {
  const events = new EventSource(apiUrl("/events"));
  events.addEventListener("ready", () => {});
  events.addEventListener("state", () => {
    void refreshState().catch(() => {});
    void settingsController.refreshRemote().catch(() => {});
  });
  events.addEventListener("settings", (event) => {
    try {
      settingsController.applyRemote(JSON.parse(event.data));
    } catch {
      void settingsController.refreshRemote().catch(() => {});
    }
  });
  events.onerror = () => {};
} catch {}

bindBeforeUnload(settingsController.isDirty);

renderQueueLoading();
Promise.all([refreshState(), settingsController.refreshRemote()]).catch(
  (error) => {
    el.jobSummaryTitle.textContent = "Веб-интерфейс недоступен";
    el.jobSummaryMeta.textContent = String(
      error?.message || "Ошибка соединения",
    );
    window.ThunderWebUiState?.apply(el.queue, {
      kind: "error",
      operationId: "web-control:initial-state",
    });
  },
);
