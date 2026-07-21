const SETTINGS_PATH = "/settings";

function createWebRouter({
  modal,
  hasUnsavedChanges = () => false,
  confirmDiscard = () => window.confirm("Сбросить несохранённые изменения?"),
  onDiscard = () => {},
  onSettingsClosed = () => {},
}) {
  const canLeave = () => {
    if (!hasUnsavedChanges()) return true;
    if (!confirmDiscard()) return false;
    onDiscard();
    return true;
  };

  const render = ({ fromHistory = false } = {}) => {
    const settingsOpen = window.location.pathname === SETTINGS_PATH;
    if (!settingsOpen && fromHistory && !canLeave()) {
      window.history.pushState({ settingsFromApp: true }, "", SETTINGS_PATH);
      return;
    }
    modal.classList.toggle("is-open", settingsOpen);
    modal.setAttribute("aria-hidden", settingsOpen ? "false" : "true");
    document.body.classList.toggle("settings-modal-open", settingsOpen);
    if (!settingsOpen) onSettingsClosed();
  };

  const openSettings = () => {
    if (window.location.pathname !== SETTINGS_PATH) {
      window.history.pushState({ settingsFromApp: true }, "", SETTINGS_PATH);
    }
    render();
  };

  const closeSettings = ({ force = false } = {}) => {
    if (window.location.pathname !== SETTINGS_PATH) return;
    if (!force && !canLeave()) return;
    if (window.history.state?.settingsFromApp) {
      window.history.back();
      return;
    }
    window.history.replaceState({}, "", "/");
    render();
  };

  window.addEventListener("popstate", () => render({ fromHistory: true }));
  render();
  return { closeSettings, openSettings, render };
}

const routerApi = { createWebRouter };
if (typeof module !== "undefined") module.exports = routerApi;
if (typeof window !== "undefined") window.WebControlRouter = routerApi;
