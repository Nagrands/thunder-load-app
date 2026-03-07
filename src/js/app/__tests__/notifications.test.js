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

  test("classifies rate-limited downloader errors with retry delay", () => {
    const { classifyDownloadError } = require("../notifications.js");

    expect(
      classifyDownloadError(
        new Error(
          "YouTube temporarily rate-limited requests for this client (about 7 minutes)",
        ),
      ),
    ).toMatchObject({
      code: "YOUTUBE_RATE_LIMIT",
      retryAfterMinutes: 7,
    });
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

  test("formats downloader rate-limited errors with retry hint", () => {
    const { formatDownloadErrorMessage } = require("../notifications.js");

    expect(
      formatDownloadErrorMessage(
        new Error(
          "YouTube temporarily rate-limited requests for this client (about 7 minutes)",
        ),
      ),
    ).toContain("7 мин");
  });
});
