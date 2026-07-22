"use strict";

const path = require("path");
const { BrowserWindow, screen } = require("electron");

const PANEL_WIDTH = 320;
const PANEL_HEIGHT = 256;
const PANEL_GAP = 8;
const ACTIONS = new Set([
  "open",
  "last-video",
  "downloads",
  "settings",
  "quit",
]);

function clamp(value, min, max) {
  return Math.min(Math.max(value, min), max);
}

function calculateTrayMenuPosition({ trayBounds, workArea, panelSize }) {
  const width = panelSize.width;
  const height = panelSize.height;
  const workRight = workArea.x + workArea.width;
  const workBottom = workArea.y + workArea.height;
  const trayCenterX = trayBounds.x + trayBounds.width / 2;
  const trayCenterY = trayBounds.y + trayBounds.height / 2;
  const nearHorizontalEdge = trayCenterY <= workArea.y + workArea.height / 2;
  const opensBelow = nearHorizontalEdge && trayBounds.y <= workArea.y + 48;

  const x = clamp(
    Math.round(trayCenterX - width / 2),
    workArea.x + PANEL_GAP,
    workRight - width - PANEL_GAP,
  );
  const preferredY = opensBelow
    ? trayBounds.y + trayBounds.height + PANEL_GAP
    : trayBounds.y - height - PANEL_GAP;
  const y = clamp(
    Math.round(preferredY),
    workArea.y + PANEL_GAP,
    workBottom - height - PANEL_GAP,
  );

  return { x, y };
}

function createWindowsTrayMenuController({
  BrowserWindowClass = BrowserWindow,
  screenApi = screen,
} = {}) {
  let popup = null;
  let tray = null;
  let app = null;
  let getState = () => ({});
  let handlers = {};
  let loadFailed = false;
  let popupReadyPromise = null;

  function configure(options = {}) {
    app = options.app || app;
    tray = options.tray || tray;
    getState = options.getState || getState;
    handlers = options.handlers || handlers;
  }

  function getSafeState() {
    const state = getState() || {};
    return {
      lastVideo: {
        enabled: state.lastVideo?.enabled === true,
        fileName: path
          .basename(String(state.lastVideo?.fileName || ""))
          .slice(0, 512),
      },
      downloads: { enabled: state.downloads?.enabled === true },
    };
  }

  function ownsWebContents(sender) {
    return Boolean(
      popup && !popup.isDestroyed?.() && popup.webContents === sender,
    );
  }

  function hide() {
    try {
      if (popup && !popup.isDestroyed?.()) popup.hide();
    } catch {}
  }

  function createPopup() {
    if (popup && !popup.isDestroyed?.()) return popup;
    if (!app || loadFailed) return null;

    const preload = path.join(__dirname, "windowsTrayMenuPreload.js");
    const html = path.join(app.getAppPath(), "src", "windows-tray-menu.html");
    popup = new BrowserWindowClass({
      width: PANEL_WIDTH,
      height: PANEL_HEIGHT,
      show: false,
      frame: false,
      resizable: false,
      movable: false,
      minimizable: false,
      maximizable: false,
      fullscreenable: false,
      skipTaskbar: true,
      alwaysOnTop: true,
      transparent: true,
      backgroundColor: "#00000000",
      ...(process.platform === "win32"
        ? { backgroundMaterial: "acrylic" }
        : {}),
      webPreferences: {
        preload,
        contextIsolation: true,
        nodeIntegration: false,
        sandbox: true,
        devTools: false,
      },
    });
    popup.setMenuBarVisibility?.(false);
    popup.on?.("blur", hide);
    popup.on?.("closed", () => {
      popup = null;
    });
    popupReadyPromise = popup
      .loadFile(html)
      .then(() => true)
      .catch((error) => {
        loadFailed = true;
        console.error("Failed to load Windows tray panel:", error);
        popup?.destroy?.();
        popup = null;
        return false;
      });
    return popup;
  }

  function positionPopup(target) {
    const trayBounds = tray?.getBounds?.();
    if (!trayBounds || !screenApi?.getDisplayNearestPoint) return false;
    const center = {
      x: Math.round(trayBounds.x + trayBounds.width / 2),
      y: Math.round(trayBounds.y + trayBounds.height / 2),
    };
    const display = screenApi.getDisplayNearestPoint(center);
    const workArea = display?.workArea;
    if (!workArea) return false;
    const position = calculateTrayMenuPosition({
      trayBounds,
      workArea,
      panelSize: { width: PANEL_WIDTH, height: PANEL_HEIGHT },
    });
    target.setPosition?.(position.x, position.y, false);
    return true;
  }

  async function toggle() {
    if (process.platform !== "win32") return false;
    const target = createPopup();
    if (!target || loadFailed) return false;
    if (!(await popupReadyPromise)) return false;
    if (target.isVisible?.()) {
      hide();
      return true;
    }
    positionPopup(target);
    target.show?.();
    target.focus?.();
    return true;
  }

  async function performAction(action) {
    if (!ACTIONS.has(action)) {
      return { success: false, error: "INVALID_TRAY_ACTION" };
    }
    const state = getSafeState();
    if (action === "last-video" && !state.lastVideo.enabled) {
      return { success: false, error: "TRAY_ACTION_UNAVAILABLE" };
    }
    if (action === "downloads" && !state.downloads.enabled) {
      return { success: false, error: "TRAY_ACTION_UNAVAILABLE" };
    }
    const handler = handlers[action];
    if (typeof handler !== "function") {
      return { success: false, error: "TRAY_ACTION_UNAVAILABLE" };
    }
    try {
      await handler();
      hide();
      return { success: true, data: null };
    } catch (error) {
      return {
        success: false,
        error: String(error?.message || "TRAY_ACTION_FAILED"),
      };
    }
  }

  function dispose() {
    try {
      popup?.destroy?.();
    } catch {}
    popup = null;
    tray = null;
    app = null;
    getState = () => ({});
    handlers = {};
    loadFailed = false;
    popupReadyPromise = null;
  }

  return {
    configure,
    dispose,
    getSafeState,
    hide,
    ownsWebContents,
    performAction,
    toggle,
  };
}

const windowsTrayMenuController = createWindowsTrayMenuController();

module.exports = {
  ACTIONS,
  PANEL_HEIGHT,
  PANEL_WIDTH,
  calculateTrayMenuPosition,
  createWindowsTrayMenuController,
  windowsTrayMenuController,
};
