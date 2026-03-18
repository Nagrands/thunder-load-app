import { initMediaInspectorPanel } from "./mediaInspectorPanel.js";

export function initMediaInspectorSection({
  view,
  getEl,
  t,
  registerCleanup,
}) {
  const root = view.querySelector('[data-tool-view="media-inspector"]');
  if (!root) return null;

  return initMediaInspectorPanel({
    root,
    getEl,
    t,
    registerCleanup,
    allowPickFile: true,
    autoAnalyzeInitial: false,
    variant: "tools",
  });
}
