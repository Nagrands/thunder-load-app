import TabSystem from "../tabSystem.js";
import renderDownloaderView from "../views/downloaderView.js";
import { initDownloaderBackgroundPreview } from "../downloaderBackgroundPreview.js";
import { initDownloaderLivePreview } from "../downloaderLivePreview.js";
import { getDefaultTab } from "../features/settings/defaultTabStore.js";
import { applyI18n, t } from "../i18n.js";
import { initTooltips } from "../tooltipInitializer.js";
import { requestToolsView } from "../toolsNavigation.js";
import { registerLocalShortcutAction } from "../hotkeys.js";
import {
  PLAYER_COMMANDS,
  PLAYER_SHORTCUT_COMMANDS,
  REPEATING_PLAYER_COMMANDS,
} from "../nowPlaying/playerCommands.js";

const GLOBAL_SELECTOR = [
  "#nav-visibility-sentinel",
  ".modal-overlay",
  ".settings-modal",
  ".whats-modal",
  "#context-menu",
].join(",");

const DROPPED_MEDIA_EXTENSIONS = new Set([
  "aac",
  "avi",
  "flac",
  "m4a",
  "m4v",
  "mkv",
  "mov",
  "mp3",
  "mp4",
  "mpeg",
  "mpg",
  "oga",
  "ogg",
  "opus",
  "wav",
  "weba",
  "webm",
]);

function getFileExtension(value) {
  const name = String(value || "")
    .split(/[\\/]/)
    .pop();
  const separator = name.lastIndexOf(".");
  return separator > 0 ? name.slice(separator + 1).toLowerCase() : "";
}

function isSupportedDroppedMedia(value) {
  return DROPPED_MEDIA_EXTENSIONS.has(getFileExtension(value));
}

function hasFileDrop(dataTransfer) {
  return (
    Array.from(dataTransfer?.types || []).includes("Files") ||
    Array.from(dataTransfer?.files || []).length > 0
  );
}

function createMediaDropOverlay() {
  const overlay = document.createElement("div");
  overlay.className = "media-file-drop-overlay";
  overlay.dataset.ui = "media-file-drop-overlay";
  overlay.setAttribute("role", "status");
  overlay.setAttribute("aria-live", "polite");
  overlay.setAttribute("aria-hidden", "true");
  overlay.hidden = true;
  overlay.innerHTML = `
    <span class="media-file-drop-overlay__icon" aria-hidden="true">
      <i class="fa-solid fa-photo-film"></i>
    </span>
    <strong data-i18n="nowPlaying.drop.title">${t("nowPlaying.drop.title")}</strong>
    <span data-i18n="nowPlaying.drop.hint">${t("nowPlaying.drop.hint")}</span>
  `;
  document.body.appendChild(overlay);
  return overlay;
}

function registerMediaFileDrop({
  mainView,
  tabs,
  nowPlayingWrapper,
  renderPlayer,
}) {
  const overlay = createMediaDropOverlay();
  const dropTarget = document.documentElement;
  let dragDepth = 0;

  const hideOverlay = () => {
    dragDepth = 0;
    mainView.classList.remove("is-media-file-dragover");
    overlay.hidden = true;
    overlay.setAttribute("aria-hidden", "true");
  };

  const showOverlay = () => {
    mainView.classList.add("is-media-file-dragover");
    overlay.hidden = false;
    overlay.setAttribute("aria-hidden", "false");
  };

  const onDragEnter = (event) => {
    if (!hasFileDrop(event.dataTransfer)) return;
    if (event.defaultPrevented) {
      hideOverlay();
      return;
    }
    event.preventDefault();
    dragDepth += 1;
    showOverlay();
  };

  const onDragOver = (event) => {
    if (!hasFileDrop(event.dataTransfer)) return;
    if (event.defaultPrevented) {
      hideOverlay();
      return;
    }
    event.preventDefault();
    if (event.dataTransfer) event.dataTransfer.dropEffect = "copy";
    showOverlay();
  };

  const onDragLeave = (event) => {
    if (!hasFileDrop(event.dataTransfer)) return;
    dragDepth = Math.max(0, dragDepth - 1);
    if (!dragDepth) hideOverlay();
  };

  const onDrop = async (event) => {
    if (!hasFileDrop(event.dataTransfer)) return;
    if (event.defaultPrevented) {
      hideOverlay();
      return;
    }
    event.preventDefault();
    hideOverlay();

    const getDroppedFilePath = window.electron?.nowPlaying?.getDroppedFilePath;
    if (typeof getDroppedFilePath !== "function") return;

    const paths = [];
    const seen = new Set();
    for (const file of Array.from(event.dataTransfer?.files || [])) {
      if (!isSupportedDroppedMedia(file?.name)) continue;
      const filePath = getDroppedFilePath(file);
      if (
        typeof filePath !== "string" ||
        !isSupportedDroppedMedia(filePath) ||
        seen.has(filePath)
      ) {
        continue;
      }
      seen.add(filePath);
      paths.push(filePath);
      if (paths.length >= 256) break;
    }
    if (!paths.length) return;

    nowPlayingShouldBeActive = true;
    tabs.activateTab("now-playing");
    await renderPlayer(nowPlayingWrapper, tabs);
    await nowPlayingViewInstance?.importPaths?.(paths, { autoplay: true });
  };

  dropTarget.addEventListener("dragenter", onDragEnter);
  dropTarget.addEventListener("dragover", onDragOver);
  dropTarget.addEventListener("dragleave", onDragLeave);
  dropTarget.addEventListener("drop", onDrop);

  return () => {
    hideOverlay();
    dropTarget.removeEventListener("dragenter", onDragEnter);
    dropTarget.removeEventListener("dragover", onDragOver);
    dropTarget.removeEventListener("dragleave", onDragLeave);
    dropTarget.removeEventListener("drop", onDrop);
    overlay.remove();
  };
}

function createWrappers(mainView) {
  const downloaderWrapper = document.createElement("div");
  downloaderWrapper.id = "downloader-view";
  downloaderWrapper.className = "view-wrapper tab-view downloader-view";

  const wireguardWrapper = document.createElement("div");
  wireguardWrapper.id = "wireguard-view-wrapper";
  wireguardWrapper.className = "view-wrapper tab-view";
  wireguardWrapper.style.display = "none";

  const productsWrapper = document.createElement("div");
  productsWrapper.id = "products-view-wrapper";
  productsWrapper.className = "view-wrapper tab-view";
  productsWrapper.style.display = "none";

  const nowPlayingWrapper = document.createElement("section");
  nowPlayingWrapper.id = "now-playing-view-wrapper";
  nowPlayingWrapper.className = "view-wrapper tab-view";
  nowPlayingWrapper.style.display = "none";

  Array.from(mainView.children).forEach((child) => {
    if (!child.matches(GLOBAL_SELECTOR)) {
      downloaderWrapper.appendChild(child);
    }
  });

  mainView.prepend(downloaderWrapper);
  mainView.appendChild(wireguardWrapper);
  mainView.appendChild(productsWrapper);
  mainView.appendChild(nowPlayingWrapper);

  return {
    downloaderWrapper,
    wireguardWrapper,
    productsWrapper,
    nowPlayingWrapper,
  };
}

function disposeToolsWrapperContent(wireguardWrapper) {
  toolsRenderVersion += 1;
  const toolsView = wireguardWrapper?.firstElementChild;
  if (!toolsView) return;
  try {
    toolsView.dispatchEvent(
      new CustomEvent("tools:view-hidden", { bubbles: true }),
    );
  } catch {}
  wireguardWrapper.replaceChildren();
}

let downloaderToolsStatusModulePromise = null;
let toolsViewModulePromise = null;
let productFormatterViewModulePromise = null;
let nowPlayingViewModulePromise = null;
let nowPlayingViewReadyPromise = null;
let nowPlayingViewInstance = null;
let nowPlayingShouldBeActive = false;
let toolsRenderVersion = 0;
let removePlayerShortcutActions = [];
let removePlayerNavigationProxy = null;
let removeMediaFileDrop = null;
let lazyModuleLoaders = {
  loadDownloaderToolsStatusModule: () => import("../downloaderToolsStatus.js"),
  loadToolsViewModule: () => import("../views/toolsView.js"),
  loadProductFormatterViewModule: () =>
    import("../views/productFormatterView.js"),
  loadNowPlayingViewModule: () => import("../nowPlaying/index.js"),
};

function loadDownloaderToolsStatusModule() {
  if (!downloaderToolsStatusModulePromise) {
    downloaderToolsStatusModulePromise =
      lazyModuleLoaders.loadDownloaderToolsStatusModule();
  }
  return downloaderToolsStatusModulePromise;
}

function loadToolsViewModule() {
  if (!toolsViewModulePromise) {
    toolsViewModulePromise = lazyModuleLoaders.loadToolsViewModule();
  }
  return toolsViewModulePromise;
}

function loadProductFormatterViewModule() {
  if (!productFormatterViewModulePromise) {
    productFormatterViewModulePromise =
      lazyModuleLoaders.loadProductFormatterViewModule();
  }
  return productFormatterViewModulePromise;
}

function loadNowPlayingViewModule() {
  if (!nowPlayingViewModulePromise) {
    nowPlayingViewModulePromise = lazyModuleLoaders.loadNowPlayingViewModule();
  }
  return nowPlayingViewModulePromise;
}

function initializeDownloaderToolsStatus() {
  loadDownloaderToolsStatusModule()
    .then(({ initDownloaderToolsStatus }) => {
      initDownloaderToolsStatus();
    })
    .catch((error) => {
      console.error(
        "[Startup] Downloader tools status lazy init failed:",
        error,
      );
    });
}

async function renderToolsTab(wireguardWrapper) {
  try {
    const renderVersion = ++toolsRenderVersion;
    const shouldAppend = !wireguardWrapper.hasChildNodes();
    if (!wireguardWrapper.hasChildNodes()) {
      const { default: renderToolsView } = await loadToolsViewModule();
      if (
        !wireguardWrapper.isConnected ||
        !shouldAppend ||
        renderVersion !== toolsRenderVersion
      ) {
        return;
      }
      if (wireguardWrapper.hasChildNodes()) {
        applyI18n(wireguardWrapper);
        return;
      }
      wireguardWrapper.appendChild(renderToolsView());
    }
    applyI18n(wireguardWrapper);
  } catch (error) {
    console.error("[Startup] Tools view lazy render failed:", error);
  }
}

async function renderProductsTab(productsWrapper) {
  try {
    const { default: renderProductFormatterView } =
      await loadProductFormatterViewModule();
    if (!productsWrapper.isConnected) return;
    renderProductFormatterView(productsWrapper);
    applyI18n(productsWrapper);
  } catch (error) {
    console.error("[Startup] Products view lazy render failed:", error);
  }
}

async function renderNowPlayingTab(nowPlayingWrapper, tabs) {
  try {
    if (!nowPlayingViewInstance) {
      nowPlayingViewReadyPromise ||= (async () => {
        const { createNowPlayingView } = await loadNowPlayingViewModule();
        if (!nowPlayingWrapper.isConnected) return null;
        if (!nowPlayingViewInstance) {
          nowPlayingViewInstance = createNowPlayingView({
            element: nowPlayingWrapper,
          });
          applyI18n(nowPlayingWrapper);
          await nowPlayingViewInstance.ready;
        }
        return nowPlayingViewInstance;
      })();
      await nowPlayingViewReadyPromise;
    }
    if (!removePlayerNavigationProxy && nowPlayingViewInstance?.element) {
      const navigation = nowPlayingViewInstance.element.querySelector(
        '[data-ui="player-tab-menu"]',
      );
      if (navigation && typeof tabs?.mountNavigationProxy === "function") {
        removePlayerNavigationProxy = tabs.mountNavigationProxy(navigation, {
          excludeIds: ["now-playing"],
        });
        initTooltips(navigation);
      }
    }
    if (nowPlayingShouldBeActive) nowPlayingViewInstance?.onShow();
  } catch (error) {
    console.error("[Startup] Now Playing lazy render failed:", error);
  }
}

function unregisterPlayerShortcutActions() {
  removePlayerShortcutActions.forEach((remove) => remove?.());
  removePlayerShortcutActions = [];
}

function registerPlayerShortcutActions({ tabs, nowPlayingWrapper }) {
  unregisterPlayerShortcutActions();
  const commandsThatOpenPlayer = new Set([
    PLAYER_COMMANDS.OPEN,
    PLAYER_COMMANDS.OPEN_LIBRARY,
    PLAYER_COMMANDS.TOGGLE_FULLSCREEN,
    PLAYER_COMMANDS.SHOW_CURRENT_MEDIA_INFO,
  ]);

  const execute = async (commandId) => {
    const alwaysAvailable = [
      PLAYER_COMMANDS.OPEN,
      PLAYER_COMMANDS.OPEN_LIBRARY,
    ].includes(commandId);
    if (
      !alwaysAvailable &&
      !nowPlayingViewInstance?.canUsePlayerShortcuts?.()
    ) {
      return false;
    }
    if (commandsThatOpenPlayer.has(commandId)) {
      nowPlayingShouldBeActive = true;
      tabs.activateTab("now-playing");
      await renderNowPlayingTab(nowPlayingWrapper, tabs);
    }
    return nowPlayingViewInstance?.executeCommand?.(commandId) ?? false;
  };

  removePlayerShortcutActions = PLAYER_SHORTCUT_COMMANDS.map((commandId) =>
    registerLocalShortcutAction(
      commandId,
      () => execute(commandId),
      { allowRepeat: REPEATING_PLAYER_COMMANDS.has(commandId) },
    ),
  ).filter((remove) => typeof remove === "function");
}

async function ensureInitialTabReady(tabId, wrappers) {
  if (tabId === "wireguard") {
    await renderToolsTab(wrappers.wireguardWrapper);
    return;
  }
  if (tabId === "products") {
    await renderProductsTab(wrappers.productsWrapper);
  }
}

export async function registerTabs(mainView) {
  removeMediaFileDrop?.();
  const wrappers = createWrappers(mainView);
  const openHistoryBtn = document.getElementById("open-history");
  const showHistory = (flag) => {
    if (openHistoryBtn) openHistoryBtn.style.display = flag ? "" : "none";
  };

  showHistory(false);

  const tabs = new TabSystem(".group-menu", "#main-view");
  tabs.addTab(
    "download",
    t("tabs.download"),
    "fa-solid fa-download",
    () => {
      renderDownloaderView(wrappers.downloaderWrapper);
      initDownloaderBackgroundPreview();
      initDownloaderLivePreview();
      initializeDownloaderToolsStatus();
      applyI18n(wrappers.downloaderWrapper);
      return wrappers.downloaderWrapper;
    },
    { onShow: () => showHistory(true), onHide: () => showHistory(false) },
  );

  const unregisterMediaFileDrop = registerMediaFileDrop({
    mainView,
    tabs,
    nowPlayingWrapper: wrappers.nowPlayingWrapper,
    renderPlayer: renderNowPlayingTab,
  });
  removeMediaFileDrop = unregisterMediaFileDrop;

  registerPlayerShortcutActions({
    tabs,
    nowPlayingWrapper: wrappers.nowPlayingWrapper,
  });

  tabs.addTab(
    "wireguard",
    t("tabs.tools"),
    "fa-solid fa-screwdriver-wrench",
    () => {
      void renderToolsTab(wrappers.wireguardWrapper);
      return wrappers.wireguardWrapper;
    },
    {
      onShow: () => showHistory(false),
      onHide: () => {
        disposeToolsWrapperContent(wrappers.wireguardWrapper);
      },
    },
  );

  tabs.addTab(
    "products",
    t("tabs.products"),
    "fa-solid fa-list-check",
    () => {
      void renderProductsTab(wrappers.productsWrapper);
      return wrappers.productsWrapper;
    },
    {
      onShow: () => showHistory(false),
      onHide: () => showHistory(true),
    },
  );

  tabs.addTab(
    "now-playing",
    t("tabs.nowPlaying"),
    "fa-solid fa-circle-play",
    () => {
      void renderNowPlayingTab(wrappers.nowPlayingWrapper, tabs);
      return wrappers.nowPlayingWrapper;
    },
    {
      onShow: () => {
        showHistory(false);
        nowPlayingShouldBeActive = true;
        nowPlayingViewInstance?.onShow();
      },
      onHide: () => {
        nowPlayingShouldBeActive = false;
        nowPlayingViewInstance?.onHide();
      },
    },
  );

  const defaultTab = await getDefaultTab();
  const requestedToolView = defaultTab === "backup" ? "backup" : "";
  const resolvedDefaultTab =
    defaultTab === "backup"
      ? "wireguard"
      : ["download", "wireguard"].includes(defaultTab)
        ? defaultTab
        : "download";
  const tabToActivate = resolvedDefaultTab;

  if (requestedToolView) {
    requestToolsView(requestedToolView);
  }
  await ensureInitialTabReady(tabToActivate, wrappers);
  showHistory(tabToActivate === "download");
  tabs.activateTab(tabToActivate);

  window.electron?.nowPlaying?.onOpenFiles?.(async (payload = {}) => {
    const files = Array.isArray(payload.files) ? payload.files : [];
    if (!files.length) return;
    nowPlayingShouldBeActive = true;
    tabs.activateTab("now-playing");
    await renderNowPlayingTab(wrappers.nowPlayingWrapper, tabs);
    await nowPlayingViewInstance?.importPaths?.(files, {
      autoplay: payload.autoplay !== false,
    });
  });
  window.electron?.nowPlaying?.notifyOpenFilesReady?.();

  return {
    tabs,
    wrappers,
    dispose() {
      unregisterMediaFileDrop();
      if (removeMediaFileDrop === unregisterMediaFileDrop) {
        removeMediaFileDrop = null;
      }
      unregisterPlayerShortcutActions();
      removePlayerNavigationProxy?.();
      removePlayerNavigationProxy = null;
      nowPlayingViewInstance?.dispose?.();
      nowPlayingViewInstance = null;
      nowPlayingViewReadyPromise = null;
    },
  };
}

export function __test_setLazyModuleLoaders(loaders = {}) {
  removeMediaFileDrop?.();
  removeMediaFileDrop = null;
  unregisterPlayerShortcutActions();
  downloaderToolsStatusModulePromise = null;
  toolsViewModulePromise = null;
  productFormatterViewModulePromise = null;
  nowPlayingViewModulePromise = null;
  nowPlayingViewReadyPromise = null;
  nowPlayingViewInstance?.dispose?.();
  nowPlayingViewInstance = null;
  removePlayerNavigationProxy?.();
  removePlayerNavigationProxy = null;
  nowPlayingShouldBeActive = false;
  toolsRenderVersion = 0;
  lazyModuleLoaders = {
    ...lazyModuleLoaders,
    ...loaders,
  };
}
