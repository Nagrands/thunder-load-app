import { t } from "../i18n.js";

function unwrapFullscreenState(result) {
  if (result?.success === false) {
    throw new Error(result.error?.message || "Fullscreen operation failed");
  }
  if (typeof result === "boolean") return result;
  return result?.data?.isFullscreen === true;
}

export function createFullscreenController({
  root,
  button,
  api = window.electron?.fullscreen,
  onError = () => {},
}) {
  let fullscreen = false;
  let disposed = false;
  let removeChangedListener = null;
  let requestVersion = 0;

  function sync(nextFullscreen) {
    if (disposed) return;
    fullscreen = nextFullscreen === true;
    root.classList.toggle("is-fullscreen", fullscreen);
    button.classList.toggle("is-active", fullscreen);
    button.setAttribute("aria-pressed", String(fullscreen));
    button.setAttribute(
      "aria-label",
      t(
        fullscreen ? "nowPlaying.exitFullscreen" : "nowPlaying.enterFullscreen",
      ),
    );
    const icon = button.querySelector("i");
    icon?.classList.toggle("fa-expand", !fullscreen);
    icon?.classList.toggle("fa-compress", fullscreen);
  }

  async function setState(nextFullscreen) {
    if (!api?.setState || disposed) return false;
    const version = ++requestVersion;
    const previous = fullscreen;
    sync(nextFullscreen);
    try {
      const nextState = unwrapFullscreenState(
        await api.setState(nextFullscreen === true),
      );
      if (version === requestVersion) sync(nextState);
      return true;
    } catch (error) {
      if (version === requestVersion) sync(previous);
      onError(error);
      return false;
    }
  }

  async function toggle() {
    return setState(!fullscreen);
  }

  async function exit({ force = false } = {}) {
    if (!fullscreen && !force) return true;
    return setState(false);
  }

  function onKeydown(event) {
    if (event.key !== "Escape" || !fullscreen) return;
    event.preventDefault();
    void exit();
  }

  window.addEventListener("keydown", onKeydown);
  if (api?.onChanged) {
    try {
      const unsubscribe = api.onChanged((nextFullscreen) => {
        requestVersion += 1;
        sync(nextFullscreen);
      });
      if (typeof unsubscribe === "function") {
        removeChangedListener = unsubscribe;
      }
    } catch (error) {
      onError(error);
    }
  }
  sync(false);

  const ready = (async () => {
    if (!api?.getState) {
      button.disabled = true;
      return false;
    }
    try {
      const version = requestVersion;
      const nextState = unwrapFullscreenState(await api.getState());
      if (version === requestVersion) sync(nextState);
      return fullscreen;
    } catch (error) {
      button.disabled = true;
      onError(error);
      return false;
    }
  })();

  return {
    ready,
    toggle,
    exit,
    refresh() {
      sync(fullscreen);
    },
    onHide() {
      void exit({ force: true });
    },
    dispose() {
      if (disposed) return;
      disposed = true;
      window.removeEventListener("keydown", onKeydown);
      removeChangedListener?.();
      removeChangedListener = null;
    },
  };
}

export default createFullscreenController;
