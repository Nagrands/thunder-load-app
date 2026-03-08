describe("downloadErrorUi", () => {
  beforeEach(() => {
    jest.resetModules();
  });

  it("formats rate limit toast with minutes", () => {
    jest.isolateModules(() => {
      jest.doMock("../i18n", () => ({
        t: jest.fn((key, vars = {}) =>
          key === "download.error.youtubeRateLimitTimed"
            ? `Повторите через ${vars.minutes} мин.`
            : key,
        ),
      }));

      const { formatDownloadErrorToast } = require("../downloadErrorUi");

      expect(
        formatDownloadErrorToast({
          errorCode: "YOUTUBE_RATE_LIMIT",
          retryAfterMinutes: 7,
        }),
      ).toBe("Повторите через 7 мин.");
    });
  });

  it("formats queue reason via shared metadata", () => {
    jest.isolateModules(() => {
      jest.doMock("../i18n", () => ({
        t: jest.fn((key) =>
          key === "queue.reason.privateContent"
            ? "Закрытый доступ"
            : key === "history.failed.reason.privateContent"
              ? "Restricted access"
              : key,
        ),
      }));

      const { formatDownloadQueueReason, getDownloadErrorDetails } =
        require("../downloadErrorUi");

      expect(
        formatDownloadQueueReason({
          errorCode: "PRIVATE_CONTENT",
          message: "members-only",
          retryable: false,
        }),
      ).toBe("Закрытый доступ");
      expect(
        require("../downloadErrorUi").formatDownloadHistoryReason({
          errorCode: "PRIVATE_CONTENT",
          message: "members-only",
          retryable: false,
        }),
      ).toBe("Restricted access");
      expect(
        getDownloadErrorDetails({
          errorCode: "PRIVATE_CONTENT",
          message: "members-only",
          retryable: false,
        }),
      ).toMatchObject({
        code: "PRIVATE_CONTENT",
        retryable: false,
      });
    });
  });

  it("formats known toast keys for all focused downloader codes", () => {
    jest.isolateModules(() => {
      const translations = {
        "download.error.networkTimeout": "Сбой сети",
        "download.error.authRequired": "Нужна авторизация",
        "download.error.geoBlocked": "Недоступно в регионе",
        "download.error.unavailable": "Видео недоступно",
        "download.error.privateContent": "Закрытый доступ",
        "download.error.captchaRequired": "Нужна проверка",
        "download.error.diskFull": "Недостаточно места",
        "download.error.permissionDenied": "Нет доступа",
      };
      jest.doMock("../i18n", () => ({
        t: jest.fn((key) => translations[key] || key),
      }));

      const { formatDownloadErrorToast } = require("../downloadErrorUi");

      expect(
        formatDownloadErrorToast({ errorCode: "NETWORK_TIMEOUT" }),
      ).toBe("Сбой сети");
      expect(
        formatDownloadErrorToast({ errorCode: "AUTH_REQUIRED" }),
      ).toBe("Нужна авторизация");
      expect(
        formatDownloadErrorToast({ errorCode: "GEO_BLOCKED" }),
      ).toBe("Недоступно в регионе");
      expect(formatDownloadErrorToast({ errorCode: "UNAVAILABLE" })).toBe(
        "Видео недоступно",
      );
      expect(
        formatDownloadErrorToast({ errorCode: "PRIVATE_CONTENT" }),
      ).toBe("Закрытый доступ");
      expect(
        formatDownloadErrorToast({ errorCode: "CAPTCHA_REQUIRED" }),
      ).toBe("Нужна проверка");
      expect(formatDownloadErrorToast({ errorCode: "DISK_FULL" })).toBe(
        "Недостаточно места",
      );
      expect(
        formatDownloadErrorToast({ errorCode: "PERMISSION_DENIED" }),
      ).toBe("Нет доступа");
    });
  });

  it("formats queue and history labels for all focused downloader codes", () => {
    jest.isolateModules(() => {
      const translations = {
        "queue.reason.networkTimeout": "queue:network",
        "queue.reason.authRequired": "queue:auth",
        "queue.reason.geoBlocked": "queue:geo",
        "queue.reason.unavailable": "queue:unavailable",
        "queue.reason.privateContent": "queue:private",
        "queue.reason.captchaRequired": "queue:captcha",
        "queue.reason.diskFull": "queue:disk",
        "queue.reason.permissionDenied": "queue:permission",
        "history.failed.reason.networkTimeout": "history:network",
        "history.failed.reason.authRequired": "history:auth",
        "history.failed.reason.geoBlocked": "history:geo",
        "history.failed.reason.unavailable": "history:unavailable",
        "history.failed.reason.privateContent": "history:private",
        "history.failed.reason.captchaRequired": "history:captcha",
        "history.failed.reason.diskFull": "history:disk",
        "history.failed.reason.permissionDenied": "history:permission",
      };
      jest.doMock("../i18n", () => ({
        t: jest.fn((key) => translations[key] || key),
      }));

      const {
        formatDownloadQueueReason,
        formatDownloadHistoryReason,
      } = require("../downloadErrorUi");

      const cases = [
        ["NETWORK_TIMEOUT", "queue:network", "history:network"],
        ["AUTH_REQUIRED", "queue:auth", "history:auth"],
        ["GEO_BLOCKED", "queue:geo", "history:geo"],
        ["UNAVAILABLE", "queue:unavailable", "history:unavailable"],
        ["PRIVATE_CONTENT", "queue:private", "history:private"],
        ["CAPTCHA_REQUIRED", "queue:captcha", "history:captcha"],
        ["DISK_FULL", "queue:disk", "history:disk"],
        ["PERMISSION_DENIED", "queue:permission", "history:permission"],
      ];

      for (const [errorCode, queueLabel, historyLabel] of cases) {
        expect(formatDownloadQueueReason({ errorCode })).toBe(queueLabel);
        expect(formatDownloadHistoryReason({ errorCode })).toBe(historyLabel);
      }
    });
  });

  it("keeps retryable flags and unknown fallback stable", () => {
    jest.isolateModules(() => {
      jest.doMock("../i18n", () => ({
        t: jest.fn((key) => key),
      }));

      const { getDownloadErrorDetails, formatDownloadErrorToast } =
        require("../downloadErrorUi");

      expect(getDownloadErrorDetails({ errorCode: "AUTH_REQUIRED" })).toMatchObject(
        {
          code: "AUTH_REQUIRED",
          retryable: false,
        },
      );
      expect(getDownloadErrorDetails({ errorCode: "NETWORK_TIMEOUT" })).toMatchObject(
        {
          code: "NETWORK_TIMEOUT",
          retryable: true,
        },
      );
      expect(
        getDownloadErrorDetails(new Error("something unexpected happened")),
      ).toMatchObject({
        code: "UNKNOWN",
        retryable: true,
      });
      expect(
        formatDownloadErrorToast(new Error("something unexpected happened")),
      ).toBe("download.error.retry");
    });
  });
});
