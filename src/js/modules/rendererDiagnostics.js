export function serializeRendererError(error) {
  return {
    name: error?.name || "Error",
    code: error?.code || undefined,
    message: error?.message || String(error),
  };
}

export function logRendererEvent(scope, level, event, context = {}) {
  try {
    window.electron?.diagnostics?.log?.(scope, level, event, context);
  } catch {}
}

export function logRendererError(scope, event, error, context = {}) {
  logRendererEvent(scope, "error", event, {
    ...context,
    error: serializeRendererError(error),
  });
}
