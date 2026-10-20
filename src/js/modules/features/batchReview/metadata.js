import { getVideoPreview } from "../../videoInfoBroker.js";

const DEFAULT_CONCURRENCY = 3;

function createBatchMetadataLoader({
  getInfo = getVideoPreview,
  onUpdate,
  concurrency = DEFAULT_CONCURRENCY,
} = {}) {
  const limit = Math.max(1, Number(concurrency) || DEFAULT_CONCURRENCY);
  let generation = 0;
  let active = 0;
  let queue = [];
  let requested = new Set();
  let disposed = false;

  function reset() {
    generation += 1;
    queue = [];
    requested = new Set();
  }

  function pump() {
    if (disposed) return;
    while (active < limit && queue.length) {
      const url = queue.shift();
      void load(url, generation);
    }
  }

  async function load(url, token) {
    active += 1;
    let info = null;
    try {
      info = await getInfo(url);
    } catch {
      info = null;
    } finally {
      active = Math.max(0, active - 1);
    }
    if (!disposed && token === generation) {
      onUpdate?.(url, info?.success ? info : null);
    }
    pump();
  }

  function ensure(urls = []) {
    if (disposed) return;
    urls.forEach((url) => {
      const value = String(url || "").trim();
      if (!value || requested.has(value)) return;
      requested.add(value);
      queue.push(value);
    });
    pump();
  }

  function dispose() {
    if (disposed) return;
    disposed = true;
    reset();
  }

  return { dispose, ensure, reset };
}

export { createBatchMetadataLoader };
