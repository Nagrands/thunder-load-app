/** @jest-environment jsdom */

const setupElectron = () => {
  const invoke = jest.fn();
  window.electron = {
    ipcRenderer: { invoke },
  };
  return invoke;
};

describe("videoInfoBroker", () => {
  beforeEach(() => {
    jest.resetModules();
    delete window.__videoInfoCache;
    delete window.__videoInfoBrokerState;
  });

  it("deduplicates parallel preview requests by URL", async () => {
    const invoke = setupElectron();
    invoke.mockResolvedValue({
      success: true,
      title: "Preview title",
      thumbnail: "https://cdn.example.com/thumb.jpg",
      formats: [],
    });

    await jest.isolateModulesAsync(async () => {
      const { getVideoPreview } = require("../videoInfoBroker");

      const [first, second] = await Promise.all([
        getVideoPreview("https://example.com/watch?v=1"),
        getVideoPreview("https://example.com/watch?v=1"),
      ]);

      expect(invoke).toHaveBeenCalledTimes(1);
      expect(invoke).toHaveBeenCalledWith(
        "get-video-preview",
        "https://example.com/watch?v=1",
      );
      expect(first).toMatchObject({ title: "Preview title", formats: [] });
      expect(second).toMatchObject({ title: "Preview title", formats: [] });
    });
  });

  it("serves preview from cached full info without another IPC request", async () => {
    const invoke = setupElectron();

    await jest.isolateModulesAsync(async () => {
      const { setCachedVideoInfo } = require("../videoInfoCache");
      const { getVideoPreview } = require("../videoInfoBroker");
      setCachedVideoInfo("https://example.com/video", {
        success: true,
        title: "Cached full info",
        thumbnail: "https://cdn.example.com/full.jpg",
        formats: [{ format_id: "137" }],
      });

      const preview = await getVideoPreview("https://example.com/video");

      expect(invoke).not.toHaveBeenCalled();
      expect(preview).toMatchObject({
        title: "Cached full info",
        thumbnail: "https://cdn.example.com/full.jpg",
        formats: [],
      });
    });
  });

  it("deduplicates full info requests and stores the successful result", async () => {
    const invoke = setupElectron();
    invoke.mockResolvedValue({
      success: true,
      title: "Full title",
      formats: [{ format_id: "137" }],
    });

    await jest.isolateModulesAsync(async () => {
      const { getCachedVideoInfo } = require("../videoInfoCache");
      const { getVideoInfo } = require("../videoInfoBroker");

      const [first, second] = await Promise.all([
        getVideoInfo("https://example.com/full"),
        getVideoInfo("https://example.com/full"),
      ]);

      expect(invoke).toHaveBeenCalledTimes(1);
      expect(invoke).toHaveBeenCalledWith(
        "get-video-info",
        "https://example.com/full",
      );
      expect(first).toBe(second);
      expect(getCachedVideoInfo("https://example.com/full")).toMatchObject({
        title: "Full title",
        formats: [{ format_id: "137" }],
      });
    });
  });

  it("fetches full info when only preview metadata is cached", async () => {
    const invoke = setupElectron();
    invoke.mockImplementation((channel) =>
      Promise.resolve(
        channel === "get-video-preview"
          ? {
              success: true,
              title: "Preview only",
              thumbnail: "https://cdn.example.com/preview.jpg",
              formats: [],
            }
          : {
              success: true,
              title: "Full info",
              formats: [{ format_id: "140" }],
            },
      ),
    );

    await jest.isolateModulesAsync(async () => {
      const { getVideoInfo, getVideoPreview } = require("../videoInfoBroker");

      await getVideoPreview("https://example.com/preview-first");
      const info = await getVideoInfo("https://example.com/preview-first");

      expect(invoke).toHaveBeenCalledWith(
        "get-video-preview",
        "https://example.com/preview-first",
      );
      expect(invoke).toHaveBeenCalledWith(
        "get-video-info",
        "https://example.com/preview-first",
      );
      expect(info).toMatchObject({
        title: "Full info",
        formats: [{ format_id: "140" }],
      });
    });
  });
});
