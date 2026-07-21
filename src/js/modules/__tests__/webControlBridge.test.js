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

  it("returns serializable compact quality options for preview requests", async () => {
    jest.doMock("../downloadManager.js", () => ({
      getWebControlSnapshot: jest.fn(),
      handleWebControlDownloaderAction: jest.fn(),
    }));
    jest.doMock("../videoInfoBroker.js", () => ({
      getVideoInfo: jest.fn().mockResolvedValue({
        success: true,
        title: "Example",
        formats: [
          {
            format_id: "137",
            ext: "mp4",
            height: 1080,
            vcodec: "avc1",
            acodec: "none",
          },
          {
            format_id: "140",
            ext: "m4a",
            abr: 128,
            vcodec: "none",
            acodec: "mp4a",
          },
        ],
      }),
    }));
    jest.doMock("../settingsStore.js", () => ({
      getTheme: jest.fn(),
      setTheme: jest.fn(),
      getFontSize: jest.fn(),
      setFontSize: jest.fn(),
    }));
    jest.doMock("../i18n.js", () => ({
      getLanguage: jest.fn(() => "ru"),
      setLanguagePreview: jest.fn(),
    }));

    const { handleWebControlRequest } = require("../webControlBridge.js");
    const preview = await handleWebControlRequest({
      command: "preview:get",
      payload: { url: "https://example.com/watch?v=1" },
    });

    expect(preview.videoOptions[0]).toMatchObject({
      id: "video-137",
      payload: { videoFormatId: "137" },
    });
    expect(preview.audioOptions[0]).toMatchObject({
      id: "audio-140",
      payload: { audioFormatId: "140" },
    });
    expect(preview.videoOptions[0]).not.toHaveProperty("fmt");
  });

  it("validates the complete settings patch before applying any setting", async () => {
    const setTheme = jest.fn();
    jest.doMock("../downloadManager.js", () => ({
      getWebControlSnapshot: jest.fn(),
      handleWebControlDownloaderAction: jest.fn(),
    }));
    jest.doMock("../settingsStore.js", () => ({
      getTheme: jest.fn().mockResolvedValue("dark"),
      setTheme,
      getFontSize: jest.fn().mockResolvedValue("16"),
      setFontSize: jest.fn(),
    }));
    jest.doMock("../i18n.js", () => ({
      getLanguage: jest.fn(() => "ru"),
      setLanguagePreview: jest.fn(),
    }));

    const { setWebControlSettings } = require("../webControlBridge.js");

    await expect(
      setWebControlSettings({ theme: "emerald", unexpected: true }),
    ).rejects.toThrow("Unknown setting: unexpected");
    expect(setTheme).not.toHaveBeenCalled();
    expect(window.electron.invoke).not.toHaveBeenCalled();
  });

  it.each([
    [{ openOnCopyUrl: "true" }, "Invalid boolean setting"],
    [{ downloadPath: "  " }, "Invalid download path"],
    [{ parallelLimit: 3 }, "Invalid parallel limit"],
    [{ qualityProfile: "lossless" }, "Invalid quality profile"],
    [{ theme: "system" }, "Invalid theme"],
    [{ fontSize: "17" }, "Invalid font size"],
    [{ language: "de" }, "Invalid language"],
  ])("rejects an invalid settings value %#", async (patch, error) => {
    jest.doMock("../downloadManager.js", () => ({
      getWebControlSnapshot: jest.fn(),
      handleWebControlDownloaderAction: jest.fn(),
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

    const { setWebControlSettings } = require("../webControlBridge.js");
    await expect(setWebControlSettings(patch)).rejects.toThrow(error);
  });

  it("propagates a structured download path failure", async () => {
    window.electron.invoke.mockImplementation((channel) => {
      if (channel === "set-download-path") {
        return Promise.resolve({
          success: false,
          error: "Path is unavailable",
        });
      }
      return Promise.resolve(undefined);
    });
    jest.doMock("../downloadManager.js", () => ({
      getWebControlSnapshot: jest.fn(),
      handleWebControlDownloaderAction: jest.fn(),
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

    const { setWebControlSettings } = require("../webControlBridge.js");
    await expect(
      setWebControlSettings({ downloadPath: "/missing" }),
    ).rejects.toThrow("Path is unavailable");
  });

  it("applies a valid partial patch and returns canonical settings", async () => {
    const setTheme = jest.fn();
    const setFontSize = jest.fn();
    const setLanguagePreview = jest.fn();
    jest.doMock("../downloadManager.js", () => ({
      getWebControlSnapshot: jest.fn(),
      handleWebControlDownloaderAction: jest.fn(),
    }));
    jest.doMock("../settingsStore.js", () => ({
      getTheme: jest.fn().mockResolvedValue("violet"),
      setTheme,
      getFontSize: jest.fn().mockResolvedValue("20"),
      setFontSize,
    }));
    jest.doMock("../i18n.js", () => ({
      getLanguage: jest.fn(() => "en"),
      setLanguagePreview,
    }));

    const { setWebControlSettings } = require("../webControlBridge.js");
    const settings = await setWebControlSettings({
      theme: "violet",
      language: "en",
      fontSize: "20",
      qualityProfile: "audio",
      openOnCopyUrl: true,
    });

    expect(setTheme).toHaveBeenCalledWith("violet");
    expect(setFontSize).toHaveBeenCalledWith("20");
    expect(setLanguagePreview).toHaveBeenCalledWith("en");
    expect(settings).toMatchObject({
      theme: "violet",
      language: "en",
      fontSize: "20",
      qualityProfile: "audio",
    });
  });
});
