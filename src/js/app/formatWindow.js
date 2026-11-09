const path = require("path");
const { BrowserWindow } = require("electron");

function createFormatWindowController({
  app,
  BrowserWindowClass = BrowserWindow,
  isDev = false,
  logger = console,
}) {
  let formatWindow = null;

  function focusExistingWindow() {
    if (!formatWindow || formatWindow.isDestroyed()) return false;
    if (formatWindow.isMinimized()) formatWindow.restore();
    formatWindow.show();
    formatWindow.focus();
    return true;
  }

  function open() {
    if (focusExistingWindow()) return formatWindow;

    const window = new BrowserWindowClass({
      title: "Format — Thunder",
      width: 1440,
      height: 900,
      minWidth: 1000,
      minHeight: 640,
      show: false,
      backgroundColor: "#050b16",
      webPreferences: {
        preload: path.join(__dirname, "../preload.js"),
        contextIsolation: true,
        nodeIntegration: false,
        sandbox: true,
        devTools: isDev,
      },
    });

    formatWindow = window;
    window.once("ready-to-show", () => {
      if (!window.isDestroyed()) window.show();
    });
    window.once("closed", () => {
      if (formatWindow === window) formatWindow = null;
    });
    window.setMenuBarVisibility(false);

    const formatPage = path.join(app.getAppPath(), "src", "format.html");
    window.loadFile(formatPage).catch((error) => {
      logger.error?.("format-window-load-failed", { error });
      if (formatWindow === window) formatWindow = null;
      if (!window.isDestroyed()) window.close();
    });

    return window;
  }

  return {
    open,
    getWindow: () => formatWindow,
  };
}

module.exports = { createFormatWindowController };
