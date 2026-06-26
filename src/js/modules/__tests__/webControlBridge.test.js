describe("webControlBridge", () => {
  beforeEach(() => {
    jest.resetModules();
    localStorage.clear();
    window.electron = {
      invoke: jest.fn((channel, value) => {
        const responses = {
          "get-download-path": "/tmp/downloads",
          "get-download-parallel-limit": 1,
          "get-open-on-copy-url-status": false,
          "get-open-on-download-complete-status": true,
          "get-disable-complete-modal-status": true,
          "set-download-parallel-limit": { success: true, limit: value },
          "set-open-on-copy-url-status": true,
          "set-open-on-download-complete-status": true,
          "set-disable-complete-modal-status": true,
        };
        return Promise.resolve(responses[channel]);
      }),
      on: jest.fn(),
      send: jest.fn(),
    };
  });

  it("returns settings snapshot for the web UI", async () => {
    jest.doMock("../downloadManager.js", () => ({
      getWebControlSnapshot: jest.fn(),
      handleWebControlDownloaderAction: jest.fn(),
    }));
    jest.doMock("../settingsStore.js", () => ({
      getTheme: jest.fn().mockResolvedValue("dark"),
      setTheme: jest.fn(),
      getFontSize: jest.fn().mockResolvedValue("16"),
      setFontSize: jest.fn(),
    }));
    jest.doMock("../i18n.js", () => ({
      getLanguage: jest.fn(() => "ru"),
      setLanguagePreview: jest.fn(),
    }));

    const { handleWebControlRequest } = require("../webControlBridge.js");
    const settings = await handleWebControlRequest({ command: "settings:get" });

    expect(settings).toMatchObject({
      downloadPath: "/tmp/downloads",
      parallelLimit: 1,
      openOnDownloadComplete: true,
      disableCompleteModal: true,
      theme: "dark",
      language: "ru",
      fontSize: "16",
    });
  });

  it("subscribes to main-process web requests and sends responses", async () => {
    const actionMock = jest.fn().mockResolvedValue({ counts: { pending: 0 } });
    jest.doMock("../downloadManager.js", () => ({
      getWebControlSnapshot: jest.fn(),
      handleWebControlDownloaderAction: actionMock,
    }));
    jest.doMock("../settingsStore.js", () => ({
      getTheme: jest.fn(),
      setTheme: jest.fn(),
      getFontSize: jest.fn(),
      setFontSize: jest.fn(),
    }));
    jest.doMock("../i18n.js", () => ({
      getLanguage: jest.fn(),
      setLanguagePreview: jest.fn(),
    }));

    const { initWebControlBridge } = require("../webControlBridge.js");
    initWebControlBridge();
    const listener = window.electron.on.mock.calls[0][1];
    await listener({
      requestId: "req-1",
      command: "downloader:pause",
      payload: {},
    });

    expect(actionMock).toHaveBeenCalledWith("downloader:pause", {});
    expect(window.electron.send).toHaveBeenCalledWith("web:rendererResponse", {
      requestId: "req-1",
      success: true,
      result: { counts: { pending: 0 } },
    });
  });
});
