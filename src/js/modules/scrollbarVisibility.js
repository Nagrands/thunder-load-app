const SCROLLBAR_VISIBLE_CLASS = "scrollbars-visible";
const SCROLLBAR_VISIBLE_TIMEOUT_MS = 900;
const INIT_KEY = "__thunderLoadScrollbarVisibility";

function initScrollbarVisibility() {
  if (window[INIT_KEY]) return;

  let hideTimer = null;

  const toggleVisible = (isVisible) => {
    document.documentElement?.classList.toggle(
      SCROLLBAR_VISIBLE_CLASS,
      isVisible,
    );
    document.body?.classList.toggle(SCROLLBAR_VISIBLE_CLASS, isVisible);
  };

  const showTemporarily = () => {
    toggleVisible(true);
    if (hideTimer) window.clearTimeout(hideTimer);
    hideTimer = window.setTimeout(() => {
      toggleVisible(false);
      hideTimer = null;
    }, SCROLLBAR_VISIBLE_TIMEOUT_MS);
  };

  window.addEventListener("scroll", showTemporarily, {
    capture: true,
    passive: true,
  });
  window.addEventListener("wheel", showTemporarily, { passive: true });
  window.addEventListener("touchmove", showTemporarily, { passive: true });
  window[INIT_KEY] = true;
}

export { initScrollbarVisibility };
