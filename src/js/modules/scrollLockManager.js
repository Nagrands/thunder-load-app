const bodyLockOwners = new Set();
const documentLockOwners = new Set();
const MODAL_ACTIVE_CLASS = "modal-overlay-active";

function normalizeOwner(owner, fallback) {
  const value = String(owner || fallback || "").trim();
  return value || String(fallback || "scroll-lock-owner");
}

function syncBodyScrollLock() {
  document.body.classList.toggle("modal-scroll-lock", bodyLockOwners.size > 0);
  document.body.classList.toggle(
    MODAL_ACTIVE_CLASS,
    bodyLockOwners.size > 0 || documentLockOwners.size > 0,
  );
}

function syncDocumentScrollLock() {
  document.documentElement.style.overflow =
    documentLockOwners.size > 0 ? "hidden" : "";
}

function syncScrollLocks() {
  syncBodyScrollLock();
  syncDocumentScrollLock();
}

function acquireBodyScrollLock(owner) {
  bodyLockOwners.add(normalizeOwner(owner, "body-lock"));
  syncScrollLocks();
}

function releaseBodyScrollLock(owner) {
  bodyLockOwners.delete(normalizeOwner(owner, "body-lock"));
  syncScrollLocks();
}

function acquireDocumentScrollLock(owner) {
  documentLockOwners.add(normalizeOwner(owner, "document-lock"));
  syncScrollLocks();
}

function releaseDocumentScrollLock(owner) {
  documentLockOwners.delete(normalizeOwner(owner, "document-lock"));
  syncScrollLocks();
}

function repairScrollLocks() {
  syncScrollLocks();
}

function clearAllScrollLocks() {
  bodyLockOwners.clear();
  documentLockOwners.clear();
  syncScrollLocks();
}

function getScrollLockState() {
  return {
    bodyOwners: Array.from(bodyLockOwners),
    documentOwners: Array.from(documentLockOwners),
  };
}

export {
  acquireBodyScrollLock,
  releaseBodyScrollLock,
  acquireDocumentScrollLock,
  releaseDocumentScrollLock,
  repairScrollLocks,
  clearAllScrollLocks,
  getScrollLockState,
};
