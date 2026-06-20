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
let lastQueueCounts = {};
let hasQueueCounts = false;

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
  if (Object.keys(counts).length > 0) {
    lastQueueCounts = counts;
    hasQueueCounts = true;
  }

  const resolvedCounts = lastQueueCounts;
  const totalCount = resolvedCounts.total || 0;
  const totalCounter = document.getElementById("queue-total-count");
  if (totalCounter) {
    totalCounter.textContent = `(${totalCount})`;
  }

  if (
    hasQueueCounts &&
    currentQueueFilter !== "all" &&
    (resolvedCounts[currentQueueFilter] || 0) <= 0
  ) {
    currentQueueFilter = "all";
    persistQueueFilter();
  }

  document.querySelectorAll("[data-queue-filter]").forEach((button) => {
    const filter = button.dataset.queueFilter;
    const countValue = resolvedCounts[filter] || 0;
    const isActive = filter === currentQueueFilter;
    const isHidden =
      Boolean(options.hidden) ||
      (hasQueueCounts && filter !== "all" && countValue <= 0);

    button.classList.toggle("hidden", isHidden);
    button.classList.toggle("is-active", isActive);
    button.setAttribute("aria-pressed", String(isActive));
    button.disabled = Boolean(options.hidden) || (hasQueueCounts && countValue <= 0);

    const count = button.querySelector("[data-queue-filter-count]");
    if (count) {
      count.textContent = String(countValue);
    }
  });
}

function initDownloadQueueFilter(onChange) {
  const controls = Array.from(document.querySelectorAll("[data-queue-filter]"));
  if (!controls.length) return;

  controls.forEach((button) => {
    if (button.dataset.bound === "true") return;

    button.dataset.bound = "true";
    button.addEventListener("click", () => {
      const filter = button.dataset.queueFilter;
      if (!isQueueFilter(filter) || filter === currentQueueFilter) return;

      currentQueueFilter = filter;
      persistQueueFilter();
      syncQueueFilterControls();
      onChange?.(filter);
    });
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
