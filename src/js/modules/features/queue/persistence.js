const readQueueJobs = (storage, key, normalize) => {
  try {
    const parsed = JSON.parse(storage.getItem(key) || "[]");
    return Array.isArray(parsed) ? parsed.map(normalize).filter(Boolean) : [];
  } catch {
    return [];
  }
};

const writeQueueJobs = (storage, key, jobs) => {
  try {
    if (!jobs.length) {
      storage.removeItem(key);
      return 0;
    }
    storage.setItem(key, JSON.stringify(jobs));
    return jobs.length;
  } catch {
    return 0;
  }
};

export { readQueueJobs, writeQueueJobs };
