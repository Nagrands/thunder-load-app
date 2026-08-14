function createQueueScheduler({
  getPendingJobs,
  getActiveCount,
  getActiveSignatures,
  getParallelLimit,
  isPaused,
  getSignature,
  startJob,
  onStarted = () => {},
} = {}) {
  const reservations = new Set();
  let disposed = false;

  const getOccupiedCount = () => {
    if (typeof getActiveSignatures !== "function") {
      return getActiveCount() + reservations.size;
    }
    return new Set([...getActiveSignatures(), ...reservations]).size;
  };

  const hasFreeSlot = () => getOccupiedCount() < getParallelLimit();

  function launch(job, reason) {
    const signature = getSignature(job);
    if (!signature || reservations.has(signature) || !hasFreeSlot()) {
      return false;
    }
    reservations.add(signature);
    onStarted(job, reason);
    Promise.resolve(startJob(job, reason)).finally(() => {
      reservations.delete(signature);
      if (!disposed) pump("auto");
    });
    return true;
  }

  function pump(reason = "auto") {
    if (disposed || (reason === "auto" && isPaused())) return 0;
    let started = 0;
    for (const job of getPendingJobs()) {
      if (!hasFreeSlot()) break;
      if (launch(job, reason)) started += 1;
    }
    return started;
  }

  function startOne(job, reason = "manual") {
    if (disposed || !job || !hasFreeSlot()) return false;
    return launch(job, reason);
  }

  return {
    dispose() {
      disposed = true;
      reservations.clear();
    },
    getReservationCount: () => reservations.size,
    hasFreeSlot,
    pump,
    startOne,
  };
}

export { createQueueScheduler };
