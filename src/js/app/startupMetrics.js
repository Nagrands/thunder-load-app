const { performance } = require("perf_hooks");

function createStartupMetrics(log, { prefix = "[Startup]" } = {}) {
  const startedAt = performance.now();

  function formatDuration(durationMs) {
    return `${durationMs.toFixed(1)}ms`;
  }

  function write(message) {
    if (log && typeof log.info === "function") {
      log.info(message);
      return;
    }
    console.log(message);
  }

  function measure(label, fn) {
    const start = performance.now();
    try {
      return fn();
    } finally {
      write(`${prefix} ${label}: ${formatDuration(performance.now() - start)}`);
    }
  }

  async function measureAsync(label, task) {
    const start = performance.now();
    try {
      return await task();
    } finally {
      write(`${prefix} ${label}: ${formatDuration(performance.now() - start)}`);
    }
  }

  function mark(label) {
    write(
      `${prefix} ${label}: +${formatDuration(performance.now() - startedAt)}`,
    );
  }

  return {
    mark,
    measure,
    measureAsync,
  };
}

module.exports = {
  createStartupMetrics,
};
