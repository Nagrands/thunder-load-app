describe("bootstrapRenderer", () => {
  let mocks;

  beforeEach(() => {
    jest.resetModules();
    jest.useFakeTimers();
    document.body.innerHTML = `
      <div id="app-preloader"></div>
      <div id="main-view"></div>
    `;
    window.bootstrap = {};
    window.electron = {
      getPlatformInfo: jest.fn().mockResolvedValue({ isMac: false }),
    };
    mocks = {
      initHistory: jest.fn(),
      initHistoryState: jest.fn().mockResolvedValue(undefined),
      initIconUpdater: jest.fn(),
      initHotkeys: jest.fn(),
      initNetworkListeners: jest.fn(),
      initContextMenu: jest.fn(),
      initWhatsNewModal: jest.fn(),
      initSettings: jest.fn(),
      initUrlInputHandler: jest.fn(),
      initSort: jest.fn(),
      initHistoryFilter: jest.fn(),
      initHistoryActions: jest.fn(),
      initDownloadActions: jest.fn(),
      initDownloadCancel: jest.fn(),
      initDownloadCompleteHandler: jest.fn(),
      initExternalLinksHandler: jest.fn(),
      initTooltips: jest.fn(),
      initModalHandlers: jest.fn(),
      initElectronEvents: jest.fn(),
      initDownloadProgress: jest.fn(),
      initClipboardHandler: jest.fn(),
      initInterfaceHandlers: jest.fn(),
      initSettingsModal: jest.fn(),
      initUpdateHandler: jest.fn(),
      initTopBarThemeToggle: jest.fn(),
      initTopBarResponsive: jest.fn(),
      initFirstRunModal: jest.fn(),
      initializeTheme: jest.fn().mockResolvedValue(undefined),
      initializeFontSize: jest.fn().mockResolvedValue(undefined),
      initLowEffectsFromStore: jest.fn(),
      initI18n: jest.fn(),
      t: jest.fn(() => "Thunder Load"),
      registerTabs: jest.fn().mockResolvedValue({
        tabs: { setTabLabel: jest.fn() },
      }),
      registerI18nListeners: jest.fn(),
      registerStatusMessageListener: jest.fn(),
      registerWgControls: jest.fn(),
    };
  });

  afterEach(() => {
    jest.useRealTimers();
    delete window.requestIdleCallback;
  });

  test("marks body ready after critical init and defers non-critical modules", async () => {
    let idleCallback = null;
    window.requestIdleCallback = jest.fn((cb) => {
      idleCallback = cb;
      return 1;
    });

    let startRenderer;
    jest.isolateModules(() => {
      jest.doMock("../history.js", () => ({
        initHistory: mocks.initHistory,
        initHistoryState: mocks.initHistoryState,
      }));
      jest.doMock("../iconUpdater.js", () => ({
        initIconUpdater: mocks.initIconUpdater,
      }));
      jest.doMock("../hotkeys.js", () => ({ initHotkeys: mocks.initHotkeys }));
      jest.doMock("../network.js", () => ({
        initNetworkListeners: mocks.initNetworkListeners,
      }));
      jest.doMock("../contextMenu.js", () => ({
        initContextMenu: mocks.initContextMenu,
      }));
      jest.doMock("../whatsNewModal.js", () => ({
        initWhatsNewModal: mocks.initWhatsNewModal,
      }));
      jest.doMock("../settings.js", () => ({
        initSettings: mocks.initSettings,
      }));
      jest.doMock("../urlInputHandler.js", () => ({
        initUrlInputHandler: mocks.initUrlInputHandler,
      }));
      jest.doMock("../sort.js", () => ({ initSort: mocks.initSort }));
      jest.doMock("../historyFilter.js", () => ({
        initHistoryFilter: mocks.initHistoryFilter,
      }));
      jest.doMock("../historyActions.js", () => ({
        initHistoryActions: mocks.initHistoryActions,
      }));
      jest.doMock("../downloadActions.js", () => ({
        initDownloadActions: mocks.initDownloadActions,
      }));
      jest.doMock("../downloadCancel.js", () => ({
        initDownloadCancel: mocks.initDownloadCancel,
      }));
      jest.doMock("../downloadCompleteHandler.js", () => ({
        initDownloadCompleteHandler: mocks.initDownloadCompleteHandler,
      }));
      jest.doMock("../externalLinks.js", () => ({
        initExternalLinksHandler: mocks.initExternalLinksHandler,
      }));
      jest.doMock("../tooltipInitializer.js", () => ({
        initTooltips: mocks.initTooltips,
      }));
      jest.doMock("../modalHandlers.js", () => ({
        initModalHandlers: mocks.initModalHandlers,
      }));
      jest.doMock("../electronEvents.js", () => ({
        initElectronEvents: mocks.initElectronEvents,
      }));
      jest.doMock("../downloadProgress.js", () => ({
        initDownloadProgress: mocks.initDownloadProgress,
      }));
      jest.doMock("../clipboardHandler.js", () => ({
        initClipboardHandler: mocks.initClipboardHandler,
      }));
      jest.doMock("../interfaceHandlers.js", () => ({
        initInterfaceHandlers: mocks.initInterfaceHandlers,
      }));
      jest.doMock("../settingsModal.js", () => ({
        initSettingsModal: mocks.initSettingsModal,
      }));
      jest.doMock("../updateHandler.js", () => ({
        initUpdateHandler: mocks.initUpdateHandler,
      }));
      jest.doMock("../topBarThemeToggle.js", () => ({
        initTopBarThemeToggle: mocks.initTopBarThemeToggle,
      }));
      jest.doMock("../topBarResponsive.js", () => ({
        initTopBarResponsive: mocks.initTopBarResponsive,
      }));
      jest.doMock("../firstRunModal.js", () => ({
        initFirstRunModal: mocks.initFirstRunModal,
      }));
      jest.doMock("../themeManager.js", () => ({
        initializeTheme: mocks.initializeTheme,
      }));
      jest.doMock("../fontSizeManager.js", () => ({
        initializeFontSize: mocks.initializeFontSize,
      }));
      jest.doMock("../effectsMode.js", () => ({
        initLowEffectsFromStore: mocks.initLowEffectsFromStore,
      }));
      jest.doMock("../i18n.js", () => ({
        initI18n: mocks.initI18n,
        t: mocks.t,
      }));
      jest.doMock("../app/registerTabs.js", () => ({
        registerTabs: mocks.registerTabs,
      }));
      jest.doMock("../app/registerGlobalListeners.js", () => ({
        registerI18nListeners: mocks.registerI18nListeners,
        registerStatusMessageListener: mocks.registerStatusMessageListener,
        registerWgControls: mocks.registerWgControls,
      }));

      ({ startRenderer } = require("../app/bootstrapRenderer.js"));
    });

    await startRenderer();

    expect(mocks.initI18n).toHaveBeenCalled();
    expect(mocks.initializeTheme).toHaveBeenCalled();
    expect(mocks.initializeFontSize).toHaveBeenCalled();
    expect(mocks.registerTabs).toHaveBeenCalledWith(
      document.getElementById("main-view"),
    );
    expect(mocks.initUrlInputHandler).toHaveBeenCalled();
    expect(mocks.initHistory).toHaveBeenCalled();
    expect(mocks.initHistoryState).toHaveBeenCalled();
    expect(mocks.initTopBarResponsive).toHaveBeenCalled();
    expect(mocks.initFirstRunModal).toHaveBeenCalled();
    expect(mocks.registerStatusMessageListener).toHaveBeenCalled();
    expect(document.body.classList.contains("ready")).toBe(true);

    expect(mocks.initSettings).not.toHaveBeenCalled();
    expect(mocks.initTooltips).not.toHaveBeenCalled();
    expect(window.requestIdleCallback).toHaveBeenCalledTimes(1);
    expect(typeof idleCallback).toBe("function");

    idleCallback();
    await Promise.resolve();

    expect(mocks.initSettings).toHaveBeenCalled();
    expect(mocks.initTooltips).toHaveBeenCalled();
    expect(mocks.registerWgControls).toHaveBeenCalled();
    expect(mocks.initUpdateHandler).toHaveBeenCalled();
  });
});
