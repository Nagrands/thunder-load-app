jest.mock("electron", () => ({
  Notification: jest.fn().mockImplementation(() => ({
    show: jest.fn(),
    on: jest.fn(),
  })),
  shell: {
    openPath: jest.fn(),
  },
}));

const mockExpandMainWindowForToggle = jest.fn();

jest.mock("../windowActivation", () => ({
  expandMainWindowForToggle: (...args) =>
    mockExpandMainWindowForToggle(...args),
}));

describe("notifications", () => {
  beforeEach(() => {
    jest.resetModules();
    jest.clearAllMocks();
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
      retryable: true,
      retryAfterMinutes: 7,
    });
  });

  test("marks auth-required downloader errors as non-retryable", () => {
    const { classifyDownloadError } = require("../notifications.js");

    expect(
      classifyDownloadError(
        new Error(
          "ERR_YTDLP_AUTH_REQUIRED: This video requires authorization.",
        ),
      ),
    ).toMatchObject({
      code: "AUTH_REQUIRED",
      retryable: false,
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
    ).toContain("Не удалось получить данные от источника");
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

  test("formats disk-full errors into user-friendly text", () => {
    const {
      formatDownloadErrorMessage,
      classifyDownloadError,
    } = require("../notifications.js");

    expect(
      classifyDownloadError(new Error("ENOSPC: no space left on device")),
    ).toMatchObject({
      code: "DISK_FULL",
      retryable: false,
    });
    expect(
      formatDownloadErrorMessage(new Error("ENOSPC: no space left on device")),
    ).toContain("места");
  });

  test("formats missing tools message when both dependencies are unavailable", () => {
    const {
      formatMissingDownloadToolsMessage,
    } = require("../notifications.js");

    expect(
      formatMissingDownloadToolsMessage({
        hasYtDlp: false,
        hasFfmpeg: false,
      }),
    ).toContain("yt-dlp и ffmpeg");
  });

  test("formats missing tools message when yt-dlp is unavailable", () => {
    const {
      formatMissingDownloadToolsMessage,
    } = require("../notifications.js");

    expect(
      formatMissingDownloadToolsMessage({
        hasYtDlp: false,
        hasFfmpeg: true,
      }),
    ).toContain("Не найден yt-dlp");
  });

  test("expands window on download complete when toggle is enabled", () => {
    const {
      sendDownloadCompletionNotification,
    } = require("../notifications.js");
    const store = {
      get: jest.fn((key, fallback) =>
        key === "expandWindowOnDownloadComplete" ? true : fallback,
      ),
      set: jest.fn(),
    };
    const mainWindow = {
      webContents: { send: jest.fn() },
    };

    sendDownloadCompletionNotification(
      "demo.mp4",
      "/tmp/demo.mp4",
      store,
      mainWindow,
    );

    expect(store.set).toHaveBeenCalledWith(
      "lastDownloadedFile",
      "/tmp/demo.mp4",
    );
    expect(mainWindow.webContents.send).toHaveBeenCalledWith(
      "download-complete",
      { title: "demo.mp4", filePath: "/tmp/demo.mp4" },
    );
    expect(mockExpandMainWindowForToggle).toHaveBeenCalledTimes(1);
    expect(mockExpandMainWindowForToggle).toHaveBeenCalledWith(mainWindow);
  });

  test("does not expand window on download complete when toggle is disabled", () => {
    const {
      sendDownloadCompletionNotification,
    } = require("../notifications.js");
    const store = {
      get: jest.fn((key, fallback) =>
        key === "expandWindowOnDownloadComplete" ? false : fallback,
      ),
      set: jest.fn(),
    };
    const mainWindow = {
      webContents: { send: jest.fn() },
    };

    sendDownloadCompletionNotification(
      "demo.mp4",
      "/tmp/demo.mp4",
      store,
      mainWindow,
    );

    expect(mockExpandMainWindowForToggle).not.toHaveBeenCalled();
  });
});
