import { JOB_STATUS } from "./model.js";

function createQueueWebControlController({
  controller,
  extractUrls,
  validateUrl,
  normalizeQuality,
  getDownloadedMap,
  getSnapshot,
  startDownload,
  cancelActive,
  retryHistoryRecovery,
  openRecovery,
  isHistoryRecovery,
  undoDurationMs = 8000,
} = {}) {
  let clearUndo = null;

  const snapshot = () =>
    getSnapshot({
      undoClearAvailable: Boolean(
        clearUndo && clearUndo.expiresAt > Date.now(),
      ),
    });

  const findJob = (payload = {}) => {
    const id = String(payload.jobId || payload.id || "").trim();
    return (
      controller
        .getSnapshot()
        .jobs.find(
          (job) =>
            job.jobId === id || job.id === id || job.signature === id,
        ) || null
    );
  };

  async function add(payload = {}) {
    const rawUrls = Array.isArray(payload.urls)
      ? payload.urls
      : extractUrls(payload.url || payload.text || "");
    const urls = rawUrls.filter(validateUrl);
    if (!urls.length) {
      return { ...snapshot(), added: 0, invalid: rawUrls.length || 1 };
    }
    const quality = normalizeQuality(payload.quality);
    if (payload.start === true && urls.length === 1) {
      startDownload(urls[0], quality, { fromQueue: false });
    } else {
      controller.enqueueMany(urls, quality, {
        downloadedMap: await getDownloadedMap(),
      });
    }
    controller.pump(payload.start === true ? "manual" : "auto");
    return { ...snapshot(), added: urls.length };
  }

  async function cancel(payload) {
    const job = findJob(payload);
    if (!job) return snapshot();
    if (job.status === JOB_STATUS.running && job.jobId) {
      await cancelActive(job.jobId);
    } else {
      controller.remove(job.jobId || job.id || job.signature);
    }
    return snapshot();
  }

  async function retry(payload) {
    const selected = findJob(payload);
    const tasks =
      selected?.status === JOB_STATUS.failed
        ? [selected]
        : controller
            .getSnapshot()
            .jobs.filter(
              (job) =>
                job.status === JOB_STATUS.failed && job.retryable !== false,
            );
    if (tasks.length === 1 && isHistoryRecovery(tasks[0])) {
      await retryHistoryRecovery(tasks[0]);
      return snapshot();
    }
    tasks.forEach((job) =>
      controller.retry(job.jobId || job.id || job.signature),
    );
    controller.pump("manual");
    return snapshot();
  }

  function clear(payload = {}) {
    const target = String(payload.target || "all").trim().toLowerCase();
    const pausedBeforeRemoval = controller.getSnapshot().paused;
    const removed = controller.clear(target);
    const restorePauseState = target === "all" || target === "pending";
    if (restorePauseState) controller.setPaused(false);
    clearUndo = removed.length
      ? {
          jobs: removed,
          pausedBeforeRemoval,
          restorePauseState,
          expiresAt: Date.now() + undoDurationMs,
        }
      : null;
    return snapshot();
  }

  function undoClear() {
    if (!clearUndo || clearUndo.expiresAt <= Date.now()) {
      clearUndo = null;
      return snapshot();
    }
    controller.restore(clearUndo.jobs, {
      paused: clearUndo.restorePauseState
        ? clearUndo.pausedBeforeRemoval
        : undefined,
    });
    clearUndo = null;
    return snapshot();
  }

  async function handle(action, payload = {}) {
    switch (action) {
      case "downloader:add":
        return add({ ...payload, start: false });
      case "downloader:start":
        return add({ ...payload, start: true });
      case "downloader:start-pending":
        controller.setPaused(false);
        controller.pump("manual");
        return snapshot();
      case "downloader:start-one":
        controller.setPaused(true);
        controller.startOne(String(payload.jobId || payload.id || ""));
        return snapshot();
      case "downloader:pause":
        controller.setPaused(true);
        return snapshot();
      case "downloader:resume":
        controller.setPaused(false);
        return snapshot();
      case "downloader:cancel":
        return cancel(payload);
      case "downloader:retry":
        return retry(payload);
      case "downloader:remove": {
        const job = findJob(payload);
        if (job) controller.remove(job.jobId || job.id || job.signature);
        return snapshot();
      }
      case "downloader:clear":
        return clear(payload);
      case "downloader:undo-clear":
        return undoClear();
      case "downloader:open":
        await openRecovery(findJob(payload), false);
        return snapshot();
      case "downloader:reveal":
        await openRecovery(findJob(payload), true);
        return snapshot();
      default:
        throw new Error(`Unknown downloader action: ${action}`);
    }
  }

  return { handle };
}

export { createQueueWebControlController };
