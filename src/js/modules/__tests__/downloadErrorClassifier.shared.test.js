describe("downloadErrorClassifier shared helper", () => {
  beforeEach(() => {
    jest.resetModules();
  });

  test("classifies auth-required errors consistently", async () => {
    await import("../../shared/downloadErrorClassifier.shared.js");
    const { classifyDownloadError, getDownloadErrorMetaByCode } =
      globalThis.__thunderDownloadErrorClassifier;

    expect(
      classifyDownloadError(
        new Error(
          "ERR_YTDLP_AUTH_REQUIRED: This video requires authorization.",
        ),
      ),
    ).toMatchObject({
      code: "AUTH_REQUIRED",
      retryable: false,
      toastKey: "download.error.authRequired",
    });

    expect(getDownloadErrorMetaByCode("AUTH_REQUIRED")).toMatchObject({
      queueReasonKey: "queue.reason.authRequired",
      historyReasonKey: "history.failed.reason.authRequired",
      retryable: false,
    });
  });

  test("classifies network timeout with neutral default message", async () => {
    await import("../../shared/downloadErrorClassifier.shared.js");
    const { classifyDownloadError, getDownloadErrorMetaByCode } =
      globalThis.__thunderDownloadErrorClassifier;

    expect(
      classifyDownloadError(
        new Error("ERR_YTDLP_NETWORK_TIMEOUT: read timed out"),
      ),
    ).toMatchObject({
      code: "NETWORK_TIMEOUT",
      retryable: true,
      toastKey: "download.error.networkTimeout",
      message:
        "Не удалось получить данные от источника. Проверьте подключение и повторите попытку.",
    });

    expect(getDownloadErrorMetaByCode("NETWORK_TIMEOUT")).toMatchObject({
      retryable: true,
      defaultMessage:
        "Не удалось получить данные от источника. Проверьте подключение и повторите попытку.",
    });
  });

  test("classifies unsupported, not found, exec failed and rate limit errors", async () => {
    await import("../../shared/downloadErrorClassifier.shared.js");
    const { classifyDownloadError, getDownloadErrorMetaByCode } =
      globalThis.__thunderDownloadErrorClassifier;

    expect(
      classifyDownloadError(
        new Error("ERR_YTDLP_UNSUPPORTED_URL: unsupported source"),
      ),
    ).toMatchObject({
      code: "UNSUPPORTED_URL",
      retryable: false,
      toastKey: "download.error.unsupportedUrl",
    });

    expect(
      classifyDownloadError(new Error("ERR_YTDLP_NOT_FOUND: http 404")),
    ).toMatchObject({
      code: "NOT_FOUND",
      retryable: false,
      toastKey: "download.error.notFound",
    });

    expect(
      classifyDownloadError(
        new Error("ERR_YTDLP_EXEC_FAILED: spawn Unknown system error -88"),
      ),
    ).toMatchObject({
      code: "EXEC_FAILED",
      retryable: true,
      toastKey: "download.error.execFailed",
    });

    expect(
      classifyDownloadError(
        new Error(
          "ERR_YTDLP_RATE_LIMIT: YouTube temporarily rate-limited requests for this client (about 5 minutes)",
        ),
      ),
    ).toMatchObject({
      code: "YTDLP_RATE_LIMIT",
      retryable: true,
      retryAfterMinutes: 5,
      toastKey: "download.error.youtubeRateLimit",
    });

    expect(getDownloadErrorMetaByCode("EXEC_FAILED")).toMatchObject({
      queueReasonKey: "queue.reason.execFailed",
    });
  });

  test("classifies private content, captcha, disk full and permission errors", async () => {
    await import("../../shared/downloadErrorClassifier.shared.js");
    const { classifyDownloadError } =
      globalThis.__thunderDownloadErrorClassifier;

    expect(
      classifyDownloadError(new Error("Private video. Join this channel.")),
    ).toMatchObject({
      code: "PRIVATE_CONTENT",
      retryable: false,
      toastKey: "download.error.privateContent",
    });

    expect(
      classifyDownloadError(new Error("Sign in to confirm you’re not a bot")),
    ).toMatchObject({
      code: "CAPTCHA_REQUIRED",
      retryable: false,
      toastKey: "download.error.captchaRequired",
    });

    expect(
      classifyDownloadError(new Error("ENOSPC: no space left on device")),
    ).toMatchObject({
      code: "DISK_FULL",
      retryable: false,
      toastKey: "download.error.diskFull",
    });

    expect(
      classifyDownloadError(
        new Error("EACCES: permission denied, open '/tmp/file'"),
      ),
    ).toMatchObject({
      code: "PERMISSION_DENIED",
      retryable: false,
      toastKey: "download.error.permissionDenied",
    });
  });
});
