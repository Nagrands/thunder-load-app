function createQueueMetadataEnricher({
  resolveMetadata,
  findJob,
  patchJob,
} = {}) {
  const inFlight = new Map();
  let disposed = false;

  async function enrich(job) {
    const identity = String(job?.jobId || job?.id || job?.signature || "");
    const url = String(job?.url || "").trim();
    if (!identity || !url || disposed || typeof resolveMetadata !== "function") {
      return null;
    }
    if (inFlight.has(identity)) return inFlight.get(identity);
    const request = Promise.resolve(resolveMetadata(url))
      .then((metadata) => {
        if (disposed || !metadata) return null;
        const current = findJob(identity);
        if (
          !current ||
          current.url !== url ||
          !["pending", "paused", "running"].includes(current.status)
        ) {
          return null;
        }
        return patchJob(identity, {
          title: String(metadata.title || current.title || ""),
          thumbnail: String(metadata.thumbnail || current.thumbnail || ""),
        });
      })
      .finally(() => inFlight.delete(identity));
    inFlight.set(identity, request);
    return request;
  }

  return {
    dispose() {
      disposed = true;
      inFlight.clear();
    },
    enrich,
  };
}

export { createQueueMetadataEnricher };
