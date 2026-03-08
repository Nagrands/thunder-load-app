import { t } from "./i18n.js";
import "../shared/downloadErrorClassifier.shared.js";

const { classifyDownloadError, getDownloadErrorMetaByCode } =
  globalThis.__thunderDownloadErrorClassifier || {};

export function getDownloadErrorDetails(errorLike) {
  if (errorLike?.errorCode && typeof getDownloadErrorMetaByCode === "function") {
    const meta = getDownloadErrorMetaByCode(errorLike.errorCode);
    return {
      ...meta,
      message: errorLike?.message || meta.defaultMessage,
      rawMessage: String(errorLike?.message || ""),
      retryAfterMinutes: errorLike?.retryAfterMinutes ?? null,
      retryable:
        typeof errorLike?.retryable === "boolean"
          ? errorLike.retryable
          : meta.retryable,
    };
  }
  if (typeof classifyDownloadError === "function") {
    return classifyDownloadError(errorLike);
  }
  const message = String(errorLike?.message || errorLike || "");
  return {
    code: "UNKNOWN",
    toastKey: "download.error.retry",
    queueReasonKey: "queue.reason.unknown",
    historyReasonKey: "history.failed.reason.unknown",
    retryable: true,
    message,
    rawMessage: message,
    retryAfterMinutes: null,
  };
}

export function formatDownloadErrorToast(errorLike) {
  const details = getDownloadErrorDetails(errorLike);
  if (details.code === "YOUTUBE_RATE_LIMIT") {
    const mins = Number(details.retryAfterMinutes || 0);
    if (mins > 0) {
      return t("download.error.youtubeRateLimitTimed", { minutes: mins });
    }
  }
  return t(details.toastKey);
}

export function formatDownloadQueueReason(errorLike) {
  const details = getDownloadErrorDetails(errorLike);
  return t(details.queueReasonKey);
}

export function formatDownloadHistoryReason(errorLike) {
  const details = getDownloadErrorDetails(errorLike);
  return t(details.historyReasonKey);
}
