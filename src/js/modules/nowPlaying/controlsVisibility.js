const AUTOHIDE_DELAY_MS = 2500;

export function createControlsVisibility({
  root,
  dock,
  delay = AUTOHIDE_DELAY_MS,
}) {
  let active = false;
  let disposed = false;
  let locked = false;
  let playing = false;
  let timer = null;

  function clearTimer() {
    if (timer === null) return;
    clearTimeout(timer);
    timer = null;
  }

  function scheduleHide() {
    clearTimer();
    if (!active || disposed || !playing || locked) return;
    timer = setTimeout(() => {
      timer = null;
      root.classList.remove("is-controls-visible");
      root.classList.add("is-cursor-hidden");
    }, delay);
  }

  function show({ schedule = true } = {}) {
    root.classList.add("is-controls-visible");
    root.classList.remove("is-cursor-hidden");
    if (schedule) scheduleHide();
    else clearTimer();
  }

  function setLocked(nextLocked) {
    locked = nextLocked;
    root.classList.toggle("is-controls-locked", locked);
    show({ schedule: !locked });
  }

  function onInteraction() {
    show({ schedule: true });
  }

  function onFocusIn(event) {
    if (dock.contains(event.target)) {
      setLocked(true);
      return;
    }
    onInteraction();
  }

  function onFocusOut(event) {
    if (!dock.contains(event.target)) return;
    queueMicrotask(() => {
      if (disposed || dock.contains(document.activeElement)) return;
      setLocked(false);
    });
  }

  function onDockEnter() {
    setLocked(true);
  }

  function onDockLeave() {
    setLocked(false);
  }

  root.addEventListener("mousemove", onInteraction);
  root.addEventListener("keydown", onInteraction);
  root.addEventListener("focusin", onFocusIn);
  root.addEventListener("focusout", onFocusOut);
  dock.addEventListener("mouseenter", onDockEnter);
  dock.addEventListener("mouseleave", onDockLeave);

  return {
    setLocked,
    setPlaybackState(isPlaying) {
      const changed = playing !== isPlaying;
      playing = isPlaying;
      if (!changed) return;
      show({ schedule: playing });
    },
    onShow() {
      active = true;
      show({ schedule: playing });
    },
    onHide() {
      active = false;
      locked = false;
      clearTimer();
      root.classList.remove(
        "is-controls-visible",
        "is-controls-locked",
        "is-cursor-hidden",
      );
    },
    show: onInteraction,
    dispose() {
      if (disposed) return;
      disposed = true;
      clearTimer();
      root.classList.remove("is-cursor-hidden");
      root.removeEventListener("mousemove", onInteraction);
      root.removeEventListener("keydown", onInteraction);
      root.removeEventListener("focusin", onFocusIn);
      root.removeEventListener("focusout", onFocusOut);
      dock.removeEventListener("mouseenter", onDockEnter);
      dock.removeEventListener("mouseleave", onDockLeave);
    },
  };
}

export default createControlsVisibility;
