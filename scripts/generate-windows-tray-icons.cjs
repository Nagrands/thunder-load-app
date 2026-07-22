"use strict";

const fs = require("fs");
const path = require("path");
const { app, BrowserWindow } = require("electron");

const ROOT = path.resolve(__dirname, "..");
const SOURCE_DIR = path.join(ROOT, "assets", "icons", "tray", "windows");
const OUTPUT_DIR = path.join(ROOT, "assets", "icons", "tray");
const SIZES = [16, 20, 24, 32];
const ICONS = Object.freeze({
  idle: "tray.ico",
  downloading: "tray-active.ico",
  paused: "tray-paused.ico",
  error: "tray-error.ico",
  offline: "tray-offline.ico",
});

function createIco(pngImages) {
  const header = Buffer.alloc(6);
  header.writeUInt16LE(0, 0);
  header.writeUInt16LE(1, 2);
  header.writeUInt16LE(pngImages.length, 4);

  const entries = Buffer.alloc(pngImages.length * 16);
  let offset = header.length + entries.length;
  pngImages.forEach(({ size, buffer }, index) => {
    const entryOffset = index * 16;
    entries.writeUInt8(size === 256 ? 0 : size, entryOffset);
    entries.writeUInt8(size === 256 ? 0 : size, entryOffset + 1);
    entries.writeUInt8(0, entryOffset + 2);
    entries.writeUInt8(0, entryOffset + 3);
    entries.writeUInt16LE(1, entryOffset + 4);
    entries.writeUInt16LE(32, entryOffset + 6);
    entries.writeUInt32LE(buffer.length, entryOffset + 8);
    entries.writeUInt32LE(offset, entryOffset + 12);
    offset += buffer.length;
  });
  return Buffer.concat([
    header,
    entries,
    ...pngImages.map(({ buffer }) => buffer),
  ]);
}

function createRenderWindow() {
  return new BrowserWindow({
    width: 32,
    height: 32,
    x: -10000,
    y: -10000,
    show: true,
    frame: false,
    transparent: true,
    backgroundColor: "#00000000",
    webPreferences: { sandbox: true },
  });
}

async function renderSvg(window, sourcePath) {
  const svg = fs.readFileSync(sourcePath, "utf8");
  await window.webContents.executeJavaScript(
    `document.body.innerHTML = ${JSON.stringify(svg)}; new Promise((resolve) => requestAnimationFrame(() => requestAnimationFrame(() => resolve(true))))`,
  );
  return window.webContents.capturePage({
    x: 0,
    y: 0,
    width: 32,
    height: 32,
  });
}

app.whenReady().then(async () => {
  try {
    const renderWindow = createRenderWindow();
    await renderWindow.loadURL(
      "data:text/html,<style>html,body,svg{width:32px;height:32px;margin:0;background:transparent;overflow:hidden}</style>",
    );
    for (const [state, outputName] of Object.entries(ICONS)) {
      const sourcePath = path.join(SOURCE_DIR, `${state}.svg`);
      const source = await renderSvg(renderWindow, sourcePath);
      if (source.isEmpty()) throw new Error(`Unable to render ${sourcePath}`);
      const images = SIZES.map((size) => ({
        size,
        buffer: source
          .resize({ width: size, height: size, quality: "best" })
          .toPNG(),
      }));
      fs.writeFileSync(path.join(OUTPUT_DIR, outputName), createIco(images));
    }
    renderWindow.destroy();
  } catch (error) {
    console.error(error);
    process.exitCode = 1;
  } finally {
    app.quit();
  }
});
