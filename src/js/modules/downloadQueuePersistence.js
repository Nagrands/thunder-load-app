const STORAGE_KEY = "downloadCompletedQueue";
const RETENTION_LIMIT = 30;
const TIMESTAMP_FIELDS = new Set([
  "createdAt",
  "updatedAt",
  "startedAt",
  "completedAt",
  "failedAt",
]);
const PERSISTED_FIELDS = [
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

const isRecord = (value) =>
  value !== null && typeof value === "object" && !Array.isArray(value);

const normalizeJob = (job) => {
  if (!isRecord(job)) return null;

  const normalized = {};
  for (const key of PERSISTED_FIELDS) {
    const value = job[key];
    if (value === undefined) continue;
    if (TIMESTAMP_FIELDS.has(key)) {
      const timestamp = Number(value);
      normalized[key] = Number.isFinite(timestamp) ? timestamp : 0;
    } else {
      normalized[key] = typeof value === "string" ? value.trim() : value;
    }
  }

  if (normalized.status !== "done" || !normalized.url || !normalized.filePath) {
    return null;
  }

  return normalized;
};

const getSortTimestamp = (job) =>
  Number(job.updatedAt) || Number(job.createdAt) || 0;

const getIdentities = (job) => {
  const identities = [];
  if (job.signature) identities.push(`signature:${job.signature}`);

  const jobIdentity = job.jobId || job.id;
  if (jobIdentity) identities.push(`job:${jobIdentity}`);

  return identities;
};

const normalizeCompletedJobs = (jobs) => {
  if (!Array.isArray(jobs)) return [];

  const sorted = jobs
    .map(normalizeJob)
    .filter(Boolean)
    .sort((left, right) => getSortTimestamp(right) - getSortTimestamp(left));
  const seen = new Set();
  const unique = [];

  for (const job of sorted) {
    const identities = getIdentities(job);
    if (identities.some((identity) => seen.has(identity))) continue;

    identities.forEach((identity) => seen.add(identity));
    unique.push(job);
    if (unique.length === RETENTION_LIMIT) break;
  }

  return unique;
};

export function loadCompletedJobs(storage = window.localStorage) {
  try {
    const serialized = storage.getItem(STORAGE_KEY);
    if (!serialized) return [];
    return normalizeCompletedJobs(JSON.parse(serialized));
  } catch {
    return [];
  }
}

export function persistCompletedJobs(jobs, storage = window.localStorage) {
  try {
    const completedJobs = normalizeCompletedJobs(jobs);
    if (completedJobs.length === 0) {
      storage.removeItem(STORAGE_KEY);
      return [];
    }

    storage.setItem(STORAGE_KEY, JSON.stringify(completedJobs));
    return completedJobs;
  } catch {
    return [];
  }
}
