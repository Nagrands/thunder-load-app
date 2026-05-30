/** @jest-environment jsdom */

describe("videoInfoCache", () => {
  beforeEach(() => {
    jest.resetModules();
    delete window.__videoInfoCache;
  });

  it("stores full video info for quality modal reuse", async () => {
    await jest.isolateModulesAsync(async () => {
      const {
        getCachedVideoInfo,
        setCachedVideoInfo,
      } = require("../videoInfoCache");
      const info = {
        success: true,
        title: "Video title",
        thumbnail: "https://cdn.example.com/thumb.jpg",
        formats: [{ format_id: "18", vcodec: "h264", acodec: "aac" }],
      };

      setCachedVideoInfo("https://example.com/watch?v=1", info);

      expect(getCachedVideoInfo("https://example.com/watch?v=1")).toEqual(
        expect.objectContaining({
          title: "Video title",
          thumbnail: "https://cdn.example.com/thumb.jpg",
          formats: info.formats,
        }),
      );
    });
  });
});
