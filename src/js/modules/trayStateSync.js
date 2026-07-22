const TRAY_STATE_CHANNEL = "tray-state-update";

const runtimeState = {
  activeCount: 0,
  failedCount: 0,
  paused: false,
};

let lastSentState = null;
let initialized = false;

function resolveTrayState({ online, activeCount, failedCount, paused }) {
  if (!online) return "offline";
  if (failedCount > 0) return "error";
  if (activeCount > 0) return "downloading";
  if (paused) return "paused";
  return "idle";
}

function sendCurrentTrayState() {
  const nextState = resolveTrayState({
    ...runtimeState,
    online: navigator.onLine,
  });
  if (nextState === lastSentState) return;
  try {
    window.electron?.send?.(TRAY_STATE_CHANNEL, nextState);
    lastSentState = nextState;
  } catch (error) {
    console.warn("Failed to synchronize tray state", error);
  }
}

function handleDownloadState(event) {
  const detail = event?.detail || {};
  runtimeState.activeCount = Math.max(0, Number(detail.activeCount) || 0);
  runtimeState.failedCount = Math.max(0, Number(detail.failedCount) || 0);
  runtimeState.paused = Boolean(detail.paused);
  sendCurrentTrayState();
}

function initTrayStateSync() {
  if (initialized) return;
  initialized = true;
  window.addEventListener("download:state", handleDownloadState);
  window.addEventListener("online", sendCurrentTrayState);
  window.addEventListener("offline", sendCurrentTrayState);
  sendCurrentTrayState();
}

function resetTrayStateSyncForTests() {
  window.removeEventListener("download:state", handleDownloadState);
  window.removeEventListener("online", sendCurrentTrayState);
  window.removeEventListener("offline", sendCurrentTrayState);
  runtimeState.activeCount = 0;
  runtimeState.failedCount = 0;
  runtimeState.paused = false;
  lastSentState = null;
  initialized = false;
}

export { initTrayStateSync, resetTrayStateSyncForTests, resolveTrayState };
