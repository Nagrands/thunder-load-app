const readQueueJobs = (storage, key, normalize) => {
  try {
    const parsed = JSON.parse(storage.getItem(key) || "[]");
    return Array.isArray(parsed) ? parsed.map(normalize).filter(Boolean) : [];
  } catch {
    return [];
  }
};

const toPersistedQueueJob = (job = {}) => {
  const {
    downloadedBytes: _downloadedBytes,
    totalBytes: _totalBytes,
    totalBytesApproximate: _totalBytesApproximate,
    speedBytesPerSec: _speedBytesPerSec,
    etaSeconds: _etaSeconds,
    ...durable
  } = job;
  return durable;
};

const writeQueueJobs = (storage, key, jobs) => {
  try {
    if (!jobs.length) {
      storage.removeItem(key);
      return 0;
    }
    storage.setItem(key, JSON.stringify(jobs.map(toPersistedQueueJob)));
    return jobs.length;
  } catch {
    return 0;
  }
};

export { readQueueJobs, toPersistedQueueJob, writeQueueJobs };
