const DEFAULT_PREFERENCES = Object.freeze({
  backgroundPlayback: true,
  sidebarPinned: false,
});

function setPressed(button, pressed) {
  button.classList.toggle("is-active", pressed);
  button.setAttribute("aria-pressed", String(pressed));
}

export function createNowPlayingPreferences({
  backgroundButton,
  pinButton,
  overlayVisibility,
  onChange = () => {},
}) {
  const state = { ...DEFAULT_PREFERENCES };

  function render() {
    setPressed(backgroundButton, state.backgroundPlayback);
    setPressed(pinButton, state.sidebarPinned);
    overlayVisibility.setSidebarPinned(state.sidebarPinned);
  }

  function update(key, value, { notify = true } = {}) {
    state[key] = value === true;
    render();
    if (notify) onChange({ ...state });
  }

  render();

  return {
    restore(savedState = {}) {
      state.backgroundPlayback =
        typeof savedState.backgroundPlayback === "boolean"
          ? savedState.backgroundPlayback
          : DEFAULT_PREFERENCES.backgroundPlayback;
      state.sidebarPinned =
        typeof savedState.sidebarPinned === "boolean"
          ? savedState.sidebarPinned
          : DEFAULT_PREFERENCES.sidebarPinned;
      render();
    },
    handleAction(action) {
      if (action === "background-playback") {
        update("backgroundPlayback", !state.backgroundPlayback);
        return true;
      }
      if (action === "pin-sidebar") {
        update("sidebarPinned", !state.sidebarPinned);
        return true;
      }
      return false;
    },
    apply(nextState = {}, { notify = true } = {}) {
      let changed = false;
      ["backgroundPlayback", "sidebarPinned"].forEach((key) => {
        if (
          typeof nextState[key] !== "boolean" ||
          state[key] === nextState[key]
        ) {
          return;
        }
        state[key] = nextState[key];
        changed = true;
      });
      if (!changed) return false;
      render();
      if (notify) onChange({ ...state });
      return true;
    },
    getState() {
      return { ...state };
    },
    shouldSuspendInBackground() {
      return !state.backgroundPlayback;
    },
  };
}

export default createNowPlayingPreferences;
