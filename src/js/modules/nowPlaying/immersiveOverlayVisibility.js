const HIDE_DELAY_MS = 180;

export function createImmersiveOverlayVisibility({
  root,
  sidebar,
  topbar = document.querySelector(".top-bar"),
  sidebarZone,
  topbarZone,
  delay = HIDE_DELAY_MS,
}) {
  const timers = { sidebar: null, topbar: null };
  const engaged = { sidebar: false, topbar: false };
  const bindings = [];
  let active = false;
  let disposed = false;
  let sidebarPinned = false;

  function className(region) {
    return `is-${region}-visible`;
  }

  function clearHide(region) {
    if (timers[region] === null) return;
    clearTimeout(timers[region]);
    timers[region] = null;
  }

  function show(region) {
    if (!active || disposed) return;
    clearHide(region);
    root.classList.add(className(region));
  }

  function hide(region, { immediate = false } = {}) {
    clearHide(region);
    if (region === "sidebar" && sidebarPinned && active && !immediate) return;
    if (immediate) {
      root.classList.remove(className(region));
      return;
    }
    timers[region] = setTimeout(() => {
      timers[region] = null;
      root.classList.remove(className(region));
    }, delay);
  }

  function listen(target, type, listener) {
    if (!target) return;
    target.addEventListener(type, listener);
    bindings.push(() => target.removeEventListener(type, listener));
  }

  function bindRegion(region, zone, overlay) {
    const containsTarget = (target) =>
      !!target && (zone?.contains(target) || overlay?.contains(target));
    const onEnter = () => {
      engaged[region] = true;
      show(region);
    };
    const onLeave = (event) => {
      if (containsTarget(event.relatedTarget)) return;
      engaged[region] = false;
      hide(region);
    };
    const onFocusIn = () => {
      engaged[region] = true;
      show(region);
    };
    const onFocusOut = () => {
      queueMicrotask(() => {
        if (disposed || containsTarget(document.activeElement)) return;
        engaged[region] = false;
        hide(region);
      });
    };
    [zone, overlay].forEach((target) => {
      listen(target, "mouseenter", onEnter);
      listen(target, "mouseleave", onLeave);
      listen(target, "focusin", onFocusIn);
      listen(target, "focusout", onFocusOut);
    });
  }

  bindRegion("sidebar", sidebarZone, sidebar);
  bindRegion("topbar", topbarZone, topbar);

  return {
    setSidebarPinned(pinned) {
      sidebarPinned = pinned === true;
      root.classList.toggle("is-sidebar-pinned", sidebarPinned);
      if (sidebarPinned && active) {
        show("sidebar");
        return;
      }
      if (active && !engaged.sidebar) hide("sidebar");
    },
    onShow() {
      active = true;
      if (sidebarPinned) show("sidebar");
    },
    onHide() {
      active = false;
      engaged.sidebar = false;
      engaged.topbar = false;
      hide("sidebar", { immediate: true });
      hide("topbar", { immediate: true });
    },
    dispose() {
      if (disposed) return;
      disposed = true;
      active = false;
      hide("sidebar", { immediate: true });
      hide("topbar", { immediate: true });
      bindings.splice(0).forEach((unbind) => unbind());
    },
  };
}

export default createImmersiveOverlayVisibility;
