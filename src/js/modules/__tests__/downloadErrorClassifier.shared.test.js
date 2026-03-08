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

  test("classifies private content, captcha, disk full and permission errors", async () => {
    await import("../../shared/downloadErrorClassifier.shared.js");
    const { classifyDownloadError } = globalThis.__thunderDownloadErrorClassifier;

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
      classifyDownloadError(new Error("EACCES: permission denied, open '/tmp/file'")),
    ).toMatchObject({
      code: "PERMISSION_DENIED",
      retryable: false,
      toastKey: "download.error.permissionDenied",
    });
  });
});
