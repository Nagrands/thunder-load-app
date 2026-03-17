import { initHistory, initHistoryState } from "../history.js";
import { initIconUpdater } from "../iconUpdater.js";
import { initHotkeys } from "../hotkeys.js";
import { initNetworkListeners } from "../network.js";
import { initContextMenu } from "../contextMenu.js";
import { initWhatsNewModal } from "../whatsNewModal.js";
import { initSettings } from "../settings.js";
import { initUrlInputHandler } from "../urlInputHandler.js";
import { initSort } from "../sort.js";
import { initHistoryFilter } from "../historyFilter.js";
import { initHistoryActions } from "../historyActions.js";
import { initDownloadActions } from "../downloadActions.js";
import { initDownloadCancel } from "../downloadCancel.js";
import { initDownloadCompleteHandler } from "../downloadCompleteHandler.js";
import { initExternalLinksHandler } from "../externalLinks.js";
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
import { initFirstRunModal } from "../firstRunModal.js";
import { initializeTheme } from "../themeManager.js";
import { initializeFontSize } from "../fontSizeManager.js";
import { initLowEffectsFromStore } from "../effectsMode.js";
import { initI18n, t } from "../i18n.js";
import { registerTabs } from "./registerTabs.js";
import {
  registerI18nListeners,
  registerStatusMessageListener,
  registerWgControls,
} from "./registerGlobalListeners.js";

const DEFERRED_INIT_FALLBACK_DELAY_MS = 0;

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
  console.time("[Startup] Critical init");

  const { tabs } = await registerTabs(mainView);

  registerI18nListeners(tabs);

  initUrlInputHandler();
  initHistory();
  await initHistoryState();
  initTopBarResponsive();
  initFirstRunModal();
  registerStatusMessageListener();

  console.timeEnd("[Startup] Critical init");
  return { tabs };
}

async function runDeferredInitialization({ tabs }) {
  console.time("[Startup] Deferred init");

  try {
    initHotkeys(tabs);
    initWhatsNewModal();
    initNetworkListeners();
    initSettings();
    initContextMenu();
    initSort();
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
    initTopBarThemeToggle();

    registerWgControls();

    initUpdateHandler();
    initTooltips();
    console.log("All modules initialized with TabSystem v1.0");
  } catch (error) {
    console.error("[Startup] Deferred init failed:", error);
  } finally {
    console.timeEnd("[Startup] Deferred init");
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

export async function startRenderer() {
  try {
    console.log("[Startup] Bootstrap loaded:", !!window.bootstrap);
    initLowEffectsFromStore();
    applyPlatformClass();
    cleanupLegacyRandomizerStorage();
    initI18n();
    document.title = t("app.title");
    await initializeTheme();
    await initializeFontSize();

    const mainView = document.getElementById("main-view");
    if (!mainView) throw new Error("#main-view not found");

    const runtime = await runCriticalInitialization(mainView);

    document.body.classList.add("ready");

    const preloader = document.getElementById("app-preloader");
    if (preloader) {
      preloader.addEventListener(
        "transitionend",
        () => {
          preloader.remove();
        },
        { once: true },
      );
    }

    console.timeEnd("Renderer → Initialization");
    scheduleDeferredInitialization(async () => {
      await runDeferredInitialization(runtime);
    });
  } catch (error) {
    console.error("Ошибка при инициализации приложения:", error);
  }
}
