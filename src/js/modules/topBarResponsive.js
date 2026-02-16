function isElementVisible(el) {
  if (!el) return false;
  const style = window.getComputedStyle(el);
  if (style.display === "none" || style.visibility === "hidden") return false;
  if (el.closest("[hidden]")) return false;
  if (el.getAttribute("aria-hidden") === "true") return false;
  const rect = el.getBoundingClientRect();
  return rect.width > 0 || rect.height > 0 || style.position === "fixed";
}

function initTopBarResponsive() {
  const topBar = document.querySelector(".top-bar");
  const toggle = document.getElementById("topbar-more-toggle");
  const menu = document.getElementById("topbar-overflow-menu");
  const root = document.documentElement;
  if (!topBar || !toggle || !menu) return;

  const closeMenu = () => {
    if (menu.hidden) return;
    menu.hidden = true;
    toggle.setAttribute("aria-expanded", "false");
    topBar.classList.remove("is-overflow-open");
  };

  const openMenu = () => {
    if (!menu.hidden) return;
    menu.hidden = false;
    toggle.setAttribute("aria-expanded", "true");
    topBar.classList.add("is-overflow-open");
  };

  const syncOverflowItems = () => {
    const items = menu.querySelectorAll("[data-proxy-target]");
    let visibleCount = 0;
    items.forEach((item) => {
      const selector = item.getAttribute("data-proxy-target");
      const target = selector ? document.querySelector(selector) : null;
      if (!target) {
        item.hidden = true;
        item.disabled = true;
        return;
      }
      const shouldSurfaceInOverflow = !isElementVisible(target);
      item.hidden = !shouldSurfaceInOverflow;
      item.disabled = !!target.disabled;
      if (shouldSurfaceInOverflow) visibleCount += 1;
    });

    toggle.hidden = visibleCount === 0;
    toggle.disabled = visibleCount === 0;
    if (visibleCount === 0) closeMenu();
  };

  const setCurrentHeight = () => {
    const next = Math.ceil(topBar.getBoundingClientRect().height);
    root.style.setProperty("--topbar-current-height", `${next}px`);
  };

  toggle.addEventListener("click", (event) => {
    event.stopPropagation();
    if (menu.hidden) {
      syncOverflowItems();
      openMenu();
    } else {
      closeMenu();
    }
  });

  menu.addEventListener("click", (event) => {
    const item = event.target.closest("[data-proxy-target]");
    if (!item || item.disabled) return;
    const selector = item.getAttribute("data-proxy-target");
    const target = selector ? document.querySelector(selector) : null;
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
    syncOverflowItems();
    setCurrentHeight();
  });
  window.addEventListener("i18n:changed", syncOverflowItems);
  window.addEventListener("tabs:activated", syncOverflowItems);

  if (typeof window.ResizeObserver === "function") {
    const observer = new window.ResizeObserver(() => {
      setCurrentHeight();
      syncOverflowItems();
    });
    observer.observe(topBar);
  }

  if (typeof window.MutationObserver === "function") {
    const targets = menu.querySelectorAll("[data-proxy-target]");
    const mutationObserver = new window.MutationObserver(syncOverflowItems);
    targets.forEach((item) => {
      const selector = item.getAttribute("data-proxy-target");
      const target = selector ? document.querySelector(selector) : null;
      if (!target) return;
      mutationObserver.observe(target, {
        attributes: true,
        attributeFilter: ["style", "class", "hidden", "disabled"],
      });
    });
  }

  syncOverflowItems();
  setCurrentHeight();
}

export { initTopBarResponsive };
