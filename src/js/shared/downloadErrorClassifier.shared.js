(function initDownloadErrorClassifier(globalScope) {
  const DEFINITIONS = [
    {
      prefix: "ERR_YTDLP_NETWORK_TIMEOUT:",
      code: "NETWORK_TIMEOUT",
      toastKey: "download.error.networkTimeout",
      queueReasonKey: "queue.reason.networkTimeout",
      historyReasonKey: "history.failed.reason.networkTimeout",
      retryable: true,
      defaultMessage:
        "Не удалось связаться с YouTube. Проверьте подключение и повторите попытку.",
    },
    {
      prefix: "ERR_YTDLP_AUTH_REQUIRED:",
      code: "AUTH_REQUIRED",
      toastKey: "download.error.authRequired",
      queueReasonKey: "queue.reason.authRequired",
      historyReasonKey: "history.failed.reason.authRequired",
      retryable: false,
      defaultMessage:
        "Видео требует авторизации. Добавьте cookies браузера и повторите попытку.",
    },
    {
      prefix: "ERR_YTDLP_GEO_BLOCKED:",
      code: "GEO_BLOCKED",
      toastKey: "download.error.geoBlocked",
      queueReasonKey: "queue.reason.geoBlocked",
      historyReasonKey: "history.failed.reason.geoBlocked",
      retryable: false,
      defaultMessage: "Видео недоступно в вашем регионе.",
    },
    {
      prefix: "ERR_YTDLP_UNAVAILABLE:",
      code: "UNAVAILABLE",
      toastKey: "download.error.unavailable",
      queueReasonKey: "queue.reason.unavailable",
      historyReasonKey: "history.failed.reason.unavailable",
      retryable: false,
      defaultMessage: "Видео недоступно или было удалено.",
    },
    {
      prefix: "ERR_YTDLP_PRIVATE_CONTENT:",
      code: "PRIVATE_CONTENT",
      toastKey: "download.error.privateContent",
      queueReasonKey: "queue.reason.privateContent",
      historyReasonKey: "history.failed.reason.privateContent",
      retryable: false,
      defaultMessage:
        "Видео доступно только владельцу, подписчикам или участникам канала.",
    },
    {
      prefix: "ERR_YTDLP_CAPTCHA_REQUIRED:",
      code: "CAPTCHA_REQUIRED",
      toastKey: "download.error.captchaRequired",
      queueReasonKey: "queue.reason.captchaRequired",
      historyReasonKey: "history.failed.reason.captchaRequired",
      retryable: false,
      defaultMessage:
        "Источник запросил проверку или подтверждение входа. Обновите cookies и повторите попытку.",
    },
    {
      prefix: "ERR_DOWNLOAD_DISK_FULL:",
      code: "DISK_FULL",
      toastKey: "download.error.diskFull",
      queueReasonKey: "queue.reason.diskFull",
      historyReasonKey: "history.failed.reason.diskFull",
      retryable: false,
      defaultMessage:
        "Недостаточно свободного места в папке загрузки.",
    },
    {
      prefix: "ERR_DOWNLOAD_PERMISSION_DENIED:",
      code: "PERMISSION_DENIED",
      toastKey: "download.error.permissionDenied",
      queueReasonKey: "queue.reason.permissionDenied",
      historyReasonKey: "history.failed.reason.permissionDenied",
      retryable: false,
      defaultMessage:
        "Нет доступа к папке загрузки или целевому файлу.",
    },
  ];

  const RATE_LIMIT_PATTERN = /YouTube temporarily rate-limited requests/i;
  const RATE_LIMIT_MINUTES_PATTERN = /about\s+(\d+)\s+minute/i;
  const PRIVATE_CONTENT_PATTERN =
    /This video is private|Private video|members-only|Join this channel|channel members only/i;
  const CAPTCHA_REQUIRED_PATTERN =
    /Sign in to confirm you.?re not a bot|captcha|verify you are human|human verification/i;
  const DISK_FULL_PATTERN =
    /ENOSPC|No space left on device|disk full|not enough space/i;
  const PERMISSION_DENIED_PATTERN =
    /EACCES|EPERM|permission denied|access denied|operation not permitted/i;

  function getDownloadErrorMetaByCode(code) {
    const normalized = String(code || "").trim().toUpperCase();
    const found = DEFINITIONS.find((item) => item.code === normalized);
    if (found) return found;
    if (normalized === "YOUTUBE_RATE_LIMIT") {
      return {
        code: "YOUTUBE_RATE_LIMIT",
        toastKey: "download.error.youtubeRateLimit",
        queueReasonKey: "queue.reason.youtubeRateLimit",
        historyReasonKey: "history.failed.reason.youtubeRateLimit",
        retryable: true,
        defaultMessage:
          "YouTube временно ограничил запросы. Повторите попытку позже.",
      };
    }
    return {
      code: "UNKNOWN",
      toastKey: "download.error.retry",
      queueReasonKey: "queue.reason.unknown",
      historyReasonKey: "history.failed.reason.unknown",
      retryable: true,
      defaultMessage: "Ошибка при загрузке.",
    };
  }

  function classifyDownloadError(errorLike) {
    const rawMessage = String(errorLike?.message || errorLike || "").trim();
    if (!rawMessage) {
    const fallback = getDownloadErrorMetaByCode("UNKNOWN");
    return {
      ...fallback,
      message: fallback.defaultMessage,
      rawMessage,
      retryAfterMinutes: null,
    };
    }

    for (const definition of DEFINITIONS) {
      if (rawMessage.startsWith(definition.prefix)) {
        const detailMessage = rawMessage.slice(definition.prefix.length).trim();
        return {
          ...definition,
          message: definition.defaultMessage,
          detailMessage,
          rawMessage,
          retryAfterMinutes: null,
        };
      }
    }

    if (RATE_LIMIT_PATTERN.test(rawMessage)) {
      const rateLimitMatch = rawMessage.match(RATE_LIMIT_MINUTES_PATTERN);
      const retryAfterMinutes = rateLimitMatch
        ? Number(rateLimitMatch[1]) || null
        : null;
      return {
        ...getDownloadErrorMetaByCode("YOUTUBE_RATE_LIMIT"),
        message: retryAfterMinutes
          ? `YouTube временно ограничил запросы. Попробуйте снова примерно через ${retryAfterMinutes} мин.`
          : "YouTube временно ограничил запросы. Повторите попытку позже.",
        rawMessage,
        retryAfterMinutes,
      };
    }

    if (PRIVATE_CONTENT_PATTERN.test(rawMessage)) {
      const meta = getDownloadErrorMetaByCode("PRIVATE_CONTENT");
      return {
        ...meta,
        message: meta.defaultMessage,
        rawMessage,
        retryAfterMinutes: null,
      };
    }

    if (CAPTCHA_REQUIRED_PATTERN.test(rawMessage)) {
      const meta = getDownloadErrorMetaByCode("CAPTCHA_REQUIRED");
      return {
        ...meta,
        message: meta.defaultMessage,
        rawMessage,
        retryAfterMinutes: null,
      };
    }

    if (DISK_FULL_PATTERN.test(rawMessage)) {
      const meta = getDownloadErrorMetaByCode("DISK_FULL");
      return {
        ...meta,
        message: meta.defaultMessage,
        rawMessage,
        retryAfterMinutes: null,
      };
    }

    if (PERMISSION_DENIED_PATTERN.test(rawMessage)) {
      const meta = getDownloadErrorMetaByCode("PERMISSION_DENIED");
      return {
        ...meta,
        message: meta.defaultMessage,
        rawMessage,
        retryAfterMinutes: null,
      };
    }

    const fallback = getDownloadErrorMetaByCode("UNKNOWN");
    return {
      ...fallback,
      message:
        rawMessage.replace(/^ERR_YTDLP_[A-Z_]+:\s*/i, "").trim() || rawMessage,
      rawMessage,
      retryAfterMinutes: null,
    };
  }

  const api = {
    classifyDownloadError,
    DOWNLOAD_ERROR_DEFINITIONS: DEFINITIONS,
    getDownloadErrorMetaByCode,
  };

  globalScope.__thunderDownloadErrorClassifier = api;

  if (typeof module !== "undefined" && module.exports) {
    module.exports = api;
  }
})(typeof globalThis !== "undefined" ? globalThis : window);
