const QUEUE_FILTER_STORAGE_KEY = "downloadQueueFilter";
const QUEUE_FILTERS = Object.freeze([
  "all",
  "active",
  "pending",
  "error",
  "done",
]);

const isQueueFilter = (value) => QUEUE_FILTERS.includes(value);

function readQueueFilter() {
  try {
    const value = window.localStorage.getItem(QUEUE_FILTER_STORAGE_KEY);
    return isQueueFilter(value) ? value : "all";
  } catch {
    return "all";
  }
}

let currentQueueFilter = readQueueFilter();

function persistQueueFilter() {
  try {
    if (currentQueueFilter === "all") {
      window.localStorage.removeItem(QUEUE_FILTER_STORAGE_KEY);
      return;
    }
    window.localStorage.setItem(QUEUE_FILTER_STORAGE_KEY, currentQueueFilter);
  } catch {}
}

function syncQueueFilterControls(counts = {}, options = {}) {
  const container = document.getElementById("queue-filters");
  container?.classList.toggle("hidden", Boolean(options.hidden));

  document.querySelectorAll("[data-queue-filter]").forEach((button) => {
    const filter = button.dataset.queueFilter;
    const isActive = filter === currentQueueFilter;
    button.classList.toggle("is-active", isActive);
    button.setAttribute("aria-pressed", String(isActive));

    const count = button.querySelector("[data-queue-filter-count]");
    if (count) {
      count.textContent = String(
        filter === "all" ? counts.total || 0 : counts[filter] || 0,
      );
    }
  });
}

function initDownloadQueueFilter(onChange) {
  const container = document.getElementById("queue-filters");
  if (!container || container.dataset.bound === "true") return;

  container.dataset.bound = "true";
  container.addEventListener("click", (event) => {
    const button = event.target.closest("[data-queue-filter]");
    if (!button || !container.contains(button)) return;
    const filter = button.dataset.queueFilter;
    if (!isQueueFilter(filter) || filter === currentQueueFilter) return;

    currentQueueFilter = filter;
    persistQueueFilter();
    syncQueueFilterControls();
    onChange?.(filter);
  });
}

function getDownloadQueueFilter() {
  return currentQueueFilter;
}

export {
  QUEUE_FILTERS,
  getDownloadQueueFilter,
  initDownloadQueueFilter,
  syncQueueFilterControls,
};
