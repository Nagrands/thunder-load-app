// src/js/modules/retryFocus.js

import { urlInput } from "./domElements.js";

function resolveTopbarOffset() {
  let cssVarOffset = 0;
  try {
    const raw = getComputedStyle(document.documentElement).getPropertyValue(
      "--topbar-current-height",
    );
    cssVarOffset = Number.parseFloat(raw) || 0;
  } catch {}
  if (cssVarOffset > 0) return cssVarOffset;

  try {
    const topBar = document.querySelector(".top-bar");
    if (topBar && typeof topBar.getBoundingClientRect === "function") {
      const rect = topBar.getBoundingClientRect();
      if (rect.height > 0) return rect.height;
    }
  } catch {}

  return 96;
}

function focusUrlInputAfterRetry() {
  if (!urlInput) return;

  const scrollTarget =
    document.querySelector(".url-input-wrapper") ||
    document.querySelector(".input-container") ||
    urlInput;

  try {
    const topbarOffset = resolveTopbarOffset();
    const padding = 12;
    if (
      scrollTarget &&
      typeof scrollTarget.getBoundingClientRect === "function"
    ) {
      const rect = scrollTarget.getBoundingClientRect();
      const currentY = window.scrollY || window.pageYOffset || 0;
      const targetTop = Math.max(
        0,
        rect.top + currentY - topbarOffset - padding,
      );
      window.scrollTo({ top: targetTop, behavior: "smooth" });
    } else if (typeof window.scrollTo === "function") {
      window.scrollTo({ top: 0, behavior: "smooth" });
    }
  } catch {
    try {
      window.scrollTo?.({ top: 0, behavior: "smooth" });
    } catch {}
  }

  requestAnimationFrame(() => {
    setTimeout(() => {
      try {
        urlInput.focus({ preventScroll: true });
      } catch {
        urlInput.focus();
      }
      try {
        urlInput.select?.();
      } catch {}
    }, 80);
  });
}

export { focusUrlInputAfterRetry };
