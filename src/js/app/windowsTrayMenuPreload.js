"use strict";

const { contextBridge, ipcRenderer } = require("electron");

const CHANNELS = Object.freeze({
  getState: "windows-tray-menu:get-state",
  action: "windows-tray-menu:action",
  close: "windows-tray-menu:close",
});

contextBridge.exposeInMainWorld(
  "windowsTrayMenu",
  Object.freeze({
    getState: () => ipcRenderer.invoke(CHANNELS.getState),
    performAction: (action) => ipcRenderer.invoke(CHANNELS.action, action),
    close: () => ipcRenderer.send(CHANNELS.close),
  }),
);
