const SETTINGS_PATH = "/settings";

function createWebRouter({
  modal,
  hasUnsavedChanges = () => false,
  confirmDiscard = () => false,
  onDiscard = () => {},
  onSettingsClosed = () => {},
}) {
  const canLeave = () => {
    if (!hasUnsavedChanges()) return true;
    const finish = (confirmed) => {
      if (!confirmed) return false;
      onDiscard();
      return true;
    };
    const decision = confirmDiscard();
    return decision && typeof decision.then === "function"
      ? decision.then(finish)
      : finish(decision);
  };

  const render = ({ fromHistory = false } = {}) => {
    const settingsOpen = window.location.pathname === SETTINGS_PATH;
    const apply = () => {
      modal.classList.toggle("is-open", settingsOpen);
      modal.setAttribute("aria-hidden", settingsOpen ? "false" : "true");
      document.body.classList.toggle("settings-modal-open", settingsOpen);
      if (!settingsOpen) onSettingsClosed();
    };
    if (!settingsOpen && fromHistory) {
      const decision = canLeave();
      const finish = (allowed) => {
        if (!allowed) {
          window.history.pushState({ settingsFromApp: true }, "", SETTINGS_PATH);
          return false;
        }
        apply();
        return true;
      };
      return decision && typeof decision.then === "function"
        ? decision.then(finish)
        : finish(decision);
    }
    apply();
    return true;
  };

  const openSettings = () => {
    if (window.location.pathname !== SETTINGS_PATH) {
      window.history.pushState({ settingsFromApp: true }, "", SETTINGS_PATH);
    }
    render();
  };

  const closeSettings = ({ force = false } = {}) => {
    if (window.location.pathname !== SETTINGS_PATH) return;
    const close = (allowed) => {
      if (!allowed) return false;
      if (window.history.state?.settingsFromApp) {
        window.history.back();
        return true;
      }
      window.history.replaceState({}, "", "/");
      render();
      return true;
    };
    const decision = force ? true : canLeave();
    return decision && typeof decision.then === "function"
      ? decision.then(close)
      : close(decision);
  };

  window.addEventListener("popstate", () => render({ fromHistory: true }));
  render();
  return { closeSettings, openSettings, render };
}

const routerApi = { createWebRouter };
if (typeof module !== "undefined") module.exports = routerApi;
if (typeof window !== "undefined") window.WebControlRouter = routerApi;
