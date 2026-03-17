const TOOLS_REQUESTED_VIEW_KEY = "__thunder_tools_requested_view__";

export function requestToolsView(toolView) {
  const nextView = String(toolView || "").trim();
  if (!nextView) return;

  try {
    window[TOOLS_REQUESTED_VIEW_KEY] = nextView;
  } catch {}

  try {
    window.dispatchEvent(
      new CustomEvent("tools:navigate", {
        detail: { toolView: nextView },
      }),
    );
  } catch {}
}

export function consumeRequestedToolsView() {
  try {
    const requested = window[TOOLS_REQUESTED_VIEW_KEY];
    delete window[TOOLS_REQUESTED_VIEW_KEY];
    return typeof requested === "string" ? requested : "";
  } catch {
    return "";
  }
}
