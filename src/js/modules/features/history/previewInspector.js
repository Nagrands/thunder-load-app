import { initMediaInspectorPanel } from "../../views/tools/mediaInspectorPanel.js";

function createHistoryInspector({ t, onMissing, onError }) {
  let activeEntryId = "";
  let activeRoot = null;
  let activeTrigger = null;

  const hide = () => {
    if (activeRoot) {
      activeRoot.innerHTML = "";
      activeRoot.classList.add("hidden");
      activeRoot.classList.remove("is-open");
    }
    activeTrigger?.classList.remove("is-active");
    activeEntryId = "";
    activeRoot = null;
    activeTrigger = null;
  };

  const inspect = async (
    entry,
    { root = null, trigger = null, ensureVisible = null } = {},
  ) => {
    if (!entry?.filePath) return;
    try {
      const exists = await window.electron.invoke(
        "check-file-exists",
        entry.filePath,
      );
      if (!exists) {
        entry.isMissing = true;
        onMissing(entry);
        return;
      }
      const entryId = entry.id?.toString?.() || "";
      if (activeEntryId === entryId && activeRoot === root) {
        hide();
        return;
      }
      hide();
      if (!(root instanceof HTMLElement)) return;
      ensureVisible?.();
      root.classList.remove("hidden");
      root.classList.add("is-open");
      const panel = initMediaInspectorPanel({
        root,
        t,
        allowPickFile: false,
        autoAnalyzeInitial: false,
        variant: "history",
      });
      if (!panel) return;
      activeEntryId = entryId;
      activeRoot = root;
      activeTrigger = trigger instanceof HTMLElement ? trigger : null;
      activeTrigger?.classList.add("is-active");
      await panel.inspectFile(entry.filePath, { autoAnalyze: true });
    } catch (error) {
      onError(error);
    }
  };

  return {
    hide,
    inspect,
    isActiveRoot: (root) => activeRoot === root,
  };
}

export { createHistoryInspector };
