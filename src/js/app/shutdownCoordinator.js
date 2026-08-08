"use strict";

class ShutdownCoordinator {
  constructor({ logger = null, timeoutMs = 8000 } = {}) {
    this.logger = logger;
    this.timeoutMs = timeoutMs;
    this.tasks = new Map();
    this.state = "running";
    this.stopPromise = null;
  }

  register(name, task) {
    if (this.state !== "running" || typeof task !== "function") return () => {};
    this.tasks.set(name, task);
    return () => this.tasks.delete(name);
  }

  stop() {
    if (this.stopPromise) return this.stopPromise;
    this.state = "stopping";
    this.stopPromise = (async () => {
      const timeout = new Promise((resolve) => {
        const timer = setTimeout(() => resolve("timeout"), this.timeoutMs);
        timer.unref?.();
      });
      const cleanup = Promise.allSettled(
        [...this.tasks.entries()].map(async ([name, task]) => {
          const startedAt = Date.now();
          try {
            await task();
            this.logger?.info("shutdown-task-completed", { name, duration: Date.now() - startedAt });
          } catch (error) {
            this.logger?.error("shutdown-task-failed", { name, error, duration: Date.now() - startedAt });
          }
        }),
      );
      const outcome = await Promise.race([cleanup.then(() => "completed"), timeout]);
      if (outcome === "timeout") this.logger?.warning("shutdown-timeout", { timeoutMs: this.timeoutMs });
      this.state = "stopped";
      return outcome;
    })();
    return this.stopPromise;
  }
}

module.exports = { ShutdownCoordinator };
