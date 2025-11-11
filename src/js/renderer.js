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
 *  - Handle sidebar navigation, reordering, and active state sync
 *  - Update sidebar history badge and listen for history updates
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
import { initSocialLinks } from "./modules/socialLinks.js";
import { initModalHandlers } from "./modules/modalHandlers.js";
import { initElectronEvents } from "./modules/electronEvents.js";
import { initDownloadProgress } from "./modules/downloadProgress.js";
import { initClipboardHandler } from "./modules/clipboardHandler.js";
import { initInterfaceHandlers } from "./modules/interfaceHandlers.js";
import { initQualitySelector } from "./modules/qualitySelector.js";
import { initSettingsModal } from "./modules/settingsModal.js";
import { initUpdateHandler } from "./modules/updateHandler.js";
// import { updateProgressBar }              from "./modules/updateHandler.js";

import { initializeTheme } from "./modules/themeManager.js";
import { initializeFontSize } from "./modules/fontSizeManager.js";

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

    const GLOBAL_SELECTOR = [
      "#sidebar",
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
      () => downloaderWrapper,
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

    // Apply sidebar visibility for disabled tabs (WG Unlock, Backup)
    const isWgDisabled = () => {
      try {
        const raw = localStorage.getItem("wgUnlockDisabled");
        return raw === null ? true : JSON.parse(raw) === true;
      } catch {
        return true;
      }
    };
    const isBackupDisabled = () => {
      try {
        const raw = localStorage.getItem("backupDisabled");
        return raw === null ? false : JSON.parse(raw) === true;
      } catch {
        return false;
      }
    };

    function applySidebarTabVisibility() {
      try {
        const wgBtn = document.querySelector('#sidebar .sidebar-item[data-tab="wireguard"]');
        const bkBtn = document.querySelector('#sidebar .sidebar-item[data-tab="backup"]');
        if (wgBtn) wgBtn.style.display = isWgDisabled() ? "none" : "";
        if (bkBtn) bkBtn.style.display = isBackupDisabled() ? "none" : "";

        // If currently active tab becomes hidden, TabSystem will switch on next activate call;
        // ensure active marker in sidebar stays consistent with visible items.
        const activeId = (tabs && tabs.activeTabId) || null;
        if (activeId === "wireguard" && isWgDisabled()) {
          // trigger re-activation to first visible
          tabs.activateTab("download");
        } else if (activeId === "backup" && isBackupDisabled()) {
          tabs.activateTab("download");
        }
      } catch {}
    }

    // Initial apply and subscribe to settings change events dispatched by settings.js
    applySidebarTabVisibility();
    window.addEventListener("wg:toggleDisabled", applySidebarTabVisibility);
    window.addEventListener("backup:toggleDisabled", applySidebarTabVisibility);

    // Sidebar navigation: activate tabs from sidebar items
    const sidebarEl = document.getElementById("sidebar");
    if (sidebarEl) {
      sidebarEl.addEventListener("click", (e) => {
        const btn = e.target.closest(".sidebar-item[data-tab]");
        if (btn) {
          const id = btn.getAttribute("data-tab");
          if (id) {
            tabs.activateTab(id);
            // auto-close drawer on navigation (unpinned)
            const sb = document.getElementById("sidebar");
            if (
              sb &&
              sb.classList.contains("is-drawer") &&
              sb.classList.contains("active") &&
              !sb.classList.contains("is-pinned")
            ) {
              sb.classList.remove("active");
              document.getElementById("overlay")?.classList.remove("active");
              document.getElementById("toggle-btn")?.classList.remove("hidden");
            }
          }
        }
      });
      const sbHist = document.getElementById("sb-open-history");
      sbHist?.addEventListener("click", () =>
        document.getElementById("open-history")?.click(),
      );

      // Drag & Drop reorder for nav items
      const navRoot =
        document.querySelector("#sidebar-nav .sidebar-collapse") ||
        document.getElementById("sidebar-nav");
      const ORDER_KEY = "sidebarNavOrder";
      function getOrderFromDom() {
        return Array.from(
          navRoot?.querySelectorAll(".sidebar-item[data-id]") || [],
        )
          .map((el) => el.getAttribute("data-id"))
          .filter(Boolean);
      }
      function persistOrder() {
        try {
          localStorage.setItem(ORDER_KEY, JSON.stringify(getOrderFromDom()));
        } catch {}
      }
      function applyOrderFromStore() {
        try {
          const raw = localStorage.getItem(ORDER_KEY);
          const arr = raw ? JSON.parse(raw) : null;
          if (!Array.isArray(arr) || !navRoot) return;
          const map = new Map(
            Array.from(navRoot.querySelectorAll(".sidebar-item[data-id]")).map(
              (el) => [el.getAttribute("data-id"), el],
            ),
          );
          arr.forEach((id) => {
            const el = map.get(id);
            if (el) navRoot.appendChild(el);
          });
        } catch {}
      }
      function enableDndFor(el) {
        if (!el) return;
        el.setAttribute("draggable", "true");
        el.addEventListener("dragstart", (e) => {
          el.classList.add("dragging");
          e.dataTransfer?.setData(
            "text/plain",
            el.getAttribute("data-id") || "",
          );
          try {
            e.dataTransfer?.setDragImage(el, 10, 10);
          } catch {}
        });
        el.addEventListener("dragend", () => {
          el.classList.remove("dragging");
          navRoot
            ?.querySelectorAll(".drag-over")
            .forEach((n) => n.classList.remove("drag-over"));
          persistOrder();
        });
      }
      function handleDragOver(e) {
        if (!navRoot) return;
        const dragging = navRoot.querySelector(".sidebar-item.dragging");
        if (!dragging) return;
        const target = e.target.closest(".sidebar-item[data-id]");
        if (!target || target === dragging) return;
        e.preventDefault();
        const rect = target.getBoundingClientRect();
        const cs = getComputedStyle(navRoot);
        const horizontal =
          cs.display.includes("flex") && cs.flexDirection.startsWith("row");
        const before = horizontal
          ? e.clientX - rect.left < rect.width / 2
          : e.clientY - rect.top < rect.height / 2;
        target.classList.add("drag-over");
        if (before) navRoot.insertBefore(dragging, target);
        else navRoot.insertBefore(dragging, target.nextSibling);
      }
      navRoot?.addEventListener("dragover", handleDragOver);
      navRoot?.addEventListener("dragleave", (e) => {
        const t = e.target.closest(".sidebar-item");
        t?.classList.remove("drag-over");
      });
      // init
      navRoot?.querySelectorAll(".sidebar-item[data-id]").forEach(enableDndFor);
      applyOrderFromStore();
    }

    // Sidebar badge: history count
    async function updateHistoryBadge() {
      try {
        const list = await window.electron.invoke("load-history");
        const n = Array.isArray(list) ? list.length : 0;
        const badge = document.getElementById("sb-history-count");
        if (badge) badge.textContent = String(n);
      } catch {}
    }
    await updateHistoryBadge();

    const defaultTab = await getDefaultTab();
    const cfg = await window.electron.ipcRenderer.invoke("wg-get-config");
    const tabToActivate = cfg.autosend ? "wireguard" : defaultTab;

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
    // refresh badge after history init
    updateHistoryBadge().catch(() => {});

    // live update badge when history changes from main
    try {
      window.electron.on &&
        window.electron.on("history-updated", (payload) => {
          const n = Number(payload?.count) || 0;
          const badge = document.getElementById("sb-history-count");
          if (badge) badge.textContent = String(n);
        });
    } catch {}

    // Sync active state for sidebar nav buttons
    function syncSidebarActive(id) {
      try {
        document
          .querySelectorAll("#sidebar .sidebar-item[data-tab]")
          .forEach((el) => {
            const is = el.getAttribute("data-tab") === id;
            el.classList.toggle("active", is);
            if (is) el.setAttribute("aria-current", "page");
            else el.removeAttribute("aria-current");
          });
      } catch {}
    }
    window.addEventListener("tabs:activated", (e) => {
      const id = e?.detail?.id;
      if (id) syncSidebarActive(id);
    });
    initHistoryFilter();
    initHistoryActions();
    initDownloadActions();
    initDownloadCancel();
    initDownloadCompleteHandler();
    initIconUpdater();
    initExternalLinksHandler();
    initSocialLinks();
    initModalHandlers();
    initElectronEvents();
    initDownloadProgress();
    initClipboardHandler();
    initInterfaceHandlers();
    initQualitySelector();
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
