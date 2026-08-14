import { JOB_STATUS, normalizeDownloadJob } from "./model.js";
import { toPersistedQueueJob } from "./persistence.js";

const STORAGE_KEYS = Object.freeze({
  pending: "downloadQueue",
  failed: "downloadFailedQueue",
  completed: "downloadCompletedQueue",
  paused: "downloadQueuePaused",
  collapsed: "downloadQueueCollapsed",
});

const COMPLETED_RETENTION_LIMIT = 30;
const COMPLETED_TIMESTAMP_FIELDS = new Set([
  "createdAt",
  "updatedAt",
  "startedAt",
  "completedAt",
  "failedAt",
]);
const COMPLETED_FIELDS = [
  "id",
  "jobId",
  "signature",
  "status",
  "url",
  "title",
  "quality",
  "type",
  "filePath",
  "createdAt",
  "updatedAt",
  "startedAt",
  "completedAt",
  "failedAt",
];

function readJsonArray(storage, key) {
  try {
    const value = JSON.parse(storage.getItem(key) || "[]");
    return Array.isArray(value) ? value : [];
  } catch {
    return [];
  }
}

function writeJobs(storage, key, jobs) {
  try {
    if (!jobs.length) {
      storage.removeItem(key);
      return;
    }
    storage.setItem(key, JSON.stringify(jobs.map(toPersistedQueueJob)));
  } catch {}
}

function normalizeCompletedJob(job) {
  if (!job || typeof job !== "object" || Array.isArray(job)) return null;
  const normalized = {};
  COMPLETED_FIELDS.forEach((key) => {
    const value = job[key];
    if (value === undefined) return;
    normalized[key] = COMPLETED_TIMESTAMP_FIELDS.has(key)
      ? Number.isFinite(Number(value))
        ? Number(value)
        : 0
      : typeof value === "string"
        ? value.trim()
        : value;
  });
  if (normalized.status !== JOB_STATUS.done || !normalized.url || !normalized.filePath) {
    return null;
  }
  return normalized;
}

function normalizeCompletedJobs(jobs) {
  const sorted = (Array.isArray(jobs) ? jobs : [])
    .map(normalizeCompletedJob)
    .filter(Boolean)
    .sort(
      (left, right) =>
        Number(right.updatedAt || right.createdAt) -
        Number(left.updatedAt || left.createdAt),
    );
  const seen = new Set();
  return sorted.filter((job) => {
    const identities = [
      job.signature ? `signature:${job.signature}` : "",
      job.jobId || job.id ? `job:${job.jobId || job.id}` : "",
    ].filter(Boolean);
    if (identities.some((identity) => seen.has(identity))) return false;
    identities.forEach((identity) => seen.add(identity));
    return true;
  }).slice(0, COMPLETED_RETENTION_LIMIT);
}

function loadCompletedJobs(storage = window.localStorage) {
  return normalizeCompletedJobs(readJsonArray(storage, STORAGE_KEYS.completed));
}

function persistCompletedJobs(jobs, storage = window.localStorage) {
  const completed = normalizeCompletedJobs(jobs);
  try {
    if (!completed.length) storage.removeItem(STORAGE_KEYS.completed);
    else storage.setItem(STORAGE_KEYS.completed, JSON.stringify(completed));
  } catch {
    return [];
  }
  return completed;
}

function createQueueRepository({
  storage = window.localStorage,
  maxJobs = 200,
  validateJob = () => true,
  getSignature = (job) => job.signature,
} = {}) {
  const normalizeCollection = (items, status, limit = maxJobs) => {
    const seen = new Set();
    const normalized = [];
    for (const source of items) {
      const job = normalizeDownloadJob({ ...source, status });
      const signature = getSignature(job);
      if (!validateJob(job) || !signature || seen.has(signature)) continue;
      seen.add(signature);
      normalized.push(job);
      if (normalized.length >= limit) break;
    }
    return normalized;
  };

  function hydrate() {
    const paused = storage.getItem(STORAGE_KEYS.paused) === "1";
    return {
      jobs: [
        ...normalizeCollection(
          readJsonArray(storage, STORAGE_KEYS.pending),
          paused ? JOB_STATUS.paused : JOB_STATUS.pending,
        ),
        ...normalizeCollection(
          readJsonArray(storage, STORAGE_KEYS.failed),
          JOB_STATUS.failed,
        ),
      ],
      paused,
      collapsed: storage.getItem(STORAGE_KEYS.collapsed) === "1",
      completed: loadCompletedJobs(storage),
    };
  }

  function persist(snapshot) {
    const jobs = Array.isArray(snapshot?.jobs) ? snapshot.jobs : [];
    writeJobs(
      storage,
      STORAGE_KEYS.pending,
      jobs.filter((job) =>
        [JOB_STATUS.pending, JOB_STATUS.paused].includes(job.status),
      ),
    );
    writeJobs(
      storage,
      STORAGE_KEYS.failed,
      jobs.filter((job) => job.status === JOB_STATUS.failed),
    );
    try {
      if (snapshot?.paused) storage.setItem(STORAGE_KEYS.paused, "1");
      else storage.removeItem(STORAGE_KEYS.paused);
      if (snapshot?.collapsed) storage.setItem(STORAGE_KEYS.collapsed, "1");
      else storage.removeItem(STORAGE_KEYS.collapsed);
    } catch {}
  }

  function persistCompleted(jobs) {
    return persistCompletedJobs(jobs, storage);
  }

  return { hydrate, persist, persistCompleted };
}

export {
  createQueueRepository,
  loadCompletedJobs,
  persistCompletedJobs,
  STORAGE_KEYS,
};
