import { clearAllScrollLocks, repairScrollLocks } from "./scrollLockManager.js";

let hasInitialized = false;

function initScrollLockRepair() {
  if (hasInitialized) return;
  hasInitialized = true;

  repairScrollLocks();
  window.addEventListener("focus", repairScrollLocks);
  window.addEventListener("pageshow", repairScrollLocks);
  document.addEventListener("visibilitychange", repairScrollLocks);
  document.addEventListener("tools:view-hidden", clearAllScrollLocks);
}

export { initScrollLockRepair, repairScrollLocks, clearAllScrollLocks };
