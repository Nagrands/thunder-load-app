const fs = require("fs");
const os = require("os");
const path = require("path");

jest.mock("electron", () => ({
  BrowserWindow: jest.fn(),
  clipboard: { readText: jest.fn(() => "") },
  Tray: jest.fn(),
  Menu: { buildFromTemplate: jest.fn((template) => template) },
  shell: { openPath: jest.fn().mockResolvedValue("") },
  ipcMain: { on: jest.fn() },
  nativeImage: { createFromPath: jest.fn(() => ({ isEmpty: () => false })) },
}));

jest.mock("electron-window-state", () =>
  jest.fn(() => ({
    x: 0,
    y: 0,
    width: 1280,
    height: 740,
    manage: jest.fn(),
  })),
);

jest.mock("../notifications.js", () => ({
  showTrayNotification: jest.fn(),
}));

const {
  buildTrayMenuTemplate,
  buildDockMenuTemplate,
} = require("../window.js");

function createStore(values = {}) {
  return {
    get: jest.fn((key, fallback) =>
      Object.prototype.hasOwnProperty.call(values, key)
        ? values[key]
        : fallback,
    ),
  };
}

function findMenuItem(template, startsWithLabel) {
  return template.find(
    (item) =>
      typeof item?.label === "string" && item.label.startsWith(startsWithLabel),
  );
}

describe("window tray/dock menu templates", () => {
  test("disables 'Последнее видео' when file is missing", () => {
    const template = buildTrayMenuTemplate({
      app: { getName: () => "Thunder Load", getVersion: () => "1.3.6" },
      store: createStore({ lastDownloadedFile: "/tmp/does-not-exist.mp4" }),
      downloadPath: "/tmp",
      mainWindow: {},
      handlers: {},
      paths: {},
    });

    const item = findMenuItem(template, "Последнее видео");
    expect(item).toBeDefined();
    expect(item.enabled).toBe(false);
    expect(item.label).toBe("Последнее видео");
  });

  test("enables 'Последнее видео' and adds file name in label when file exists", () => {
    const filePath = path.join(
      os.tmpdir(),
      `window-menu-last-video-${Date.now()}-very-long-file-name.mp4`,
    );
    fs.writeFileSync(filePath, "ok");

    const template = buildTrayMenuTemplate({
      app: { getName: () => "Thunder Load", getVersion: () => "1.3.6" },
      store: createStore({ lastDownloadedFile: filePath }),
      downloadPath: "/tmp",
      mainWindow: {},
      handlers: {},
      paths: {},
    });

    const item = findMenuItem(template, "Последнее видео");
    expect(item).toBeDefined();
    expect(item.enabled).toBe(true);
    expect(item.label.startsWith("Последнее видео:")).toBe(true);
    expect(item.label).toContain("…");

    fs.unlinkSync(filePath);
  });

  test("disables 'Папка загрузок' when download path is invalid", () => {
    const template = buildTrayMenuTemplate({
      app: { getName: () => "Thunder Load", getVersion: () => "1.3.6" },
      store: createStore({ downloadPath: "/tmp/missing-download-dir" }),
      downloadPath: "/tmp/missing-download-dir",
      mainWindow: {},
      handlers: {},
      paths: {},
    });

    const item = findMenuItem(template, "Папка загрузок");
    expect(item).toBeDefined();
    expect(item.enabled).toBe(false);
  });

  test("settings menu item shows window and opens settings", () => {
    const mainWindow = {
      show: jest.fn(),
      focus: jest.fn(),
      isMinimized: jest.fn(() => false),
      webContents: { send: jest.fn() },
    };
    const app = { isQuitting: false, quit: jest.fn() };

    const template = buildDockMenuTemplate({
      app,
      store: createStore({ downloadPath: os.tmpdir() }),
      downloadPath: os.tmpdir(),
      mainWindow,
    });

    const settingsItem = findMenuItem(template, "Настройки");
    settingsItem.click();

    expect(mainWindow.show).toHaveBeenCalledTimes(1);
    expect(mainWindow.webContents.send).toHaveBeenCalledWith("open-settings");
  });

  test("quit menu item sets isQuitting and calls app.quit", () => {
    const mainWindow = {
      show: jest.fn(),
      focus: jest.fn(),
      isMinimized: jest.fn(() => false),
      webContents: { send: jest.fn() },
    };
    const app = { isQuitting: false, quit: jest.fn() };

    const template = buildDockMenuTemplate({
      app,
      store: createStore({ downloadPath: os.tmpdir() }),
      downloadPath: os.tmpdir(),
      mainWindow,
    });

    const quitItem = findMenuItem(template, "Выйти");
    quitItem.click();

    expect(app.isQuitting).toBe(true);
    expect(app.quit).toHaveBeenCalledTimes(1);
  });

  test("tray and dock keep identical action order", () => {
    const filePath = path.join(
      os.tmpdir(),
      `window-menu-order-${Date.now()}.mp4`,
    );
    fs.writeFileSync(filePath, "ok");
    const downloadDir = os.tmpdir();

    const app = {
      getName: () => "Thunder Load",
      getVersion: () => "1.3.6",
      isQuitting: false,
      quit: jest.fn(),
    };
    const mainWindow = {
      show: jest.fn(),
      focus: jest.fn(),
      isMinimized: jest.fn(() => false),
      webContents: { send: jest.fn() },
    };
    const store = createStore({
      lastDownloadedFile: filePath,
      downloadPath: downloadDir,
    });
    const expected = [
      "Открыть",
      "Последнее видео",
      "Папка загрузок",
      "Настройки",
      "Выйти",
    ];

    const normalizeLabel = (label) =>
      label.startsWith("Последнее видео:") ? "Последнее видео" : label;
    const extractOrderedActions = (template) =>
      template
        .filter((item) => typeof item?.label === "string")
        .map((item) => normalizeLabel(item.label))
        .filter((label) => expected.includes(label));

    const trayActions = extractOrderedActions(
      buildTrayMenuTemplate({
        app,
        store,
        downloadPath: downloadDir,
        mainWindow,
        paths: {},
      }),
    );
    const dockActions = extractOrderedActions(
      buildDockMenuTemplate({
        app,
        store,
        downloadPath: downloadDir,
        mainWindow,
      }),
    );

    expect(trayActions).toEqual(expected);
    expect(dockActions).toEqual(expected);

    fs.unlinkSync(filePath);
  });
});
