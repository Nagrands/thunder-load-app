import {
  getActiveDownloadJobs,
  getFailedDownloadJobs,
  getPendingDownloadJobs,
} from "./store.js";

const normalizeWebControlQuality = (value, normalizeStructuredQuality) => {
  if (value && typeof value === "object") {
    return normalizeStructuredQuality(value);
  }
  const normalized = String(value || "")
    .trim()
    .toLowerCase();
  return normalized === "audio" || normalized === "audio-only"
    ? "Audio Only"
    : "Source";
};

const createWebControlQueueSnapshot = (state, options = {}) => ({
  jobs: state.downloadJobs.map((job) => ({ ...job })),
  queuePaused: Boolean(state.suppressAutoPump || state.queuePaused),
  maxParallelDownloads: Number(state.maxParallelDownloads) || 1,
  undoClearAvailable: Boolean(options.undoClearAvailable),
  counts: {
    pending: getPendingDownloadJobs(state).length,
    running: getActiveDownloadJobs(state).length,
    failed: getFailedDownloadJobs(state).length,
  },
});

export { createWebControlQueueSnapshot, normalizeWebControlQuality };
