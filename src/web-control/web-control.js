const createCompactQualityController =
  window.WebCompactQuality.createCompactQuality;
const createRouterController = window.WebControlRouter.createWebRouter;
const bindBeforeUnload = window.WebSettings.bindSettingsBeforeUnload;
const createSettingsController =
  window.WebSettings.createWebSettingsController;

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
  settingsModal: document.getElementById("settings-modal"),
  settingsSaveStatus: document.getElementById("settings-save-status"),
  counts: {
    pending: document.getElementById("queue-count"),
    running: document.getElementById("queue-active-count"),
    failed: document.getElementById("queue-failed-count"),
    done: document.getElementById("queue-done-count"),
  },
  filterCounts: {
    all: document.querySelector('[data-filter-count="all"]'),
    active: document.querySelector('[data-filter-count="active"]'),
    pending: document.querySelector('[data-filter-count="pending"]'),
    failed: document.querySelector('[data-filter-count="failed"]'),
    done: document.querySelector('[data-filter-count="done"]'),
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
    done: "Готово",
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
  if (status === "done") return "is-done";
  if (status === "cancelled") return "is-cancelled";
  return "is-pending";
}

function getFilterCounts(state = {}) {
  const counts = state.counts || {};
  const active = counts.running || 0;
  const pending = counts.pending || 0;
  const failed = counts.failed || 0;
  const done = counts.done || 0;
  return {
    active,
    all: active + pending + failed + done,
    done,
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
  el.counts.done.textContent = `${counts.done || 0} готово`;
  Object.entries(filterCounts).forEach(([key, value]) => {
    if (el.filterCounts[key]) el.filterCounts[key].textContent = String(value);
  });
  el.pause.innerHTML = state.queuePaused ? ICONS.play : ICONS.pause;
  el.pause.classList.toggle("is-active", state.queuePaused === true);
  el.jobSummaryTitle.textContent =
    counts.running > 0
      ? "Идёт загрузка"
      : counts.pending > 0
        ? "Есть задачи в очереди"
        : "Очередь синхронизирована";
  el.jobSummaryMeta.textContent = `Активные: ${counts.running || 0}, ожидают: ${
    counts.pending || 0
  }, ошибки: ${counts.failed || 0}`;
}

function renderEmptyQueue(filtered = false) {
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
}

function renderQueueActions(job = {}, id = "") {
  const isRunning = job.status === "running";
  const isFailed = job.status === "failed";
  const isDone = job.status === "done";
  const actions = [
    isRunning
      ? `<button data-action="downloader:cancel" data-id="${id}" title="Отмена">${ICONS.x}<span>Отмена</span></button>`
      : "",
    isFailed
      ? `<button data-action="downloader:retry" data-id="${id}" title="Повтор">${ICONS.refresh}<span>Повтор</span></button>`
      : "",
    isDone
      ? `<button data-action="downloader:open" data-id="${id}" title="Открыть">${ICONS.external}<span>Открыть</span></button>`
      : "",
    isDone
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

  el.queue.innerHTML = visibleJobs
    .map((job, index) => {
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
      return `<article class="queue-item ${getStatusClass(job)}" role="listitem">
        <span class="queue-progress-line" style="width:${progress}%"></span>
        <div class="queue-item-index-wrap">
          <span class="queue-item-index">${index + 1}</span>
        </div>
        <div class="queue-item-main">
          <div class="queue-item-title">${title}</div>
          <div class="queue-item-subtitle">${url}</div>
        </div>
        <div class="queue-item-right">
          <span class="queue-status-chip">${status}</span>
          <span class="queue-quality-chip">${quality}</span>
          <span class="queue-stage-chip">${progress}%</span>
        </div>
        <div class="queue-item-actions">${renderQueueActions(job, id)}</div>
      </article>`;
    })
    .join("");
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

const settingsController = createSettingsController({
  fields: el.settings,
  saveButton: document.getElementById("save-settings"),
  status: el.settingsSaveStatus,
  request,
});

const router = createRouterController({
  modal: el.settingsModal,
  hasUnsavedChanges: settingsController.isDirty,
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

document.querySelectorAll("[data-clear]").forEach((button) => {
  button.addEventListener("click", () => {
    void sendAction("downloader:clear", { target: button.dataset.clear });
  });
});

el.queue.addEventListener("click", (event) => {
  const button = event.target.closest("[data-action]");
  if (!button) return;
  void sendAction(button.dataset.action, { jobId: button.dataset.id });
});

document
  .getElementById("save-settings")
  .addEventListener("click", () => void settingsController.save());

document.addEventListener("keydown", (event) => {
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

Promise.all([refreshState(), settingsController.refreshRemote()]).catch(
  (error) => {
    el.jobSummaryTitle.textContent = "Веб-интерфейс недоступен";
    el.jobSummaryMeta.textContent = String(error?.message || "Ошибка соединения");
  },
);
