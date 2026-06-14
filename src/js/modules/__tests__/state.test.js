/** @jest-environment jsdom */

const buildDom = () => {
  document.body.innerHTML = `
    <input id="url" type="text" />
    <button id="download-button" type="button"></button>
    <button id="enqueue-button" type="button"></button>
    <button id="download-cancel" type="button"></button>
  `;
};

describe("state", () => {
  beforeEach(() => {
    jest.resetModules();
    buildDom();
    localStorage.clear();
  });

  test("keeps download actions disabled when downloader is unavailable", async () => {
    await jest.isolateModulesAsync(async () => {
      jest.doMock("../validation.js", () => ({
        isValidUrl: jest.fn(() => true),
        isSupportedUrl: jest.fn(() => true),
      }));
      jest.doMock("../downloadJobs.js", () => ({
        getActiveDownloadJobs: jest.fn(() => []),
      }));
      jest.doMock("../downloaderAvailability.js", () => ({
        isDownloaderAvailable: jest.fn(() => false),
      }));

      const { updateButtonState } = await import("../state.js");
      document.getElementById("url").value = "https://example.com/video";

      updateButtonState();

      expect(document.getElementById("download-button").disabled).toBe(true);
      expect(
        document
          .getElementById("download-button")
          .getAttribute("aria-disabled"),
      ).toBe("true");
      expect(document.getElementById("enqueue-button").disabled).toBe(true);
      expect(
        document.getElementById("enqueue-button").getAttribute("aria-disabled"),
      ).toBe("true");
    });
  });
});
