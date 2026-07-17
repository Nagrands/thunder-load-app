const ENTRANCE_ROOT_SELECTOR = '[data-ui="tools-entrance-root"]';
const ENTRANCE_HEADER_SELECTOR = '[data-ui="tools-entrance-header"]';
const ENTRANCE_CARD_SELECTOR = '[data-ui="tools-launcher-card"]';
const PREPARED_CLASS = "tools-entrance";
const ACTIVE_CLASS = "is-entering";
const ITEM_CLASS = "tools-entrance__item";
const HEADER_CLASS = "tools-entrance__header";
const SECONDARY_HEADER_CLASS = "tools-entrance__header--secondary";
const CARD_CLASS = "tools-entrance__card";
const INDEX_PROPERTY = "--tools-entrance-index";
const DEFAULT_MAX_STAGGER_INDEX = 8;
const DEFAULT_FALLBACK_MS = 620;

function hasHiddenAncestor(element, boundary) {
  let current = element;
  while (current && current !== boundary.parentElement) {
    if (
      current.hidden ||
      current.classList?.contains("hidden") ||
      current.getAttribute?.("aria-hidden") === "true" ||
      current.style?.display === "none"
    ) {
      return true;
    }
    if (current === boundary) break;
    current = current.parentElement;
  }
  return false;
}

function isVisible(element, boundary, windowRef) {
  if (!element || hasHiddenAncestor(element, boundary)) return false;
  try {
    return windowRef.getComputedStyle?.(element)?.display !== "none";
  } catch {
    return true;
  }
}

function createToolsEntranceAnimation(view, options = {}) {
  const windowRef = options.windowRef || window;
  const fallbackMs = options.fallbackMs ?? DEFAULT_FALLBACK_MS;
  const maxStaggerIndex =
    options.maxStaggerIndex ?? DEFAULT_MAX_STAGGER_INDEX;
  const documentRef = view?.ownerDocument || document;

  let root = null;
  let targets = [];
  let firstFrameId = null;
  let secondFrameId = null;
  let fallbackTimerId = null;
  let finalTarget = null;
  let prepared = false;

  const prefersReducedMotion = () => {
    const lowEffects =
      documentRef.body?.classList.contains("low-effects") ||
      documentRef.documentElement?.classList.contains("low-effects");
    if (lowEffects) return true;
    try {
      return !!windowRef.matchMedia?.(
        "(prefers-reduced-motion: reduce)",
      )?.matches;
    } catch {
      return false;
    }
  };

  const clearScheduledWork = () => {
    if (firstFrameId != null) {
      windowRef.cancelAnimationFrame(firstFrameId);
      firstFrameId = null;
    }
    if (secondFrameId != null) {
      windowRef.cancelAnimationFrame(secondFrameId);
      secondFrameId = null;
    }
    if (fallbackTimerId != null) {
      windowRef.clearTimeout(fallbackTimerId);
      fallbackTimerId = null;
    }
  };

  const removeAnimationEndListener = () => {
    finalTarget?.removeEventListener("animationend", handleAnimationEnd);
    finalTarget = null;
  };

  const resetMarkup = () => {
    root?.classList.remove(PREPARED_CLASS, ACTIVE_CLASS);
    targets.forEach((target) => {
      target.classList.remove(
        ITEM_CLASS,
        HEADER_CLASS,
        SECONDARY_HEADER_CLASS,
        CARD_CLASS,
      );
      target.style.removeProperty(INDEX_PROPERTY);
    });
    root = null;
    targets = [];
    prepared = false;
  };

  const cancel = () => {
    clearScheduledWork();
    removeAnimationEndListener();
    resetMarkup();
  };

  function finish() {
    clearScheduledWork();
    removeAnimationEndListener();
    resetMarkup();
  }

  function handleAnimationEnd(event) {
    if (event.target !== finalTarget) return;
    finish();
  }

  const prepare = () => {
    cancel();
    if (!view || prefersReducedMotion()) return false;

    root = view.matches?.(ENTRANCE_ROOT_SELECTOR)
      ? view
      : view.querySelector?.(ENTRANCE_ROOT_SELECTOR);
    if (!root || !isVisible(root, view, windowRef)) {
      root = null;
      return false;
    }

    const headers = Array.from(
      root.querySelectorAll(ENTRANCE_HEADER_SELECTOR),
    ).filter((header) => isVisible(header, root, windowRef));
    const cards = Array.from(
      root.querySelectorAll(ENTRANCE_CARD_SELECTOR),
    ).filter((card) => isVisible(card, root, windowRef));

    if (!headers.length && !cards.length) {
      root = null;
      return false;
    }

    headers.forEach((header, index) => {
      header.classList.add(ITEM_CLASS, HEADER_CLASS);
      header.classList.toggle(SECONDARY_HEADER_CLASS, index > 0);
    });
    cards.forEach((card, index) => {
      card.classList.add(ITEM_CLASS, CARD_CLASS);
      card.style.setProperty(
        INDEX_PROPERTY,
        String(Math.min(index, maxStaggerIndex)),
      );
    });

    targets = [...headers, ...cards];
    root.classList.add(PREPARED_CLASS);
    prepared = true;
    return true;
  };

  const play = () => {
    if (prefersReducedMotion()) {
      cancel();
      return false;
    }

    const currentRoot =
      root ||
      (view.matches?.(ENTRANCE_ROOT_SELECTOR)
        ? view
        : view.querySelector?.(ENTRANCE_ROOT_SELECTOR));
    const launcher = currentRoot?.querySelector?.("#tools-launcher");
    if (launcher?.classList.contains("hidden")) {
      cancel();
      return false;
    }
    if (!prepare()) return false;

    firstFrameId = windowRef.requestAnimationFrame(() => {
      firstFrameId = null;
      secondFrameId = windowRef.requestAnimationFrame(() => {
        secondFrameId = null;
        if (!prepared || !root?.isConnected || prefersReducedMotion()) {
          cancel();
          return;
        }

        finalTarget = targets.at(-1) || null;
        finalTarget?.addEventListener("animationend", handleAnimationEnd);
        root.classList.add(ACTIVE_CLASS);
        fallbackTimerId = windowRef.setTimeout(finish, fallbackMs);
      });
    });
    return true;
  };

  return { cancel, play, prepare };
}

export {
  ACTIVE_CLASS,
  CARD_CLASS,
  DEFAULT_FALLBACK_MS,
  DEFAULT_MAX_STAGGER_INDEX,
  HEADER_CLASS,
  INDEX_PROPERTY,
  ITEM_CLASS,
  PREPARED_CLASS,
  SECONDARY_HEADER_CLASS,
  createToolsEntranceAnimation,
};
