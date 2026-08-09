(function registerWebUiState(global) {
  const kinds = new Set([
    "idle",
    "loading",
    "success",
    "warning",
    "error",
    "empty",
  ]);

  function normalizeKind(value) {
    if (value === "muted" || !value) return "idle";
    return kinds.has(value) ? value : "idle";
  }

  function apply(element, nextState = {}) {
    if (!(element instanceof HTMLElement)) return null;
    const kind = normalizeKind(nextState.kind || nextState.tone);
    element.dataset.uiState = kind;
    element.dataset.tone = kind;
    element.setAttribute("aria-busy", String(kind === "loading"));
    element.setAttribute("role", kind === "error" ? "alert" : "status");
    element.setAttribute(
      "aria-live",
      kind === "error" ? "assertive" : "polite",
    );
    if (nextState.operationId) {
      element.dataset.operationId = String(nextState.operationId);
    } else {
      delete element.dataset.operationId;
    }
    return { kind, operationId: nextState.operationId || "" };
  }

  global.ThunderWebUiState = Object.freeze({ apply, kinds: [...kinds] });
})(window);
