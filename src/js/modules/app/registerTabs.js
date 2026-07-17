import TabSystem from "../tabSystem.js";
import renderDownloaderView from "../views/downloaderView.js";
import { initDownloaderBackgroundPreview } from "../downloaderBackgroundPreview.js";
import { initDownloaderLivePreview } from "../downloaderLivePreview.js";
import { getDefaultTab } from "../features/settings/defaultTabStore.js";
import { applyI18n, t } from "../i18n.js";
import { requestToolsView } from "../toolsNavigation.js";

const GLOBAL_SELECTOR = [
  "#nav-visibility-sentinel",
  ".modal-overlay",
  ".settings-modal",
  ".whats-modal",
  "#context-menu",
].join(",");

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
let nowPlayingViewInstance = null;
let nowPlayingShouldBeActive = false;
let toolsRenderVersion = 0;
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

async function renderNowPlayingTab(nowPlayingWrapper) {
  try {
    if (!nowPlayingViewInstance) {
      const { createNowPlayingView } = await loadNowPlayingViewModule();
      if (!nowPlayingWrapper.isConnected) return;
      nowPlayingViewInstance = createNowPlayingView({
        element: nowPlayingWrapper,
      });
      applyI18n(nowPlayingWrapper);
      await nowPlayingViewInstance.ready;
    }
    if (nowPlayingShouldBeActive) nowPlayingViewInstance.onShow();
  } catch (error) {
    console.error("[Startup] Now Playing lazy render failed:", error);
  }
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
    "fa-solid fa-music",
    () => {
      void renderNowPlayingTab(wrappers.nowPlayingWrapper);
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
  const wgConfig = await window.electron.ipcRenderer.invoke("wg-get-config");
  const requestedToolView = defaultTab === "backup" ? "backup" : "";
  const resolvedDefaultTab =
    defaultTab === "backup"
      ? "wireguard"
      : ["download", "wireguard"].includes(defaultTab)
        ? defaultTab
        : "download";
  const tabToActivate = wgConfig.autosend ? "wireguard" : resolvedDefaultTab;

  if (requestedToolView && !wgConfig.autosend) {
    requestToolsView(requestedToolView);
  }
  await ensureInitialTabReady(tabToActivate, wrappers);
  showHistory(tabToActivate === "download");
  tabs.activateTab(tabToActivate);

  return { tabs, wgConfig, wrappers };
}

export function __test_setLazyModuleLoaders(loaders = {}) {
  downloaderToolsStatusModulePromise = null;
  toolsViewModulePromise = null;
  productFormatterViewModulePromise = null;
  nowPlayingViewModulePromise = null;
  nowPlayingViewInstance?.dispose?.();
  nowPlayingViewInstance = null;
  nowPlayingShouldBeActive = false;
  toolsRenderVersion = 0;
  lazyModuleLoaders = {
    ...lazyModuleLoaders,
    ...loaders,
  };
}
