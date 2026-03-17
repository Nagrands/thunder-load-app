import TabSystem from "../tabSystem.js";
import renderToolsView from "../views/toolsView.js";
import renderDownloaderView from "../views/downloaderView.js";
import { initDownloaderToolsStatus } from "../downloaderToolsStatus.js";
import { initWgAutoShutdownNotifier } from "../wgAutoShutdownNotifier.js";
import { getDefaultTab } from "../settings.js";
import { applyI18n, t } from "../i18n.js";
import { requestToolsView } from "../toolsNavigation.js";

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

function createWrappers(mainView) {
  const downloaderWrapper = document.createElement("div");
  downloaderWrapper.id = "downloader-view";
  downloaderWrapper.className = "view-wrapper tab-view downloader-view";

  const wireguardWrapper = document.createElement("div");
  wireguardWrapper.id = "wireguard-view-wrapper";
  wireguardWrapper.className = "view-wrapper tab-view";
  wireguardWrapper.style.display = "none";

  Array.from(mainView.children).forEach((child) => {
    if (!child.matches(GLOBAL_SELECTOR)) {
      downloaderWrapper.appendChild(child);
    }
  });

  mainView.prepend(downloaderWrapper);
  mainView.appendChild(wireguardWrapper);

  return {
    downloaderWrapper,
    wireguardWrapper,
  };
}

function disposeToolsWrapperContent(wireguardWrapper) {
  const toolsView = wireguardWrapper?.firstElementChild;
  if (!toolsView) return;
  try {
    toolsView.dispatchEvent(new Event("tools:view-hidden"));
  } catch {}
  wireguardWrapper.replaceChildren();
}

export async function registerTabs(mainView) {
  const wrappers = createWrappers(mainView);
  const openHistoryBtn = document.getElementById("open-history");
  const showHistory = (flag) => {
    if (openHistoryBtn) openHistoryBtn.style.display = flag ? "" : "none";
  };

  const tabs = new TabSystem(".group-menu", "#main-view");
  tabs.addTab(
    "download",
    t("tabs.download"),
    "fa-solid fa-download",
    () => {
      renderDownloaderView(wrappers.downloaderWrapper);
      initDownloaderToolsStatus();
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
      if (!wrappers.wireguardWrapper.hasChildNodes()) {
        wrappers.wireguardWrapper.appendChild(renderToolsView());
      }
      applyI18n(wrappers.wireguardWrapper);
      return wrappers.wireguardWrapper;
    },
    {
      onShow: () => showHistory(false),
      onHide: () => {
        disposeToolsWrapperContent(wrappers.wireguardWrapper);
        showHistory(true);
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

  initWgAutoShutdownNotifier({ autosend: !!wgConfig.autosend });
  if (requestedToolView && !wgConfig.autosend) {
    requestToolsView(requestedToolView);
  }
  tabs.activateTab(tabToActivate);

  return { tabs, wgConfig, wrappers };
}
