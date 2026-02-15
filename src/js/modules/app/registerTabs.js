import TabSystem from "../tabSystem.js";
import renderWireGuard from "../views/wireguardView.js";
import renderBackup from "../views/backupView.js";
import { createRandomizerView } from "../views/randomizerView.js";
import renderDownloaderView from "../views/downloaderView.js";
import { initDownloaderToolsStatus } from "../downloaderToolsStatus.js";
import { initWgAutoShutdownNotifier } from "../wgAutoShutdownNotifier.js";
import { getDefaultTab } from "../settings.js";
import { applyI18n, t } from "../i18n.js";

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

  const backupWrapper = document.createElement("div");
  backupWrapper.id = "backup-view-wrapper";
  backupWrapper.className = "view-wrapper tab-view";
  backupWrapper.style.display = "none";

  const randomizerWrapper = document.createElement("div");
  randomizerWrapper.id = "randomizer-view-wrapper";
  randomizerWrapper.className = "view-wrapper tab-view";
  randomizerWrapper.style.display = "none";

  Array.from(mainView.children).forEach((child) => {
    if (!child.matches(GLOBAL_SELECTOR)) {
      downloaderWrapper.appendChild(child);
    }
  });

  mainView.prepend(downloaderWrapper);
  mainView.appendChild(wireguardWrapper);
  mainView.appendChild(backupWrapper);
  mainView.appendChild(randomizerWrapper);

  return {
    backupWrapper,
    downloaderWrapper,
    randomizerWrapper,
    wireguardWrapper,
  };
}

export async function registerTabs(mainView) {
  const wrappers = createWrappers(mainView);
  const openHistoryBtn = document.getElementById("open-history");
  const showHistory = (flag) => {
    if (openHistoryBtn) openHistoryBtn.style.display = flag ? "" : "none";
  };

  const tabs = new TabSystem(".group-menu", "#main-view");
  let randomizerViewInstance = null;

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
        wrappers.wireguardWrapper.appendChild(renderWireGuard());
      }
      applyI18n(wrappers.wireguardWrapper);
      return wrappers.wireguardWrapper;
    },
    { onShow: () => showHistory(false), onHide: () => showHistory(true) },
  );

  tabs.addTab(
    "backup",
    t("tabs.backup"),
    "fa-solid fa-box-archive",
    () => {
      if (!wrappers.backupWrapper.hasChildNodes()) {
        wrappers.backupWrapper.appendChild(renderBackup());
      }
      applyI18n(wrappers.backupWrapper);
      return wrappers.backupWrapper;
    },
    { onShow: () => showHistory(false), onHide: () => showHistory(true) },
  );

  tabs.addTab(
    "randomizer",
    t("tabs.randomizer"),
    "fa-solid fa-shuffle",
    () => {
      if (!wrappers.randomizerWrapper.hasChildNodes()) {
        if (randomizerViewInstance?.dispose) {
          randomizerViewInstance.dispose();
        }
        randomizerViewInstance = createRandomizerView();
        wrappers.randomizerWrapper.appendChild(randomizerViewInstance.element);
      }
      applyI18n(wrappers.randomizerWrapper);
      return wrappers.randomizerWrapper;
    },
    { onShow: () => showHistory(false), onHide: () => showHistory(true) },
  );

  const defaultTab = await getDefaultTab();
  const wgConfig = await window.electron.ipcRenderer.invoke("wg-get-config");
  const tabToActivate = wgConfig.autosend ? "wireguard" : defaultTab;

  initWgAutoShutdownNotifier({ autosend: !!wgConfig.autosend });
  tabs.activateTab(tabToActivate);

  return { tabs, wgConfig, wrappers };
}
