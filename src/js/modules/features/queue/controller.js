import { JOB_STATUS, normalizeDownloadJob } from "./model.js";
import { createQueueMetadataEnricher } from "./metadata.js";
import { createQueueScheduler } from "./scheduler.js";
import {
  ensureDownloadJobsState,
  findDownloadJob,
  getActiveDownloadJobs,
  getFailedDownloadJobs,
  getPendingDownloadJobs,
  patchDownloadJob,
  removeDownloadJob,
  replaceDownloadJobsByStatus,
  setDownloadJobs,
  upsertDownloadJob,
} from "./store.js";
import { transitionDownloadJob } from "./transitions.js";

const getQueueCounts = (state) => ({
  active: getActiveDownloadJobs(state).length,
  pending: getPendingDownloadJobs(state).length,
  error: getFailedDownloadJobs(state).length,
});

const getClearableQueueStatuses = (filter) => {
  if (filter === "pending") return [JOB_STATUS.pending, JOB_STATUS.paused];
  if (filter === "error") return [JOB_STATUS.failed];
  if (filter === "active") return [];
  return [JOB_STATUS.pending, JOB_STATUS.paused, JOB_STATUS.failed];
};

function createQueueController({
  state,
  repository,
  maxJobs = 200,
  normalizeItem = normalizeDownloadJob,
  validateUrl = () => true,
  getSignature = (job) => job.signature,
  isAlreadyDownloaded = () => false,
  resolveMetadata,
  startJob = () => {},
  onChange = () => {},
  onStarted = () => {},
} = {}) {
  if (!state || !repository) {
    throw new TypeError("createQueueController requires state and repository");
  }

  const snapshot = () => ({
    jobs: ensureDownloadJobsState(state).map((job) => ({ ...job })),
    paused: Boolean(state.suppressAutoPump || state.queuePaused),
    collapsed: Boolean(state.queueCollapsed),
    maxParallelDownloads: Math.max(
      1,
      Math.min(2, Number(state.maxParallelDownloads) || 1),
    ),
    counts: {
      pending: getPendingDownloadJobs(state).length,
      running: getActiveDownloadJobs(state).length,
      failed: getFailedDownloadJobs(state).length,
    },
  });

  const commit = (reason, { persist = true } = {}) => {
    const next = snapshot();
    if (persist) repository.persist(next);
    onChange(next, reason);
    return next;
  };

  const scheduler = createQueueScheduler({
    getPendingJobs: () => getPendingDownloadJobs(state),
    getActiveCount: () => getActiveDownloadJobs(state).length,
    getActiveSignatures: () => getActiveDownloadJobs(state).map(getSignature),
    getParallelLimit: () => snapshot().maxParallelDownloads,
    isPaused: () => snapshot().paused,
    getSignature,
    startJob,
    onStarted,
  });

  const metadata = createQueueMetadataEnricher({
    resolveMetadata,
    findJob: (identity) => findDownloadJob(state, identity),
    patchJob: (identity, patch) => {
      const result = patchDownloadJob(state, identity, patch);
      if (result) commit("metadata");
      return result;
    },
  });

  function hydrate(options = {}) {
    const restored = repository.hydrate();
    if (!options.preserveJobs) setDownloadJobs(state, restored.jobs);
    state.suppressAutoPump = restored.paused;
    state.queuePaused = restored.paused;
    state.queueCollapsed = restored.collapsed;
    commit("hydrate", { persist: false });
    getPendingDownloadJobs(state).forEach((job) => void metadata.enrich(job));
    return { ...snapshot(), completed: restored.completed };
  }

  function enqueueMany(urls, quality, options = {}) {
    const existing = new Set(ensureDownloadJobsState(state).map(getSignature));
    const result = {
      added: 0,
      duplicates: 0,
      activeDup: 0,
      invalid: 0,
      capped: 0,
      alreadyDownloaded: 0,
    };
    for (const rawUrl of Array.isArray(urls) ? urls : []) {
      const url = String(rawUrl || "").trim();
      if (!validateUrl(url)) {
        result.invalid += 1;
        continue;
      }
      const candidate = normalizeItem({
        url,
        quality,
        status: snapshot().paused ? JOB_STATUS.paused : JOB_STATUS.pending,
      });
      const signature = getSignature(candidate);
      if (isAlreadyDownloaded(url, options.downloadedMap, quality)) {
        result.alreadyDownloaded += 1;
        continue;
      }
      const duplicate = ensureDownloadJobsState(state).find(
        (job) => getSignature(job) === signature,
      );
      if (duplicate) {
        if (duplicate.status === JOB_STATUS.running) result.activeDup += 1;
        else result.duplicates += 1;
        continue;
      }
      if (getPendingDownloadJobs(state).length >= maxJobs) {
        result.capped += 1;
        continue;
      }
      existing.add(signature);
      const added = upsertDownloadJob(state, candidate);
      result.added += 1;
      void metadata.enrich(added);
    }
    commit("enqueue");
    return result;
  }

  function move(jobId, target) {
    const pending = [...getPendingDownloadJobs(state)];
    const index = pending.findIndex(
      (job) => String(job.jobId || job.id || job.signature) === String(jobId),
    );
    if (index < 0 || pending.length < 2) return false;
    const destination =
      target === "top"
        ? 0
        : target === "bottom"
          ? pending.length - 1
          : Math.max(0, Math.min(pending.length - 1, Number(target)));
    if (index === destination) return false;
    const [job] = pending.splice(index, 1);
    pending.splice(destination, 0, job);
    replaceDownloadJobsByStatus(
      state,
      [JOB_STATUS.pending, JOB_STATUS.paused],
      pending,
    );
    commit("move");
    return true;
  }

  function remove(jobId) {
    const job = findDownloadJob(state, jobId);
    if (!job || job.status === JOB_STATUS.running) return null;
    removeDownloadJob(state, jobId);
    commit("remove");
    return { ...job };
  }

  function clear(scope = "all") {
    const statuses =
      scope === "failed" || scope === "error"
        ? [JOB_STATUS.failed]
        : scope === "pending"
          ? [JOB_STATUS.pending, JOB_STATUS.paused]
          : [JOB_STATUS.pending, JOB_STATUS.paused, JOB_STATUS.failed];
    const removed = ensureDownloadJobsState(state)
      .filter((job) => statuses.includes(job.status))
      .map((job) => ({ ...job }));
    setDownloadJobs(
      state,
      ensureDownloadJobsState(state).filter(
        (job) => !statuses.includes(job.status),
      ),
    );
    commit("clear");
    return removed;
  }

  function retry(jobId) {
    const job = findDownloadJob(state, jobId);
    if (!job || job.status !== JOB_STATUS.failed || job.retryable === false) {
      return false;
    }
    const next = transitionDownloadJob(job, JOB_STATUS.pending, {
      stage: "",
      progress: 0,
      reason: "",
      errorMessage: "",
      errorCode: "",
      retryAfterMinutes: 0,
    });
    if (!next) return false;
    upsertDownloadJob(state, next);
    commit("retry");
    return true;
  }

  function retryAll() {
    let retried = 0;
    getFailedDownloadJobs(state).forEach((job) => {
      if (retry(job.jobId || job.id || job.signature)) retried += 1;
    });
    return retried;
  }

  function setPaused(paused) {
    const nextStatus = paused ? JOB_STATUS.paused : JOB_STATUS.pending;
    const sourceStatus = paused ? JOB_STATUS.pending : JOB_STATUS.paused;
    replaceDownloadJobsByStatus(
      state,
      [JOB_STATUS.pending, JOB_STATUS.paused],
      getPendingDownloadJobs(state).map((job) =>
        job.status === sourceStatus ? { ...job, status: nextStatus } : job,
      ),
    );
    state.suppressAutoPump = Boolean(paused);
    state.queuePaused = Boolean(paused);
    commit("pause");
    if (!paused) scheduler.pump("manual");
    return snapshot();
  }

  function startOne(jobId) {
    const job = findDownloadJob(state, jobId);
    if (!job || ![JOB_STATUS.pending, JOB_STATUS.paused].includes(job.status)) {
      return false;
    }
    move(jobId, "top");
    if (!scheduler.hasFreeSlot()) return true;
    return scheduler.startOne(job);
  }

  function startRunning(job) {
    const signature = getSignature(job);
    const existing = getPendingDownloadJobs(state).find(
      (entry) => getSignature(entry) === signature,
    );
    const running = existing
      ? transitionDownloadJob(existing, JOB_STATUS.running, job)
      : normalizeDownloadJob({ ...job, status: JOB_STATUS.running });
    if (!running) return null;
    upsertDownloadJob(state, running);
    commit("running");
    return findDownloadJob(state, job.jobId || job.id || job.signature);
  }

  function updateProgress(jobId, metrics = {}) {
    const job = findDownloadJob(state, jobId);
    if (!job || job.status !== JOB_STATUS.running) return null;
    const updated = patchDownloadJob(state, jobId, metrics);
    if (updated) commit("progress", { persist: false });
    return updated;
  }

  function patch(jobId, values, options = {}) {
    const updated = patchDownloadJob(state, jobId, values);
    if (updated) commit(options.reason || "patch", { persist: options.persist !== false });
    return updated;
  }

  function finish(jobId, outcome = {}) {
    const job = findDownloadJob(state, jobId);
    if (!job || job.status !== JOB_STATUS.running) return null;
    if (outcome.status === JOB_STATUS.failed) {
      const failed = transitionDownloadJob(job, JOB_STATUS.failed, outcome);
      if (failed) upsertDownloadJob(state, failed);
    } else {
      removeDownloadJob(state, jobId);
    }
    commit("finish");
    scheduler.pump("auto");
    return findDownloadJob(state, jobId);
  }

  function restore(jobs, options = {}) {
    const current = ensureDownloadJobsState(state);
    const identities = new Set(
      jobs.map((job) => String(job.jobId || job.id || job.signature)),
    );
    setDownloadJobs(state, [
      ...jobs,
      ...current.filter(
        (job) => !identities.has(String(job.jobId || job.id || job.signature)),
      ),
    ]);
    if (typeof options.paused === "boolean") {
      state.suppressAutoPump = options.paused;
      state.queuePaused = options.paused;
    }
    commit("restore");
  }

  return {
    clear,
    dispose() {
      metadata.dispose();
      scheduler.dispose();
    },
    enqueueMany,
    finish,
    getSnapshot: snapshot,
    hydrate,
    move,
    patch,
    persist: () => repository.persist(snapshot()),
    pump: (reason) => scheduler.pump(reason),
    remove,
    restore,
    retry,
    retryAll,
    setCollapsed(collapsed) {
      state.queueCollapsed = Boolean(collapsed);
      return commit("collapse");
    },
    setParallelLimit(limit) {
      state.maxParallelDownloads = Math.max(1, Math.min(2, Number(limit) || 1));
      commit("parallel-limit");
      scheduler.pump("auto");
      return snapshot();
    },
    setPaused,
    startOne,
    startRunning,
    updateProgress,
  };
}

export {
  createQueueController,
  getClearableQueueStatuses,
  getQueueCounts,
};
