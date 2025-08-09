// src\js\app\wgUnlock.js

// main-process: WireGuard configuration & UDP sender
const { app, ipcMain, BrowserWindow } = require("electron");
const { promises: fs } = require("fs");
const path = require("path");
const dgram = require("dgram");

// Путь к файлу конфигурации
const confPath = path.join(app.getPath("userData"), "wireguard.conf");

/**
 * Обработка ситуации, когда порт уже используется
 */
async function handlePortInUse(lPort) {
  try {
    const cfg = await readConfig();
    cfg.autosend = false;
    await writeConfig(cfg);

    const win = BrowserWindow.getAllWindows()[0];
    win?.webContents.send(
      "toast",
      `Порт ${lPort} уже используется. <br>Автоотправка отключена.`,
    );
  } catch (e) {
    console.warn("Ошибка при отключении autosend:", e);
  }
}

/**
 * Читает конфиг-файл и возвращает объект с настройками
 */
async function readConfig() {
  try {
    const raw = await fs.readFile(confPath, "utf-8");
    return raw
      .split(/\r?\n/)
      .filter((line) => line.includes("=") && !line.startsWith("["))
      .map((line) => line.split("=").map((s) => s.trim()))
      .reduce(
        (acc, [key, val]) => ({
          ...acc,
          [key]: parseValue(val),
        }),
        {},
      );
  } catch {
    return { ...DEFAULTS };
  }
}

/**
 * Записывает переданный объект настроек в конфиг-файл
 */
async function writeConfig(data) {
  const lines = [
    "[WireGuard]",
    ...Object.entries(data).map(([key, val]) => `${key} = ${val}`),
  ];
  await fs.writeFile(confPath, lines.join("\n"), "utf-8");
}

/**
 * Отправляет UDP‑пакет на указанный адрес
 */
function sendUdp({ ip, rPort, lPort, msg }) {
  return new Promise((resolve, reject) => {
    const socket = dgram.createSocket("udp4");

    socket.on("error", async (err) => {
      socket.close();
      if (err.code === "EADDRINUSE") {
        await handlePortInUse(lPort);
        // reject(new Error(`Порт ${lPort} уже используется.`));
      } else {
        reject(new Error("Ошибка сокета: " + err.message));
      }
    });

    socket.bind(lPort, () => {
      const safeMsg = typeof msg === "string" ? msg : DEFAULTS.msg;
      socket.send(Buffer.from(safeMsg), rPort, ip, (err) => {
        socket.close();
        err
          ? reject(new Error("Ошибка при отправке: " + err.message))
          : resolve();
      });
    });
  });
}

// --- Регистрация IPC-обработчиков ---
const handlers = {
  "wg-get-config": async () => readConfig(),
  "wg-set-config": async (_, { key, val }) => {
    const cfg = await readConfig();
    await writeConfig({ ...cfg, [key]: val });
  },
  "wg-reset-config-defaults": async () => writeConfig({ ...DEFAULTS }),
  "wg-send-udp": async (_, args) => sendUdp(args),
};

for (const [channel, handler] of Object.entries(handlers)) {
  if (channel === "wg-set-config") {
    ipcMain.on(channel, handler);
  } else {
    ipcMain.handle(channel, handler);
  }
}

/**
 * Значения по умолчанию
 * @type {{ip: string, rPort: number, lPort: number, msg: string, autosend: boolean}}
 */
const DEFAULTS = {
  ip: "127.0.0.1",
  rPort: 51820,
  lPort: 56132,
  msg: ")",
  autosend: false,
};

/**
 * Парсит строковое значение в boolean|number|string
 * @param {string} val
 * @returns {boolean|number|string}
 */
const parseValue = (val) => {
  if (/^(true|false)$/i.test(val)) return val.toLowerCase() === "true";
  const num = Number(val);
  return Number.isNaN(num) ? val : num;
};
