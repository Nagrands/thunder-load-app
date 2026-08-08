// window.js (src/js/app/window.js)

const path = require("path");
const fs = require("fs");
const {
  BrowserWindow,
  clipboard,
  dialog,
  Tray,
  Menu,
  shell,
  nativeImage,
} = require("electron");
const windowStateKeeper = require("electron-window-state");
const log = require("electron-log");
const { resolveIconPathFrom } = require("./iconPaths");
const { showTrayNotification } = require("./notifications.js");
const { trayIconController } = require("./trayIconController.js");
const { windowsTrayMenuController } = require("./windowsTrayMenu.js");

let windowTray = null;
let appMenu = null;
let dockMediaState = null;
let activeMainWindow = null;
let trayRefreshApp = null;
let trayRefreshHandler = null;
let windowLogger = log;

function setDockMediaState(snapshot) {
  const title = String(snapshot?.track?.title || "")
    .trim()
    .slice(0, 1024);
  dockMediaState = title
    ? {
        track: { title },
        isPlaying: snapshot?.isPlaying === true,
        canNext: snapshot?.canNext !== false,
        canPrevious: snapshot?.canPrevious !== false,
      }
    : null;
}

function isMacPlatform() {
  return process.platform === "darwin";
}

// Helper to load a NativeImage from a list of candidate paths
function loadNativeImageFrom(paths) {
  for (const p of paths) {
    if (fs.existsSync(p)) {
      const img = nativeImage.createFromPath(p);
      if (!img.isEmpty()) return img;
      windowLogger.warning?.("window-icon-empty", { path: p });
    }
  }
  windowLogger.warning?.("window-icon-not-found", { paths });
  return null;
}

function trimMenuText(text, maxLength = 44) {
  const value = String(text || "").trim();
  if (!value) return "";
  if (value.length <= maxLength) return value;
  return `${value.slice(0, Math.max(1, maxLength - 1)).trimEnd()}…`;
}

function buildLastVideoState(store) {
  const lastPath = String(store?.get?.("lastDownloadedFile") || "").trim();
  if (!lastPath || !fs.existsSync(lastPath)) {
    return {
      exists: false,
      path: "",
      fileName: "",
      label: "Последнее видео",
    };
  }
  const fileName = path.basename(lastPath);
  return {
    exists: true,
    path: lastPath,
    fileName,
    label: `Последнее видео: ${trimMenuText(fileName)}`,
  };
}

function buildDownloadFolderState(store, fallbackDownloadPath) {
  const resolvedPath = String(
    store?.get?.("downloadPath", fallbackDownloadPath) || "",
  ).trim();
  return {
    exists: !!resolvedPath && fs.existsSync(resolvedPath),
    path: resolvedPath,
    label: "Папка загрузок",
  };
}

function createMenuHandlers({ app, mainWindow, notifications = {} }) {
  const notify = notifications.showTrayNotification || (() => {});
  const resolveMainWindow = () =>
    typeof mainWindow === "function" ? mainWindow() : mainWindow;

  const showMainWindow = () => {
    try {
      const target = resolveMainWindow();
      if (target?.isMinimized?.()) {
        target.restore?.();
      }
      target?.show?.();
      target?.focus?.();
    } catch {}
  };

  return {
    open: () => {
      showMainWindow();
    },
    openSettings: () => {
      showMainWindow();
      resolveMainWindow()?.webContents?.send?.("open-settings");
    },
    mediaCommand: (command) => {
      if (!["play", "pause", "next", "previous"].includes(command)) return;
      resolveMainWindow()?.webContents?.send?.("now-playing:media-command", {
        command,
      });
    },
    openLastVideo: async (lastPath) => {
      if (!lastPath || !fs.existsSync(lastPath)) return;
      const result = await shell.openPath(lastPath);
      if (result) {
        notify("Не удалось открыть последнее видео.");
      }
    },
    openDownloadsFolder: async (downloadsPath) => {
      if (!downloadsPath || !fs.existsSync(downloadsPath)) return;
      const result = await shell.openPath(downloadsPath);
      if (result) {
        notify("Не удалось открыть папку загрузок.");
      }
    },
    quit: () => {
      app.isQuitting = true;
      app.quit();
    },
  };
}

function toggleFromTray(mainWindow, openMainWindow) {
  if (mainWindow?.isVisible?.()) {
    mainWindow?.hide?.();
    return;
  }
  openMainWindow();
}

function buildDockMenuTemplate({
  app,
  store,
  downloadPath,
  mainWindow,
  handlers,
  mediaState = dockMediaState,
}) {
  const menuHandlers =
    handlers || createMenuHandlers({ app, mainWindow, notifications: {} });
  const lastVideo = buildLastVideoState(store);
  const downloads = buildDownloadFolderState(store, downloadPath);

  const mediaItems = mediaState?.track
    ? [
        { type: "separator" },
        {
          label: `Сейчас играет: ${trimMenuText(mediaState.track.title, 36)}`,
          enabled: false,
        },
        {
          label: mediaState.isPlaying ? "Пауза" : "Воспроизвести",
          click: () =>
            menuHandlers.mediaCommand(mediaState.isPlaying ? "pause" : "play"),
        },
        {
          label: "Предыдущий",
          enabled: mediaState.canPrevious !== false,
          click: () => menuHandlers.mediaCommand("previous"),
        },
        {
          label: "Следующий",
          enabled: mediaState.canNext !== false,
          click: () => menuHandlers.mediaCommand("next"),
        },
      ]
    : [];

  return [
    {
      label: "Открыть",
      click: () => menuHandlers.open(),
    },
    ...mediaItems,
    {
      label: lastVideo.label,
      enabled: lastVideo.exists,
      click: () => menuHandlers.openLastVideo(lastVideo.path),
    },
    {
      label: downloads.label,
      enabled: downloads.exists,
      click: () => menuHandlers.openDownloadsFolder(downloads.path),
    },
    {
      label: "Настройки",
      click: () => menuHandlers.openSettings(),
    },
    { type: "separator" },
    {
      label: "Выйти",
      click: () => menuHandlers.quit(),
    },
  ];
}

function buildTrayMenuTemplate({
  app,
  store,
  downloadPath,
  mainWindow,
  handlers,
  paths = {},
}) {
  const menuHandlers =
    handlers ||
    createMenuHandlers({
      app,
      mainWindow,
      notifications: { showTrayNotification },
    });
  const isMacPlatform = process.platform === "darwin";
  const lastVideo = buildLastVideoState(store);
  const downloads = buildDownloadFolderState(store, downloadPath);

  const maybeIcon = (iconPath) =>
    !isMacPlatform && iconPath ? { icon: iconPath } : {};

  return [
    {
      label: `${app.getName()} ${app.getVersion()}`,
      enabled: false,
      ...(paths.trayIconPath ? { icon: paths.trayIconPath } : {}),
    },
    { type: "separator" },
    {
      label: "Открыть",
      click: () => menuHandlers.open(),
    },
    { type: "separator" },
    {
      label: lastVideo.label,
      enabled: lastVideo.exists,
      ...maybeIcon(paths.videoIconPath),
      click: () => menuHandlers.openLastVideo(lastVideo.path),
    },
    {
      label: downloads.label,
      enabled: downloads.exists,
      ...maybeIcon(paths.folderIconPath),
      click: () => menuHandlers.openDownloadsFolder(downloads.path),
    },
    { type: "separator" },
    {
      label: "Настройки",
      ...maybeIcon(paths.settingsIconPath),
      click: () => menuHandlers.openSettings(),
    },
    { type: "separator" },
    {
      label: "Выйти",
      ...maybeIcon(paths.logoutIconPath),
      click: () => menuHandlers.quit(),
    },
  ];
}

function createWindow(
  isDev,
  app,
  store,
  downloadPath,
  _getAppVersion,
  _ytDlpPath,
  _ffmpegPath,
  _ffprobePath,
  _fileExists,
  getDownloadActivity = () => false,
  logger = log,
) {
  windowLogger = logger || log;
  const mainWindowState = windowStateKeeper({
    defaultWidth: 1280,
    defaultHeight: 740,
  });

  const preloadPath = path.join(__dirname, "../preload.js");

  const baseAssetsPath = app.getAppPath();
  const macIcns = resolveIconPathFrom(baseAssetsPath, "APP_ICON_ICNS");
  const macPng = resolveIconPathFrom(baseAssetsPath, "APP_ICON_PNG");
  const winIco = resolveIconPathFrom(baseAssetsPath, "APP_ICON_ICO");
  const packagedWinIco = path.join(
    process.resourcesPath || path.dirname(baseAssetsPath),
    "app-icon.ico",
  );

  // В dev Electron часто не подхватывает .icns → используем PNG; в prod предпочитаем .icns.
  // Windows всегда получает Thunder ICO явно, включая packaged-окно.
  const bwIconCandidates =
    process.platform === "darwin"
      ? app.isPackaged
        ? [macIcns, macPng]
        : [macPng]
      : app.isPackaged && process.platform === "win32"
        ? [packagedWinIco, winIco, macPng]
        : [winIco, macPng];

  const iconPath = bwIconCandidates.find((p) => fs.existsSync(p)) || null;
  windowLogger.debug?.("window-icon-selected", {
    candidates: bwIconCandidates,
    iconPath,
  });

  const mainWindow = new BrowserWindow({
    titleBarStyle: "hiddenInset",
    x: mainWindowState.x,
    y: mainWindowState.y,
    minWidth: 890,
    minHeight: 540,
    width: mainWindowState.width,
    height: mainWindowState.height,
    ...(iconPath ? { icon: iconPath } : {}),
    backgroundColor: "#1e1e1e",
    frame: false,
    show: false,
    webPreferences: {
      preload: preloadPath,
      contextIsolation: true,
      enableRemoteModule: false,
      nodeIntegration: false,
      sandbox: true,
      devTools: isDev,
      enableBlinkFeatures: "AudioVideoTracks",
    },
  });
  activeMainWindow = mainWindow;

  mainWindow.once("ready-to-show", () => {
    mainWindow.show(); // обязательно вызываем show()
    const minimizeOnLaunch = store.get("minimizeOnLaunch", false);
    if (minimizeOnLaunch) {
      mainWindow.minimize(); // затем сворачиваем
    }
  });

  mainWindowState.manage(mainWindow);

  mainWindow.loadFile(path.join(__dirname, "../../index.html")).catch((err) => {
    windowLogger.error?.("window-load-failed", { error: err });
  });

  mainWindow.setMenuBarVisibility(false);

  mainWindow.webContents.on?.("before-input-event", (event, input) => {
    const key = String(input?.key || "").toLowerCase();
    const primary = isMacPlatform() ? input?.meta : input?.control;
    if ((primary && key === "r") || key === "f5") {
      event.preventDefault();
    }
  });

  mainWindow.on("resize", () => {
    const [width, height] = mainWindow.getSize();
    const [minWidth, minHeight] = mainWindow.getMinimumSize();
    if (width < minWidth || height < minHeight) {
      mainWindow.setSize(
        Math.max(width, minWidth),
        Math.max(height, minHeight),
      );
    }
  });

  mainWindow.on("focus", () => {
    const clipboardContent = clipboard.readText();
    mainWindow.webContents.send("window-focused", clipboardContent);
  });

  let activeDownloadCloseConfirmed = false;
  const hasActiveDownload = () => {
    try {
      return Boolean(getDownloadActivity?.());
    } catch {
      return false;
    }
  };

  const confirmCloseDuringDownload = () => {
    const choice = dialog.showMessageBoxSync(mainWindow, {
      type: "warning",
      buttons: ["Продолжить загрузку", "Закрыть"],
      defaultId: 0,
      cancelId: 0,
      title: "Идёт загрузка",
      message: "Сейчас выполняется загрузка.",
      detail:
        "Если закрыть приложение сейчас, активная загрузка будет остановлена. Дождитесь завершения или отмените загрузку вручную.",
      noLink: true,
    });
    return choice === 1;
  };

  mainWindow.on("close", (event) => {
    const minimizeInsteadOfClose = store.get("minimizeInsteadOfClose", false);
    const showCloseNotification = store.get("closeNotification", true);

    if (!activeDownloadCloseConfirmed && hasActiveDownload()) {
      if (!confirmCloseDuringDownload()) {
        event.preventDefault();
        app.isQuitting = false;
        return;
      }
      activeDownloadCloseConfirmed = true;
    }

    if (!app.isQuitting && minimizeInsteadOfClose) {
      event.preventDefault();
      mainWindow.hide();
      if (
        showCloseNotification &&
        !store.get("isCloseNotificationShown", false)
      ) {
        showTrayNotification(
          "Приложение свернуто в трей. Нажмите по иконке для возврата. Это уведомление можно отключить в настройках.",
        );
        store.set("isCloseNotificationShown", true);
      }
    } else if (!app.isQuitting) {
      app.quit();
    }
  });

  mainWindow.on("show", () => {
    store.set("isCloseNotificationShown", false);
  });

  try {
    createTray(mainWindow, app, store, downloadPath);
  } catch (err) {
    windowLogger.error?.("tray-create-failed", { error: err });
  }

  if (isMacPlatform()) {
    createAppMenu(isDev, app);

    // Set Dock icon using candidate/fallback approach
    const dockIconCandidates = app.isPackaged
      ? [
          resolveIconPathFrom(baseAssetsPath, "APP_ICON_ICNS"),
          resolveIconPathFrom(baseAssetsPath, "APP_ICON_PNG"),
        ]
      : [resolveIconPathFrom(baseAssetsPath, "APP_ICON_PNG")];
    const dockImg = loadNativeImageFrom(dockIconCandidates);
    windowLogger.debug?.("dock-icon-candidates", {
      candidates: dockIconCandidates,
    });
    if (dockImg) {
      app.dock.setIcon(dockImg);
    }

    const menuHandlers = createMenuHandlers({
      app,
      mainWindow,
      notifications: { showTrayNotification },
    });
    const refreshDockMenu = () => {
      const dockMenu = Menu.buildFromTemplate(
        buildDockMenuTemplate({
          app,
          store,
          downloadPath,
          mainWindow,
          handlers: menuHandlers,
        }),
      );
      app.dock.setMenu(dockMenu);
    };

    refreshDockMenu();
    const refreshPlayerDockMenu = () => {
      refreshDockMenu();
    };
    app.on("thunder-load:dock-player-refresh", refreshPlayerDockMenu);
    mainWindow.once("closed", () => {
      app.removeListener(
        "thunder-load:dock-player-refresh",
        refreshPlayerDockMenu,
      );
      dockMediaState = null;
      if (activeMainWindow === mainWindow) activeMainWindow = null;
    });
  }
  return mainWindow;
}

function createTray(mainWindow, app, store, downloadPath) {
  if (windowTray) return;

  const isMac = process.platform === "darwin";
  const trayIconPath = resolveIconPathFrom(
    app.getAppPath(),
    isMac ? "TRAY_ICON_MACOS_TEMPLATE" : "TRAY_ICON_WINDOWS",
  );
  trayIconController.configure(app, process.platform);
  const trayImage = trayIconController.loadImage("idle");
  const trayMenuPaths = {
    trayIconPath,
    videoIconPath: resolveIconPathFrom(app.getAppPath(), "MENU_VIDEO"),
    folderIconPath: resolveIconPathFrom(app.getAppPath(), "MENU_OPEN_FOLDER"),
    settingsIconPath: resolveIconPathFrom(app.getAppPath(), "MENU_SETTINGS"),
    logoutIconPath: resolveIconPathFrom(app.getAppPath(), "MENU_LOGOUT"),
  };

  if (!trayImage) return;
  windowTray = new Tray(trayImage);
  trayIconController.init(windowTray);

  const menuHandlers = createMenuHandlers({
    app,
    mainWindow: () => activeMainWindow,
    notifications: { showTrayNotification },
  });
  const refreshTrayMenu = () => {
    const contextMenu = Menu.buildFromTemplate(
      buildTrayMenuTemplate({
        app,
        store,
        downloadPath,
        mainWindow,
        handlers: menuHandlers,
        paths: trayMenuPaths,
      }),
    );
    if (isMac) windowTray.setContextMenu(contextMenu);
    return contextMenu;
  };
  let fallbackContextMenu = refreshTrayMenu();
  const handleTrayRefreshRequest = () => {
    fallbackContextMenu = refreshTrayMenu();
  };

  windowsTrayMenuController.configure({
    app,
    tray: windowTray,
    logger: windowLogger,
    getState: () => {
      const lastVideo = buildLastVideoState(store);
      const downloads = buildDownloadFolderState(store, downloadPath);
      return {
        lastVideo: {
          enabled: lastVideo.exists,
          fileName: lastVideo.fileName,
        },
        downloads: { enabled: downloads.exists },
      };
    },
    handlers: {
      open: menuHandlers.open,
      "last-video": () => {
        const state = buildLastVideoState(store);
        return menuHandlers.openLastVideo(state.path);
      },
      downloads: () => {
        const state = buildDownloadFolderState(store, downloadPath);
        return menuHandlers.openDownloadsFolder(state.path);
      },
      settings: menuHandlers.openSettings,
      quit: menuHandlers.quit,
    },
  });

  windowTray.setToolTip("Thunder");
  trayRefreshApp = app;
  trayRefreshHandler = handleTrayRefreshRequest;
  app?.on?.("thunder-load:tray-refresh", handleTrayRefreshRequest);

  windowTray.on("click", () => {
    if (isMac) {
      refreshTrayMenu();
      windowTray.popUpContextMenu();
      return;
    }
    toggleFromTray(activeMainWindow, menuHandlers.open);
  });

  windowTray.on("right-click", async () => {
    fallbackContextMenu = refreshTrayMenu();
    try {
      const handled = await windowsTrayMenuController.toggle();
      if (handled) return;
    } catch (error) {
      windowLogger.error?.("windows-tray-panel-open-failed", { error });
    }
    windowTray.popUpContextMenu(fallbackContextMenu);
  });

  windowTray.on("double-click", () => {
    menuHandlers.open();
  });
}

function disposeWindowRuntime() {
  if (trayRefreshApp && trayRefreshHandler) {
    trayRefreshApp.removeListener?.(
      "thunder-load:tray-refresh",
      trayRefreshHandler,
    );
  }
  trayRefreshApp = null;
  trayRefreshHandler = null;
  windowsTrayMenuController.dispose();
  try {
    windowTray?.destroy?.();
  } catch (error) {
    windowLogger.warning?.("tray-destroy-failed", { error });
  }
  windowTray = null;
  activeMainWindow = null;
  dockMediaState = null;
  trayIconController.reset();
}

function createAppMenu(isDev, app) {
  const isMac = isMacPlatform();
  const template = [
    ...(isMac
      ? [
          {
            label: app.name,
            submenu: [
              { role: "about" },
              { type: "separator" },
              { role: "services" },
              { type: "separator" },
              { role: "hide" },
              { role: "hideothers" },
              { role: "unhide" },
              { type: "separator" },
              { role: "quit" },
            ],
          },
        ]
      : []),
    {
      label: "Файл",
      submenu: [isMac ? { role: "close" } : { role: "quit" }],
    },
    {
      label: "Правка",
      submenu: [
        { role: "undo" },
        { role: "redo" },
        { type: "separator" },
        { role: "cut" },
        { role: "copy" },
        { role: "paste" },
        ...(isMac
          ? [
              { role: "pasteAndMatchStyle" },
              { role: "delete" },
              { role: "selectAll" },
            ]
          : [{ role: "delete" }, { role: "selectAll" }]),
      ],
    },
    {
      label: "Вид",
      submenu: [
        { role: "toggledevtools", visible: isDev },
        { type: "separator" },
        { role: "resetzoom" },
        { role: "zoomin" },
        { role: "zoomout" },
        { type: "separator" },
        { role: "togglefullscreen" },
      ],
    },
    {
      role: "help",
      submenu: [
        {
          label: "GitHub проекта",
          click: async () => {
            const { shell } = require("electron");
            await shell.openExternal(
              "https://github.com/Nagrands/thunder-load-app",
            );
          },
        },
      ],
    },
  ];

  appMenu = Menu.buildFromTemplate(template);
  Menu.setApplicationMenu(appMenu);
}

function resetWindowStateForTests() {
  disposeWindowRuntime();
}

module.exports = {
  createWindow,
  buildTrayMenuTemplate,
  buildDockMenuTemplate,
  setDockMediaState,
  disposeWindowRuntime,
  resetWindowStateForTests,
};
