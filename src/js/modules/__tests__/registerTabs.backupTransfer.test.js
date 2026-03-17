describe("registerTabs backup transfer", () => {
  let addTabMock;
  let activateTabMock;
  let requestToolsViewMock;
  let renderBackupMock;
  let renderDownloaderViewMock;
  let renderToolsViewMock;
  let getDefaultTabMock;
  let initDownloaderToolsStatusMock;
  let initWgAutoShutdownNotifierMock;
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
    getDefaultTabMock = jest.fn(async () => "backup");
    initDownloaderToolsStatusMock = jest.fn();
    initWgAutoShutdownNotifierMock = jest.fn();
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
    jest.doMock("../downloaderToolsStatus.js", () => ({
      initDownloaderToolsStatus: initDownloaderToolsStatusMock,
    }));
    jest.doMock("../wgAutoShutdownNotifier.js", () => ({
      initWgAutoShutdownNotifier: initWgAutoShutdownNotifierMock,
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

  test("registers only Download and Tools tabs", async () => {
    await registerTabs(document.getElementById("main-view"));

    expect(addTabMock).toHaveBeenCalledTimes(2);
    expect(addTabMock.mock.calls.map(([id]) => id)).toEqual([
      "download",
      "wireguard",
    ]);
    expect(renderBackupMock).not.toHaveBeenCalled();
  });

  test("redirects legacy backup default tab to Tools entry point", async () => {
    getDefaultTabMock.mockResolvedValueOnce("backup");

    await registerTabs(document.getElementById("main-view"));

    expect(requestToolsViewMock).toHaveBeenCalledWith("backup");
    expect(activateTabMock).toHaveBeenCalledWith("wireguard");
    expect(initWgAutoShutdownNotifierMock).toHaveBeenCalledWith({
      autosend: false,
    });
  });
});
