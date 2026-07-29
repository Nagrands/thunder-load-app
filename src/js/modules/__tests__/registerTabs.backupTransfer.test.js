describe("registerTabs backup transfer", () => {
  let addTabMock;
  let activateTabMock;
  let mountNavigationProxyMock;
  let requestToolsViewMock;
  let renderBackupMock;
  let renderDownloaderViewMock;
  let renderToolsViewMock;
  let renderProductFormatterViewMock;
  let createNowPlayingViewMock;
  let nowPlayingViewInstance;
  let getDefaultTabMock;
  let initDownloaderToolsStatusMock;
  let initDownloaderBackgroundPreviewMock;
  let initDownloaderLivePreviewMock;
  let applyI18nMock;
  let registerTabs;
  let tabsRegistration;
  let setLazyModuleLoaders;
  let shortcutActions;

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
    mountNavigationProxyMock = jest.fn(() => jest.fn());
    requestToolsViewMock = jest.fn();
    renderBackupMock = jest.fn(() => document.createElement("div"));
    renderDownloaderViewMock = jest.fn();
    renderToolsViewMock = jest.fn(() => document.createElement("div"));
    renderProductFormatterViewMock = jest.fn();
    nowPlayingViewInstance = {
      element: null,
      ready: Promise.resolve(),
      onShow: jest.fn(),
      onHide: jest.fn(),
      dispose: jest.fn(),
      importPaths: jest.fn(async () => true),
    };
    createNowPlayingViewMock = jest.fn(({ element }) => {
      nowPlayingViewInstance.element = element;
      element.innerHTML =
        '<nav data-ui="player-tab-menu" aria-label="Navigation"></nav>';
      return nowPlayingViewInstance;
    });
    getDefaultTabMock = jest.fn(async () => "backup");
    initDownloaderToolsStatusMock = jest.fn();
    initDownloaderBackgroundPreviewMock = jest.fn();
    initDownloaderLivePreviewMock = jest.fn();
    applyI18nMock = jest.fn();
    shortcutActions = new Map();
    nowPlayingViewInstance.executeCommand = jest.fn();
    nowPlayingViewInstance.canUsePlayerShortcuts = jest.fn(() => true);

    window.electron = {
      ipcRenderer: {
        invoke: jest.fn(async () => null),
      },
      nowPlaying: {
        getDroppedFilePath: jest.fn((file) => file?.path || ""),
        onOpenFiles: jest.fn(),
        notifyOpenFilesReady: jest.fn(),
      },
    };

    jest.doMock("../tabSystem.js", () =>
      jest.fn().mockImplementation(() => ({
        addTab: addTabMock,
        activateTab: activateTabMock,
        mountNavigationProxy: mountNavigationProxyMock,
      })),
    );
    jest.doMock("../views/toolsView.js", () => ({
      __esModule: true,
      default: renderToolsViewMock,
    }));
    jest.doMock("../views/backupView.js", () => renderBackupMock);
    jest.doMock("../views/downloaderView.js", () => renderDownloaderViewMock);
    jest.doMock("../views/productFormatterView.js", () => ({
      __esModule: true,
      default: renderProductFormatterViewMock,
    }));
    jest.doMock("../downloaderToolsStatus.js", () => ({
      __esModule: true,
      initDownloaderToolsStatus: initDownloaderToolsStatusMock,
    }));
    jest.doMock("../downloaderBackgroundPreview.js", () => ({
      initDownloaderBackgroundPreview: initDownloaderBackgroundPreviewMock,
    }));
    jest.doMock("../downloaderLivePreview.js", () => ({
      initDownloaderLivePreview: initDownloaderLivePreviewMock,
    }));
    jest.doMock("../features/settings/defaultTabStore.js", () => ({
      getDefaultTab: getDefaultTabMock,
    }));
    jest.doMock("../toolsNavigation.js", () => ({
      requestToolsView: requestToolsViewMock,
    }));
    jest.doMock("../i18n.js", () => ({
      applyI18n: applyI18nMock,
      t: (key) => key,
    }));
    jest.doMock("../hotkeys.js", () => ({
      registerLocalShortcutAction: jest.fn((actionId, handler) => {
        shortcutActions.set(actionId, handler);
        return () => shortcutActions.delete(actionId);
      }),
    }));

    let registerTabsModule;
    ({
      __test_setLazyModuleLoaders: setLazyModuleLoaders,
      registerTabs: registerTabsModule,
    } = require("../app/registerTabs.js"));
    registerTabs = async (...args) => {
      tabsRegistration = await registerTabsModule(...args);
      return tabsRegistration;
    };
    setLazyModuleLoaders({
      loadDownloaderToolsStatusModule: () =>
        Promise.resolve({
          initDownloaderToolsStatus: initDownloaderToolsStatusMock,
        }),
      loadProductFormatterViewModule: () =>
        Promise.resolve({ default: renderProductFormatterViewMock }),
      loadToolsViewModule: () =>
        Promise.resolve({ default: renderToolsViewMock }),
      loadNowPlayingViewModule: () =>
        Promise.resolve({ createNowPlayingView: createNowPlayingViewMock }),
    });
  });

  afterEach(() => {
    tabsRegistration?.dispose();
    tabsRegistration = null;
  });

  test("registers Download, Tools, Products, and Now Playing tabs", async () => {
    await registerTabs(document.getElementById("main-view"));

    expect(addTabMock).toHaveBeenCalledTimes(4);
    expect(addTabMock.mock.calls.map(([id]) => id)).toEqual([
      "download",
      "wireguard",
      "products",
      "now-playing",
    ]);
    expect(addTabMock.mock.calls[3].slice(1, 3)).toEqual([
      "tabs.nowPlaying",
      "fa-solid fa-circle-play",
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
    await Promise.resolve();
    await Promise.resolve();

    expect(renderDownloaderViewMock).toHaveBeenCalled();
    expect(initDownloaderBackgroundPreviewMock).toHaveBeenCalled();
    expect(initDownloaderLivePreviewMock).toHaveBeenCalled();
    expect(initDownloaderToolsStatusMock).toHaveBeenCalled();
  });

  test("loads Tools view only when Tools tab renderer runs", async () => {
    getDefaultTabMock.mockResolvedValueOnce("download");

    await registerTabs(document.getElementById("main-view"));

    expect(renderToolsViewMock).not.toHaveBeenCalled();

    const [, , , toolsFactory] = addTabMock.mock.calls[1];
    const wrapper = toolsFactory();
    await Promise.resolve();
    await Promise.resolve();

    expect(wrapper.id).toBe("wireguard-view-wrapper");
    expect(renderToolsViewMock).toHaveBeenCalledTimes(1);
    expect(applyI18nMock).toHaveBeenCalledWith(wrapper);
  });

  test("loads Products view only when Products tab renderer runs", async () => {
    getDefaultTabMock.mockResolvedValueOnce("download");

    await registerTabs(document.getElementById("main-view"));

    expect(renderProductFormatterViewMock).not.toHaveBeenCalled();

    const [, , , productsFactory] = addTabMock.mock.calls[2];
    const wrapper = productsFactory();
    await Promise.resolve();
    await Promise.resolve();

    expect(wrapper.id).toBe("products-view-wrapper");
    expect(renderProductFormatterViewMock).toHaveBeenCalledWith(wrapper);
    expect(applyI18nMock).toHaveBeenCalledWith(wrapper);
  });

  test("keeps Now Playing mounted and forwards tab lifecycle hooks", async () => {
    getDefaultTabMock.mockResolvedValueOnce("download");

    await registerTabs(document.getElementById("main-view"));

    expect(createNowPlayingViewMock).not.toHaveBeenCalled();
    const [, , , nowPlayingFactory, nowPlayingOptions] =
      addTabMock.mock.calls[3];
    const wrapper = nowPlayingFactory();
    nowPlayingOptions.onShow();
    await Promise.resolve();
    await Promise.resolve();
    await Promise.resolve();

    expect(wrapper.id).toBe("now-playing-view-wrapper");
    expect(createNowPlayingViewMock).toHaveBeenCalledWith({ element: wrapper });
    expect(mountNavigationProxyMock).toHaveBeenCalledWith(
      wrapper.querySelector('[data-ui="player-tab-menu"]'),
      { excludeIds: ["now-playing"] },
    );
    expect(nowPlayingViewInstance.onShow).toHaveBeenCalled();

    nowPlayingOptions.onHide();
    expect(nowPlayingViewInstance.onHide).toHaveBeenCalled();
    expect(wrapper.isConnected).toBe(true);
  });

  test("opens the lazy Player and media library through registered commands", async () => {
    getDefaultTabMock.mockResolvedValueOnce("download");
    await registerTabs(document.getElementById("main-view"));

    await shortcutActions.get("player.open")();
    expect(activateTabMock).toHaveBeenCalledWith("now-playing");
    expect(createNowPlayingViewMock).toHaveBeenCalledTimes(1);
    expect(nowPlayingViewInstance.executeCommand).toHaveBeenCalledWith(
      "player.open",
    );

    await shortcutActions.get("player.openLibrary")();
    expect(createNowPlayingViewMock).toHaveBeenCalledTimes(1);
    expect(nowPlayingViewInstance.executeCommand).toHaveBeenLastCalledWith(
      "player.openLibrary",
    );
  });

  test("deduplicates concurrent lazy Player initialization", async () => {
    getDefaultTabMock.mockResolvedValueOnce("download");
    await registerTabs(document.getElementById("main-view"));
    const [, , , nowPlayingFactory] = addTabMock.mock.calls[3];

    nowPlayingFactory();
    await shortcutActions.get("player.open")();

    expect(createNowPlayingViewMock).toHaveBeenCalledTimes(1);
  });

  test("shows media drop feedback and hides it when the drag leaves", async () => {
    getDefaultTabMock.mockResolvedValueOnce("download");
    const registration = await registerTabs(
      document.getElementById("main-view"),
    );
    const mainView = document.getElementById("main-view");
    const overlay = document.querySelector(
      '[data-ui="media-file-drop-overlay"]',
    );
    const dataTransfer = {
      files: [],
      types: ["Files"],
      dropEffect: "",
    };
    const dragEnter = new Event("dragenter", {
      bubbles: true,
      cancelable: true,
    });
    Object.defineProperty(dragEnter, "dataTransfer", { value: dataTransfer });

    mainView.dispatchEvent(dragEnter);

    expect(dragEnter.defaultPrevented).toBe(true);
    expect(overlay.hidden).toBe(false);
    expect(overlay.getAttribute("aria-hidden")).toBe("false");
    expect(mainView.classList.contains("is-media-file-dragover")).toBe(true);

    const dragLeave = new Event("dragleave", {
      bubbles: true,
      cancelable: true,
    });
    Object.defineProperty(dragLeave, "dataTransfer", { value: dataTransfer });
    mainView.dispatchEvent(dragLeave);

    expect(overlay.hidden).toBe(true);
    expect(mainView.classList.contains("is-media-file-dragover")).toBe(false);

    registration.dispose();
    expect(overlay.isConnected).toBe(false);
  });

  test("opens Player and imports supported dropped media files", async () => {
    getDefaultTabMock.mockResolvedValueOnce("download");
    await registerTabs(document.getElementById("main-view"));
    const mainView = document.getElementById("main-view");
    const files = [
      { name: "Song.MP3", path: "/media/Song.MP3" },
      { name: "movie.mkv", path: "/media/movie.mkv" },
      { name: "notes.txt", path: "/media/notes.txt" },
      { name: "duplicate.mkv", path: "/media/movie.mkv" },
    ];
    const drop = new Event("drop", { bubbles: true, cancelable: true });
    Object.defineProperty(drop, "dataTransfer", {
      value: { files, types: ["Files"], dropEffect: "" },
    });

    mainView.dispatchEvent(drop);
    await new Promise((resolve) => setTimeout(resolve, 0));

    expect(drop.defaultPrevented).toBe(true);
    expect(activateTabMock).toHaveBeenCalledWith("now-playing");
    expect(createNowPlayingViewMock).toHaveBeenCalledTimes(1);
    expect(window.electron.nowPlaying.getDroppedFilePath).toHaveBeenCalledTimes(
      3,
    );
    expect(nowPlayingViewInstance.importPaths).toHaveBeenCalledWith(
      ["/media/Song.MP3", "/media/movie.mkv"],
      { autoplay: true },
    );
  });

  test("does not open Player for unsupported dropped files", async () => {
    getDefaultTabMock.mockResolvedValueOnce("download");
    await registerTabs(document.getElementById("main-view"));
    activateTabMock.mockClear();
    const mainView = document.getElementById("main-view");
    const drop = new Event("drop", { bubbles: true, cancelable: true });
    Object.defineProperty(drop, "dataTransfer", {
      value: {
        files: [{ name: "notes.txt", path: "/media/notes.txt" }],
        types: ["Files"],
        dropEffect: "",
      },
    });

    mainView.dispatchEvent(drop);
    await Promise.resolve();

    expect(drop.defaultPrevented).toBe(true);
    expect(activateTabMock).not.toHaveBeenCalled();
    expect(createNowPlayingViewMock).not.toHaveBeenCalled();
  });
});
