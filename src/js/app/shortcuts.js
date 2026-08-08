const { app, globalShortcut } = require("electron");
const ElectronStore = require("electron-store").default;
const { ShortcutService } = require("./shortcutService");

let shortcutService = null;
let cleanupRegistered = false;

function configureShortcutService({
  store = new ElectronStore(),
  mainWindow = null,
} = {}) {
  if (!shortcutService) {
    shortcutService = new ShortcutService({
      store,
      globalShortcut,
      mainWindow,
    });
  } else if (mainWindow) {
    shortcutService.setMainWindow(mainWindow);
  }
  if (!cleanupRegistered) {
    app.on("will-quit", () => shortcutService?.unregisterOwned());
    cleanupRegistered = true;
  }
  return shortcutService;
}

function getShortcutService() {
  return shortcutService || configureShortcutService();
}

function setupGlobalShortcuts(mainWindow) {
  const service = getShortcutService();
  service.setMainWindow(mainWindow);
  return service.registerGlobals();
}

function setGlobalShortcutsDisabled(disabled) {
  return getShortcutService().setGlobalShortcutsDisabled(disabled);
}

function disposeGlobalShortcuts() {
  shortcutService?.unregisterOwned();
}

module.exports = {
  configureShortcutService,
  disposeGlobalShortcuts,
  getShortcutService,
  setupGlobalShortcuts,
  setGlobalShortcutsDisabled,
};
