import { JOB_STATUS, normalizeDownloadJob } from "./model.js";

const ALLOWED_TRANSITIONS = Object.freeze({
  [JOB_STATUS.pending]: new Set([JOB_STATUS.running, JOB_STATUS.paused]),
  [JOB_STATUS.paused]: new Set([JOB_STATUS.pending, JOB_STATUS.running]),
  [JOB_STATUS.running]: new Set([
    JOB_STATUS.done,
    JOB_STATUS.failed,
    JOB_STATUS.cancelled,
  ]),
  [JOB_STATUS.failed]: new Set([JOB_STATUS.pending]),
  [JOB_STATUS.done]: new Set(),
  [JOB_STATUS.cancelled]: new Set(),
});

function canTransitionDownloadJob(job, nextStatus) {
  const currentStatus = normalizeDownloadJob(job).status;
  return ALLOWED_TRANSITIONS[currentStatus]?.has(nextStatus) || false;
}

function transitionDownloadJob(job, nextStatus, patch = {}) {
  if (!canTransitionDownloadJob(job, nextStatus)) return null;
  return normalizeDownloadJob({
    ...job,
    ...patch,
    status: nextStatus,
    updatedAt: Date.now(),
  });
}

export {
  ALLOWED_TRANSITIONS,
  canTransitionDownloadJob,
  transitionDownloadJob,
};
