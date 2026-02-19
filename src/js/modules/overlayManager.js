// src/js/modules/overlayManager.js

const overlays = new Map();
let globalListenersAttached = false;

function closeDismissibleOverlays(exceptId = null) {
  overlays.forEach((entry, id) => {
    if (exceptId && id === exceptId) return;
    try {
      if (entry.isOpen()) {
        entry.close();
      }
    } catch (error) {
      console.warn("[overlayManager] close failed:", error);
    }
  });
}

function attachGlobalOverlayListeners() {
  if (globalListenersAttached) return;
  globalListenersAttached = true;

  document.addEventListener(
    "click",
    (event) => {
      overlays.forEach((entry) => {
        if (!entry.closeOnOutside || !entry.isOpen()) return;
        const target = event.target;
        if (entry.isInsideEvent(target)) return;
        entry.close();
      });
    },
    true,
  );

  document.addEventListener("keydown", (event) => {
    if (event.key !== "Escape") return;
    overlays.forEach((entry) => {
      if (!entry.closeOnEscape || !entry.isOpen()) return;
      entry.close();
    });
  });
}

function registerDismissibleOverlay({
  id,
  panel,
  isOpen,
  close,
  isInsideEvent,
  closeOnOutside = true,
  closeOnEscape = true,
}) {
  if (!id || typeof id !== "string") {
    throw new Error("overlay id is required");
  }
  if (!panel) {
    throw new Error("overlay panel is required");
  }
  if (typeof isOpen !== "function" || typeof close !== "function") {
    throw new Error("overlay isOpen/close callbacks are required");
  }

  attachGlobalOverlayListeners();
  overlays.delete(id);

  const safeIsInside =
    typeof isInsideEvent === "function"
      ? isInsideEvent
      : (target) => panel.contains(target);

  overlays.set(id, {
    panel,
    isOpen,
    close,
    isInsideEvent: safeIsInside,
    closeOnOutside,
    closeOnEscape,
  });

  return () => {
    overlays.delete(id);
  };
}

export { registerDismissibleOverlay, closeDismissibleOverlays };
