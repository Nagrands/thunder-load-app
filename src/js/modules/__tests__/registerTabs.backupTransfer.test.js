describe("registerTabs backup transfer", () => {
  let addTabMock;
  let activateTabMock;
  let requestToolsViewMock;
  let renderBackupMock;
  let renderDownloaderViewMock;
  let renderToolsViewMock;
  let renderProductFormatterViewMock;
  let getDefaultTabMock;
  let initDownloaderToolsStatusMock;
  let initDownloaderBackgroundPreviewMock;
  let initDownloaderLivePreviewMock;
  let applyI18nMock;
  let registerTabs;

  beforeEach(() => {
    jest.resetModules();
    localStorage.clear();
    document.body.innerHTML = `
      <div class="group-menu"></div>
      <div id="main-view"></div>
      <button id="open-history" type="button"></button>
    `;

    addTabMock = jest.fn();
    activateTabMock = jest.fn();
    requestToolsViewMock = jest.fn();
    renderBackupMock = jest.fn(() => document.createElement("div"));
    renderDownloaderViewMock = jest.fn();
    renderToolsViewMock = jest.fn(() => document.createElement("div"));
    renderProductFormatterViewMock = jest.fn();
    getDefaultTabMock = jest.fn(async () => "backup");
    initDownloaderToolsStatusMock = jest.fn();
    initDownloaderBackgroundPreviewMock = jest.fn();
    initDownloaderLivePreviewMock = jest.fn();
    applyI18nMock = jest.fn();

    window.electron = {
      ipcRenderer: {
        invoke: jest.fn(async (channel) => {
          if (channel === "wg-get-config") {
            return { autosend: false };
          }
          return null;
        }),
      },
    };

    jest.doMock("../tabSystem.js", () =>
      jest.fn().mockImplementation(() => ({
        addTab: addTabMock,
        activateTab: activateTabMock,
      })),
    );
    jest.doMock("../views/toolsView.js", () => renderToolsViewMock);
    jest.doMock("../views/backupView.js", () => renderBackupMock);
    jest.doMock("../views/downloaderView.js", () => renderDownloaderViewMock);
    jest.doMock(
      "../views/productFormatterView.js",
      () => renderProductFormatterViewMock,
    );
    jest.doMock("../downloaderToolsStatus.js", () => ({
      initDownloaderToolsStatus: initDownloaderToolsStatusMock,
    }));
    jest.doMock("../downloaderBackgroundPreview.js", () => ({
      initDownloaderBackgroundPreview: initDownloaderBackgroundPreviewMock,
    }));
    jest.doMock("../downloaderLivePreview.js", () => ({
      initDownloaderLivePreview: initDownloaderLivePreviewMock,
    }));
    jest.doMock("../settings.js", () => ({
      getDefaultTab: getDefaultTabMock,
    }));
    jest.doMock("../toolsNavigation.js", () => ({
      requestToolsView: requestToolsViewMock,
    }));
    jest.doMock("../i18n.js", () => ({
      applyI18n: applyI18nMock,
      t: (key) => key,
    }));

    ({ registerTabs } = require("../app/registerTabs.js"));
  });

  test("registers Download, Tools, and Products tabs", async () => {
    await registerTabs(document.getElementById("main-view"));

    expect(addTabMock).toHaveBeenCalledTimes(3);
    expect(addTabMock.mock.calls.map(([id]) => id)).toEqual([
      "download",
      "wireguard",
      "products",
    ]);
    expect(renderBackupMock).not.toHaveBeenCalled();
  });

  test("redirects legacy backup default tab to Tools entry point", async () => {
    getDefaultTabMock.mockResolvedValueOnce("backup");

    await registerTabs(document.getElementById("main-view"));

    expect(requestToolsViewMock).toHaveBeenCalledWith("backup");
    expect(activateTabMock).toHaveBeenCalledWith("wireguard");
    expect(document.getElementById("open-history").style.display).toBe("none");
  });

  test("ignores the removed Downloader developer preference", async () => {
    localStorage.setItem("developerToolsUnlocked", "true");
    localStorage.setItem("developerDisableDownloaderTab", "true");
    getDefaultTabMock.mockResolvedValueOnce("download");

    await registerTabs(document.getElementById("main-view"));

    expect(activateTabMock).toHaveBeenCalledWith("download");
    expect(document.getElementById("open-history").style.display).toBe("");
  });

  test("shows history button only for the Downloader tab callbacks", async () => {
    getDefaultTabMock.mockResolvedValueOnce("download");

    await registerTabs(document.getElementById("main-view"));

    const [, , , , downloadOptions] = addTabMock.mock.calls[0];
    const [, , , , toolsOptions] = addTabMock.mock.calls[1];
    const historyButton = document.getElementById("open-history");

    expect(historyButton.style.display).toBe("");

    toolsOptions.onShow();
    expect(historyButton.style.display).toBe("none");

    downloadOptions.onShow();
    expect(historyButton.style.display).toBe("");

    toolsOptions.onHide();
    expect(historyButton.style.display).toBe("");

    downloadOptions.onHide();
    expect(historyButton.style.display).toBe("none");
  });

  test("initializes downloader preview modules when Download tab renderer runs", async () => {
    getDefaultTabMock.mockResolvedValueOnce("backup");

    await registerTabs(document.getElementById("main-view"));

    const [, , , downloadFactory] = addTabMock.mock.calls[0];
    downloadFactory();

    expect(renderDownloaderViewMock).toHaveBeenCalled();
    expect(initDownloaderBackgroundPreviewMock).toHaveBeenCalled();
    expect(initDownloaderLivePreviewMock).toHaveBeenCalled();
    expect(initDownloaderToolsStatusMock).toHaveBeenCalled();
  });
});
