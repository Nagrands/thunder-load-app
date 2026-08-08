"use strict";

const { createCorrelationId } = require("./diagnosticsLogger");

function createTrackedIpcMain(ipcMain, { logger = null } = {}) {
  const listeners = [];
  const handledChannels = new Set();
  const disposers = [];
  let disposed = false;

  const api = new Proxy(ipcMain, {
    get(target, property) {
      if (property === "handle") {
        return (channel, handler) => {
          const wrapped = async (event, ...args) => {
            const correlationId = createCorrelationId("ipc");
            const startedAt = Date.now();
            if (event && typeof event === "object") {
              event.thunderCorrelationId = correlationId;
            }
            logger?.debug("invoke-started", { channel, correlationId });
            try {
              const result = await handler(event, ...args);
              logger?.debug("invoke-completed", {
                channel,
                correlationId,
                duration: Date.now() - startedAt,
              });
              return result;
            } catch (error) {
              logger?.error("invoke-failed", {
                channel,
                correlationId,
                duration: Date.now() - startedAt,
                error,
              });
              throw error;
            }
          };
          target.handle(channel, wrapped);
          handledChannels.add(channel);
        };
      }
      if (property === "on" || property === "once") {
        return (channel, handler) => {
          const wrapped = (event, ...args) => {
            logger?.debug("event-received", {
              channel,
              correlationId: createCorrelationId("ipc-event"),
            });
            return handler(event, ...args);
          };
          target[property](channel, wrapped);
          listeners.push({ channel, handler: wrapped });
          return api;
        };
      }
      const value = target[property];
      return typeof value === "function" ? value.bind(target) : value;
    },
  });

  return {
    api,
    addDisposer(disposer) {
      if (typeof disposer === "function") disposers.push(disposer);
      else if (typeof disposer?.dispose === "function") {
        disposers.push(() => disposer.dispose());
      }
    },
    async dispose() {
      if (disposed) return;
      disposed = true;
      listeners.forEach(({ channel, handler }) =>
        ipcMain.removeListener?.(channel, handler),
      );
      handledChannels.forEach((channel) => ipcMain.removeHandler?.(channel));
      await Promise.allSettled(disposers.reverse().map((dispose) => dispose()));
      listeners.length = 0;
      handledChannels.clear();
      disposers.length = 0;
    },
  };
}

module.exports = { createTrackedIpcMain };
