function normalizePackageIds(packageIds = []) {
  const seen = new Set();
  return (Array.isArray(packageIds) ? packageIds : [])
    .map((packageId) => String(packageId || "").trim())
    .filter((packageId) => {
      const key = packageId.toLowerCase();
      if (!key || seen.has(key)) return false;
      seen.add(key);
      return true;
    });
}

function createWingetStatusService(checkStatus) {
  const inFlightRequests = new Map();

  const load = async (packageIds = []) => {
    const normalizedPackageIds = normalizePackageIds(packageIds);
    if (!normalizedPackageIds.length) {
      return { success: true, items: [] };
    }

    const requestKey = normalizedPackageIds
      .map((packageId) => packageId.toLowerCase())
      .sort()
      .join("\n");
    const existingRequest = inFlightRequests.get(requestKey);
    if (existingRequest) return existingRequest;

    const request = (async () => {
      try {
        return await checkStatus({ packageIds: normalizedPackageIds });
      } catch (error) {
        throw error;
      }
    })();
    inFlightRequests.set(requestKey, request);

    try {
      return await request;
    } finally {
      if (inFlightRequests.get(requestKey) === request) {
        inFlightRequests.delete(requestKey);
      }
    }
  };

  return { load };
}

const sharedWingetStatusService = createWingetStatusService((payload) =>
  window.electron.tools.checkWingetStatus(payload),
);

const loadWingetPackageStatuses = (packageIds) =>
  sharedWingetStatusService.load(packageIds);

export {
  createWingetStatusService,
  loadWingetPackageStatuses,
  normalizePackageIds,
};
