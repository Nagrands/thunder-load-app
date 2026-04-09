const BODY_LOCK_MODAL_SELECTORS = [
  "#download-quality-modal.is-open",
  '#settings-modal[aria-hidden="false"]',
  "#preview-live-player.is-open",
];

const DOCUMENT_LOCK_OVERLAY_SELECTORS = [
  ".modal-overlay",
  "#wg-howto-modal",
  "#hash-howto-modal",
  "#power-howto-modal",
  "#sorter-howto-modal",
];

let hasInitialized = false;

function isElementVisible(element) {
  if (!(element instanceof HTMLElement)) return false;
  if (element.hidden) return false;
  if (element.classList.contains("hidden")) return false;
  if (element.getAttribute("aria-hidden") === "true") return false;

  const inlineDisplay = element.style?.display;
  if (inlineDisplay === "none") return false;

  const computed = window.getComputedStyle(element);
  return computed.display !== "none" && computed.visibility !== "hidden";
}

function hasActiveBodyLockModal() {
  return BODY_LOCK_MODAL_SELECTORS.some((selector) => {
    const element = document.querySelector(selector);
    return isElementVisible(element);
  });
}

function hasActiveDocumentLockOverlay() {
  return DOCUMENT_LOCK_OVERLAY_SELECTORS.some((selector) =>
    Array.from(document.querySelectorAll(selector)).some(isElementVisible),
  );
}

function repairScrollLocks() {
  if (
    document.body.classList.contains("modal-scroll-lock") &&
    !hasActiveBodyLockModal()
  ) {
    document.body.classList.remove("modal-scroll-lock");
  }

  if (
    document.documentElement.style.overflow === "hidden" &&
    !hasActiveDocumentLockOverlay()
  ) {
    document.documentElement.style.overflow = "";
  }
}

function initScrollLockRepair() {
  if (hasInitialized) return;
  hasInitialized = true;

  repairScrollLocks();
  window.addEventListener("focus", repairScrollLocks);
  window.addEventListener("pageshow", repairScrollLocks);
  document.addEventListener("visibilitychange", repairScrollLocks);
}

export { initScrollLockRepair, repairScrollLocks };
