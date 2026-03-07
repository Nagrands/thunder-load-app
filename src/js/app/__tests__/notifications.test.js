jest.mock("electron", () => ({
  Notification: jest.fn().mockImplementation(() => ({
    show: jest.fn(),
    on: jest.fn(),
  })),
  shell: {
    openPath: jest.fn(),
  },
}));

describe("notifications", () => {
  beforeEach(() => {
    jest.resetModules();
  });

  test("formats downloader auth errors into user-friendly text", () => {
    const { formatDownloadErrorMessage } = require("../notifications.js");

    expect(
      formatDownloadErrorMessage(
        new Error(
          "ERR_YTDLP_AUTH_REQUIRED: This video requires authorization. Add browser cookies and try again.",
        ),
      ),
    ).toContain("авторизации");
  });

  test("formats downloader network timeouts into user-friendly text", () => {
    const { formatDownloadErrorMessage } = require("../notifications.js");

    expect(
      formatDownloadErrorMessage(
        new Error(
          "ERR_YTDLP_NETWORK_TIMEOUT: ERROR: Read timed out while contacting YouTube",
        ),
      ),
    ).toContain("YouTube");
  });
});
