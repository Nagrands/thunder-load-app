import { initHistory, initHistoryState } from "../history.js";
import { initIconUpdater } from "../iconUpdater.js";
import { initHotkeys } from "../hotkeys.js";
import { initNetworkListeners } from "../network.js";
import { initTrayStateSync } from "../trayStateSync.js";
import { initContextMenu } from "../contextMenu.js";
import { initWhatsNewModal } from "../whatsNewModal.js";
import { initSettings } from "../settings.js";
import { initUrlInputHandler } from "../urlInputHandler.js";
import { initDownloaderAvailability } from "../downloaderAvailability.js";
import { initCompactDownloaderQuality } from "../compactDownloaderQuality.js";
import { initSort } from "../sort.js";
import { initHistoryFilter } from "../historyFilter.js";
import { initHistoryActions } from "../historyActions.js";
import { initDownloadActions } from "../downloadActions.js";
import { initDownloadCancel } from "../downloadCancel.js";
import { initDownloadCompleteHandler } from "../downloadCompleteHandler.js";
import { initExternalLinksHandler } from "../externalLinks.js";
import { initFooterStatusBar } from "../footerStatusBar.js";
import { initTooltips } from "../tooltipInitializer.js";
import { initModalHandlers } from "../modalHandlers.js";
import { initElectronEvents } from "../electronEvents.js";
import { initDownloadProgress } from "../downloadProgress.js";
import { initClipboardHandler } from "../clipboardHandler.js";
import { initInterfaceHandlers } from "../interfaceHandlers.js";
import { initSettingsModal } from "../settingsModal.js";
import { initUpdateHandler } from "../updateHandler.js";
import { initTopBarThemeToggle } from "../topBarThemeToggle.js";
import { initTopBarResponsive } from "../topBarResponsive.js";
import { initWindowControls } from "../windowControls.js";
import { initWebControlBridge } from "../webControlBridge.js";
import { initFirstRunModal } from "../firstRunModal.js";
import { initializeTheme } from "../themeManager.js";
import { initializeFontSize } from "../fontSizeManager.js";
import { initLowEffectsFromStore } from "../effectsMode.js";
import { initDeveloperModeFooterVisibility } from "../developerModeFooter.js";
import { initPageBackgroundMode } from "../pageBackgroundMode.js";
import { initScrollLockRepair } from "../scrollLockRepair.js";
import { initScrollbarVisibility } from "../scrollbarVisibility.js";
import { initDeveloperModeTopBarVisibility } from "../developerModeTopBar.js";
import { syncDeveloperModeState } from "../developerMode.js";
import { initShortcutEditor } from "../features/settings/shortcutEditor.js";
import { initI18n, t } from "../i18n.js";
import { registerTabs } from "./registerTabs.js";
import {
  registerI18nListeners,
  registerStatusMessageListener,
} from "./registerGlobalListeners.js";

const DEFERRED_INIT_FALLBACK_DELAY_MS = 0;

function logRenderer(level, event, context = {}) {
  window.electron?.diagnostics?.log?.("Main", level, event, context);
}

function scheduleDeferredInitialization(task) {
  if (typeof task !== "function") return;

  if (typeof window.requestIdleCallback === "function") {
    window.requestIdleCallback(() => {
      void task();
    });
    return;
  }

  window.setTimeout(() => {
    void task();
  }, DEFERRED_INIT_FALLBACK_DELAY_MS);
}

async function runCriticalInitialization(mainView) {
  const startedAt = performance.now();

  initPageBackgroundMode();
  initScrollLockRepair();
  initScrollbarVisibility();
  const tabsRuntime = await registerTabs(mainView);
  const { tabs } = tabsRuntime;

  const disposeI18nListener = registerI18nListeners(tabs);

  initDeveloperModeFooterVisibility();
  initDeveloperModeTopBarVisibility();
  initCompactDownloaderQuality();
  initUrlInputHandler();
  initDownloaderAvailability();
  initHistory();
  const disposeWindowControls = initWindowControls();
  initTopBarResponsive();
  initFirstRunModal();
  const disposeStatusListener = registerStatusMessageListener();

  logRenderer("info", "renderer-critical-init-completed", {
    duration: performance.now() - startedAt,
  });
  return {
    tabs,
    dispose() {
      disposeStatusListener?.();
      disposeI18nListener?.();
      disposeWindowControls();
      tabsRuntime.dispose?.();
    },
  };
}

async function runDeferredInitialization({ tabs }) {
  const startedAt = performance.now();

  try {
    void initHistoryState().catch((error) => {
      logRenderer("error", "renderer-history-init-failed", { error });
    });
    initHotkeys(tabs);
    initWhatsNewModal();
    initNetworkListeners();
    initSettings();
    initContextMenu();
    initSort();
    initHistoryFilter();
    initHistoryActions();
    initDownloadActions();
    initFooterStatusBar();
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
    void initShortcutEditor();
    initTopBarThemeToggle();
    initWebControlBridge();

    initUpdateHandler();
    initTooltips();
    logRenderer("info", "renderer-deferred-init-completed", {
      duration: performance.now() - startedAt,
    });
  } catch (error) {
    logRenderer("error", "renderer-deferred-init-failed", { error });
  }
}

function cleanupLegacyRandomizerStorage() {
  const MIGRATION_KEY = "migration.randomizerRemoved.v1";
  try {
    if (localStorage.getItem(MIGRATION_KEY) === "1") return;
    [
      "randomizerItems",
      "randomizerHistory",
      "randomizerSettings",
      "randomizerPool",
      "randomizerPresets",
      "randomizerCurrentPreset",
      "randomizerDefaultPreset",
      "randomizerDisabled",
    ].forEach((key) => localStorage.removeItem(key));
    localStorage.setItem(MIGRATION_KEY, "1");
  } catch {
    // ignore storage errors
  }
}

function cleanupLegacyToolsSettings() {
  const MIGRATION_KEY = "migration.toolsSettingsRemoved.v1";
  try {
    if (localStorage.getItem(MIGRATION_KEY) === "1") return;
    [
      "wgUnlockDisabled",
      "backupDisabled",
      "toolsRememberLastView",
      "toolsLastView",
      "bk_view_mode",
      "bk_log_visible",
    ].forEach((key) => localStorage.removeItem(key));
    localStorage.setItem(MIGRATION_KEY, "1");
  } catch {
    // ignore storage errors
  }
}

async function applyPlatformClass() {
  try {
    const { isMac } = await window.electron.getPlatformInfo();
    if (isMac) {
      document.body.classList.add("is-mac");
    }
  } catch (error) {
    logRenderer("warning", "platform-info-unavailable", { error });
  }
}

export async function startRenderer() {
  try {
    logRenderer("debug", "renderer-bootstrap-loaded", {
      bootstrapAvailable: Boolean(window.bootstrap),
    });
    initLowEffectsFromStore();
    applyPlatformClass();
    cleanupLegacyRandomizerStorage();
    cleanupLegacyToolsSettings();
    syncDeveloperModeState();
    initI18n();
    initTrayStateSync();
    document.title = t("app.title");
    await initializeTheme();
    await initializeFontSize();

    const mainView = document.getElementById("main-view");
    if (!mainView) throw new Error("#main-view not found");

    const runtime = await runCriticalInitialization(mainView);
    window.addEventListener("beforeunload", () => runtime.dispose?.(), {
      once: true,
    });

    document.body.classList.add("ready");
    document.getElementById("app-preloader")?.remove();

    scheduleDeferredInitialization(async () => {
      await runDeferredInitialization(runtime);
    });
  } catch (error) {
    logRenderer("error", "renderer-initialization-failed", { error });
  }
}
