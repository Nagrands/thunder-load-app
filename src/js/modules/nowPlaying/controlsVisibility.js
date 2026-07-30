const AUTOHIDE_DELAY_MS = 2500;

export function createControlsVisibility({
  root,
  controlsSurface,
  lockRegions = [controlsSurface],
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
    if (lockRegions.some((region) => region?.contains(event.target))) {
      setLocked(true);
      return;
    }
    onInteraction();
  }

  function onFocusOut(event) {
    if (!lockRegions.some((region) => region?.contains(event.target))) return;
    queueMicrotask(() => {
      if (
        disposed ||
        lockRegions.some((region) => region?.contains(document.activeElement))
      ) {
        return;
      }
      setLocked(false);
    });
  }

  function onLockedRegionEnter() {
    setLocked(true);
  }

  function onLockedRegionLeave() {
    setLocked(false);
  }

  root.addEventListener("mousemove", onInteraction);
  root.addEventListener("keydown", onInteraction);
  root.addEventListener("focusin", onFocusIn);
  root.addEventListener("focusout", onFocusOut);
  lockRegions.forEach((region) => {
    region?.addEventListener("mouseenter", onLockedRegionEnter);
    region?.addEventListener("mouseleave", onLockedRegionLeave);
  });

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
      lockRegions.forEach((region) => {
        region?.removeEventListener("mouseenter", onLockedRegionEnter);
        region?.removeEventListener("mouseleave", onLockedRegionLeave);
      });
    },
  };
}

export default createControlsVisibility;
