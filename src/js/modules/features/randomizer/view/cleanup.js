export function createCleanupRegistry() {
  const cleanups = new Set();

  const addCleanup = (fn) => {
    if (typeof fn !== "function") return () => {};
    cleanups.add(fn);
    return () => cleanups.delete(fn);
  };

  const addEvent = (target, type, handler, options) => {
    if (!target?.addEventListener || !handler) return () => {};
    target.addEventListener(type, handler, options);
    const off = () => target.removeEventListener(type, handler, options);
    cleanups.add(off);
    return () => {
      off();
      cleanups.delete(off);
    };
  };

  const setTimer = (kind, timerId) => {
    if (!timerId) return;
    if (kind === "interval") {
      cleanups.add(() => clearInterval(timerId));
      return;
    }
    if (kind === "timeout") {
      cleanups.add(() => clearTimeout(timerId));
    }
  };

  const dispose = () => {
    const snapshot = Array.from(cleanups);
    cleanups.clear();
    snapshot.reverse().forEach((fn) => {
      try {
        fn();
      } catch {
        // no-op: cleanup best effort
      }
    });
  };

  return {
    addCleanup,
    addEvent,
    dispose,
    setTimer,
  };
}
