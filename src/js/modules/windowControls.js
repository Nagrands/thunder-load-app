let activeRoot = null;
let activeHandler = null;

function resolveWindowAction(target, root) {
  if (!(target instanceof Element)) return null;
  const button = target.closest("[data-window-action]");
  if (!button || !root.contains(button)) return null;
  return button;
}

function initWindowControls(root = document) {
  if (!root?.addEventListener) return () => {};
  if (activeRoot === root && activeHandler) {
    return () => disposeWindowControls(root);
  }
  disposeWindowControls();

  activeRoot = root;
  activeHandler = (event) => {
    const button = resolveWindowAction(event.target, root);
    if (!button || button.disabled) return;
    const action = button.dataset.windowAction;
    const handler =
      action === "minimize"
        ? window.electron?.minimize
        : action === "close"
          ? window.electron?.close
          : null;
    if (typeof handler !== "function") return;
    event.preventDefault();
    handler();
  };
  root.addEventListener("click", activeHandler);
  return () => disposeWindowControls(root);
}

function disposeWindowControls(root = activeRoot) {
  if (!activeRoot || !activeHandler || root !== activeRoot) return;
  activeRoot.removeEventListener("click", activeHandler);
  activeRoot = null;
  activeHandler = null;
}

export { disposeWindowControls, initWindowControls };
