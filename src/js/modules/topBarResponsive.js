function isElementVisible(el) {
  if (!el) return false;
  const style = window.getComputedStyle(el);
  if (style.display === "none" || style.visibility === "hidden") return false;
  if (el.closest("[hidden]")) return false;
  if (el.getAttribute("aria-hidden") === "true") return false;
  const rect = el.getBoundingClientRect();
  return rect.width > 0 || rect.height > 0 || style.position === "fixed";
}

function setOverflowMenuState(topBar, toggle, menu, isOpen) {
  menu.hidden = !isOpen;
  toggle.setAttribute("aria-expanded", isOpen ? "true" : "false");
  topBar.classList.toggle("is-overflow-open", isOpen);
}

function getProxyTarget(item) {
  const selector = item.getAttribute("data-proxy-target");
  return selector ? document.querySelector(selector) : null;
}

function syncOverflowItem(item) {
  const target = getProxyTarget(item);
  if (!target) {
    item.hidden = true;
    item.disabled = true;
    return 0;
  }

  const shouldSurfaceInOverflow = !isElementVisible(target);
  item.hidden = !shouldSurfaceInOverflow;
  item.disabled = !!target.disabled;
  return shouldSurfaceInOverflow ? 1 : 0;
}

function syncOverflowItems(menu, toggle, closeMenu) {
  const items = menu.querySelectorAll("[data-proxy-target]");
  let visibleCount = 0;

  items.forEach((item) => {
    visibleCount += syncOverflowItem(item);
  });

  const hasVisibleItems = visibleCount > 0;
  toggle.hidden = !hasVisibleItems;
  toggle.disabled = !hasVisibleItems;
  if (!hasVisibleItems) closeMenu();
}

function createCloseMenu(topBar, toggle, menu) {
  return () => {
    if (menu.hidden) return;
    setOverflowMenuState(topBar, toggle, menu, false);
  };
}

function createOpenMenu(topBar, toggle, menu) {
  return () => {
    if (!menu.hidden) return;
    setOverflowMenuState(topBar, toggle, menu, true);
  };
}

function initTopBarResponsive() {
  const topBar = document.querySelector(".top-bar");
  const toggle = document.getElementById("topbar-more-toggle");
  const menu = document.getElementById("topbar-overflow-menu");
  const root = document.documentElement;
  if (!topBar || !toggle || !menu) return;

  const closeMenu = createCloseMenu(topBar, toggle, menu);
  const openMenu = createOpenMenu(topBar, toggle, menu);
  const syncOverflowItemsWithState = () =>
    syncOverflowItems(menu, toggle, closeMenu);

  const setCurrentHeight = () => {
    const next = Math.ceil(topBar.getBoundingClientRect().height);
    root.style.setProperty("--topbar-current-height", `${next}px`);
  };

  toggle.addEventListener("click", (event) => {
    event.stopPropagation();
    if (menu.hidden) {
      syncOverflowItemsWithState();
      openMenu();
    } else {
      closeMenu();
    }
  });

  menu.addEventListener("click", (event) => {
    const item = event.target.closest("[data-proxy-target]");
    if (!item || item.disabled) return;
    const target = getProxyTarget(item);
    if (target) target.click();
    closeMenu();
  });

  document.addEventListener("click", (event) => {
    if (menu.hidden) return;
    if (toggle.contains(event.target) || menu.contains(event.target)) return;
    closeMenu();
  });

  document.addEventListener("keydown", (event) => {
    if (event.key === "Escape") closeMenu();
  });

  window.addEventListener("resize", () => {
    syncOverflowItemsWithState();
    setCurrentHeight();
  });
  window.addEventListener("i18n:changed", syncOverflowItemsWithState);
  window.addEventListener("tabs:activated", syncOverflowItemsWithState);

  if (typeof window.ResizeObserver === "function") {
    const observer = new window.ResizeObserver(() => {
      setCurrentHeight();
      syncOverflowItemsWithState();
    });
    observer.observe(topBar);
  }

  if (typeof window.MutationObserver === "function") {
    const targets = menu.querySelectorAll("[data-proxy-target]");
    const mutationObserver = new window.MutationObserver(
      syncOverflowItemsWithState,
    );
    targets.forEach((item) => {
      const target = getProxyTarget(item);
      if (!target) return;
      mutationObserver.observe(target, {
        attributes: true,
        attributeFilter: ["style", "class", "hidden", "disabled"],
      });
    });
  }

  syncOverflowItemsWithState();
  setCurrentHeight();
}

export { initTopBarResponsive };
