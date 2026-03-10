// src/js/modules/downloadJobs.js

const JOB_STATUS = {
  pending: "pending",
  running: "running",
  paused: "paused",
  failed: "failed",
  done: "done",
  cancelled: "cancelled",
};

const LEGACY_STATUS_BY_JOB_STATUS = {
  [JOB_STATUS.pending]: "pending",
  [JOB_STATUS.running]: "downloading",
  [JOB_STATUS.paused]: "paused",
  [JOB_STATUS.failed]: "error",
  [JOB_STATUS.done]: "done",
};

const normalizeJobStage = (stage = "", status = JOB_STATUS.pending) => {
  const normalized = String(stage || "")
    .trim()
    .toLowerCase();
  if (normalized === "prepare" || normalized === "download") return normalized;
  if (normalized === "finalize" || normalized === "merge") return "finalize";
  if (status === JOB_STATUS.running) return "prepare";
  return "";
};

const getJobIdentity = (job = {}) =>
  job.jobId ||
  job.id ||
  job.signature ||
  `${job.url || ""}::${job.status || ""}`;

const samePayload = (a = {}, b = {}) =>
  String(a.url || "").trim() === String(b.url || "").trim() &&
  JSON.stringify(a.quality ?? null) === JSON.stringify(b.quality ?? null);

const getDerivedSignature = (job = {}) =>
  `${String(job.url || "").trim()}::${JSON.stringify(job.quality ?? null)}`;

const normalizeDownloadJob = (job = {}) => {
  const status = Object.values(JOB_STATUS).includes(job.status)
    ? job.status
    : JOB_STATUS.pending;
  const now = Date.now();
  return {
    id: job.id || job.jobId || "",
    jobId: job.jobId || job.id || "",
    url: String(job.url || "").trim(),
    title: String(job.title || ""),
    quality: job.quality,
    type: job.type || "",
    status,
    stage: normalizeJobStage(job.stage, status),
    progress: Number(job.progress) || 0,
    size: job.size ? String(job.size) : "",
    signature: job.signature || getDerivedSignature(job),
    reason: job.reason ? String(job.reason) : "",
    errorCode: job.errorCode ? String(job.errorCode) : "",
    retryable:
      typeof job.retryable === "boolean"
        ? job.retryable
        : status === JOB_STATUS.failed,
    failedAt: Number(job.failedAt) || 0,
    createdAt: Number(job.createdAt) || now,
    updatedAt: Number(job.updatedAt) || now,
  };
};

const toLegacyQueueItem = (job) => ({
  id: job.id,
  jobId: job.jobId,
  url: job.url,
  title: job.title,
  quality: job.quality,
  type: job.type,
  progress: job.progress,
  size: job.size,
  signature: job.signature,
  reason: job.reason,
  errorCode: job.errorCode,
  retryable: job.retryable,
  failedAt: job.failedAt,
  stage: job.stage,
  status: LEGACY_STATUS_BY_JOB_STATUS[job.status] || "pending",
});

const sortJobs = (jobs = []) => [...jobs];

const normalizeJobsList = (jobs = []) =>
  jobs.map((job) => normalizeDownloadJob(job));

function syncLegacyDownloadCollections(state) {
  const jobs = Array.isArray(state.downloadJobs)
    ? sortJobs(state.downloadJobs)
    : [];
  state.activeDownloads = jobs
    .filter((job) => job.status === JOB_STATUS.running)
    .map(toLegacyQueueItem);
  state.downloadQueue = jobs
    .filter(
      (job) =>
        job.status === JOB_STATUS.pending || job.status === JOB_STATUS.paused,
    )
    .map(toLegacyQueueItem);
  state.failedDownloads = jobs
    .filter((job) => job.status === JOB_STATUS.failed)
    .map(toLegacyQueueItem);
  state.completedDownloads = jobs
    .filter((job) => job.status === JOB_STATUS.done)
    .map(toLegacyQueueItem)
    .reverse();
}

function hydrateDownloadJobsFromLegacyState(state) {
  const merged = [];
  const seen = new Set();
  const append = (items = [], status) => {
    for (const item of items || []) {
      const normalized = normalizeDownloadJob({
        ...item,
        status,
      });
      const identity = getJobIdentity(normalized);
      if (!identity || seen.has(identity)) continue;
      seen.add(identity);
      merged.push(normalized);
    }
  };
  append(state.activeDownloads, JOB_STATUS.running);
  append(
    state.downloadQueue,
    state.queuePaused ? JOB_STATUS.paused : JOB_STATUS.pending,
  );
  append(state.failedDownloads, JOB_STATUS.failed);
  append(state.completedDownloads, JOB_STATUS.done);
  state.downloadJobs = sortJobs(merged);
  syncLegacyDownloadCollections(state);
  return state.downloadJobs;
}

function ensureDownloadJobsState(state) {
  if (!Array.isArray(state.downloadJobs)) {
    state.downloadJobs = [];
  }
  if (
    state.downloadJobs.length === 0 &&
    ((state.activeDownloads && state.activeDownloads.length) ||
      (state.downloadQueue && state.downloadQueue.length) ||
      (state.failedDownloads && state.failedDownloads.length) ||
      (state.completedDownloads && state.completedDownloads.length))
  ) {
    hydrateDownloadJobsFromLegacyState(state);
  }
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
  const jobs = ensureDownloadJobsState(state);
  const list = Array.isArray(statuses) ? statuses : [statuses];
  return jobs.filter((job) => list.includes(job.status));
}

function getActiveDownloadJobs(state) {
  return getDownloadJobsByStatus(state, JOB_STATUS.running);
}

function getPendingDownloadJobs(state) {
  return getDownloadJobsByStatus(state, [
    JOB_STATUS.pending,
    JOB_STATUS.paused,
  ]);
}

function getFailedDownloadJobs(state) {
  return getDownloadJobsByStatus(state, JOB_STATUS.failed);
}

function getCompletedDownloadJobs(state) {
  return getDownloadJobsByStatus(state, JOB_STATUS.done);
}

function setDownloadJobs(state, jobs) {
  state.downloadJobs = sortJobs(normalizeJobsList(jobs));
  syncLegacyDownloadCollections(state);
  return state.downloadJobs;
}

function clearDownloadJobsByStatus(state, statuses) {
  const jobs = ensureDownloadJobsState(state);
  const list = Array.isArray(statuses) ? statuses : [statuses];
  return setDownloadJobs(
    state,
    jobs.filter((job) => !list.includes(job.status)),
  );
}

function replaceDownloadJobsByStatus(state, statuses, nextJobs) {
  const jobs = ensureDownloadJobsState(state);
  const list = Array.isArray(statuses) ? statuses : [statuses];
  const preserved = jobs.filter((job) => !list.includes(job.status));
  return setDownloadJobs(state, [...preserved, ...normalizeJobsList(nextJobs)]);
}

function upsertDownloadJob(state, job) {
  const jobs = ensureDownloadJobsState(state);
  const normalized = normalizeDownloadJob(job);
  const identity = getJobIdentity(normalized);
  const index = jobs.findIndex(
    (entry) =>
      (normalized.jobId && entry.jobId === normalized.jobId) ||
      (normalized.signature &&
        entry.signature === normalized.signature &&
        normalized.signature !== "") ||
      samePayload(entry, normalized) ||
      (getJobIdentity(entry) === identity && identity !== ""),
  );
  if (index >= 0) {
    jobs[index] = normalizeDownloadJob({
      ...jobs[index],
      ...normalized,
      createdAt: jobs[index].createdAt,
      updatedAt: Date.now(),
    });
  } else {
    jobs.push(
      normalizeDownloadJob({
        ...normalized,
        createdAt: normalized.createdAt || Date.now(),
        updatedAt: Date.now(),
      }),
    );
  }
  state.downloadJobs = sortJobs(jobs);
  syncLegacyDownloadCollections(state);
  return findDownloadJob(state, identity);
}

function patchDownloadJob(state, matcher, patch) {
  const existing = findDownloadJob(state, matcher);
  if (!existing) return null;
  return upsertDownloadJob(state, { ...existing, ...patch });
}

function removeDownloadJob(state, matcher) {
  const jobs = ensureDownloadJobsState(state);
  const key = typeof matcher === "function" ? null : String(matcher || "");
  state.downloadJobs = jobs.filter((job) =>
    typeof matcher === "function"
      ? !matcher(job)
      : job.jobId !== key && job.id !== key && job.signature !== key,
  );
  syncLegacyDownloadCollections(state);
}

export {
  clearDownloadJobsByStatus,
  JOB_STATUS,
  ensureDownloadJobsState,
  findDownloadJob,
  getActiveDownloadJobs,
  getCompletedDownloadJobs,
  getDownloadJobsByStatus,
  getFailedDownloadJobs,
  getPendingDownloadJobs,
  hydrateDownloadJobsFromLegacyState,
  patchDownloadJob,
  removeDownloadJob,
  replaceDownloadJobsByStatus,
  setDownloadJobs,
  syncLegacyDownloadCollections,
  upsertDownloadJob,
};
