export function createDisposableScope() {
  const disposers = new Set();
  let disposed = false;

  const add = (disposer) => {
    if (typeof disposer !== "function") return () => {};
    if (disposed) {
      disposer();
      return () => {};
    }
    disposers.add(disposer);
    return () => disposers.delete(disposer);
  };

  return {
    add,
    abortController() {
      const controller = new AbortController();
      add(() => controller.abort());
      return controller;
    },
    event(target, type, listener, options) {
      target?.addEventListener?.(type, listener, options);
      return add(() => target?.removeEventListener?.(type, listener, options));
    },
    interval(callback, delay) {
      const id = window.setInterval(callback, delay);
      add(() => window.clearInterval(id));
      return id;
    },
    timeout(callback, delay) {
      const id = window.setTimeout(() => {
        disposers.delete(cancel);
        callback();
      }, delay);
      const cancel = () => window.clearTimeout(id);
      add(cancel);
      return id;
    },
    dispose() {
      if (disposed) return;
      disposed = true;
      [...disposers].reverse().forEach((dispose) => {
        try {
          dispose();
        } catch {}
      });
      disposers.clear();
    },
  };
}
