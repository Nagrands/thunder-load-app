import {
  getDownloadJobIdentity,
  hasSameDownloadPayload,
  JOB_STATUS,
  normalizeDownloadJob,
} from "./model.js";

const normalizeJobs = (jobs = []) => jobs.map(normalizeDownloadJob);

function ensureDownloadJobsState(state) {
  if (!Array.isArray(state.downloadJobs)) state.downloadJobs = [];
  return state.downloadJobs;
}

function findDownloadJob(state, matcher) {
  const jobs = ensureDownloadJobsState(state);
  if (typeof matcher === "function") return jobs.find(matcher) || null;
  const key = String(matcher || "");
  return (
    jobs.find(
      (job) => job.jobId === key || job.id === key || job.signature === key,
    ) || null
  );
}

function getDownloadJobsByStatus(state, statuses) {
  const list = Array.isArray(statuses) ? statuses : [statuses];
  return ensureDownloadJobsState(state).filter((job) =>
    list.includes(job.status),
  );
}

const getActiveDownloadJobs = (state) =>
  getDownloadJobsByStatus(state, JOB_STATUS.running);
const getPendingDownloadJobs = (state) =>
  getDownloadJobsByStatus(state, [JOB_STATUS.pending, JOB_STATUS.paused]);
const getFailedDownloadJobs = (state) =>
  getDownloadJobsByStatus(state, JOB_STATUS.failed);
const getCompletedDownloadJobs = (state) =>
  getDownloadJobsByStatus(state, JOB_STATUS.done);

function setDownloadJobs(state, jobs) {
  state.downloadJobs = normalizeJobs(jobs);
  return state.downloadJobs;
}

function clearDownloadJobsByStatus(state, statuses) {
  const list = Array.isArray(statuses) ? statuses : [statuses];
  return setDownloadJobs(
    state,
    ensureDownloadJobsState(state).filter((job) => !list.includes(job.status)),
  );
}

function replaceDownloadJobsByStatus(state, statuses, nextJobs) {
  const list = Array.isArray(statuses) ? statuses : [statuses];
  const preserved = ensureDownloadJobsState(state).filter(
    (job) => !list.includes(job.status),
  );
  return setDownloadJobs(state, [...preserved, ...normalizeJobs(nextJobs)]);
}

function upsertDownloadJob(state, job) {
  const jobs = ensureDownloadJobsState(state);
  const normalized = normalizeDownloadJob(job);
  const identity = getDownloadJobIdentity(normalized);
  const index = jobs.findIndex(
    (entry) =>
      (normalized.jobId && entry.jobId === normalized.jobId) ||
      (normalized.signature && entry.signature === normalized.signature) ||
      hasSameDownloadPayload(entry, normalized) ||
      (identity && getDownloadJobIdentity(entry) === identity),
  );
  if (index >= 0) {
    jobs[index] = normalizeDownloadJob({
      ...jobs[index],
      ...normalized,
      createdAt: jobs[index].createdAt,
      updatedAt: Date.now(),
    });
  } else {
    jobs.push(normalizeDownloadJob({ ...normalized, updatedAt: Date.now() }));
  }
  return findDownloadJob(state, identity);
}

function patchDownloadJob(state, matcher, patch) {
  const existing = findDownloadJob(state, matcher);
  return existing ? upsertDownloadJob(state, { ...existing, ...patch }) : null;
}

function removeDownloadJob(state, matcher) {
  const key = typeof matcher === "function" ? null : String(matcher || "");
  state.downloadJobs = ensureDownloadJobsState(state).filter((job) =>
    typeof matcher === "function"
      ? !matcher(job)
      : job.jobId !== key && job.id !== key && job.signature !== key,
  );
}

export {
  clearDownloadJobsByStatus,
  ensureDownloadJobsState,
  findDownloadJob,
  getActiveDownloadJobs,
  getCompletedDownloadJobs,
  getDownloadJobsByStatus,
  getFailedDownloadJobs,
  getPendingDownloadJobs,
  patchDownloadJob,
  removeDownloadJob,
  replaceDownloadJobsByStatus,
  setDownloadJobs,
  upsertDownloadJob,
};
