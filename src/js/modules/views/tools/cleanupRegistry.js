function createCleanupRegistry() {
  const cleanups = [];
  const timeouts = new Set();
  const intervals = new Set();

  const addCleanup = (cleanup) => {
    if (typeof cleanup !== "function") return cleanup;
    cleanups.push(cleanup);
    return cleanup;
  };

  const clearTimeoutRef = (timeoutId) => {
    if (timeoutId == null) return null;
    clearTimeout(timeoutId);
    timeouts.delete(timeoutId);
    return null;
  };

  const clearIntervalRef = (intervalId) => {
    if (intervalId == null) return null;
    clearInterval(intervalId);
    intervals.delete(intervalId);
    return null;
  };

  const setTimeoutRef = (handler, delay = 0) => {
    const timeoutId = window.setTimeout(() => {
      timeouts.delete(timeoutId);
      handler();
    }, delay);
    timeouts.add(timeoutId);
    addCleanup(() => clearTimeoutRef(timeoutId));
    return timeoutId;
  };

  const setIntervalRef = (handler, delay = 0) => {
    const intervalId = window.setInterval(handler, delay);
    intervals.add(intervalId);
    addCleanup(() => clearIntervalRef(intervalId));
    return intervalId;
  };

  const onWindowEvent = (type, handler, options) => {
    window.addEventListener(type, handler, options);
    addCleanup(() => window.removeEventListener(type, handler, options));
    return handler;
  };

  const onIpcEvent = (ipcRenderer, channel, handler) => {
    if (!ipcRenderer || typeof ipcRenderer.on !== "function") return handler;
    ipcRenderer.on(channel, handler);
    addCleanup(() => {
      if (typeof ipcRenderer.removeListener === "function") {
        ipcRenderer.removeListener(channel, handler);
      }
    });
    return handler;
  };

  const dispose = () => {
    const finalizers = cleanups.splice(0).reverse();
    finalizers.forEach((finalize) => {
      try {
        finalize();
      } catch {}
    });
    timeouts.clear();
    intervals.clear();
  };

  return {
    addCleanup,
    clearInterval: clearIntervalRef,
    clearTimeout: clearTimeoutRef,
    dispose,
    onIpcEvent,
    onWindowEvent,
    setInterval: setIntervalRef,
    setTimeout: setTimeoutRef,
  };
}

export { createCleanupRegistry };
