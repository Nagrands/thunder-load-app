const params = new URLSearchParams(window.location.search);
const token = params.get("token") || "";

const el = {
  status: document.getElementById("connection-status"),
  urlInput: document.getElementById("url-input"),
  quality: document.getElementById("quality-select"),
  queue: document.getElementById("queue-list"),
  pause: document.getElementById("pause-queue"),
  counts: {
    pending: document.getElementById("count-pending"),
    running: document.getElementById("count-running"),
    failed: document.getElementById("count-failed"),
    done: document.getElementById("count-done"),
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

function apiUrl(path) {
  const url = new URL(path, window.location.origin);
  url.searchParams.set("token", token);
  return url.toString();
}

async function request(path, options = {}) {
  const response = await fetch(apiUrl(path), {
    ...options,
    headers: {
      "Content-Type": "application/json",
      "X-Thunder-Web-Token": token,
      ...(options.headers || {}),
    },
  });
  const data = await response.json();
  if (!response.ok || data.success === false) {
    throw new Error(data.error || "Request failed");
  }
  return data;
}

function setStatus(text, ok = true) {
  el.status.textContent = text;
  el.status.style.borderColor = ok ? "rgba(121, 199, 255, 0.4)" : "#ff7070";
}

function escapeHtml(value) {
  return String(value || "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;");
}

function renderState(state = {}) {
  const counts = state.counts || {};
  el.counts.pending.textContent = counts.pending || 0;
  el.counts.running.textContent = counts.running || 0;
  el.counts.failed.textContent = counts.failed || 0;
  el.counts.done.textContent = counts.done || 0;
  el.pause.textContent = state.queuePaused ? "Продолжить" : "Пауза";

  const jobs = Array.isArray(state.jobs) ? state.jobs : [];
  if (!jobs.length) {
    el.queue.innerHTML = `<li class="queue-item"><div><div class="queue-title">Очередь пуста</div><div class="queue-meta">Добавьте ссылку для загрузки</div></div></li>`;
    return;
  }

  el.queue.innerHTML = jobs
    .map((job) => {
      const id = escapeHtml(job.jobId || job.id || job.signature);
      const title = escapeHtml(job.title || job.url || "Без названия");
      const url = escapeHtml(job.url || "");
      const status = escapeHtml(job.status || "pending");
      const progress = Math.round(Number(job.progress) || 0);
      const isRunning = job.status === "running";
      const isFailed = job.status === "failed";
      const isDone = job.status === "done";
      const actions = [
        isRunning
          ? `<button class="secondary" data-action="downloader:cancel" data-id="${id}">Отмена</button>`
          : "",
        isFailed
          ? `<button class="secondary" data-action="downloader:retry" data-id="${id}">Повтор</button>`
          : "",
        isDone
          ? `<button class="secondary" data-action="downloader:open" data-id="${id}">Открыть</button><button class="secondary" data-action="downloader:reveal" data-id="${id}">Папка</button>`
          : "",
        !isRunning
          ? `<button class="secondary" data-action="downloader:remove" data-id="${id}">Убрать</button>`
          : "",
      ].join("");
      return `<li class="queue-item">
        <div>
          <div class="queue-title">${title}</div>
          <div class="queue-meta">${status} · ${progress}% · ${url}</div>
        </div>
        <div class="queue-actions">${actions}</div>
      </li>`;
    })
    .join("");
}

function renderSettings(settings = {}) {
  for (const [key, node] of Object.entries(el.settings)) {
    if (!node || typeof settings[key] === "undefined") continue;
    if (node.type === "checkbox") {
      node.checked = Boolean(settings[key]);
    } else {
      node.value = String(settings[key] ?? "");
    }
  }
}

async function refresh() {
  const [{ state }, { settings }] = await Promise.all([
    request("/api/state"),
    request("/api/settings"),
  ]);
  renderState(state);
  renderSettings(settings);
  setStatus("Подключено", true);
}

async function sendAction(action, payload = {}) {
  const { result } = await request("/api/action", {
    method: "POST",
    body: JSON.stringify({ action, payload }),
  });
  renderState(result);
}

document.getElementById("download-now").addEventListener("click", () => {
  sendAction("downloader:start", {
    url: el.urlInput.value,
    quality: el.quality.value,
  }).then(() => {
    el.urlInput.value = "";
  });
});

document.getElementById("add-queue").addEventListener("click", () => {
  sendAction("downloader:add", {
    url: el.urlInput.value,
    quality: el.quality.value,
  }).then(() => {
    el.urlInput.value = "";
  });
});

document.getElementById("start-queue").addEventListener("click", () => {
  sendAction("downloader:start-pending");
});

el.pause.addEventListener("click", () => {
  const action = el.pause.textContent.includes("Продолжить")
    ? "downloader:resume"
    : "downloader:pause";
  sendAction(action);
});

document.querySelectorAll("[data-clear]").forEach((button) => {
  button.addEventListener("click", () => {
    sendAction("downloader:clear", { target: button.dataset.clear });
  });
});

el.queue.addEventListener("click", (event) => {
  const button = event.target.closest("[data-action]");
  if (!button) return;
  sendAction(button.dataset.action, { jobId: button.dataset.id });
});

document.getElementById("save-settings").addEventListener("click", async () => {
  const payload = {};
  for (const [key, node] of Object.entries(el.settings)) {
    payload[key] = node.type === "checkbox" ? node.checked : node.value;
  }
  const { result } = await request("/api/settings", {
    method: "POST",
    body: JSON.stringify(payload),
  });
  renderSettings(result);
  await refresh();
});

try {
  const events = new EventSource(apiUrl("/events"));
  events.addEventListener("ready", () => setStatus("Подключено", true));
  events.addEventListener("state", () => refresh().catch(() => {}));
  events.addEventListener("settings", () => refresh().catch(() => {}));
  events.onerror = () => setStatus("Нет соединения", false);
} catch {
  setStatus("SSE недоступен", false);
}

refresh().catch((error) => {
  console.error(error);
  setStatus("Ошибка подключения", false);
});
