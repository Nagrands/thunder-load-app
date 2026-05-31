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
  ipcMain,
  nativeImage,
} = require("electron");
const windowStateKeeper = require("electron-window-state");
const {
  resolveIconPathFrom,
  resolveIconPathFromAppDir,
} = require("./iconPaths");
const { showTrayNotification } = require("./notifications.js");

let windowTray = null;
let appMenu = null;

function isMacPlatform() {
  return process.platform === "darwin";
}

// Helper to load a NativeImage from a list of candidate paths
function loadNativeImageFrom(paths) {
  for (const p of paths) {
    if (fs.existsSync(p)) {
      const img = nativeImage.createFromPath(p);
      if (!img.isEmpty()) return img;
      console.warn("Icon exists but failed to load (empty):", p);
    }
  }
  console.warn("No suitable icon found among:", paths);
  return null;
}

function loadTrayImage(iconPath, { template = false } = {}) {
  if (!fs.existsSync(iconPath)) {
    console.warn("Tray icon not found:", iconPath);
    return null;
  }

  const trayImage = nativeImage.createFromPath(iconPath);
  if (!trayImage || trayImage.isEmpty()) {
    console.warn("Tray icon exists but failed to load:", iconPath);
    return null;
  }

  if (template && typeof trayImage.setTemplateImage === "function") {
    trayImage.setTemplateImage(true);
  }

  return trayImage;
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

  const showMainWindow = () => {
    try {
      if (mainWindow?.isMinimized?.()) {
        mainWindow.restore?.();
      }
      mainWindow?.show?.();
      mainWindow?.focus?.();
    } catch {}
  };

  return {
    open: () => {
      showMainWindow();
    },
    openSettings: () => {
      showMainWindow();
      mainWindow?.webContents?.send?.("open-settings");
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
}) {
  const menuHandlers =
    handlers || createMenuHandlers({ app, mainWindow, notifications: {} });
  const lastVideo = buildLastVideoState(store);
  const downloads = buildDownloadFolderState(store, downloadPath);

  return [
    {
      label: "Открыть",
      click: () => menuHandlers.open(),
    },
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
) {
  const mainWindowState = windowStateKeeper({
    defaultWidth: 1280,
    defaultHeight: 740,
  });

  const preloadPath = path.join(__dirname, "../preload.js");

  const baseAssetsPath = app.isPackaged
    ? process.resourcesPath
    : app.getAppPath();
  const macIcns = resolveIconPathFrom(baseAssetsPath, "APP_ICON_ICNS");
  const macPng = resolveIconPathFrom(baseAssetsPath, "APP_ICON_PNG");
  const winIco = resolveIconPathFrom(baseAssetsPath, "APP_ICON_ICO");

  // В dev Electron часто не подхватывает .icns → используем PNG; в prod предпочитаем .icns
  const bwIconCandidates =
    process.platform === "darwin"
      ? app.isPackaged
        ? [macIcns, macPng]
        : [macPng]
      : [winIco, macPng];

  let iconPath = bwIconCandidates.find((p) => fs.existsSync(p)) || null;
  console.log("icon candidates:", bwIconCandidates);
  console.log("chosen icon:", iconPath);

  const mainWindow = new BrowserWindow({
    titleBarStyle: "hiddenInset",
    x: mainWindowState.x,
    y: mainWindowState.y,
    minWidth: 890,
    minHeight: 540,
    width: mainWindowState.width,
    height: mainWindowState.height,
    icon: iconPath,
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
    },
  });

  mainWindow.once("ready-to-show", () => {
    mainWindow.show(); // обязательно вызываем show()
    const minimizeOnLaunch = store.get("minimizeOnLaunch", false);
    if (minimizeOnLaunch) {
      mainWindow.minimize(); // затем сворачиваем
    }
  });

  mainWindowState.manage(mainWindow);

  mainWindow.loadFile(path.join(__dirname, "../../index.html")).catch((err) => {
    console.error("Ошибка при загрузке файла index.html:", err);
  });

  mainWindow.setMenuBarVisibility(false);

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
    } else {
      app.quit();
    }
  });

  mainWindow.on("show", () => {
    store.set("isCloseNotificationShown", false);
  });

  ipcMain.on("window-minimize", () => {
    mainWindow.minimize();
  });

  ipcMain.on("window-close", () => {
    mainWindow.close();
  });

  try {
    createTray(mainWindow, app, store, downloadPath);
  } catch (err) {
    console.error("❌ Failed to create tray:", err);
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
    console.log("dock icon candidates:", dockIconCandidates);
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
    ipcMain.on("download-finished", refreshDockMenu);
  }
  return mainWindow;
}

function createTray(mainWindow, app, store, downloadPath) {
  if (windowTray) return;

  const isMac = process.platform === "darwin";
  const trayIconPath = resolveIconPathFromAppDir(
    isMac ? "TRAY_ICON_MACOS_TEMPLATE" : "TRAY_ICON_WINDOWS",
  );
  const iconLoadingPath = resolveIconPathFromAppDir("TRAY_ICON_LOADING");
  const trayImage = isMac
    ? loadTrayImage(trayIconPath, { template: true })
    : null;
  const trayMenuPaths = {
    trayIconPath,
    videoIconPath: resolveIconPathFromAppDir("MENU_VIDEO"),
    folderIconPath: resolveIconPathFromAppDir("MENU_OPEN_FOLDER"),
    settingsIconPath: resolveIconPathFromAppDir("MENU_SETTINGS"),
    logoutIconPath: resolveIconPathFromAppDir("MENU_LOGOUT"),
  };

  if (isMac ? !trayImage : !fs.existsSync(trayIconPath)) {
    return;
  }
  windowTray = new Tray(trayImage || trayIconPath);

  const menuHandlers = createMenuHandlers({
    app,
    mainWindow,
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
    windowTray.setContextMenu(contextMenu);
  };
  const handleTrayRefreshRequest = () => {
    refreshTrayMenu();
  };

  windowTray.setToolTip("Thunder Load");
  refreshTrayMenu();
  app?.on?.("thunder-load:tray-refresh", handleTrayRefreshRequest);

  windowTray.on("click", () => {
    if (isMac) {
      refreshTrayMenu();
      windowTray.popUpContextMenu();
      return;
    }
    toggleFromTray(mainWindow, menuHandlers.open);
  });

  windowTray.on("right-click", () => {
    refreshTrayMenu();
    windowTray.popUpContextMenu();
  });

  windowTray.on("double-click", () => {
    menuHandlers.open();
  });

  ipcMain.on("download-started", () => {
    if (!isMac && fs.existsSync(iconLoadingPath)) {
      windowTray.setImage(iconLoadingPath);
    }
  });

  ipcMain.on("download-finished", () => {
    if (isMac && trayImage) {
      windowTray.setImage(trayImage);
    } else if (fs.existsSync(trayIconPath)) {
      windowTray.setImage(trayIconPath);
    }
    refreshTrayMenu();
  });
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
        { id: "view-reload", role: "reload" },
        { id: "view-force-reload", role: "forcereload" },
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

function setReloadMenuEnabled(enabled) {
  const next = Boolean(enabled);
  ["view-reload", "view-force-reload"].forEach((id) => {
    const item = appMenu?.getMenuItemById?.(id);
    if (item) item.enabled = next;
  });
}

function resetWindowStateForTests() {
  windowTray = null;
}

module.exports = {
  createWindow,
  buildTrayMenuTemplate,
  buildDockMenuTemplate,
  setReloadMenuEnabled,
  resetWindowStateForTests,
};
