/**
 * @file renderer.js
 * @description
 * Entry point for the renderer process. Initializes UI, mounts tabbed views,
 * and orchestrates interaction between UI modules and the Electron main process.
 *
 * Responsibilities:
 *  - Apply platform-specific classes (macOS styling, etc.)
 *  - Initialize theme and font size managers
 *  - Create and manage tab system (Downloader, WG Unlock, Backup)
 *  - Update global history counter and listen for history updates
 *  - Initialize application modules (history, downloads, settings, tooltips, etc.)
 *  - Bind event handlers for WireGuard autosend and manual send
 *  - Manage preloader removal and startup status messages
 *  - Set up IPC listeners for status messages from main
 *
 * Exports:
 *  - None (executes initialization logic directly in renderer context)
 */

// src/js/renderer.js

import TabSystem from "./modules/tabSystem.js";
import renderWireGuard from "./modules/views/wireguardView.js";
import renderBackup from "./modules/views/backupView.js";
import renderRandomizerView from "./modules/views/randomizerView.js";
import renderDownloaderView from "./modules/views/downloaderView.js";

import { initHistory, initHistoryState } from "./modules/history.js";
import { initIconUpdater } from "./modules/iconUpdater.js";
import { initHotkeys } from "./modules/hotkeys.js";
import { initNetworkListeners } from "./modules/network.js";
import { initContextMenu } from "./modules/contextMenu.js";
import { initWhatsNewModal } from "./modules/whatsNewModal.js";
import { initSettings, getDefaultTab } from "./modules/settings.js";
import { initUrlInputHandler } from "./modules/urlInputHandler.js";
import { initSort } from "./modules/sort.js";
import { initHistoryFilter } from "./modules/historyFilter.js";
import { initHistoryActions } from "./modules/historyActions.js";
import { initDownloadActions } from "./modules/downloadActions.js";
import { initDownloadCancel } from "./modules/downloadCancel.js";
import { initDownloadCompleteHandler } from "./modules/downloadCompleteHandler.js";
import { initExternalLinksHandler } from "./modules/externalLinks.js";
import { initTooltips } from "./modules/tooltipInitializer.js";
import { initModalHandlers } from "./modules/modalHandlers.js";
import { initElectronEvents } from "./modules/electronEvents.js";
import { initDownloadProgress } from "./modules/downloadProgress.js";
import { initClipboardHandler } from "./modules/clipboardHandler.js";
import { initInterfaceHandlers } from "./modules/interfaceHandlers.js";
import { initSettingsModal } from "./modules/settingsModal.js";
import { initUpdateHandler } from "./modules/updateHandler.js";
import { initDownloaderToolsStatus } from "./modules/downloaderToolsStatus.js";
import { initWgAutoShutdownNotifier } from "./modules/wgAutoShutdownNotifier.js";
// import { updateProgressBar }              from "./modules/updateHandler.js";

import { initializeTheme } from "./modules/themeManager.js";
import { initializeFontSize } from "./modules/fontSizeManager.js";
import { initLowEffectsFromStore } from "./modules/effectsMode.js";

async function applyPlatformClass() {
  try {
    const { isMac } = await window.electron.getPlatformInfo();
    if (isMac) {
      document.body.classList.add("is-mac");
    }
  } catch (error) {
    console.warn("Platform info unavailable", error);
  }
}

// document.body.classList.add("is-mac");

// ————————————————————————————————————————————————————————————————
console.time("Renderer → Initialization");

async function startRenderer() {
  try {
    console.log("[Startup] Bootstrap loaded:", !!window.bootstrap);
    initLowEffectsFromStore();
    applyPlatformClass();
    await initializeTheme();
    await initializeFontSize();

    const mainView = document.getElementById("main-view");
    if (!mainView) throw new Error("#main-view not found");

    const downloaderWrapper = document.createElement("div");
    downloaderWrapper.id = "downloader-view";
    downloaderWrapper.className = "view-wrapper tab-view downloader-view";

    const wireguardWrapper = document.createElement("div");
    wireguardWrapper.id = "wireguard-view-wrapper";
    wireguardWrapper.className = "view-wrapper tab-view";
    wireguardWrapper.style.display = "none";

    const backupWrapper = document.createElement("div");
    backupWrapper.id = "backup-view-wrapper";
    backupWrapper.className = "view-wrapper tab-view";
    backupWrapper.style.display = "none";

    const randomizerWrapper = document.createElement("div");
    randomizerWrapper.id = "randomizer-view-wrapper";
    randomizerWrapper.className = "view-wrapper tab-view";
    randomizerWrapper.style.display = "none";

    const GLOBAL_SELECTOR = [
      ".modal-overlay",
      ".settings-modal",
      ".shortcuts-modal",
      ".whats-modal",
      "#context-menu",
      "#update-available-modal",
      "#update-downloaded-modal",
      "#update-error-modal",
      "#update-progress-container",
    ].join(",");

    // Переносим текущий контент в downloaderWrapper
    Array.from(mainView.children).forEach((child) => {
      if (!child.matches(GLOBAL_SELECTOR)) {
        downloaderWrapper.appendChild(child);
      }
    });

    mainView.prepend(downloaderWrapper);
    mainView.appendChild(wireguardWrapper);
    mainView.appendChild(backupWrapper);
    mainView.appendChild(randomizerWrapper);

    // Инициализация TabSystem
    const openHistoryBtn = document.getElementById("open-history");
    const showHistory = (flag) => {
      if (openHistoryBtn) openHistoryBtn.style.display = flag ? "" : "none";
    };

    const tabs = new TabSystem(".group-menu", "#main-view");

    tabs.addTab(
      "download",
      "Downloader",
      "fa-solid fa-download",
      () => {
        // Build "glass" layout for downloader from existing elements once
        renderDownloaderView(downloaderWrapper);
        initDownloaderToolsStatus();
        return downloaderWrapper;
      },
      { onShow: () => showHistory(true), onHide: () => showHistory(false) },
    );

    tabs.addTab(
      "wireguard",
      "WG Unlock",
      "fa-solid fa-unlock-keyhole",
      () => {
        if (!wireguardWrapper.hasChildNodes()) {
          wireguardWrapper.appendChild(renderWireGuard());
        }
        return wireguardWrapper;
      },
      { onShow: () => showHistory(false), onHide: () => showHistory(true) },
    );

    tabs.addTab(
      "backup",
      "Backup",
      "fa-solid fa-box-archive",
      () => {
        if (!backupWrapper.hasChildNodes()) {
          backupWrapper.appendChild(renderBackup());
        }
        return backupWrapper;
      },
      { onShow: () => showHistory(false), onHide: () => showHistory(true) },
    );

    tabs.addTab(
      "randomizer",
      "Randomizer",
      "fa-solid fa-shuffle",
      () => {
        if (!randomizerWrapper.hasChildNodes()) {
          randomizerWrapper.appendChild(renderRandomizerView());
        }
        return randomizerWrapper;
      },
      { onShow: () => showHistory(false), onHide: () => showHistory(true) },
    );

    const defaultTab = await getDefaultTab();
    const cfg = await window.electron.ipcRenderer.invoke("wg-get-config");
    const tabToActivate = cfg.autosend ? "wireguard" : defaultTab;

    initWgAutoShutdownNotifier({ autosend: !!cfg.autosend });
    tabs.activateTab(tabToActivate);

    // Инициализация остальных модулей
    initHotkeys(tabs);
    initWhatsNewModal();
    initNetworkListeners();
    initSettings();
    initUrlInputHandler();
    initContextMenu();
    initSort();
    initHistory();
    await initHistoryState();
    initHistoryFilter();
    initHistoryActions();
    initDownloadActions();
    initDownloadCancel();
    initDownloadCompleteHandler();
    initIconUpdater();
    initExternalLinksHandler();
    initModalHandlers();
    initElectronEvents();
    initDownloadProgress();
    initClipboardHandler();
    initInterfaceHandlers();
    initSettingsModal();

    // ——— WireGuard autosend checkbox sync ———
    const wgAutosendCheckbox = document.getElementById("wg-autosend");
    if (wgAutosendCheckbox) {
      window.electron.ipcRenderer.invoke("wg-get-config").then((cfg) => {
        wgAutosendCheckbox.checked = !!cfg.autosend;
      });

      wgAutosendCheckbox.addEventListener("change", () => {
        window.electron.ipcRenderer.send("wg-set-config", {
          key: "autosend",
          val: wgAutosendCheckbox.checked,
        });
      });
    }

    window.electron.ipcRenderer.invoke("wg-get-config").then((cfg) => {
      console.log("[WG Unlock] autosend from config:", cfg.autosend); // ← отладка
      wgAutosendCheckbox.checked = !!cfg.autosend;
    });

    initUpdateHandler();
    initTooltips(); // ← перемещено сюда, после инициализации всех DOM-элементов
    // updateProgressBar(55.5);

    console.timeEnd("Renderer → Initialization");

    console.log("All modules initialized with TabSystem v1.0");

    document.body.classList.add("ready");

    const preloader = document.getElementById("app-preloader");
    if (preloader) {
      // Дожидаемся окончания transition и удаляем
      preloader.addEventListener(
        "transitionend",
        () => {
          preloader.remove();
        },
        { once: true },
      );
    }

    // Обработка status-message от main процесса
    window.electron.receive("status-message", (message) => {
      let el = document.getElementById("startup-status");
      if (!el) {
        el = document.createElement("div");
        el.id = "startup-status";
        el.className = "spinner-message";
        el.setAttribute("role", "status");
        el.setAttribute("aria-live", "polite");
        document.body.prepend(el);
      }

      el.innerHTML = `
        <div class="spinner"></div>
        <span>${message}</span>
      `;

      // Удаляем через 3 сек, если это финальное сообщение
      if (/установлены|ошибка/i.test(message)) {
        setTimeout(() => el.remove(), 3000);
      }
    });

    // --- Added wg-send and kvn handlers with requested changes ---
    // Assuming these handlers are added here or nearby in this file

    // Example wg-send handler adjustment
    const wgSendBtn = document.getElementById("wg-send");
    if (wgSendBtn) {
      wgSendBtn.addEventListener("click", () => {
        const status = document.getElementById("wg-send-status");
        if (!status) return;

        status.classList.remove("hidden");
        const hideLater = () =>
          setTimeout(() => status.classList.add("hidden"), 500);

        window.electron.ipcRenderer
          .invoke("wg-send-command")
          .then(() => {
            hideLater();
          })
          .catch(() => {
            hideLater();
          });
      });
    }

    // Example kvn handler adjustment
    const kvnBtn = document.getElementById("kvn-button");
    if (kvnBtn) {
      kvnBtn.addEventListener("click", () => {
        const status = document.getElementById("kvn-status");
        if (!status) return;

        status.classList.remove("hidden");
        const hideLater = () =>
          setTimeout(() => status.classList.add("hidden"), 500);

        requestAnimationFrame(() => {
          window.electron.ipcRenderer
            .invoke("kvn-command")
            .then(() => {
              hideLater();
            })
            .catch(() => {
              hideLater();
            });
        });
      });
    }
  } catch (error) {
    console.error("Ошибка при инициализации приложения:", error);
  }
}

if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", startRenderer);
} else {
  startRenderer();
}
