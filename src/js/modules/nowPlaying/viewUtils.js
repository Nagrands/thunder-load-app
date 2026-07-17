export function formatPlaybackTime(value) {
  const seconds = Math.max(0, Math.floor(Number(value) || 0));
  const minutes = Math.floor(seconds / 60);
  return `${minutes}:${String(seconds % 60).padStart(2, "0")}`;
}

export function unwrapNowPlayingState(result) {
  if (result?.success === false) {
    throw new Error(result.error?.message || "Unable to restore music library");
  }
  return result?.data ?? result ?? {};
}

export function setPressedState(button, pressed) {
  button?.classList.toggle("is-active", pressed);
  button?.setAttribute("aria-pressed", String(pressed));
}
