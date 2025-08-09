// clipboardMonitor.js (src/js/app/clipboardMonitor.js)

const { clipboard } = require("electron");

class ClipboardMonitor {
  constructor(store, mainWindow, isValidUrl, isSupportedUrl) {
    this.store = store;
    this.mainWindow = mainWindow;
    this.isValidUrl = isValidUrl;
    this.isSupportedUrl = isSupportedUrl;
    this.previousText = "";
    this.clipboardMonitorInterval = null;
  }

  start() {
    if (this.clipboardMonitorInterval) {
      return;
    }
    const clipboardMonitoringEnabled = this.store.get("openOnCopyUrl", false);
    if (!clipboardMonitoringEnabled) return;

    this.clipboardMonitorInterval = setInterval(() => {
      const currentText = clipboard.readText();
      if (currentText && currentText !== this.previousText) {
        this.previousText = currentText;

        if (this.isValidUrl(currentText) && this.isSupportedUrl(currentText)) {
          if (this.mainWindow.isMinimized()) this.mainWindow.restore();
          this.mainWindow.show();
          this.mainWindow.focus();
        }
      }
    }, 1000);
  }

  stop() {
    if (this.clipboardMonitorInterval) {
      clearInterval(this.clipboardMonitorInterval);
      this.clipboardMonitorInterval = null;
    }
  }
}

module.exports = ClipboardMonitor;
