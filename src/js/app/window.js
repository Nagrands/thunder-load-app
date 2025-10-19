// window.js (src/js/app/window.js)

const path = require("path");
const fs = require("fs");
const {
  BrowserWindow,
  clipboard,
  Tray,
  Menu,
  shell,
  Notification,
  ipcMain,
  nativeImage,
} = require("electron");
const windowStateKeeper = require("electron-window-state");
const { showTrayNotification } = require("./notifications.js");

let windowTray = null;
let isQuitting = false;
const isMac = process.platform === "darwin";

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

function createWindow(
  isDev,
  app,
  store,
  downloadPath,
  getAppVersion,
  ytDlpPath,
  ffmpegPath,
  ffprobePath,
  fileExists,
) {
  const mainWindowState = windowStateKeeper({
    defaultWidth: 1280,
    defaultHeight: 740,
  });

  const preloadPath = path.join(__dirname, "../preload.js");

  const baseAssetsPath = app.isPackaged
    ? process.resourcesPath
    : app.getAppPath();
  const macIcns = path.join(
    baseAssetsPath,
    "assets",
    "icons",
    "macOS",
    "icon.icns",
  );
  const macPng = path.join(baseAssetsPath, "assets", "icons", "icon.png");
  const winIco = path.join(baseAssetsPath, "assets", "icons", "icon.ico");

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

  mainWindow.on("close", (event) => {
    const minimizeInsteadOfClose = store.get("minimizeInsteadOfClose", false);
    const showCloseNotification = store.get("closeNotification", true);

    if (!app.isQuiting && minimizeInsteadOfClose) {
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
      isQuitting = true;
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
    isQuitting = true;
    mainWindow.close();
  });

  try {
    createTray(mainWindow, app, store, downloadPath);
  } catch (err) {
    console.error("❌ Failed to create tray:", err);
  }

  if (isMac) {
    createAppMenu(isDev, app);

    // Set Dock icon using candidate/fallback approach
    const dockIconCandidates = app.isPackaged
      ? [
          path.join(baseAssetsPath, "assets", "icons", "macOS", "icon.icns"),
          path.join(baseAssetsPath, "assets", "icons", "icon.png"),
        ]
      : [path.join(baseAssetsPath, "assets", "icons", "icon.png")];
    const dockImg = loadNativeImageFrom(dockIconCandidates);
    console.log("dock icon candidates:", dockIconCandidates);
    if (dockImg) {
      app.dock.setIcon(dockImg);
    }

    const dockMenu = Menu.buildFromTemplate([
      {
        label: "Открыть",
        click: () => mainWindow.show(),
      },
      {
        label: "Последнее видео",
        click: async () => {
          const lastPath = store.get("lastDownloadedFile");
          if (lastPath) {
            try {
              await fs.promises.access(lastPath, fs.constants.F_OK);
              await shell.openPath(lastPath);
            } catch {
              showTrayNotification("Видео не найдено или было удалено.");
            }
          } else {
            showTrayNotification("Нет информации о последнем видео.");
          }
        },
      },
      {
        label: "Папка загрузок",
        click: async () => {
          const pathToOpen = store.get("downloadPath", downloadPath);
          if (pathToOpen) {
            await shell.openPath(pathToOpen);
          } else {
            showTrayNotification("Папка загрузок не найдена.");
          }
        },
      },
      {
        label: "Настройки",
        click: () => {
          mainWindow.show();
          mainWindow.webContents.send("open-settings");
        },
      },
    ]);

    app.dock.setMenu(dockMenu);
  }
  return mainWindow;
}

function createTray(mainWindow, app, store, downloadPath) {
  if (windowTray) return;

  const isMac = process.platform === "darwin";
  const trayIconPath = path.join(
    __dirname,
    isMac
      ? "../../../assets/icons/macOS/trayTemplate.png"
      : "../../../assets/icons/tray-logo.png",
  );
  const iconLoadingPath = path.join(
    __dirname,
    "../../../assets/icons/tray-loading.png",
  );

  if (!fs.existsSync(trayIconPath)) {
    console.warn("Tray icon not found:", trayIconPath);
    return;
  }
  windowTray = new Tray(trayIconPath);

  const name = app.getName();
  const appVer = app.getVersion();

  const contextMenu = Menu.buildFromTemplate([
    {
      label: `${name} ${appVer}`,
      enabled: false,
      icon: trayIconPath,
    },
    { type: "separator" },
    {
      label: "Открыть",
      click: () => mainWindow.show(),
    },
    { type: "separator" },
    {
      label: "Последнее видео",
      icon: path.join(__dirname, "../../../assets/icons/video.png"),
      click: async () => {
        const lastPath = store.get("lastDownloadedFile");
        if (lastPath) {
          try {
            await fs.promises.access(lastPath, fs.constants.F_OK);
            await shell.openPath(lastPath);
          } catch {
            showTrayNotification("Видео не найдено или было удалено.");
          }
        } else {
          showTrayNotification("Нет информации о последнем видео.");
        }
      },
    },
    {
      label: "Папка загрузок",
      icon: path.join(__dirname, "../../../assets/icons/open-folder.png"),
      click: async () => {
        const pathToOpen = store.get("downloadPath", downloadPath);
        if (pathToOpen) {
          await shell.openPath(pathToOpen);
        } else {
          showTrayNotification("Папка загрузок не найдена.");
        }
      },
    },
    { type: "separator" },
    {
      label: "Настройки",
      icon: path.join(__dirname, "../../../assets/icons/settings.png"),
      click: () => {
        mainWindow.show();
        mainWindow.webContents.send("open-settings");
      },
    },
    { type: "separator" },
    {
      label: "Выйти",
      icon: path.join(__dirname, "../../../assets/icons/logout.png"),
      click: () => {
        app.isQuiting = true;
        app.quit();
      },
    },
  ]);

  windowTray.setToolTip("Thunder Load");
  windowTray.setContextMenu(contextMenu);

  windowTray.on("click", () => {
    mainWindow.isVisible() ? mainWindow.hide() : mainWindow.show();
  });

  windowTray.on("right-click", () => {
    windowTray.popUpContextMenu();
  });

  windowTray.on("double-click", () => {
    mainWindow.show();
  });

  ipcMain.on("download-started", () => {
    if (fs.existsSync(iconLoadingPath)) {
      windowTray.setImage(iconLoadingPath);
    }
  });

  ipcMain.on("download-finished", () => {
    if (fs.existsSync(trayIconPath)) {
      windowTray.setImage(trayIconPath);
    }
  });
}

function createAppMenu(isDev, app) {
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
        { role: "reload" },
        { role: "forcereload" },
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

  const menu = Menu.buildFromTemplate(template);
  Menu.setApplicationMenu(menu);
}

module.exports = { createWindow };
